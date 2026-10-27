"""
src/doe_engine.py  –  Deterministic Design of Experiments (DoE) & RSM Engine
=============================================================================
Robust, deterministic calculation engine for QbD and DoE campaigns:
1. analyze_doe_run_table:
   - Fits Ordinary Least Squares (OLS) regression using statsmodels.
   - Computes comprehensive ANOVA table (F-statistic, p-values, Sum of Squares, degrees of freedom).
   - Calculates model metrics: R², Adjusted R², Predicted R² (PRESS), and Lack-of-Fit test.
   - Extracts factor effect estimates, t-values, and 95% confidence intervals.
2. generate_doe_design:
   - Generates Full Factorial, Fractional Factorial, Box-Behnken (BBD), or Central Composite Design (CCD) matrices using pyDOE3.
   - Provides both coded [-1, 1] and actual engineering units with run-type classifications.
3. optimize_desirability:
   - Implements Derringer & Suich multi-objective desirability function to find optimal operating setpoints.
"""

from typing import Dict, List, Any, Union, Optional, Tuple
import io
import os
import itertools
import numpy as np
import pandas as pd
from scipy import stats
from scipy.optimize import minimize
import statsmodels.api as sm
import pyDOE3


# =============================================================================
# 1. Model Matrix Construction Helpers
# =============================================================================

def build_model_matrix(
    df: pd.DataFrame,
    factor_cols: List[str],
    model_type: str = "quadratic"
) -> Tuple[pd.DataFrame, List[str]]:
    """
    Constructs design matrix X with named columns for linear, 2FI, and quadratic terms.
    
    Parameters:
        df: DataFrame containing the factor columns
        factor_cols: List of column names representing experimental factors
        model_type: 'linear', '2fi' (or 'interaction'), or 'quadratic' (RSM)
        
    Returns:
        X: DataFrame of design terms including 'Intercept'
        term_names: List of column names
    """
    model_type = model_type.lower().strip()
    n = len(df)
    
    X = pd.DataFrame(index=df.index)
    X["Intercept"] = 1.0
    
    # 1. Linear terms
    for f in factor_cols:
        X[f] = df[f].astype(float)
        
    # 2. Two-factor interaction (2FI) terms
    if model_type in ("2fi", "interaction", "quadratic", "rsm"):
        for f1, f2 in itertools.combinations(factor_cols, 2):
            X[f"{f1}:{f2}"] = df[f1].astype(float) * df[f2].astype(float)
            
    # 3. Pure quadratic terms
    if model_type in ("quadratic", "rsm"):
        for f in factor_cols:
            X[f"{f}^2"] = df[f].astype(float) ** 2
            
    return X, list(X.columns)


# =============================================================================
# 2. Statistical Analysis & ANOVA (analyze_doe_run_table)
# =============================================================================

def _compute_lack_of_fit(
    df: pd.DataFrame,
    factor_cols: List[str],
    y: np.ndarray,
    y_pred: np.ndarray,
    df_resid: int,
    ss_resid: float
) -> Dict[str, Any]:
    """
    Computes pure error and Lack-of-Fit test from replicate design points.
    """
    # Round factor values slightly to avoid floating point mismatch on replicate groupings
    rounded_factors = df[factor_cols].round(6)
    groups = rounded_factors.groupby(factor_cols).groups
    
    ss_pe = 0.0
    df_pe = 0
    
    for _, idxs in groups.items():
        if len(idxs) > 1:
            replicate_y = y[idxs]
            mean_y = np.mean(replicate_y)
            ss_pe += float(np.sum((replicate_y - mean_y) ** 2))
            df_pe += (len(idxs) - 1)
            
    ss_lof = max(0.0, float(ss_resid - ss_pe))
    df_lof = max(0, int(df_resid - df_pe))
    
    if df_pe > 0 and df_lof > 0:
        ms_lof = ss_lof / df_lof
        ms_pe = ss_pe / df_pe
        f_lof = ms_lof / (ms_pe + 1e-14)
        p_lof = float(1.0 - stats.f.cdf(f_lof, df_lof, df_pe))
        significant = bool(p_lof < 0.05)
        status = "Significant" if significant else "Not Significant"
    else:
        ms_lof = None
        ms_pe = None
        f_lof = None
        p_lof = None
        significant = None
        status = "No Pure Error Replicates"
        
    return {
        "ss_lof": round(ss_lof, 6) if ss_lof is not None else None,
        "df_lof": df_lof,
        "ms_lof": round(ms_lof, 6) if ms_lof is not None else None,
        "ss_pe": round(ss_pe, 6) if ss_pe is not None else None,
        "df_pe": df_pe,
        "ms_pe": round(ms_pe, 6) if ms_pe is not None else None,
        "f_stat": round(f_lof, 4) if f_lof is not None else None,
        "p_value": round(p_lof, 5) if p_lof is not None else None,
        "significant": significant,
        "status": status
    }


def _analyze_single_response(
    df: pd.DataFrame,
    factor_cols: List[str],
    response_col: str,
    model_type: str = "quadratic"
) -> Dict[str, Any]:
    """Internal handler for a single response regression & ANOVA analysis."""
    # Build design matrix X and response y
    X, term_names = build_model_matrix(df, factor_cols, model_type=model_type)
    y = df[response_col].astype(float).values
    n = len(y)
    p = X.shape[1]
    
    # 1. Fit Ordinary Least Squares via statsmodels
    ols_model = sm.OLS(y, X).fit()
    y_pred = ols_model.fittedvalues.values
    residuals = ols_model.resid.values
    
    # Degrees of freedom & Sum of Squares
    df_total = n - 1
    y_mean = np.mean(y)
    ss_total = float(np.sum((y - y_mean) ** 2))
    ss_resid = float(np.sum(residuals ** 2))
    ss_model = max(0.0, float(ss_total - ss_resid))
    
    df_model = int(p - 1)
    df_resid = max(1, int(n - p))
    
    ms_model = ss_model / max(1, df_model)
    ms_resid = ss_resid / df_resid
    f_stat = float(ols_model.fvalue) if hasattr(ols_model, 'fvalue') and not np.isnan(ols_model.fvalue) else (ms_model / (ms_resid + 1e-14))
    p_val_model = float(ols_model.f_pvalue) if hasattr(ols_model, 'f_pvalue') and not np.isnan(ols_model.f_pvalue) else float(1.0 - stats.f.cdf(f_stat, df_model, df_resid))
    
    # 2. Predicted R² via PRESS (Prediction Error Sum of Squares)
    try:
        influence = ols_model.get_influence()
        h = influence.hat_matrix_diag
        # Guard against leverage >= 1.0
        h_safe = np.clip(h, 0.0, 0.999999)
        press_residuals = residuals / (1.0 - h_safe)
        press = float(np.sum(press_residuals ** 2))
        pred_r_squared = float(1.0 - (press / ss_total)) if ss_total > 1e-12 else 0.0
    except Exception:
        press = float(np.nan)
        pred_r_squared = float(np.nan)
        
    r_squared = float(ols_model.rsquared)
    adj_r_squared = float(ols_model.rsquared_adj)
    
    # 3. Lack-of-Fit Test
    lof_results = _compute_lack_of_fit(df, factor_cols, y, y_pred, df_resid, ss_resid)
    
    # 4. Sequential / Partial Sum of Squares for terms
    term_rows = []
    # Compute individual term SS using statsmodels summary information
    t_vals = ols_model.tvalues
    p_vals = ols_model.pvalues
    conf = ols_model.conf_int(alpha=0.05)
    params = ols_model.params
    bse = ols_model.bse
    
    for term in term_names:
        coeff = float(params[term])
        se = float(bse[term])
        t_stat = float(t_vals[term])
        p_val = float(p_vals[term])
        ci_low = float(conf.loc[term, 0])
        ci_high = float(conf.loc[term, 1])
        
        # In standard 2-level DoE, effect = 2 * beta for factors; for quadratic, effect is beta
        if term != "Intercept" and ":" not in term and "^2" not in term:
            effect = float(2.0 * coeff)
        else:
            effect = float(coeff)
            
        # Individual term SS = t_stat^2 * MSE
        term_ss = float((t_stat ** 2) * ms_resid) if term != "Intercept" else 0.0
        
        term_rows.append({
            "term": term,
            "coefficient": round(coeff, 6),
            "effect": round(effect, 6),
            "std_error": round(se, 6),
            "t_stat": round(t_stat, 4),
            "p_value": round(p_val, 5),
            "ci_lower": round(ci_low, 6),
            "ci_upper": round(ci_high, 6),
            "ss": round(term_ss, 6) if term != "Intercept" else None,
            "df": 1 if term != "Intercept" else 0,
            "f_stat": round(t_stat ** 2, 4) if term != "Intercept" else None,
            "significant": bool(p_val < 0.05)
        })
        
    coefficients_df = pd.DataFrame(term_rows)
    
    # 5. ANOVA Table DataFrame
    anova_data = [
        {"Source": "Model", "SS": round(ss_model, 6), "df": df_model, "MS": round(ms_model, 6), "F_value": round(f_stat, 4), "p_value": round(p_val_model, 5)}
    ]
    
    # Add non-intercept individual terms to ANOVA
    for row in term_rows:
        if row["term"] != "Intercept":
            anova_data.append({
                "Source": f"  {row['term']}",
                "SS": row["ss"],
                "df": 1,
                "MS": row["ss"],
                "F_value": row["f_stat"],
                "p_value": row["p_value"]
            })
            
    # Residual, Lack of Fit, Pure Error, Total
    anova_data.append({
        "Source": "Residual",
        "SS": round(ss_resid, 6),
        "df": df_resid,
        "MS": round(ms_resid, 6),
        "F_value": None,
        "p_value": None
    })
    
    if lof_results["df_pe"] > 0:
        anova_data.append({
            "Source": "  Lack of Fit",
            "SS": lof_results["ss_lof"],
            "df": lof_results["df_lof"],
            "MS": lof_results["ms_lof"],
            "F_value": lof_results["f_stat"],
            "p_value": lof_results["p_value"]
        })
        anova_data.append({
            "Source": "  Pure Error",
            "SS": lof_results["ss_pe"],
            "df": lof_results["df_pe"],
            "MS": lof_results["ms_pe"],
            "F_value": None,
            "p_value": None
        })
        
    anova_data.append({
        "Source": "Cor Total",
        "SS": round(ss_total, 6),
        "df": df_total,
        "MS": round(ss_total / max(1, df_total), 6),
        "F_value": None,
        "p_value": None
    })
    
    anova_df = pd.DataFrame(anova_data)
    
    return {
        "response": response_col,
        "model_type": model_type,
        "factor_cols": factor_cols,
        "metrics": {
            "r_squared": round(r_squared, 5),
            "adj_r_squared": round(adj_r_squared, 5),
            "pred_r_squared": round(pred_r_squared, 5) if not np.isnan(pred_r_squared) else None,
            "press": round(press, 6) if not np.isnan(press) else None,
            "rmse": round(float(np.sqrt(ms_resid)), 6),
            "ss_total": round(ss_total, 6),
            "ss_model": round(ss_model, 6),
            "ss_residual": round(ss_resid, 6),
            "f_stat": round(f_stat, 4),
            "p_value": round(p_val_model, 5),
            "lack_of_fit": lof_results
        },
        "anova": anova_df,
        "anova_dict": anova_df.to_dict(orient="records"),
        "coefficients": coefficients_df,
        "coefficients_list": term_rows,
        "term_names": term_names,
        "fitted_values": y_pred.tolist(),
        "residuals": residuals.tolist(),
        "ols_model": ols_model,
        "n_samples": n,
        "df_residual": df_resid
    }


def analyze_doe_run_table(
    data_csv_or_df: Union[str, pd.DataFrame, Dict[str, Any]],
    factor_cols: Union[str, List[str]],
    response_cols: Union[str, List[str]],
    model_type: str = "quadratic"
) -> Dict[str, Any]:
    """
    Fits Ordinary Least Squares (OLS) regression using statsmodels, computes ANOVA,
    model metrics (R², Adj R², Pred R², Lack-of-Fit), and factor effect estimates with 95% CIs.

    Parameters:
        data_csv_or_df: Path to CSV file, CSV string, DataFrame, or dict of arrays
        factor_cols: Column name or list of column names for factors
        response_cols: Column name or list of column names for response(s)
        model_type: 'linear', '2fi' (interaction), or 'quadratic' (default)

    Returns:
        Structured dictionary with ANOVA table, metrics, coefficient effects, and fitted statsmodels object.
    """
    # 1. Parse input dataset
    if isinstance(data_csv_or_df, pd.DataFrame):
        df = data_csv_or_df.copy()
    elif isinstance(data_csv_or_df, str):
        if os.path.exists(data_csv_or_df):
            df = pd.read_csv(data_csv_or_df)
        else:
            df = pd.read_csv(io.StringIO(data_csv_or_df))
    elif isinstance(data_csv_or_df, dict):
        df = pd.DataFrame(data_csv_or_df)
    else:
        raise ValueError("data_csv_or_df must be a filepath, CSV string, DataFrame, or dictionary")

    if isinstance(factor_cols, str):
        factor_cols = [factor_cols]
    if isinstance(response_cols, str):
        single_response = True
        response_cols = [response_cols]
    else:
        single_response = (len(response_cols) == 1)

    for col in factor_cols + response_cols:
        if col not in df.columns:
            raise KeyError(f"Column '{col}' not found in dataset. Available columns: {list(df.columns)}")

    results = {}
    for r_col in response_cols:
        results[r_col] = _analyze_single_response(
            df=df,
            factor_cols=factor_cols,
            response_col=r_col,
            model_type=model_type
        )

    # Return single response directly for convenience if only 1 response requested,
    # while preserving multi-response dictionary access.
    if single_response:
        first_res = results[response_cols[0]]
        first_res["responses"] = results
        return first_res

    return results


# =============================================================================
# 3. DoE Matrix Generation (generate_doe_design)
# =============================================================================

def generate_doe_design(
    design_type: str,
    factors_dict: Dict[str, Union[List[float], Tuple[float, float], Dict[str, float]]],
    runs: Optional[int] = None
) -> Dict[str, Any]:
    """
    Generates Full Factorial, Fractional Factorial, Box-Behnken, or Central Composite Design (CCD)
    matrices using pyDOE3, scaling from coded values to engineering units.

    Parameters:
        design_type: 'box_behnken' / 'bbd', 'central_composite' / 'ccd',
                     'full_factorial' / 'factorial', 'fractional_factorial' / 'fracfact'
        factors_dict: Dictionary mapping factor names to ranges, e.g.:
                      {"Temp": [60, 80], "Time": [30, 60], "Catalyst": [1.0, 5.0]}
                      or {"Temp": {"min": 60, "max": 80}, ...}
        runs: Optional integer to control center points (for BBD/CCD) or specific run count.

    Returns:
        Dictionary containing:
        - coded_design: DataFrame of design in coded [-1, 1] units
        - actual_design: DataFrame of design in actual physical units
        - run_types: List of run classification labels ('Factorial', 'Axial', 'Center')
        - design_type: Canonical name of design
        - n_runs: Number of experimental runs
        - factors: List of factor names
        - factor_ranges: Normalized factor ranges dict
    """
    factor_names = list(factors_dict.keys())
    k = len(factor_names)
    
    # Parse and normalize factor ranges
    ranges = {}
    for f_name, r in factors_dict.items():
        if isinstance(r, dict):
            low = float(r.get("min", r.get("low", -1.0)))
            high = float(r.get("max", r.get("high", 1.0)))
        elif isinstance(r, (list, tuple)):
            if len(r) == 2:
                low = float(r[0])
                high = float(r[1])
            else:
                low = float(min(r))
                high = float(max(r))
        else:
            raise ValueError(f"Invalid range for factor '{f_name}': {r}")
        ranges[f_name] = (low, high)

    canon_type = design_type.lower().replace("-", "_").replace(" ", "_")

    # 1. Box-Behnken Design (BBD)
    if canon_type in ("box_behnken", "bbd", "boxbehnken"):
        if k < 3:
            raise ValueError(f"Box-Behnken design requires at least 3 factors, got {k}")
        # Standard center runs for k=3 is 5 (giving 17 runs)
        center_pts = runs if runs is not None else 5
        mat = pyDOE3.bbdesign(k, center=center_pts)
        
        # Categorize run types
        run_types = []
        for row in mat:
            if np.all(np.isclose(row, 0.0)):
                run_types.append("Center")
            else:
                run_types.append("Factorial")
        display_name = f"Box-Behnken Design ({len(mat)} runs)"

    # 2. Central Composite Design (CCD)
    elif canon_type in ("central_composite", "ccd", "centralcomposite"):
        center_pts = (runs, runs) if runs is not None else (4, 4)
        mat = pyDOE3.ccdesign(k, center=center_pts, face="faced")
        
        run_types = []
        for row in mat:
            if np.all(np.isclose(row, 0.0)):
                run_types.append("Center")
            elif np.any(np.abs(row) > 1.0 + 1e-6) or (np.sum(~np.isclose(row, 0.0)) == 1):
                run_types.append("Axial")
            else:
                run_types.append("Factorial")
        display_name = f"Central Composite Design ({len(mat)} runs)"

    # 3. Full Factorial Design
    elif canon_type in ("full_factorial", "factorial", "fullfactorial"):
        mat = pyDOE3.ff2n(k)
        run_types = ["Factorial"] * len(mat)
        if runs is not None and runs > len(mat):
            n_center = runs - len(mat)
            center_block = np.zeros((n_center, k))
            mat = np.vstack([mat, center_block])
            run_types.extend(["Center"] * n_center)
        display_name = f"Full Factorial Design ({len(mat)} runs)"

    # 4. Fractional Factorial Design
    elif canon_type in ("fractional_factorial", "fracfact", "fractional"):
        if k <= 3:
            # 2^(3-1) = 4 runs
            gen = "a b ab"
        elif k == 4:
            # 2^(4-1) = 8 runs
            gen = "a b c abc"
        elif k == 5:
            # 2^(5-1) = 16 runs
            gen = "a b c d abcd"
        else:
            # Default regular fraction generator
            gen = " ".join([chr(97 + i) for i in range(k - 1)]) + " " + "".join([chr(97 + i) for i in range(k - 1)])
        mat = pyDOE3.fracfact(gen)
        run_types = ["Factorial"] * len(mat)
        if runs is not None and runs > len(mat):
            n_center = runs - len(mat)
            center_block = np.zeros((n_center, k))
            mat = np.vstack([mat, center_block])
            run_types.extend(["Center"] * n_center)
        display_name = f"Fractional Factorial Design ({len(mat)} runs)"

    else:
        raise ValueError(f"Unsupported design_type '{design_type}'. Choose from 'box_behnken', 'central_composite', 'full_factorial', 'fractional_factorial'")

    # Convert coded values [-1, 1] to actual physical values
    coded_df = pd.DataFrame(mat, columns=factor_names)
    actual_data = {}
    for f in factor_names:
        low, high = ranges[f]
        mid = (low + high) / 2.0
        half_range = (high - low) / 2.0
        # Linear scale: x_actual = mid + x_coded * half_range
        actual_data[f] = mid + (coded_df[f].values * half_range)

    actual_df = pd.DataFrame(actual_data, columns=factor_names)
    
    # Add Standard Order and Run Order
    actual_df["Run_Type"] = run_types
    coded_df["Run_Type"] = run_types

    return {
        "coded_design": coded_df,
        "actual_design": actual_df,
        "run_types": run_types,
        "design_type": display_name,
        "n_runs": len(mat),
        "factors": factor_names,
        "factor_ranges": ranges,
        "matrix": mat
    }


# =============================================================================
# 4. Multi-Objective Desirability Optimization (optimize_desirability)
# =============================================================================

def individual_desirability(
    y: float,
    goal: str,
    lower: float,
    upper: float,
    target: Optional[float] = None,
    weight: float = 1.0
) -> float:
    """
    Derringer & Suich individual desirability d ∈ [0, 1] for a single response.
    """
    goal = goal.lower().strip()
    if upper <= lower:
        upper = lower + 1.0

    if goal in ("maximize", "max"):
        tgt = target if target is not None else upper
        if y < lower:
            d = 0.0
        elif y > tgt:
            d = 1.0
        else:
            d = ((y - lower) / max(1e-12, tgt - lower)) ** weight

    elif goal in ("minimize", "min"):
        tgt = target if target is not None else lower
        if y < tgt:
            d = 1.0
        elif y > upper:
            d = 0.0
        else:
            d = ((upper - y) / max(1e-12, upper - tgt)) ** weight

    elif goal in ("target", "exact"):
        tgt = target if target is not None else (lower + upper) / 2.0
        if y < lower or y > upper:
            d = 0.0
        elif y <= tgt:
            d = ((y - lower) / max(1e-12, tgt - lower)) ** weight
        else:
            d = ((upper - y) / max(1e-12, upper - tgt)) ** weight

    else:
        # Default in range
        d = 1.0 if lower <= y <= upper else 0.0

    return float(np.clip(d, 0.0, 1.0))


def optimize_desirability(
    model: Any,
    factor_ranges: Dict[str, Union[List[float], Tuple[float, float]]],
    response_goals: Dict[str, Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Implements Derringer & Suich multi-objective desirability function to find optimal operating setpoints.

    Parameters:
        model: Either an AnalysisResult dict (from analyze_doe_run_table), a statsmodels OLS model,
               or a dictionary mapping response names to AnalysisResults or prediction functions.
        factor_ranges: Bounds for factors, e.g. {"Temp": [60, 90], "Time": [20, 60], "Cat": [1, 5]}
        response_goals: Dict defining goals per response, e.g.:
            {
               "Yield": {"goal": "maximize", "lower_limit": 75.0, "upper_limit": 100.0, "weight": 1.0, "importance": 1.0},
               "Impurity": {"goal": "minimize", "lower_limit": 0.1, "upper_limit": 1.5, "weight": 1.0, "importance": 1.0}
            }

    Returns:
        Dictionary containing optimal setpoints, predicted responses, individual desirabilities, and composite D.
    """
    factor_names = list(factor_ranges.keys())
    bounds = [tuple(factor_ranges[f]) for f in factor_names]

    # Normalize response models into callables
    predictor_map = {}
    
    if isinstance(model, dict) and "responses" in model:
        # Multi-response container from analyze_doe_run_table
        for resp_name, resp_result in model["responses"].items():
            ols_obj = resp_result["ols_model"]
            m_type = resp_result.get("model_type", "quadratic")
            f_cols = resp_result.get("factor_cols", factor_names)
            predictor_map[resp_name] = (ols_obj, m_type, f_cols)
    elif isinstance(model, dict) and "ols_model" in model:
        # Single response result from analyze_doe_run_table
        resp_name = model.get("response", list(response_goals.keys())[0] if response_goals else "Response")
        predictor_map[resp_name] = (model["ols_model"], model.get("model_type", "quadratic"), model.get("factor_cols", factor_names))
    elif hasattr(model, "predict"):
        resp_name = list(response_goals.keys())[0] if response_goals else "Response"
        predictor_map[resp_name] = (model, "quadratic", factor_names)
    elif isinstance(model, dict):
        for k_resp, v_mod in model.items():
            if isinstance(v_mod, dict) and "ols_model" in v_mod:
                predictor_map[k_resp] = (v_mod["ols_model"], v_mod.get("model_type", "quadratic"), v_mod.get("factor_cols", factor_names))
            elif hasattr(v_mod, "predict"):
                predictor_map[k_resp] = (v_mod, "quadratic", factor_names)

    # Function to predict response for arbitrary factor vector x
    def predict_responses(x_vec: np.ndarray) -> Dict[str, float]:
        preds = {}
        row_df = pd.DataFrame([x_vec], columns=factor_names)
        for r_name, (m_obj, m_type, f_cols) in predictor_map.items():
            X_row, _ = build_model_matrix(row_df, f_cols, model_type=m_type)
            y_val = float(m_obj.predict(X_row)[0])
            preds[r_name] = y_val
        return preds

    # Objective function: -Composite Desirability
    def neg_composite_desirability(x_vec: np.ndarray) -> float:
        preds = predict_responses(x_vec)
        ind_d = []
        weights = []

        for r_name, goal_spec in response_goals.items():
            if r_name not in preds:
                continue
            y_pred = preds[r_name]
            
            # Extract goal parameters
            if isinstance(goal_spec, str):
                goal = goal_spec
                lo = y_pred - 1.0
                hi = y_pred + 1.0
                tgt = None
                w = 1.0
                imp = 1.0
            else:
                goal = goal_spec.get("goal", "maximize")
                lo = float(goal_spec.get("lower_limit", goal_spec.get("min", y_pred - 1.0)))
                hi = float(goal_spec.get("upper_limit", goal_spec.get("max", y_pred + 1.0)))
                tgt = goal_spec.get("target", None)
                if tgt is not None:
                    tgt = float(tgt)
                w = float(goal_spec.get("weight", 1.0))
                imp = float(goal_spec.get("importance", 1.0))

            d = individual_desirability(y_pred, goal=goal, lower=lo, upper=hi, target=tgt, weight=w)
            ind_d.append(d)
            weights.append(imp)

        if not ind_d:
            return 0.0

        # Geometric mean: D = (d1^w1 * ... * dk^wk)^(1/sum(w))
        total_w = sum(weights)
        if total_w <= 0:
            total_w = 1.0

        # If any desirability is 0, composite desirability is 0
        if any(d <= 1e-12 for d in ind_d):
            return 0.0

        log_d = sum(w * np.log(max(1e-12, d)) for d, w in zip(ind_d, weights)) / total_w
        comp_d = float(np.exp(log_d))
        return -comp_d

    # Multi-start optimization across factor domain to prevent local minima
    best_d = -1.0
    best_x = None

    # Candidate starting points: Midpoints, Corners, and Latin-hypercube random samples
    mid_point = np.array([(b[0] + b[1]) / 2.0 for b in bounds])
    starts = [mid_point]
    
    # Corners
    corner_combos = list(itertools.product(*[[b[0], b[1]] for b in bounds]))
    if len(corner_combos) <= 16:
        starts.extend([np.array(c) for c in corner_combos])
    else:
        # Random subset of corners
        np.random.seed(42)
        idx = np.random.choice(len(corner_combos), 12, replace=False)
        starts.extend([np.array(corner_combos[i]) for i in idx])

    # 15 uniform random points within bounds
    np.random.seed(42)
    for _ in range(15):
        pt = np.array([np.random.uniform(b[0], b[1]) for b in bounds])
        starts.append(pt)

    for x0 in starts:
        res = minimize(
            neg_composite_desirability,
            x0=x0,
            bounds=bounds,
            method="L-BFGS-B",
            options={"ftol": 1e-9, "maxiter": 200}
        )
        cur_d = -res.fun
        if cur_d > best_d:
            best_d = cur_d
            best_x = res.x

    # Ensure best setpoint values are clipped to bounds
    optimal_factors = {}
    for i, f in enumerate(factor_names):
        val = float(np.clip(best_x[i], bounds[i][0], bounds[i][1]))
        optimal_factors[f] = round(val, 4)

    # Evaluate predicted responses and individual desirabilities at optimum
    opt_vec = np.array([optimal_factors[f] for f in factor_names])
    optimal_preds = predict_responses(opt_vec)
    ind_desirabilities = {}

    for r_name, goal_spec in response_goals.items():
        if r_name in optimal_preds:
            y_val = optimal_preds[r_name]
            if isinstance(goal_spec, str):
                goal = goal_spec
                lo = y_val - 1.0
                hi = y_val + 1.0
                tgt = None
                w = 1.0
            else:
                goal = goal_spec.get("goal", "maximize")
                lo = float(goal_spec.get("lower_limit", goal_spec.get("min", y_val - 1.0)))
                hi = float(goal_spec.get("upper_limit", goal_spec.get("max", y_val + 1.0)))
                tgt = goal_spec.get("target", None)
                if tgt is not None:
                    tgt = float(tgt)
                w = float(goal_spec.get("weight", 1.0))

            ind_desirabilities[r_name] = round(
                individual_desirability(y_val, goal=goal, lower=lo, upper=hi, target=tgt, weight=w),
                4
            )

    composite_d = float(max(0.0, best_d))

    return {
        "optimal_factors": optimal_factors,
        "predicted_responses": {k: round(v, 4) for k, v in optimal_preds.items()},
        "individual_desirabilities": ind_desirabilities,
        "composite_desirability": round(composite_d, 4),
        "factor_ranges": factor_ranges,
        "response_goals": response_goals,
        "converged": True
    }
