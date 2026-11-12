# ============================================================
#  tests/test_route_mapping.py - Route Mapping Service Tests
# ============================================================
import pytest
import sys
import os
import pathlib
import json

backend_dir = pathlib.Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from services.route_mapping_service import (
    UnitOperationType,
    StageSource,
    ConfidenceLevel,
    CandidateCPP,
    RouteStage,
    GeneratedRoute,
    validate_route,
    regenerate_single_stage
)


class DummyProject:
    id = 1
    name = "Propofol API Synthesis"
    compound = "Propofol"
    objective = "Optimize catalytic alkylation and purification"
    description = "Stage 1: Alkylation reaction of 2-isopropylphenol with propylene. Stage 2: Distillation and crystallization."
    qtpp_data = [{"id": "qtpp-1", "attribute": "Assay", "criterion": "≥ 98.0%"}]
    cqas_data = [
        {"id": "cqa-1", "name": "Assay", "range": "≥ 98.0%", "is_critical": True},
        {"id": "cqa-2", "name": "Propofol Related Compound A", "range": "≤ 0.15%", "is_critical": True},
        {"id": "cqa-3", "name": "Residual Toluene", "range": "≤ 890 ppm", "is_critical": False}
    ]
    stages_data = []


def test_route_stage_schema_validation():
    """Test RouteStage Pydantic model with valid and invalid values."""
    stage = RouteStage(
        id="stage-1",
        order=1,
        name="Stage 1: Alkylation",
        unit_operation_type=UnitOperationType.Reaction,
        chemistry_description="Catalytic alkylation",
        key_intermediate="Crude Propofol",
        inputs=["2-Isopropylphenol", "Propylene"],
        outputs=["Crude Propofol Mass"],
        candidate_cpps=[
            CandidateCPP(name="Temperature", unit="°C", low=60.0, high=85.0, rationale="Kinetics")
        ],
        linked_cqas=["cqa-1", "cqa-2"],
        source=StageSource.from_description,
        confidence=ConfidenceLevel.high
    )
    assert stage.id == "stage-1"
    assert stage.unitOpType == "Reaction"
    assert stage.intermediateProduced == "Crude Propofol"
    assert len(stage.candidate_cpps) == 1
    assert stage.candidate_cpps[0].low == 60.0

    # Ensure invalid enum raises validation error
    with pytest.raises(Exception):
        RouteStage(
            id="stage-err",
            order=1,
            name="Stage Err",
            unit_operation_type="NonExistentType"
        )


def test_route_validation_rule_a_stream_continuity():
    """Test validation warning when Stage N+1 does not consume Stage N intermediate."""
    stages = [
        {
            "id": "stage-1",
            "name": "Stage 1: Alkylation",
            "unit_operation_type": "Reaction",
            "key_intermediate": "Compound-XYZ-Solid",
            "outputs": ["Compound-XYZ-Solid"],
            "inputs": ["Starting-A"],
            "linked_cqas": ["cqa-1"]
        },
        {
            "id": "stage-2",
            "name": "Stage 2: Workup",
            "unit_operation_type": "Workup",
            "key_intermediate": "Pure Liquid",
            "outputs": ["Pure Liquid"],
            "inputs": ["Completely-Unrelated-Solvent"],  # Breaks continuity with Compound-XYZ-Solid
            "chemistry_description": "General wash",
            "linked_cqas": ["cqa-1", "cqa-2", "cqa-3"]
        }
    ]
    cqas = [
        {"id": "cqa-1", "name": "Assay"},
        {"id": "cqa-2", "name": "Impurity A"},
        {"id": "cqa-3", "name": "Residual Toluene"}
    ]
    warnings = validate_route(stages, cqas)
    warning_types = [w.type for w in warnings]
    assert "intermediate_continuity" in warning_types


def test_route_validation_rule_b_unlinked_cqa():
    """Test validation warning when a CQA from Step 03 is omitted from all stages."""
    stages = [
        {
            "id": "stage-1",
            "name": "Stage 1: Alkylation",
            "unit_operation_type": "Reaction",
            "key_intermediate": "Mass",
            "inputs": ["Mass"],
            "outputs": ["Mass"],
            "linked_cqas": ["cqa-1"]  # Only cqa-1 is linked
        }
    ]
    cqas = [
        {"id": "cqa-1", "name": "Assay"},
        {"id": "cqa-2", "name": "Impurity A"},  # Not linked to any stage
        {"id": "cqa-3", "name": "Residual Toluene"}  # Not linked
    ]
    warnings = validate_route(stages, cqas)
    unlinked_msgs = [w.message for w in warnings if w.type == "unlinked_cqa"]
    assert len(unlinked_msgs) >= 2
    assert any("Impurity A" in m for m in unlinked_msgs)
    assert any("Residual Toluene" in m for m in unlinked_msgs)


def test_route_validation_rule_c_invalid_unit_op():
    """Test validation warning when a stage has an invalid unit operation."""
    stages = [
        {
            "id": "stage-1",
            "name": "Stage 1: Custom Step",
            "unit_operation_type": "MagicTransformation",  # Invalid type
            "key_intermediate": "",
            "inputs": [],
            "outputs": [],
            "linked_cqas": ["cqa-1"]
        }
    ]
    cqas = [{"id": "cqa-1", "name": "Assay"}]
    warnings = validate_route(stages, cqas)
    assert any(w.type == "invalid_unit_op" for w in warnings)


def test_single_stage_regeneration_preserves_others():
    """Test single-stage regeneration updating target stage while preserving neighbors."""
    stages = [
        {
            "id": "stage-1",
            "order": 1,
            "name": "Stage 1: Initial Alkylation",
            "unit_operation_type": "Reaction",
            "key_intermediate": "Intermediate 1",
            "inputs": ["Material A"],
            "outputs": ["Intermediate 1"],
            "candidate_cpps": [],
            "linked_cqas": ["cqa-1"],
            "source": "from_description",
            "confidence": "high"
        },
        {
            "id": "stage-2",
            "order": 2,
            "name": "Stage 2: To Regenerate",
            "unit_operation_type": "Workup",
            "key_intermediate": "Intermediate 2",
            "inputs": ["Intermediate 1"],
            "outputs": ["Intermediate 2"],
            "candidate_cpps": [],
            "linked_cqas": ["cqa-2"],
            "source": "ai_inferred",
            "confidence": "low"
        },
        {
            "id": "stage-3",
            "order": 3,
            "name": "Stage 3: Crystallization",
            "unit_operation_type": "Crystallization",
            "key_intermediate": "Final API",
            "inputs": ["Intermediate 2"],
            "outputs": ["Final API"],
            "candidate_cpps": [],
            "linked_cqas": ["cqa-3"],
            "source": "from_document",
            "confidence": "high"
        }
    ]
    proj = DummyProject()
    regenerated = regenerate_single_stage(proj, "stage-2", stages, db=None)

    assert regenerated.id == "stage-2"
    assert regenerated.order == 2
    # Ensure stage-1 and stage-3 remain unchanged in the list
    assert stages[0]["id"] == "stage-1"
    assert stages[2]["id"] == "stage-3"
