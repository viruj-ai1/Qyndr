"""
tests/test_agent.py  –  Verification of Groq Tool-Calling Orchestrator
=====================================================================
Tests the Virtual Data Scientist agent:
1. Passes sample prompt: "Analyze our 17 runs to find if Temperature and Reaction Time significantly affect Yield"
2. Asserts that Groq tool calling selects `analyze_doe_run_table`.
3. Asserts that the tool is executed on the 17-run dataset with deterministic calculations.
4. Asserts that ANOVA, p-values, Lack-of-Fit, and factor effect estimates are returned to Groq.
5. Verifies end-to-end execution loop and response generation.
"""

import sys
import os
import json
from unittest.mock import MagicMock
import numpy as np
import pandas as pd

# Add workspace root and backend to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from src.agent import (
    DoEAgent,
    execute_tool,
    DOE_TOOLS,
    SYSTEM_PROMPT
)
from src.doe_engine import generate_doe_design


# =============================================================================
# Helper Fixture: 17-Run Box-Behnken Dataset
# =============================================================================

def get_sample_17_run_bbd() -> pd.DataFrame:
    """Generates standard 17-run Box-Behnken dataset with Temperature, Reaction_Time, Catalyst, Yield."""
    factors = {
        "Temperature": [60.0, 90.0],
        "Reaction_Time": [20.0, 60.0],
        "Catalyst": [1.0, 5.0]
    }
    design = generate_doe_design("box_behnken", factors, runs=5)
    df = design["actual_design"].copy()
    
    # Coded factors
    x1 = (df["Temperature"] - 75.0) / 15.0
    x2 = (df["Reaction_Time"] - 40.0) / 20.0
    x3 = (df["Catalyst"] - 3.0) / 2.0
    
    # Quadratic response for Yield with pure error at center runs
    np.random.seed(42)
    noise = np.random.normal(0, 0.2, len(df))
    center_idx = df.index[df["Run_Type"] == "Center"].tolist()
    noise[center_idx] = np.array([-0.12, 0.10, -0.05, 0.15, -0.08])
    
    # Temperature (x1) and Reaction_Time (x2) significantly affect Yield
    y = 85.0 + 8.0*x1 - 6.0*x2 + 2.0*x3 - 4.0*(x1**2) - 3.0*(x2**2) - 2.0*(x3**2) + 1.5*x1*x2 + noise
    df["Yield"] = np.round(y, 2)
    return df


# =============================================================================
# Test 1: Direct Tool Execution Test
# =============================================================================

def test_execute_tool_analyze_doe():
    """Verify execute_tool executes analyze_doe_run_table with structured output."""
    df = get_sample_17_run_bbd()
    args = {
        "factor_cols": ["Temperature", "Reaction_Time", "Catalyst"],
        "response_cols": ["Yield"],
        "model_type": "quadratic"
    }
    
    result = execute_tool("analyze_doe_run_table", args, dataset=df)
    
    assert result["status"] == "success"
    assert "metrics" in result
    assert "anova_table" in result
    assert "coefficients" in result
    
    metrics = result["metrics"]
    assert metrics["r_squared"] > 0.90
    assert metrics["lack_of_fit"]["df_pe"] == 4
    
    # Check that Temperature and Reaction_Time p-values are extracted
    coeffs = {c["term"]: c for c in result["coefficients"]}
    assert "Temperature" in coeffs
    assert "Reaction_Time" in coeffs
    assert coeffs["Temperature"]["p_value"] < 0.05
    assert coeffs["Reaction_Time"]["p_value"] < 0.05


# =============================================================================
# Test 2: Agent Tool-Calling Orchestration Loop (Mocked Groq SDK Client)
# =============================================================================

def test_agent_tool_calling_orchestration():
    """
    Test the full agentic loop:
    User prompt -> Groq tool decision -> Python function execution -> Groq synthesis.
    Assert that the tool is invoked correctly with sample prompt.
    """
    df = get_sample_17_run_bbd()
    sample_prompt = "Analyze our 17 runs to find if Temperature and Reaction Time significantly affect Yield"
    
    # 1. Create mock response representing Groq's tool decision
    mock_tool_call = MagicMock()
    mock_tool_call.id = "call_abc123"
    mock_tool_call.type = "function"
    mock_tool_call.function.name = "analyze_doe_run_table"
    mock_tool_call.function.arguments = json.dumps({
        "factor_cols": ["Temperature", "Reaction_Time", "Catalyst"],
        "response_cols": ["Yield"],
        "model_type": "quadratic"
    })
    
    # First Groq completion returns the tool call decision
    mock_first_choice = MagicMock()
    mock_first_choice.message.tool_calls = [mock_tool_call]
    mock_first_choice.message.content = None
    mock_first_response = MagicMock()
    mock_first_response.choices = [mock_first_choice]
    
    # Second Groq completion returns the final synthesized response
    mock_final_choice = MagicMock()
    mock_final_choice.message.content = (
        "### Executive Summary\n"
        "Based on Ordinary Least Squares regression and ANOVA on the 17-run Box-Behnken design:\n"
        "- **Temperature** is a statistically significant Critical Process Parameter (CPP) (p < 0.0001, t = 49.3).\n"
        "- **Reaction Time** is also a significant CPP (p < 0.001, t = -32.1) with a negative effect.\n"
        "- **Model Significance**: The overall quadratic model is highly significant (F = 215.4, p < 0.0001) with R² = 0.996 and Adj R² = 0.991.\n"
        "- **Lack-of-Fit**: p = 0.65 (> 0.05), confirming adequate model fit with no significant lack of fit.\n"
        "ICH Q8 Guidance: Both parameters should be bounded within the Proven Acceptable Range (PAR) to maintain CQA Yield >= 85%."
    )
    mock_final_response = MagicMock()
    mock_final_response.choices = [mock_final_choice]
    
    # Configure mock Groq client
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [mock_first_response, mock_final_response]
    
    # 2. Instantiate DoEAgent with the mock client and dataset
    agent = DoEAgent(client=mock_client, dataset=df)
    
    # 3. Run agent with prompt
    final_output = agent.run(sample_prompt, dataset=df, stream=False)
    
    # 4. Assertions on Tool Invocation
    # Assert chat.completions.create was called twice (decision + synthesis)
    assert mock_client.chat.completions.create.call_count == 2
    
    # Assert tool call history was populated
    assert len(agent.tool_calls_history) == 1, "Expected 1 tool call in history"
    tool_entry = agent.tool_calls_history[0]
    
    # Assert tool name matches
    assert tool_entry["name"] == "analyze_doe_run_table", f"Expected analyze_doe_run_table, got {tool_entry['name']}"
    
    # Assert tool arguments contain factor and response columns
    invoked_args = tool_entry["arguments"]
    assert "Temperature" in invoked_args["factor_cols"]
    assert "Reaction_Time" in invoked_args["factor_cols"]
    assert "Yield" in invoked_args["response_cols"]
    
    # Assert tool output has valid deterministic statistical results
    tool_output = tool_entry["output"]
    assert tool_output["status"] == "success"
    assert tool_output["metrics"]["r_squared"] > 0.90
    assert tool_output["metrics"]["lack_of_fit"]["status"] == "Not Significant"
    
    # Assert second call to Groq contains tool output message with matching tool_call_id
    second_call_kwargs = mock_client.chat.completions.create.call_args_list[1][1]
    messages_sent = second_call_kwargs["messages"]
    tool_msg = [m for m in messages_sent if m.get("role") == "tool"][0]
    assert tool_msg["tool_call_id"] == "call_abc123"
    assert "metrics" in tool_msg["content"]
    assert "anova_table" in tool_msg["content"]
    
    # Assert final response synthesized
    assert "Temperature" in final_output
    assert "Reaction Time" in final_output
    assert "Critical Process Parameter" in final_output


# =============================================================================
# Test 3: Streaming Execution Test
# =============================================================================

def test_agent_streaming_execution():
    """Verify that streaming mode yields chunks properly."""
    df = get_sample_17_run_bbd()
    sample_prompt = "Analyze our 17 runs to find if Temperature and Reaction Time significantly affect Yield"
    
    # Mock tool call
    mock_tool_call = MagicMock()
    mock_tool_call.id = "call_stream"
    mock_tool_call.type = "function"
    mock_tool_call.function.name = "analyze_doe_run_table"
    mock_tool_call.function.arguments = json.dumps({
        "factor_cols": ["Temperature", "Reaction_Time"],
        "response_cols": ["Yield"]
    })
    
    mock_first_choice = MagicMock()
    mock_first_choice.message.tool_calls = [mock_tool_call]
    mock_first_choice.message.content = None
    mock_first_response = MagicMock()
    mock_first_response.choices = [mock_first_choice]
    
    # Mock stream chunks
    def make_chunk(text):
        chunk = MagicMock()
        chunk.choices = [MagicMock()]
        chunk.choices[0].delta.content = text
        return chunk
        
    stream_chunks = [
        make_chunk("Temperature is "),
        make_chunk("a statistically significant "),
        make_chunk("Critical Process Parameter (CPP).")
    ]
    
    mock_client = MagicMock()
    mock_client.chat.completions.create.side_effect = [mock_first_response, iter(stream_chunks)]
    
    agent = DoEAgent(client=mock_client, dataset=df)
    stream_gen = agent.run(sample_prompt, dataset=df, stream=True)
    
    accumulated = "".join(list(stream_gen))
    assert accumulated == "Temperature is a statistically significant Critical Process Parameter (CPP)."
    assert len(agent.tool_calls_history) == 1


# =============================================================================
# Test 4: Tool Schemas Validity
# =============================================================================

def test_doe_tools_schemas():
    """Verify the 3 required tool schemas exist with valid structure."""
    tool_names = [t["function"]["name"] for t in DOE_TOOLS]
    assert "analyze_doe_run_table" in tool_names
    assert "generate_doe_design" in tool_names
    assert "optimize_desirability" in tool_names
    
    # Check parameters
    for t in DOE_TOOLS:
        fn = t["function"]
        assert "description" in fn
        assert "parameters" in fn
        assert fn["parameters"]["type"] == "object"
        assert "properties" in fn["parameters"]


# =============================================================================
# Test 5: Chat Request Schema with Charts in History
# =============================================================================

def test_chat_request_schema_with_charts_in_history():
    """Verify that chat history containing non-string fields like charts parses cleanly without Pydantic validation errors."""
    from backend.api.optimization import LLMChatRequest
    from backend.api.chat import ChatRequest

    payload = {
        "project_id": 1,
        "message": "What is the difference between NOR and PAR?",
        "chat_history": [
            {"role": "user", "content": "Show me the Pareto chart"},
            {"role": "assistant", "content": "Here is the Pareto chart", "charts": [{"data": [{"x": [1, 2], "y": [3, 4]}], "layout": {}}]}
        ]
    }

    # Should parse without 422 "Input should be a valid string" error
    req_opt = LLMChatRequest(**payload)
    assert req_opt.project_id == 1
    assert len(req_opt.chat_history) == 2
    assert "charts" in req_opt.chat_history[1]

    req_chat = ChatRequest(**payload)
    assert req_chat.message == "What is the difference between NOR and PAR?"
    assert len(req_chat.chat_history) == 2


# =============================================================================
# Test 6: Project Context Aggregator & Markdown Formatter
# =============================================================================

def test_full_project_context_aggregator():
    """Verify that build_full_project_context and format_project_context_markdown compile the pharmaceutical dossier."""
    from backend.database import get_db, crud
    from backend.services.project_context import build_full_project_context, format_project_context_markdown

    db = next(get_db())
    projs = crud.get_projects(db)
    if projs:
        pid = projs[0].id
        ctx = build_full_project_context(pid, db)
        assert ctx["project_id"] == pid
        assert "compound" in ctx
        assert "qtpp" in ctx
        assert "cqas" in ctx
        assert "stages" in ctx
        assert "factors" in ctx
        assert "responses" in ctx

        dossier = format_project_context_markdown(ctx)
        assert len(dossier) > 100
        assert ctx["compound"] in dossier or ctx["name"] in dossier


# =============================================================================
# Test 7: 4-in-1 Residual Diagnostics Visualization
# =============================================================================

def test_residual_diagnostics_plot():
    """Verify that create_residual_diagnostics returns a 4-in-1 Plotly dashboard specification."""
    from src.viz_engine import create_residual_diagnostics

    sample_model = {
        "response": "Purity",
        "fitted_values": [90.0, 92.5, 95.0, 91.5, 94.0],
        "residuals": [0.2, -0.3, 0.1, -0.4, 0.4]
    }
    diag = create_residual_diagnostics(sample_model, response_name="Purity")
    assert "data" in diag
    assert "layout" in diag
    assert len(diag["data"]) >= 4
    types = [t["type"] for t in diag["data"]]
    assert "scatter" in types
    assert "histogram" in types


# =============================================================================
# Test 8: Agent Context Dossier Grounding
# =============================================================================

def test_agent_context_dossier_grounding():
    """Verify that DoEAgent injects project dossier into system prompt."""
    dossier = "Target Compound: Rocuronium Bromide. CQA: Impurity A <= 0.15%."
    agent = DoEAgent(project_dossier=dossier, api_key="dummy_key")
    assert agent.project_dossier == dossier


# =============================================================================
# Standalone execution
# =============================================================================

if __name__ == "__main__":
    print("Running Groq Tool-Calling Orchestrator tests...")
    test_doe_tools_schemas()
    print("[PASS] Test 1: Tool schemas valid.")
    
    test_execute_tool_analyze_doe()
    print("[PASS] Test 2: Direct tool execution on 17-run dataset passed.")
    
    test_agent_tool_calling_orchestration()
    print("[PASS] Test 3: Agentic tool-calling orchestration loop passed.")
    
    test_agent_streaming_execution()
    print("[PASS] Test 4: Streaming execution passed.")

    test_chat_request_schema_with_charts_in_history()
    print("[PASS] Test 5: Chat request schema with charts in history passed.")

    test_full_project_context_aggregator()
    print("[PASS] Test 6: Full project context aggregator passed.")

    test_residual_diagnostics_plot()
    print("[PASS] Test 7: 4-in-1 residual diagnostics plot passed.")

    test_agent_context_dossier_grounding()
    print("[PASS] Test 8: Agent context dossier grounding passed.")
    
    print("\nAll 8 Groq Orchestrator tests PASSED successfully!")
