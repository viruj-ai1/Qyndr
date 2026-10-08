# ============================================================
#  statistics/anova.py  –  ANOVA for factorial experiments
# ============================================================
import numpy as np
from scipy import stats
from typing import List, Dict, Any


def _contrast_vector(coded: np.ndarray, factor_idx: int) -> np.ndarray:
    """Return ±1 contrast vector for a factor column."""
    return coded[:, factor_idx]


def main_effects(coded: np.ndarray, y: np.ndarray) -> Dict[str, float]:
    """
    Estimate main effects for a 2-level factorial.
    Effect_j = mean(y at high) − mean(y at low)
    """
    k = coded.shape[1]
    effects = {}
    for j in range(k):
        c = coded[:, j]
        hi = y[c > 0]
        lo = y[c < 0]
        e = (hi.mean() if len(hi) else 0) - (lo.mean() if len(lo) else 0)
        effects[f"X{j+1}"] = float(e)
    return effects


def interaction_effects(coded: np.ndarray, y: np.ndarray) -> Dict[str, float]:
    """2-factor interaction effects."""
    k = coded.shape[1]
    effects = {}
    for j1 in range(k - 1):
        for j2 in range(j1 + 1, k):
            c = coded[:, j1] * coded[:, j2]
            hi = y[c > 0]
            lo = y[c < 0]
            e = (hi.mean() if len(hi) else 0) - (lo.mean() if len(lo) else 0)
            effects[f"X{j1+1}:X{j2+1}"] = float(e)
    return effects


def anova_2level(coded: np.ndarray, y: np.ndarray,
                 include_interactions: bool = True) -> Dict[str, Any]:
    """
    Full ANOVA for a 2-level (±1 coded) factorial experiment.
    Returns effects, SS, MS, F, p-value per term.
    """
    n = len(y)
    k = coded.shape[1]
    y_mean = y.mean()
    ss_total = float(np.sum((y - y_mean) ** 2))

    # Identify center points (coded all zero)
    center_mask = np.all(coded == 0, axis=1)
    factorial_mask = ~center_mask
    n_fact = factorial_mask.sum()

    # Pure error from center points
    y_center = y[center_mask]
    n_c = len(y_center)
    ss_pe = float(np.sum((y_center - y_center.mean()) ** 2)) if n_c >= 2 else 0.0
    df_pe = max(n_c - 1, 1)
    ms_pe = ss_pe / df_pe if df_pe > 0 else 1e-10

    all_effects = {**main_effects(coded[factorial_mask], y[factorial_mask])}
    if include_interactions:
        all_effects.update(interaction_effects(coded[factorial_mask], y[factorial_mask]))

    rows = []
    ss_model = 0.0
    for term, eff in all_effects.items():
        ss = n_fact * eff ** 2 / 4.0
        ms = ss
        F  = ms / ms_pe if ms_pe > 0 else 0.0
        p  = float(1 - stats.f.cdf(F, 1, df_pe)) if F > 0 else 1.0
        ss_model += ss
        rows.append({
            "term": term,
            "effect": round(eff, 6),
            "SS": round(ss, 6),
            "df": 1,
            "MS": round(ms, 6),
            "F": round(F, 4),
            "p_value": round(p, 4),
            "significant": bool(p < 0.05)
        })

    rows.sort(key=lambda r: abs(r["effect"]), reverse=True)

    ss_residual = ss_total - ss_model
    df_residual = max(n - len(rows) - 1, 1)
    R2 = ss_model / ss_total if ss_total > 0 else 0.0

    # Lack-of-fit vs pure error
    ss_lof  = max(0.0, ss_residual - ss_pe)
    df_lof  = max(df_residual - df_pe, 1)
    ms_lof  = ss_lof / df_lof if df_lof > 0 else 0
    F_lof   = ms_lof / ms_pe if ms_pe > 0 else 0
    p_lof   = float(1 - stats.f.cdf(F_lof, df_lof, df_pe)) if F_lof > 0 else 1.0

    return {
        "rows": rows,
        "ss_total":    round(ss_total,    6),
        "ss_model":    round(ss_model,    6),
        "ss_residual": round(ss_residual, 6),
        "ss_pure_error": round(ss_pe,     6),
        "ss_lack_of_fit": round(ss_lof,   6),
        "df_model":    len(rows),
        "df_residual": df_residual,
        "df_pe":       df_pe,
        "ms_pe":       round(ms_pe,       6),
        "F_lof":       round(F_lof,       4),
        "p_lof":       round(p_lof,       4),
        "R2":          round(R2,          4),
        "y_mean":      round(float(y_mean), 4),
        "n":           n
    }
