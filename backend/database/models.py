# ============================================================
#  database/models.py  –  SQLAlchemy ORM models
# ============================================================
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean,
    DateTime, ForeignKey, JSON, Table
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class Project(Base):
    __tablename__ = "projects"

    id                   = Column(Integer, primary_key=True, index=True)
    name                 = Column(String(200), nullable=False)
    compound             = Column(String(200), default="")
    objective            = Column(Text, default="")
    description          = Column(Text, default="")
    current_step         = Column(String(100), default="qtpp")
    doe_type             = Column(String(100), default="")
    bayes_iter           = Column(Integer, default=0)
    qtpp_data            = Column(JSON, default=list)
    cqas_data            = Column(JSON, default=list)
    stages_data          = Column(JSON, default=list)
    risk_assessment_data = Column(JSON, default=dict)
    audit_logs           = Column(JSON, default=list)
    locked_campaigns     = Column(JSON, default=list)
    api_targets          = Column(JSON, default=list)
    step_statuses        = Column(JSON, default=dict)
    unlocked_step        = Column(String(100), nullable=True)
    created_at           = Column(DateTime, default=datetime.utcnow)
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    factors      = relationship("Factor",      back_populates="project", cascade="all, delete-orphan")
    responses    = relationship("Response",    back_populates="project", cascade="all, delete-orphan")
    experiments  = relationship("Experiment",  back_populates="project", cascade="all, delete-orphan")
    analyses     = relationship("Analysis",    back_populates="project", cascade="all, delete-orphan")
    gp_iters     = relationship("GPIteration", back_populates="project", cascade="all, delete-orphan")
    qtpp_specs   = relationship("QTPPSpecification", back_populates="project", cascade="all, delete-orphan", order_by="QTPPSpecification.sort_order")
    cqa_attributes = relationship("CQAAttribute", back_populates="project", cascade="all, delete-orphan", order_by="CQAAttribute.sort_order")


class Factor(Base):
    __tablename__ = "factors"

    id             = Column(Integer, primary_key=True, index=True)
    project_id     = Column(Integer, ForeignKey("projects.id"), nullable=False)
    stage_id       = Column(String(50), nullable=True)
    name           = Column(String(200), nullable=False)
    symbol         = Column(String(20), default="")
    unit           = Column(String(50), default="")
    low            = Column(Float, nullable=False)
    high           = Column(Float, nullable=False)
    baseline       = Column(Float)
    factor_order   = Column(Integer, default=0)
    is_categorical = Column(Boolean, default=False)
    is_hard_to_change = Column(Boolean, default=False)
    linked_cqa_ids = Column(JSON, default=list)

    project      = relationship("Project", back_populates="factors")


class Response(Base):
    __tablename__ = "responses"

    id             = Column(Integer, primary_key=True, index=True)
    project_id     = Column(Integer, ForeignKey("projects.id"), nullable=False)
    stage_id       = Column(String(50), nullable=True)
    name           = Column(String(200), nullable=False)
    unit           = Column(String(50), default="")
    goal           = Column(String(20), default="maximize")   # maximize | minimize | target
    target         = Column(Float, nullable=True)
    lower_limit    = Column(Float, nullable=True)
    upper_limit    = Column(Float, nullable=True)
    weight         = Column(Float, default=1.0)
    resp_order     = Column(Integer, default=0)
    linked_cqa_ids = Column(JSON, default=list)

    project      = relationship("Project", back_populates="responses")


class Experiment(Base):
    __tablename__ = "experiments"

    id             = Column(Integer, primary_key=True, index=True)
    project_id     = Column(Integer, ForeignKey("projects.id"), nullable=False)
    stage_id       = Column(String(50), nullable=True)
    run_number     = Column(Integer, nullable=False)
    run_type       = Column(String(30), default="Factorial")  # Factorial|Axial|Center|Bayesian
    coded_values   = Column(JSON, default=list)
    actual_values  = Column(JSON, default=list)
    result_values  = Column(JSON, nullable=True)
    iteration      = Column(Integer, default=0)
    notes          = Column(Text, default="")
    is_completed   = Column(Boolean, default=False)
    created_at     = Column(DateTime, default=datetime.utcnow)

    project        = relationship("Project", back_populates="experiments")


class Analysis(Base):
    __tablename__ = "analyses"

    id            = Column(Integer, primary_key=True, index=True)
    project_id    = Column(Integer, ForeignKey("projects.id"), nullable=False)
    stage_id      = Column(String(50), nullable=True)
    response_idx  = Column(Integer, nullable=False)
    effects       = Column(JSON, default=dict)
    anova         = Column(JSON, default=dict)
    regression    = Column(JSON, default=dict)
    diagnostics   = Column(JSON, default=dict)
    optimum       = Column(JSON, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    project       = relationship("Project", back_populates="analyses")


class GPIteration(Base):
    __tablename__ = "gp_iterations"

    id            = Column(Integer, primary_key=True, index=True)
    project_id    = Column(Integer, ForeignKey("projects.id"), nullable=False)
    iteration     = Column(Integer, nullable=False)
    gp_params     = Column(JSON, default=dict)
    recommended   = Column(JSON, nullable=True)
    ei_score      = Column(Float, nullable=True)
    new_result    = Column(JSON, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    project       = relationship("Project", back_populates="gp_iters")


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_active     = Column(Boolean, default=True, nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)


class CQAAuditLog(Base):
    __tablename__ = "cqa_audit_log"

    id          = Column(Integer, primary_key=True, index=True)
    project_id  = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    cqa_id      = Column(String(100), nullable=False, index=True)
    action      = Column(String(50), nullable=False)  # CREATE, UPDATE, EXCLUDE, RESTORE
    old_value   = Column(JSON, nullable=True)
    new_value   = Column(JSON, nullable=True)
    user        = Column(String(100), default="system")
    timestamp   = Column(DateTime, default=datetime.utcnow)


class QTPPSpecification(Base):
    __tablename__ = "qtpp_specifications"

    id                       = Column(String(100), primary_key=True, index=True)  # e.g. "qtpp-1" or uuid
    project_id               = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    attribute_name           = Column(String(200), nullable=False)
    attribute_classification = Column(String(100), nullable=False, default="Other")
    criterion_type           = Column(String(50), nullable=False, default="RANGE")  # MIN, MAX, RANGE, EXACT, QUALITATIVE
    unit                     = Column(String(50), nullable=True)
    min_value                = Column(Float, nullable=True)
    max_value                = Column(Float, nullable=True)
    target_value             = Column(Float, nullable=True)
    qualitative_text         = Column(Text, nullable=True)
    justification            = Column(Text, default="")
    reference_source         = Column(String(200), default="")
    sort_order               = Column(Integer, default=0)
    created_at               = Column(DateTime, default=datetime.utcnow)
    updated_at               = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project                  = relationship("Project", back_populates="qtpp_specs")
    cqa_links                = relationship("CQAAttribute", secondary="cqa_qtpp_link", back_populates="linked_qtpp_specs")

    def format_target_display(self) -> str:
        ctype = (self.criterion_type or "").upper()
        u = (self.unit or "").strip()
        u_suffix = f" {u}" if u and u.upper() != "N/A" else ""

        def _fmt(val):
            if val is None:
                return ""
            if isinstance(val, float) and val.is_integer():
                return f"{int(val)}"
            return f"{val}"

        if ctype == "MIN":
            return f">= {_fmt(self.min_value)}{u_suffix}".strip()
        elif ctype == "MAX":
            return f"<= {_fmt(self.max_value)}{u_suffix}".strip()
        elif ctype == "RANGE":
            return f"{_fmt(self.min_value)}-{_fmt(self.max_value)}{u_suffix}".strip()
        elif ctype == "EXACT":
            return f"= {_fmt(self.target_value)}{u_suffix}".strip()
        elif ctype == "QUALITATIVE":
            return (self.qualitative_text or "Conforms to Specification").strip()
        return (self.qualitative_text or "").strip()


# Association Table for Many-to-Many CQA <-> QTPP linking
cqa_qtpp_link = Table(
    "cqa_qtpp_link",
    Base.metadata,
    Column("cqa_id", String(100), ForeignKey("cqa_attributes.id", ondelete="CASCADE"), primary_key=True),
    Column("qtpp_attribute_id", String(100), ForeignKey("qtpp_specifications.id", ondelete="CASCADE"), primary_key=True)
)


class CQAAttribute(Base):
    __tablename__ = "cqa_attributes"

    id                       = Column(String(100), primary_key=True, index=True)
    cqa_code                 = Column(String(50), nullable=False, index=True)  # Format CQA-001, CQA-002
    project_id               = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    attribute_name           = Column(String(200), nullable=False)
    description              = Column(Text, default="")
    scientific_justification = Column(Text, nullable=False, default="")
    severity_score           = Column(Integer, nullable=False, default=3)  # 1-5
    evidence_basis           = Column(JSON, default=list)  # list of strings
    classification           = Column(String(50), nullable=False, default="POTENTIAL_CQA")  # CQA, POTENTIAL_CQA, NON_CQA
    decision_justification   = Column(Text, default="")
    sort_order               = Column(Integer, default=0)
    created_at               = Column(DateTime, default=datetime.utcnow)
    updated_at               = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project                  = relationship("Project", back_populates="cqa_attributes")
    linked_qtpp_specs        = relationship("QTPPSpecification", secondary=cqa_qtpp_link, back_populates="cqa_links")
    secondary_risk           = relationship("CQARiskAssessmentSecondary", back_populates="cqa", uselist=False, cascade="all, delete-orphan")


class CQARiskAssessmentSecondary(Base):
    __tablename__ = "cqa_risk_assessment_secondary"

    id             = Column(Integer, primary_key=True, index=True)
    cqa_id         = Column(String(100), ForeignKey("cqa_attributes.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    occurrence     = Column(Integer, nullable=True)  # 1-5
    detectability  = Column(Integer, nullable=True)  # 1-5
    notes          = Column(Text, default="")
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cqa            = relationship("CQAAttribute", back_populates="secondary_risk")




