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
                            n_grid: int = 25,
                            use_de: bool = True) -> Dict[str, Any]:
    """
    Multi-response desirability optimization using:
    1. Grid search for initial solution (with simplex candidates if mixture)
    2. scipy differential_evolution for refinement (for non-mixture designs)

    regression_models: list of {"beta": [...], "k": k, "y_min": ..., "y_max": ..., "is_mixture": ...}
    factors: list of Factor dicts
    responses: list of Response dicts
    """
    k = len(factors)
    
    # 1. Detect if this is a mixture design:
    is_mixture = any(m.get("is_mixture") for m in regression_models if isinstance(m, dict))

    def neg_desirability(coded_pt):
        # In a mixture design, point must be on the simplex (sum == 1, all >= 0)
        if is_mixture:
            pt_sum = sum(coded_pt)
            if abs(pt_sum - 1.0) > 0.05 or any(x < -0.01 for x in coded_pt):
                return 1e6  # heavily penalize non-simplex coordinates

        desirs = []
        for i, m in enumerate(regression_models):
            if not m.get("beta"):
                continue
            resp = responses[i] if i < len(responses) else {}
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
        return -D

    best_D = -1.0
    best_coded = np.zeros(k)

    # 2. Search Grid:
    if is_mixture:
        # Generate points strictly on the simplex: sum(X) = 1, X >= 0
        simplex_candidates = []
        step = 0.02
        if k == 3:
            for x1 in np.arange(0, 1.001, step):
                for x2 in np.arange(0, 1.001 - x1, step):
                    x3 = max(0.0, round(1.0 - x1 - x2, 4))
                    simplex_candidates.append([x1, x2, x3])
        elif k == 4:
            for x1 in np.arange(0, 1.001, 0.05):
                for x2 in np.arange(0, 1.001 - x1, 0.05):
                    for x3 in np.arange(0, 1.001 - x1 - x2, 0.05):
                        x4 = max(0.0, round(1.0 - x1 - x2 - x3, 4))
                        simplex_candidates.append([x1, x2, x3, x4])
        else:
            # Dirichlet random sampling for higher k
            simplex_candidates = np.random.dirichlet(np.ones(k), size=5000).tolist()

        for pt in simplex_candidates:
            val = -neg_desirability(pt)
            if val > best_D:
                best_D = val
                best_coded = np.array(pt)
    else:
        # Standard Factorial Grid Search in [-1, 1]
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

        if k <= 3:
            grid_search(np.zeros(k), 0)
        else:
            X_rand = np.random.uniform(-1, 1, (5000, k))
            for x in X_rand:
                val = -neg_desirability(x)
                if val > best_D:
                    best_D, best_coded = val, x.copy()

        # Differential Evolution refinement for continuous factor spaces
        if use_de and k <= 8:
            try:
                bnds = [(-1.0, 1.0)] * k
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

    # 3. Decode to Actual Values:
    actual = []
    for j in range(k):
        f = factors[j]
        f_low = f.get("low", -1) if isinstance(f, dict) else getattr(f, "low", -1)
        f_high = f.get("high", 1) if isinstance(f, dict) else getattr(f, "high", 1)
        if is_mixture:
            # In mixture design, actual value is linear fraction between low and high
            val = f_low + best_coded[j] * (f_high - f_low)
        else:
            center = (f_high + f_low) / 2
            half = (f_high - f_low) / 2
            val = center + best_coded[j] * half
        actual.append(round(float(val), 4))

    # 4. Predicted response values at optimum
    preds = []
    for i, m in enumerate(regression_models):
        if m.get("beta"):
            preds.append(round(predict_rsm(m["beta"], list(best_coded), k), 4))
        else:
            preds.append(None)

    return {
        "coded_optimum": [round(float(v), 4) for v in best_coded],
        "actual_optimum": actual,
        "predicted_responses": preds,
        "composite_desirability": round(float(max(best_D, 0.0)), 4)
    }
