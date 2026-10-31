# ============================================================
#  services/doe_service.py  –  DOE Business Logic
# ============================================================
import numpy as np
from typing import List, Dict, Any, Optional
from doe.factorial       import full_factorial_2level
from doe.fractional      import get_fractional_design
from doe.plackett_burman import plackett_burman
from doe.ccd             import central_composite
from doe.box_behnken     import box_behnken
from doe.taguchi         import taguchi
from doe.mixture         import simplex_centroid
from doe.dsd             import generate_dsd
from doe.d_optimal       import generate_d_optimal
from doe.split_plot      import generate_split_plot
try:
    from statistics.design_evaluation import evaluate_design
except (ImportError, AttributeError):
    import importlib.util, os
    spec = importlib.util.spec_from_file_location("design_eval", os.path.join(os.path.dirname(__file__), "..", "statistics", "design_evaluation.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    evaluate_design = m.evaluate_design


DESIGN_REGISTRY: Dict[str, dict] = {}


def _decode_actual(coded_row: List[float], factors: list) -> List[float]:
    """Convert coded (±1) to actual factor values."""
    actual = []
    for j, c in enumerate(coded_row):
        f      = factors[j]
        flow   = f.low if hasattr(f, 'low') else f.get('low', -1)
        fhigh  = f.high if hasattr(f, 'high') else f.get('high', 1)
        center = (fhigh + flow) / 2
        half   = (fhigh - flow) / 2
        actual.append(round(center + c * half, 4))
    return actual


import re

PROCESS_KEYWORDS = {'temp', 'temperature', 'ph', 'time', 'pressure', 'rpm', 'stir', 'speed', 'flow', 'rate', 'vol', 'volume'}
PROCESS_UNITS = {'°c', '°f', 'k', 'ph', 'rpm', 'bar', 'psi', 'min', 'h', 'hr', 'hours', 'sec', 'ml/min', 'l/h'}


def _is_process_factor(f: Any) -> bool:
    """Detect if a factor is a continuous process parameter."""
    fname = (getattr(f, 'name', None) or (f.get('name') if isinstance(f, dict) else '') or '').lower()
    funit = (getattr(f, 'unit', None) or (f.get('unit') if isinstance(f, dict) else '') or '').lower().strip()

    clean_unit = funit.strip('()[]{} ')
    words = set(re.findall(r'[a-zA-Z0-9°/]+', fname))
    unit_words = set(re.findall(r'[a-zA-Z0-9°/]+', clean_unit))

    # 1. Check PROCESS_UNITS
    for pu in PROCESS_UNITS:
        if len(pu) == 1:
            if clean_unit == pu or pu in unit_words:
                return True
        else:
            if pu in clean_unit or pu in unit_words or pu in fname:
                return True

    # 2. Check PROCESS_KEYWORDS
    for kw in PROCESS_KEYWORDS:
        if kw in ('ph', 'vol', 'rate', 'rpm'):
            if kw in words or kw in unit_words or kw in clean_unit:
                return True
            if f"_{kw}" in fname or f"-{kw}" in fname or f" {kw}" in fname or f"{kw} " in fname:
                return True
        else:
            if kw in fname or kw in clean_unit:
                return True

    return False


def _is_formulation_component(f: Any) -> bool:
    """Detect if a factor represents a formulation fraction or component."""
    fname = (getattr(f, 'name', None) or (f.get('name') if isinstance(f, dict) else '') or '').lower()
    funit = (getattr(f, 'unit', None) or (f.get('unit') if isinstance(f, dict) else '') or '').lower().strip()
    clean_unit = funit.strip('()[]{} ')

    if clean_unit in {'%', 'wt%', 'vol%', 'fraction', 'w/w', 'v/v', 'wt/wt', 'vol/vol', 'mol%', 'mole_fraction'}:
        return True
    if any(u in clean_unit for u in ('wt%', 'vol%', 'fraction')):
        return True
    if any(u in fname for u in ('wt%', 'vol%', 'fraction', 'proportion', 'component', 'ingredient')):
        return True
    return False


def recommend_designs(k: int, phase: str, has_htc: bool = False, constraints: list = None, factors: list = None) -> List[Dict[str, Any]]:
    """Return a list of recommended DOE options for k factors, phase, constraints, and factor types."""
    options = []
    factors_list = factors or []

    # 1. Process vs Mixture Factor Detection
    has_process_param = any(_is_process_factor(f) for f in factors_list)
    comp_count = sum(1 for f in factors_list if _is_formulation_component(f))

    # Never classify as pure mixture if any continuous process parameter is present.
    # Only flag is_mixture if no process parameters and all (or at least 3) factors represent components/fractions.
    if has_process_param:
        is_mixture = False
    else:
        is_mixture = len(factors_list) >= 3 and (comp_count == len(factors_list) or comp_count >= 3)

    has_constraints = bool(constraints and len(constraints) > 0)
    is_standard = not has_constraints and not has_htc and not is_mixture

    # Special design handling: Mixture, Split-Plot, Constrained D-Optimal
    if is_mixture:
        mix = simplex_centroid(k)
        options.append({"key": "MIXTURE", "label": "Simplex Centroid (Mixture)", "recommended": True, **mix})

    if has_htc:
        sp = generate_split_plot(k, factors)
        options.append({"key": "SPLIT_PLOT", "label": "Split-Plot Design (HTC Factors)", "recommended": True, **sp})

    if has_constraints:
        d_opt = generate_d_optimal(k, factors, constraints, quick_preview=True)
        options.append({"key": "D_OPTIMAL", "label": "D-Optimal / Custom (Constrained)", "recommended": True, **d_opt})

    if phase == "screening":
        # Definitive Screening Design (DSD) - 3 level screening for k >= 3
        if k >= 3:
            dsd = generate_dsd(k)
            # Recommend DSD for k >= 4
            options.append({
                "key": "DSD",
                "label": "Definitive Screening Design (DSD)",
                "recommended": (k >= 4 and is_standard),
                **dsd
            })

        # Factorial / Fractional Factorial
        if k <= 3:
            d = get_fractional_design(k)
            options.append({
                "key": "FF",
                "label": "Full Factorial",
                "recommended": is_standard,
                **d
            })
        else:
            ff = get_fractional_design(k, prefer_small=False)
            options.append({
                "key": "FF",
                "label": "Fractional Factorial",
                "recommended": (4 <= k <= 7 and is_standard),
                **ff
            })
            if k >= 5:
                ffs = get_fractional_design(k, prefer_small=True)
                if ffs["n_runs"] < ff["n_runs"]:
                    options.append({
                        "key": "FF_S",
                        "label": "Fract. Factorial (Smaller)",
                        "recommended": False,
                        **ffs
                    })

        # Plackett-Burman (PB)
        pb = plackett_burman(k)
        options.append({
            "key": "PB",
            "label": "Plackett-Burman",
            "recommended": (k >= 8 and is_standard),
            **pb
        })

        # Taguchi
        tg = taguchi(k)
        options.append({"key": "TAGUCHI", "label": "Taguchi L-Array", "recommended": False, **tg})

    else:
        # Optimization phase
        # Box-Behnken (BBD) for 3 <= k <= 7 (15 runs for k=3)
        if 3 <= k <= 7:
            bb = box_behnken(k)
            options.append({
                "key": "BBD",
                "label": "Box-Behnken",
                "recommended": (3 <= k <= 5 and is_standard),
                **bb
            })

        # Face-Centered CCD
        ccd_fc = central_composite(min(k, 6), face_centered=True)
        options.append({
            "key": "CCD_FC",
            "label": "CCD Face-Centered",
            "recommended": is_standard,
            **ccd_fc
        })

        # Rotatable CCD
        ccd_rot = central_composite(min(k, 6), face_centered=False)
        options.append({
            "key": "CCD_ROT",
            "label": "CCD Rotatable",
            "recommended": False,
            **ccd_rot
        })

    # D-Optimal option if not added yet
    if not any(o["key"] == "D_OPTIMAL" for o in options):
        d_opt = generate_d_optimal(k, factors, constraints, quick_preview=True)
        rec_dopt = bool(phase == "optimization" and k >= 6 and is_standard)
        options.append({
            "key": "D_OPTIMAL",
            "label": "D-Optimal / Custom Design",
            "recommended": rec_dopt,
            **d_opt
        })

    # Attach total runs
    for o in options:
        if "n_runs" not in o:
            o["n_runs"] = len(o.get("matrix", []))

    return options


def generate_design(design_key: str, factors: list, phase: str, constraints: list = None) -> Dict[str, Any]:
    """Generate and decode an experiment design."""
    k = len(factors)
    design_map = {
        "FF":         lambda: get_fractional_design(k, prefer_small=False),
        "FF_S":       lambda: get_fractional_design(k, prefer_small=True),
        "PB":         lambda: plackett_burman(k),
        "TAGUCHI":    lambda: taguchi(k),
        "CCD_FC":     lambda: central_composite(min(k, 6), face_centered=True),
        "CCD_ROT":    lambda: central_composite(min(k, 6), face_centered=False),
        "BBD":        lambda: box_behnken(k),
        "MIXTURE":    lambda: simplex_centroid(k),
        "DSD":        lambda: generate_dsd(k),
        "D_OPTIMAL":  lambda: generate_d_optimal(k, factors, constraints),
        "SPLIT_PLOT": lambda: generate_split_plot(k, factors),
    }
    if design_key not in design_map:
        design_key = "FF" if phase == "screening" else "CCD_FC"
    info = design_map[design_key]()

    matrix     = info["matrix"]
    run_types  = info.get("run_types", ["Factorial"] * len(matrix))
    experiments = []

    for i, (coded_row, rtype) in enumerate(zip(matrix, run_types)):
        actual_row = _decode_actual(coded_row, factors)
        experiments.append({
            "run_number":   i + 1,
            "run_type":     rtype,
            "coded_values": [round(float(c), 4) for c in coded_row],
            "actual_values": actual_row,
            "iteration":    0
        })

    return {
        "design_info": {
            "design_type": info["design_type"],
            "resolution":  info.get("resolution", ""),
            "description": info.get("description", ""),
            "n_runs":      len(experiments),
            "n_factorial": info.get("n_factorial", len(experiments)),
            "n_axial":     info.get("n_axial", 0),
            "n_center":    info.get("n_center", 0),
            "alpha":       info.get("alpha")
        },
        "experiments": experiments
    }


def evaluate_design_service(design_key: str, factors: list, phase: str, constraints: list = None) -> Dict[str, Any]:
    """Run pre-run evaluation (Alias, VIF, Power, FDS) for a prospective design."""
    gen_result = generate_design(design_key, factors, phase, constraints)
    matrix = np.array([e["coded_values"] for e in gen_result["experiments"]])
    eval_diagnostics = evaluate_design(matrix, factors)
    eval_diagnostics["design_info"] = gen_result["design_info"]
    return eval_diagnostics

