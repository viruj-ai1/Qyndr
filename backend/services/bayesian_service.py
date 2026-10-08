# ============================================================
#  services/bayesian_service.py  –  GP + Bayesian Business Logic
# ============================================================
from typing import Optional, Dict, Any, List
import json
from ml.gaussian_process import build_gp_model, gp_1d_slice
from ml.acquisition import find_next_experiment, ei_surface


def _clean_val(val):
    if val is None:
        return None
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return None
    return val


def _extract_response_val(rv, idx):
    if rv is None:
        return None
    if isinstance(rv, list):
        if len(rv) == 0:
            return None
        if idx < len(rv):
            return rv[idx]
        return rv[-1]
    try:
        return float(rv)
    except Exception:
        return None


def fit_and_recommend(experiments: list, response_idx: int,
                       factors: list, acquisition: str = "EI") -> Dict[str, Any]:
    """
    Fit GP model and return Bayesian recommendation.
    Returns full payload for the frontend.
    """
    # Convert ORM objects to plain dicts
    exp_dicts = []
    for e in experiments:
        av = getattr(e, "actual_values", None) if not isinstance(e, dict) else e.get("actual_values")
        rv = getattr(e, "result_values", None) if not isinstance(e, dict) else e.get("result_values")
        av = _clean_val(av)
        rv = _clean_val(rv)
        exp_dicts.append({
            "actual_values": list(av) if av is not None else [],
            "result_values": list(rv) if rv is not None else None
        })

    factor_dicts = []
    for f in factors:
        factor_dicts.append({
            "name": f.name if hasattr(f, "name") else f["name"],
            "unit": f.unit if hasattr(f, "unit") else f.get("unit", ""),
            "low":  f.low  if hasattr(f, "low")  else f["low"],
            "high": f.high if hasattr(f, "high") else f["high"]
        })

    gp_bundle = build_gp_model(exp_dicts, response_idx, factor_dicts)
    if gp_bundle is None:
        return {"error": "Not enough data to fit GP model (need ≥3 completed runs with results)"}

    recommendation = find_next_experiment(gp_bundle, factor_dicts, acquisition=acquisition)
    if recommendation is None:
        return {"error": "Optimization search failed"}

    # 1D slices for each factor
    slices = []
    for idx in range(len(factor_dicts)):
        slices.append(gp_1d_slice(gp_bundle, idx, n_grid=40))

    # 2D EI surface for first two factors
    surface = None
    if len(factor_dicts) >= 2:
        try:
            surface = ei_surface(gp_bundle, factor_dicts, 0, 1, n_grid=18)
        except Exception:
            pass

    return {
        "gp_summary": {
            "n_obs":         gp_bundle["n_obs"],
            "y_best":        gp_bundle["y_best"],
            "y_mean":        gp_bundle["y_mean"],
            "kernel_params": gp_bundle["kernel_params"],
            "log_likelihood":gp_bundle["log_likelihood"]
        },
        "recommendation": recommendation,
        "slices":         slices,
        "surface":        surface,
        "factors":        factor_dicts
    }


def get_final_optimum(experiments: list, response_idx: int,
                       factors: list) -> Dict[str, Any]:
    """Find the final global optimum from GP model."""
    exp_dicts = []
    for e in experiments:
        av = getattr(e, "actual_values", None) if not isinstance(e, dict) else e.get("actual_values")
        rv = getattr(e, "result_values", None) if not isinstance(e, dict) else e.get("result_values")
        av = _clean_val(av)
        rv = _clean_val(rv)
        exp_dicts.append({
            "actual_values": list(av) if av is not None else [],
            "result_values": list(rv) if rv is not None else None
        })

    factor_dicts = []
    for f in factors:
        factor_dicts.append({
            "name": f.name if hasattr(f, "name") else f["name"],
            "unit": f.unit if hasattr(f, "unit") else f.get("unit", ""),
            "low":  f.low  if hasattr(f, "low")  else f["low"],
            "high": f.high if hasattr(f, "high") else f["high"]
        })

    gp_bundle = build_gp_model(exp_dicts, response_idx, factor_dicts)
    if gp_bundle is None:
        return {"error": "Not enough data"}

    # Find global max of GP posterior mean (use UCB with kappa=0 → pure exploitation)
    from ml.acquisition import find_next_experiment as _find
    opt = _find(gp_bundle, factor_dicts, acquisition="UCB", n_grid=20, xi=0.0)

    # Best observed
    y_vals = [
        _extract_response_val(e["result_values"], response_idx)
        for e in exp_dicts
        if e["result_values"] is not None
    ]
    y_vals = [y for y in y_vals if y is not None]
    best_obs_val = max(y_vals) if y_vals else None
    best_obs_run = next(
        (i + 1 for i, e in enumerate(exp_dicts)
         if e["result_values"] is not None and (
             _extract_response_val(e["result_values"], response_idx) == best_obs_val
         )), None
    )

    initial_val = y_vals[0] if y_vals else None
    improvement = (
        round(((best_obs_val - initial_val) / abs(initial_val)) * 100, 1)
        if initial_val and initial_val != 0 else 0.0
    )

    return {
        "final_optimum":  opt,
        "best_observed":  {"value": best_obs_val, "run_number": best_obs_run},
        "initial_value":  initial_val,
        "improvement_pct": improvement,
        "n_obs":          gp_bundle["n_obs"],
        "gp_log_likelihood": gp_bundle["log_likelihood"]
    }
