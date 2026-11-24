"""
tests/test_cqa_identification.py - Unit tests for CQA Identification & Criticality Assessment.
Verifies ICH Q8(R2)/Q9(R1) principles:
- QTPP is the basis for identifying CQAs
- Severity (1-5) and scientific justification
- Decision justification required for CQA and NON_CQA
- Auto-generated CQA-XXX codes with uniqueness and non-reuse
- Many-to-many CQA <-> QTPP linking
- Approved CQA endpoint for DoE responses
- Secondary RPN does not drive classification
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import models, schemas, crud
from backend.database.schemas import (
    CQAAttributeCreate,
    CQAAttributeUpdate,
    CQAClassificationEnum,
    CQARiskSecondaryIn,
    QTPPSpecificationCreate,
    CriterionTypeEnum
)


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    models.Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Create test project
    proj = models.Project(
        name="Test Formulation Project",
        compound="TestAPI",
        current_step="cqa-risk",
        doe_type="Factorial",
        factors=[],
        responses=[],
        qtpp_data=[]
    )
    session.add(proj)
    session.commit()
    session.refresh(proj)

    # Create sample QTPP specifications
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
            id="qtpp-dissolution",
            attribute_name="Dissolution",
            attribute_classification="Dissolution",
            criterion_type=CriterionTypeEnum.MIN,
            min_value=80.0,
            unit="%"
        ),
        QTPPSpecificationCreate(
            id="qtpp-impurities",
            attribute_name="Related substances",
            attribute_classification="Purity / related substances",
            criterion_type=CriterionTypeEnum.MAX,
            max_value=0.2,
            unit="%"
        )
    ]
    crud.create_or_replace_qtpp_specifications(session, proj.id, specs)

    yield session, proj
    session.close()


def test_cqa_code_auto_generation_and_non_reuse(db_session):
    session, proj = db_session

    cqa1 = crud.create_cqa_attribute(session, proj.id, CQAAttributeCreate(
        attribute_name="Active Assay",
        scientific_justification="Patient receives correct dosage.",
        severity_score=5,
        classification=CQAClassificationEnum.POTENTIAL_CQA,
        linked_qtpp_ids=["qtpp-assay"]
    ))
    assert cqa1.cqa_code == "CQA-001"

    cqa2 = crud.create_cqa_attribute(session, proj.id, CQAAttributeCreate(
        attribute_name="Drug Release Rate",
        scientific_justification="Ensures in vivo drug absorption.",
        severity_score=4,
        classification=CQAClassificationEnum.POTENTIAL_CQA,
        linked_qtpp_ids=["qtpp-dissolution"]
    ))
    assert cqa2.cqa_code == "CQA-002"

    # Delete CQA-001
    crud.delete_cqa_attribute(session, proj.id, cqa1.id)

    # Next code must NOT reuse CQA-001 or CQA-002, must be CQA-003
    cqa3 = crud.create_cqa_attribute(session, proj.id, CQAAttributeCreate(
        attribute_name="Impurities Level",
        scientific_justification="Limits toxic degradation products.",
        severity_score=5,
        classification=CQAClassificationEnum.POTENTIAL_CQA,
        linked_qtpp_ids=["qtpp-impurities"]
    ))
    assert cqa3.cqa_code == "CQA-003"


def test_decision_justification_rules(db_session):
    session, proj = db_session

    # 1. POTENTIAL_CQA does not require decision_justification
    cqa_pot = crud.create_cqa_attribute(session, proj.id, CQAAttributeCreate(
        attribute_name="Moisture Content",
        scientific_justification="May affect stability.",
        severity_score=3,
        classification=CQAClassificationEnum.POTENTIAL_CQA,
        decision_justification="",
        linked_qtpp_ids=["qtpp-assay"]
    ))
    assert cqa_pot.classification == "POTENTIAL_CQA"

    # 2. CQA requires decision_justification
    with pytest.raises(ValueError, match="Decision justification is required"):
        crud.create_cqa_attribute(session, proj.id, CQAAttributeCreate(
            attribute_name="Degradation Impurity A",
            scientific_justification="Toxicological risk.",
            severity_score=5,
            classification=CQAClassificationEnum.CQA,
            decision_justification="",
            linked_qtpp_ids=["qtpp-impurities"]
        ))

    # 3. NON_CQA also requires decision_justification
    with pytest.raises(ValueError, match="Decision justification is required"):
        crud.create_cqa_attribute(session, proj.id, CQAAttributeCreate(
            attribute_name="Tablet Color",
            scientific_justification="Visual organoleptic characteristic.",
            severity_score=1,
            classification=CQAClassificationEnum.NON_CQA,
            decision_justification="",
            linked_qtpp_ids=["qtpp-assay"]
        ))


def test_severity_validation_and_cqa_qtpp_linking(db_session):
    session, proj = db_session

    # Invalid severity < 1 or > 5 raises ValueError
    with pytest.raises(ValueError):
        CQAAttributeCreate(
            attribute_name="Test Bad Severity",
            scientific_justification="Justification",
            severity_score=6,
            linked_qtpp_ids=["qtpp-assay"]
        )

    # Empty QTPP links raises ValueError
    with pytest.raises(ValueError, match="must link to at least one QTPP"):
        crud.create_cqa_attribute(session, proj.id, CQAAttributeCreate(
            attribute_name="Unlinked CQA",
            scientific_justification="Justification",
            severity_score=3,
            linked_qtpp_ids=[]
        ))

    # Many-to-many linking: one CQA links to 2 QTPP attributes
    cqa_multi = crud.create_cqa_attribute(session, proj.id, CQAAttributeCreate(
        attribute_name="Critical Purity",
        scientific_justification="Controls assay and degradation.",
        severity_score=5,
        classification=CQAClassificationEnum.CQA,
        decision_justification="Essential patient safety attribute.",
        linked_qtpp_ids=["qtpp-assay", "qtpp-impurities"]
    ))
    assert len(cqa_multi.linked_qtpp_specs) == 2


def test_approved_cqas_endpoint_and_rpn_neutrality(db_session):
    session, proj = db_session

    # Create CQA with low severity but classified as CQA
    cqa1 = crud.create_cqa_attribute(session, proj.id, CQAAttributeCreate(
        attribute_name="Assay Critical",
        scientific_justification="Potency control.",
        severity_score=4,
        classification=CQAClassificationEnum.CQA,
        decision_justification="Direct link to patient clinical exposure.",
        linked_qtpp_ids=["qtpp-assay"],
        secondary_risk=CQARiskSecondaryIn(occurrence=4, detectability=3, notes="Secondary evaluation")
    ))

    # Create another attribute with severity 5 but classified as POTENTIAL_CQA
    cqa2 = crud.create_cqa_attribute(session, proj.id, CQAAttributeCreate(
        attribute_name="High Severity Potential",
        scientific_justification="Requires further development evaluation.",
        severity_score=5,
        classification=CQAClassificationEnum.POTENTIAL_CQA,
        decision_justification="",
        linked_qtpp_ids=["qtpp-dissolution"],
        secondary_risk=CQARiskSecondaryIn(occurrence=5, detectability=5, notes="High RPN but potential CQA")
    ))

    # Approved CQAs should ONLY contain cqa1 (classification == CQA)
    approved = crud.get_approved_cqa_attributes(session, proj.id)
    assert len(approved) == 1
    assert approved[0].id == cqa1.id

    # Secondary risk has RPN 4*4*3 = 48, but classification remains CQA
    assert cqa1.secondary_risk.occurrence == 4
    assert cqa1.secondary_risk.detectability == 3
    # cqa2 has RPN 5*5*5 = 125, but classification is POTENTIAL_CQA (RPN never drives classification)
    assert cqa2.classification == "POTENTIAL_CQA"
