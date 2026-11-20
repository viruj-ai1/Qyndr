import pytest
from database import SessionLocal, init_db, models
from services import workflow_lock_service

@pytest.fixture(scope="module")
def db():
    init_db()
    session = SessionLocal()
    yield session
    session.close()

def test_workflow_sequential_locking(db):
    # 1. Create a fresh project
    project = models.Project(
        name="Test Locking Project",
        compound="TestAPI",
        objective="Validate sequential steps",
        description="Testing strict locking",
        current_step="create-project"
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Inferred status on new project: create-project completed, qtpp current, others locked
    statuses = workflow_lock_service.get_effective_statuses(project)
    assert statuses["create-project"] == "completed"
    assert statuses["qtpp"] == "current"
    assert statuses["cqa"] == "locked"
    assert statuses["route-mapping"] == "locked"

    # Cannot skip ahead to locked step
    assert workflow_lock_service.can_access_step(project, "qtpp") is True
    assert workflow_lock_service.can_access_step(project, "cqa") is False
    assert workflow_lock_service.can_access_step(project, "route-mapping") is False

    # Attempting to complete cqa before qtpp fails
    ok, msg, _ = workflow_lock_service.complete_step(db, project, "cqa")
    assert ok is False
    assert "Prerequisite" in msg

    # Completing qtpp unlocks strictly cqa
    project.qtpp_data = [{"id": "qtpp-1", "attribute": "Assay"}]
    db.commit()
    ok, msg, new_statuses = workflow_lock_service.complete_step(db, project, "qtpp")
    assert ok is True
    assert new_statuses["qtpp"] == "completed"
    assert new_statuses["cqa"] == "current"
    assert new_statuses["route-mapping"] == "locked"

    # Unlock step for edit: unlocking qtpp locks cqa and marks it needs-review
    ok, msg, edit_statuses = workflow_lock_service.unlock_step_for_edit(db, project, "qtpp")
    assert ok is True
    assert edit_statuses["qtpp"] == "editing"
    assert edit_statuses["cqa"] == "needs-review"
    assert project.unlocked_step == "qtpp"

    # Cancel edit restores statuses
    ok, msg, restored = workflow_lock_service.cancel_step_edit(db, project, "qtpp")
    assert ok is True
    assert restored["qtpp"] == "completed"
    assert project.unlocked_step is None

    # Re-alignment test with data changes
    workflow_lock_service.unlock_step_for_edit(db, project, "qtpp")
    summary = workflow_lock_service.realign_downstream_data(
        db, project, "qtpp", {"qtpp_data": [{"id": "qtpp-2", "attribute": "Purity"}]}
    )
    assert summary["changes_detected"] is True
    assert project.unlocked_step is None
    assert project.step_statuses["qtpp"] == "completed"

    # Clean up
    db.delete(project)
    db.commit()
