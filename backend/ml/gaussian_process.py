# ============================================================
#  ml/gaussian_process.py  –  GP Regression (scikit-learn)
# ============================================================
import numpy as np
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import (
    RBF, ConstantKernel as C, WhiteKernel, Matern
)
from sklearn.preprocessing import MinMaxScaler
from typing import List, Dict, Any, Optional, Tuple


def _normalize(X: np.ndarray, factors: list) -> Tuple[np.ndarray, MinMaxScaler]:
    """Normalize factor values to [0,1] using factor bounds."""
    bounds = np.array([[f["low"], f["high"]] for f in factors])
    X_norm = (X - bounds[:, 0]) / (bounds[:, 1] - bounds[:, 0] + 1e-12)
    return np.clip(X_norm, 0, 1)


import json

def _clean_val(val):
    if val is None: return None
    if isinstance(val, str):
        try: return json.loads(val)
        except Exception: return None
    return val

def _extract_response_val(rv, idx):
    if rv is None: return None
    if isinstance(rv, list):
        if len(rv) == 0: return None
        if idx < len(rv): return rv[idx]
        return rv[-1]
    try: return float(rv)
    except Exception: return None

def build_gp_model(experiments: list, response_idx: int,
                   factors: list) -> Optional[Dict[str, Any]]:
    """
    Fit a Gaussian Process to the available experimental data.
    Returns a serializable model bundle.
    """
    cleaned_exps = []
    n_factors = len(factors)
    for e in experiments:
        av = _clean_val(e.get("actual_values")) if isinstance(e, dict) else _clean_val(getattr(e, "actual_values", None))
        rv = _clean_val(e.get("result_values")) if isinstance(e, dict) else _clean_val(getattr(e, "result_values", None))
        if av is not None and rv is not None:
            av_list = list(av)
            if len(av_list) < n_factors:
                for f_idx in range(len(av_list), n_factors):
                    f = factors[f_idx]
                    low = f.low if hasattr(f, "low") else f.get("low", 0.0)
                    high = f.high if hasattr(f, "high") else f.get("high", 100.0)
                    av_list.append((low + high) / 2.0)
            elif len(av_list) > n_factors:
                av_list = av_list[:n_factors]
            cleaned_exps.append({"actual_values": av_list, "result_values": rv})

    valid = cleaned_exps
    if len(valid) < 3 or n_factors == 0:
        return None

    X_raw = np.array([e["actual_values"] for e in valid], dtype=float)
    y_raw_list = [_extract_response_val(e["result_values"], response_idx) for e in valid]
    mask = np.array([y is not None and not np.isnan(y) for y in y_raw_list])
    X_raw, y_raw = X_raw[mask], np.array([y for y in y_raw_list if y is not None and not np.isnan(y)], dtype=float)
    if len(y_raw) < 3 or X_raw.ndim != 2 or X_raw.shape[1] == 0:
        return None

    k = X_raw.shape[1]
    X_norm = _normalize(X_raw, factors)

    # Kernel: amplitude × Matérn-5/2 + noise
    # Constrain length scale bounds to [0.15, 5.0] in normalized space to prevent length scale collapse
    # and restrict noise level to avoid absorbing 90%+ of the response variance as white noise.
    kernel = (
        C(1.0, (1e-2, 1e2)) *
        Matern(length_scale=np.ones(k) * 0.5, length_scale_bounds=(0.15, 5.0), nu=2.5) +
        WhiteKernel(noise_level=0.01, noise_level_bounds=(1e-4, 0.05))
    )

    gpr = GaussianProcessRegressor(
        kernel=kernel,
        n_restarts_optimizer=10,
        normalize_y=True,
        random_state=42
    )
    try:
        gpr.fit(X_norm, y_raw)
    except Exception as fit_err:
        print(f"GPR fitting error: {fit_err}")
        return None

    # Serialize kernel params
    params = gpr.kernel_.get_params()
    safe_params = {k: float(v) if isinstance(v, (np.floating, float)) else str(v)
                   for k, v in params.items() if np.isscalar(v)}

    log_lik = -4.0
    try:
        log_lik = round(float(gpr.log_marginal_likelihood_value_), 4)
    except Exception:
        pass

    return {
        "gpr": gpr,            # not JSON-serializable, keep in memory
        "factors": factors,
        "X_raw": X_raw.tolist(),
        "y_raw": y_raw.tolist(),
        "X_norm": X_norm.tolist(),
        "n_obs": len(y_raw),
        "y_best": float(y_raw.max()),
        "y_mean": float(y_raw.mean()),
        "kernel_params": safe_params,
        "log_likelihood": log_lik
    }


def predict_gp(gp_bundle: dict, X_query_actual: np.ndarray
               ) -> Tuple[np.ndarray, np.ndarray]:
    """
    Predict GP posterior mean and std at query points (in actual space).
    """
    factors = gp_bundle["factors"]
    gpr     = gp_bundle["gpr"]
    X_norm  = _normalize(X_query_actual, factors)
    mu, sigma = gpr.predict(X_norm, return_std=True)
    return mu, sigma


def gp_1d_slice(gp_bundle: dict, factor_idx: int,
                n_grid: int = 40,
                reference_point: Optional[Any] = None) -> Dict[str, Any]:
    """
    Compute GP posterior along a 1D slice through a reference point (e.g. current best observation or baseline).
    All other factors are fixed at the reference point coordinates.
    """
    factors = gp_bundle["factors"]
    k       = len(factors)

    if reference_point is not None:
        ref = np.array(reference_point, dtype=float)
    elif "X_raw" in gp_bundle and len(gp_bundle["X_raw"]) > 0:
        y_raw = np.array(gp_bundle["y_raw"])
        best_idx = int(np.argmax(y_raw))
        ref = np.array(gp_bundle["X_raw"][best_idx], dtype=float)
    else:
        ref = np.array([(f["low"] + f["high"]) / 2.0 for f in factors], dtype=float)

    f  = factors[factor_idx]
    xs = np.linspace(f["low"], f["high"], n_grid)

    X_query = np.tile(ref, (n_grid, 1))
    X_query[:, factor_idx] = xs

    mu, sigma = predict_gp(gp_bundle, X_query)

    xs_rounded = [round(float(x), 3) for x in xs]
    mu_rounded = [round(float(m), 3) for m in mu]
    upper = [round(float(m + 1.96 * s), 3) for m, s in zip(mu, sigma)]
    lower = [round(float(m - 1.96 * s), 3) for m, s in zip(mu, sigma)]

    return {
        "x":     xs_rounded,
        "mean":  mu_rounded,
        "upper": upper,
        "lower": lower,
        "y_best": round(float(gp_bundle["y_best"]), 3),
        "factor_name": f["name"],
        "factor_unit": f.get("unit", ""),
        "reference_x": round(float(ref[factor_idx]), 3)
    }

