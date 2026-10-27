# ============================================================
#  backend/services/project_context.py
#  Full Project Context Aggregator for Virtual Data Scientist
# ============================================================
from typing import Dict, List, Any, Optional, Tuple
import os
import json
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from database import models, crud


def build_full_project_context(project_id: int, db: Session) -> Dict[str, Any]:
    """
    Compiles a comprehensive pharmaceutical QbD and DoE dossier for the active project:
    1. Identity: Name, Compound / Active Substance, Objective, Description.
    2. Phase 0 QbD: QTPP, CQAs, Synthesis Route & Unit Operations, Reverse Risk Assessment (FMEA).
    3. DoE Design Space: Factors, ranges, responses, optimization targets.
    4. Experimental Observations: Run table DataFrame, completed runs, replicates.
    5. Statistical Analyses: ANOVA, R², Adjusted R², lack-of-fit, regression coefficients.
    6. Optimum & Design Space: Best observed run, GP predicted optimum, NOR, and PAR ranges.
    """
    proj = crud.get_project(db, project_id)
    if not proj:
        return {}

    factors = crud.get_factors(db, project_id)
    responses = crud.get_responses(db, project_id)
    experiments = crud.get_experiments(db, project_id)
    analyses = crud.get_analyses(db, project_id)
    gp_iters = crud.get_gp_iterations(db, project_id)

    factor_names = [f.name for f in factors]
    response_names = [r.name for r in responses]

    # 1. Build DataFrame of observations
    rows = []
    completed_runs = []
    for e in experiments:
        if e.actual_values and e.result_values:
            row = {
                "Run": e.run_number,
                "Type": e.run_type or "Factorial",
                "Iteration": e.iteration or 0
            }
            f_dict = {}
            for fn, fv in zip(factor_names, e.actual_values):
                row[fn] = fv
                f_dict[fn] = fv
            r_dict = {}
            for rn, rv in zip(response_names, e.result_values):
                row[rn] = rv
                r_dict[rn] = rv
            rows.append(row)
            completed_runs.append({
                "run_number": e.run_number,
                "run_type": e.run_type,
                "iteration": e.iteration,
                "factors": f_dict,
                "responses": r_dict
            })

    df = pd.DataFrame(rows) if rows else pd.DataFrame()

    # 2. Extract QTPP
    qtpp_list = []
    for item in (proj.qtpp_data or []):
        if isinstance(item, dict):
            qtpp_list.append({
                "id": item.get("id", ""),
                "attribute": item.get("attribute", ""),
                "criterion": item.get("criterion", ""),
                "justification": item.get("justification", ""),
                "type": item.get("type", "Quality")
            })

    # 3. Extract CQAs
    cqas_list = []
    for item in (proj.cqas_data or []):
        if isinstance(item, dict):
            cqas_list.append({
                "id": item.get("id", ""),
                "name": item.get("name", ""),
                "appliesTo": item.get("appliesTo", "Final API"),
                "stageName": item.get("stageName", ""),
                "method": item.get("method", ""),
                "range": item.get("range", ""),
                "justification": item.get("justification", ""),
                "linkedQtppIds": item.get("linkedQtppIds", [])
            })

    # 4. Extract Stages / Route Mapping
    stages_list = []
    for s in (proj.stages_data or []):
        if isinstance(s, dict):
            stages_list.append({
                "id": s.get("id", ""),
                "order": s.get("order", 1),
                "name": s.get("name", ""),
                "unitOpType": s.get("unitOpType", ""),
                "description": s.get("description", ""),
                "intermediateProduced": s.get("intermediateProduced", "")
            })

    # 5. Extract Risk Assessment (CPPs & CMAs)
    risk_data = proj.risk_assessment_data or {}
    cpp_candidates = []
    cma_candidates = []
    if isinstance(risk_data, dict):
        for stage_id, stage_content in risk_data.items():
            params = stage_content.get("parameters", []) if isinstance(stage_content, dict) else []
            for p in params:
                if isinstance(p, dict):
                    ptype = str(p.get("type", ""))
                    item_entry = {
                        "stage_id": stage_id,
                        "name": p.get("name", ""),
                        "type": ptype,
                        "severity": p.get("severity", 1),
                        "occurrence": p.get("occurrence", 1),
                        "detectability": p.get("detectability", 1),
                        "rpn": p.get("rpn", 1),
                        "criticalFlag": p.get("criticalFlag", False),
                        "rationale": p.get("rationale", "")
                    }
                    if "cpp" in ptype.lower() or p.get("criticalFlag"):
                        cpp_candidates.append(item_entry)
                    else:
                        cma_candidates.append(item_entry)

    # 6. Parse Statistical Analyses
    analyses_summary = []
    for a in analyses:
        ridx = a.response_idx
        resp_name = response_names[ridx] if ridx < len(response_names) else f"Response_{ridx}"
        reg = a.regression or {}
        anova = a.anova or {}
        coeffs = reg.get("coefficients", []) if isinstance(reg, dict) else []
        sig_terms = [c for c in coeffs if isinstance(c, dict) and c.get("p_value", 1.0) < 0.05]
        analyses_summary.append({
            "response_name": resp_name,
            "response_idx": ridx,
            "r2": reg.get("R2"),
            "r2_adj": reg.get("R2_adj"),
            "mse": reg.get("MSE"),
            "anova": anova,
            "coefficients": coeffs,
            "significant_terms": [c.get("term") for c in sig_terms]
        })

    # 7. Extract Best Observed Physical Run
    best_observed = None
    if rows and response_names:
        primary_resp = response_names[0]
        primary_goal = responses[0].goal if responses else "maximize"
        try:
            valid_rows = [r for r in rows if primary_resp in r and pd.notnull(r[primary_resp])]
            if valid_rows:
                if primary_goal == "minimize":
                    best_row = min(valid_rows, key=lambda x: x[primary_resp])
                else:
                    best_row = max(valid_rows, key=lambda x: x[primary_resp])
                best_observed = {
                    "run_number": best_row.get("Run"),
                    "value": float(best_row.get(primary_resp, 0.0)),
                    "response_name": primary_resp,
                    "factors": {fn: best_row.get(fn) for fn in factor_names}
                }
        except Exception:
            pass

    # 8. Extract GP Predicted Optimum & Proven Operating Envelope
    final_optimum = None
    if gp_iters:
        last_gp = gp_iters[-1]
        rec = last_gp.recommended or {}
        if rec and "actual_values" in rec:
            opt_vals = rec.get("actual_values", [])
            opt_dict = {fn: v for fn, v in zip(factor_names, opt_vals)}
            
            # Formulate Proven Acceptable Range (PAR) and Normal Operating Range (NOR)
            nor_ranges = {}
            par_ranges = {}
            for f in factors:
                val = opt_dict.get(f.name, (f.low + f.high) / 2)
                span = f.high - f.low
                # NOR typically +/- 3% to 5% around target
                nor_margin = span * 0.04
                nor_ranges[f.name] = {
                    "target": round(val, 2),
                    "min": round(max(f.low, val - nor_margin), 2),
                    "max": round(min(f.high, val + nor_margin), 2),
                    "unit": f.unit
                }
                # PAR proven over demonstrated design space
                par_ranges[f.name] = {
                    "min": f.low,
                    "max": f.high,
                    "unit": f.unit
                }

            final_optimum = {
                "iteration": last_gp.iteration,
                "factor_settings": opt_dict,
                "predicted_mean": rec.get("predicted_mean"),
                "predicted_std": rec.get("predicted_std"),
                "confidence_95": rec.get("confidence_95"),
                "acquisition_type": rec.get("acquisition_type", "EI"),
                "expected_improvement": rec.get("expected_improvement"),
                "nor": nor_ranges,
                "par": par_ranges
            }

    context = {
        "project_id": proj.id,
        "name": proj.name,
        "compound": proj.compound or proj.name,
        "objective": proj.objective or "Process optimization and yield enhancement adhering to QbD principles.",
        "description": proj.description or "",
        "current_step": proj.current_step or "final_optimum",
        "doe_type": proj.doe_type or "RSM (Box-Behnken / Central Composite)",
        "qtpp": qtpp_list,
        "cqas": cqas_list,
        "stages": stages_list,
        "cpp_candidates": cpp_candidates,
        "cma_candidates": cma_candidates,
        "factors": [
            {
                "name": f.name,
                "symbol": f.symbol,
                "unit": f.unit,
                "low": f.low,
                "high": f.high,
                "baseline": f.baseline,
                "is_categorical": f.is_categorical,
                "is_hard_to_change": f.is_hard_to_change
            } for f in factors
        ],
        "responses": [
            {
                "name": r.name,
                "unit": r.unit,
                "goal": r.goal,
                "target": r.target,
                "lower_limit": r.lower_limit,
                "upper_limit": r.upper_limit,
                "weight": r.weight
            } for r in responses
        ],
        "n_experiments": len(rows),
        "completed_runs": completed_runs,
        "dataframe": df,
        "analyses": analyses_summary,
        "best_observed": best_observed,
        "final_optimum": final_optimum
    }

    return context


def format_project_context_markdown(ctx: Dict[str, Any]) -> str:
    """
    Renders the active project dossier into a structured, dense Markdown text
    suitable for system prompt injection and analytical grounding.
    """
    if not ctx:
        return "No active project data available."

    lines = []
    lines.append(f"# Pharmaceutical Project Dossier: {ctx.get('name')}")
    lines.append(f"**Target Molecule / Compound**: {ctx.get('compound')}")
    lines.append(f"**Primary Objective**: {ctx.get('objective')}")
    if ctx.get("description"):
        lines.append(f"**Process Description**: {ctx.get('description')}")
    lines.append(f"**DoE Architecture**: {ctx.get('doe_type')} · Stage Status: `{ctx.get('current_step')}`")
    lines.append("")

    # 1. Phase 0 QbD
    lines.append("## 1. Phase 0 Quality by Design (QbD) Foundation")
    if ctx.get("qtpp"):
        lines.append("### Quality Target Product Profile (QTPP)")
        for q in ctx["qtpp"]:
            lines.append(f"- **{q['attribute']}** ({q['type']}): Criteria: `{q['criterion']}` | Justification: {q['justification']}")
        lines.append("")

    if ctx.get("cqas"):
        lines.append("### Critical Quality Attributes (CQAs)")
        for c in ctx["cqas"]:
            lines.append(f"- **{c['name']}** [{c['appliesTo']}]: Acceptance Range: `{c['range']}` | Analytical Method: `{c['method']}` ({c.get('stageName','')})")
        lines.append("")

    if ctx.get("stages"):
        lines.append("### Synthetic Route & Unit Operations")
        for s in ctx["stages"]:
            lines.append(f"- **Stage {s.get('order')}: {s.get('name')}** ({s.get('unitOpType')}) -> Produces: `{s.get('intermediateProduced')}` | {s.get('description')}")
        lines.append("")

    if ctx.get("cpp_candidates"):
        lines.append("### Risk Assessment (Identified Critical Parameters)")
        for p in ctx["cpp_candidates"]:
            lines.append(f"- **{p['name']}** [{p['type']}]: RPN={p['rpn']} (S:{p['severity']}, O:{p['occurrence']}, D:{p['detectability']}). Rationale: {p['rationale']}")
        lines.append("")

    # 2. Factors & Responses
    lines.append("## 2. Design of Experiments (DoE) Parameter Space")
    lines.append("### Investigated Factors (Process Inputs):")
    for f in ctx.get("factors", []):
        unit_str = f" {f['unit']}" if f.get('unit') else ""
        lines.append(f"- `{f['name']}`: Operating Range [{f['low']}{unit_str} to {f['high']}{unit_str}], Baseline: {f.get('baseline')}{unit_str}")
    lines.append("")

    lines.append("### Monitored Responses (CQAs / Process Outputs):")
    for r in ctx.get("responses", []):
        unit_str = f" ({r['unit']})" if r.get('unit') else ""
        lines.append(f"- `{r['name']}`{unit_str}: Goal: **{r['goal']}** (Target: {r.get('target', 'N/A')}, Limits: [{r.get('lower_limit','-∞')}, {r.get('upper_limit','+∞')}])")
    lines.append("")

    # 3. Experimental Dataset & Statistical Modeling
    n_exp = ctx.get("n_experiments", 0)
    lines.append(f"## 3. Experimental Data & Model Diagnostics ({n_exp} Physical Runs)")
    if ctx.get("analyses"):
        for a in ctx["analyses"]:
            r2_val = f"{a['r2']:.4f}" if a.get('r2') is not None else "N/A"
            r2_adj = f"{a['r2_adj']:.4f}" if a.get('r2_adj') is not None else "N/A"
            sig_str = ", ".join(a.get("significant_terms", [])) or "None (p > 0.05)"
            lines.append(f"- Response **{a['response_name']}**: Model R² = {r2_val}, Adj R² = {r2_adj}. Statistically Significant Effects (p < 0.05): `{sig_str}`")
    lines.append("")

    # 4. Global Optimum & Proven Operating Ranges
    lines.append("## 4. Optimization & Design Space Envelope")
    if ctx.get("best_observed"):
        bo = ctx["best_observed"]
        lines.append(f"- **Best Observed Physical Run**: Run #{bo['run_number']} yielding **{bo['value']:.3f}** for {bo.get('response_name')}.")
        lines.append(f"  Settings: {', '.join([f'{k}={v}' for k, v in bo.get('factors', {}).items()])}")

    if ctx.get("final_optimum"):
        fo = ctx["final_optimum"]
        lines.append(f"- **Gaussian Process Global Optimum**: Predicted Response Mean = **{fo.get('predicted_mean', 0.0):.3f}** (95% CI: {fo.get('confidence_95')})")
        lines.append("  **Recommended Optimum Factor Coordinates**:")
        for k, v in fo.get("factor_settings", {}).items():
            lines.append(f"  * `{k}`: {v}")
        if fo.get("nor"):
            lines.append("  **Normal Operating Ranges (NOR - Routine Control)**:")
            for fn, rng in fo["nor"].items():
                lines.append(f"  * `{fn}`: Target {rng['target']}{rng['unit']} (Acceptable window: {rng['min']} - {rng['max']}{rng['unit']})")
        if fo.get("par"):
            lines.append("  **Proven Acceptable Ranges (PAR - Validated Envelope)**:")
            for fn, rng in fo["par"].items():
                lines.append(f"  * `{fn}`: {rng['min']} to {rng['max']}{rng['unit']}")

    return "\n".join(lines)
