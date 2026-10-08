"""
database/schemas.py - Pydantic data schemas for API requests & responses.
"""
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional, Dict, Any

# ── Phase 0 QbD Schemas ─────────────────────────────────────

class QTPPItem(BaseModel):

    id: str
    attribute: str
    criterion: str
    justification: str  # Pharmacopoeial / Regulatory Guideline / Patient-Critical / Internal Spec
    type: str           # Identity / Assay-Purity / Impurity / Physical Property / Residual Solvent / Microbial / Stability

class CQAMapping(BaseModel):
    id: str
    name: str
    appliesTo: str      # 'Final API' | 'Intermediate'
    stageName: str = ""
    method: str = ""
    range: str = ""
    justification: str = ""
    linkedQtppIds: List[str] = []

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
    severity: int = 1
    occurrence: int = 1
    detectability: int = 1
    rpn: int = 1
    rationale: str = ""
    criticalFlag: bool = False
    overrideReason: str = ""

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

class ProjectCreate(ProjectBase): pass

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    compound: Optional[str] = None
    objective: Optional[str] = None
    description: Optional[str] = None
    current_step: Optional[str] = None
    doe_type: Optional[str] = None
    bayes_iter: Optional[int] = None
    qtpp_data: Optional[List[dict]] = None
    cqas_data: Optional[List[dict]] = None
    stages_data: Optional[List[dict]] = None
    risk_assessment_data: Optional[dict] = None
    audit_logs: Optional[List[dict]] = None
    locked_campaigns: Optional[List[str]] = None

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

