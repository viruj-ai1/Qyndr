# ============================================================
#  api/reports.py  –  Report generation endpoints
# ============================================================
import io
from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from database import get_db, crud
from reports.pdf   import build_pdf_report
from reports.excel import build_excel_report

router = APIRouter(prefix="/reports", tags=["Reports"])


def _collect_project_data(project_id: int, db: Session) -> dict:
    proj     = crud.get_project(db, project_id)
    if not proj: raise HTTPException(404, "Project not found")
    factors  = crud.get_factors(db, project_id)
    responses= crud.get_responses(db, project_id)
    exps     = crud.get_experiments(db, project_id)
    analyses = crud.get_analyses(db, project_id)
    gp_iters = crud.get_gp_iterations(db, project_id)

    # Extract stored optimum
    optimum = None
    for a in analyses:
        if a.optimum:
            optimum = a.optimum
            break

    # If Bayesian optimization has been run, override with the final GP optimum
    if gp_iters:
        from services.bayesian_service import get_final_optimum
        try:
            # Fit GP model and search for the final global optimum on response 0
            gp_opt = get_final_optimum(exps, 0, factors)
            if gp_opt and "final_optimum" in gp_opt:
                optimum = {
                    "actual_optimum": gp_opt["final_optimum"]["actual_values"],
                    "composite_desirability": gp_opt["final_optimum"]["predicted_mean"],
                    "is_gp": True
                }
        except Exception:
            pass
            
    traceability = build_traceability_matrix(proj, factors, responses, analyses)

    return dict(
        project={"name": proj.name, "compound": proj.compound,
                 "objective": proj.objective, "description": proj.description,
                 "doe_type": proj.doe_type, "bayes_iter": proj.bayes_iter,
                 "traceability_matrix": traceability},
        factors=[{"name": f.name, "unit": f.unit, "low": f.low,
                  "high": f.high, "baseline": f.baseline, "stage_id": f.stage_id} for f in factors],
        responses=[{"name": r.name, "unit": r.unit, "goal": r.goal,
                    "target": r.target} for r in responses],
        experiments=[{"run_number": e.run_number, "run_type": e.run_type,
                      "actual_values": e.actual_values or [],
                      "result_values": e.result_values} for e in exps],
        analyses=[{"anova": a.anova, "regression": a.regression} for a in
                  sorted(analyses, key=lambda x: x.response_idx)],
        optimum=optimum,
        gp_iterations=[{"iteration": g.iteration, "ei_score": g.ei_score,
                         "recommended": g.recommended, "new_result": g.new_result}
                        for g in gp_iters]
    )


def build_traceability_matrix(proj, factors, responses, analyses) -> list:
    """
    Auto-generate QTPP -> CQA -> CPP/CMA -> DOE Results traceability matrix.
    """
    qtpp_list = proj.qtpp_data or []
    cqas_list = proj.cqas_data or []
    stages_list = proj.stages_data or []
    risk_dict = proj.risk_assessment_data or {}

    matrix_rows = []
    
    # Map CQAs by ID
    cqa_map = {c["id"]: c for c in cqas_list if isinstance(c, dict)}
    qtpp_map = {q["id"]: q for q in qtpp_list if isinstance(q, dict)}

    # Collect parameters from risk assessments
    for stage_id, stage_data in risk_dict.items():
        stage_name = next((s["name"] for s in stages_list if s["id"] == stage_id), stage_id)
        params = stage_data.get("parameters", []) if isinstance(stage_data, dict) else []
        for p in params:
            linked_cqa_ids = p.get("linkedCqaIds", [])
            linked_cqa_names = [cqa_map[cid]["name"] for cid in linked_cqa_ids if cid in cqa_map]
            
            # Find linked QTPP
            linked_qtpp_names = []
            for cid in linked_cqa_ids:
                if cid in cqa_map:
                    qids = cqa_map[cid].get("linkedQtppIds", [])
                    for qid in qids:
                        if qid in qtpp_map:
                            linked_qtpp_names.append(qtpp_map[qid]["attribute"])

            # Match with DOE factor if present
            matching_factor = next((f for f in factors if f.name.lower() == p.get("name", "").lower()), None)
            factor_range = f"{matching_factor.low} - {matching_factor.high} {matching_factor.unit}" if matching_factor else "N/A"
            
            # ANOVA significance status
            anova_status = "Not Analyzed"
            if matching_factor and analyses:
                for a in analyses:
                    effects = a.effects or []
                    for eff in effects:
                        if eff.get("term", "").lower() == matching_factor.name.lower():
                            anova_status = "Significant (p < 0.05)" if eff.get("significant") else "Non-Significant"

            matrix_rows.append({
                "stage": stage_name,
                "qtpp": ", ".join(list(set(linked_qtpp_names))) if linked_qtpp_names else "General API Specification",
                "cqa": ", ".join(linked_cqa_names) if linked_cqa_names else "Unassigned",
                "parameter": p.get("name", ""),
                "param_type": p.get("type", "CPP-candidate"),
                "rpn": p.get("rpn", 1),
                "is_critical": p.get("criticalFlag", False),
                "factor_range": factor_range,
                "anova_status": anova_status
            })

    return matrix_rows


@router.get("/{project_id}/summary")
def get_report_summary(project_id: int, db: Session = Depends(get_db)):
    proj     = crud.get_project(db, project_id)
    if not proj: raise HTTPException(404, "Project not found")
    factors  = crud.get_factors(db, project_id)
    responses= crud.get_responses(db, project_id)
    analyses = crud.get_analyses(db, project_id)
    
    data = _collect_project_data(project_id, db)
    traceability = build_traceability_matrix(proj, factors, responses, analyses)
    data["traceability_matrix"] = traceability
    data["audit_logs"] = proj.audit_logs or []
    data["locked_campaigns"] = proj.locked_campaigns or []
    return data


@router.get("/{project_id}/pdf")
def download_pdf(project_id: int, db: Session = Depends(get_db)):
    data = _collect_project_data(project_id, db)
    pdf_bytes = build_pdf_report(**data)
    filename  = f"DOE_Report_{data['project']['name'].replace(' ','_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/{project_id}/excel")
def download_excel(project_id: int, db: Session = Depends(get_db)):
    data = _collect_project_data(project_id, db)
    xlsx_bytes = build_excel_report(**data)
    filename   = f"DOE_Report_{data['project']['name'].replace(' ','_')}.xlsx"
    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

