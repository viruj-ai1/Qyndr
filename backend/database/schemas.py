"""
database/schemas.py - Pydantic data schemas for API requests & responses.
"""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Optional, Dict, Any

from enum import Enum

class CriterionTypeEnum(str, Enum):
    MIN = "MIN"
    MAX = "MAX"
    RANGE = "RANGE"
    EXACT = "EXACT"
    QUALITATIVE = "QUALITATIVE"

class AttributeClassificationEnum(str, Enum):
    DOSAGE_FORM = "Dosage form"
    ROUTE_OF_ADMINISTRATION = "Route of administration"
    DOSAGE_STRENGTH = "Dosage strength"
    DRUG_RELEASE_PROFILE = "Drug release profile"
    ASSAY_POTENCY = "Assay / potency"
    PURITY_RELATED_SUBSTANCES = "Purity / related substances"
    DISSOLUTION = "Dissolution"
    CONTENT_UNIFORMITY = "Content uniformity"
    PHYSICAL_PROPERTIES = "Physical properties"
    MICROBIOLOGICAL_QUALITY = "Microbiological quality"
    STABILITY = "Stability"
    CONTAINER_CLOSURE_SYSTEM = "Container closure system"
    OTHER = "Other"

class QTPPSpecificationBase(BaseModel):
    attribute_name: str
    attribute_classification: str = "Other"
    criterion_type: CriterionTypeEnum
    unit: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    target_value: Optional[float] = None
    qualitative_text: Optional[str] = None
    justification: str = ""
    reference_source: str = ""
    sort_order: int = 0

    def validate_criterion_rules(self):
        c_type = self.criterion_type
        if c_type == CriterionTypeEnum.MIN:
            if self.min_value is None:
                raise ValueError("MIN criterion requires 'min_value'.")
        elif c_type == CriterionTypeEnum.MAX:
            if self.max_value is None:
                raise ValueError("MAX criterion requires 'max_value'.")
        elif c_type == CriterionTypeEnum.RANGE:
            if self.min_value is None or self.max_value is None:
                raise ValueError("RANGE criterion requires both 'min_value' and 'max_value'.")
            if self.min_value >= self.max_value:
                raise ValueError("RANGE criterion requires 'min_value' to be strictly less than 'max_value'.")
        elif c_type == CriterionTypeEnum.EXACT:
            if self.target_value is None:
                raise ValueError("EXACT criterion requires 'target_value'.")
        elif c_type == CriterionTypeEnum.QUALITATIVE:
            if not self.qualitative_text or not self.qualitative_text.strip():
                raise ValueError("QUALITATIVE criterion requires 'qualitative_text'.")

class QTPPSpecificationCreate(QTPPSpecificationBase):
    id: Optional[str] = None

class QTPPSpecificationUpdate(BaseModel):
    attribute_name: Optional[str] = None
    attribute_classification: Optional[str] = None
    criterion_type: Optional[CriterionTypeEnum] = None
    unit: Optional[str] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    target_value: Optional[float] = None
    qualitative_text: Optional[str] = None
    justification: Optional[str] = None
    reference_source: Optional[str] = None
    sort_order: Optional[int] = None

class QTPPSpecificationOut(QTPPSpecificationBase):
    id: str
    project_id: int
    display_string: str = ""
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ── CQA Identification & Criticality Assessment Schemas ─────

class CQAClassificationEnum(str, Enum):
    CQA = "CQA"
    POTENTIAL_CQA = "POTENTIAL_CQA"
    NON_CQA = "NON_CQA"

class CQAEvidenceBasisEnum(str, Enum):
    SCIENTIFIC_KNOWLEDGE = "Scientific knowledge"
    PRODUCT_DEV_LITERATURE = "Product development literature"
    PRIOR_KNOWLEDGE = "Prior knowledge / similar products"
    REGULATORY_GUIDANCE = "Regulatory guidance"
    PRELIMINARY_EXPERIMENTAL_DATA = "Preliminary experimental data"
    CLINICAL_PATIENT_DATA = "Clinical / patient data"
    OTHER = "Other"

class CQARiskSecondaryIn(BaseModel):
    occurrence: Optional[int] = Field(None, ge=1, le=5)
    detectability: Optional[int] = Field(None, ge=1, le=5)
    notes: Optional[str] = ""

class CQARiskSecondaryOut(CQARiskSecondaryIn):
    id: Optional[int] = None
    cqa_id: str
    rpn: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class CQAAttributeBase(BaseModel):
    attribute_name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = ""
    scientific_justification: str = Field(..., min_length=1)
    severity_score: int = Field(default=3, ge=1, le=5)
    evidence_basis: List[str] = Field(default_factory=list)
    classification: CQAClassificationEnum = CQAClassificationEnum.POTENTIAL_CQA
    decision_justification: Optional[str] = ""
    linked_qtpp_ids: List[str] = Field(default_factory=list)
    sort_order: Optional[int] = 0

    @field_validator("attribute_name")
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("attribute_name cannot be empty")
        return v.strip()

    @field_validator("severity_score")
    def validate_severity(cls, v):
        if v < 1 or v > 5:
            raise ValueError("severity_score must be between 1 and 5")
        return v

    def validate_cqa_rules(self):
        if not self.linked_qtpp_ids or len(self.linked_qtpp_ids) == 0:
            raise ValueError("Each CQA must link to at least one QTPP attribute.")
        if self.classification in [CQAClassificationEnum.CQA, CQAClassificationEnum.NON_CQA]:
            if not self.decision_justification or not self.decision_justification.strip():
                raise ValueError(f"Decision justification is required when classification is {self.classification.value}.")

class CQAAttributeCreate(CQAAttributeBase):
    id: Optional[str] = None
    secondary_risk: Optional[CQARiskSecondaryIn] = None

class CQAAttributeUpdate(BaseModel):
    attribute_name: Optional[str] = None
    description: Optional[str] = None
    scientific_justification: Optional[str] = None
    severity_score: Optional[int] = Field(None, ge=1, le=5)
    evidence_basis: Optional[List[str]] = None
    classification: Optional[CQAClassificationEnum] = None
    decision_justification: Optional[str] = None
    linked_qtpp_ids: Optional[List[str]] = None
    sort_order: Optional[int] = None
    secondary_risk: Optional[CQARiskSecondaryIn] = None

class CQALinkedQTPPDetail(BaseModel):
    id: str
    attribute_name: str
    display_string: str
    classification: str

class CQAAttributeOut(BaseModel):
    id: str
    cqa_code: str
    project_id: int
    attribute_name: str
    description: str
    scientific_justification: str
    severity_score: int
    evidence_basis: List[str]
    classification: str
    decision_justification: str
    sort_order: int
    linked_qtpp_ids: List[str]
    linked_qtpp_details: List[CQALinkedQTPPDetail] = []
    secondary_risk: Optional[CQARiskSecondaryOut] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class CQASummaryOut(BaseModel):
    project_id: int
    total_cqas: int
    cqa_count: int
    potential_cqa_count: int
    non_cqa_count: int
    unlinked_qtpp_count: int

class CQAReorderItem(BaseModel):
    id: str
    sort_order: int

# ── Phase 0 QbD Schemas ─────────────────────────────────────

class QTPPItem(BaseModel):
    id: str
    attribute: str
    criterion: str
    justification: str  # Pharmacopoeial / Regulatory Guideline / Patient-Critical / Internal Spec
    type: str           # Identity / Assay-Purity / Impurity / Physical Property / Residual Solvent / Microbial / Stability
    operator: Optional[str] = None
    acceptanceCriterion: Optional[Dict[str, Any]] = None

class CQAMapping(BaseModel):
    id: str
    name: str
    appliesTo: str = "Final API"      # 'Final API' | 'Intermediate'
    stageName: str = ""
    method: str = ""
    range: str = ""
    justification: str = ""
    linkedQtppIds: List[str] = []
    # New structured QbD assessment fields
    impact_score: int = Field(default=3, ge=1, le=5)
    uncertainty_score: int = Field(default=3, ge=1, le=5)
    criticality_score: int = 9
    is_critical: bool = False
    rationale: str = ""
    reference: str = ""
    exclusion_reason: str = ""
    origin: str = "suggested"  # "suggested" | "chemist_added" | "suggested_edited"
    decided_by: str = ""
    decided_at: str = ""
    version: int = 1

    model_config = ConfigDict(extra="ignore")


class CQAAuditLogItem(BaseModel):
    id: int
    project_id: int
    cqa_id: str
    action: str
    old_value: Optional[Dict[str, Any]] = None
    new_value: Optional[Dict[str, Any]] = None
    user: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class StageItem(BaseModel):
    id: str
    order: int
    name: str
    unitOpType: str     # Reaction / Workup / Crystallization / Filtration / Drying / Purification / Other
    description: str = ""
    intermediateProduced: str = ""

class RiskParameter(BaseModel):
    id: str
    name: str
    type: str           # CPP-candidate / CMA-candidate
    linkedCqaIds: List[str] = []
    severity: Optional[int] = None
    occurrence: Optional[int] = None
    detectability: Optional[int] = None
    rpn: Optional[int] = None
    rationale: str = ""
    criticalFlag: bool = False
    overrideReason: str = ""
    status: str = "suggested"   # suggested / confirmed / custom
    notImpacting: Optional[bool] = False

class StageRiskAssessment(BaseModel):
    stageId: str
    parameters: List[RiskParameter] = []

class Phase0Data(BaseModel):
    qtpp: List[QTPPItem] = []
    cqas: List[CQAMapping] = []
    stages: List[StageItem] = []
    riskAssessments: dict = Field(default_factory=dict) # stageId -> { parameters: [...] }

class AuditLogEntry(BaseModel):
    id: str
    user: str = "R&D Scientist"
    timestamp: str
    action: str
    details: str


# ── Factor ──────────────────────────────────────────────────
class FactorBase(BaseModel):
    name: str
    symbol: str = ""
    unit: str = ""
    low: float
    high: float
    baseline: Optional[float] = None
    factor_order: int = 0
    is_categorical: bool = False
    is_hard_to_change: bool = False
    stage_id: Optional[str] = None
    linked_cqa_ids: List[str] = []

class FactorCreate(FactorBase): pass

class FactorOut(FactorBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int


# ── Response ─────────────────────────────────────────────────
class ResponseBase(BaseModel):
    name: str
    unit: str = ""
    goal: str = "maximize"
    target: Optional[float] = None
    lower_limit: Optional[float] = None
    upper_limit: Optional[float] = None
    weight: float = 1.0
    resp_order: int = 0
    stage_id: Optional[str] = None
    linked_cqa_ids: List[str] = []

class ResponseCreate(ResponseBase): pass

class ResponseOut(ResponseBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int


# ── Project ──────────────────────────────────────────────────
class ProjectBase(BaseModel):
    name: str
    compound: str = ""
    objective: str = ""
    description: str = ""
    unit_op_type: Optional[str] = "Reaction"
    stage_number: Optional[int] = 1
    current_step: Optional[str] = "cqa-risk"
    api_targets: List[Any] = []
    step_statuses: Optional[Dict[str, str]] = Field(default_factory=dict)
    unlocked_step: Optional[str] = None

class ProjectCreate(ProjectBase): pass

class ProjectWithQTPPCreate(ProjectCreate):
    qtpp_data: List[Dict[str, Any]] = []

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    compound: Optional[str] = None
    objective: Optional[str] = None
    description: Optional[str] = None
    unit_op_type: Optional[str] = None
    stage_number: Optional[int] = None
    current_step: Optional[str] = None
    doe_type: Optional[str] = None
    bayes_iter: Optional[int] = None
    qtpp_data: Optional[List[dict]] = None
    cqas_data: Optional[List[dict]] = None
    stages_data: Optional[List[dict]] = None
    risk_assessment_data: Optional[dict] = None
    audit_logs: Optional[List[dict]] = None
    locked_campaigns: Optional[List[str]] = None
    api_targets: Optional[List[Any]] = None
    step_statuses: Optional[Dict[str, str]] = None
    unlocked_step: Optional[str] = None

# ── Step Workflow Locking Schemas ────────────────────────────
class StepCompleteRequest(BaseModel):
    step_key: str
    step_data: Optional[Dict[str, Any]] = None

class StepUnlockRequest(BaseModel):
    step_key: str

class StepCancelEditRequest(BaseModel):
    step_key: str

class StepRealignRequest(BaseModel):
    step_key: str
    updated_step_data: Optional[Dict[str, Any]] = None

class StepRealignResponse(BaseModel):
    ok: bool
    step_key: str
    changes_detected: bool
    summary: Dict[str, Any]
    step_statuses: Dict[str, str]
    audit_logs: Optional[List[dict]] = None
    locked_campaigns: Optional[List[str]] = None
    api_targets: Optional[List[Any]] = None

# ── Experiment ───────────────────────────────────────────────
class ExperimentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    stage_id: Optional[str] = None
    run_number: int
    run_type: str
    coded_values: List[float]
    actual_values: List[float]
    result_values: Optional[List[Optional[float]]] = None
    iteration: int
    notes: str
    is_completed: bool


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    current_step: str
    doe_type: str
    bayes_iter: int
    qtpp_data: List[Any] = []
    cqas_data: List[Any] = []
    stages_data: List[Any] = []
    risk_assessment_data: dict = Field(default_factory=dict)
    audit_logs: List[Any] = []
    locked_campaigns: List[str] = []
    api_targets: List[Any] = []
    step_statuses: Dict[str, str] = Field(default_factory=dict)
    unlocked_step: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    factors: List[FactorOut] = []
    responses: List[ResponseOut] = []
    experiments: List[ExperimentOut] = []



# ── Results upload ───────────────────────────────────────────
class ResultEntry(BaseModel):
    experiment_id: int
    result_values: List[Optional[float]]

class ResultsUpload(BaseModel):
    results: List[ResultEntry]


# ── DOE Request ──────────────────────────────────────────────
class FactorConstraint(BaseModel):
    coefficients: dict  # e.g. {"Factor A": 1.0, "Factor B": 1.0}
    operator: str = "<=" # "<=" or ">="
    rhs: float          # right hand side threshold

class DOERecommendRequest(BaseModel):
    project_id: int
    stage_id: Optional[str] = None
    phase: str = "screening"
    has_htc_factors: bool = False
    constraints: List[FactorConstraint] = []

class DOEGenerateRequest(BaseModel):
    project_id: int
    stage_id: Optional[str] = None
    design_key: str
    phase: str = "screening"
    constraints: List[FactorConstraint] = []


# ── Diagnostics & Evaluation ──────────────────────────────────
class PreRunEvaluationRequest(BaseModel):
    project_id: int
    stage_id: Optional[str] = None
    design_key: str

class MonteCarloSimRequest(BaseModel):
    project_id: int
    stage_id: Optional[str] = None
    factor_stds: List[float] = [] # std dev per factor
    n_iterations: int = 5000
    factor_x: int = 0
    factor_y: int = 1


# ── Analysis request ─────────────────────────────────────────
class AnalysisRequest(BaseModel):
    project_id: int
    stage_id: Optional[str] = None
    response_idx: int = 0

class OptimizeRequest(BaseModel):
    project_id: int
    stage_id: Optional[str] = None


# ── Bayesian ─────────────────────────────────────────────────
class BayesRecommendRequest(BaseModel):
    project_id: int
    stage_id: Optional[str] = None
    response_idx: int = 0
    project_name: Optional[str] = None
    compound: Optional[str] = None
    factors: Optional[List[dict]] = None
    responses: Optional[List[dict]] = None

class BayesResultRequest(BaseModel):
    project_id: int
    stage_id: Optional[str] = None
    iteration: int
    result_values: List[Optional[float]]
    actual_values: List[Optional[float]]


# ── Analysis Output helpers ──────────────────────────────────
class ANOVARow(BaseModel):
    term: str
    effect: float
    SS: float
    df: int
    MS: float
    F: Optional[float] = None
    p_value: Optional[float] = None
    significant: bool = False

class RegressionCoeff(BaseModel):
    term: str
    coeff: float
    se: float
    t_value: float
    p_value: float
    significant: bool

class AnalysisOut(BaseModel):
    response: ResponseOut
    n: int
    y_mean: float
    y_min: float
    y_max: float
    y_std: float
    anova: Optional[Any] = None
    rsm: Optional[Any] = None

class OptimumOut(BaseModel):
    actual_optimum: List[float]
    coded_optimum: List[float]
    predicted_responses: List[float]
    composite_desirability: float


# ── GP & Bayesian Output ─────────────────────────────────────
class GPSummary(BaseModel):
    n_obs: int
    y_best: float
    kernel_params: Any

class RecommendationOut(BaseModel):
    actual_values: List[float]
    predicted_mean: float
    predicted_std: float
    expected_improvement: float
    confidence_95: List[float]
    iteration: int

