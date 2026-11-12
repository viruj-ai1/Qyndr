"""
backend/api/route.py
Routes for Stage & Synthetic Route Generation, Validation, and Management.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional

from database import get_db, crud
from database.models import Project
from api.auth import get_current_user
from services.route_mapping_service import (
    generate_route,
    validate_route,
    regenerate_single_stage,
    RouteStage,
    GeneratedRoute,
    RouteValidationWarning
)

router = APIRouter(prefix="/api/projects/{project_id}/route", tags=["Route Mapping"])


@router.post("/generate", response_model=GeneratedRoute)
def generate_project_route(
    project_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Grounded synthesis route generator using QbD RAG, QTPP, CQAs, and Process Context.
    Auto-populates stages, unit operations, candidate CPPs, and linked CQAs.
    """
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    result = generate_route(proj, db)

    # Persist directly into stages_data
    stage_dicts = [s.to_dict() for s in result.stages]
    crud.update_phase0(db, project_id, stages=stage_dicts)

    return result


@router.post("/stages/{stage_id}/regenerate", response_model=RouteStage)
def regenerate_stage_endpoint(
    project_id: int,
    stage_id: str,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Regenerates a single stage in-place, keeping neighboring stages as context.
    """
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    stages = proj.stages_data or []
    try:
        updated_stage = regenerate_single_stage(proj, stage_id, stages, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    # Update in persisted list
    stage_dicts = []
    for s in stages:
        if str(s.get("id")) == str(stage_id):
            stage_dicts.append(updated_stage.to_dict())
        else:
            stage_dicts.append(s)

    crud.update_phase0(db, project_id, stages=stage_dicts)
    return updated_stage


@router.get("", response_model=List[Dict[str, Any]])
def get_project_route(
    project_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Get current route stages for a project.
    """
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    return proj.stages_data or []


@router.put("", response_model=List[Dict[str, Any]])
def save_project_route(
    project_id: int,
    stages: List[Dict[str, Any]],
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Save user-edited route stages.
    """
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    # Clean & normalize order
    cleaned = []
    for idx, s in enumerate(stages):
        item = dict(s)
        item["order"] = idx + 1
        if not item.get("id"):
            item["id"] = f"stage-{idx+1}"
        cleaned.append(item)

    crud.update_phase0(db, project_id, stages=cleaned)
    return cleaned


@router.get("/validate", response_model=List[RouteValidationWarning])
def validate_project_route(
    project_id: int,
    db: Session = Depends(get_db),
    user = Depends(get_current_user)
):
    """
    Run route continuity and CQA coverage validations. Returns non-blocking warnings.
    """
    proj = db.query(Project).filter(Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    stages = proj.stages_data or []
    cqas = proj.cqas_data or []
    warnings = validate_route(stages, cqas)
    return warnings
