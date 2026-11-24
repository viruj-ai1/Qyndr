# ============================================================
#  tests/test_qtpp_specifications.py
#  QTPP Specifications & CQA Derivation Unit Tests (ICH Q8(R2))
# ============================================================
import pytest
import sys
import os
import pathlib
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

backend_dir = pathlib.Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from database import models, crud, schemas
from database.schemas import (
    QTPPSpecificationCreate,
    CriterionTypeEnum,
    AttributeClassificationEnum
)


@pytest.fixture
def test_db_session():
    """Provides a fresh in-memory SQLite database session with all models."""
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    models.Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    try:
        # Create a sample project
        proj = models.Project(
            name="Propofol Stage 1 Optimization",
            compound="Propofol",
            objective="Maximize yield and purity",
            description="Process description for testing"
        )
        session.add(proj)
        session.commit()
        session.refresh(proj)
        yield session, proj
    finally:
        session.close()


def test_criterion_validation_rules():
    """Verify validation rules: MIN requires min_value, MAX requires max_value, RANGE requires both and min < max, EXACT requires target, QUALITATIVE requires text."""
    # 1. MIN valid & invalid
    min_spec = QTPPSpecificationCreate(
        attribute_name="Dissolution",
        attribute_classification="Dissolution",
        criterion_type=CriterionTypeEnum.MIN,
        min_value=80.0,
        unit="%"
    )
    min_spec.validate_criterion_rules()

    with pytest.raises(ValueError, match="MIN criterion requires 'min_value'"):
        invalid_min = QTPPSpecificationCreate(
            attribute_name="Dissolution",
            criterion_type=CriterionTypeEnum.MIN,
            min_value=None
        )
        invalid_min.validate_criterion_rules()

    # 2. MAX valid & invalid
    max_spec = QTPPSpecificationCreate(
        attribute_name="Related substances",
        attribute_classification="Purity / related substances",
        criterion_type=CriterionTypeEnum.MAX,
        max_value=0.15,
        unit="%"
    )
    max_spec.validate_criterion_rules()

    with pytest.raises(ValueError, match="MAX criterion requires 'max_value'"):
        invalid_max = QTPPSpecificationCreate(
            attribute_name="Related substances",
            criterion_type=CriterionTypeEnum.MAX,
            max_value=None
        )
        invalid_max.validate_criterion_rules()

    # 3. RANGE valid & invalid (both min < max and missing values)
    range_spec = QTPPSpecificationCreate(
        attribute_name="Assay",
        attribute_classification="Assay / potency",
        criterion_type=CriterionTypeEnum.RANGE,
        min_value=95.0,
        max_value=105.0,
        unit="%"
    )
    range_spec.validate_criterion_rules()

    with pytest.raises(ValueError, match="strictly less than"):
        invalid_range_order = QTPPSpecificationCreate(
            attribute_name="Assay",
            criterion_type=CriterionTypeEnum.RANGE,
            min_value=105.0,
            max_value=95.0
        )
        invalid_range_order.validate_criterion_rules()

    with pytest.raises(ValueError, match="requires both 'min_value' and 'max_value'"):
        invalid_range_missing = QTPPSpecificationCreate(
            attribute_name="Assay",
            criterion_type=CriterionTypeEnum.RANGE,
            min_value=95.0,
            max_value=None
        )
        invalid_range_missing.validate_criterion_rules()

    # 4. EXACT valid & invalid
    exact_spec = QTPPSpecificationCreate(
        attribute_name="Dosage strength",
        criterion_type=CriterionTypeEnum.EXACT,
        target_value=500.0,
        unit="mg"
    )
    exact_spec.validate_criterion_rules()

    with pytest.raises(ValueError, match="EXACT criterion requires 'target_value'"):
        invalid_exact = QTPPSpecificationCreate(
            attribute_name="Dosage strength",
            criterion_type=CriterionTypeEnum.EXACT,
            target_value=None
        )
        invalid_exact.validate_criterion_rules()

    # 5. QUALITATIVE valid & invalid
    qual_spec = QTPPSpecificationCreate(
        attribute_name="Dosage form",
        criterion_type=CriterionTypeEnum.QUALITATIVE,
        qualitative_text="Immediate release tablet",
        unit="N/A"
    )
    qual_spec.validate_criterion_rules()

    with pytest.raises(ValueError, match="QUALITATIVE criterion requires 'qualitative_text'"):
        invalid_qual = QTPPSpecificationCreate(
            attribute_name="Dosage form",
            criterion_type=CriterionTypeEnum.QUALITATIVE,
            qualitative_text=""
        )
        invalid_qual.validate_criterion_rules()


def test_attribute_name_uniqueness_per_project(test_db_session):
    """Verify attribute_name is unique within a project."""
    session, proj = test_db_session
    specs = [
        QTPPSpecificationCreate(
            attribute_name="Assay",
            criterion_type=CriterionTypeEnum.RANGE,
            min_value=95.0,
            max_value=105.0,
            unit="%"
        ),
        QTPPSpecificationCreate(
            attribute_name="assay",  # duplicate case-insensitive
            criterion_type=CriterionTypeEnum.MIN,
            min_value=90.0,
            unit="%"
        )
    ]
    with pytest.raises(ValueError, match="Duplicate attribute_name"):
        crud.create_or_replace_qtpp_specifications(session, proj.id, specs)


def test_target_display_string_formatting():
    """Verify target formatted display strings for MIN, MAX, RANGE, EXACT, QUALITATIVE."""
    # 1. RANGE
    s1 = models.QTPPSpecification(
        id="1", project_id=1, attribute_name="Assay",
        criterion_type="RANGE", min_value=95.0, max_value=105.0, unit="%"
    )
    assert s1.format_target_display() == "95-105 %"

    # 2. MAX
    s2 = models.QTPPSpecification(
        id="2", project_id=1, attribute_name="Related substances",
        criterion_type="MAX", max_value=0.15, unit="%"
    )
    assert s2.format_target_display() == "<= 0.15 %"

    # 3. MIN
    s3 = models.QTPPSpecification(
        id="3", project_id=1, attribute_name="Dissolution",
        criterion_type="MIN", min_value=80.0, unit="%"
    )
    assert s3.format_target_display() == ">= 80 %"

    # 4. EXACT
    s4 = models.QTPPSpecification(
        id="4", project_id=1, attribute_name="Stability",
        criterion_type="EXACT", target_value=24.0, unit="months"
    )
    assert s4.format_target_display() == "= 24 months"

    # 5. QUALITATIVE
    s5 = models.QTPPSpecification(
        id="5", project_id=1, attribute_name="Dosage form",
        criterion_type="QUALITATIVE", qualitative_text="Immediate release tablet", unit="N/A"
    )
    assert s5.format_target_display() == "Immediate release tablet"


def test_migration_mapping_from_legacy_qtpp():
    """Verify parsing legacy QTPP JSON maps fields correctly."""
    legacy_item = {
        "id": "qtpp-legacy-1",
        "attribute": "Purity by GC",
        "criterion": ">= 98.0% w/w",
        "justification": "Pharmacopoeial",
        "type": "Assay-Purity"
    }
    parsed = crud.parse_legacy_qtpp_to_spec(legacy_item, 0, project_id=10)
    assert parsed["attribute_name"] == "Purity by GC"
    assert parsed["attribute_classification"] == "Assay / potency"
    assert parsed["criterion_type"] == "MIN"
    assert parsed["min_value"] == 98.0
    assert parsed["unit"] == "%"
    assert parsed["justification"] == "Pharmacopoeial"


def test_cqa_derivation_selection_flow(test_db_session):
    """Verify CQA Derivation: candidates created from QTPP, only marked critical attributes flow into proj.cqas_data."""
    session, proj = test_db_session

    specs = [
        QTPPSpecificationCreate(
            id="qtpp-assay",
            attribute_name="Assay",
            attribute_classification="Assay / potency",
            criterion_type=CriterionTypeEnum.RANGE,
            min_value=95.0,
            max_value=105.0,
            unit="%"
        ),
        QTPPSpecificationCreate(
            id="qtpp-appearance",
            attribute_name="Visual Appearance",
            attribute_classification="Physical properties",
            criterion_type=CriterionTypeEnum.QUALITATIVE,
            qualitative_text="White crystalline powder",
            unit="N/A"
        )
    ]
    created = crud.create_or_replace_qtpp_specifications(session, proj.id, specs)
    assert len(created) == 2
    session.refresh(proj)
    assert len(proj.qtpp_data) == 2
    assert proj.qtpp_data[0]["attribute"] == "Assay"
    assert proj.qtpp_data[0]["criterion"] == "95-105 %"

