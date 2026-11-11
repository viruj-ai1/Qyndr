# ============================================================
#  tests/test_cqa_derivation.py - CQA Derivation Unit Tests
# ============================================================
import pytest
import sys
import os
import pathlib

backend_dir = pathlib.Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from services.cqa_suggestion import (
    classify_attribute,
    find_missing_cqas,
    validate_cqa_list,
    CQA_KNOWLEDGE_BASE
)


def test_classify_propofol_attributes():
    """Test ICH classification over typical Propofol API attributes."""
    # 1. Assay
    assay_cls = classify_attribute("Assay (Purity)", "Assay", "98.0% - 102.0%")
    assert assay_cls["matched_category"] == "assay"
    assert assay_cls["suggested_is_cqa"] is True
    assert assay_cls["suggested_impact"] == 5
    assert assay_cls["suggested_uncertainty"] == 3
    assert assay_cls["suggested_criticality"] == 15
    assert assay_cls["is_critical"] is True

    # 2. Organic Impurity (Related Compound A)
    imp_a_cls = classify_attribute("Propofol Related Compound A", "Impurity", "≤ 0.15%")
    assert imp_a_cls["matched_category"] == "organic_impurity"
    assert imp_a_cls["suggested_is_cqa"] is True
    assert imp_a_cls["suggested_impact"] == 4
    assert imp_a_cls["suggested_uncertainty"] == 3
    assert imp_a_cls["suggested_criticality"] == 12
    assert imp_a_cls["is_critical"] is True

    # 3. Mutagenic Impurity / Epichlorohydrin / Nitrosamine
    mut_cls = classify_attribute("Epichlorohydrin", "Mutagenic Impurity", "≤ 1.5 ppm")
    assert mut_cls["matched_category"] == "mutagenic_impurity"
    assert mut_cls["suggested_is_cqa"] is True
    assert mut_cls["suggested_impact"] == 5
    assert mut_cls["suggested_uncertainty"] == 4
    assert mut_cls["is_critical"] is True
    assert "M7" in mut_cls["reference"]

    # 4. Residual Solvents (Toluene)
    solv_cls = classify_attribute("Residual Toluene", "Residual Solvent", "≤ 890 ppm")
    assert solv_cls["matched_category"] == "residual_solvent"
    assert solv_cls["suggested_is_cqa"] is True
    assert "Q3C" in solv_cls["reference"]

    # 5. Visual Appearance (Non-CQA default)
    app_cls = classify_attribute("Appearance", "Physical", "Clear, colourless liquid")
    assert app_cls["matched_category"] == "physical_appearance"
    assert app_cls["suggested_is_cqa"] is False
    assert app_cls["is_critical"] is False


def test_missing_cqa_detection():
    """Test detecting missing mandatory standard API CQAs."""
    existing_cqas = [
        {"name": "Assay (Purity)", "category": "assay"}
    ]
    qtpp_items = [
        {"attribute": "Assay", "type": "Assay"}
    ]
    missing = find_missing_cqas(existing_cqas, qtpp_items)
    missing_names = [m["name"] for m in missing]

    # Organic Impurities, Residual Solvents, Water Content, Elemental Impurities should be reported as missing
    assert any("Organic Impurities" in n for n in missing_names)
    assert any("Residual Solvents" in n for n in missing_names)
    assert any("Water Content" in n for n in missing_names)


def test_validation_mandatory_fields():
    """Test validation errors on missing mandatory fields for designated CQAs."""
    invalid_cqas = [
        {
            "id": "cqa-1",
            "name": "Assay",
            "impact_score": 5,
            "uncertainty_score": 3,
            "rationale": "",  # Missing mandatory rationale
            "reference": "ICH Q6A",
            "method": "HPLC-UV",
            "range": "98.0% - 102.0%"
        }
    ]
    result = validate_cqa_list(invalid_cqas, [])
    assert result["valid"] is False
    assert any("Rationale is mandatory" in err for err in result["errors"])


def test_validation_duplicate_rationales():
    """Test warning for copy-pasted identical rationales across multiple CQAs."""
    identical_text = "This is a standard compendial attribute required for safety and efficacy."
    cqas = [
        {
            "id": "cqa-1",
            "name": "Assay",
            "impact_score": 5,
            "uncertainty_score": 3,
            "rationale": identical_text,
            "reference": "ICH Q6A",
            "method": "HPLC-UV",
            "range": "98.0% - 102.0%"
        },
        {
            "id": "cqa-2",
            "name": "Impurity A",
            "impact_score": 4,
            "uncertainty_score": 3,
            "rationale": identical_text,
            "reference": "ICH Q3A",
            "method": "HPLC-UV",
            "range": "≤ 0.15%"
        }
    ]
    result = validate_cqa_list(cqas, [])
    assert any(w["type"] == "duplicate_rationale" for w in result["warnings"])


def test_validation_ich_threshold_exceeded():
    """Test warning when unspecified impurity threshold exceeds 0.10%."""
    cqas = [
        {
            "id": "cqa-1",
            "name": "Any Unspecified Impurity",
            "impact_score": 4,
            "uncertainty_score": 3,
            "rationale": "Degradation monitoring",
            "reference": "ICH Q3A",
            "method": "HPLC-UV",
            "range": "≤ 0.20%"  # Exceeds 0.10%
        }
    ]
    result = validate_cqa_list(cqas, [])
    assert any(w["type"] == "ich_threshold_exceeded" for w in result["warnings"])


def test_validation_method_sensitivity():
    """Test warning when trace mutagenic/nitrosamine impurity lacks MS sensitivity."""
    cqas = [
        {
            "id": "cqa-1",
            "name": "Mutagenic Impurity NDMA",
            "impact_score": 5,
            "uncertainty_score": 4,
            "rationale": "High toxicological risk",
            "reference": "ICH M7",
            "method": "HPLC-UV (254 nm)",  # Inadequate sensitivity for ppm/ppb mutagenic limits
            "range": "≤ 1.5 ppm"
        }
    ]
    result = validate_cqa_list(cqas, [])
    assert any(w["type"] == "method_sensitivity" for w in result["warnings"])

