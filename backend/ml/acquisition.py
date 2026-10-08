# ============================================================
#  ml/acquisition.py  –  Acquisition Functions for Bayesian Opt
# ============================================================
import numpy as np
from scipy.stats import norm
from typing import Dict, Any, List
from .gaussian_process import predict_gp, _normalize


def expected_improvement(mu: np.ndarray, sigma: np.ndarray,
                          y_best: float, xi: float = 0.01) -> np.ndarray:
    """
    Expected Improvement:
        EI(x) = (μ - f* - ξ)·Φ(Z) + σ·φ(Z)
        Z = (μ - f* - ξ) / σ
    """
    imp   = mu - y_best - xi
    sigma = np.maximum(sigma, 1e-9)
    Z     = imp / sigma
    ei    = imp * norm.cdf(Z) + sigma * norm.pdf(Z)
    return np.maximum(ei, 0.0)


def upper_confidence_bound(mu: np.ndarray, sigma: np.ndarray,
                            kappa: float = 2.576) -> np.ndarray:
    """UCB: μ + κ·σ (kappa=2.576 → 99% CI)"""
    return mu + kappa * sigma


def probability_of_improvement(mu: np.ndarray, sigma: np.ndarray,
                                y_best: float, xi: float = 0.0) -> np.ndarray:
    """PI: Φ((μ - f* - ξ) / σ)"""
    return norm.cdf((mu - y_best - xi) / np.maximum(sigma, 1e-9))


def find_next_experiment(gp_bundle: dict, factors: list,
                          acquisition: str = "EI",
                          n_grid: int = 15,
                          xi: float = 0.01) -> Dict[str, Any]:
    """
    Grid search over the factor space to find the point with maximum acquisition.
    Returns recommendation in actual (un-normalized) values.
    """
    k     = len(factors)
    y_best = gp_bundle["y_best"]

    # Build grid: n_grid points per factor
    axes   = [np.linspace(f["low"], f["high"], n_grid) for f in factors]
    grids  = np.meshgrid(*axes, indexing='ij')
    X_flat = np.column_stack([g.ravel() for g in grids])  # (n_grid^k, k)

    # Clip grid size for high-dimensional problems
    if len(X_flat) > 50_000:
        idx    = np.random.choice(len(X_flat), 50_000, replace=False)
        X_flat = X_flat[idx]

    mu, sigma = predict_gp(gp_bundle, X_flat)

    if acquisition == "EI":
        acq_vals = expected_improvement(mu, sigma, y_best, xi)
    elif acquisition == "UCB":
        acq_vals = upper_confidence_bound(mu, sigma)
    elif acquisition == "PI":
        acq_vals = probability_of_improvement(mu, sigma, y_best, xi)
    else:
        acq_vals = expected_improvement(mu, sigma, y_best, xi)

    best_idx  = int(np.argmax(acq_vals))
    best_x    = X_flat[best_idx]
    best_mu   = float(mu[best_idx])
    best_sig  = float(sigma[best_idx])
    best_acq  = float(acq_vals[best_idx])

    return {
        "actual_values":      [round(float(v), 4) for v in best_x],
        "predicted_mean":     round(best_mu, 4),
        "predicted_std":      round(best_sig, 4),
        "expected_improvement": round(best_acq, 6),
        "confidence_95":      [
            round(best_mu - 1.96 * best_sig, 4),
            round(best_mu + 1.96 * best_sig, 4)
        ],
        "acquisition_type":   acquisition,
        "xi":                 xi
    }


def ei_surface(gp_bundle: dict, factors: list,
               factor_x: int, factor_y: int,
               n_grid: int = 20) -> Dict[str, Any]:
    """2D EI surface for visualization (fixing all other factors at midpoint)."""
    k = len(factors)
    xs = np.linspace(factors[factor_x]["low"], factors[factor_x]["high"], n_grid)
    ys = np.linspace(factors[factor_y]["low"], factors[factor_y]["high"], n_grid)

    midpoints = [(f["low"] + f["high"]) / 2 for f in factors]
    X_query   = []
    for xi_v in xs:
        for yi_v in ys:
            pt      = list(midpoints)
            pt[factor_x] = float(xi_v)
            pt[factor_y] = float(yi_v)
            X_query.append(pt)

    X_query = np.array(X_query)
    mu, sigma = predict_gp(gp_bundle, X_query)
    ei = expected_improvement(mu, sigma, gp_bundle["y_best"])

    ei_grid = ei.reshape(n_grid, n_grid).tolist()
    mu_grid = mu.reshape(n_grid, n_grid).tolist()

    return {
        "x_values":   xs.tolist(),
        "y_values":   ys.tolist(),
        "ei_grid":    ei_grid,
        "mu_grid":    mu_grid,
        "factor_x_name": factors[factor_x]["name"],
        "factor_y_name": factors[factor_y]["name"]
    }
