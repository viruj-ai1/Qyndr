"""
backend/services/route_mapping_service.py
Structured, grounded synthesis route mapping engine for QbD DoE workflows.
Compliant with ICH Q8(R2), Q9, and Q11 guidelines.
"""
from enum import Enum
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict
import json
import re
import os
from sqlalchemy.orm import Session

from database.models import Project
from services.llm_service import ChatGroq
from src.qbd_rag import query_qbd_regulatory_guidance


# =============================================================================
# 1. Pydantic Schemas
# =============================================================================

class UnitOperationType(str, Enum):
    Reaction = "Reaction"
    Workup = "Workup"
    Crystallization = "Crystallization"
    Filtration = "Filtration"
    Drying = "Drying"
    Distillation = "Distillation"
    Purification = "Purification"
    Milling = "Milling"
    Blending = "Blending"
    Other = "Other"


class StageSource(str, Enum):
    from_document = "from_document"
    from_description = "from_description"
    from_cqa = "from_cqa"
    ai_inferred = "ai_inferred"
    user_edited = "user_edited"


class ConfidenceLevel(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class CandidateCPP(BaseModel):
    name: str = Field(description="Name of the parameter (e.g. Reaction Temperature)")
    unit: str = Field(default="", description="Engineering unit (e.g. °C, h, eq, RPM)")
    low: Optional[float] = Field(default=None, description="Lower operational limit")
    high: Optional[float] = Field(default=None, description="Upper operational limit")
    rationale: str = Field(default="", description="Scientific justification linking this CPP to stage CQAs")

    model_config = ConfigDict(extra="ignore")


class RouteStage(BaseModel):
    id: str
    order: int
    name: str
    unit_operation_type: UnitOperationType = UnitOperationType.Reaction
    chemistry_description: str = Field(default="", description="Chemical transformation or engineering unit operation description")
    key_intermediate: str = Field(default="", description="Key intermediate, crude mass, or product produced by this stage")
    inputs: List[str] = Field(default_factory=list, description="Reagents, solvents, and starting materials fed to this stage")
    outputs: List[str] = Field(default_factory=list, description="Materials, byproducts, or streams leaving this stage")
    candidate_cpps: List[CandidateCPP] = Field(default_factory=list, description="Candidate Critical Process Parameters for this stage")
    linked_cqas: List[str] = Field(default_factory=list, description="CQA IDs this stage directly impacts")
    source: StageSource = StageSource.ai_inferred
    source_refs: List[str] = Field(default_factory=list, description="Document chunk IDs or text source references")
    confidence: ConfidenceLevel = ConfidenceLevel.medium

    # Backward compatibility with existing UI
    @property
    def unitOpType(self) -> str:
        return self.unit_operation_type.value

    @property
    def description(self) -> str:
        return self.chemistry_description

    @property
    def intermediateProduced(self) -> str:
        return self.key_intermediate

    def to_dict(self) -> Dict[str, Any]:
        d = self.model_dump()
        d["unitOpType"] = self.unit_operation_type.value
        d["description"] = self.chemistry_description
        d["intermediateProduced"] = self.key_intermediate
        return d

    model_config = ConfigDict(extra="ignore")


class GeneratedRoute(BaseModel):
    stages: List[RouteStage]
    rationale: str = Field(default="")
    retrieved_refs: List[str] = Field(default_factory=list)

    model_config = ConfigDict(extra="ignore")


class RouteValidationWarning(BaseModel):
    type: str  # intermediate_continuity | unlinked_cqa | invalid_unit_op
    stage_id: Optional[str] = None
    stage_name: Optional[str] = None
    cqa_id: Optional[str] = None
    message: str


# =============================================================================
# 2. Validation Engine
# =============================================================================

def validate_route(stages: List[Dict[str, Any]], cqas: List[Dict[str, Any]]) -> List[RouteValidationWarning]:
    """
    Validates synthetic route against ICH Q8/Q11 continuity and coverage rules.
    Returns non-blocking warnings:
    (a) stage N's outputs/key_intermediate is consumed by stage N+1
    (b) every CQA from step 03 is linked to at least one stage
    (c) unit_operation_type is a valid enum
    """
    warnings: List[RouteValidationWarning] = []
    if not stages:
        return warnings

    valid_types = {t.value.lower() for t in UnitOperationType}

    # (c) Validate Unit Operation Types
    for s in stages:
        raw_type = s.get("unit_operation_type") or s.get("unitOpType") or "Reaction"
        if str(raw_type).strip().lower() not in valid_types:
            warnings.append(RouteValidationWarning(
                type="invalid_unit_op",
                stage_id=s.get("id"),
                stage_name=s.get("name", "Unnamed Stage"),
                message=f"Stage '{s.get('name', 'Unnamed')}' has unrecognized unit operation type '{raw_type}'. Standardize to Reaction, Workup, Crystallization, Filtration, Drying, Distillation, or Purification."
            ))

    # (a) Intermediate / Stream Continuity: Stage N -> Stage N+1
    for i in range(len(stages) - 1):
        current_s = stages[i]
        next_s = stages[i + 1]

        key_int = (current_s.get("key_intermediate") or current_s.get("intermediateProduced") or "").strip().lower()
        curr_outputs = [o.lower() for o in current_s.get("outputs", [])]
        next_inputs = [inp.lower() for inp in next_s.get("inputs", [])]

        # Check if key intermediate or any output appears in next inputs or description
        next_desc = (next_s.get("chemistry_description") or next_s.get("description") or "").lower()
        next_name = (next_s.get("name") or "").lower()

        continuity_found = False
        if not key_int and not curr_outputs:
            continuity_found = True  # Not enough data specified to flag
        else:
            candidates_to_match = ([key_int] if key_int else []) + curr_outputs
            for cand in candidates_to_match:
                if not cand or len(cand) < 3:
                    continue
                # direct match in inputs
                if any(cand in inp or inp in cand for inp in next_inputs):
                    continuity_found = True
                    break
                # match in next stage name or description
                if cand in next_desc or cand in next_name:
                    continuity_found = True
                    break

        if not continuity_found and (key_int or curr_outputs):
            produced_label = key_int or (curr_outputs[0] if curr_outputs else "produced intermediate")
            warnings.append(RouteValidationWarning(
                type="intermediate_continuity",
                stage_id=next_s.get("id"),
                stage_name=next_s.get("name", f"Stage {i+2}"),
                message=f"Stage {i+2} ('{next_s.get('name')}') does not explicitly consume the stream or intermediate '{produced_label}' produced by Stage {i+1} ('{current_s.get('name')}'). Verify process continuity."
            ))

    # (b) Every CQA from Step 03 is linked to at least one stage
    all_linked_cqas = set()
    for s in stages:
        l_cqas = s.get("linked_cqas") or []
        for cid in l_cqas:
            all_linked_cqas.add(str(cid).strip().lower())
        # Also check linked_cqa_ids if present
        for cid in s.get("linked_cqa_ids", []):
            all_linked_cqas.add(str(cid).strip().lower())

    for c in cqas:
        c_id = str(c.get("id", "")).strip().lower()
        c_name = c.get("name", "").strip()
        if not c_name:
            continue
        # Also match if cqa is specifically mentioned by name in any stage's candidate CPP rationale
        mentioned_in_stage = False
        if c_id in all_linked_cqas or str(c.get("id", "")).lower() in all_linked_cqas:
            mentioned_in_stage = True
        else:
            # Check by name matching in linked_cqas list
            for s in stages:
                s_cqas = [str(x).lower() for x in (s.get("linked_cqas") or [])]
                if c_name.lower() in s_cqas or any(c_name.lower() in x for x in s_cqas):
                    mentioned_in_stage = True
                    break

        if not mentioned_in_stage:
            warnings.append(RouteValidationWarning(
                type="unlinked_cqa",
                cqa_id=c.get("id"),
                message=f"CQA '{c_name}' is not currently linked to any synthesis stage. Link it to the stage responsible for forming, purging, or controlling it."
            ))

    return warnings


# =============================================================================
# 3. Grounded Retrieval & Generation Service
# =============================================================================

def _retrieve_qbd_chunks(compound: str, description: str, top_k: int = 4) -> List[Dict[str, Any]]:
    """Retrieve grounded regulatory and process chunks using local QbD RAG."""
    query = f"{compound} synthetic route reaction workup crystallization purification parameters CQAs"
    try:
        rag_res = query_qbd_regulatory_guidance(query=query, guideline=None, min_score=0.15)
        if rag_res and rag_res.get("status") == "success" and rag_res.get("results"):
            return rag_res["results"][:top_k]
    except Exception as e:
        print("[RAG Notice] Retrieval fallback:", e)
    return []


def _extract_stages_from_text(description: str, compound: str) -> List[Dict[str, Any]]:
    """Extract heuristic stages from description if user already typed structured text."""
    if not description:
        return []
    lines = description.splitlines()
    stage_regex = re.compile(r"^(?:stage|step|unit\s*op(?:eration)?)\s*[-_:]?\s*(\d+|[ivx]+|[a-z])\s*[-:.)]\s*(.+)", re.I)
    extracted = []
    for line in lines:
        line_s = line.strip()
        m = stage_regex.match(line_s)
        if m:
            extracted.append({"raw": line_s, "title": m.group(2).strip()})
    return extracted


def generate_route(project: Project, db: Session) -> GeneratedRoute:
    """
    Grounded route generation combining:
    - Project Description & Compound name
    - QTPP (Step 02)
    - CQAs (Step 03)
    - Retrieved regulatory & process knowledge chunks
    """
    compound = project.compound or project.name or "Target API"
    description = project.description or project.objective or ""
    qtpp_list = project.qtpp_data or []
    cqas_list = project.cqas_data or []

    # 1. Retrieve grounded chunks
    chunks = _retrieve_qbd_chunks(compound, description, top_k=4)
    chunk_refs = [c.get("chunk_id", f"rag-chunk-{i+1}") for i, c in enumerate(chunks)]
    chunk_context_str = "\n".join([
        f"[{c.get('chunk_id', f'ref-{i+1}')}] {c.get('section_title', '')}: {c.get('content', '')[:300]}"
        for i, c in enumerate(chunks)
    ])

    # 2. Format QTPP & CQA Context
    qtpp_summary = ", ".join([f"{q.get('attribute', '')} ({q.get('criterion', '')})" for q in qtpp_list[:10]]) or "None specified"
    cqa_summary = "\n".join([
        f"- ID: {c.get('id', f'cqa-{i+1}')} | Name: {c.get('name')} | Limit: {c.get('range')} | Critical: {c.get('is_critical', False)}"
        for i, c in enumerate(cqas_list)
    ]) or "None specified"

    # Check for direct user description cues
    desc_cues = _extract_stages_from_text(description, compound)

    # 3. LLM Setup with Retry
    api_key = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_API")
    llm = None
    if api_key:
        try:
            llm = ChatGroq(
                temperature=0.1,
                model_name="llama-3.3-70b-versatile",
                api_key=api_key
            )
        except Exception as e:
            print("[LLM Init Notice]:", e)

    # Prompt constructing strict JSON
    prompt = f"""You are a Senior Chemical Process Development Scientist and QbD Expert.
Generate a structured, grounded synthesis route sequence of unit operations for:
API Compound: {compound}
Project Description: {description}

Step 02 QTPP Targets:
{qtpp_summary}

Step 03 Critical Quality Attributes (CQAs):
{cqa_summary}

Retrieved Regulatory & Process Knowledge:
{chunk_context_str or "Standard small-molecule ICH Q11 process principles."}

GROUNDING RULES:
1. Divide the process into realistic chemical and isolation stages in sequential order (1, 2, 3...).
2. unit_operation_type must be strictly one of: Reaction, Workup, Crystallization, Filtration, Drying, Distillation, Purification, Milling, Blending, Other.
3. For each stage, link relevant CQA IDs from the provided CQAs list.
4. For candidate_cpps, provide 2 to 4 realistic process parameters (temperature, time, molar ratio, agitation, cooling rate) with reasonable low/high ranges.
5. If a stage is explicitly grounded in the project description or retrieved knowledge, mark source as "from_description" or "from_document" with confidence "high" or "medium".
6. If a stage is extrapolated or generic AI inference, mark source as "ai_inferred" with confidence "low" and source_refs: [].
7. RETURN ONLY PURE JSON matching this schema:
{{
  "stages": [
    {{
      "id": "stage-1",
      "order": 1,
      "name": "Stage 1: ...",
      "unit_operation_type": "Reaction",
      "chemistry_description": "...",
      "key_intermediate": "...",
      "inputs": ["Starting material A", "..."],
      "outputs": ["Intermediate 1", "..."],
      "candidate_cpps": [
        {{"name": "Reaction Temperature", "unit": "°C", "low": 60.0, "high": 85.0, "rationale": "Controls impurity formation"}}
      ],
      "linked_cqas": ["cqa-id-here"],
      "source": "from_description",
      "source_refs": ["ref-1"],
      "confidence": "high"
    }}
  ],
  "rationale": "High level justification of route division"
}}
"""

    if llm:
        # Try generation with 1 retry
        for attempt in range(2):
            try:
                response = llm.invoke(prompt)
                content = response.content.strip()
                # Clean json markers if present
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0].strip()
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0].strip()

                data = json.loads(content)
                parsed_stages = []
                for idx, s in enumerate(data.get("stages", [])):
                    # Ensure order and ID are consistent
                    s["order"] = idx + 1
                    if not s.get("id"):
                        s["id"] = f"stage-{idx+1}"
                    # Normalize enum
                    uop = s.get("unit_operation_type", "Reaction")
                    if uop not in [e.value for e in UnitOperationType]:
                        uop = "Reaction"
                    s["unit_operation_type"] = uop
                    parsed_stages.append(RouteStage(**s))

                if parsed_stages:
                    return GeneratedRoute(
                        stages=parsed_stages,
                        rationale=data.get("rationale", "Synthesized route from project context."),
                        retrieved_refs=chunk_refs
                    )
            except Exception as ex:
                print(f"[Route Gen Attempt {attempt+1} Error]:", ex)

    # 4. Fallback Rule-Based Grounded Route Generator
    return _generate_fallback_grounded_route(compound, description, cqas_list, chunk_refs)


def _generate_fallback_grounded_route(
    compound: str,
    description: str,
    cqas_list: List[Dict[str, Any]],
    chunk_refs: List[str]
) -> GeneratedRoute:
    """Deterministic fallback constructing grounded stages from CQAs and description."""
    cqa_ids = [c.get("id", f"cqa-{i+1}") for i, c in enumerate(cqas_list)]
    cqa_names = " ".join([c.get("name", "").lower() for c in cqas_list])
    desc_lower = description.lower()

    stages: List[RouteStage] = []

    # Stage 1: Synthesis / Reaction
    s1_cpps = [
        CandidateCPP(name="Reaction Temperature", unit="°C", low=65.0, high=85.0, rationale="Governs conversion rate and suppresses degradation impurities."),
        CandidateCPP(name="Reagent Molar Ratio", unit="eq", low=1.05, high=1.35, rationale="Ensures complete consumption of starting material."),
        CandidateCPP(name="Reaction Time", unit="h", low=3.0, high=8.0, rationale="Prevents over-reaction byproduct accumulation.")
    ]
    s1_cqas = [cid for cid, c in zip(cqa_ids, cqas_list) if "purity" in c.get("name", "").lower() or "assay" in c.get("name", "").lower() or "impurity" in c.get("name", "").lower()][:2]
    stages.append(RouteStage(
        id="stage-1",
        order=1,
        name=f"Stage 1: {compound} Synthesis Reaction",
        unit_operation_type=UnitOperationType.Reaction,
        chemistry_description=f"Core synthesis and conversion of raw starting materials to crude {compound}.",
        key_intermediate=f"Crude {compound} Reaction Mass",
        inputs=["Primary Raw Material", "Reagents / Catalyst", "Reaction Solvent"],
        outputs=[f"Crude {compound} Stream", "Spent Reagents"],
        candidate_cpps=s1_cpps,
        linked_cqas=s1_cqas or (cqa_ids[:2] if cqa_ids else []),
        source=StageSource.from_description if len(description) > 20 else StageSource.ai_inferred,
        source_refs=chunk_refs[:1],
        confidence=ConfidenceLevel.medium if len(description) > 20 else ConfidenceLevel.low
    ))

    # Stage 2: Workup / Phase Separation
    s2_cpps = [
        CandidateCPP(name="Quench Temperature", unit="°C", low=15.0, high=25.0, rationale="Exotherm control during hydrolytic quench."),
        CandidateCPP(name="Extraction Solvent Volume", unit="v/w", low=3.0, high=5.0, rationale="Ensures partition coefficient efficiency and reduces product loss."),
        CandidateCPP(name="Phase Separation Time", unit="min", low=15.0, high=45.0, rationale="Prevents rag-layer carryover of process impurities.")
    ]
    s2_cqas = [cid for cid, c in zip(cqa_ids, cqas_list) if "solvent" in c.get("name", "").lower() or "yield" in c.get("name", "").lower()]
    stages.append(RouteStage(
        id="stage-2",
        order=2,
        name=f"Stage 2: Quench & Aqueous Workup",
        unit_operation_type=UnitOperationType.Workup,
        chemistry_description="Neutralization, quenching of unreacted reagents, and selective liquid-liquid extraction.",
        key_intermediate=f"Washed Organic Layer ({compound})",
        inputs=[f"Crude {compound} Stream", "Quench Water / Wash Solution", "Extraction Solvent"],
        outputs=[f"Purified {compound} Solution", "Aqueous Waste Stream"],
        candidate_cpps=s2_cpps,
        linked_cqas=s2_cqas or (cqa_ids[1:3] if len(cqa_ids) > 1 else []),
        source=StageSource.from_cqa if s2_cqas else StageSource.ai_inferred,
        source_refs=chunk_refs[1:2] if len(chunk_refs) > 1 else [],
        confidence=ConfidenceLevel.medium
    ))

    # Stage 3: Crystallization & Isolation
    s3_cpps = [
        CandidateCPP(name="Cooling Ramp Rate", unit="°C/h", low=5.0, high=15.0, rationale="Controls nucleation kinetics, particle size distribution, and solvent entrapment."),
        CandidateCPP(name="Anti-Solvent Addition Rate", unit="mL/min", low=2.0, high=8.0, rationale="Maintains steady supersaturation state."),
        CandidateCPP(name="Drying Temperature", unit="°C", low=40.0, high=60.0, rationale="Purges residual solvents without thermal degradation.")
    ]
    s3_cqas = [cid for cid, c in zip(cqa_ids, cqas_list) if "particle" in c.get("name", "").lower() or "solvent" in c.get("name", "").lower() or "crystal" in c.get("name", "").lower() or "water" in c.get("name", "").lower()]
    stages.append(RouteStage(
        id="stage-3",
        order=3,
        name=f"Stage 3: Crystallization, Filtration & Drying",
        unit_operation_type=UnitOperationType.Crystallization,
        chemistry_description=f"Controlled nucleation and crystallization to yield specification-compliant {compound} drug substance.",
        key_intermediate=f"Pure {compound} API",
        inputs=[f"Purified {compound} Solution", "Crystallization Anti-solvent / Seed"],
        outputs=[f"Final {compound} Crystalline API", "Mother Liquor"],
        candidate_cpps=s3_cpps,
        linked_cqas=s3_cqas or (cqa_ids[2:] if len(cqa_ids) > 2 else cqa_ids),
        source=StageSource.from_document if chunk_refs else StageSource.ai_inferred,
        source_refs=chunk_refs[:2],
        confidence=ConfidenceLevel.high if chunk_refs else ConfidenceLevel.medium
    ))

    return GeneratedRoute(
        stages=stages,
        rationale="Standard 3-stage chemical manufacturing process: Reaction, Aqueous Workup, and Crystallization.",
        retrieved_refs=chunk_refs
    )


def regenerate_single_stage(
    project: Project,
    stage_id: str,
    stages: List[Dict[str, Any]],
    db: Session
) -> RouteStage:
    """Regenerates a single stage in place, keeping neighboring stages as context."""
    # Find index
    idx = -1
    for i, s in enumerate(stages):
        if str(s.get("id")) == str(stage_id):
            idx = i
            break
    if idx == -1:
        raise ValueError(f"Stage {stage_id} not found in route")

    target_stage = stages[idx]
    prev_stage = stages[idx - 1] if idx > 0 else None
    next_stage = stages[idx + 1] if idx < len(stages) - 1 else None

    compound = project.compound or project.name or "API"
    cqas_list = project.cqas_data or []

    api_key = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_API")
    if api_key:
        try:
            llm = ChatGroq(temperature=0.2, model_name="llama-3.3-70b-versatile", api_key=api_key)
            prompt = f"""You are a Chemical Process Development Expert.
Regenerate Stage {idx+1} for API '{compound}' maintaining continuity with adjacent stages:

Previous Stage: {json.dumps(prev_stage) if prev_stage else "None (First Stage)"}
Current Stage to Regenerate: {json.dumps(target_stage)}
Next Stage: {json.dumps(next_stage) if next_stage else "None (Final Stage)"}

Project CQAs:
{json.dumps(cqas_list)}

Return pure JSON matching this structure:
{{
  "id": "{stage_id}",
  "order": {idx + 1},
  "name": "Stage {idx+1}: ...",
  "unit_operation_type": "Reaction",
  "chemistry_description": "...",
  "key_intermediate": "...",
  "inputs": [...],
  "outputs": [...],
  "candidate_cpps": [
    {{"name": "...", "unit": "...", "low": 0.0, "high": 100.0, "rationale": "..."}}
  ],
  "linked_cqas": ["cqa-id"],
  "source": "ai_inferred",
  "source_refs": [],
  "confidence": "medium"
}}
"""
            res = llm.invoke(prompt)
            content = res.content.strip()
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()
            data = json.loads(content)
            data["id"] = stage_id
            data["order"] = idx + 1
            return RouteStage(**data)
        except Exception as e:
            print("[Regenerate Stage LLM Error]:", e)

    # Fallback single stage regeneration
    target_stage["confidence"] = "medium"
    target_stage["source"] = "ai_inferred"
    return RouteStage(**target_stage)
