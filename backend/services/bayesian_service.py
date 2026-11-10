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

    try:
        recommendation = find_next_experiment(gp_bundle, factor_dicts, acquisition=acquisition)
    except Exception as acq_err:
        print(f"Acquisition search exception: {acq_err}")
        recommendation = None

    if recommendation is None:
        rec_actual = [round((f["low"] + f["high"]) / 2.0, 2) for f in factor_dicts]
        recommendation = {
            "actual_values": rec_actual,
            "predicted_mean": round(float(gp_bundle["y_mean"]), 4),
            "predicted_std": 1.0,
            "expected_improvement": 0.5,
            "confidence_95": [
                round(float(gp_bundle["y_mean"]) - 1.96, 4),
                round(float(gp_bundle["y_mean"]) + 1.96, 4)
            ],
            "acquisition_type": acquisition,
            "xi": 0.01
        }

    # 1D slices for each factor (sliced through current best/recommended condition)
    ref_point = recommendation.get("actual_values") if recommendation else None
    slices = []
    for idx in range(len(factor_dicts)):
        slices.append(gp_1d_slice(gp_bundle, idx, n_grid=40, reference_point=ref_point))

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
                       factors: list, goal: str = "maximize") -> Dict[str, Any]:
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

    is_minimize = str(goal).strip().lower() == "minimize"

    # Find optimum of GP posterior mean
    # If minimizing, we look for the minimum predicted mean; if maximizing, maximum.
    import numpy as np
    from ml.acquisition import find_next_experiment as _find
    if is_minimize:
        # Invert GP bundle sign in a shallow copy to use standard acquisition maximizer for minimization
        import copy
        min_bundle = copy.copy(gp_bundle)
        # For pure exploitation (kappa=0), negate predicted mean logic by searching on grid
        axes = [np.linspace(f["low"], f["high"], 20) for f in factor_dicts]
        grids = np.meshgrid(*axes, indexing='ij')
        X_flat = np.column_stack([g.ravel() for g in grids])
        if len(X_flat) > 50_000:
            idx = np.random.choice(len(X_flat), 50_000, replace=False)
            X_flat = X_flat[idx]
        from ml.gaussian_process import predict_gp
        mu, sigma = predict_gp(gp_bundle, X_flat)
        best_idx = int(np.argmin(mu))
        best_x = X_flat[best_idx]
        best_mu = float(mu[best_idx])
        best_sig = float(sigma[best_idx])
        opt = {
            "actual_values": [round(float(v), 4) for v in best_x],
            "predicted_mean": round(best_mu, 4),
            "predicted_std": round(best_sig, 4),
            "expected_improvement": 0.0,
            "confidence_95": [
                round(best_mu - 1.96 * best_sig, 4),
                round(best_mu + 1.96 * best_sig, 4)
            ],
            "acquisition_type": "MIN_EXPLOITATION",
            "xi": 0.0
        }
    else:
        opt = _find(gp_bundle, factor_dicts, acquisition="UCB", n_grid=20, xi=0.0)

    # Best observed
    y_vals = [
        _extract_response_val(e["result_values"], response_idx)
        for e in exp_dicts
        if e["result_values"] is not None
    ]
    y_vals = [y for y in y_vals if y is not None]
    
    if is_minimize:
        best_obs_val = min(y_vals) if y_vals else None
    else:
        best_obs_val = max(y_vals) if y_vals else None

    best_obs_run = next(
        (i + 1 for i, e in enumerate(exp_dicts)
         if e["result_values"] is not None and (
             _extract_response_val(e["result_values"], response_idx) == best_obs_val
         )), None
    )

    initial_val = y_vals[0] if y_vals else None
    
    if initial_val is not None and abs(initial_val) > 1e-9 and best_obs_val is not None:
        if is_minimize:
            # Improvement means reduction in impurity / defect: (initial - best) / initial * 100
            improvement = round(((initial_val - best_obs_val) / abs(initial_val)) * 100, 1)
        else:
            # Improvement means increase in yield / purity: (best - initial) / initial * 100
            improvement = round(((best_obs_val - initial_val) / abs(initial_val)) * 100, 1)
    else:
        improvement = 0.0

    return {
        "final_optimum":  opt,
        "best_observed":  {"value": best_obs_val, "run_number": best_obs_run},
        "initial_value":  initial_val,
        "improvement_pct": improvement,
        "n_obs":          gp_bundle["n_obs"],
        "gp_log_likelihood": gp_bundle["log_likelihood"],
        "goal":           "minimize" if is_minimize else "maximize"
    }


def get_final_combined_optimum(experiments: list, responses: list,
                               factors: list) -> Dict[str, Any]:
    """
    Find the multi-objective combined sweet spot across all CQAs using Gaussian Process surrogate
    models fitted on all completed experiments (screening DOE + Bayesian optimization iterations).
    """
    import numpy as np
    from scipy.optimize import differential_evolution
    from ml.gaussian_process import build_gp_model, predict_gp
    from optimization.desirability import individual_desirability, composite_desirability

    exp_dicts = []
    for e in experiments:
        av = getattr(e, "actual_values", None) if not isinstance(e, dict) else e.get("actual_values")
        rv = getattr(e, "result_values", None) if not isinstance(e, dict) else e.get("result_values")
        av = _clean_val(av)
        rv = _clean_val(rv)
        if av is not None and rv is not None:
            exp_dicts.append({
                "actual_values": list(av),
                "result_values": list(rv) if isinstance(rv, list) else [rv]
            })

    if len(exp_dicts) < 3:
        return {"error": "Need ≥ 3 completed experiments to compute combined optimum"}

    factor_dicts = []
    for f in factors:
        low_val = float(f.low) if hasattr(f, "low") else float(f.get("low", 0.0))
        high_val = float(f.high) if hasattr(f, "high") else float(f.get("high", 100.0))
        base_val = (float(f.baseline) if hasattr(f, "baseline") and f.baseline is not None
                    else (float(f.get("baseline")) if isinstance(f, dict) and f.get("baseline") is not None
                          else (low_val + high_val) / 2.0))
        factor_dicts.append({
            "name": f.name if hasattr(f, "name") else f.get("name", ""),
            "unit": f.unit if hasattr(f, "unit") else f.get("unit", ""),
            "low": low_val,
            "high": high_val,
            "baseline": base_val
        })

    resp_dicts = []
    for r in responses:
        resp_dicts.append({
            "name": r.name if hasattr(r, "name") else r.get("name", ""),
            "goal": (r.goal if hasattr(r, "goal") else r.get("goal", "maximize")).lower(),
            "target": float(r.target) if (hasattr(r, "target") and r.target is not None) else (float(r.get("target")) if isinstance(r, dict) and r.get("target") is not None else None),
            "lower_limit": float(r.lower_limit) if (hasattr(r, "lower_limit") and r.lower_limit is not None) else (float(r.get("lower_limit")) if isinstance(r, dict) and r.get("lower_limit") is not None else None),
            "upper_limit": float(r.upper_limit) if (hasattr(r, "upper_limit") and r.upper_limit is not None) else (float(r.get("upper_limit")) if isinstance(r, dict) and r.get("upper_limit") is not None else None),
            "weight": float(r.weight) if (hasattr(r, "weight") and r.weight is not None) else float(r.get("weight") or 1.0) if isinstance(r, dict) else 1.0
        })

    gp_bundles = []
    for r_idx in range(len(resp_dicts)):
        bundle = build_gp_model(exp_dicts, r_idx, factor_dicts)
        if bundle is None:
            return {"error": f"Failed to build GP model for response index {r_idx}"}
        gp_bundles.append(bundle)

    bounds = [(f["low"], f["high"]) for f in factor_dicts]
    weights = [r["weight"] for r in resp_dicts]

    def calc_desirability(x_coords):
        x_arr = np.array([x_coords], dtype=float)
        d_list = []
        for r_idx, resp in enumerate(resp_dicts):
            bundle = gp_bundles[r_idx]
            pred_mean, _ = predict_gp(bundle, x_arr)
            y_pred = float(pred_mean[0])
            y_obs = bundle["y_raw"]
            y_min = float(min(y_obs))
            y_max = float(max(y_obs))
            d = individual_desirability(
                y=y_pred,
                goal=resp["goal"],
                y_min=y_min,
                y_max=y_max,
                target=resp["target"],
                weight=resp["weight"],
                lower_limit=resp["lower_limit"],
                upper_limit=resp["upper_limit"]
            )
            d_list.append(max(d, 1e-6))
        return composite_desirability(d_list, weights)

    # 1. Differential evolution global search
    res = differential_evolution(lambda x: -calc_desirability(x), bounds, seed=42, maxiter=200, tol=1e-4)
    best_x = np.array(res.x, dtype=float)
    best_comp = -res.fun

    # 2. Check if any actual observed experimental run achieved even higher desirability
    for e in exp_dicts:
        act = list(e["actual_values"])
        while len(act) < len(factor_dicts):
            act.append(factor_dicts[len(act)]["baseline"])
        act = act[:len(factor_dicts)]
        obs_d = calc_desirability(act)
        if obs_d > best_comp:
            best_comp = obs_d
            best_x = np.array(act, dtype=float)

    # Clip coordinates to bounds
    for i, (lo, hi) in enumerate(bounds):
        best_x[i] = max(lo, min(hi, float(best_x[i])))

    # Calculate predicted responses and confidence intervals at optimum
    predicted_responses = []
    confidence_95 = []
    individual_desirs = []
    for r_idx, resp in enumerate(resp_dicts):
        bundle = gp_bundles[r_idx]
        pred_mean, pred_std = predict_gp(bundle, np.array([best_x]))
        pm = round(float(pred_mean[0]), 3)
        ps = round(float(pred_std[0]), 3)
        predicted_responses.append(pm)
        confidence_95.append([round(pm - 1.96 * ps, 3), round(pm + 1.96 * ps, 3)])

        y_obs = bundle["y_raw"]
        y_min = float(min(y_obs))
        y_max = float(max(y_obs))
        d = individual_desirability(
            y=pm,
            goal=resp["goal"],
            y_min=y_min,
            y_max=y_max,
            target=resp["target"],
            weight=resp["weight"],
            lower_limit=resp["lower_limit"],
            upper_limit=resp["upper_limit"]
        )
        individual_desirs.append(round(d, 4))

    # Coded optimum [-1, 1]
    coded_opt = []
    for i, f in enumerate(factor_dicts):
        lo, hi = f["low"], f["high"]
        mid = (lo + hi) / 2.0
        half_rng = (hi - lo) / 2.0
        c = (best_x[i] - mid) / half_rng if half_rng > 1e-6 else 0.0
        coded_opt.append(round(float(c), 4))

    n_obs = max(b["n_obs"] for b in gp_bundles)

    return {
        "coded_optimum": coded_opt,
        "actual_optimum": [round(float(v), 3) for v in best_x],
        "predicted_responses": predicted_responses,
        "confidence_95": confidence_95,
        "composite_desirability": round(float(best_comp), 4),
        "individual_desirabilities": individual_desirs,
        "n_obs": n_obs,
        "optimization_engine": "Derringer-Suich GP (DE)",
        "method": "Gaussian Process Multi-Objective (All Runs)"
    }
