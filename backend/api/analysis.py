# ============================================================
#  api/analysis.py  –  Statistical Analysis endpoints
# ============================================================
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, crud, schemas
from services.analysis_service import run_analysis, run_optimization, get_contour, get_overlay_plot_service, run_monte_carlo_service, _get_val

router = APIRouter(prefix="/analysis", tags=["Analysis"])


@router.get("/{project_id}")
def get_analyses_endpoint(project_id: int, db: Session = Depends(get_db)):
    analyses = crud.get_analyses(db, project_id)
    return [{
        "response_idx": a.response_idx,
        "anova": a.anova,
        "rsm": a.regression,
        "diagnostics": a.diagnostics,
        "optimum": a.optimum
    } for a in analyses]


@router.post("/run")
def run_analysis_endpoint(body: schemas.AnalysisRequest, db: Session = Depends(get_db)):
    factors   = crud.get_factors(db, body.project_id)
    responses = crud.get_responses(db, body.project_id)
    exps      = crud.get_experiments(db, body.project_id)
    if not exps:
        raise HTTPException(400, "No experiments found. Generate DOE first.")

    exp_dicts = [{"coded_values": e.coded_values or [],
                  "actual_values": e.actual_values or [],
                  "result_values": e.result_values,
                  "run_type": e.run_type} for e in exps]

    resp_idx = body.response_idx
    if resp_idx >= len(responses):
        raise HTTPException(400, f"Response index {resp_idx} out of range")

    resp_meta = {"name": responses[resp_idx].name,
                 "goal": responses[resp_idx].goal,
                 "unit": responses[resp_idx].unit}

    result = run_analysis(exp_dicts, resp_idx, resp_meta, factors)
    if "error" in result:
        raise HTTPException(422, result["error"])

    # Store in DB
    crud.upsert_analysis(
        db, body.project_id, resp_idx,
        effects=result.get("anova", {}).get("rows", []) if result.get("anova") else [],
        anova=result.get("anova") or {},
        regression=result.get("rsm") or {},
        diagnostics=result.get("diagnostics") or {}
    )
    crud.update_project(db, body.project_id, schemas.ProjectUpdate(current_step="statistical-analysis"))
    return result


@router.post("/run-all")
def run_all_analyses(body: schemas.OptimizeRequest, db: Session = Depends(get_db)):
    """Run analysis for ALL responses in one call."""
    responses = crud.get_responses(db, body.project_id)
    results   = {}
    for i in range(len(responses)):
        req = schemas.AnalysisRequest(project_id=body.project_id, response_idx=i)
        try:
            results[i] = run_analysis_endpoint(req, db)
        except Exception as e:
            results[i] = {"error": str(e)}
    return results


@router.post("/optimize")
def optimize_endpoint(body: schemas.OptimizeRequest, db: Session = Depends(get_db)):
    factors   = crud.get_factors(db, body.project_id)
    responses = crud.get_responses(db, body.project_id)
    analyses  = crud.get_analyses(db, body.project_id)
    
    def _is_valid_reg(item):
        reg = _get_val(item, "regression")
        return isinstance(reg, dict) and (reg.get("converged") or reg.get("beta") or reg.get("coefficients"))

    if not analyses or len(analyses) < len(responses) or any(not _is_valid_reg(a) for a in analyses):
        run_all_analyses(body, db)
        analyses = crud.get_analyses(db, body.project_id)

    if not analyses:
        raise HTTPException(400, "Run analysis before optimization.")

    a_dicts = []
    for a in sorted(analyses, key=lambda x: x.response_idx):
        anova_dict = a.anova if isinstance(a.anova, dict) else {}
        y_mean = anova_dict.get("y_mean", 0)
        a_dicts.append({
            "regression": a.regression,
            "descriptive": {"y_min": y_mean - 5, "y_max": y_mean + 5} if isinstance(a.anova, dict) else {}
        })

    resp_dicts = [{"name": r.name, "goal": r.goal, "target": r.target,
                   "weight": r.weight, "lower_limit": r.lower_limit,
                   "upper_limit": r.upper_limit} for r in responses]

    factor_dicts = [{"name": f.name, "low": f.low, "high": f.high, "unit": f.unit} for f in factors]
    result = run_optimization(a_dicts, factor_dicts, resp_dicts)
    if "error" in result:
        raise HTTPException(422, result["error"])

    # Store optimum in each analysis record
    for a in analyses:
        crud.upsert_analysis(db, body.project_id, a.response_idx, optimum=result)

    crud.update_project(db, body.project_id,
                        schemas.ProjectUpdate(current_step="initial-optimization"))
    return result


@router.post("/contour")
def contour_endpoint(body: dict, db: Session = Depends(get_db)):
    project_id  = body.get("project_id")
    response_idx = body.get("response_idx", 0)
    factor_x    = body.get("factor_x", 0)
    factor_y    = body.get("factor_y", 1)

    factors  = crud.get_factors(db, project_id)
    analyses = crud.get_analyses(db, project_id)
    if not analyses:
        run_all_analyses(schemas.OptimizeRequest(project_id=project_id), db)
        analyses = crud.get_analyses(db, project_id)

    return get_contour(analyses, response_idx, factors, factor_x, factor_y)


@router.post("/overlay")
def overlay_endpoint(body: dict, db: Session = Depends(get_db)):
    project_id = body.get("project_id")
    factor_x = body.get("factor_x", 0)
    factor_y = body.get("factor_y", 1)

    factors = crud.get_factors(db, project_id)
    responses = crud.get_responses(db, project_id)
    analyses = crud.get_analyses(db, project_id)
    if not analyses:
        run_all_analyses(schemas.OptimizeRequest(project_id=project_id), db)
        analyses = crud.get_analyses(db, project_id)

    return get_overlay_plot_service(analyses, factors, responses, factor_x, factor_y)


@router.post("/monte-carlo")
def monte_carlo_endpoint(body: schemas.MonteCarloSimRequest, db: Session = Depends(get_db)):
    factors = crud.get_factors(db, body.project_id)
    responses = crud.get_responses(db, body.project_id)
    analyses = crud.get_analyses(db, body.project_id)
    if not analyses:
        run_all_analyses(schemas.OptimizeRequest(project_id=body.project_id), db)
        analyses = crud.get_analyses(db, body.project_id)

    return run_monte_carlo_service(
        analyses, factors, responses,
        factor_stds=body.factor_stds,
        n_iterations=body.n_iterations,
        factor_x=body.factor_x,
        factor_y=body.factor_y
    )

