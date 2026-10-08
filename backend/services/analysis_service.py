# ============================================================
#  services/analysis_service.py  –  Analysis Business Logic
# ============================================================
import numpy as np
from typing import List, Dict, Any, Optional
from statistics.anova       import anova_2level
from statistics.regression  import rsm_regression, contour_grid, calculate_overlay_plot, run_monte_carlo_simulation

from statistics.diagnostics import residual_diagnostics, leverage_and_influence
from optimization.optimizer import optimize_multi_response
from statistics.regression  import build_rsm_matrix


def _collect_y(experiments: list, response_idx: int) -> tuple:
    """Extract coded values and y for a specific response from completed experiments."""
    coded_list, y_list = [], []
    for e in experiments:
        if e.get("run_type") == "Bayesian":
            continue
        rv = e.get("result_values")
        if rv is None:
            continue
        val = rv[response_idx] if isinstance(rv, list) else rv
        if val is None or (isinstance(val, float) and np.isnan(val)):
            continue
        coded_list.append(e["coded_values"])
        y_list.append(float(val))
    return np.array(coded_list, dtype=float), np.array(y_list, dtype=float)


def run_analysis(experiments: list, response_idx: int,
                 response_meta: dict, factors: list) -> Dict[str, Any]:
    """Run complete analysis for one response."""
    coded, y = _collect_y(experiments, response_idx)
    n        = len(y)
    if n < 3:
        return {"error": "Need ≥3 completed runs", "n": n}

    k = coded.shape[1] if len(coded.shape) > 1 else len(factors)

    # Descriptive stats
    desc = {
        "n":      n,
        "y_mean": round(float(y.mean()), 4),
        "y_std":  round(float(y.std()),  4),
        "y_min":  round(float(y.min()),  4),
        "y_max":  round(float(y.max()),  4),
        "y_range":round(float(y.max() - y.min()), 4)
    }

    # ANOVA
    anova = None
    run_types = [e["run_type"] for e in experiments if e.get("result_values") is not None]
    has_factorial = any(t in ("Factorial", "Axial") for t in run_types[:n])
    if has_factorial and n >= 4:
        try:
            anova = anova_2level(coded, y, include_interactions=(k <= 5))
        except Exception as ex:
            anova = {"error": str(ex)}

    # RSM Regression
    rsm = None
    if n >= 3:
        try:
            rsm = rsm_regression(coded, y)
        except Exception as ex:
            rsm = {"error": str(ex)}

    # Diagnostics
    diagnostics = {}
    if rsm and rsm.get("converged") and rsm.get("y_pred"):
        try:
            y_pred = np.array(rsm["y_pred"])
            X, _ = build_rsm_matrix(coded)
            diagnostics = residual_diagnostics(y, y_pred, X=X)
            try:
                inf  = leverage_and_influence(X, y, y_pred)
                diagnostics.update(inf)
            except Exception as e_inf:
                print(f"[INFLUENCE WARNING] {e_inf}")
        except Exception as ex_diag:
            print(f"[DIAGNOSTICS WARNING] {ex_diag}")

    return {
        "response": response_meta,
        "descriptive": desc,
        "anova":       anova,
        "rsm":         rsm,
        "diagnostics": diagnostics
    }


def _get_val(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    val = None
    if isinstance(obj, dict):
        val = obj.get(key, default)
    else:
        val = getattr(obj, key, default)
    if isinstance(val, str):
        try:
            import json
            val = json.loads(val)
        except Exception:
            pass
    return val if val is not None else default


def run_optimization(analyses: list, factors: list,
                      responses: list) -> Dict[str, Any]:
    """Multi-response desirability optimization from stored analysis results."""
    models = []
    for i, a in enumerate(analyses):
        rsm = _get_val(a, "regression") or _get_val(a, "rsm") or {}
        if isinstance(rsm, dict) and (rsm.get("converged") or rsm.get("beta") or rsm.get("coefficients")):
            beta = rsm.get("beta")
            if not beta and rsm.get("coefficients"):
                beta = [c["coeff"] for c in rsm["coefficients"] if isinstance(c, dict) and "coeff" in c]

            if beta:
                anova_dict = _get_val(a, "anova") or {}
                y_mean = anova_dict.get("y_mean", 0) if isinstance(anova_dict, dict) else 0
                y_min = anova_dict.get("y_min", y_mean - 5) if isinstance(anova_dict, dict) else 0
                y_max = anova_dict.get("y_max", y_mean + 5) if isinstance(anova_dict, dict) else 1
                models.append({
                    "beta": beta,
                    "k": len(factors),
                    "y_min": y_min,
                    "y_max": y_max
                })
            else:
                models.append({"beta": [], "k": len(factors), "y_min": 0, "y_max": 1})
        else:
            models.append({"beta": [], "k": len(factors), "y_min": 0, "y_max": 1})

    valid = [m for m in models if m["beta"]]
    if not valid:
        return {"error": "No valid regression models found. Please upload experiment results and run statistical analysis."}

    return optimize_multi_response(models, factors, responses)


def get_contour(analyses: list, response_idx: int,
                factors: list, factor_x: int, factor_y: int) -> Dict[str, Any]:
    """Return RSM contour grid for two factors."""
    if not analyses:
        return {"error": "No RSM model for this response"}

    a = None
    for item in analyses:
        if _get_val(item, "response_idx") == response_idx:
            a = item
            break
    if a is None and response_idx < len(analyses):
        a = analyses[response_idx]

    if not a:
        return {"error": "No RSM model for this response"}

    rsm = _get_val(a, "regression") or _get_val(a, "rsm") or {}
    if not (isinstance(rsm, dict) and (rsm.get("converged") or rsm.get("coefficients") or rsm.get("beta"))):
        return {"error": "No RSM model for this response"}
    beta = rsm.get("beta") or [c["coeff"] for c in rsm.get("coefficients", []) if isinstance(c, dict) and "coeff" in c]
    k    = len(factors)
    fixed_coded = [0.0] * k
    grid_data = contour_grid(beta, k, factor_x, factor_y, fixed_coded, n_grid=25)

    def coded_to_actual(coded_val, f):
        flow = f.low if hasattr(f, 'low') else f.get('low', -1)
        fhigh = f.high if hasattr(f, 'high') else f.get('high', 1)
        return round((fhigh + flow) / 2 + coded_val * (fhigh - flow) / 2, 3)

    x_actual = [coded_to_actual(c, factors[factor_x]) for c in grid_data["levels"]]
    y_actual = [coded_to_actual(c, factors[factor_y]) for c in grid_data["levels"]]

    return {
        "x_actual":       x_actual,
        "y_actual":       y_actual,
        "grid":           grid_data["grid"],
        "factor_x_name":  factors[factor_x].name if hasattr(factors[factor_x], 'name') else factors[factor_x]['name'],
        "factor_y_name":  factors[factor_y].name if hasattr(factors[factor_y], 'name') else factors[factor_y]['name'],
        "factor_x_unit":  factors[factor_x].unit if hasattr(factors[factor_x], 'unit') else factors[factor_x].get('unit', ''),
        "factor_y_unit":  factors[factor_y].unit if hasattr(factors[factor_y], 'unit') else factors[factor_y].get('unit', '')
    }


def get_overlay_plot_service(analyses: list, factors: list, responses: list,
                              factor_x: int = 0, factor_y: int = 1) -> Dict[str, Any]:
    """Calculate Overlay Plot Design Space boundaries across all response models."""
    k = len(factors)
    models = []
    resp_specs = []
    
    for a in sorted(analyses, key=lambda x: _get_val(x, 'response_idx', 0)):
        rsm = _get_val(a, 'regression') or {}
        if isinstance(rsm, dict) and (rsm.get("converged") or "beta" in rsm):
            beta = rsm.get("beta") or [c["coeff"] for c in rsm.get("coefficients", [])]
            models.append({"beta": beta})
        else:
            models.append({"beta": []})

    for r in responses:
        resp_specs.append({
            "name": getattr(r, 'name', 'Response'),
            "goal": getattr(r, 'goal', 'maximize'),
            "lower_limit": getattr(r, 'lower_limit', None),
            "upper_limit": getattr(r, 'upper_limit', None)
        })

    fixed_coded = [0.0] * k
    overlay_res = calculate_overlay_plot(models, resp_specs, k, factor_x, factor_y, fixed_coded)

    def coded_to_actual(coded_val, f):
        flow = f.low if hasattr(f, 'low') else f.get('low', -1)
        fhigh = f.high if hasattr(f, 'high') else f.get('high', 1)
        return round((fhigh + flow) / 2 + coded_val * (fhigh - flow) / 2, 3)

    x_actual = [coded_to_actual(c, factors[factor_x]) for c in overlay_res["levels"]]
    y_actual = [coded_to_actual(c, factors[factor_y]) for c in overlay_res["levels"]]

    return {
        "x_actual": x_actual,
        "y_actual": y_actual,
        "sweet_spot_grid": overlay_res["sweet_spot_grid"],
        "response_grids": overlay_res["response_grids"],
        "factor_x_name": factors[factor_x].name if hasattr(factors[factor_x], 'name') else factors[factor_x]['name'],
        "factor_y_name": factors[factor_y].name if hasattr(factors[factor_y], 'name') else factors[factor_y]['name']
    }


def run_monte_carlo_service(analyses: list, factors: list, responses: list,
                            factor_stds: list, n_iterations: int = 5000,
                            factor_x: int = 0, factor_y: int = 1) -> Dict[str, Any]:
    """Run Monte Carlo simulation and return % success heatmap."""
    k = len(factors)
    models = []
    resp_specs = []

    for a in sorted(analyses, key=lambda x: _get_val(x, 'response_idx', 0)):
        rsm = _get_val(a, 'regression') or {}
        if isinstance(rsm, dict) and (rsm.get("converged") or "beta" in rsm):
            beta = rsm.get("beta") or [c["coeff"] for c in rsm.get("coefficients", [])]
            models.append({"beta": beta})
        else:
            models.append({"beta": []})

    for r in responses:
        resp_specs.append({
            "name": getattr(r, 'name', 'Response'),
            "goal": getattr(r, 'goal', 'maximize'),
            "lower_limit": getattr(r, 'lower_limit', None),
            "upper_limit": getattr(r, 'upper_limit', None)
        })

    fixed_coded = [0.0] * k
    mc_res = run_monte_carlo_simulation(models, resp_specs, k, factor_x, factor_y, fixed_coded, factor_stds, n_iterations)

    def coded_to_actual(coded_val, f):
        flow = f.low if hasattr(f, 'low') else f.get('low', -1)
        fhigh = f.high if hasattr(f, 'high') else f.get('high', 1)
        return round((fhigh + flow) / 2 + coded_val * (fhigh - flow) / 2, 3)

    x_actual = [coded_to_actual(c, factors[factor_x]) for c in mc_res["levels"]]
    y_actual = [coded_to_actual(c, factors[factor_y]) for c in mc_res["levels"]]

    return {
        "x_actual": x_actual,
        "y_actual": y_actual,
        "prob_heatmap": mc_res["prob_heatmap"],
        "n_iterations": n_iterations,
        "factor_x_name": factors[factor_x].name if hasattr(factors[factor_x], 'name') else factors[factor_x]['name'],
        "factor_y_name": factors[factor_y].name if hasattr(factors[factor_y], 'name') else factors[factor_y]['name']
    }


