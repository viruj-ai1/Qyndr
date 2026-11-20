# ============================================================
#  database/crud.py  –  CRUD helpers
# ============================================================
from datetime import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from . import models, schemas


# ── Projects ─────────────────────────────────────────────────
def get_projects(db: Session) -> List[models.Project]:
    return db.query(models.Project).order_by(models.Project.updated_at.desc()).all()

def get_project(db: Session, project_id: int) -> Optional[models.Project]:
    return db.query(models.Project).filter(models.Project.id == project_id).first()

def create_project(db: Session, data: schemas.ProjectCreate) -> models.Project:
    proj = models.Project(**data.model_dump())
    db.add(proj); db.commit(); db.refresh(proj)
    return proj

import re

def derive_single_stage(name: str, unit_op: str = "Reaction", compound: str = "") -> dict:
    unit_op = unit_op or "Reaction"
    # Match stage number from project name (e.g., "Stage -1", "Stage 1", "Stage-2")
    m = re.search(r'stage\s*[-_]?\s*(\d+)', name, re.IGNORECASE)
    stage_num = int(m.group(1)) if m else None
    
    stage_name = f"Stage {stage_num} – {unit_op}" if stage_num else unit_op
    stage_id = f"stage-{stage_num}" if stage_num else "stage-1"

    return {
        "id": stage_id,
        "order": stage_num if stage_num else 1,
        "name": stage_name,
        "unitOpType": unit_op,
        "unit_operation_type": unit_op,
        "description": f"Single stage unit operation for {compound or 'API'}",
        "intermediateProduced": f"{compound or 'API'} {unit_op} Product",
        "inputs": [],
        "outputs": [],
        "candidate_cpps": [],
        "linked_cqas": [],
        "source": "user_edited",
        "confidence": "high"
    }

def create_project_with_qtpp(db: Session, data: schemas.ProjectWithQTPPCreate) -> models.Project:
    payload = data.model_dump()
    qtpp_data = payload.pop("qtpp_data", [])
    unit_op = payload.pop("unit_op_type", None) or "Reaction"
    payload.pop("stage_number", None)
    
    # Derive single stage from project name and unit op
    single_stage = derive_single_stage(payload.get("name", ""), unit_op, payload.get("compound", ""))
    
    # Initialize step statuses for 13-step workflow: create-project completed, cqa-risk current, rest locked
    step_statuses = {
        "create-project": "completed",
        "cqa-risk": "current",
        "stage-campaign-matrix": "locked",
        "define-factors": "locked",
        "recommend-doe": "locked",
        "generate-doe": "locked",
        "initial-optimization": "locked",
        "enough-data": "locked",
        "gp-model": "locked",
        "bayesian-opt": "locked",
        "new-experiment": "locked",
        "final-optimum": "locked",
        "report": "locked"
    }
    
    payload["current_step"] = "cqa-risk"
    payload["step_statuses"] = step_statuses
    payload["qtpp_data"] = qtpp_data
    payload["stages_data"] = [single_stage]
    
    try:
        proj = models.Project(**payload)
        db.add(proj)
        db.commit()
        db.refresh(proj)
        return proj
    except Exception as e:
        db.rollback()
        raise e

def update_project(db: Session, project_id: int, data: schemas.ProjectUpdate) -> Optional[models.Project]:
    proj = get_project(db, project_id)
    if not proj: return None
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(proj, k, v)
    proj.updated_at = datetime.utcnow()
    db.commit(); db.refresh(proj)
    return proj

def delete_project(db: Session, project_id: int) -> bool:
    proj = get_project(db, project_id)
    if not proj: return False
    db.delete(proj); db.commit()
    return True

def add_audit_log(db: Session, project_id: int, action: str, details: str, user: str = "R&D Scientist") -> Optional[models.Project]:
    proj = get_project(db, project_id)
    if not proj: return None
    logs = list(proj.audit_logs or [])
    entry = {
        "id": f"log-{len(logs)+1}",
        "user": user,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "action": action,
        "details": details
    }
    logs.append(entry)
    proj.audit_logs = logs
    proj.updated_at = datetime.utcnow()
    db.commit(); db.refresh(proj)
    return proj

def update_phase0(db: Session, project_id: int, qtpp: list = None, cqas: list = None,
                  stages: list = None, risk_assessments: dict = None) -> Optional[models.Project]:
    proj = get_project(db, project_id)
    if not proj: return None
    if qtpp is not None: proj.qtpp_data = qtpp
    if cqas is not None: proj.cqas_data = cqas
    if stages is not None: proj.stages_data = stages
    if risk_assessments is not None: proj.risk_assessment_data = risk_assessments
    proj.updated_at = datetime.utcnow()
    db.commit(); db.refresh(proj)
    return proj



# ── Factors ──────────────────────────────────────────────────
def get_factors(db: Session, project_id: int) -> List[models.Factor]:
    return db.query(models.Factor).filter(
        models.Factor.project_id == project_id
    ).order_by(models.Factor.factor_order).all()

def replace_factors(db: Session, project_id: int, factors: List[schemas.FactorCreate]) -> List[models.Factor]:
    db.query(models.Factor).filter(models.Factor.project_id == project_id).delete()
    rows = []
    for i, f in enumerate(factors):
        f_dict = f.model_dump()
        f_dict["factor_order"] = i
        row = models.Factor(project_id=project_id, **f_dict)
        if row.baseline is None:
            row.baseline = (row.low + row.high) / 2
        db.add(row); rows.append(row)
    db.commit()
    return rows


# ── Responses ────────────────────────────────────────────────
def get_responses(db: Session, project_id: int) -> List[models.Response]:
    return db.query(models.Response).filter(
        models.Response.project_id == project_id
    ).order_by(models.Response.resp_order).all()

def replace_responses(db: Session, project_id: int, responses: List[schemas.ResponseCreate]) -> List[models.Response]:
    db.query(models.Response).filter(models.Response.project_id == project_id).delete()
    rows = []
    for i, r in enumerate(responses):
        r_dict = r.model_dump()
        r_dict["resp_order"] = i
        row = models.Response(project_id=project_id, **r_dict)
        db.add(row); rows.append(row)
    db.commit()
    return rows


# ── Experiments ──────────────────────────────────────────────
def get_experiments(db: Session, project_id: int, iteration: Optional[int] = None) -> List[models.Experiment]:
    q = db.query(models.Experiment).filter(models.Experiment.project_id == project_id)
    if iteration is not None:
        q = q.filter(models.Experiment.iteration == iteration)
    return q.order_by(models.Experiment.run_number).all()

def create_experiments(db: Session, project_id: int, rows: list) -> List[models.Experiment]:
    exps = []
    for r in rows:
        exp = models.Experiment(project_id=project_id, **r)
        db.add(exp); exps.append(exp)
    db.commit()
    return exps

def update_experiment_results(db: Session, experiment_id: int, result_values: list) -> Optional[models.Experiment]:
    exp = db.query(models.Experiment).filter(models.Experiment.id == experiment_id).first()
    if not exp: return None
    exp.result_values = result_values
    exp.is_completed = True
    db.commit(); db.refresh(exp)
    return exp

def add_bayesian_experiment(db: Session, project_id: int, actual_values: list,
                             result_values: list, iteration: int) -> models.Experiment:
    max_run = db.query(models.Experiment).filter(
        models.Experiment.project_id == project_id
    ).count()
    exp = models.Experiment(
        project_id=project_id,
        run_number=max_run + 1,
        run_type="Bayesian",
        coded_values=[],
        actual_values=actual_values,
        result_values=result_values,
        iteration=iteration,
        is_completed=True
    )
    db.add(exp); db.commit(); db.refresh(exp)
    return exp


# ── Analysis ─────────────────────────────────────────────────
def upsert_analysis(db: Session, project_id: int, response_idx: int, **kwargs) -> models.Analysis:
    recs = db.query(models.Analysis).filter(
        models.Analysis.project_id == project_id,
        models.Analysis.response_idx == response_idx
    ).order_by(models.Analysis.id.desc()).all()
    if recs:
        rec = recs[0]
        for k, v in kwargs.items(): setattr(rec, k, v)
        # Delete any duplicate analysis records
        if len(recs) > 1:
            for extra in recs[1:]:
                db.delete(extra)
    else:
        rec = models.Analysis(project_id=project_id, response_idx=response_idx, **kwargs)
        db.add(rec)
    db.commit(); db.refresh(rec)
    return rec

def get_analyses(db: Session, project_id: int) -> List[models.Analysis]:
    recs = db.query(models.Analysis).filter(models.Analysis.project_id == project_id).order_by(models.Analysis.id.desc()).all()
    seen = set()
    deduped = []
    has_dupes = False
    for r in recs:
        if r.response_idx not in seen:
            seen.add(r.response_idx)
            deduped.append(r)
        else:
            db.delete(r)
            has_dupes = True
    if has_dupes:
        db.commit()
    return sorted(deduped, key=lambda x: x.response_idx)


# ── GP Iterations ─────────────────────────────────────────────
def upsert_gp_iteration(db: Session, project_id: int, iteration: int, **kwargs) -> models.GPIteration:
    rec = db.query(models.GPIteration).filter(
        models.GPIteration.project_id == project_id,
        models.GPIteration.iteration == iteration
    ).first()
    if rec:
        for k, v in kwargs.items(): setattr(rec, k, v)
    else:
        rec = models.GPIteration(project_id=project_id, iteration=iteration, **kwargs)
        db.add(rec)
    db.commit(); db.refresh(rec)
    return rec

def get_gp_iterations(db: Session, project_id: int) -> List[models.GPIteration]:
    return db.query(models.GPIteration).filter(
        models.GPIteration.project_id == project_id
    ).order_by(models.GPIteration.iteration).all()
