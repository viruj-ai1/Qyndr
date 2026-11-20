# backend/api/workflow_routes.py
"""
FastAPI Router for strictly sequential workflow navigation, locking,
step unlocking, and downstream re-alignment endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, crud, schemas
from services import workflow_lock_service

router = APIRouter(prefix="/projects/{project_id}/workflow", tags=["Workflow Navigation"])


@router.get("/statuses")
def get_workflow_statuses(project_id: int, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    statuses = workflow_lock_service.get_effective_statuses(project)
    return {
        "ok": True,
        "current_step": project.current_step,
        "unlocked_step": project.unlocked_step,
        "step_statuses": statuses
    }


@router.post("/complete")
def complete_step_endpoint(project_id: int, body: schemas.StepCompleteRequest, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    ok, msg, statuses = workflow_lock_service.complete_step(db, project, body.step_key, body.step_data)
    if not ok:
        raise HTTPException(400, msg)

    return {
        "ok": True,
        "message": msg,
        "current_step": project.current_step,
        "unlocked_step": project.unlocked_step,
        "step_statuses": statuses
    }


@router.post("/unlock")
def unlock_step_endpoint(project_id: int, body: schemas.StepUnlockRequest, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    ok, msg, statuses = workflow_lock_service.unlock_step_for_edit(db, project, body.step_key)
    if not ok:
        raise HTTPException(400, msg)

    return {
        "ok": True,
        "message": msg,
        "current_step": project.current_step,
        "unlocked_step": project.unlocked_step,
        "step_statuses": statuses
    }


@router.post("/cancel-edit")
def cancel_edit_endpoint(project_id: int, body: schemas.StepCancelEditRequest, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    ok, msg, statuses = workflow_lock_service.cancel_step_edit(db, project, body.step_key)
    if not ok:
        raise HTTPException(400, msg)

    return {
        "ok": True,
        "message": msg,
        "current_step": project.current_step,
        "unlocked_step": project.unlocked_step,
        "step_statuses": statuses
    }


@router.post("/realign", response_model=schemas.StepRealignResponse)
def realign_step_endpoint(project_id: int, body: schemas.StepRealignRequest, db: Session = Depends(get_db)):
    project = crud.get_project(db, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    try:
        summary = workflow_lock_service.realign_downstream_data(
            db, project, body.step_key, body.updated_step_data
        )
        return schemas.StepRealignResponse(
            ok=True,
            step_key=body.step_key,
            changes_detected=summary.get("changes_detected", True),
            summary=summary,
            step_statuses=workflow_lock_service.get_effective_statuses(project)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Re-alignment failed and was rolled back: {str(e)}")
