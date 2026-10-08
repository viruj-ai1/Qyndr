# ============================================================
#  database/models.py  –  SQLAlchemy ORM models
# ============================================================
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Text, Boolean,
    DateTime, ForeignKey, JSON
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
    created_at           = Column(DateTime, default=datetime.utcnow)
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    factors      = relationship("Factor",      back_populates="project", cascade="all, delete-orphan")
    responses    = relationship("Response",    back_populates="project", cascade="all, delete-orphan")
    experiments  = relationship("Experiment",  back_populates="project", cascade="all, delete-orphan")
    analyses     = relationship("Analysis",    back_populates="project", cascade="all, delete-orphan")
    gp_iters     = relationship("GPIteration", back_populates="project", cascade="all, delete-orphan")


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
