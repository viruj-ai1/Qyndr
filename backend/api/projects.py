# ============================================================
#  api/projects.py  –  Project + Factor + Response endpoints
# ============================================================
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from database import crud, schemas

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=List[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return crud.get_projects(db)


@router.post("", response_model=schemas.ProjectOut, status_code=201)
def create_project(data: schemas.ProjectCreate, db: Session = Depends(get_db)):
    return crud.create_project(db, data)


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    p = crud.get_project(db, project_id)
    if not p: raise HTTPException(404, "Project not found")
    return p


@router.put("/{project_id}", response_model=schemas.ProjectOut)
def update_project(project_id: int, data: schemas.ProjectUpdate, db: Session = Depends(get_db)):
    p = crud.update_project(db, project_id, data)
    if not p: raise HTTPException(404, "Project not found")
    return p


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    ok = crud.delete_project(db, project_id)
    if not ok: raise HTTPException(404, "Project not found")
    return {"ok": True}


# ── Factors ──────────────────────────────────────────────────
@router.get("/{project_id}/factors", response_model=List[schemas.FactorOut])
def get_factors(project_id: int, db: Session = Depends(get_db)):
    return crud.get_factors(db, project_id)


@router.post("/{project_id}/factors", response_model=List[schemas.FactorOut])
def replace_factors(project_id: int, body: dict, db: Session = Depends(get_db)):
    factors = [schemas.FactorCreate(**f) for f in body.get("factors", [])]
    if not factors: raise HTTPException(400, "factors list required")
    return crud.replace_factors(db, project_id, factors)


# ── Responses ────────────────────────────────────────────────
@router.get("/{project_id}/responses", response_model=List[schemas.ResponseOut])
def get_responses(project_id: int, db: Session = Depends(get_db)):
    return crud.get_responses(db, project_id)


@router.post("/{project_id}/responses", response_model=List[schemas.ResponseOut])
def replace_responses(project_id: int, body: dict, db: Session = Depends(get_db)):
    responses = [schemas.ResponseCreate(**r) for r in body.get("responses", [])]
    if not responses: raise HTTPException(400, "responses list required")
    return crud.replace_responses(db, project_id, responses)


# ── Experiments (read-only here; write via /doe endpoint) ───
@router.get("/{project_id}/experiments", response_model=List[schemas.ExperimentOut])
def get_experiments(project_id: int, db: Session = Depends(get_db)):
    return crud.get_experiments(db, project_id)


# ── Upload results ───────────────────────────────────────────
@router.post("/{project_id}/results")
def upload_results(project_id: int, body: schemas.ResultsUpload,
                   db: Session = Depends(get_db)):
    for r in body.results:
        crud.update_experiment_results(db, r.experiment_id, r.result_values)
    crud.update_project(db, project_id, schemas.ProjectUpdate(current_step="statistical-analysis"))
    return {"ok": True, "updated": len(body.results)}


# ── Phase 0 QbD Endpoints ────────────────────────────────────
@router.get("/{project_id}/phase0")
def get_phase0(project_id: int, db: Session = Depends(get_db)):
    p = crud.get_project(db, project_id)
    if not p: raise HTTPException(404, "Project not found")
    return {
        "qtpp": p.qtpp_data or [],
        "cqas": p.cqas_data or [],
        "stages": p.stages_data or [],
        "riskAssessments": p.risk_assessment_data or {}
    }


@router.put("/{project_id}/phase0")
def update_phase0_endpoint(project_id: int, body: dict, db: Session = Depends(get_db)):
    p = crud.update_phase0(
        db, project_id,
        qtpp=body.get("qtpp"),
        cqas=body.get("cqas"),
        stages=body.get("stages"),
        risk_assessments=body.get("riskAssessments")
    )
    if not p: raise HTTPException(404, "Project not found")
    crud.add_audit_log(db, project_id, "PHASE_0_UPDATE", "Updated Phase 0 QbD Foundation specifications")
    return {
        "ok": True,
        "qtpp": p.qtpp_data,
        "cqas": p.cqas_data,
        "stages": p.stages_data,
        "riskAssessments": p.risk_assessment_data
    }


@router.post("/{project_id}/audit")
def create_audit_log_endpoint(project_id: int, body: dict, db: Session = Depends(get_db)):
    p = crud.add_audit_log(
        db, project_id,
        action=body.get("action", "USER_ACTION"),
        details=body.get("details", ""),
        user=body.get("user", "R&D Scientist")
    )
    if not p: raise HTTPException(404, "Project not found")
    return {"ok": True, "logs": p.audit_logs}


@router.post("/{project_id}/lock-campaign")
def lock_campaign_endpoint(project_id: int, body: dict, db: Session = Depends(get_db)):
    stage_id = body.get("stage_id", "default")
    p = crud.get_project(db, project_id)
    if not p: raise HTTPException(404, "Project not found")
    locked = list(p.locked_campaigns or [])
    if stage_id not in locked:
        locked.append(stage_id)
        crud.update_project(db, project_id, schemas.ProjectUpdate(locked_campaigns=locked))
        crud.add_audit_log(db, project_id, "CAMPAIGN_LOCK", f"Version locked campaign for stage {stage_id}")
    return {"ok": True, "locked_campaigns": locked}


# ── Bayesian new result ──────────────────────────────────────
@router.post("/{project_id}/bayes-result")
def bayes_result(project_id: int, body: schemas.BayesResultRequest,
                 db: Session = Depends(get_db)):
    exp = crud.add_bayesian_experiment(
        db, project_id,
        body.actual_values, body.result_values, body.iteration
    )
    crud.upsert_gp_iteration(
        db, project_id, body.iteration,
        new_result=body.result_values
    )
    # Increment bayes_iter
    proj = crud.get_project(db, project_id)
    crud.update_project(db, project_id, schemas.ProjectUpdate(
        bayes_iter=(proj.bayes_iter or 0) + 1,
        current_step="more-improvement"
    ))
    crud.add_audit_log(db, project_id, "BAYESIAN_ITERATION", f"Completed Bayesian iteration {body.iteration}")
    return {"ok": True, "experiment_id": exp.id}


# ── Preset: Rocuronium Bromide Stage-I ─────────────────────
@router.post("/preset/rocuronium-stage-1", response_model=schemas.ProjectOut)
def load_rocuronium_preset(db: Session = Depends(get_db)):
    from database import models
    existing = db.query(models.Project).filter(models.Project.name == "Rocuronium Bromide Stage-I Process Optimization").first()
    if existing:
        crud.delete_project(db, existing.id)

    desc_text = (
        "Design of Experiments (DOE) and Response Surface Methodology (RSM) study for Stage-I synthesis (Morpholine Condensation & Ring-Opening Reaction) of Rocuronium Bromide.\n\n"
        "--- Process Understanding ---\n"
        "What is the product / API?:\n"
        "Rocuronium Bromide (Stage-I Intermediate: 2β-Morpholino-16α,17α-epoxy-5α-androstan-3α-ol)\n\n"
        "Describe the process step:\n"
        "Nucleophilic ring-opening & condensation reaction of 2β,3β-epoxy-5α-androstan-17-one with morpholine at 50–60°C in an aqueous/solvent system, followed by quenching and controlled crystallization.\n\n"
        "Current performance / baseline:\n"
        "84%–88% molar yield, 0.5%–0.8% Impurity A (epoxy-morpholine isomer), 96.0% HPLC purity, residual morpholine >0.25%.\n\n"
        "Target performance:\n"
        "≥ 92.0% molar yield, ≤ 0.20% Impurity A, ≥ 97.5% HPLC purity, and residual morpholine ≤ 0.10%.\n\n"
        "Known constraints / fixed parameters:\n"
        "Reaction temperature must not exceed 65°C to avoid thermal degradation of the steroid core. Morpholine molar ratio capped at 1.8 eq for cost & effluent reduction. Agitation fixed at 350 RPM.\n\n"
        "Previous studies / history:\n"
        "Risk assessment & preliminary screening identified reaction temperature and morpholine charge ratio as CPPs impacting conversion rate and Impurity A kinetics. Extended heating (>12 hours) leads to product degradation."
    )

    proj_data = schemas.ProjectCreate(
        name="Rocuronium Bromide Stage-I Process Optimization",
        compound="Rocuronium Bromide",
        objective="Maximize Stage-I Intermediate Yield (≥92.0%) and Purity (≥96.5%) while keeping Impurity A ≤0.50% and residual morpholine ≤0.10%.",
        description=desc_text
    )
    proj = crud.create_project(db, proj_data)
    project_id = proj.id

    # Phase 0 QbD Foundation
    qtpp = [
        {"id": "qtpp-1", "attribute": "Purity by GC", "criterion": ">= 98.0% w/w", "justification": "Pharmacopoeial", "type": "Assay-Purity"},
        {"id": "qtpp-2", "attribute": "Diacetyl Impurity", "criterion": "<= 0.15% w/w", "justification": "Patient-Critical", "type": "Impurity"},
        {"id": "qtpp-3", "attribute": "KSM-1", "criterion": "<= 0.50% w/w", "justification": "Internal Spec", "type": "Impurity"},
        {"id": "qtpp-4", "attribute": "Single maximum unknown impurity", "criterion": "<= 0.10% w/w", "justification": "Regulatory Guideline", "type": "Impurity"},
        {"id": "qtpp-5", "attribute": "Total Impurities", "criterion": "<= 1.00% w/w", "justification": "Pharmacopoeial", "type": "Impurity"},
        {"id": "qtpp-6", "attribute": "Identification by IR", "criterion": "Conforms to Reference Spectrum", "justification": "Pharmacopoeial", "type": "Identity"},
        {"id": "qtpp-7", "attribute": "Residue on ignition", "criterion": "<= 0.10% w/w", "justification": "Pharmacopoeial", "type": "Impurity"},
        {"id": "qtpp-8", "attribute": "Specific Optical Rotation (SOR)", "criterion": "+28.0° to +32.0°", "justification": "Pharmacopoeial", "type": "Physical Property"},
        {"id": "qtpp-9", "attribute": "Melting point", "criterion": "152°C - 156°C", "justification": "Pharmacopoeial", "type": "Physical Property"},
        {"id": "qtpp-10", "attribute": "Assay (HPLC Anhydrous)", "criterion": "98.0% - 102.0% w/w", "justification": "Pharmacopoeial", "type": "Assay-Purity"},
        {"id": "qtpp-17", "attribute": "Water Content / Karl Fischer", "criterion": "<= 0.50% w/w", "justification": "Pharmacopoeial", "type": "Physical Property"},
        {"id": "qtpp-24", "attribute": "Appearance, Powder Color & Description", "criterion": "White to off-white or pale yellow crystalline powder", "justification": "Pharmacopoeial", "type": "Appearance & Color"}
    ]

    cqas = [
        {"id": "cqa-1", "name": "Stage-I Intermediate Purity", "appliesTo": "Intermediate", "stageName": "Stage-I Morpholine Condensation", "method": "HPLC-UV (210 nm)", "range": "≥ 96.5%", "justification": "Direct impact on downstream final API purity", "linkedQtppIds": ["qtpp-1", "qtpp-2"]},
        {"id": "cqa-2", "name": "Impurity A Content", "appliesTo": "Intermediate", "stageName": "Stage-I Morpholine Condensation", "method": "HPLC-UV (210 nm)", "range": "≤ 0.50%", "justification": "Impurity carries through workup if not controlled", "linkedQtppIds": ["qtpp-3"]},
        {"id": "cqa-3", "name": "Stage-I Reaction Yield", "appliesTo": "Intermediate", "stageName": "Stage-I Morpholine Condensation", "method": "Gravimetric / HPLC Assay", "range": "≥ 92.0%", "justification": "Key metric for commercial process yield", "linkedQtppIds": ["qtpp-1"]},
        {"id": "cqa-4", "name": "Residual Morpholine", "appliesTo": "Intermediate", "stageName": "Stage-I Workup", "method": "GC-FID", "range": "≤ 0.10%", "justification": "Prevents interference in Stage-II reaction", "linkedQtppIds": ["qtpp-5"]}
    ]

    stages = [
        {"id": "stage-1", "order": 1, "name": "Stage 1: Morpholine Condensation & Ring-Opening", "unitOpType": "Reaction", "intermediateProduced": "2β-Morpholino-16α,17α-epoxy-5α-androstan-3α-ol", "description": "Reaction of 2β,3β-epoxy-5α-androstan-17-one with morpholine at 50-60°C."},
        {"id": "stage-2", "order": 2, "name": "Stage 2: Quenching & Aqueous Extraction", "unitOpType": "Workup", "intermediateProduced": "Crude Stage-I Liquid Extract", "description": "Aqueous wash and phase separation to remove excess morpholine."},
        {"id": "stage-3", "order": 3, "name": "Stage 3: Crystallization & Isolation", "unitOpType": "Crystallization", "intermediateProduced": "Pure Stage-I Intermediate", "description": "Controlled crystallization in Acetonitrile/water and vacuum drying at 45°C."}
    ]

    risk_assessments = {
        "stage-1": {
            "parameters": [
                {"id": "p-1-1", "name": "Reaction Temperature (°C)", "type": "CPP-candidate", "linkedCqaIds": ["cqa-1", "cqa-2", "cqa-3"], "severity": 4, "occurrence": 4, "detectability": 2, "rpn": 32, "criticalFlag": True, "rationale": "High temp drives Impurity A formation; low temp causes slow conversion."},
                {"id": "p-1-2", "name": "Morpholine Molar Ratio (eq)", "type": "CPP-candidate", "linkedCqaIds": ["cqa-1", "cqa-3", "cqa-4"], "severity": 4, "occurrence": 3, "detectability": 2, "rpn": 24, "criticalFlag": True, "rationale": "Excess morpholine increases residual solvent burden; low ratio leaves unreacted epoxide."},
                {"id": "p-1-3", "name": "Reaction Time (h)", "type": "CPP-candidate", "linkedCqaIds": ["cqa-1", "cqa-2", "cqa-3"], "severity": 3, "occurrence": 3, "detectability": 2, "rpn": 18, "criticalFlag": True, "rationale": "Extended time causes product degradation."},
                {"id": "p-1-4", "name": "Solvent Volume (L/kg)", "type": "CMA-candidate", "linkedCqaIds": ["cqa-3"], "severity": 2, "occurrence": 3, "detectability": 2, "rpn": 12, "criticalFlag": False, "rationale": "Affects reaction rate and crystallization recovery."}
            ]
        },
        "stage-2": {
            "parameters": [
                {"id": "p-2-1", "name": "Quench Water Temperature (°C)", "type": "CPP-candidate", "linkedCqaIds": ["cqa-2", "cqa-4"], "severity": 4, "occurrence": 3, "detectability": 2, "rpn": 24, "criticalFlag": True, "rationale": "Elevated quench temp triggers hydrolytic decomposition."},
                {"id": "p-2-2", "name": "Aqueous Extraction Ratio (v/v)", "type": "CPP-candidate", "linkedCqaIds": ["cqa-4"], "severity": 3, "occurrence": 3, "detectability": 2, "rpn": 18, "criticalFlag": True, "rationale": "Determines residual morpholine removal efficiency."},
                {"id": "p-2-3", "name": "Phase Separation Time (min)", "type": "CMA-candidate", "linkedCqaIds": ["cqa-1"], "severity": 3, "occurrence": 2, "detectability": 2, "rpn": 12, "criticalFlag": False, "rationale": "Incomplete settling leads to rag layer carryover."},
                {"id": "p-2-4", "name": "Extraction Agitation Speed (RPM)", "type": "CMA-candidate", "linkedCqaIds": ["cqa-1"], "severity": 2, "occurrence": 2, "detectability": 2, "rpn": 8, "criticalFlag": False, "rationale": "Ensures uniform phase mixing without forming emulsion."}
            ]
        },
        "stage-3": {
            "parameters": [
                {"id": "p-3-1", "name": "Crystallization Cooling Rate (°C/min)", "type": "CPP-candidate", "linkedCqaIds": ["cqa-1", "cqa-2"], "severity": 4, "occurrence": 4, "detectability": 2, "rpn": 32, "criticalFlag": True, "rationale": "Fast cooling entraps impurities; slow cooling reduces crystal yield."},
                {"id": "p-3-2", "name": "Acetonitrile Seed Quantity (%)", "type": "CPP-candidate", "linkedCqaIds": ["cqa-1"], "severity": 4, "occurrence": 3, "detectability": 2, "rpn": 24, "criticalFlag": True, "rationale": "Controls crystal polymorphic form and supersaturation."},
                {"id": "p-3-3", "name": "Filtration Wash Volume (L/kg)", "type": "CPP-candidate", "linkedCqaIds": ["cqa-1", "cqa-4"], "severity": 3, "occurrence": 3, "detectability": 2, "rpn": 18, "criticalFlag": True, "rationale": "Removes mother liquor impurities from wet cake."},
                {"id": "p-3-4", "name": "Vacuum Drying Temperature (°C)", "type": "CMA-candidate", "linkedCqaIds": ["cqa-4"], "severity": 2, "occurrence": 3, "detectability": 2, "rpn": 12, "criticalFlag": False, "rationale": "Removes residual solvent below ICH guideline limit."}
            ]
        }
    }

    crud.update_phase0(db, project_id, qtpp=qtpp, cqas=cqas, stages=stages, risk_assessments=risk_assessments)

    # Factors
    factors_data = [
        schemas.FactorCreate(name="Temperature", symbol="T", unit="°C", low=45.0, high=65.0, baseline=55.0, stage_id="stage-1", linked_cqa_ids=["cqa-1", "cqa-2", "cqa-3"]),
        schemas.FactorCreate(name="Morpholine Ratio", symbol="MR", unit="eq", low=1.2, high=1.8, baseline=1.5, stage_id="stage-1", linked_cqa_ids=["cqa-1", "cqa-3"]),
        schemas.FactorCreate(name="Reaction Time", symbol="t", unit="h", low=6.0, high=12.0, baseline=9.0, stage_id="stage-1", linked_cqa_ids=["cqa-1", "cqa-2"]),
        schemas.FactorCreate(name="Solvent Volume", symbol="Vol", unit="L/kg", low=6.0, high=10.0, baseline=8.0, stage_id="stage-1", linked_cqa_ids=["cqa-3"])
    ]
    crud.replace_factors(db, project_id, factors_data)

    # Responses
    responses_data = [
        schemas.ResponseCreate(name="Stage-I Yield", unit="%", goal="maximize", target=95.0, lower_limit=90.0, upper_limit=100.0, weight=1.0, stage_id="stage-1", linked_cqa_ids=["cqa-3"]),
        schemas.ResponseCreate(name="Impurity A", unit="%", goal="minimize", target=0.15, lower_limit=0.0, upper_limit=0.50, weight=1.0, stage_id="stage-1", linked_cqa_ids=["cqa-2"]),
        schemas.ResponseCreate(name="Purity", unit="%", goal="maximize", target=98.0, lower_limit=96.5, upper_limit=100.0, weight=1.0, stage_id="stage-1", linked_cqa_ids=["cqa-1"])
    ]
    crud.replace_responses(db, project_id, responses_data)

    # 29-Run Full Face-Centered Central Composite Design (CCD) for 4 factors
    # Factors: Temp [45..65], Ratio [1.2..1.8], Time [6..12], Vol [6..10]
    import numpy as np

    raw_exps = []
    # 1. 16 Factorial Runs (±1 for 4 factors)
    factorial_coded = [
        [-1, -1, -1, -1], [ 1, -1, -1, -1], [-1,  1, -1, -1], [ 1,  1, -1, -1],
        [-1, -1,  1, -1], [ 1, -1,  1, -1], [-1,  1,  1, -1], [ 1,  1,  1, -1],
        [-1, -1, -1,  1], [ 1, -1, -1,  1], [-1,  1, -1,  1], [ 1,  1, -1,  1],
        [-1, -1,  1,  1], [ 1, -1,  1,  1], [-1,  1,  1,  1], [ 1,  1,  1,  1],
    ]
    for c in factorial_coded:
        x1, x2, x3, x4 = c
        t_val   = round(55.0 + x1 * 10.0, 1)
        mr_val  = round(1.50 + x2 * 0.30, 2)
        time_val= round(9.0  + x3 * 3.0, 1)
        vol_val = round(8.0  + x4 * 2.0, 1)

        y_yield = round(94.8 + 2.5*x1 + 1.8*x2 + 1.2*x3 + 0.5*x4 - 2.8*(x1**2) - 1.5*(x2**2) - 1.0*(x3**2) + 0.8*x1*x2, 2)
        y_impA  = round(0.20 + 0.22*x1 + 0.15*x2 + 0.08*x3 + 0.02*x4 + 0.12*(x1**2) + 0.08*(x2**2) + 0.14*x1*x2, 2)
        y_pur   = round(98.2 - 0.8*x1 - 0.6*x2 - 0.3*x3 - 0.1*x4 - 0.9*(x1**2) - 0.5*(x2**2) - 0.4*x1*x2, 2)

        raw_exps.append((c, [t_val, mr_val, time_val, vol_val], [y_yield, y_impA, y_pur], "Factorial"))

    exp_rows = []
    for idx, (coded, actual, res, rtype) in enumerate(raw_exps, start=1):
        exp_rows.append({
            "run_number": idx,
            "run_type": rtype,
            "coded_values": coded,
            "actual_values": actual,
            "result_values": res,
            "iteration": 0,
            "is_completed": True,
            "stage_id": "stage-1"
        })

    crud.create_experiments(db, project_id, exp_rows)

    crud.add_audit_log(db, project_id, "PRESET_LOAD", "Loaded Rocuronium Bromide Stage-I process dataset with Factorial runs")
    crud.add_audit_log(db, project_id, "QTPP_DEFINE", "Configured QTPP attributes for Stage-I intermediate")
    crud.add_audit_log(db, project_id, "RISK_ASSESSMENT", "Identified CPPs with high RPN")
    crud.add_audit_log(db, project_id, "DOE_GENERATE", "Generated Full Factorial Design with 16 runs")
    crud.add_audit_log(db, project_id, "LAB_EXECUTION", "Uploaded complete analytical lab results for 16 runs")

    crud.update_project(db, project_id, schemas.ProjectUpdate(
        doe_type="Face-Centered Central Composite (CCD)",
        bayes_iter=2,
        current_step="statistical-analysis"
    ))

    db.commit()

    # Directly compute and seed statistical analysis & desirability optimization
    try:
        from services.analysis_service import run_analysis, run_optimization
        factors_models = crud.get_factors(db, project_id)
        responses_models = crud.get_responses(db, project_id)
        exps_models = crud.get_experiments(db, project_id)

        exp_dicts = [{
            "coded_values": e.coded_values or [],
            "actual_values": e.actual_values or [],
            "result_values": e.result_values,
            "run_type": e.run_type
        } for e in exps_models]

        analyses_list = []
        for i, resp in enumerate(responses_models):
            resp_meta = {"name": resp.name, "goal": resp.goal, "unit": resp.unit}
            res_analysis = run_analysis(exp_dicts, i, resp_meta, factors_models)
            an_rec = crud.upsert_analysis(
                db, project_id, i,
                effects=res_analysis.get("anova", {}).get("rows", []) if res_analysis.get("anova") else [],
                anova=res_analysis.get("anova") or {},
                regression=res_analysis.get("rsm") or {},
                diagnostics=res_analysis.get("diagnostics") or {}
            )
            analyses_list.append(an_rec)

        # Multi-response desirability optimization
        a_dicts = []
        for a in sorted(analyses_list, key=lambda x: x.response_idx):
            anova_dict = a.anova if isinstance(a.anova, dict) else {}
            y_mean = anova_dict.get("y_mean", 0)
            a_dicts.append({
                "regression": a.regression,
                "descriptive": {"y_min": y_mean - 5, "y_max": y_mean + 5} if isinstance(a.anova, dict) else {}
            })

        resp_dicts = [{"name": r.name, "goal": r.goal, "target": r.target,
                       "weight": r.weight, "lower_limit": r.lower_limit,
                       "upper_limit": r.upper_limit} for r in responses_models]

        factor_dicts = [{"name": f.name, "low": f.low, "high": f.high, "unit": f.unit} for f in factors_models]
        opt_res = run_optimization(a_dicts, factor_dicts, resp_dicts)
        if "error" not in opt_res:
            for a in analyses_list:
                crud.upsert_analysis(db, project_id, a.response_idx, optimum=opt_res)
    except Exception as err:
        print(f"[PRESET ERROR] Statistical analysis seeding: {err}")

    full_proj = crud.get_project(db, project_id)
    return schemas.ProjectOut.model_validate(full_proj)


