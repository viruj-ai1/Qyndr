"""
tests/test_doe_engine.py  –  Verification of Deterministic DoE Engine
===================================================================
Tests all deterministic DoE tools on a standard 17-run Box-Behnken dataset:
1. Design Matrix Generation (17 runs, 3 factors, 5 center points).
2. OLS Regression & ANOVA (Model, Residual, Lack-of-Fit, Pure Error).
3. Statistical Metrics (R², Adjusted R², Predicted R² via PRESS, Lack-of-Fit p-value).
4. Factor Effect Estimates, t-values, and 95% Confidence Intervals.
5. Derringer-Suich Multi-Objective Desirability Optimization.
"""

import sys
import os
import numpy as np
import pandas as pd

# Add workspace root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    import pytest
    pytest_fixture = pytest.fixture
except ImportError:
    pytest = None
    def pytest_fixture(func):
        return func


from src.doe_engine import (
    generate_doe_design,
    analyze_doe_run_table,
    optimize_desirability,
    individual_desirability
)


# =============================================================================
# Test 1: Standard 17-run Box-Behnken Design Generation
# =============================================================================

def test_box_behnken_17_run_generation():
    """Verify standard 3-factor, 17-run Box-Behnken design generation."""
    factors = {
        "Temperature": [60.0, 90.0],
        "Time": [20.0, 60.0],
        "Catalyst": [1.0, 5.0]
    }
    
    design = generate_doe_design("box_behnken", factors, runs=5)
    
    assert design["n_runs"] == 17, f"Expected 17 runs, got {design['n_runs']}"
    assert len(design["coded_design"]) == 17
    assert len(design["actual_design"]) == 17
    
    coded_df = design["coded_design"]
    actual_df = design["actual_design"]
    
    # Check factor column names
    for f in ["Temperature", "Time", "Catalyst"]:
        assert f in coded_df.columns
        assert f in actual_df.columns
        
    # Check coded range [-1, 1]
    for f in ["Temperature", "Time", "Catalyst"]:
        assert set(coded_df[f].unique()).issubset({-1.0, 0.0, 1.0})
        
    # Check actual physical ranges
    assert actual_df["Temperature"].min() == 60.0
    assert actual_df["Temperature"].max() == 90.0
    assert actual_df["Time"].min() == 20.0
    assert actual_df["Time"].max() == 60.0
    assert actual_df["Catalyst"].min() == 1.0
    assert actual_df["Catalyst"].max() == 5.0
    
    # Check center points (exactly 5 center runs with all factors at midpoint)
    center_runs = actual_df[actual_df["Run_Type"] == "Center"]
    assert len(center_runs) == 5, f"Expected 5 center points, got {len(center_runs)}"
    for _, row in center_runs.iterrows():
        assert np.isclose(row["Temperature"], 75.0)
        assert np.isclose(row["Time"], 40.0)
        assert np.isclose(row["Catalyst"], 3.0)
        
    # Check factorial edge runs (12 runs)
    factorial_runs = actual_df[actual_df["Run_Type"] == "Factorial"]
    assert len(factorial_runs) == 12


# =============================================================================
# Test 2: OLS Regression, ANOVA Table, and Model Metrics on 17-Run Dataset
# =============================================================================

@pytest_fixture
def standard_17_run_bbd_dataset():
    """Constructs a deterministic 17-run Box-Behnken dataset with known response surface."""
    factors = {
        "Temperature": [60.0, 90.0],
        "Time": [20.0, 60.0],
        "Catalyst": [1.0, 5.0]
    }
    design = generate_doe_design("box_behnken", factors, runs=5)
    df = design["actual_design"].copy()
    
    # Coded variables x1, x2, x3 in [-1, 1]
    x1 = (df["Temperature"] - 75.0) / 15.0
    x2 = (df["Time"] - 40.0) / 20.0
    x3 = (df["Catalyst"] - 3.0) / 2.0
    
    # Known quadratic response surface for Yield (%):
    # Y = 85.0 + 5.0*x1 - 3.0*x2 + 2.0*x3 - 4.5*x1^2 - 3.5*x2^2 - 2.0*x3^2 + 1.5*x1*x2 - 1.0*x1*x3 + noise
    np.random.seed(101)
    noise = np.random.normal(0, 0.25, len(df))
    # Small pure error variation specifically at center points
    center_idx = df.index[df["Run_Type"] == "Center"].tolist()
    noise[center_idx] = np.array([-0.18, 0.15, -0.05, 0.22, -0.14])
    
    y = 85.0 + 5.0*x1 - 3.0*x2 + 2.0*x3 - 4.5*(x1**2) - 3.5*(x2**2) - 2.0*(x3**2) + 1.5*x1*x2 - 1.0*x1*x3 + noise
    df["Yield"] = np.round(y, 2)
    
    # Second response: Impurity (%)
    # Impurity = 1.20 - 0.30*x1 + 0.40*x2 + 0.10*x3 + 0.15*(x1**2) + 0.20*(x2**2) + noise
    noise2 = np.random.normal(0, 0.04, len(df))
    y2 = 1.20 - 0.30*x1 + 0.40*x2 + 0.10*x3 + 0.15*(x1**2) + 0.20*(x2**2) + noise2
    df["Impurity"] = np.round(y2, 3)
    
    return df


def test_analyze_doe_run_table(standard_17_run_bbd_dataset):
    """Verify OLS fitting, ANOVA table, model metrics, and factor effect estimates."""
    df = standard_17_run_bbd_dataset
    factor_cols = ["Temperature", "Time", "Catalyst"]
    response_col = "Yield"
    
    result = analyze_doe_run_table(df, factor_cols, response_col, model_type="quadratic")
    
    # 1. Check basic response info
    assert result["response"] == "Yield"
    assert result["model_type"] == "quadratic"
    assert result["n_samples"] == 17
    assert result["df_residual"] == 7  # 17 - 10 parameters (intercept + 3 linear + 3 2fi + 3 quad)
    
    # 2. Check Metrics
    metrics = result["metrics"]
    assert metrics["r_squared"] > 0.95, f"R² should be > 0.95, got {metrics['r_squared']}"
    assert metrics["adj_r_squared"] > 0.90, f"Adj R² should be > 0.90, got {metrics['adj_r_squared']}"
    assert metrics["pred_r_squared"] > 0.80, f"Pred R² should be > 0.80, got {metrics['pred_r_squared']}"
    assert metrics["press"] is not None and metrics["press"] > 0.0
    assert metrics["rmse"] < 0.6, f"RMSE should be < 0.6, got {metrics['rmse']}"
    
    # 3. Check Lack-of-Fit Test
    lof = metrics["lack_of_fit"]
    assert lof["df_pe"] == 4, f"Pure error df should be 4 (5 center points), got {lof['df_pe']}"
    assert lof["df_lof"] == 3, f"Lack-of-Fit df should be 3 (7 resid - 4 pe), got {lof['df_lof']}"
    assert lof["ss_pe"] is not None and lof["ss_pe"] > 0.0
    assert lof["ss_lof"] is not None
    assert lof["f_stat"] is not None
    assert lof["p_value"] is not None
    # Because noise is random and true model is quadratic, Lack-of-Fit should not be statistically significant (p > 0.05)
    assert lof["p_value"] > 0.05, f"Lack of Fit p-value should be > 0.05 (model is adequate), got {lof['p_value']}"
    assert lof["status"] == "Not Significant"
    
    # 4. Check ANOVA Table
    anova_df = result["anova"]
    assert isinstance(anova_df, pd.DataFrame)
    sources = anova_df["Source"].str.strip().tolist()
    assert "Model" in sources
    assert "Residual" in sources
    assert "Lack of Fit" in sources
    assert "Pure Error" in sources
    assert "Cor Total" in sources
    
    # Total SS conservation: Model SS + Residual SS == Total SS
    model_row = anova_df[anova_df["Source"] == "Model"].iloc[0]
    resid_row = anova_df[anova_df["Source"] == "Residual"].iloc[0]
    total_row = anova_df[anova_df["Source"] == "Cor Total"].iloc[0]
    assert np.isclose(model_row["SS"] + resid_row["SS"], total_row["SS"], atol=1e-4)
    
    # 5. Check Factor Effect Estimates and 95% Confidence Intervals
    coeff_df = result["coefficients"]
    assert len(coeff_df) == 10  # Intercept, 3 linear, 3 2fi, 3 quad
    
    for _, row in coeff_df.iterrows():
        term = row["term"]
        coeff = row["coefficient"]
        se = row["std_error"]
        t_stat = row["t_stat"]
        p_val = row["p_value"]
        ci_low = row["ci_lower"]
        ci_high = row["ci_upper"]
        
        # Verify confidence interval bounds
        assert ci_low <= coeff <= ci_high, f"CI violated for {term}: [{ci_low}, {ci_high}] with coeff {coeff}"
        # Verify t-stat relation (t = coeff / se)
        assert np.isclose(t_stat, coeff / se, rtol=0.01, atol=0.1)
        # Verify p-value in [0, 1]
        assert 0.0 <= p_val <= 1.0


# =============================================================================
# Test 3: Multi-Objective Desirability Optimization
# =============================================================================

def test_optimize_desirability(standard_17_run_bbd_dataset):
    """Verify Derringer-Suich desirability optimization to find optimal setpoints."""
    df = standard_17_run_bbd_dataset
    factor_cols = ["Temperature", "Time", "Catalyst"]
    
    # Fit models for Yield and Impurity
    analysis = analyze_doe_run_table(df, factor_cols, ["Yield", "Impurity"])
    
    factor_ranges = {
        "Temperature": [60.0, 90.0],
        "Time": [20.0, 60.0],
        "Catalyst": [1.0, 5.0]
    }
    
    response_goals = {
        "Yield": {
            "goal": "maximize",
            "lower_limit": 70.0,
            "upper_limit": 90.0,
            "target": 90.0,
            "weight": 1.0,
            "importance": 1.0
        },
        "Impurity": {
            "goal": "minimize",
            "lower_limit": 0.8,
            "upper_limit": 1.8,
            "target": 0.8,
            "weight": 1.0,
            "importance": 1.0
        }
    }
    
    opt_result = optimize_desirability(analysis, factor_ranges, response_goals)
    
    assert opt_result["converged"] is True
    assert "optimal_factors" in opt_result
    assert "predicted_responses" in opt_result
    assert "individual_desirabilities" in opt_result
    assert "composite_desirability" in opt_result
    
    opt_factors = opt_result["optimal_factors"]
    # Check that optimal factors are inside bounds
    assert 60.0 <= opt_factors["Temperature"] <= 90.0
    assert 20.0 <= opt_factors["Time"] <= 60.0
    assert 1.0 <= opt_factors["Catalyst"] <= 5.0
    
    # Check desirability values
    composite_d = opt_result["composite_desirability"]
    assert 0.0 <= composite_d <= 1.0
    assert composite_d > 0.5, f"Expected good composite desirability > 0.5, got {composite_d}"
    
    for r_name in ["Yield", "Impurity"]:
        d_val = opt_result["individual_desirabilities"][r_name]
        assert 0.0 <= d_val <= 1.0


# =============================================================================
# Test 4: Individual Desirability Helper
# =============================================================================

def test_individual_desirability_function():
    """Verify Derringer & Suich individual desirability edge cases."""
    # Maximize: y < lower => 0, y > target => 1, y midway => midway
    assert individual_desirability(50.0, "maximize", lower=60.0, upper=100.0) == 0.0
    assert individual_desirability(100.0, "maximize", lower=60.0, upper=100.0) == 1.0
    assert np.isclose(individual_desirability(80.0, "maximize", lower=60.0, upper=100.0), 0.5)
    
    # Minimize: y < target => 1, y > upper => 0, y midway => midway
    assert individual_desirability(1.0, "minimize", lower=1.0, upper=5.0) == 1.0
    assert individual_desirability(6.0, "minimize", lower=1.0, upper=5.0) == 0.0
    assert np.isclose(individual_desirability(3.0, "minimize", lower=1.0, upper=5.0), 0.5)


# =============================================================================
# Test 5: Other DoE Design Types (CCD, Full Factorial, Fractional)
# =============================================================================

def test_additional_design_types():
    """Verify CCD, Full Factorial, and Fractional Factorial generation."""
    factors = {"A": [0, 10], "B": [100, 200], "C": [-5, 5]}
    
    # CCD
    ccd = generate_doe_design("central_composite", factors, runs=4)
    assert ccd["n_runs"] > 0
    assert "Axial" in ccd["run_types"]
    assert "Center" in ccd["run_types"]
    assert "Factorial" in ccd["run_types"]
    
    # Full Factorial (2^3 = 8 runs)
    ff = generate_doe_design("full_factorial", factors)
    assert ff["n_runs"] == 8
    assert all(rt == "Factorial" for rt in ff["run_types"])
    
    # Fractional Factorial (2^(3-1) = 4 runs)
    frac = generate_doe_design("fractional_factorial", factors)
    assert frac["n_runs"] == 4


# =============================================================================
# Standalone execution
# =============================================================================

if __name__ == "__main__":
    print("Running DoE Engine verification tests...")
    test_box_behnken_17_run_generation()
    print("[PASS] Test 1: Box-Behnken 17-run generation passed.")
    
    # Generate fixture data
    dataset = standard_17_run_bbd_dataset()
    test_analyze_doe_run_table(dataset)
    print("[PASS] Test 2: OLS Regression, ANOVA, Metrics & Effects passed.")
    
    test_optimize_desirability(dataset)
    print("[PASS] Test 3: Multi-objective desirability optimization passed.")
    
    test_individual_desirability_function()
    print("[PASS] Test 4: Individual desirability edge cases passed.")
    
    test_additional_design_types()
    print("[PASS] Test 5: Additional design types (CCD, Full, Frac) passed.")
    
    print("\nAll 5 deterministic DoE Engine tests PASSED successfully!")
