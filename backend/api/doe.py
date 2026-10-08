# ============================================================
#  api/doe.py  –  DOE Recommendation & Generation
# ============================================================
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, crud, schemas
from services.doe_service import recommend_designs, generate_design, evaluate_design_service

router = APIRouter(prefix="/doe", tags=["DOE"])


@router.post("/recommend")
def recommend_doe(body: schemas.DOERecommendRequest, db: Session = Depends(get_db)):
    factors = crud.get_factors(db, body.project_id)
    if not factors:
        raise HTTPException(400, "No factors defined. Define factors first.")
    has_htc = body.has_htc_factors or any(f.is_hard_to_change for f in factors)
    constraints = [c.model_dump() for c in body.constraints] if body.constraints else []
    options = recommend_designs(len(factors), body.phase, has_htc=has_htc, constraints=constraints, factors=factors)
    return {"options": options, "n_factors": len(factors), "phase": body.phase}


@router.post("/evaluate")
def evaluate_doe(body: schemas.PreRunEvaluationRequest, db: Session = Depends(get_db)):
    factors = crud.get_factors(db, body.project_id)
    if not factors:
        raise HTTPException(400, "No factors defined.")
    return evaluate_design_service(body.design_key, factors, "screening")


@router.post("/generate")
def generate_doe(body: schemas.DOEGenerateRequest, db: Session = Depends(get_db)):
    factors = crud.get_factors(db, body.project_id)
    if not factors:
        raise HTTPException(400, "No factors defined.")
    responses = crud.get_responses(db, body.project_id)

    constraints = [c.model_dump() for c in body.constraints] if body.constraints else []

    # Generate design
    result   = generate_design(body.design_key, factors, body.phase, constraints=constraints)
    exp_rows = result["experiments"]

    # Store in DB (clear previous for this project)
    db.query(__import__("database.models", fromlist=["Experiment"]).Experiment)\
      .filter_by(project_id=body.project_id, iteration=0).delete()
    db.commit()

    db_exps = crud.create_experiments(db, body.project_id, exp_rows)
    crud.update_project(db, body.project_id, schemas.ProjectUpdate(
        doe_type=result["design_info"]["design_type"],
        current_step="lab-experiments"
    ))

    crud.add_audit_log(db, body.project_id, "GENERATE_DOE", f"Generated {result['design_info']['design_type']} with {len(exp_rows)} runs")

    return {
        "design_info":  result["design_info"],
        "experiments":  [schemas.ExperimentOut.model_validate(e).model_dump() for e in db_exps],
        "factors":      [{"id": f.id, "name": f.name, "unit": f.unit,
                          "low": f.low, "high": f.high} for f in factors],
        "responses":    [{"id": r.id, "name": r.name, "goal": r.goal} for r in responses]
    }

