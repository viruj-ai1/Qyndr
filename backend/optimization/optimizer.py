# ============================================================
#  optimization/optimizer.py  –  Multi-Response Optimizer
# ============================================================
import numpy as np
from scipy.optimize import differential_evolution
from typing import List, Dict, Any
from statistics.regression import predict_rsm, build_rsm_matrix
from .desirability import individual_desirability, composite_desirability


def optimize_multi_response(regression_models: List[Dict],
                              factors: list,
                              responses: list,
                              n_grid: int = 15,
                              use_de: bool = True) -> Dict[str, Any]:
    """
    Multi-response desirability optimization using:
    1. Grid search for initial solution
    2. scipy differential_evolution for refinement (optional)

    regression_models: list of {"beta": [...], "k": k}
    factors: list of Factor dicts
    responses: list of Response dicts
    """
    k    = len(factors)
    bnds = [(-1.0, 1.0)] * k   # coded space

    def neg_desirability(coded_pt):
        desirs = []
        for i, m in enumerate(regression_models):
            if not m.get("beta"):
                continue
            resp   = responses[i] if i < len(responses) else {}
            y_pred = predict_rsm(m["beta"], list(coded_pt), k)
            d = individual_desirability(
                y=y_pred,
                goal=resp.get("goal", "maximize"),
                y_min=m.get("y_min", 0),
                y_max=m.get("y_max", 1),
                target=resp.get("target"),
                weight=resp.get("weight", 1.0),
                lower_limit=resp.get("lower_limit"),
                upper_limit=resp.get("upper_limit")
            )
            desirs.append(d)
        D = composite_desirability(desirs)
        return -D   # negative because we minimize

    # --- Grid search ---
    levels = np.linspace(-1, 1, n_grid)

    def grid_search(current, dim):
        nonlocal best_D, best_coded
        if dim == k:
            val = -neg_desirability(current)
            if val > best_D:
                best_D = val
                best_coded = current.copy()
            return
        for lv in levels:
            current[dim] = lv
            grid_search(current, dim + 1)

    best_D, best_coded = -1.0, np.zeros(k)
    if k <= 4:
        grid_search(np.zeros(k), 0)
    else:
        # Random search for high k
        X_rand = np.random.uniform(-1, 1, (10000, k))
        for x in X_rand:
            val = -neg_desirability(x)
            if val > best_D:
                best_D, best_coded = val, x.copy()

    # --- Differential Evolution refinement ---
    if use_de and k <= 8:
        try:
            result = differential_evolution(
                neg_desirability, bounds=bnds,
                seed=42, maxiter=300, tol=1e-6,
                workers=1, mutation=(0.5, 1), recombination=0.7,
                popsize=12, init="latinhypercube"
            )
            if -result.fun > best_D:
                best_D     = -result.fun
                best_coded = result.x
        except Exception:
            pass

    # Decode to actual values
    actual = []
    for j in range(k):
        f      = factors[j]
        center = (f["high"] + f["low"]) / 2
        half   = (f["high"] - f["low"]) / 2
        actual.append(round(center + best_coded[j] * half, 4))

    # Predicted response values at optimum
    preds = []
    for i, m in enumerate(regression_models):
        if m.get("beta"):
            preds.append(round(predict_rsm(m["beta"], list(best_coded), k), 4))
        else:
            preds.append(None)

    return {
        "coded_optimum":   [round(float(v), 4) for v in best_coded],
        "actual_optimum":  actual,
        "predicted_responses": preds,
        "composite_desirability": round(float(best_D), 4)
    }
