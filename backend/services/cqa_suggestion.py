"""
backend/services/cqa_suggestion.py - Rule-based knowledge base and suggestion engine
for Critical Quality Attribute (CQA) derivation (ICH Q8(R2), Q9, Q3A/B/C/D, M7, Q6A).
"""
import re
from typing import List, Dict, Any, Optional

# ── Knowledge Base Dictionary ──────────────────────────────────────────────
# Comprehensive QbD knowledge base for small molecule APIs & intermediates
CQA_KNOWLEDGE_BASE = [
    {
        "category": "assay",
        "patterns": [r"\bassay\b", r"\bpurity\b", r"\bpotency\b", r"\bcontent\b"],
        "suggested_is_cqa": True,
        "default_impact": 5,
        "default_uncertainty": 3,
        "default_method": "HPLC-UV (254 nm)",
        "default_range": "98.0% - 102.0% w/w",
        "rationale": "Directly determines clinical efficacy, therapeutic dosing accuracy, and batch uniformity.",
        "reference": "ICH Q6A (Specifications: Test Procedures and Acceptance Criteria)",
        "default_applies_to": "Final API"
    },
    {
        "category": "mutagenic_impurity",
        "patterns": [r"\bmutagenic\b", r"\bgenotoxic\b", r"\bm7\b", r"\bnitrosamine\b", r"\balp\b", r"\bndma\b", r"\bndea\b", r"\bepichlorohydrin\b", r"\balkyl halide\b"],
        "suggested_is_cqa": True,
        "default_impact": 5,
        "default_uncertainty": 4,
        "default_method": "LC-MS/MS or GC-MS",
        "default_range": "≤ 1.5 µg/day (TTC threshold) or compound-specific limit",
        "rationale": "High-potency DNA-reactive carcinogen risk requiring strict control at or below toxicological threshold of concern (TTC).",
        "reference": "ICH M7(R2) (Assessment and Control of DNA Reactive (Mutagenic) Impurities)",
        "default_applies_to": "Final API"
    },
    {
        "category": "organic_impurity",
        "patterns": [r"\brelated substance\b", r"\bimpurity\b", r"\bdegradant\b", r"\bdimer\b", r"\bisomer\b", r"\brrt\b", r"\bunspecified impurity\b", r"\btotal impurities\b"],
        "suggested_is_cqa": True,
        "default_impact": 4,
        "default_uncertainty": 3,
        "default_method": "HPLC-UV (254 nm)",
        "default_range": "≤ 0.15% (identified) / ≤ 0.10% (unspecified)",
        "rationale": "Chemical impurities can cause unexpected adverse biological activity, toxicity, or degradation during shelf life.",
        "reference": "ICH Q3A(R2) (Impurities in New Drug Substances)",
        "default_applies_to": "Final API"
    },
    {
        "category": "residual_solvent",
        "patterns": [r"\bresidual solvent\b", r"\bsolvent\b", r"\bheadspace\b", r"\bmethanol\b", r"\bethanol\b", r"\bacetone\b", r"\bdcm\b", r"\bdichloromethane\b", r"\btoluene\b", r"\btfa\b", r"\bthf\b", r"\bdmf\b", r"\bdmso\b", r"\bipa\b", r"\bisopropanol\b"],
        "suggested_is_cqa": True,
        "default_impact": 3,
        "default_uncertainty": 3,
        "default_method": "GC-Headspace (FID)",
        "default_range": "Class 1: avoided | Class 2: ≤ PDE limit (e.g. DCM ≤ 600 ppm, Toluene ≤ 890 ppm) | Class 3: ≤ 5000 ppm",
        "rationale": "Residual solvents carry physiological toxicity risks and must not exceed Permitted Daily Exposure (PDE) limits.",
        "reference": "ICH Q3C(R8) (Impurities: Guideline for Residual Solvents)",
        "default_applies_to": "Final API"
    },
    {
        "category": "elemental_impurity",
        "patterns": [r"\belemental\b", r"\bheavy metal\b", r"\bmetal\b", r"\bpalladium\b", r"\bplatinum\b", r"\bnickel\b", r"\blead\b", r"\barsenic\b", r"\bcadmium\b", r"\bmercury\b", r"\bicp-ms\b", r"\bicp-oes\b"],
        "suggested_is_cqa": True,
        "default_impact": 4,
        "default_uncertainty": 2,
        "default_method": "ICP-MS / ICP-OES",
        "default_range": "Class 1: As ≤ 1.5 ppm, Cd ≤ 0.5 ppm, Hg ≤ 3 ppm, Pb ≤ 0.5 ppm",
        "rationale": "Heavy metal and catalyst residues pose acute and cumulative toxicological risks to patients.",
        "reference": "ICH Q3D(R2) (Guideline for Elemental Impurities)",
        "default_applies_to": "Final API"
    },
    {
        "category": "water_content",
        "patterns": [r"\bwater\b", r"\bmoisture\b", r"\bkarl fischer\b", r"\bkf\b", r"\blod\b", r"\bloss on drying\b"],
        "suggested_is_cqa": True,
        "default_impact": 3,
        "default_uncertainty": 2,
        "default_method": "Karl Fischer Titration",
        "default_range": "≤ 0.50% w/w",
        "rationale": "Excess moisture accelerates hydrolytic chemical degradation and can alter crystal form and flowability.",
        "reference": "ICH Q6A / USP <921>",
        "default_applies_to": "Final API"
    },
    {
        "category": "solid_state",
        "patterns": [r"\bpolymorph\b", r"\bcrystal\b", r"\bxrpd\b", r"\bdsc\b", r"\bparticle size\b", r"\bpsd\b", r"\bd90\b", r"\bd50\b", r"\bd10\b", r"\blaser diffraction\b"],
        "suggested_is_cqa": True,
        "default_impact": 4,
        "default_uncertainty": 3,
        "default_method": "XRPD / Laser Diffraction",
        "default_range": "Conforms to designated polymorphic form; D90 ≤ 50 µm",
        "rationale": "Solid state form and particle size directly govern dissolution rate, bioavailability, and formulation processability.",
        "reference": "ICH Q6A Decision Trees #3 and #4",
        "default_applies_to": "Final API"
    },
    {
        "category": "identity",
        "patterns": [r"\bidentity\b", r"\bidentification\b", r"\bftir\b", r"\bir spectrum\b", r"\bnmr\b"],
        "suggested_is_cqa": False,  # Important for release, but usually 100% binary confirmation, not a variable DoE CQA unless chiral/isomer
        "default_impact": 5,
        "default_uncertainty": 1,
        "default_method": "FTIR Spectrometry & HPLC Retention Time",
        "default_range": "Conforms to Reference Standard",
        "rationale": "Fundamental identity confirmation for batch release; binary attribute verified against reference standard.",
        "reference": "ICH Q6A Specification Guidelines",
        "default_applies_to": "Final API"
    },
    {
        "category": "physical_appearance",
        "patterns": [r"\bappearance\b", r"\bcolor\b", r"\bvisual\b", r"\bodour\b", r"\bodor\b", r"\bclarity\b"],
        "suggested_is_cqa": False,
        "default_impact": 2,
        "default_uncertainty": 1,
        "default_method": "Visual Inspection",
        "default_range": "Clear, colourless to pale yellow liquid / White crystalline powder",
        "rationale": "General organoleptic parameter; low direct clinical harm severity if composition and purity comply.",
        "reference": "Compendial Monograph (USP / Ph. Eur.)",
        "default_applies_to": "Final API"
    }
]

# Standard mandatory/recommended CQAs for Small Molecule APIs (to detect missing CQAs)
STANDARD_API_CQAS = [
    {
        "name": "Assay (Purity)",
        "category": "assay",
        "applies_to": "Final API",
        "default_method": "HPLC-UV (254 nm)",
        "default_range": "98.0% - 102.0% w/w",
        "impact_score": 5,
        "uncertainty_score": 3,
        "rationale": "Directly impacts therapeutic dose delivery and API efficacy per ICH Q6A.",
        "reference": "ICH Q6A (Specifications)",
        "importance": "Mandatory"
    },
    {
        "name": "Specified / Unspecified Organic Impurities",
        "category": "organic_impurity",
        "applies_to": "Final API",
        "default_method": "HPLC-UV (254 nm)",
        "default_range": "Specified ≤ 0.15%, Unspecified ≤ 0.10%, Total ≤ 1.0%",
        "impact_score": 4,
        "uncertainty_score": 3,
        "rationale": "Organic degradation products and process-related impurities pose safety and efficacy risks.",
        "reference": "ICH Q3A(R2)",
        "importance": "Mandatory"
    },
    {
        "name": "Residual Solvents",
        "category": "residual_solvent",
        "applies_to": "Final API",
        "default_method": "GC-Headspace (FID)",
        "default_range": "Conforms to ICH Q3C Option 1 limits",
        "impact_score": 3,
        "uncertainty_score": 3,
        "rationale": "Process solvents used during synthesis/crystallization must be controlled below toxicological PDE limits.",
        "reference": "ICH Q3C(R8)",
        "importance": "Mandatory"
    },
    {
        "name": "Water Content",
        "category": "water_content",
        "applies_to": "Final API",
        "default_method": "Karl Fischer Titration",
        "default_range": "≤ 0.50% w/w",
        "impact_score": 3,
        "uncertainty_score": 2,
        "rationale": "Residual moisture impacts chemical stability, degradation kinetics, and shelf-life.",
        "reference": "ICH Q6A / USP <921>",
        "importance": "Recommended"
    },
    {
        "name": "Elemental Impurities",
        "category": "elemental_impurity",
        "applies_to": "Final API",
        "default_method": "ICP-MS",
        "default_range": "Conforms to ICH Q3D PDE guidelines",
        "impact_score": 4,
        "uncertainty_score": 2,
        "rationale": "Metallic catalysts and heavy metal contaminants require toxicological control.",
        "reference": "ICH Q3D(R2)",
        "importance": "Recommended"
    }
]


def classify_attribute(name: str, type_str: str = "", criterion: str = "") -> Dict[str, Any]:
    """
    Rule-based classifier evaluating QTPP attribute against ICH knowledge base.
    """
    text_to_search = f"{name} {type_str} {criterion}".lower()

    for rule in CQA_KNOWLEDGE_BASE:
        for pat in rule["patterns"]:
            if re.search(pat, text_to_search):
                impact = rule["default_impact"]
                uncertainty = rule["default_uncertainty"]
                criticality = impact * uncertainty
                is_crit = criticality >= 12 and rule["suggested_is_cqa"]
                return {
                    "matched_category": rule["category"],
                    "suggested_is_cqa": rule["suggested_is_cqa"],
                    "suggested_impact": impact,
                    "suggested_uncertainty": uncertainty,
                    "suggested_criticality": criticality,
                    "is_critical": is_crit,
                    "suggested_method": rule["default_method"],
                    "suggested_range": rule["default_range"],
                    "rationale": rule["rationale"],
                    "reference": rule["reference"],
                    "applies_to": rule["default_applies_to"]
                }

    # Default fallback for unrecognized attributes
    return {
        "matched_category": "general",
        "suggested_is_cqa": True,
        "suggested_impact": 3,
        "suggested_uncertainty": 3,
        "suggested_criticality": 9,
        "is_critical": False,
        "suggested_method": "HPLC-UV (254 nm)",
        "suggested_range": criterion or "N/A",
        "rationale": "Quality attribute required to satisfy drug substance specification profile.",
        "reference": "ICH Q6A / Internal Specification",
        "applies_to": "Final API"
    }


def find_missing_cqas(existing_cqas: List[Dict[str, Any]], qtpp_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Identifies standard compendial/ICH CQAs that are absent from both the project's
    existing CQA list and QTPP attributes.
    """
    all_names = " ".join([c.get("name", "").lower() for c in existing_cqas] + [q.get("attribute", "").lower() for q in qtpp_items])

    missing = []
    for std in STANDARD_API_CQAS:
        # Check if patterns for this standard are found in existing names
        found = False
        for rule in CQA_KNOWLEDGE_BASE:
            if rule["category"] == std["category"]:
                for pat in rule["patterns"]:
                    if re.search(pat, all_names):
                        found = True
                        break
                if found:
                    break

        if not found:
            impact = std["impact_score"]
            uncertainty = std["uncertainty_score"]
            criticality = impact * uncertainty
            missing.append({
                "name": std["name"],
                "category": std["category"],
                "appliesTo": std["applies_to"],
                "method": std["default_method"],
                "range": std["default_range"],
                "impact_score": impact,
                "uncertainty_score": uncertainty,
                "criticality_score": criticality,
                "is_critical": criticality >= 12,
                "rationale": std["rationale"],
                "reference": std["reference"],
                "importance": std["importance"],
                "origin": "suggested"
            })

    return missing


def validate_cqa_list(cqas: List[Dict[str, Any]], qtpp_items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Validates CQA entries against ICH consistency rules, compendial thresholds,
    and method sensitivity requirements.
    Returns:
      - valid: bool
      - errors: List[str] (blocking problems, e.g. empty mandatory fields)
      - warnings: List[Dict[str, str]] (non-blocking QbD guidance warnings)
    """
    errors = []
    warnings = []
    seen_rationales = {}

    for idx, cqa in enumerate(cqas):
        name = cqa.get("name", "").strip()
        cqa_id = cqa.get("id", f"cqa-{idx+1}")
        impact = cqa.get("impact_score", 3)
        uncertainty = cqa.get("uncertainty_score", 3)
        rationale = cqa.get("rationale", "").strip() or cqa.get("justification", "").strip()
        ref = cqa.get("reference", "").strip()
        method = cqa.get("method", "").strip().lower()
        acceptable_range = cqa.get("range", "").strip().lower()

        # 1. Mandatory Fields when CQA is designated
        if not name:
            errors.append(f"CQA #{idx+1} is missing a name.")
            continue

        if not rationale:
            errors.append(f"CQA '{name}': Rationale is mandatory for active CQAs.")

        if not (1 <= impact <= 5 and 1 <= uncertainty <= 5):
            errors.append(f"CQA '{name}': Impact and Uncertainty scores must be integers between 1 and 5.")

        # 2. Duplicate rationale check across different CQAs
        if rationale and len(rationale) > 15:
            if rationale in seen_rationales:
                warnings.append({
                    "cqa_id": cqa_id,
                    "cqa_name": name,
                    "type": "duplicate_rationale",
                    "message": f"CQA '{name}' shares an identical rationale text with '{seen_rationales[rationale]}'. Provide attribute-specific risk rationale."
                })
            else:
                seen_rationales[rationale] = name

        # 3. Compendial threshold checks (ICH Q3A unspecified impurity > 0.10%)
        if "unspecified" in name.lower() or "unspecified" in acceptable_range:
            # Check for numbers like 0.15, 0.2, etc.
            match = re.search(r"(\d+(?:\.\d+)?)\s*%", acceptable_range)
            if match:
                val = float(match.group(1))
                if val > 0.10:
                    warnings.append({
                        "cqa_id": cqa_id,
                        "cqa_name": name,
                        "type": "ich_threshold_exceeded",
                        "message": f"CQA '{name}' limit of {val}% exceeds standard ICH Q3A qualification/identification threshold of ≤ 0.10% for unspecified impurities."
                    })

        # 4. Method vs Attribute Sensitivity Check (Trace level <= 0.05% with unsensitive method)
        if any(keyword in name.lower() for keyword in ["mutagenic", "nitrosamine", "ndma", "trace", "heavy metal"]):
            if "hplc-uv" in method and "ms" not in method:
                warnings.append({
                    "cqa_id": cqa_id,
                    "cqa_name": name,
                    "type": "method_sensitivity",
                    "message": f"CQA '{name}' involves trace/ppm-level limits, but method '{cqa.get('method')}' (HPLC-UV) may lack sufficient sensitivity (LOQ). Consider LC-MS/MS or ICP-MS."
                })

        # 5. Method vs QTPP discrepancy check (e.g. QTPP mentions GC but method is HPLC only)
        for q in qtpp_items:
            if q.get("id") in cqa.get("linkedQtppIds", []) or q.get("attribute", "").lower() == name.lower():
                q_text = f"{q.get('attribute', '')} {q.get('criterion', '')}".lower()
                if "gc" in q_text and "hplc" not in q_text and "gc" not in method:
                    warnings.append({
                        "cqa_id": cqa_id,
                        "cqa_name": name,
                        "type": "method_discrepancy",
                        "message": f"QTPP attribute specifies GC analysis, but measurement method is '{cqa.get('method')}'. Verify analytical technique alignment."
                    })

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings
    }

