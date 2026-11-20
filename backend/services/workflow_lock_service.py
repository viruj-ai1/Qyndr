# backend/services/workflow_lock_service.py
"""
Service managing strictly sequential workflow locking, status progression,
step unlocking, and atomic downstream dependency re-alignment.
"""
from typing import Dict, List, Optional, Any, Tuple
from sqlalchemy.orm import Session
from database import models
import copy

WORKFLOW_STEPS: List[str] = [
    "create-project",
    "qtpp",
    "cqa",
    "route-mapping",
    "risk-assessment",
    "stage-campaign-matrix",
    "define-factors",
    "recommend-doe",
    "generate-doe",
    "initial-optimization",
    "enough-data",
    "gp-model",
    "bayesian-opt",
    "new-experiment",
    "final-optimum",
    "report"
]

STEP_DEPENDENCIES: Dict[str, List[str]] = {
    "create-project": ["qtpp", "cqa", "route-mapping", "risk-assessment", "stage-campaign-matrix", "define-factors"],
    "qtpp": ["cqa", "risk-assessment", "stage-campaign-matrix", "define-factors"],
    "cqa": ["risk-assessment", "stage-campaign-matrix", "define-factors", "recommend-doe", "generate-doe", "initial-optimization", "new-experiment", "final-optimum", "report"],
    "route-mapping": ["risk-assessment", "stage-campaign-matrix", "define-factors"],
    "risk-assessment": ["stage-campaign-matrix", "define-factors", "recommend-doe"],
    "stage-campaign-matrix": ["define-factors", "recommend-doe"],
    "define-factors": ["recommend-doe", "generate-doe", "initial-optimization", "enough-data", "gp-model", "bayesian-opt", "new-experiment", "final-optimum", "report"],
    "recommend-doe": ["generate-doe", "initial-optimization", "enough-data"],
    "generate-doe": ["initial-optimization", "enough-data", "gp-model", "final-optimum", "report"],
    "initial-optimization": ["enough-data", "gp-model", "bayesian-opt", "new-experiment", "final-optimum", "report"],
    "enough-data": ["gp-model", "bayesian-opt", "new-experiment", "final-optimum"],
    "gp-model": ["bayesian-opt", "new-experiment", "final-optimum", "report"],
    "bayesian-opt": ["new-experiment", "final-optimum", "report"],
    "new-experiment": ["final-optimum", "report"],
    "final-optimum": ["report"],
    "report": []
}


def compute_inferred_statuses(project: models.Project) -> Dict[str, str]:
    """
    Infers initial step statuses for a project based on stored data.
    - Completed: Has valid recorded data
    - Current: The first incomplete step
    - Locked: All subsequent steps
    """
    statuses: Dict[str, str] = {}
    
    def check_done(step_key: str) -> bool:
        if step_key == "create-project":
            return bool(project.name and project.name.trim() if hasattr(project.name, 'trim') else project.name)
        elif step_key == "qtpp":
            return bool(project.qtpp_data and len(project.qtpp_data) > 0)
        elif step_key == "cqa":
            return bool(project.cqas_data and len(project.cqas_data) > 0)
        elif step_key == "route-mapping":
            return bool(project.stages_data and len(project.stages_data) > 0)
        elif step_key == "risk-assessment":
            return bool(project.risk_assessment_data and len(project.risk_assessment_data) > 0)
        elif step_key == "stage-campaign-matrix":
            return bool((project.stages_data and len(project.stages_data) > 0) and (project.risk_assessment_data and len(project.risk_assessment_data) > 0))
        elif step_key == "define-factors":
            return bool(project.factors and len(project.factors) > 0 and project.responses and len(project.responses) > 0)
        elif step_key == "recommend-doe":
            return bool(project.doe_type)
        elif step_key == "generate-doe":
            return bool(project.experiments and len(project.experiments) > 0 and any(e.is_completed or (e.result_values and any(v is not None for v in e.result_values)) for e in project.experiments))
        elif step_key == "initial-optimization":
            return bool(project.analyses and len(project.analyses) > 0)
        elif step_key == "enough-data":
            return bool(project.analyses and len(project.analyses) > 0)
        elif step_key == "gp-model":
            return bool(project.gp_iters and len(project.gp_iters) > 0)
        elif step_key == "bayesian-opt":
            return bool(project.gp_iters and len(project.gp_iters) > 0)
        elif step_key == "new-experiment":
            return bool(project.experiments and any(e.run_type == "Bayesian" for e in project.experiments))
        elif step_key == "final-optimum":
            return bool(project.analyses and len(project.analyses) > 0)
        elif step_key == "report":
            return bool(project.analyses and len(project.analyses) > 0 and project.id)
        return False

    found_current = False
    for step in WORKFLOW_STEPS:
        if check_done(step) and not found_current:
            statuses[step] = "completed"
        elif not found_current:
            statuses[step] = "current"
            found_current = True
        else:
            statuses[step] = "locked"

    # If all are completed, set last as completed
    if not found_current and len(statuses) > 0:
        statuses[WORKFLOW_STEPS[-1]] = "completed"

    return statuses


def get_effective_statuses(project: models.Project) -> Dict[str, str]:
    stored = project.step_statuses or {}
    if not stored or not any(s in stored for s in WORKFLOW_STEPS):
        stored = compute_inferred_statuses(project)
        project.step_statuses = stored
    return stored


def can_access_step(project: models.Project, target_step: str) -> bool:
    """
    Enforces sequential routing guards:
    - User can only access 'completed', 'current', or 'editing' steps.
    - 'locked' steps can NEVER be accessed directly.
    """
    statuses = get_effective_statuses(project)
    target_status = statuses.get(target_step, "locked")
    return target_status in ("completed", "current", "editing", "needs-review")


def complete_step(db: Session, project: models.Project, step_key: str, step_data: Optional[Dict[str, Any]] = None) -> Tuple[bool, str, Dict[str, str]]:
    """
    Completes step N and unlocks strictly step N+1.
    """
    if step_key not in WORKFLOW_STEPS:
        return False, f"Invalid step: {step_key}", {}

    statuses = dict(get_effective_statuses(project))
    idx = WORKFLOW_STEPS.index(step_key)

    # Check prerequisites: all prior steps 0..idx-1 must be completed
    for i in range(idx):
        prior = WORKFLOW_STEPS[i]
        if statuses.get(prior) != "completed":
            return False, f"Prerequisite step '{prior}' must be completed before completing '{step_key}'", statuses

    # Mark current step as completed
    statuses[step_key] = "completed"
    if project.unlocked_step == step_key:
        project.unlocked_step = None

    # Unlock next step
    if idx + 1 < len(WORKFLOW_STEPS):
        next_step = WORKFLOW_STEPS[idx + 1]
        if statuses.get(next_step) != "completed":
            statuses[next_step] = "current"
        project.current_step = next_step
    else:
        project.current_step = step_key

    project.step_statuses = statuses
    db.add(project)
    db.commit()
    db.refresh(project)
    return True, "Step completed successfully", statuses


def unlock_step_for_edit(db: Session, project: models.Project, step_key: str) -> Tuple[bool, str, Dict[str, str]]:
    """
    Unlocks a previously completed step for editing.
    - Step becomes 'editing'.
    - All downstream steps become 'locked' and marked 'needs-review'.
    - Upstream steps remain 'completed'.
    """
    if step_key not in WORKFLOW_STEPS:
        return False, f"Invalid step: {step_key}", {}

    statuses = dict(get_effective_statuses(project))
    if statuses.get(step_key) != "completed":
        return False, f"Only completed steps can be unlocked for editing (current status: {statuses.get(step_key)})", statuses

    idx = WORKFLOW_STEPS.index(step_key)
    statuses[step_key] = "editing"
    project.unlocked_step = step_key
    project.current_step = step_key

    # Lock all subsequent steps and flag them as needs-review
    for i in range(idx + 1, len(WORKFLOW_STEPS)):
        downstream = WORKFLOW_STEPS[i]
        statuses[downstream] = "needs-review"

    project.step_statuses = statuses
    db.add(project)
    db.commit()
    db.refresh(project)
    return True, f"Step '{step_key}' unlocked for editing", statuses


def cancel_step_edit(db: Session, project: models.Project, step_key: str) -> Tuple[bool, str, Dict[str, str]]:
    """
    Cancels edit mode and restores the step to 'completed' with prior valid workflow states.
    """
    if project.unlocked_step != step_key:
        return False, f"Step '{step_key}' is not currently being edited", get_effective_statuses(project)

    statuses = dict(get_effective_statuses(project))
    statuses[step_key] = "completed"
    project.unlocked_step = None

    # Restore downstream steps that were previously completed or current
    inferred = compute_inferred_statuses(project)
    idx = WORKFLOW_STEPS.index(step_key)
    for i in range(idx + 1, len(WORKFLOW_STEPS)):
        step = WORKFLOW_STEPS[i]
        statuses[step] = inferred.get(step, "locked")

    # Set current step to the first non-completed step
    for step in WORKFLOW_STEPS:
        if statuses.get(step) != "completed":
            project.current_step = step
            break

    project.step_statuses = statuses
    db.add(project)
    db.commit()
    db.refresh(project)
    return True, "Edit cancelled, statuses restored", statuses


def realign_downstream_data(db: Session, project: models.Project, edited_step: str, updated_step_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Executes an atomic downstream dependency re-alignment.
    - Diffs old vs new data. If no change, restores statuses without re-alignment.
    - Cascades updates along STEP_DEPENDENCIES.
    - Prunes dangling references (e.g. deleted CQAs/stages).
    - Preserves untouched user-entered data.
    - Returns an atomic summary of affected steps and changes.
    """
    summary: Dict[str, Any] = {
        "edited_step": edited_step,
        "changes_detected": False,
        "affected_steps": [],
        "details": {}
    }

    if edited_step not in WORKFLOW_STEPS:
        raise ValueError(f"Unknown workflow step: {edited_step}")

    statuses = dict(get_effective_statuses(project))
    idx = WORKFLOW_STEPS.index(edited_step)

    # 1. Check if data actually changed
    # We compare incoming updated_step_data with existing project fields
    has_changes = False
    if updated_step_data:
        for k, v in updated_step_data.items():
            curr = getattr(project, k, None)
            if curr != v:
                has_changes = True
                setattr(project, k, copy.deepcopy(v))
    else:
        # Default assume changes if explicit realign triggered
        has_changes = True

    summary["changes_detected"] = has_changes

    if not has_changes:
        # No actual change, restore statuses without altering downstream data
        statuses[edited_step] = "completed"
        project.unlocked_step = None
        inferred = compute_inferred_statuses(project)
        for i in range(idx + 1, len(WORKFLOW_STEPS)):
            s = WORKFLOW_STEPS[i]
            statuses[s] = inferred.get(s, "locked")
        project.step_statuses = statuses
        db.add(project)
        db.commit()
        return summary

    # 2. Re-alignment logic per step dependency
    downstream_targets = STEP_DEPENDENCIES.get(edited_step, [])

    # Case A: QTPP / CQA changes
    if edited_step in ("create-project", "qtpp", "cqa"):
        valid_cqa_ids = set()
        if project.cqas_data:
            valid_cqa_ids = {c.get("id") for c in project.cqas_data if isinstance(c, dict) and c.get("id")}

        # Prune orphan CQA references from Risk Assessment
        if "risk-assessment" in downstream_targets and project.risk_assessment_data:
            pruned_count = 0
            updated_risk = copy.deepcopy(project.risk_assessment_data)
            for stage_id, stage_data in updated_risk.items():
                params = stage_data.get("parameters", [])
                for p in params:
                    linked = p.get("linkedCqaIds", [])
                    new_linked = [cid for cid in linked if cid in valid_cqa_ids]
                    if len(new_linked) != len(linked):
                        pruned_count += (len(linked) - len(new_linked))
                        p["linkedCqaIds"] = new_linked
            if pruned_count > 0:
                project.risk_assessment_data = updated_risk
                summary["affected_steps"].append("risk-assessment")
                summary["details"]["risk-assessment"] = f"Removed {pruned_count} orphaned CQA linkages from risk assessment parameters"

        # Prune orphan CQA responses from Responses
        if "define-factors" in downstream_targets and project.responses:
            orphaned_responses = [r for r in project.responses if r.linked_cqa_ids and not any(cid in valid_cqa_ids for cid in r.linked_cqa_ids)]
            if orphaned_responses:
                for r in orphaned_responses:
                    db.delete(r)
                summary["affected_steps"].append("define-factors")
                summary["details"]["define-factors"] = f"Removed {len(orphaned_responses)} responses referencing deleted CQAs"

    # Case B: Route Mapping / Stages changes
    if edited_step in ("create-project", "route-mapping"):
        valid_stage_ids = set()
        if project.stages_data:
            valid_stage_ids = {s.get("id") for s in project.stages_data if isinstance(s, dict) and s.get("id")}

        # Prune risk assessment stages that no longer exist
        if project.risk_assessment_data:
            existing_stage_keys = list(project.risk_assessment_data.keys())
            removed_stages = [sid for sid in existing_stage_keys if sid not in valid_stage_ids]
            if removed_stages:
                updated_risk = copy.deepcopy(project.risk_assessment_data)
                for sid in removed_stages:
                    updated_risk.pop(sid, None)
                project.risk_assessment_data = updated_risk
                if "risk-assessment" not in summary["affected_steps"]:
                    summary["affected_steps"].append("risk-assessment")
                summary["details"]["risk-assessment"] = f"Pruned risk assessments for {len(removed_stages)} deleted stage(s)"

    # Update statuses: edited step is now completed; immediately next step is current; remaining are needs-review & locked
    statuses[edited_step] = "completed"
    project.unlocked_step = None
    if idx + 1 < len(WORKFLOW_STEPS):
        next_step = WORKFLOW_STEPS[idx + 1]
        statuses[next_step] = "current"
        project.current_step = next_step
        for i in range(idx + 2, len(WORKFLOW_STEPS)):
            statuses[WORKFLOW_STEPS[i]] = "needs-review"
    else:
        project.current_step = edited_step

    project.step_statuses = statuses
    db.add(project)
    db.commit()
    db.refresh(project)
    return summary
