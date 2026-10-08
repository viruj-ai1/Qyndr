# ============================================================
#  statistics/diagnostics.py  –  Model diagnostic checks
# ============================================================
import numpy as np
from scipy import stats
from typing import List, Dict, Any


def calculate_lack_of_fit(X: np.ndarray, y_obs: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    """
    Compute Lack-of-Fit test by partitioning residual sum of squares into Pure Error (replicates) and Lack of Fit.
    F = MS_LOF / MS_PE
    """
    n, p = X.shape
    residuals = y_obs - y_pred
    ss_res = float(np.sum(residuals ** 2))
    df_res = max(1, n - p)

    # Group replicated rows in X matrix
    unique_rows, inverse_indices, counts = np.unique(X, axis=0, return_inverse=True, return_counts=True)
    replicate_groups = [np.where(inverse_indices == i)[0] for i, count in enumerate(counts) if count > 1]

    ss_pe = 0.0
    df_pe = 0
    for group in replicate_groups:
        y_rep = y_obs[group]
        ss_pe += np.sum((y_rep - np.mean(y_rep))**2)
        df_pe += len(group) - 1

    if df_pe > 0 and df_res > df_pe:
        ss_lof = max(0.0, ss_res - ss_pe)
        df_lof = df_res - df_pe
        ms_lof = ss_lof / df_lof
        ms_pe = ss_pe / df_pe if ss_pe > 1e-12 else 1e-12
        f_stat = ms_lof / ms_pe
        p_val = float(stats.f.sf(f_stat, df_lof, df_pe))
        significant = p_val < 0.05
    else:
        ss_lof, df_lof, ms_lof = ss_res, df_res, ss_res / df_res if df_res > 0 else 0
        ss_pe, df_pe, ms_pe = 0.0, 0, 0.0
        f_stat, p_val, significant = None, None, False

    return {
        "ss_lof": round(float(ss_lof), 4),
        "df_lof": int(df_lof),
        "ms_lof": round(float(ms_lof), 4),
        "ss_pe": round(float(ss_pe), 4),
        "df_pe": int(df_pe),
        "ms_pe": round(float(ms_pe), 4),
        "f_stat": round(float(f_stat), 4) if f_stat is not None else None,
        "p_value": round(float(p_val), 4) if p_val is not None else None,
        "significant_lack_of_fit": significant # True is BAD for LOF!
    }


def calculate_press_and_pred_r2(X: np.ndarray, y_obs: np.ndarray, leverage: np.ndarray) -> Dict[str, Any]:
    """
    Calculate PRESS (Prediction Error Sum of Squares) and Predicted R-squared.
    PRESS = sum( (e_i / (1 - h_ii))^2 )
    Pred_R2 = 1 - (PRESS / SST)
    """
    n = len(y_obs)
    y_pred = X @ np.linalg.pinv(X.T @ X) @ y_obs
    residuals = y_obs - y_pred
    
    press_terms = []
    for i in range(n):
        h_ii = min(0.999, leverage[i])
        press_terms.append((residuals[i] / (1.0 - h_ii)) ** 2)
    
    press = float(np.sum(press_terms))
    ss_tot = float(np.sum((y_obs - np.mean(y_obs)) ** 2))
    pred_r2 = max(0.0, 1.0 - (press / ss_tot)) if ss_tot > 1e-12 else 0.0
    
    return {
        "press": round(float(press), 4),
        "pred_r2": round(float(pred_r2), 4)
    }


def residual_diagnostics(y_obs: np.ndarray, y_pred: np.ndarray, X: np.ndarray = None) -> Dict[str, Any]:
    """
    Compute 4-in-1 residual diagnostics:
    - Studentized residuals vs Fitted
    - Normal probability plot of residuals
    - Residuals vs Run Order
    - Cook's distance & leverage
    - Lack of Fit & Predicted R2
    """
    residuals = y_obs - y_pred
    n = len(residuals)
    mse = np.sum(residuals ** 2) / max(n - 1, 1)
    std_res = residuals / (np.sqrt(mse) + 1e-12)

    # Normal probability plot (quantile-quantile)
    sorted_res = np.sort(std_res)
    theoretical_q = stats.norm.ppf(
        np.linspace(1 / (2 * n), 1 - 1 / (2 * n), n)
    )

    # Shapiro-Wilk test
    if n >= 3:
        sw_stat, sw_p = stats.shapiro(residuals)
    else:
        sw_stat, sw_p = 1.0, 1.0

    # Residuals vs Run Order
    run_orders = list(range(1, n + 1))
    res_vs_order = [{"run_order": i, "residual": round(float(r), 4)} for i, r in zip(run_orders, residuals)]

    diag_dict = {
        "residuals":       [round(float(r), 6) for r in residuals],
        "studentized":     [round(float(r), 6) for r in std_res],
        "fitted":          [round(float(f), 6) for f in y_pred],
        "observed":        [round(float(o), 6) for o in y_obs],
        "qq_theoretical":  [round(float(q), 6) for q in theoretical_q],
        "qq_sample":       [round(float(r), 6) for r in sorted_res],
        "res_vs_order":    res_vs_order,
        "shapiro_stat":    round(float(sw_stat), 4),
        "shapiro_p":       round(float(sw_p),    4),
        "normality_ok":    bool(sw_p > 0.05),
        "RMSE":            round(float(np.sqrt(mse)), 6),
        "MAE":             round(float(np.mean(np.abs(residuals))), 6),
        "max_residual":    round(float(np.max(np.abs(residuals))), 6)
    }

    if X is not None:
        lof = calculate_lack_of_fit(X, y_obs, y_pred)
        diag_dict["lack_of_fit"] = lof

    return diag_dict


def leverage_and_influence(X: np.ndarray, y: np.ndarray,
                            y_pred: np.ndarray) -> Dict[str, Any]:
    """Compute hat matrix diagonal, Cook's distance, PRESS, and Pred R2."""
    n, p = X.shape
    try:
        H = X @ np.linalg.pinv(X.T @ X) @ X.T
        h = np.diag(H)  # leverage
    except Exception:
        h = np.full(n, p / n)

    residuals = y - y_pred
    mse = np.sum(residuals ** 2) / max(n - p, 1)
    # Cook's distance
    cooks = (residuals ** 2 * h) / (p * mse * (1 - h + 1e-12) ** 2)

    influential = np.where(cooks > 4 / n)[0].tolist()

    press_info = calculate_press_and_pred_r2(X, y, h)

    return {
        "leverage":         [round(float(v), 4) for v in h],
        "cooks_d":          [round(float(v), 4) for v in cooks],
        "influential_runs": [int(i + 1) for i in influential],
        "h_threshold":      round(float(2 * p / n), 4),
        "press":            press_info["press"],
        "pred_r2":          press_info["pred_r2"]
    }

