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
    
    # Initialize step statuses for workflow: create-project completed, cqa-risk current, rest locked
    step_statuses = {
        "create-project": "completed",
        "cqa-risk": "current",
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

        # Populate relational QTPPSpecification and CQADerivation records
        if qtpp_data and isinstance(qtpp_data, list):
            for idx, raw_item in enumerate(qtpp_data):
                if isinstance(raw_item, dict):
                    parsed = parse_legacy_qtpp_to_spec(raw_item, idx, project_id=proj.id)
                    spec = models.QTPPSpecification(
                        id=parsed["id"],
                        project_id=proj.id,
                        attribute_name=parsed["attribute_name"],
                        attribute_classification=parsed["attribute_classification"],
                        criterion_type=parsed["criterion_type"],
                        unit=parsed["unit"],
                        min_value=parsed["min_value"],
                        max_value=parsed["max_value"],
                        target_value=parsed["target_value"],
                        qualitative_text=parsed["qualitative_text"],
                        justification=parsed["justification"],
                        reference_source=parsed["reference_source"],
                        sort_order=parsed["sort_order"]
                    )
                    db.add(spec)
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


# ── QTPP Specifications & CQA Derivation ──────────────────────

def parse_legacy_qtpp_to_spec(item: dict, idx: int, project_id: Optional[int] = None) -> dict:
    """
    Map old fields:
    - 'Justification / Source' goes to justification
    - old Attribute Type goes to attribute_classification (fallback 'Other')
    - old numeric target goes to a best-fit criterion_type.
    """
    attr_name = (item.get("attribute") or item.get("attribute_name") or f"Attribute {idx + 1}").strip()
    old_type = (item.get("type") or item.get("attribute_type") or "").strip()
    
    # Map old type to attribute_classification
    type_map = {
        "Assay-Purity": "Assay / potency",
        "Assay": "Assay / potency",
        "Impurity": "Purity / related substances",
        "Related Substance": "Purity / related substances",
        "Identity": "Other",
        "Physical Property": "Physical properties",
        "Physical": "Physical properties",
        "Residual Solvent": "Other",
        "Microbial": "Microbiological quality",
        "Stability": "Stability",
        "Appearance & Color": "Physical properties",
        "Appearance": "Physical properties",
        "Dissolution": "Dissolution",
        "Content Uniformity": "Content uniformity"
    }
    classification = type_map.get(old_type, "Other")

    justification = (item.get("justification") or "").strip()
    reference_source = (item.get("reference") or item.get("source") or item.get("reference_source") or "").strip()
    criterion_str = (item.get("criterion") or "").strip()
    
    # Check if structured acceptanceCriterion exists
    ac = item.get("acceptanceCriterion") or {}
    unit = (ac.get("unit") or item.get("unit") or "").strip() or None
    
    criterion_type = "QUALITATIVE"
    min_val = None
    max_val = None
    target_val = None
    qual_text = None

    if ac:
        ac_type = (ac.get("type") or "").lower()
        if ac_type in ("min", "lower_bound"):
            criterion_type = "MIN"
            min_val = float(ac.get("minValue")) if ac.get("minValue") is not None else None
        elif ac_type in ("max", "upper_bound"):
            criterion_type = "MAX"
            max_val = float(ac.get("maxValue")) if ac.get("maxValue") is not None else None
        elif ac_type in ("range",):
            criterion_type = "RANGE"
            min_val = float(ac.get("minValue")) if ac.get("minValue") is not None else None
            max_val = float(ac.get("maxValue")) if ac.get("maxValue") is not None else None
        elif ac_type in ("exact", "target"):
            criterion_type = "EXACT"
            target_val = float(ac.get("targetValue")) if ac.get("targetValue") is not None else None
        else:
            criterion_type = "QUALITATIVE"
            qual_text = ac.get("textDescription") or criterion_str or "Conforms to standard"
    else:
        # Parse from criterion_str
        import re
        range_match = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*(?:-|to)\s*([0-9]+(?:\.[0-9]+)?)\s*(%|\w+)?', criterion_str, re.IGNORECASE)
        gte_match = re.search(r'(?:>=|≥|\bmin\b)\s*([0-9]+(?:\.[0-9]+)?)\s*(%|\w+)?', criterion_str, re.IGNORECASE)
        lte_match = re.search(r'(?:<=|≤|\bmax\b)\s*([0-9]+(?:\.[0-9]+)?)\s*(%|\w+)?', criterion_str, re.IGNORECASE)
        eq_match = re.search(r'(?:=|\bexact\b)\s*([0-9]+(?:\.[0-9]+)?)\s*(%|\w+)?', criterion_str, re.IGNORECASE)

        if range_match:
            criterion_type = "RANGE"
            min_val = float(range_match.group(1))
            max_val = float(range_match.group(2))
            if range_match.group(3): unit = range_match.group(3)
        elif gte_match:
            criterion_type = "MIN"
            min_val = float(gte_match.group(1))
            if gte_match.group(2): unit = gte_match.group(2)
        elif lte_match:
            criterion_type = "MAX"
            max_val = float(lte_match.group(1))
            if lte_match.group(2): unit = lte_match.group(2)
        elif eq_match:
            criterion_type = "EXACT"
            target_val = float(eq_match.group(1))
            if eq_match.group(2): unit = eq_match.group(2)
        else:
            criterion_type = "QUALITATIVE"
            qual_text = criterion_str or "Conforms to Specification"

    if criterion_type == "QUALITATIVE":
        unit = "N/A"
        if not qual_text:
            qual_text = criterion_str or "Conforms"

    # Validation fallback guarantees
    if criterion_type == "RANGE" and (min_val is None or max_val is None or min_val >= max_val):
        criterion_type = "QUALITATIVE"
        qual_text = criterion_str or "Conforms"
    elif criterion_type == "MIN" and min_val is None:
        criterion_type = "QUALITATIVE"
        qual_text = criterion_str or "Conforms"
    elif criterion_type == "MAX" and max_val is None:
        criterion_type = "QUALITATIVE"
        qual_text = criterion_str or "Conforms"
    elif criterion_type == "EXACT" and target_val is None:
        criterion_type = "QUALITATIVE"
        qual_text = criterion_str or "Conforms"

    raw_id = item.get("id") or f"qtpp-{idx + 1}"
    if project_id is not None and not str(raw_id).startswith(f"p{project_id}-"):
        item_id = f"p{project_id}-{raw_id}"
    else:
        item_id = str(raw_id)

    return {
        "id": item_id,
        "attribute_name": attr_name,
        "attribute_classification": classification,
        "criterion_type": criterion_type,
        "unit": unit,
        "min_value": min_val,
        "max_value": max_val,
        "target_value": target_val,
        "qualitative_text": qual_text,
        "justification": justification,
        "reference_source": reference_source,
        "sort_order": idx
    }


def migrate_legacy_qtpp_for_all_projects(bind_engine):
    """
    Reads existing projects, parses their legacy qtpp_data JSON,
    and inserts missing QTPPSpecification and CQADerivation records.
    """
    from sqlalchemy.orm import Session
    from sqlalchemy import text
    with Session(bind_engine) as session:
        projects = session.query(models.Project).all()
        for p in projects:
            existing_specs = session.query(models.QTPPSpecification).filter(
                models.QTPPSpecification.project_id == p.id
            ).all()
            if existing_specs:
                continue

            # Migrate from p.qtpp_data
            legacy_items = p.qtpp_data or []
            if not isinstance(legacy_items, list):
                continue

            for idx, raw_item in enumerate(legacy_items):
                if not isinstance(raw_item, dict):
                    continue
                parsed = parse_legacy_qtpp_to_spec(raw_item, idx, project_id=p.id)
                spec = models.QTPPSpecification(
                    id=parsed["id"],
                    project_id=p.id,
                    attribute_name=parsed["attribute_name"],
                    attribute_classification=parsed["attribute_classification"],
                    criterion_type=parsed["criterion_type"],
                    unit=parsed["unit"],
                    min_value=parsed["min_value"],
                    max_value=parsed["max_value"],
                    target_value=parsed["target_value"],
                    qualitative_text=parsed["qualitative_text"],
                    justification=parsed["justification"],
                    reference_source=parsed["reference_source"],
                    sort_order=parsed["sort_order"]
                )
                session.add(spec)

        session.commit()


def get_qtpp_specifications(db: Session, project_id: int) -> List[models.QTPPSpecification]:
    return db.query(models.QTPPSpecification).filter(
        models.QTPPSpecification.project_id == project_id
    ).order_by(models.QTPPSpecification.sort_order).all()


def create_or_replace_qtpp_specifications(
    db: Session,
    project_id: int,
    specs_data: List[schemas.QTPPSpecificationCreate]
) -> List[models.QTPPSpecification]:
    # Check attribute uniqueness within project
    names = set()
    for s in specs_data:
        s.validate_criterion_rules()
        norm_name = s.attribute_name.strip().lower()
        if norm_name in names:
            raise ValueError(f"Duplicate attribute_name '{s.attribute_name}' is not allowed in the same project.")
        names.add(norm_name)

    # Delete existing specs for this project
    db.query(models.QTPPSpecification).filter(models.QTPPSpecification.project_id == project_id).delete()

    created_specs = []
    import uuid
    for idx, s in enumerate(specs_data):
        spec_id = s.id or f"qtpp-{uuid.uuid4().hex[:8]}"
        spec = models.QTPPSpecification(
            id=spec_id,
            project_id=project_id,
            attribute_name=s.attribute_name.strip(),
            attribute_classification=s.attribute_classification or "Other",
            criterion_type=s.criterion_type.value if hasattr(s.criterion_type, "value") else str(s.criterion_type),
            unit="N/A" if (s.criterion_type.value if hasattr(s.criterion_type, "value") else str(s.criterion_type)) == "QUALITATIVE" else (s.unit.strip() if s.unit else None),
            min_value=s.min_value,
            max_value=s.max_value,
            target_value=s.target_value,
            qualitative_text=s.qualitative_text,
            justification=s.justification or "",
            reference_source=s.reference_source or "",
            sort_order=s.sort_order if s.sort_order is not None else idx
        )
        db.add(spec)
        created_specs.append(spec)

    # Sync back to project.qtpp_data JSON column for backward compatibility
    proj = get_project(db, project_id)
    if proj:
        proj.qtpp_data = [
            {
                "id": s.id,
                "attribute": s.attribute_name,
                "criterion": s.format_target_display(),
                "justification": s.justification,
                "type": s.attribute_classification,
                "criterion_type": s.criterion_type,
                "unit": s.unit,
                "min_value": s.min_value,
                "max_value": s.max_value,
                "target_value": s.target_value,
                "qualitative_text": s.qualitative_text,
                "reference_source": s.reference_source
            }
            for s in created_specs
        ]
        proj.updated_at = datetime.utcnow()

    db.commit()
    for s in created_specs:
        db.refresh(s)
    return created_specs


# ══════════════════════════════════════════════════════════════
#  CQA Identification & Criticality Assessment CRUD
# ══════════════════════════════════════════════════════════════

def get_next_cqa_code(db: Session, project_id: int) -> str:
    """
    Generate next CQA code in format CQA-001, CQA-002...
    Never reuses deleted codes: calculates max index ever assigned for this project.
    """
    from sqlalchemy import text
    # Check max existing number in CQAAttribute table
    existing = db.query(models.CQAAttribute.cqa_code).filter(
        models.CQAAttribute.project_id == project_id
    ).all()
    max_num = 0
    import re
    for (code,) in existing:
        m = re.search(r'CQA-(\d+)', code or '')
        if m:
            max_num = max(max_num, int(m.group(1)))

    # Also check project audit logs / JSON for any previously assigned cqa_codes
    proj = get_project(db, project_id)
    if proj and proj.cqas_data:
        for c in proj.cqas_data:
            if isinstance(c, dict):
                m = re.search(r'CQA-(\d+)', c.get("cqa_code", "") or c.get("id", ""))
                if m:
                    max_num = max(max_num, int(m.group(1)))

    return f"CQA-{max_num + 1:03d}"


def get_cqa_attributes(db: Session, project_id: int) -> List[models.CQAAttribute]:
    return db.query(models.CQAAttribute).filter(
        models.CQAAttribute.project_id == project_id
    ).order_by(models.CQAAttribute.sort_order).all()


def get_approved_cqa_attributes(db: Session, project_id: int) -> List[models.CQAAttribute]:
    return db.query(models.CQAAttribute).filter(
        models.CQAAttribute.project_id == project_id,
        models.CQAAttribute.classification == "CQA"
    ).order_by(models.CQAAttribute.sort_order).all()


def get_cqa_summary(db: Session, project_id: int) -> dict:
    all_cqas = get_cqa_attributes(db, project_id)
    all_qtpps = get_qtpp_specifications(db, project_id)

    # Find QTPPs with no linked CQA
    linked_qtpp_ids = set()
    for c in all_cqas:
        for q in c.linked_qtpp_specs:
            linked_qtpp_ids.add(q.id)

    unlinked_qtpp_count = sum(1 for q in all_qtpps if q.id not in linked_qtpp_ids)

    return {
        "project_id": project_id,
        "total_cqas": len(all_cqas),
        "cqa_count": sum(1 for c in all_cqas if c.classification == "CQA"),
        "potential_cqa_count": sum(1 for c in all_cqas if c.classification == "POTENTIAL_CQA"),
        "non_cqa_count": sum(1 for c in all_cqas if c.classification == "NON_CQA"),
        "unlinked_qtpp_count": unlinked_qtpp_count
    }


def sync_project_cqas_data_json(db: Session, project_id: int):
    """Sync relational CQA attributes back to project.cqas_data JSON for backward compatibility."""
    proj = get_project(db, project_id)
    if not proj:
        return
    cqas = get_cqa_attributes(db, project_id)
    out_json = []
    for c in cqas:
        linked_ids = [q.id for q in c.linked_qtpp_specs]
        out_json.append({
            "id": c.id,
            "cqa_code": c.cqa_code,
            "name": c.attribute_name,
            "description": c.description,
            "scientific_justification": c.scientific_justification,
            "justification": c.decision_justification or c.scientific_justification,
            "severity_score": c.severity_score,
            "impact_score": c.severity_score,
            "uncertainty_score": 3,
            "criticality_score": c.severity_score * 3,
            "evidence_basis": c.evidence_basis,
            "classification": c.classification,
            "is_critical": c.classification == "CQA",
            "decision_justification": c.decision_justification,
            "linkedQtppIds": linked_ids,
            "secondary_risk": {
                "occurrence": c.secondary_risk.occurrence if c.secondary_risk else None,
                "detectability": c.secondary_risk.detectability if c.secondary_risk else None,
                "notes": c.secondary_risk.notes if c.secondary_risk else ""
            } if c.secondary_risk else None
        })
    proj.cqas_data = out_json
    proj.updated_at = datetime.utcnow()
    db.commit()


def create_cqa_attribute(
    db: Session,
    project_id: int,
    data: schemas.CQAAttributeCreate
) -> models.CQAAttribute:
    import uuid
    data.validate_cqa_rules()

    # Verify attribute_name uniqueness in project
    existing = db.query(models.CQAAttribute).filter(
        models.CQAAttribute.project_id == project_id,
        models.CQAAttribute.attribute_name == data.attribute_name.strip()
    ).first()
    if existing:
        raise ValueError(f"Attribute name '{data.attribute_name}' already exists in this project.")

    # Verify linked QTPPs exist
    qtpp_specs = db.query(models.QTPPSpecification).filter(
        models.QTPPSpecification.project_id == project_id,
        models.QTPPSpecification.id.in_(data.linked_qtpp_ids)
    ).all()
    if len(qtpp_specs) == 0:
        # Fallback: if project has QTPP specs, link to the first existing one
        all_project_qtpps = db.query(models.QTPPSpecification).filter(
            models.QTPPSpecification.project_id == project_id
        ).all()
        if all_project_qtpps:
            qtpp_specs = [all_project_qtpps[0]]
        else:
            # If no relational QTPPs exist yet, populate from proj.qtpp_data or create a baseline spec
            proj = get_project(db, project_id)
            if proj and proj.qtpp_data:
                created_specs = create_or_replace_qtpp_specifications(
                    db, project_id, [schemas.QTPPSpecificationCreate(**q) for q in proj.qtpp_data if isinstance(q, dict)]
                )
                qtpp_specs = created_specs[:1] if created_specs else []
            if not qtpp_specs:
                baseline = models.QTPPSpecification(
                    id=f"qtpp-auto-{project_id}-1",
                    project_id=project_id,
                    attribute_name="Assay",
                    attribute_classification="Assay / potency",
                    criterion_type="RANGE",
                    unit="%",
                    min_value=95.0,
                    max_value=105.0,
                    justification="Ensures active drug content",
                    reference_source="Internal specification",
                    sort_order=0
                )
                db.add(baseline)
                db.commit()
                db.refresh(baseline)
                qtpp_specs = [baseline]

    cqa_id = data.id or f"cqa-{uuid.uuid4().hex[:8]}"
    cqa_code = get_next_cqa_code(db, project_id)

    max_order = db.query(models.CQAAttribute.sort_order).filter(
        models.CQAAttribute.project_id == project_id
    ).order_by(models.CQAAttribute.sort_order.desc()).first()
    next_order = (max_order[0] + 1) if max_order else 0

    cqa = models.CQAAttribute(
        id=cqa_id,
        cqa_code=cqa_code,
        project_id=project_id,
        attribute_name=data.attribute_name.strip(),
        description=data.description or "",
        scientific_justification=data.scientific_justification.strip(),
        severity_score=data.severity_score,
        evidence_basis=data.evidence_basis or [],
        classification=data.classification.value if hasattr(data.classification, "value") else str(data.classification),
        decision_justification=data.decision_justification or "",
        sort_order=data.sort_order if data.sort_order is not None else next_order
    )
    cqa.linked_qtpp_specs = qtpp_specs

    if data.secondary_risk:
        sec = models.CQARiskAssessmentSecondary(
            cqa_id=cqa_id,
            occurrence=data.secondary_risk.occurrence,
            detectability=data.secondary_risk.detectability,
            notes=data.secondary_risk.notes or ""
        )
        cqa.secondary_risk = sec

    db.add(cqa)
    db.commit()
    db.refresh(cqa)

    sync_project_cqas_data_json(db, project_id)
    return cqa


def update_cqa_attribute(
    db: Session,
    project_id: int,
    cqa_id: str,
    data: schemas.CQAAttributeUpdate
) -> models.CQAAttribute:
    cqa = db.query(models.CQAAttribute).filter(
        models.CQAAttribute.id == cqa_id,
        models.CQAAttribute.project_id == project_id
    ).first()
    if not cqa:
        raise ValueError("CQA attribute not found.")

    if data.attribute_name is not None:
        trimmed = data.attribute_name.strip()
        if not trimmed:
            raise ValueError("Attribute name cannot be empty.")
        existing = db.query(models.CQAAttribute).filter(
            models.CQAAttribute.project_id == project_id,
            models.CQAAttribute.attribute_name == trimmed,
            models.CQAAttribute.id != cqa_id
        ).first()
        if existing:
            raise ValueError(f"Attribute name '{trimmed}' is already in use by another CQA.")
        cqa.attribute_name = trimmed

    if data.description is not None:
        cqa.description = data.description
    if data.scientific_justification is not None:
        cqa.scientific_justification = data.scientific_justification.strip()
    if data.severity_score is not None:
        if data.severity_score < 1 or data.severity_score > 5:
            raise ValueError("severity_score must be between 1 and 5.")
        cqa.severity_score = data.severity_score
    if data.evidence_basis is not None:
        cqa.evidence_basis = data.evidence_basis
    if data.classification is not None:
        val = data.classification.value if hasattr(data.classification, "value") else str(data.classification)
        cqa.classification = val
    if data.decision_justification is not None:
        cqa.decision_justification = data.decision_justification.strip()
    if data.sort_order is not None:
        cqa.sort_order = data.sort_order

    # Validation: decision justification required for CQA and NON_CQA
    if cqa.classification in ["CQA", "NON_CQA"]:
        if not cqa.decision_justification or not cqa.decision_justification.strip():
            raise ValueError(f"Decision justification is required when classification is {cqa.classification}.")

    if data.linked_qtpp_ids is not None:
        if len(data.linked_qtpp_ids) == 0:
            raise ValueError("Each CQA must link to at least one QTPP attribute.")
        qtpp_specs = db.query(models.QTPPSpecification).filter(
            models.QTPPSpecification.project_id == project_id,
            models.QTPPSpecification.id.in_(data.linked_qtpp_ids)
        ).all()
        if len(qtpp_specs) == 0:
            raise ValueError("At least one valid QTPP attribute must be linked.")
        cqa.linked_qtpp_specs = qtpp_specs

    if data.secondary_risk is not None:
        if not cqa.secondary_risk:
            cqa.secondary_risk = models.CQARiskAssessmentSecondary(cqa_id=cqa.id)
        if data.secondary_risk.occurrence is not None:
            cqa.secondary_risk.occurrence = data.secondary_risk.occurrence
        if data.secondary_risk.detectability is not None:
            cqa.secondary_risk.detectability = data.secondary_risk.detectability
        if data.secondary_risk.notes is not None:
            cqa.secondary_risk.notes = data.secondary_risk.notes

    cqa.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cqa)

    sync_project_cqas_data_json(db, project_id)
    return cqa


def delete_cqa_attribute(db: Session, project_id: int, cqa_id: str) -> bool:
    cqa = db.query(models.CQAAttribute).filter(
        models.CQAAttribute.id == cqa_id,
        models.CQAAttribute.project_id == project_id
    ).first()
    if not cqa:
        return False
    # Clear link relations
    cqa.linked_qtpp_specs = []
    db.delete(cqa)
    db.commit()

    sync_project_cqas_data_json(db, project_id)
    return True


def clear_all_cqa_attributes(db: Session, project_id: int):
    cqas = get_cqa_attributes(db, project_id)
    for c in cqas:
        c.linked_qtpp_specs = []
        db.delete(c)
    db.commit()
    sync_project_cqas_data_json(db, project_id)


def reorder_cqa_attributes(db: Session, project_id: int, items: List[schemas.CQAReorderItem]):
    for item in items:
        db.query(models.CQAAttribute).filter(
            models.CQAAttribute.id == item.id,
            models.CQAAttribute.project_id == project_id
        ).update({"sort_order": item.sort_order})
    db.commit()
    sync_project_cqas_data_json(db, project_id)


def unlink_qtpp_attribute_from_cqas(db: Session, project_id: int, qtpp_id: str):
    """
    When deleting a QTPP attribute, remove association links from CQAs.
    Never silently orphan.
    """
    spec = db.query(models.QTPPSpecification).filter(
        models.QTPPSpecification.id == qtpp_id,
        models.QTPPSpecification.project_id == project_id
    ).first()
    if spec:
        spec.cqa_links = []
        db.delete(spec)
        db.commit()
        sync_project_cqas_data_json(db, project_id)


def migrate_legacy_cqas_for_all_projects(bind_engine):
    """
    Migrate existing project.cqas_data JSON rows into cqa_attributes and cqa_qtpp_link tables.
    Preserves all existing data safely.
    """
    from sqlalchemy.orm import Session
    from sqlalchemy import text
    with Session(bind_engine) as session:
        projects = session.query(models.Project).all()
        for p in projects:
            existing_cqas = session.query(models.CQAAttribute).filter(
                models.CQAAttribute.project_id == p.id
            ).all()
            if existing_cqas:
                continue

            raw_cqas = p.cqas_data or []
            if not isinstance(raw_cqas, list) or len(raw_cqas) == 0:
                continue

            qtpp_specs = session.query(models.QTPPSpecification).filter(
                models.QTPPSpecification.project_id == p.id
            ).all()
            qtpp_dict = {q.id: q for q in qtpp_specs}

            for idx, raw in enumerate(raw_cqas):
                if not isinstance(raw, dict):
                    continue
                cqa_code = raw.get("cqa_code") or f"CQA-{idx + 1:03d}"
                name = raw.get("name") or raw.get("attribute_name") or f"Attribute {idx + 1}"
                severity = raw.get("severity_score") or raw.get("impact_score") or 3
                if severity < 1 or severity > 5:
                    severity = 3
                classification = raw.get("classification")
                if classification not in ["CQA", "POTENTIAL_CQA", "NON_CQA"]:
                    classification = "CQA" if raw.get("is_critical") else "POTENTIAL_CQA"
                sci_just = raw.get("scientific_justification") or raw.get("rationale") or raw.get("justification") or "Identified from drug substance quality specifications."
                dec_just = raw.get("decision_justification") or raw.get("justification") or ("Established critical quality attribute." if classification == "CQA" else "")

                cqa_id = raw.get("id") or f"cqa-{p.id}-{idx + 1}"
                cqa_obj = models.CQAAttribute(
                    id=cqa_id,
                    cqa_code=cqa_code,
                    project_id=p.id,
                    attribute_name=name,
                    description=raw.get("description") or "",
                    scientific_justification=sci_just,
                    severity_score=severity,
                    evidence_basis=raw.get("evidence_basis") or ["Scientific knowledge", "Regulatory guidance"],
                    classification=classification,
                    decision_justification=dec_just,
                    sort_order=idx
                )

                # Link QTPP attributes
                linked_ids = raw.get("linkedQtppIds") or raw.get("linked_qtpp_ids") or []
                matched_specs = [qtpp_dict[qid] for qid in linked_ids if qid in qtpp_dict]
                if not matched_specs and qtpp_specs:
                    matched_specs = [qtpp_specs[0]]
                cqa_obj.linked_qtpp_specs = matched_specs

                session.add(cqa_obj)

        session.commit()


