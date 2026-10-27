"""
tests/test_viz_engine.py  –  Verification of Interactive DoE Visualization Engine
=================================================================================
Tests Plotly visualization generation and agent structured output:
1. Tests that generating a contour plot for a 2-factor quadratic model outputs valid Plotly JSON.
2. Tests that generating a 3D response surface plot outputs valid Plotly JSON with 3D scene.
3. Tests Pareto chart generation with standardized effects, t-limit, and Bonferroni lines.
4. Tests agent orchestrator structured JSON response containing:
   - response_text: Markdown explanation
   - charts: Array of Plotly JSON specifications
5. Tests multi-factor design (> 2 factors) with fixed factors contour evaluation.
"""

import sys
import os
import json
from unittest.mock import MagicMock
import numpy as np
import pandas as pd
import plotly.graph_objects as go

# Add workspace root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.doe_engine import (
    analyze_doe_run_table,
    generate_doe_design
)
from src.viz_engine import (
    create_pareto_chart,
    create_contour_plot,
    create_3d_surface
)
from src.agent import (
    DoEAgent,
    execute_tool,
    DOE_TOOLS
)


# =============================================================================
# Helper Fixtures: 2-Factor and 3-Factor Quadratic Models
# =============================================================================

def get_sample_2_factor_model():
    """Generates a fitted 2-factor quadratic model dataset (Temperature, Time -> Yield)."""
    np.random.seed(42)
    # 3x3 factorial with center replicates
    x1 = np.array([60.0, 90.0, 60.0, 90.0, 75.0, 75.0, 75.0, 75.0, 75.0])
    x2 = np.array([20.0, 20.0, 60.0, 60.0, 40.0, 40.0, 40.0, 40.0, 40.0])
    # Peak near (80, 45)
    y = 80.0 + 0.6*(x1 - 60.0) + 0.4*(x2 - 20.0) - 0.015*(x1 - 75.0)**2 - 0.02*(x2 - 40.0)**2 + np.random.normal(0, 0.1, 9)
    df = pd.DataFrame({
        "Temperature": x1,
        "Reaction_Time": x2,
        "Yield": np.round(y, 2)
    })
    model_res = analyze_doe_run_table(df, ["Temperature", "Reaction_Time"], ["Yield"], model_type="quadratic")
    return df, model_res


def get_sample_3_factor_model():
    """Generates a fitted 3-factor Box-Behnken model dataset (Temperature, Time, Catalyst -> Yield)."""
    factors = {
        "Temperature": [60.0, 90.0],
        "Reaction_Time": [20.0, 60.0],
        "Catalyst": [1.0, 5.0]
    }
    design = generate_doe_design("box_behnken", factors, runs=5)
    df = design["actual_design"].copy()

    x1 = (df["Temperature"] - 75.0) / 15.0
    x2 = (df["Reaction_Time"] - 40.0) / 20.0
    x3 = (df["Catalyst"] - 3.0) / 2.0

    np.random.seed(42)
    y = 85.0 + 7.5*x1 - 5.0*x2 + 2.0*x3 - 4.0*(x1**2) - 3.5*(x2**2) - 2.0*(x3**2) + 1.2*x1*x2 + np.random.normal(0, 0.15, len(df))
    df["Yield"] = np.round(y, 2)
    model_res = analyze_doe_run_table(df, ["Temperature", "Reaction_Time", "Catalyst"], ["Yield"], model_type="quadratic")
    return df, model_res


# =============================================================================
# Test 1: 2-Factor Quadratic Contour Plot Outputs Valid Plotly JSON (Core Requirement)
# =============================================================================

def test_contour_plot_2_factor_quadratic_valid_json():
    """
    Test that generating a contour plot for a 2-factor quadratic model outputs valid Plotly JSON.
    Verifies data structure, trace types, sweet spot marker, and JSON serializability.
    """
    df, model_res = get_sample_2_factor_model()

    contour_spec = create_contour_plot(
        model=model_res,
        factor_x="Temperature",
        factor_y="Reaction_Time",
        response_name="Yield",
        grid_points=40
    )

    # 1. Verify top-level Plotly Figure dictionary structure
    assert isinstance(contour_spec, dict), "Contour output must be a dictionary specification."
    assert "data" in contour_spec, "Plotly specification must contain 'data' key."
    assert "layout" in contour_spec, "Plotly specification must contain 'layout' key."

    # 2. Verify strict JSON serializability (no NumPy types or non-standard objects)
    json_str = json.dumps(contour_spec)
    assert len(json_str) > 0, "JSON string must not be empty."
    reparsed = json.loads(json_str)
    assert reparsed == contour_spec, "Round-trip JSON serialization must be identical."

    # 3. Verify traces
    traces = contour_spec["data"]
    assert len(traces) == 2, "Expected 2 traces: Contour heatmap and Sweet Spot marker."

    # First trace: 2D Contour
    c_trace = traces[0]
    assert c_trace["type"] == "contour", f"Expected trace type 'contour', got '{c_trace.get('type')}'."
    assert "x" in c_trace and len(c_trace["x"]) == 40, "X grid dimension must match grid_points (40)."
    assert "y" in c_trace and len(c_trace["y"]) == 40, "Y grid dimension must match grid_points (40)."
    assert "z" in c_trace and len(c_trace["z"]) == 40 and len(c_trace["z"][0]) == 40, "Z matrix must be 40x40."

    # Second trace: Optimal Sweet Spot marker
    opt_trace = traces[1]
    assert opt_trace["type"] == "scatter", f"Expected trace type 'scatter', got '{opt_trace.get('type')}'."
    assert len(opt_trace["x"]) == 1 and len(opt_trace["y"]) == 1, "Optimal point must have 1 coordinate."
    assert 60.0 <= opt_trace["x"][0] <= 90.0, "Optimal X must lie within experimental range [60, 90]."
    assert 20.0 <= opt_trace["y"][0] <= 60.0, "Optimal Y must lie within experimental range [20, 60]."

    # 4. Reconstruct with Plotly to ensure it is 100% valid specification
    fig = go.Figure(data=contour_spec["data"], layout=contour_spec["layout"])
    assert fig is not None


# =============================================================================
# Test 2: 3D Surface Plot Outputs Valid Plotly JSON
# =============================================================================

def test_3d_surface_plot_valid_json():
    """Verify that create_3d_surface generates valid Plotly JSON specification with surface trace."""
    df, model_res = get_sample_2_factor_model()

    surface_spec = create_3d_surface(
        model=model_res,
        factor_x="Temperature",
        factor_y="Reaction_Time",
        response_name="Yield",
        grid_points=30
    )

    assert isinstance(surface_spec, dict)
    assert "data" in surface_spec and "layout" in surface_spec

    # JSON round-trip
    json_str = json.dumps(surface_spec)
    assert len(json_str) > 0

    traces = surface_spec["data"]
    assert len(traces) == 2, "Expected 3D Surface trace and 3D Optimal marker trace."
    assert traces[0]["type"] == "surface"
    assert traces[1]["type"] == "scatter3d"

    # Layout has 3D scene
    layout = surface_spec["layout"]
    assert "scene" in layout
    assert "Temperature" in layout["scene"]["xaxis"]["title"]["text"]
    assert "Reaction_Time" in layout["scene"]["yaxis"]["title"]["text"]


# =============================================================================
# Test 3: Pareto Chart of Standardized Effects
# =============================================================================

def test_pareto_chart_valid_json_with_thresholds():
    """Verify that create_pareto_chart generates horizontal bars with t-limit and Bonferroni lines."""
    df, model_res = get_sample_3_factor_model()

    pareto_spec = create_pareto_chart(model_res, alpha=0.05)

    assert isinstance(pareto_spec, dict)
    json_str = json.dumps(pareto_spec)
    assert len(json_str) > 0

    traces = pareto_spec["data"]
    assert len(traces) >= 1
    bar_trace = traces[0]
    assert bar_trace["type"] == "bar"
    assert bar_trace["orientation"] == "h"

    # Verify model terms are present (excluding intercept)
    terms_in_chart = bar_trace["y"]
    assert "Temperature" in terms_in_chart
    assert "Reaction_Time" in terms_in_chart
    assert "Catalyst" in terms_in_chart
    assert "Intercept" not in terms_in_chart

    # Verify reference lines (shapes or annotations)
    layout = pareto_spec["layout"]
    shapes = layout.get("shapes", [])
    annotations = layout.get("annotations", [])

    # Either shapes have vertical lines or annotations label the thresholds
    ann_texts = [a.get("text", "") for a in annotations]
    has_t_line = any("t-Limit" in t or "t-Value" in t for t in ann_texts)
    has_bonf_line = any("Bonferroni" in t for t in ann_texts)

    assert has_t_line, "Pareto chart must display t-value threshold annotation."
    assert has_bonf_line, "Pareto chart must display Bonferroni threshold annotation."


# =============================================================================
# Test 4: Agent Structured Response (response_text and charts)
# =============================================================================

def test_agent_structured_response():
    """
    Test that DoEAgent.run(..., return_structured=True) returns a structured JSON object containing:
    - response_text: Markdown explanation
    - charts: Array of Plotly JSON specifications
    """
    df, _ = get_sample_2_factor_model()
    prompt = "Fit a quadratic model and generate a 2D contour plot for Temperature and Reaction Time on Yield"

    mock_client = MagicMock()

    # Step 1: Model decides to call analyze_doe_run_table, then create_contour_plot
    call_1 = MagicMock()
    call_1.id = "call_analyze_001"
    call_1.type = "function"
    call_1.function.name = "analyze_doe_run_table"
    call_1.function.arguments = json.dumps({
        "factor_cols": ["Temperature", "Reaction_Time"],
        "response_cols": ["Yield"],
        "model_type": "quadratic"
    })

    call_2 = MagicMock()
    call_2.id = "call_contour_002"
    call_2.type = "function"
    call_2.function.name = "create_contour_plot"
    call_2.function.arguments = json.dumps({
        "factor_x": "Temperature",
        "factor_y": "Reaction_Time",
        "response_name": "Yield"
    })

    first_msg = MagicMock()
    first_msg.tool_calls = [call_1, call_2]
    first_msg.content = None

    first_resp = MagicMock()
    first_resp.choices = [MagicMock(message=first_msg)]

    # Step 2: Synthesis
    markdown_synthesis = (
        "### Statistical Analysis & Contour Map\n\n"
        "- **Model Significance:** The quadratic model is highly significant ($p < 0.001$, $R^2 = 0.99$).\n"
        "- **Contour Plot:** Generated 2D contour map showing optimal sweet spot at Temperature ~ 75°C, Reaction Time ~ 40 min."
    )
    second_msg = MagicMock()
    second_msg.tool_calls = None
    second_msg.content = markdown_synthesis

    second_resp = MagicMock()
    second_resp.choices = [MagicMock(message=second_msg)]

    mock_client.chat.completions.create.side_effect = [first_resp, second_resp]

    agent = DoEAgent(client=mock_client)
    res = agent.run_structured(prompt, dataset=df)

    # Asserts on structured dictionary format
    assert isinstance(res, dict), "Result must be a dictionary."
    assert "response_text" in res, "Dictionary must contain 'response_text'."
    assert "charts" in res, "Dictionary must contain 'charts'."

    assert isinstance(res["response_text"], str)
    assert "Statistical Analysis & Contour Map" in res["response_text"]

    assert isinstance(res["charts"], list)
    assert len(res["charts"]) >= 1, "At least one chart should be rendered."

    # Validate that chart is a valid Plotly JSON object
    chart = res["charts"][0]
    assert "data" in chart and "layout" in chart
    assert chart["data"][0]["type"] == "contour"


# =============================================================================
# Test 5: Multi-Factor Design with Fixed Factors
# =============================================================================

def test_multi_factor_contour_with_fixed_factors():
    """Verify contour plot handles multi-factor designs with fixed factor setpoints."""
    df, model_res = get_sample_3_factor_model()

    # Hold Catalyst fixed at 3.0
    contour_spec = create_contour_plot(
        model=model_res,
        factor_x="Temperature",
        factor_y="Reaction_Time",
        fixed_factors={"Catalyst": 3.0},
        response_name="Yield",
        grid_points=25
    )

    assert isinstance(contour_spec, dict)
    assert "data" in contour_spec and "layout" in contour_spec
    json_str = json.dumps(contour_spec)
    assert len(json_str) > 0
    assert "Catalyst" in contour_spec["layout"]["title"]["text"]


# =============================================================================
# Runner
# =============================================================================

if __name__ == "__main__":
    print("Running Interactive DoE Visualization Engine tests...")
    test_contour_plot_2_factor_quadratic_valid_json()
    print("[PASS] Test 1: 2-factor quadratic contour plot outputs valid Plotly JSON.")
    test_3d_surface_plot_valid_json()
    print("[PASS] Test 2: 3D response surface plot outputs valid Plotly JSON.")
    test_pareto_chart_valid_json_with_thresholds()
    print("[PASS] Test 3: Pareto chart with t-limit and Bonferroni lines passed.")
    test_agent_structured_response()
    print("[PASS] Test 4: Agent structured response (response_text + charts) passed.")
    test_multi_factor_contour_with_fixed_factors()
    print("[PASS] Test 5: Multi-factor design with fixed factors contour passed.")
    print("\nAll Interactive DoE Visualization tests PASSED successfully!")
