"""
tests/test_input_alignment.py
Unit tests for Project Input Data Alignment service and endpoints.
"""

import pytest
import json
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
import sys, os

# Ensure backend is on sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from services.input_alignment_service import (
    align_project_input,
    MAX_RAW_TEXT_LEN
)
from app import app
from api.auth import get_current_user


@pytest.fixture
def override_auth():
    app.dependency_overrides[get_current_user] = lambda: {"id": 1, "username": "test_chemist"}
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client(override_auth):
    return TestClient(app)


def test_messy_notes_alignment_structure():
    """Test that messy rough notes produce properly formatted name, objective, and description."""
    mock_llm = MagicMock()
    mock_response = MagicMock()
    mock_response.content = json.dumps({
        "aligned": {
            "project_name": "Rocuronium Bromide Stage-I Process Optimization",
            "compound_api": "Rocuronium Bromide",
            "primary_objective": "Maximize yield (target ≥92.0%) and purity (target ≥96.5%) while keeping Impurity A ≤0.50%",
            "project_description": "Process overview:\nNucleophilic addition in aqueous morpholine.\n\nGoal / acceptance criteria:\nYield >= 92.0%, Impurity A <= 0.50%.\n\nCritical Process Parameters (CPPs) to study:\nTemperature - °C - 45 to 65 °C - setpoint 55 °C\nMorpholine ratio - eq - 1.2 to 1.8 eq - setpoint 1.5 eq"
        },
        "missing": {
            "project_name": [],
            "compound_api": [],
            "primary_objective": [],
            "project_description": []
        },
        "warnings": []
    })
    mock_llm.invoke.return_value = mock_response

    raw_notes = "Batch record note: Rocuronium Br stage 1. optimize yield >92% and purity >96.5%. keep imp A under 0.50%. temp 45-65C set 55C. morpholine 1.2-1.8eq."
    res = align_project_input(field="all", raw_text=raw_notes, llm_client=mock_llm)

    assert "project_name" in res["aligned"]
    assert "compound_api" in res["aligned"]
    assert "primary_objective" in res["aligned"]
    assert "project_description" in res["aligned"]
    assert res["aligned"]["project_name"] == "Rocuronium Bromide Stage-I Process Optimization"
    assert "Process overview:" in res["aligned"]["project_description"]
    assert "Goal / acceptance criteria:" in res["aligned"]["project_description"]
    assert "Critical Process Parameters (CPPs) to study:" in res["aligned"]["project_description"]


def test_missing_data_produces_not_provided_and_missing_list():
    """Test that missing data produces [Not provided] and a populated missing list without hallucinations."""
    mock_llm = MagicMock()
    mock_response = MagicMock()
    mock_response.content = json.dumps({
        "aligned": {
            "project_name": "[Not provided] Stage-I Process Optimization",
            "compound_api": "[Not provided]",
            "primary_objective": "Maximize yield (target [Not provided]) while keeping impurities [Not provided]",
            "project_description": "Process overview:\n[Not provided]\n\nGoal / acceptance criteria:\n[Not provided]\n\nCritical Process Parameters (CPPs) to study:\n[Not provided]"
        },
        "missing": {
            "project_name": ["Compound Name"],
            "compound_api": ["API name", "salt form"],
            "primary_objective": ["Numeric target values", "Acceptance limit"],
            "project_description": ["Reagents", "Solvents", "CPPs"]
        },
        "warnings": ["Insufficient compound information in raw input."]
    })
    mock_llm.invoke.return_value = mock_response

    res = align_project_input(field="all", raw_text="Just some vague notes without chemical names or numbers.", llm_client=mock_llm)

    assert "[Not provided]" in res["aligned"]["compound_api"]
    assert "[Not provided]" in res["aligned"]["project_name"]
    assert len(res["missing"]["compound_api"]) > 0
    assert len(res["missing"]["project_name"]) > 0


def test_overlong_name_triggers_warning():
    """Test that project names over 80 characters produce an explicit warning."""
    long_name = "Super Long Chemical Entity Name With Extensive Functional Groups Stage-I Very Detailed Process Optimization Study"
    assert len(long_name) > 80

    mock_llm = MagicMock()
    mock_response = MagicMock()
    mock_response.content = json.dumps({
        "aligned": {
            "project_name": long_name
        },
        "missing": {
            "project_name": []
        },
        "warnings": []
    })
    mock_llm.invoke.return_value = mock_response

    res = align_project_input(field="project_name", raw_text="Entity notes...", llm_client=mock_llm)
    assert any("under 80 characters" in w for w in res["warnings"])
    assert res["aligned"]["project_name"] == long_name


def test_invalid_llm_json_retries_and_handles_error():
    """Test that invalid JSON from the LLM triggers a retry and raises clean error if it fails twice."""
    mock_llm = MagicMock()
    bad_resp = MagicMock()
    bad_resp.content = "I am an AI assistant and cannot output JSON right now."
    mock_llm.invoke.return_value = bad_resp

    with pytest.raises(ValueError) as excinfo:
        align_project_input(field="project_name", raw_text="Some text", llm_client=mock_llm)
    assert "Failed to generate valid alignment JSON after 2 attempts" in str(excinfo.value)
    assert mock_llm.invoke.call_count == 2


def test_field_all_returns_all_four_keys_and_single_field_returns_one():
    """Test field='all' returns all four keys, while single field returns only that key."""
    mock_llm = MagicMock()
    mock_response = MagicMock()
    mock_response.content = json.dumps({
        "aligned": {
            "project_name": "Compound A Stage-1 Optimization",
            "compound_api": "Compound A",
            "primary_objective": "Maximize Yield (target ≥90.0%)",
            "project_description": "Process overview:\nTest\n\nGoal / acceptance criteria:\nTest\n\nCritical Process Parameters (CPPs) to study:\nTest"
        },
        "missing": {
            "project_name": [],
            "compound_api": [],
            "primary_objective": [],
            "project_description": []
        },
        "warnings": []
    })
    mock_llm.invoke.return_value = mock_response

    # Test field='all'
    res_all = align_project_input(field="all", raw_text="Test data", llm_client=mock_llm)
    assert set(res_all["aligned"].keys()) == {"project_name", "compound_api", "primary_objective", "project_description"}

    # Test single field
    mock_single_response = MagicMock()
    mock_single_response.content = json.dumps({
        "aligned": {
            "compound_api": "Compound A Hydrochloride"
        },
        "missing": {
            "compound_api": []
        },
        "warnings": []
    })
    mock_llm.invoke.return_value = mock_single_response
    res_single = align_project_input(field="compound_api", raw_text="Compound A HCl", llm_client=mock_llm)
    assert list(res_single["aligned"].keys()) == ["compound_api"]


def test_align_api_endpoint(client):
    """Test the POST /api/project-input/align endpoint via FastAPI TestClient."""
    from unittest.mock import patch

    with patch("api.project_input_routes.align_project_input") as mock_align:
        mock_align.return_value = {
            "aligned": {"project_name": "Test Compound Stage-I Optimization"},
            "missing": {"project_name": []},
            "warnings": []
        }

        resp = client.post("/api/project-input/align", json={
            "field": "project_name",
            "raw_text": "Sample raw text"
        })

        assert resp.status_code == 200
        data = resp.json()
        assert data["aligned"]["project_name"] == "Test Compound Stage-I Optimization"
        assert "missing" in data
        assert "warnings" in data


def test_align_api_oversize_text_error(client):
    """Test that input exceeding 20,000 characters returns 413 error."""
    oversized = "a" * (MAX_RAW_TEXT_LEN + 10)
    resp = client.post("/api/project-input/align", json={
        "field": "project_name",
        "raw_text": oversized
    })
    assert resp.status_code == 413
    assert "exceeds maximum allowed length" in resp.json()["detail"]
