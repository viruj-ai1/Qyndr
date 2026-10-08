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
    rec = db.query(models.Analysis).filter(
        models.Analysis.project_id == project_id,
        models.Analysis.response_idx == response_idx
    ).first()
    if rec:
        for k, v in kwargs.items(): setattr(rec, k, v)
    else:
        rec = models.Analysis(project_id=project_id, response_idx=response_idx, **kwargs)
        db.add(rec)
    db.commit(); db.refresh(rec)
    return rec

def get_analyses(db: Session, project_id: int) -> List[models.Analysis]:
    return db.query(models.Analysis).filter(models.Analysis.project_id == project_id).all()


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
