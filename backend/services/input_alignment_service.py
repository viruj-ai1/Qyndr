"""
backend/services/input_alignment_service.py
Service for auto-aligning user rough data/notes to QbD project creation templates.
Strictly extracts from user data without hallucinating unsupported parameters or values.
"""

import json
import logging
import os
import re
import time
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from langchain_core.messages import SystemMessage, HumanMessage
from services.llm_service import ChatGroq

logger = logging.getLogger("input_alignment_service")

# 20,000 character maximum for input text
MAX_RAW_TEXT_LEN = 20000

SYSTEM_ALIGNMENT_PROMPT = """You are an expert Pharmaceutical QbD (Quality by Design) Chemist Assistant.
Your task is to extract and align information from unstructured user-provided notes, batch records, spec sheets, or descriptions into standardized project template fields.

=== HARD CONSTRAINTS ===
1. Use ONLY information directly present or clearly stated in the user's data. NEVER invent, hallucinate, extrapolate, or guess numbers, ranges, limits, compound names, or process steps.
2. If a required template element or placeholder has NO support in the user's data, you MUST write "[Not provided]" for that item and record its name in the "missing" list for that field.
3. Normalize units and symbols according to standard scientific notation (e.g., "deg C" or "degree C" -> "°C", "percent" or "pct" -> "%", "liters per kg" -> "L/kg", "hr" or "hours" -> "h", "equivalents" -> "eq").
4. Preserve numerical values, decimal places, and inequality operators (>=, <=, >, <) exactly as provided.
5. Output strict valid JSON matching the requested schema. No markdown wrapping or conversational commentary.

=== TEMPLATE SPECIFICATIONS & RULES PER FIELD ===

1. project_name:
   - Format: "<Compound> <Stage/Step> <Purpose>"
   - Length: MUST be under 80 characters.
   - Purpose must be one of: "Process Optimization", "Robustness Study", "Scale-up", or "Screening" where applicable. If purpose cannot be inferred, use "Process Optimization".
   - Do NOT include operator initials, internal notebook codes, or timestamps/dates.
   - Example format: "Rocuronium Bromide Stage-I Process Optimization"
   - If compound or stage is missing, use "[Not provided]".

2. compound_api:
   - Official INN, USAN, or compendial monograph name plus exact salt form if mentioned (e.g. "Rocuronium Bromide", "Atorvastatin Calcium").
   - Do NOT include stage numbers, step names, or purpose here.
   - If not found, write "[Not provided]".

3. primary_objective:
   - Target format: "[Maximize/Minimize] [response 1] (target [≥/≤ value] [unit]) and [response 2] (target [≥/≤ value] [unit]) while keeping [attribute] [≤ limit] and [residual/other] [≤ limit]"
   - List primary objectives first (e.g. Maximize Yield, Maximize Purity), followed by constraints after "while keeping".
   - Every quantified response must have an explicit numeric threshold and unit.
   - If a target or limit is not in the data, write "[Not provided]".

4. project_description:
   - Output EXACTLY these 3 section headers in order:
Process overview:
<Short, factual sentences on reaction/transformation, scale, solvent, reagents from data, or [Not provided]>

Goal / acceptance criteria:
<Target specifications, yield, purity, impurity limits from data, or [Not provided]>

Critical Process Parameters (CPPs) to study:
<List each candidate CPP on its own line strictly in format: "Parameter - unit - min to max range - current setpoint">
(If range or setpoint is not provided, use "[Not provided]", e.g. "Reaction Temperature - °C - 45 to 65 °C - setpoint [Not provided]". If no CPPs are in data, write "[Not provided]").
"""

def _get_groq_llm() -> ChatGroq:
    """Initialize ChatGroq using standard project env vars."""
    api_key = os.getenv("GROQ_API_KEY") or os.getenv("GROQ_API")
    return ChatGroq(
        temperature=0.1,
        model_name="llama-3.3-70b-versatile",
        api_key=api_key if api_key else "dummy_key",
        max_retries=2
    )

def _clean_json_text(text: str) -> str:
    """Strip markdown code blocks if present."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()

def _post_process_aligned(
    field: str,
    aligned: Dict[str, str],
    missing: Dict[str, List[str]],
    warnings: List[str]
) -> None:
    """Apply deterministic post-processing, validation, and normalization."""
    # 1. Project Name: enforce length warning and formatting
    if "project_name" in aligned and aligned["project_name"]:
        p_name = aligned["project_name"].strip()
        # Clean any trailing punctuation or extra whitespace
        p_name = re.sub(r"\s+", " ", p_name)
        aligned["project_name"] = p_name
        if len(p_name) > 80:
            warnings.append(f"Project Name is {len(p_name)} characters (recommended under 80 characters).")

    # 2. Compound / API
    if "compound_api" in aligned and aligned["compound_api"]:
        c_api = aligned["compound_api"].strip()
        c_api = re.sub(r"\s+", " ", c_api)
        aligned["compound_api"] = c_api

    # 3. Primary Objective
    if "primary_objective" in aligned and aligned["primary_objective"]:
        obj = aligned["primary_objective"].strip()
        obj = re.sub(r"\s+", " ", obj)
        aligned["primary_objective"] = obj

    # 4. Project Description: ensure all three mandatory section headers exist in order
    if "project_description" in aligned and aligned["project_description"]:
        desc = aligned["project_description"].strip()
        h1 = "Process overview:"
        h2 = "Goal / acceptance criteria:"
        h3 = "Critical Process Parameters (CPPs) to study:"

        # Verify headers exist
        sections = [
            (h1, "[Not provided]"),
            (h2, "[Not provided]"),
            (h3, "[Not provided]")
        ]

        normalized_desc = desc
        for header, default_val in sections:
            if header.lower() not in normalized_desc.lower():
                warnings.append(f"Header '{header}' was missing and has been added.")
                normalized_desc = f"{normalized_desc}\n\n{header}\n{default_val}"

        aligned["project_description"] = normalized_desc.strip()

    # Ensure missing list has unique elements
    for k in list(missing.keys()):
        missing[k] = sorted(list(set(missing[k])))

def align_project_input(
    field: str,
    raw_text: str,
    llm_client: Optional[Any] = None
) -> Dict[str, Any]:
    """
    Auto-align user raw text to project templates.
    field: 'project_name' | 'compound_api' | 'primary_objective' | 'project_description' | 'all'
    """
    start_time = time.time()
    raw_text = (raw_text or "").strip()
    text_len = len(raw_text)

    # Log operational metrics without logging proprietary text
    logger.info("Aligning input field='%s', input_length=%d chars", field, text_len)

    if not raw_text:
        return {
            "aligned": {
                f: "[Not provided]" for f in (
                    ["project_name", "compound_api", "primary_objective", "project_description"]
                    if field == "all" else [field]
                )
            },
            "missing": {
                f: ["All details"] for f in (
                    ["project_name", "compound_api", "primary_objective", "project_description"]
                    if field == "all" else [field]
                )
            },
            "warnings": ["No raw input text provided."]
        }

    fields_to_align = (
        ["project_name", "compound_api", "primary_objective", "project_description"]
        if field == "all" else [field]
    )

    human_prompt = f"""Target Field(s) to Align: {field} ({', '.join(fields_to_align)})

User Raw Input Data:
\"\"\"{raw_text}\"\"\"

Return a valid JSON object matching this schema:
{{
  "aligned": {{
    {', '.join([f'"{f}": "<string>"' for f in fields_to_align])}
  }},
  "missing": {{
    {', '.join([f'"{f}": ["<list of missing elements/placeholders>"]' for f in fields_to_align])}
  }},
  "warnings": ["<optional warning strings>"]
}}
"""

    messages = [
        SystemMessage(content=SYSTEM_ALIGNMENT_PROMPT),
        HumanMessage(content=human_prompt)
    ]

    llm = llm_client if llm_client is not None else _get_groq_llm()

    raw_response_content = ""
    parsed_json = None
    last_err = None

    # Try LLM call with retry once on invalid JSON
    for attempt in range(2):
        try:
            resp = llm.invoke(messages)
            raw_response_content = getattr(resp, "content", str(resp))
            cleaned = _clean_json_text(raw_response_content)
            parsed_json = json.loads(cleaned)
            break
        except Exception as e:
            last_err = e
            logger.warning("JSON parse or LLM invocation attempt %d failed: %s", attempt + 1, str(e))
            if attempt == 0:
                # Add strict formatting nudge for retry
                messages.append(HumanMessage(content="Your previous response was not valid JSON. Please respond ONLY with the valid JSON object requested, with no extra characters."))

    latency_ms = int((time.time() - start_time) * 1000)
    logger.info("Alignment finished for field='%s', latency=%dms", field, latency_ms)

    if parsed_json is None or not isinstance(parsed_json, dict):
        raise ValueError(f"Failed to generate valid alignment JSON after 2 attempts: {str(last_err)}")

    aligned = parsed_json.get("aligned", {})
    missing = parsed_json.get("missing", {})
    warnings = parsed_json.get("warnings", []) or []

    # Filter to only the requested field(s)
    filtered_aligned = {k: aligned.get(k, "[Not provided]") for k in fields_to_align}
    filtered_missing = {k: missing.get(k, []) for k in fields_to_align}

    # Ensure missing placeholders are flagged if '[Not provided]' appears in value
    for k, val in filtered_aligned.items():
        if "[Not provided]" in val and not filtered_missing.get(k):
            filtered_missing[k] = [f"Unspecified {k.replace('_', ' ')} parameters"]

    # Post-process
    _post_process_aligned(field, filtered_aligned, filtered_missing, warnings)

    return {
        "aligned": filtered_aligned,
        "missing": filtered_missing,
        "warnings": warnings
    }
