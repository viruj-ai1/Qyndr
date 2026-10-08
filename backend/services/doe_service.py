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


def recommend_designs(k: int, phase: str, has_htc: bool = False, constraints: list = None, factors: list = None) -> List[Dict[str, Any]]:
    """Return a list of recommended DOE options for k factors, phase, constraints, and factor types."""
    options = []
    
    # Check if mixture design (e.g. factors sum to 100% or solvent formulation)
    is_mixture = any('solvent' in getattr(f, 'name', '').lower() or 'ratio' in getattr(f, 'name', '').lower() for f in (factors or []))

    if is_mixture:
        mix = simplex_centroid(k)
        options.append({"key": "MIXTURE", "label": "Simplex Centroid (Mixture)", "recommended": True, **mix})

    if has_htc:
        sp = generate_split_plot(k, factors)
        options.append({"key": "SPLIT_PLOT", "label": "Split-Plot Design (HTC Factors)", "recommended": True, **sp})

    if constraints and len(constraints) > 0:
        d_opt = generate_d_optimal(k, factors, constraints, quick_preview=True)
        options.append({"key": "D_OPTIMAL", "label": "D-Optimal / Custom (Constrained)", "recommended": True, **d_opt})

    if phase == "screening":
        # Definitive Screening Design (DSD) - 3 level screening for k >= 3
        if k >= 3:
            dsd = generate_dsd(k)
            options.append({"key": "DSD", "label": "Definitive Screening Design (DSD)", "recommended": (k >= 4 and not constraints and not has_htc), **dsd})

        if k <= 3:
            d = get_fractional_design(k)
            options.append({"key": "FF", "label": "Full Factorial", "recommended": (not constraints and not has_htc), **d})
        else:
            ff = get_fractional_design(k, prefer_small=False)
            options.append({"key": "FF", "label": "Fractional Factorial", "recommended": (k <= 7 and not constraints and not has_htc and not is_mixture), **ff})
            if k >= 5:
                ffs = get_fractional_design(k, prefer_small=True)
                if ffs["n_runs"] < ff["n_runs"]:
                    options.append({"key": "FF_S", "label": "Fract. Factorial (Smaller)", "recommended": False, **ffs})
        pb = plackett_burman(k)
        options.append({"key": "PB",      "label": "Plackett-Burman", "recommended": (k >= 8 and not constraints),  **pb})
        tg = taguchi(k)
        options.append({"key": "TAGUCHI", "label": "Taguchi L-Array", "recommended": False, **tg})
    else:
        # Optimization phase
        ccd_fc  = central_composite(min(k, 6), face_centered=True)
        ccd_rot = central_composite(min(k, 6), face_centered=False)
        options.append({"key": "CCD_FC",  "label": "CCD Face-Centered", "recommended": (not constraints and not has_htc and not is_mixture), **ccd_fc})
        options.append({"key": "CCD_ROT", "label": "CCD Rotatable",     "recommended": False, **ccd_rot})
        if 3 <= k <= 7:
            bb = box_behnken(k)
            options.append({"key": "BBD", "label": "Box-Behnken",     "recommended": False, **bb})

    # D-Optimal option if not added yet
    if not any(o["key"] == "D_OPTIMAL" for o in options):
        d_opt = generate_d_optimal(k, factors, constraints, quick_preview=True)
        options.append({"key": "D_OPTIMAL", "label": "D-Optimal / Custom Design", "recommended": False, **d_opt})

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

