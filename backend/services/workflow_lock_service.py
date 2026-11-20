# backend/services/workflow_lock_service.py
"""
Service managing strictly sequential workflow locking, status progression,
step unlocking, and atomic downstream dependency re-alignment.
"""
from typing import Dict, List, Optional, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified
from database import models
import copy

WORKFLOW_STEPS: List[str] = [
    "create-project",
    "cqa-risk",
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
    "create-project": ["cqa-risk", "stage-campaign-matrix", "define-factors"],
    "cqa-risk": ["stage-campaign-matrix", "define-factors", "recommend-doe", "generate-doe", "initial-optimization", "new-experiment", "final-optimum", "report"],
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
            has_name = bool(project.name and project.name.trim() if hasattr(project.name, 'trim') else project.name)
            has_qtpp = bool(project.qtpp_data and len(project.qtpp_data) > 0)
            return bool(has_name and has_qtpp)
        elif step_key == "cqa-risk":
            has_cqas = bool(project.cqas_data and len(project.cqas_data) > 0)
            has_risk = bool(project.risk_assessment_data and len(project.risk_assessment_data) > 0)
            return bool(has_cqas and has_risk)
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
    
    # MIGRATION: Map legacy step keys if present
    if "cqa" in stored or "risk-assessment" in stored or "route-mapping" in stored:
        migrated: Dict[str, str] = {}
        old_cqa = stored.get("cqa")
        old_risk = stored.get("risk-assessment")
        
        # Merge cqa and risk-assessment statuses
        if old_cqa == "completed" and old_risk == "completed":
            migrated["cqa-risk"] = "completed"
        elif old_cqa == "completed" or old_risk == "completed":
            migrated["cqa-risk"] = "needs-review"
        elif old_cqa in ("current", "editing") or old_risk in ("current", "editing"):
            migrated["cqa-risk"] = "current"
        else:
            migrated["cqa-risk"] = "locked"

        for k, v in stored.items():
            if k not in ("cqa", "risk-assessment", "route-mapping", "qtpp"):
                migrated[k] = v
        if "create-project" not in migrated:
            migrated["create-project"] = stored.get("create-project", "completed")

        stored = migrated
        project.step_statuses = stored

    # Handle multi-stage projects migration to single stage:
    if project.stages_data and len(project.stages_data) > 1:
        # Determine active stage matching stage_number if present, else first stage
        import re
        m = re.search(r'stage\s*[-_]?\s*(\d+)', project.name or '', re.IGNORECASE)
        target_num = int(m.group(1)) if m else None
        
        kept_stage = None
        if target_num:
            for st in project.stages_data:
                if isinstance(st, dict) and (st.get("order") == target_num or f"stage-{target_num}" == st.get("id")):
                    kept_stage = st
                    break
        if not kept_stage:
            kept_stage = project.stages_data[0]
            
        # Flag cqa-risk as needs-review so user verifies
        stored["cqa-risk"] = "needs-review"
        project.step_statuses = stored

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
            if hasattr(project, k):
                curr = getattr(project, k, None)
                if curr != v:
                    has_changes = True
                    setattr(project, k, copy.deepcopy(v))
            else:
                # Custom payload keys like 'unit_op_type'
                has_changes = True
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

    # Case A: Step 1 (create-project) changes -> Unit Op or Compound changed
    if edited_step == "create-project":
        # Check if unit op changed and update single stage name
        unit_op = updated_step_data.get("unit_op_type") if updated_step_data else None
        if unit_op and project.stages_data and len(project.stages_data) > 0:
            stage = project.stages_data[0]
            old_unit_op = stage.get("unitOpType")
            if old_unit_op != unit_op:
                from database.crud import derive_single_stage
                new_stage = derive_single_stage(project.name, unit_op, project.compound)
                project.stages_data = [new_stage]
                summary["affected_steps"].append("cqa-risk")
                summary["details"]["cqa-risk"] = f"Updated stage unit operation to {unit_op}"

                # Re-align risk matrix: replace ONLY untouched 'suggested' rows with new unit op parameters
                # Keep every row that was confirmed, custom, or has scores entered by chemist
                if project.risk_assessment_data:
                    stage_id = stage.get("id", "stage-1")
                    stage_risk = project.risk_assessment_data.get(stage_id, {})
                    existing_params = stage_risk.get("parameters", [])
                    preserved_params = [
                        p for p in existing_params
                        if p.get("status") in ("confirmed", "custom")
                        or p.get("severity") is not None
                        or p.get("occurrence") is not None
                        or p.get("detectability") is not None
                        or (p.get("linkedCqaIds") and len(p.get("linkedCqaIds")) > 0)
                    ]
                    # Retain preserved params, frontend will hydrate fresh suggestions for the new unit op
                    stage_risk["parameters"] = preserved_params
                    updated_risk = copy.deepcopy(project.risk_assessment_data)
                    updated_risk[stage_id] = stage_risk
                    project.risk_assessment_data = updated_risk
                    flag_modified(project, "risk_assessment_data")
                    flag_modified(project, "stages_data")

    # Case B: CQA & Risk Assessment changes
    if edited_step in ("create-project", "cqa-risk"):
        valid_cqa_ids = set()
        if project.cqas_data:
            valid_cqa_ids = {c.get("id") for c in project.cqas_data if isinstance(c, dict) and c.get("id")}

        # Prune orphan CQA responses from Responses
        if "define-factors" in downstream_targets and project.responses:
            orphaned_responses = [r for r in project.responses if r.linked_cqa_ids and not any(cid in valid_cqa_ids for cid in r.linked_cqa_ids)]
            if orphaned_responses:
                for r in orphaned_responses:
                    db.delete(r)
                summary["affected_steps"].append("define-factors")
                summary["details"]["define-factors"] = f"Removed {len(orphaned_responses)} responses referencing deleted CQAs"

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
