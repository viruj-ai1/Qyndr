"""
backend/api/cqa.py - CQA Assessment, Suggestion, Validation, and Audit Routes.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Any, Optional

from database import get_db
from database.models import Project, CQAAuditLog
from database.schemas import CQAMapping, CQAAuditLogItem
from services.cqa_suggestion import classify_attribute, find_missing_cqas, validate_cqa_list
from api.auth import get_current_user

router = APIRouter(prefix="/api/projects/{project_id}/cqa", tags=["CQA Derivation"])


@router.get("/suggestions")
def get_cqa_suggestions(
    project_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Get ICH-compliant CQA suggestions for all QTPP attributes and identify
    missing standard CQAs for the project's drug substance profile.
    """
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    qtpp_items = proj.qtpp_data or []
    existing_cqas = proj.cqas_data or []

    # 1. Attribute-level recommendations for each QTPP item
    attribute_suggestions = []
    for q in qtpp_items:
        attr_name = q.get("attribute", "")
        attr_type = q.get("type", "")
        criterion = q.get("criterion", "")
        classification = classify_attribute(attr_name, attr_type, criterion)
        attribute_suggestions.append({
            "qtpp_id": q.get("id"),
            "attribute": attr_name,
            **classification
        })

    # 2. Missing standard CQAs
    missing_cqas = find_missing_cqas(existing_cqas, qtpp_items)

    return {
        "project_id": project_id,
        "compound": proj.compound,
        "attribute_suggestions": attribute_suggestions,
        "missing_cqas": missing_cqas
    }


@router.post("/validate")
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
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    qtpp_items = proj.qtpp_data or []
    cqa_dicts = [c.model_dump() for c in cqas]
    result = validate_cqa_list(cqa_dicts, qtpp_items)
    return result


@router.get("/audit", response_model=List[CQAAuditLogItem])
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


@router.post("/audit")
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

