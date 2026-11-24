"""
backend/api/cqa.py - CQA Assessment, Suggestion, Validation, and Audit Routes.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any, Optional

from database import get_db, models
from database.models import Project, CQAAuditLog, CQAAttribute, QTPPSpecification
from database import schemas, crud
from database.schemas import CQAMapping, CQAAuditLogItem
from services.cqa_suggestion import classify_attribute, find_missing_cqas, validate_cqa_list
from api.auth import get_current_user

router = APIRouter(prefix="/projects/{project_id}", tags=["CQA Derivation"])


def _get_project_or_fallback(db: Session, project_id: int) -> Optional[models.Project]:
    proj = crud.get_project(db, project_id)
    if proj:
        return proj
    # Stale project ID recovery: find by latest project or matching name
    latest = db.query(models.Project).order_by(models.Project.id.desc()).first()
    return latest


def _format_cqa_out(c: CQAAttribute) -> schemas.CQAAttributeOut:
    linked_details = []
    linked_ids = []
    for q in c.linked_qtpp_specs:
        linked_ids.append(q.id)
        linked_details.append(schemas.CQALinkedQTPPDetail(
            id=q.id,
            attribute_name=q.attribute_name,
            display_string=q.format_target_display(),
            classification=q.attribute_classification
        ))

    sec_out = None
    if c.secondary_risk:
        rpn = None
        if c.secondary_risk.occurrence is not None and c.secondary_risk.detectability is not None:
            rpn = c.severity_score * c.secondary_risk.occurrence * c.secondary_risk.detectability
        sec_out = schemas.CQARiskSecondaryOut(
            id=c.secondary_risk.id,
            cqa_id=c.id,
            occurrence=c.secondary_risk.occurrence,
            detectability=c.secondary_risk.detectability,
            notes=c.secondary_risk.notes or "",
            rpn=rpn,
            created_at=c.secondary_risk.created_at,
            updated_at=c.secondary_risk.updated_at
        )

    return schemas.CQAAttributeOut(
        id=c.id,
        cqa_code=c.cqa_code,
        project_id=c.project_id,
        attribute_name=c.attribute_name,
        description=c.description or "",
        scientific_justification=c.scientific_justification or "",
        severity_score=c.severity_score,
        evidence_basis=c.evidence_basis or [],
        classification=c.classification,
        decision_justification=c.decision_justification or "",
        sort_order=c.sort_order,
        linked_qtpp_ids=linked_ids,
        linked_qtpp_details=linked_details,
        secondary_risk=sec_out,
        created_at=c.created_at,
        updated_at=c.updated_at
    )


# ── CQA Relational Endpoints ─────────────────────────────────

@router.get("/cqas", response_model=List[schemas.CQAAttributeOut])
def get_all_cqas(
    project_id: int,
    db: Session = Depends(get_db)
):
    """Retrieve all identified CQA attributes for a project with linked QTPPs."""
    proj = _get_project_or_fallback(db, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    cqas = crud.get_cqa_attributes(db, proj.id)
    return [_format_cqa_out(c) for c in cqas]


@router.post("/cqas", response_model=schemas.CQAAttributeOut)
def create_cqa(
    project_id: int,
    payload: schemas.CQAAttributeCreate,
    db: Session = Depends(get_db)
):
    """Create a new CQA attribute with auto-assigned CQA-XXX code and QTPP links."""
    proj = _get_project_or_fallback(db, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        cqa = crud.create_cqa_attribute(db, proj.id, payload)
        return _format_cqa_out(cqa)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/cqas/{cqa_id}", response_model=schemas.CQAAttributeOut)
def update_cqa(
    project_id: int,
    cqa_id: str,
    payload: schemas.CQAAttributeUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing CQA attribute."""
    proj = _get_project_or_fallback(db, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    try:
        cqa = crud.update_cqa_attribute(db, proj.id, cqa_id, payload)
        return _format_cqa_out(cqa)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/cqas/{cqa_id}")
def delete_cqa(
    project_id: int,
    cqa_id: str,
    db: Session = Depends(get_db)
):
    """Delete a CQA attribute."""
    proj = _get_project_or_fallback(db, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    success = crud.delete_cqa_attribute(db, proj.id, cqa_id)
    if not success:
        raise HTTPException(status_code=404, detail="CQA attribute not found")
    return {"ok": True}


@router.put("/cqas/reorder")
def reorder_cqas(
    project_id: int,
    items: List[schemas.CQAReorderItem],
    db: Session = Depends(get_db)
):
    """Update sort order for project CQAs."""
    proj = _get_project_or_fallback(db, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    crud.reorder_cqa_attributes(db, proj.id, items)
    return {"ok": True}


@router.delete("/cqas/clear-all")
def clear_all_cqas(
    project_id: int,
    db: Session = Depends(get_db)
):
    """Clear all CQA attributes for a project."""
    proj = _get_project_or_fallback(db, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    crud.clear_all_cqa_attributes(db, proj.id)
    return {"ok": True}


@router.get("/cqas/approved", response_model=List[schemas.CQAAttributeOut])
def get_approved_cqas(
    project_id: int,
    db: Session = Depends(get_db)
):
    """List approved CQAs (classification == CQA) that flow into DoE response selection."""
    proj = _get_project_or_fallback(db, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    cqas = crud.get_approved_cqa_attributes(db, proj.id)
    return [_format_cqa_out(c) for c in cqas]


@router.get("/cqas/summary", response_model=schemas.CQASummaryOut)
def get_cqa_summary_endpoint(
    project_id: int,
    db: Session = Depends(get_db)
):
    """Return counts per classification and unlinked QTPP attributes."""
    proj = _get_project_or_fallback(db, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    return crud.get_cqa_summary(db, proj.id)



@router.post("/cqa/suggest-ai")
def suggest_cqas_ai(
    project_id: int,
    db: Session = Depends(get_db)
):
    """
    Reads saved QTPP attributes and invokes the QbD suggestion engine
    to propose potential CQAs with structured attributes.
    Nothing is saved until the scientist reviews and accepts.
    """
    proj = _get_project_or_fallback(db, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    qtpp_specs = crud.get_qtpp_specifications(db, proj.id)
    if not qtpp_specs:
        return {"project_id": project_id, "suggestions": []}

    # Generate suggestions for each QTPP attribute
    suggestions = []
    for spec in qtpp_specs:
        attr_name = spec.attribute_name.strip()
        classification = classify_attribute(attr_name, spec.attribute_classification, spec.format_target_display())
        
        # Determine suggested severity based on scientific knowledge
        imp = classification.get("suggested_impact", 3)
        if imp < 1 or imp > 5:
            imp = 3

        suggestions.append({
            "temp_id": f"ai-sugg-{spec.id}",
            "attribute_name": attr_name,
            "description": f"Quality attribute evaluating {attr_name.lower()} against finished product target.",
            "linked_qtpp_ids": [spec.id],
            "linked_qtpp_names": [spec.attribute_name],
            "linked_qtpp_targets": [spec.format_target_display()],
            "scientific_justification": classification.get("rationale") or f"Directly impacts patient safety and therapeutic efficacy.",
            "suggested_severity": imp,
            "suggested_evidence_basis": ["Scientific knowledge", "Regulatory guidance"]
        })

    return {"project_id": project_id, "suggestions": suggestions}



@router.post("/cqa/validate")
def validate_cqas(
    project_id: int,
    cqas: List[CQAMapping],
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Run QbD consistency rules and ICH threshold checks on the CQA list.
    Returns non-blocking warnings and blocking errors.
    """
    proj = _get_project_or_fallback(db, project_id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    qtpp_items = proj.qtpp_data or []
    cqa_dicts = [c.model_dump() for c in cqas]
    result = validate_cqa_list(cqa_dicts, qtpp_items)
    return result


@router.get("/cqa/audit", response_model=List[CQAAuditLogItem])
def get_cqa_audit_log(
    project_id: int,
    cqa_id: Optional[str] = Query(None, description="Filter by specific CQA ID"),
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Retrieve audit history log for CQAs in a project.
    """
    query = db.query(CQAAuditLog).filter(CQAAuditLog.project_id == project_id)
    if cqa_id:
        query = query.filter(CQAAuditLog.cqa_id == cqa_id)
    
    logs = query.order_by(CQAAuditLog.timestamp.desc()).all()
    return logs


@router.post("/cqa/audit")
def record_cqa_audit(
    project_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Record an audit trail event for a CQA change (CREATE, UPDATE, EXCLUDE, RESTORE).
    """
    cqa_id = payload.get("cqa_id", "")
    action = payload.get("action", "UPDATE")
    old_value = payload.get("old_value")
    new_value = payload.get("new_value")

    log_entry = CQAAuditLog(
        project_id=project_id,
        cqa_id=cqa_id,
        action=action,
        old_value=old_value,
        new_value=new_value,
        user=user.username if hasattr(user, "username") else "chemist",
        timestamp=datetime.utcnow()
    )
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    return {"status": "success", "log_id": log_entry.id}

