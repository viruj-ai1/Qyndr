"""
src/agent.py  –  Groq Tool-Calling Agentic Orchestrator
======================================================
Virtual Data Scientist agent orchestrating deterministic DoE analysis:
1. Configured with Groq Python SDK (llama-3.3-70b-versatile).
2. Callable tool schemas for analyze_doe_run_table, generate_doe_design, and optimize_desirability.
3. ICH Q8(R2) Virtual Data Scientist system prompt.
4. Complete execution loop with tool invocation and streaming/non-streaming response synthesis.
"""

from typing import Dict, List, Any, Optional, Union, Generator, Tuple
import os
import json
import numpy as np
import pandas as pd

# Load environment variables if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
    load_dotenv("backend/.env")
except ImportError:
    pass

try:
    from groq import Groq
except ImportError:
    Groq = None

from src.doe_engine import (
    analyze_doe_run_table,
    generate_doe_design,
    optimize_desirability
)
from src.qbd_rag import (
    query_qbd_regulatory_guidance
)
from src.viz_engine import (
    create_pareto_chart,
    create_contour_plot,
    create_3d_surface
)


# =============================================================================
# 1. System Prompt: Virtual Data Scientist (ICH Q8 Standards)
# =============================================================================

SYSTEM_PROMPT = """You are the Virtual Data Scientist & QbD Process Expert, a specialized AI assistant for pharmaceutical, biotech, and chemical process optimization adhering to ICH Q8(R2), ICH Q9(R1), ICH Q10, and ICH Q14 Guidelines.

### CORE OPERATIONAL DIRECTIVES:
1. STRICT DETERMINISTIC CALCULATION MANDATE:
   - NEVER calculate, guess, estimate, or extrapolate statistical values, ANOVA tables, p-values, F-statistics, R-squared values, coefficients, or optimal factor setpoints.
   - ALL numerical calculations MUST be executed by calling the statistical tools (`analyze_doe_run_table`, `generate_doe_design`, `optimize_desirability`).

2. INTERACTIVE VISUALIZATION TOOLS (Plotly):
   - Whenever asked to plot, visualize, or illustrate model effects, contour maps, response surfaces, or sweet spots:
     * Call `create_pareto_chart` to render standardized effects with t-limit and Bonferroni significance thresholds.
     * Call `create_contour_plot` to render 2D response contour maps highlighting the optimal operating region / sweet spot.
     * Call `create_3d_surface` to render 3D response surfaces.
   - Interpret visual features (steepness, curvature, interactions, and optimal coordinates) in your markdown explanation.

3. REGULATORY RAG & EXACT CITATIONS (ICH Q8/Q9/Q10/Q14):
   - Whenever asked about regulatory definitions, compliance considerations, differences between concepts (e.g., Normal Operating Range [NOR] vs. Proven Acceptable Range [PAR], Design Space, QTPP, CQAs, CPPs), Risk Assessment (FMEA RPN scoring, Ishikawa Cause-and-Effect Matrix), or Analytical QbD (ATP, MODR), you MUST invoke the `query_qbd_regulatory_guidance` tool.
   - Ground all regulatory explanations directly in the returned regulatory guidance.
   - ALWAYS provide precise, formal regulatory citations (e.g., "According to ICH Q8(R2), Section 6..." or "ICH Q9(R1) Annex I.2...").
   - Explicitly contrast the operational, statistical, and regulatory implications of concepts (e.g., operating within NOR vs. PAR vs. Design Space excursions).

4. ICH Q8(R2) PHARMACEUTICAL QUALITY BY DESIGN (QbD) TERMINOLOGY:
   - Interpret factors as potential Critical Process Parameters (CPPs) or non-critical process parameters based on their statistical significance (p < 0.05).
   - Interpret responses as Critical Quality Attributes (CQAs) linked to the Quality Target Product Profile (QTPP).
   - Frame operational setpoints in terms of the multi-dimensional Design Space, Normal Operating Range (NOR), and Proven Acceptable Range (PAR).
   - Report Model Significance (Overall model F-value and p-value < 0.05) and Lack-of-Fit (p > 0.05 indicating adequate model representation without missing higher-order terms).

5. MODEL REDUCTION & BACKWARD ELIMINATION:
   - If model terms (especially 2-factor interactions or quadratic terms) have p > 0.05, explicitly identify them as non-statistically significant.
   - Guide the user on model reduction / backward elimination (removing non-significant terms while maintaining hierarchical integrity) to optimize Predicted R² (PRESS) and avoid overfitting.

6. STRUCTURED SYNTHESIS:
   - Executive Summary: Clear finding on factor criticality or regulatory definition with formal citation.
   - Comparative Analysis: Highlighting operational, statistical, and regulatory differences.
   - Visual Insights: Key observations from Pareto charts, contours, or response surfaces.
   - Compliance & Lifecycle Considerations: Specific requirements for deviations, excursions, or change controls.
   - Recommendations & Next Steps.
"""


# =============================================================================
# 2. Groq Tool Schemas
# =============================================================================

DOE_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "analyze_doe_run_table",
            "description": "Fits Ordinary Least Squares (OLS) regression using statsmodels, computes ANOVA table (F-statistic, p-values, Sum of Squares, degrees of freedom), calculates model metrics (R², Adjusted R², Predicted R², Lack-of-Fit test), and extracts factor effect estimates, t-values, and 95% confidence intervals.",
            "parameters": {
                "type": "object",
                "properties": {
                    "factor_cols": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of factor column names (independent variables), e.g. ['Temperature', 'Reaction_Time', 'Catalyst']."
                    },
                    "response_cols": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of response column names (dependent variables), e.g. ['Yield']."
                    },
                    "model_type": {
                        "type": "string",
                        "enum": ["linear", "2fi", "quadratic"],
                        "default": "quadratic",
                        "description": "Model type to fit: 'linear', '2fi' (linear + 2-factor interactions), or 'quadratic' (Response Surface Methodology full quadratic)."
                    },
                    "data_csv_or_df": {
                        "type": "string",
                        "description": "Optional file path or CSV string. If omitted, uses active preloaded dataset."
                    }
                },
                "required": ["factor_cols", "response_cols"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_doe_design",
            "description": "Generates Full Factorial, Fractional Factorial, Box-Behnken (BBD), or Central Composite Design (CCD) matrices using pyDOE3, scaling from coded to engineering units.",
            "parameters": {
                "type": "object",
                "properties": {
                    "design_type": {
                        "type": "string",
                        "enum": ["box_behnken", "central_composite", "full_factorial", "fractional_factorial"],
                        "description": "Design algorithm: 'box_behnken', 'central_composite', 'full_factorial', or 'fractional_factorial'."
                    },
                    "factors_dict": {
                        "type": "object",
                        "description": "Dictionary of factor ranges, e.g. {'Temperature': [60, 90], 'Time': [20, 60], 'Catalyst': [1.0, 5.0]}."
                    },
                    "runs": {
                        "type": "integer",
                        "description": "Optional center points count (for BBD/CCD) or total runs."
                    }
                },
                "required": ["design_type", "factors_dict"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "optimize_desirability",
            "description": "Implements Derringer & Suich multi-objective desirability function to find optimal operating setpoints across factors given fitted regression models and response goals.",
            "parameters": {
                "type": "object",
                "properties": {
                    "factor_ranges": {
                        "type": "object",
                        "description": "Dict mapping factor names to [min, max] ranges, e.g. {'Temperature': [60, 90], 'Time': [20, 60]}."
                    },
                    "response_goals": {
                        "type": "object",
                        "description": "Dict of optimization goals per response. Example: {'Yield': {'goal': 'maximize', 'lower_limit': 75.0, 'upper_limit': 100.0, 'target': 95.0}}."
                    }
                },
                "required": ["factor_ranges", "response_goals"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_qbd_regulatory_guidance",
            "description": "Retrieves precise regulatory definitions, comparative guidance, compliance considerations, and formal citations from curated ICH Quality by Design (QbD) standards (ICH Q8(R2), ICH Q9(R1), ICH Q10, ICH Q14). Use this whenever asked about regulatory definitions, differences between concepts like NOR vs. PAR, QTPP, CQAs, CPPs, Design Space, FMEA RPN scoring, Ishikawa matrix, ATP, or PQS lifecycle.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The specific regulatory question or concept to search for, e.g. 'What is the difference between Normal Operating Range (NOR) and Proven Acceptable Range (PAR) according to ICH Q8?'"
                    },
                    "guideline": {
                        "type": "string",
                        "enum": ["ICH Q8", "ICH Q9", "ICH Q10", "ICH Q14"],
                        "description": "Optional filter for specific guideline: 'ICH Q8', 'ICH Q9', 'ICH Q10', 'ICH Q14'. Omit to search across all guidelines."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_pareto_chart",
            "description": "Generates an interactive Plotly Pareto chart of standardized factor effects (|t-values|) with both t-value and Bonferroni significance threshold lines.",
            "parameters": {
                "type": "object",
                "properties": {
                    "alpha": {
                        "type": "number",
                        "default": 0.05,
                        "description": "Significance level (default 0.05)."
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_contour_plot",
            "description": "Renders an interactive 2D response contour map / heatmap evaluating RSM quadratic models over an operational grid, highlighting the optimal operating region / sweet spot.",
            "parameters": {
                "type": "object",
                "properties": {
                    "factor_x": {
                        "type": "string",
                        "description": "Factor name for X-axis (e.g. 'Temperature')."
                    },
                    "factor_y": {
                        "type": "string",
                        "description": "Factor name for Y-axis (e.g. 'Reaction_Time')."
                    },
                    "fixed_factors": {
                        "type": "object",
                        "description": "Optional dictionary of other factors held constant, e.g. {'Catalyst': 3.0}."
                    },
                    "response_name": {
                        "type": "string",
                        "description": "Response name to plot (e.g. 'Yield')."
                    }
                },
                "required": ["factor_x", "factor_y"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_3d_surface",
            "description": "Generates an interactive 3D response surface plot evaluating RSM quadratic models over an operational grid, showing surface contours and the optimal setpoint.",
            "parameters": {
                "type": "object",
                "properties": {
                    "factor_x": {
                        "type": "string",
                        "description": "Factor name for X-axis (e.g. 'Temperature')."
                    },
                    "factor_y": {
                        "type": "string",
                        "description": "Factor name for Y-axis (e.g. 'Reaction_Time')."
                    },
                    "fixed_factors": {
                        "type": "object",
                        "description": "Optional dictionary of other factors held constant, e.g. {'Catalyst': 3.0}."
                    },
                    "response_name": {
                        "type": "string",
                        "description": "Response name to plot (e.g. 'Yield')."
                    }
                },
                "required": ["factor_x", "factor_y"]
            }
        }
    }
]


# =============================================================================
# 3. Tool Dispatcher
# =============================================================================

class ToolExecutionError(Exception):
    pass


# Cache for non-serializable fitted statsmodels objects
_ACTIVE_DOE_MODELS: Dict[str, Any] = {}


def execute_tool(
    name: str,
    args: Dict[str, Any],
    dataset: Optional[Union[pd.DataFrame, str]] = None,
    last_analysis: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Executes the deterministic tool function and returns a JSON-serializable result.
    """
    if name == "analyze_doe_run_table":
        data = args.get("data_csv_or_df") or dataset
        if data is None:
            raise ToolExecutionError("No dataset provided to analyze_doe_run_table.")
        
        factor_cols = args["factor_cols"]
        response_cols = args["response_cols"]
        model_type = args.get("model_type", "quadratic")
        
        raw_res = analyze_doe_run_table(data, factor_cols, response_cols, model_type=model_type)
        _ACTIVE_DOE_MODELS["last_analysis"] = raw_res
        
        # Format clean, serializable summary for Groq context window (free of statsmodels circular refs)
        if len(response_cols) > 1 and "responses" in raw_res:
            formatted = {}
            for r_name, r_data in raw_res["responses"].items():
                formatted[r_name] = {
                    "metrics": r_data["metrics"],
                    "anova_table": r_data["anova_dict"],
                    "coefficients": r_data["coefficients_list"],
                    "factor_cols": factor_cols
                }
            return {"status": "success", "responses": formatted}
        else:
            first_resp = raw_res.get("response", response_cols[0])
            first_data = raw_res if "metrics" in raw_res else raw_res[first_resp]
            return {
                "status": "success",
                "response": first_resp,
                "model_type": first_data.get("model_type", model_type),
                "metrics": first_data["metrics"],
                "anova_table": first_data["anova_dict"],
                "coefficients": first_data["coefficients_list"],
                "factor_cols": factor_cols
            }

    elif name == "generate_doe_design":
        design_type = args["design_type"]
        factors_dict = args["factors_dict"]
        runs = args.get("runs")
        
        design_res = generate_doe_design(design_type, factors_dict, runs=runs)
        
        return {
            "status": "success",
            "design_type": design_res["design_type"],
            "n_runs": design_res["n_runs"],
            "factors": design_res["factors"],
            "run_types": pd.Series(design_res["run_types"]).value_counts().to_dict(),
            "first_runs_preview": design_res["actual_design"].head(8).to_dict(orient="records"),
            "coded_sample": design_res["coded_design"].head(4).to_dict(orient="records")
        }

    elif name == "optimize_desirability":
        factor_ranges = args["factor_ranges"]
        response_goals = args["response_goals"]
        
        # Use last analysis model if available
        model_obj = _ACTIVE_DOE_MODELS.get("last_analysis") or last_analysis
        if model_obj is None and dataset is not None:
            # Fit default quadratic model on dataset first
            f_cols = list(factor_ranges.keys())
            r_cols = list(response_goals.keys())
            model_obj = analyze_doe_run_table(dataset, f_cols, r_cols, model_type="quadratic")
            _ACTIVE_DOE_MODELS["last_analysis"] = model_obj
            
        if model_obj is None:
            raise ToolExecutionError("No fitted regression model available for desirability optimization.")
            
        opt_res = optimize_desirability(model_obj, factor_ranges, response_goals)
        return {
            "status": "success",
            "optimal_factors": opt_res["optimal_factors"],
            "predicted_responses": opt_res["predicted_responses"],
            "individual_desirabilities": opt_res["individual_desirabilities"],
            "composite_desirability": opt_res["composite_desirability"]
        }

    elif name == "query_qbd_regulatory_guidance":
        query = args["query"]
        guideline = args.get("guideline")
        return query_qbd_regulatory_guidance(query=query, guideline=guideline)

    elif name == "create_pareto_chart":
        alpha = float(args.get("alpha", 0.05))
        model_obj = _ACTIVE_DOE_MODELS.get("last_analysis") or last_analysis
        if model_obj is None and dataset is not None:
            # Try to auto-fit model on dataset if available
            df = dataset if isinstance(dataset, pd.DataFrame) else pd.read_csv(io.StringIO(dataset) if "\n" in str(dataset) else str(dataset))
            numeric_cols = list(df.select_dtypes(include=[np.number]).columns)
            if len(numeric_cols) >= 2:
                model_obj = analyze_doe_run_table(df, numeric_cols[:-1], [numeric_cols[-1]], model_type="quadratic")
                _ACTIVE_DOE_MODELS["last_analysis"] = model_obj

        if model_obj is None:
            raise ToolExecutionError("No fitted model available to create Pareto chart.")

        chart_spec = create_pareto_chart(model_obj, alpha=alpha)
        return {
            "status": "success",
            "chart_type": "pareto_chart",
            "message": f"Generated Pareto chart of standardized effects (alpha={alpha}).",
            "chart": chart_spec
        }

    elif name == "create_contour_plot":
        factor_x = args["factor_x"]
        factor_y = args["factor_y"]
        fixed_factors = args.get("fixed_factors", {})
        response_name = args.get("response_name")
        model_obj = _ACTIVE_DOE_MODELS.get("last_analysis") or last_analysis
        
        if model_obj is None and dataset is not None:
            f_cols = [factor_x, factor_y]
            if fixed_factors:
                f_cols.extend([f for f in fixed_factors.keys() if f not in f_cols])
            r_col = response_name or "Yield"
            model_obj = analyze_doe_run_table(dataset, f_cols, [r_col], model_type="quadratic")
            _ACTIVE_DOE_MODELS["last_analysis"] = model_obj

        if model_obj is None:
            raise ToolExecutionError("No fitted regression model available to create contour plot.")

        chart_spec = create_contour_plot(
            model=model_obj,
            factor_x=factor_x,
            factor_y=factor_y,
            fixed_factors=fixed_factors,
            response_name=response_name
        )
        return {
            "status": "success",
            "chart_type": "contour_plot",
            "factor_x": factor_x,
            "factor_y": factor_y,
            "response": response_name,
            "message": f"Generated 2D contour plot for {factor_x} and {factor_y}.",
            "chart": chart_spec
        }

    elif name == "create_3d_surface":
        factor_x = args["factor_x"]
        factor_y = args["factor_y"]
        fixed_factors = args.get("fixed_factors", {})
        response_name = args.get("response_name")
        model_obj = _ACTIVE_DOE_MODELS.get("last_analysis") or last_analysis

        if model_obj is None and dataset is not None:
            f_cols = [factor_x, factor_y]
            if fixed_factors:
                f_cols.extend([f for f in fixed_factors.keys() if f not in f_cols])
            r_col = response_name or "Yield"
            model_obj = analyze_doe_run_table(dataset, f_cols, [r_col], model_type="quadratic")
            _ACTIVE_DOE_MODELS["last_analysis"] = model_obj

        if model_obj is None:
            raise ToolExecutionError("No fitted regression model available to create 3D surface plot.")

        chart_spec = create_3d_surface(
            model=model_obj,
            factor_x=factor_x,
            factor_y=factor_y,
            fixed_factors=fixed_factors,
            response_name=response_name
        )
        return {
            "status": "success",
            "chart_type": "3d_surface",
            "factor_x": factor_x,
            "factor_y": factor_y,
            "response": response_name,
            "message": f"Generated 3D response surface for {factor_x} and {factor_y}.",
            "chart": chart_spec
        }

    else:
        raise ToolExecutionError(f"Unknown tool '{name}'")


# =============================================================================
# 4. Agentic Orchestrator (DoEAgent)
# =============================================================================

class DoEAgent:
    """
    Virtual Data Scientist Agent utilizing Groq llama-3.3-70b-versatile with tool calling.
    """
    DEFAULT_MODEL = "llama-3.3-70b-versatile"

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        dataset: Optional[Union[pd.DataFrame, str]] = None,
        client: Optional[Any] = None
    ):
        self.model = model
        self.dataset = dataset
        self.last_analysis: Optional[Dict[str, Any]] = None
        self.tool_calls_history: List[Dict[str, Any]] = []
        self.charts: List[Dict[str, Any]] = []
        self.last_structured_response: Optional[Dict[str, Any]] = None

        if client is not None:
            self.client = client
        else:
            key = api_key or os.getenv("GROQ_API_KEY")
            if not key and Groq is not None:
                # Check backend/.env explicitly
                backend_env = os.path.join(os.path.dirname(__file__), "..", "backend", ".env")
                if os.path.exists(backend_env):
                    with open(backend_env, "r") as f:
                        for line in f:
                            if line.startswith("GROQ_API_KEY="):
                                key = line.strip().split("=", 1)[1]
                                break
            self.client = Groq(api_key=key) if (Groq is not None and key) else None

    def run(
        self,
        prompt: str,
        dataset: Optional[Union[pd.DataFrame, str]] = None,
        stream: bool = False,
        return_structured: bool = False,
        chat_history: Optional[List[Dict[str, Any]]] = None
    ) -> Union[str, Dict[str, Any], Generator[str, None, None]]:
        """
        Executes the full agentic loop:
        User prompt -> Groq tool decision -> Python tool execution -> Tool result return -> Final synthesis.

        Parameters:
            prompt: User inquiry (e.g. 'Analyze our 17 runs to find if Temperature significantly affects Yield')
            dataset: Optional DataFrame or CSV data (defaults to self.dataset)
            stream: Whether to stream the final synthesized response chunks
            return_structured: When True, returns a structured dictionary:
                               {"response_text": str, "charts": List[Dict[str, Any]]}
            chat_history: Optional prior conversation history list

        Returns:
            Synthesized string response (if stream=False and return_structured=False),
            structured dict with response_text and charts (if return_structured=True),
            or Generator of text chunks (if stream=True).
        """
        active_dataset = dataset if dataset is not None else self.dataset
        self.tool_calls_history = []
        self.charts = []

        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT}
        ]

        if chat_history:
            for item in chat_history:
                role = item.get("role", "user")
                content = item.get("content", "")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": str(content)})

        messages.append({"role": "user", "content": prompt})

        if self.client is None:
            raise RuntimeError("Groq client is not initialized. Ensure GROQ_API_KEY is configured.")

        # 1. First Groq call: Decide tool to execute
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            tools=DOE_TOOLS,
            tool_choice="auto",
            temperature=0.0
        )

        response_message = response.choices[0].message
        tool_calls = getattr(response_message, "tool_calls", None)

        # 2. If Groq selected tools, execute each deterministically
        if tool_calls:
            # Append assistant message with tool calls
            messages.append({
                "role": "assistant",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": tc.type,
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments
                        }
                    } for tc in tool_calls
                ]
            })

            for tc in tool_calls:
                fn_name = tc.function.name
                fn_args = json.loads(tc.function.arguments) if isinstance(tc.function.arguments, str) else tc.function.arguments
                
                # Execute Python function
                tool_output = execute_tool(
                    name=fn_name,
                    args=fn_args,
                    dataset=active_dataset,
                    last_analysis=self.last_analysis
                )
                
                if fn_name == "analyze_doe_run_table":
                    self.last_analysis = _ACTIVE_DOE_MODELS.get("last_analysis") or tool_output

                # Capture generated chart if tool generated one
                if isinstance(tool_output, dict) and "chart" in tool_output:
                    self.charts.append(tool_output["chart"])
                    # Send lightweight metadata to Groq prompt context to save tokens
                    groq_payload = {k: v for k, v in tool_output.items() if k != "chart"}
                    groq_payload["chart_rendered"] = True
                else:
                    groq_payload = tool_output

                self.tool_calls_history.append({
                    "id": tc.id,
                    "name": fn_name,
                    "arguments": fn_args,
                    "output": tool_output
                })

                # Append tool result to conversation
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": fn_name,
                    "content": json.dumps(groq_payload, default=str)
                })

            # Auto-generate chart if explicitly requested in prompt and not yet generated
            p_lower = prompt.lower()
            raw_mod = _ACTIVE_DOE_MODELS.get("last_analysis") or self.last_analysis
            if raw_mod and not self.charts:
                f_cols = []
                r_col = None
                if isinstance(raw_mod, dict):
                    f_cols = raw_mod.get("factor_cols", [])
                    r_col = raw_mod.get("response")

                if "pareto" in p_lower:
                    try:
                        self.charts.append(create_pareto_chart(raw_mod))
                    except Exception:
                        pass
                elif "contour" in p_lower and len(f_cols) >= 2:
                    try:
                        self.charts.append(create_contour_plot(raw_mod, f_cols[0], f_cols[1], response_name=r_col))
                    except Exception:
                        pass
                elif ("3d" in p_lower or "surface" in p_lower) and len(f_cols) >= 2:
                    try:
                        self.charts.append(create_3d_surface(raw_mod, f_cols[0], f_cols[1], response_name=r_col))
                    except Exception:
                        pass

            # 3. Second Groq call: Final synthesis with tool results
            if stream:
                if return_structured:
                    raise ValueError("Streaming mode is incompatible with return_structured=True.")
                stream_resp = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    stream=True,
                    temperature=0.2
                )
                def text_generator():
                    for chunk in stream_resp:
                        delta = chunk.choices[0].delta.content if chunk.choices else None
                        if delta:
                            yield delta
                return text_generator()
            else:
                final_resp = self.client.chat.completions.create(
                    model=self.model,
                    messages=messages,
                    stream=False,
                    temperature=0.2
                )
                final_text = final_resp.choices[0].message.content or ""
                self.last_structured_response = {
                    "response_text": final_text,
                    "charts": self.charts
                }
                if return_structured:
                    return {
                        "response_text": final_text,
                        "charts": self.charts
                    }
                return final_text

        # No tool call needed; check for prompt chart generation or return direct response
        direct_text = response_message.content or ""
        self.last_structured_response = {
            "response_text": direct_text,
            "charts": self.charts
        }

        if stream:
            def single_gen():
                yield direct_text
            return single_gen()

        if return_structured:
            return {
                "response_text": direct_text,
                "charts": self.charts
            }
        return direct_text

    def run_structured(
        self,
        prompt: str,
        dataset: Optional[Union[pd.DataFrame, str]] = None,
        chat_history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        Executes the agentic loop and returns a structured JSON response containing:
        - response_text: Markdown explanation of the statistical findings.
        - charts: Array of Plotly JSON objects (if a plot was requested or relevant).
        """
        return self.run(prompt, dataset=dataset, stream=False, return_structured=True, chat_history=chat_history)


# Helper function for quick execution
def run_agent(
    prompt: str,
    dataset: Optional[Union[pd.DataFrame, str]] = None,
    client: Optional[Any] = None,
    stream: bool = False,
    return_structured: bool = False
) -> Union[str, Dict[str, Any], Generator[str, None, None]]:
    """Convenience functional wrapper around DoEAgent."""
    agent = DoEAgent(dataset=dataset, client=client)
    return agent.run(prompt, dataset=dataset, stream=stream, return_structured=return_structured)
