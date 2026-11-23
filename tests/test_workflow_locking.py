import pytest
from database import SessionLocal, init_db, models
from services import workflow_lock_service
from database.crud import derive_single_stage

@pytest.fixture(scope="module")
def db():
    init_db()
    session = SessionLocal()
    yield session
    session.close()

def test_derive_single_stage():
    st1 = derive_single_stage("Brexpiparazole Stage -1", "Reaction", "Brexpiparazole")
    assert st1["order"] == 1
    assert "Stage 1" in st1["name"]
    assert st1["unitOpType"] == "Reaction"

    st2 = derive_single_stage("Custom Pure Process", "Crystallization", "API-X")
    assert st2["order"] == 1
    assert st2["name"] == "Crystallization"
    assert st2["unitOpType"] == "Crystallization"

def test_workflow_sequential_locking_13_steps(db):
    # 1. Create a fresh project with qtpp_data and single stage
    stage = derive_single_stage("Test Project Stage 1", "Reaction", "TestAPI")
    project = models.Project(
        name="Test Locking Project Stage 1",
        compound="TestAPI",
        objective="Validate sequential steps",
        description="Testing strict locking",
        current_step="create-project",
        qtpp_data=[{"id": "qtpp-1", "attribute": "Assay"}],
        stages_data=[stage]
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Inferred status on new project: create-project completed, cqa-risk current, others locked
    statuses = workflow_lock_service.get_effective_statuses(project)
    assert statuses["create-project"] == "completed"
    assert statuses["cqa-risk"] == "current"
    assert statuses["define-factors"] == "locked"
    assert "route-mapping" not in statuses

    # Cannot skip ahead to locked step
    assert workflow_lock_service.can_access_step(project, "cqa-risk") is True
    assert workflow_lock_service.can_access_step(project, "define-factors") is False

    # Attempting to complete define-factors before cqa-risk fails
    ok, msg, _ = workflow_lock_service.complete_step(db, project, "define-factors")
    assert ok is False
    assert "Prerequisite" in msg

    # Completing cqa-risk unlocks strictly define-factors
    project.cqas_data = [{"id": "cqa-1", "name": "Assay CQA"}]
    project.risk_assessment_data = {"stage-1": {"parameters": [{"id": "p-1", "name": "Temp", "severity": 4, "occurrence": 3, "detectability": 2, "rpn": 24, "linkedCqaIds": ["cqa-1"], "criticalFlag": False}]}}
    db.commit()
    ok, msg, new_statuses = workflow_lock_service.complete_step(db, project, "cqa-risk")
    assert ok is True
    assert new_statuses["cqa-risk"] == "completed"
    assert new_statuses["define-factors"] == "current"
    assert new_statuses["recommend-doe"] == "locked"

    # Unlock step for edit: unlocking create-project locks cqa-risk and marks it needs-review
    ok, msg, edit_statuses = workflow_lock_service.unlock_step_for_edit(db, project, "create-project")
    assert ok is True
    assert edit_statuses["create-project"] == "editing"
    assert edit_statuses["cqa-risk"] == "needs-review"
    assert project.unlocked_step == "create-project"

    # Cancel edit restores statuses
    ok, msg, restored = workflow_lock_service.cancel_step_edit(db, project, "create-project")
    assert ok is True
    assert restored["create-project"] == "completed"
    assert project.unlocked_step is None

    # Re-alignment test with data changes
    workflow_lock_service.unlock_step_for_edit(db, project, "create-project")
    summary = workflow_lock_service.realign_downstream_data(
        db, project, "create-project", {"qtpp_data": [{"id": "qtpp-2", "attribute": "Purity"}]}
    )
    assert summary["changes_detected"] is True
    assert project.unlocked_step is None
    assert project.step_statuses["create-project"] == "completed"

    # Clean up
    db.delete(project)
    db.commit()


def test_unit_op_unscored_suggested_parameters_and_realignment(db):
    stage = derive_single_stage("Test Synthesis Stage 1", "Reaction", "API-Test")
    project = models.Project(
        name="Test Synthesis Stage 1",
        compound="API-Test",
        current_step="create-project",
        stages_data=[stage],
        risk_assessment_data={
            "stage-1": {
                "parameters": [
                    {
                        "id": "p-1",
                        "name": "Reaction Temperature (°C)",
                        "severity": None,
                        "occurrence": None,
                        "detectability": None,
                        "rpn": None,
                        "status": "suggested"
                    },
                    {
                        "id": "p-custom",
                        "name": "Chemist Custom Reagent Feed Rate",
                        "severity": 4,
                        "occurrence": 3,
                        "detectability": 2,
                        "rpn": 24,
                        "status": "custom"
                    }
                ]
            }
        }
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # 1. Unlock step 1 (create-project) and change unit_op_type to 'Crystallization'
    workflow_lock_service.unlock_step_for_edit(db, project, "create-project")
    summary = workflow_lock_service.realign_downstream_data(
        db,
        project,
        "create-project",
        {"unit_op_type": "Crystallization"}
    )

    # 2. Verify stage updated
    assert project.stages_data[0]["unitOpType"] == "Crystallization"
    assert "Crystallization" in project.stages_data[0]["name"]

    # 3. Verify re-alignment preserved chemist custom / scored rows and removed untouched suggested rows
    remaining_params = project.risk_assessment_data["stage-1"]["parameters"]
    assert any(p["id"] == "p-custom" for p in remaining_params)
    assert not any(p["id"] == "p-1" for p in remaining_params)

    # Clean up
    db.delete(project)
    db.commit()

def test_legacy_multi_stage_migration(db):
    # Existing project with multiple stages and legacy step keys
    project = models.Project(
        name="Legacy Multi-Stage Stage 2",
        compound="LegacyAPI",
        current_step="cqa",
        stages_data=[
            {"id": "stage-1", "order": 1, "name": "Stage 1 – Reaction"},
            {"id": "stage-2", "order": 2, "name": "Stage 2 – Crystallization"}
        ],
        step_statuses={
            "create-project": "completed",
            "cqa": "completed",
            "route-mapping": "completed",
            "risk-assessment": "completed",
            "stage-campaign-matrix": "current"
        }
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    statuses = workflow_lock_service.get_effective_statuses(project)
    assert "route-mapping" not in statuses
    # Because it had multiple stages, it flagged cqa-risk as needs-review for safety
    assert statuses["cqa-risk"] == "needs-review"

    # Clean up
    db.delete(project)
    db.commit()


def test_unit_op_unscored_suggested_parameters_and_realignment(db):
    stage = derive_single_stage("Test Synthesis Stage 1", "Reaction", "API-Test")
    project = models.Project(
        name="Test Synthesis Stage 1",
        compound="API-Test",
        current_step="create-project",
        stages_data=[stage],
        risk_assessment_data={
            "stage-1": {
                "parameters": [
                    {
                        "id": "p-1",
                        "name": "Reaction Temperature (°C)",
                        "severity": None,
                        "occurrence": None,
                        "detectability": None,
                        "rpn": None,
                        "status": "suggested"
                    },
                    {
                        "id": "p-custom",
                        "name": "Chemist Custom Reagent Feed Rate",
                        "severity": 4,
                        "occurrence": 3,
                        "detectability": 2,
                        "rpn": 24,
                        "status": "custom"
                    }
                ]
            }
        }
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # 1. Unlock step 1 (create-project) and change unit_op_type to 'Crystallization'
    workflow_lock_service.unlock_step_for_edit(db, project, "create-project")
    summary = workflow_lock_service.realign_downstream_data(
        db,
        project,
        "create-project",
        {"unit_op_type": "Crystallization"}
    )

    # 2. Verify stage updated
    assert project.stages_data[0]["unitOpType"] == "Crystallization"
    assert "Crystallization" in project.stages_data[0]["name"]

    # 3. Verify re-alignment preserved chemist custom / scored rows and removed untouched suggested rows
    remaining_params = project.risk_assessment_data["stage-1"]["parameters"]
    assert any(p["id"] == "p-custom" for p in remaining_params)
    assert not any(p["id"] == "p-1" for p in remaining_params)

    # Clean up
    db.delete(project)
    db.commit()
