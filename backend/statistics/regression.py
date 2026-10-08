# ============================================================
#  statistics/regression.py  –  OLS & Polynomial Regression
# ============================================================
import numpy as np
from scipy import stats
from typing import List, Dict, Any, Tuple


def build_rsm_matrix(coded: np.ndarray) -> Tuple[np.ndarray, List[str]]:
    """
    Build RSM design matrix with intercept, linear, quadratic, and interaction terms.
    Returns (X, term_names).
    """
    n, k = coded.shape
    cols  = [np.ones(n)]
    names = ["Intercept"]

    # Linear
    for j in range(k):
        cols.append(coded[:, j])
        names.append(f"X{j+1}")

    # Quadratic
    for j in range(k):
        cols.append(coded[:, j] ** 2)
        names.append(f"X{j+1}²")

    # Interactions
    for j1 in range(k - 1):
        for j2 in range(j1 + 1, k):
            cols.append(coded[:, j1] * coded[:, j2])
            names.append(f"X{j1+1}·X{j2+1}")

    return np.column_stack(cols), names


def ols(X: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
    """
    Ordinary Least Squares regression.
    Returns coefficients, standard errors, t-values, p-values, R², residuals.
    """
    n, p = X.shape
    try:
        XtX    = X.T @ X
        XtXinv = np.linalg.pinv(XtX)
        beta   = XtXinv @ X.T @ y
        y_pred = X @ beta
    except np.linalg.LinAlgError:
        return {"converged": False, "error": "Singular matrix"}

    residuals = y - y_pred
    ss_res    = float(np.sum(residuals ** 2))
    ss_tot    = float(np.sum((y - y.mean()) ** 2))
    df_res    = max(n - p, 1)
    mse       = ss_res / df_res
    R2        = 1 - ss_res / ss_tot if ss_tot > 0 else 0
    R2_adj    = 1 - (1 - R2) * (n - 1) / df_res

    # Standard errors and t-statistics
    var_beta = mse * np.diag(XtXinv)
    se       = np.sqrt(np.abs(var_beta))
    t_vals   = beta / (se + 1e-12)
    p_vals   = 2 * (1 - stats.t.cdf(np.abs(t_vals), df=df_res))

    return {
        "converged": True,
        "beta":      beta.tolist(),
        "y_pred":    y_pred.tolist(),
        "residuals": residuals.tolist(),
        "se":        se.tolist(),
        "t_values":  t_vals.tolist(),
        "p_values":  [float(p) for p in p_vals],
        "R2":        round(float(R2),     4),
        "R2_adj":    round(float(R2_adj), 4),
        "MSE":       round(float(mse),    6),
        "ss_res":    round(float(ss_res), 6),
        "df_res":    df_res,
        "n":         n,
        "p":         p
    }


def linear_regression_fallback(coded: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
    n, k = coded.shape
    X_lin = np.column_stack([np.ones(n)] + [coded[:, j] for j in range(k)])
    res = ols(X_lin, y)
    if not res.get("converged"):
        return {"converged": False, "error": "Singular matrix"}

    X_full, full_names = build_rsm_matrix(coded)
    p_full = len(full_names)
    full_beta = np.zeros(p_full)
    full_beta[:1 + k] = res["beta"]

    coefficients = []
    for i, name in enumerate(full_names):
        val = float(full_beta[i])
        coefficients.append({
            "term":        name,
            "coeff":       round(val, 6),
            "se":          round(float(res["se"][i]), 6) if i <= k else 0.0,
            "t_value":     round(float(res["t_values"][i]), 4) if i <= k else 0.0,
            "p_value":     round(float(res["p_values"][i]), 4) if i <= k else 1.0,
            "significant": bool(res["p_values"][i] < 0.05) if i <= k else False
        })

    return {
        "converged":      True,
        "coefficients":   coefficients,
        "term_names":     full_names,
        "beta":           full_beta.tolist(),
        "y_pred":         res["y_pred"].tolist() if hasattr(res["y_pred"], 'tolist') else list(res["y_pred"]),
        "residuals":      res["residuals"].tolist() if hasattr(res["residuals"], 'tolist') else list(res["residuals"]),
        "R2":             res["R2"],
        "R2_adj":         res["R2_adj"],
        "MSE":            res["MSE"],
        "n_terms":        p_full,
        "k":              k,
        "fallback":       "linear"
    }


def rsm_regression(coded: np.ndarray, y: np.ndarray) -> Dict[str, Any]:
    """Full RSM quadratic regression with linear model fallback if matrix is singular."""
    k = coded.shape[1]
    X, term_names = build_rsm_matrix(coded)
    result = ols(X, y)
    if not result.get("converged"):
        return linear_regression_fallback(coded, y)

    coefficients = []
    for i, name in enumerate(term_names):
        coefficients.append({
            "term":        name,
            "coeff":       round(float(result["beta"][i]),     6),
            "se":          round(float(result["se"][i]),       6),
            "t_value":     round(float(result["t_values"][i]), 4),
            "p_value":     round(float(result["p_values"][i]), 4),
            "significant": bool(result["p_values"][i] < 0.05)
        })

    return {
        "converged":      True,
        "coefficients":   coefficients,
        "term_names":     term_names,
        "beta":           result["beta"].tolist() if hasattr(result["beta"], 'tolist') else list(result["beta"]),
        "y_pred":         result["y_pred"].tolist() if hasattr(result["y_pred"], 'tolist') else list(result["y_pred"]),
        "residuals":      result["residuals"].tolist() if hasattr(result["residuals"], 'tolist') else list(result["residuals"]),
        "R2":             result["R2"],
        "R2_adj":         result["R2_adj"],
        "MSE":            result["MSE"],
        "n_terms":        len(term_names),
        "k":              k
    }


def predict_rsm(beta: List[float], x_coded: List[float], k: int = None) -> float:
    """Predict response at a coded point using RSM model."""
    if not beta:
        return 0.0
    x_arr = np.array(x_coded, dtype=float).ravel()
    x = x_arr.reshape(1, -1)
    X, _ = build_rsm_matrix(x)
    b = np.array(beta, dtype=float)

    p_X = X.shape[1]
    p_b = len(b)

    if p_X == p_b:
        val = X @ b
        return float(val.ravel()[0])
    elif p_b > p_X:
        val = X @ b[:p_X]
        return float(val.ravel()[0])
    else:
        b_padded = np.zeros(p_X)
        b_padded[:p_b] = b
        val = X @ b_padded
        return float(val.ravel()[0])



def contour_grid(beta: List[float], k: int,
                 factor_x: int, factor_y: int,
                 fixed_coded: List[float], n_grid: int = 20) -> Dict[str, Any]:
    """
    Generate a 2D response surface grid over two factors,
    holding all others fixed at fixed_coded values.
    """
    levels = np.linspace(-1, 1, n_grid)
    grid   = []
    for xi in levels:
        row = []
        for yi in levels:
            pt = list(fixed_coded)
            pt[factor_x] = float(xi)
            pt[factor_y] = float(yi)
            row.append(round(predict_rsm(beta, pt, k), 4))
        grid.append(row)
    return {"levels": levels.tolist(), "grid": grid}


def calculate_overlay_plot(models: List[Dict[str, Any]], responses: List[dict], k: int,
                           factor_x: int, factor_y: int, fixed_coded: List[float], n_grid: int = 25) -> Dict[str, Any]:
    """
    Calculate Overlay Plot Design Space boundaries across multiple responses.
    Identifies grid cells that satisfy ALL response specifications (sweet spot).
    """
    levels = np.linspace(-1, 1, n_grid)
    in_design_space = [] # 1 if all specs satisfied, 0 if violated
    response_grids = []

    for resp_idx, (model, r_spec) in enumerate(zip(models, responses)):
        beta = model.get("beta", [])
        if not beta:
            continue
        grid_data = contour_grid(beta, k, factor_x, factor_y, fixed_coded, n_grid)
        response_grids.append({
            "response_name": r_spec.get("name", f"Response_{resp_idx+1}"),
            "goal": r_spec.get("goal", "maximize"),
            "lower_limit": r_spec.get("lower_limit"),
            "upper_limit": r_spec.get("upper_limit"),
            "grid": grid_data["grid"]
        })

    # Evaluate compliance at each grid point
    for i, xi in enumerate(levels):
        row_status = []
        for j, yi in enumerate(levels):
            pt_ok = True
            for r_g in response_grids:
                val = r_g["grid"][i][j]
                gl = r_g["goal"]
                ll = r_g["lower_limit"]
                ul = r_g["upper_limit"]
                if gl == "maximize" and ll is not None and val < ll:
                    pt_ok = False; break
                elif gl == "minimize" and ul is not None and val > ul:
                    pt_ok = False; break
                elif gl == "target":
                    if ll is not None and val < ll: pt_ok = False; break
                    if ul is not None and val > ul: pt_ok = False; break
            row_status.append(1 if pt_ok else 0)
        in_design_space.append(row_status)

    return {
        "levels": levels.tolist(),
        "sweet_spot_grid": in_design_space,
        "response_grids": response_grids
    }


def run_monte_carlo_simulation(models: List[Dict[str, Any]], responses: List[dict], k: int,
                               factor_x: int, factor_y: int, fixed_coded: List[float],
                               factor_stds: List[float], n_iterations: int = 2000, n_grid: int = 15) -> Dict[str, Any]:
    """
    Monte Carlo Simulation: propagate factor variability (std dev) through RSM models.
    Calculates probability of meeting all specs (% success heatmap) across the 2D factor space.
    """
    np.random.seed(42)
    levels = np.linspace(-1, 1, n_grid)
    prob_heatmap = []
    
    # Ensure factor_stds has length k (default 0.05 in coded scale)
    stds = list(factor_stds) if factor_stds and len(factor_stds) == k else [0.05] * k

    for xi in levels:
        prob_row = []
        for yi in levels:
            base_pt = list(fixed_coded)
            base_pt[factor_x] = float(xi)
            base_pt[factor_y] = float(yi)

            # Sample n_iterations points centered at base_pt with factor_stds
            samples = []
            for j in range(k):
                samples.append(np.random.normal(base_pt[j], max(0.001, stds[j]), n_iterations))
            samples_np = np.column_stack(samples)

            # Evaluate each RSM model across all iterations
            n_success = np.ones(n_iterations, dtype=bool)

            for model, r_spec in zip(models, responses):
                beta = model.get("beta", [])
                if not beta: continue
                X_samp, _ = build_rsm_matrix(samples_np)
                b = np.array(beta, dtype=float)
                p_X = X_samp.shape[1]
                p_b = len(b)
                if p_X == p_b:
                    b_used = b
                elif p_b > p_X:
                    b_used = b[:p_X]
                else:
                    b_used = np.zeros(p_X)
                    b_used[:p_b] = b
                y_sim = X_samp @ b_used

                gl = r_spec.get("goal", "maximize")
                ll = r_spec.get("lower_limit")
                ul = r_spec.get("upper_limit")

                if gl == "maximize" and ll is not None:
                    n_success = n_success & (y_sim >= ll)
                elif gl == "minimize" and ul is not None:
                    n_success = n_success & (y_sim <= ul)
                elif gl == "target":
                    if ll is not None: n_success = n_success & (y_sim >= ll)
                    if ul is not None: n_success = n_success & (y_sim <= ul)

            prob_success = float(np.mean(n_success) * 100.0)
            prob_row.append(round(prob_success, 1))
        prob_heatmap.append(prob_row)

    return {
        "levels": levels.tolist(),
        "prob_heatmap": prob_heatmap,
        "n_iterations": n_iterations,
        "factor_stds": stds
    }

