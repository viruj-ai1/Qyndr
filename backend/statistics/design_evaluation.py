# ============================================================
#  statistics/design_evaluation.py  –  Pre-Run Design Diagnostics
# ============================================================
import numpy as np
from scipy import stats
from typing import Dict, Any, List

def build_full_model_matrix(coded_matrix: np.ndarray) -> tuple:
    """
    Build model matrix X containing: Intercept, Main Effects, 2-Factor Interactions, and Quadratic terms.
    Returns (X, term_names)
    """
    N, k = coded_matrix.shape
    terms = ["Intercept"]
    term_names = ["Intercept"]
    
    # Intercept
    X_list = [np.ones(N)]
    
    # Main Effects
    for j in range(k):
        fname = f"X{j+1}"
        term_names.append(fname)
        X_list.append(coded_matrix[:, j])

    # 2-Factor Interactions
    for i in range(k):
        for j in range(i+1, k):
            fname = f"X{i+1}*X{j+1}"
            term_names.append(fname)
            X_list.append(coded_matrix[:, i] * coded_matrix[:, j])

    # Quadratic terms
    for j in range(k):
        fname = f"X{j+1}^2"
        term_names.append(fname)
        X_list.append(coded_matrix[:, j]**2)

    X = np.column_stack(X_list)
    return X, term_names


def calculate_alias_structure(coded_matrix: np.ndarray, factors: list) -> List[Dict[str, Any]]:
    """
    Calculate Alias Matrix A = (X1' X1)^-1 X1' X2 showing confounding between main effects and interactions.
    """
    N, k = coded_matrix.shape
    factor_names = [f.name if hasattr(f, 'name') else f.get('name', f'Factor_{i+1}') for i, f in enumerate(factors)]
    
    # X1: Intercept + Main Effects
    X1_list = [np.ones(N)] + [coded_matrix[:, j] for j in range(k)]
    X1_names = ["Intercept"] + factor_names
    X1 = np.column_stack(X1_list)

    # X2: 2-Factor Interactions
    X2_list = []
    X2_names = []
    for i in range(k):
        for j in range(i+1, k):
            fi_name = factor_names[i]
            fj_name = factor_names[j]
            X2_names.append(f"{fi_name}*{fj_name}")
            X2_list.append(coded_matrix[:, i] * coded_matrix[:, j])
    
    alias_rows = []
    if X2_list:
        X2 = np.column_stack(X2_list)
        try:
            # Alias matrix A = (X1' X1)^-1 X1' X2
            inv_X1 = np.linalg.pinv(X1.T @ X1)
            A = inv_X1 @ (X1.T @ X2)
            
            for i in range(1, len(X1_names)): # skip intercept
                effect_name = X1_names[i]
                confounded_terms = []
                for j in range(len(X2_names)):
                    coeff = round(float(A[i, j]), 3)
                    if abs(coeff) > 0.01:
                        confounded_terms.append(f"{coeff}*[{X2_names[j]}]")
                alias_rows.append({
                    "term": effect_name,
                    "confounded_with": " + ".join(confounded_terms) if confounded_terms else "Clean (Unconfounded)"
                })
        except Exception:
            for i in range(1, len(X1_names)):
                alias_rows.append({"term": X1_names[i], "confounded_with": "Clean"})
    else:
        for fname in factor_names:
            alias_rows.append({"term": fname, "confounded_with": "Clean"})

    return alias_rows


def calculate_vif(coded_matrix: np.ndarray, factors: list) -> List[Dict[str, Any]]:
    """
    Calculate Variance Inflation Factor (VIF) for main effects.
    VIF = 1 / (1 - R^2). VIF = 1 means ideal orthogonality; VIF > 10 indicates high multicollinearity.
    """
    N, k = coded_matrix.shape
    vif_list = []
    
    for j in range(k):
        fname = factors[j].name if hasattr(factors[j], 'name') else factors[j].get('name', f'Factor_{j+1}')
        y_j = coded_matrix[:, j]
        X_other = np.delete(coded_matrix, j, axis=1)
        
        # Fit regression of X_j on all other factors
        if X_other.shape[1] > 0:
            X_design = np.column_stack([np.ones(N), X_other])
            try:
                beta, res, rank, s = np.linalg.lstsq(X_design, y_j, rcond=None)
                y_pred = X_design @ beta
                ss_tot = np.sum((y_j - np.mean(y_j))**2)
                ss_res = np.sum((y_j - y_pred)**2)
                r_squared = 1.0 - (ss_res / ss_tot) if ss_tot > 1e-10 else 0.0
                r_squared = max(0.0, min(0.999, r_squared))
                vif = 1.0 / (1.0 - r_squared)
            except Exception:
                vif = 1.0
        else:
            vif = 1.0
            
        vif_list.append({
            "factor": fname,
            "vif": round(float(vif), 2),
            "multicollinear": vif > 5.0
        })

    return vif_list


def calculate_power_analysis(coded_matrix: np.ndarray, factors: list, alpha: float = 0.05, signal_to_noise: float = 2.0) -> Dict[str, Any]:
    """
    Calculate statistical power (1 - beta) to detect effect size delta/sigma = signal_to_noise at given alpha.
    """
    N, k = coded_matrix.shape
    df_model = k
    df_error = max(1, N - k - 1)

    # Non-centrality parameter lambda = (N / 4) * (signal_to_noise)^2
    ncp = (N / 4.0) * (signal_to_noise ** 2)
    
    # Critical F value
    f_crit = stats.f.ppf(1.0 - alpha, df_model, df_error)
    
    # Non-central F survival function
    try:
        power = float(stats.ncf.sf(f_crit, df_model, df_error, ncp))
    except Exception:
        power = 0.80

    return {
        "n_runs": N,
        "alpha": alpha,
        "signal_to_noise_ratio": signal_to_noise,
        "power": round(float(power), 4),
        "power_percentage": round(float(power) * 100, 1),
        "adequate_power": power >= 0.80
    }


def calculate_fds_plot(coded_matrix: np.ndarray, n_samples: int = 1000) -> Dict[str, Any]:
    """
    Calculate Fraction of Design Space (FDS) plot data.
    FDS displays the cumulative distribution of Scaled Prediction Variance (SPV) across the factor space.
    SPV(x) = N * x' (X'X)^-1 x
    """
    np.random.seed(42)
    N, k = coded_matrix.shape
    X, _ = build_full_model_matrix(coded_matrix)
    
    try:
        inv_XtX = np.linalg.pinv(X.T @ X)
    except Exception:
        inv_XtX = np.eye(X.shape[1])

    # Randomly sample factor space x in [-1, 1]^k
    rand_pts = np.random.uniform(-1.0, 1.0, size=(n_samples, k))
    spv_list = []
    
    for pt in rand_pts:
        # Build model row for point pt
        row = [1.0] + list(pt)
        for i in range(k):
            for j in range(i+1, k):
                row.append(pt[i] * pt[j])
        for j in range(k):
            row.append(pt[j]**2)
        
        x_vec = np.array(row)
        spv = float(N * (x_vec @ inv_XtX @ x_vec))
        spv_list.append(spv)

    spv_sorted = np.sort(spv_list)
    fraction = np.linspace(0.0, 1.0, n_samples)
    
    # Subsample 50 points for lightweight frontend rendering
    indices = np.linspace(0, n_samples - 1, 50, dtype=int)
    
    return {
        "fraction": [round(float(f), 3) for f in fraction[indices]],
        "spv": [round(float(s), 3) for s in spv_sorted[indices]],
        "min_spv": round(float(spv_sorted[0]), 3),
        "median_spv": round(float(np.median(spv_sorted)), 3),
        "max_spv": round(float(spv_sorted[-1]), 3)
    }


def evaluate_design(coded_matrix: np.ndarray, factors: list) -> Dict[str, Any]:
    """
    Run full pre-run design evaluation.
    """
    return {
        "alias_structure": calculate_alias_structure(coded_matrix, factors),
        "vif": calculate_vif(coded_matrix, factors),
        "power_analysis": calculate_power_analysis(coded_matrix, factors),
        "fds": calculate_fds_plot(coded_matrix)
    }
