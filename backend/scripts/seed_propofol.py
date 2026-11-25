import sys, os, json, math, random
from datetime import datetime

sys.path.insert(0, '/Users/aadityavarma/Desktop/QbD_DOE/backend')

from database import SessionLocal, crud, models, schemas
from services.analysis_service import run_analysis, run_optimization
from services.bayesian_service import fit_and_recommend, get_final_optimum, get_final_combined_optimum

db = SessionLocal()

PROJECT_ID = 7

# Clean up duplicate empty project 12 if present
p12 = crud.get_project(db, 12)
if p12:
    print("Removing empty duplicate project 12...")
    crud.delete_project(db, 12)

# Ensure project 7 exists
proj = crud.get_project(db, PROJECT_ID)
if not proj:
    proj = models.Project(id=PROJECT_ID, name="Propofol API Complete Synthesis & Process Optimization")
    db.add(proj)
    db.commit()
    db.refresh(proj)

print(f"Configuring Project {PROJECT_ID}...")

# 1. Project Metadata
proj.name = "Propofol API Complete Synthesis & Process Optimization"
proj.compound = "Propofol (2,6-Diisopropylphenol)"
proj.objective = (
    "Optimize the Friedel-Crafts alkylation and subsequent purification to maximize Propofol isolated yield (≥92.0%) "
    "and HPLC chemical purity (≥99.60%) while strictly minimizing regioisomer Impurity J (≤0.05%) and related substances "
    "in compliance with ICH Q8(R2)/Q9/Q10 Quality by Design guidelines."
)
proj.description = """Propofol (2,6-diisopropylphenol) is an essential intravenous anesthetic agent. The commercial chemical synthesis proceeds via the acid-catalyzed Friedel-Crafts alkylation of phenol with propylene (or isopropanol) over a tailored heterogeneous catalyst or Lewis acid system, followed by catalyst neutralization/quench, phase separation, and fractional vacuum distillation to separate the desired 2,6-isomer from ortho/para isomers (e.g. 2,4-diisopropylphenol) and over-alkylated impurities (2,4,6-triisopropylphenol).

--- Process Understanding ---
What is the product / API?:
Propofol (2,6-Diisopropylphenol), USP / Ph. Eur. Grade API.

Describe the process step:
Stage 1 (Reaction): Friedel-Crafts alkylation of phenol with propylene gas in a pressurized reactor at controlled temperature (70–95 °C) and pressure (3–6 bar) in the presence of acidic catalyst (1.5–4.5 wt%).
Stage 2 (Workup): Quenching with mild aqueous base, phase separation to remove acidic catalyst, and counter-current aqueous washing.
Stage 3 (Purification): Fractional vacuum distillation (110–125 °C at 10–15 mbar) with structured packing to isolate high-purity 2,6-diisopropylphenol from isomeric Impurity J (2,4-diisopropylphenol) and residual mono-alkylated/tri-alkylated species.

Current performance / baseline:
Unoptimized pilot runs showed 84.5% isolated yield, 98.7% HPLC purity, with 0.18% Impurity J (exceeding the 0.05% specification target) and 0.45% total impurities. Reaction hold times were prolonged, leading to secondary transalkylation side reactions.

Target performance:
Achieve isolated chemical yield ≥ 92.0%, HPLC chromatographic purity ≥ 99.60%, and critical regioisomer Impurity J ≤ 0.05% with a robust, scalable Design Space (Cpk ≥ 1.33).

Known constraints / fixed parameters:
- Phenol starting material purity ≥ 99.5% with water content < 0.05%.
- Reaction solvent: Neat / solvent-free catalytic reaction to enhance green chemistry atom economy.
- Distillation column: 25 theoretical stages with reflux ratio 4:1 to 6:1."""

proj.doe_type = "Face-Centered Central Composite (CCD)"
proj.bayes_iter = 3
proj.current_step = "report"
proj.unlocked_step = None
proj.step_statuses = {
    "cqa-risk": "completed",
    "define-factors": "completed",
    "recommend-doe": "completed",
    "generate-doe": "completed",
    "initial-optimization": "completed",
    "enough-data": "completed",
    "gp-model": "completed",
    "bayesian-opt": "completed",
    "new-experiment": "completed",
    "final-optimum": "completed",
    "report": "completed"
}

# 2. Stages Data
stages_data = [
    {
        "id": "stage-1",
        "order": 1,
        "name": "Stage 1: Friedel-Crafts Alkylation Reaction",
        "unitOpType": "Reaction",
        "description": "Catalytic alkylation of phenol with propylene under pressure to generate 2,6-diisopropylphenol crude mass.",
        "intermediateProduced": "Crude Propofol Alkylation Mass"
    },
    {
        "id": "stage-2",
        "order": 2,
        "name": "Stage 2: Catalyst Quench & Aqueous Extraction",
        "unitOpType": "Workup",
        "description": "Quenching of catalyst with aqueous sodium bicarbonate and phase separation to eliminate residual acidic species.",
        "intermediateProduced": "Washed Crude Propofol Organic Layer"
    },
    {
        "id": "stage-3",
        "order": 3,
        "name": "Stage 3: Fractional Vacuum Distillation & Isolation",
        "unitOpType": "Purification",
        "description": "High-vacuum fractional distillation across structured column packing to separate pure 2,6-diisopropylphenol from 2,4-isomer and heavy ends.",
        "intermediateProduced": "Pure Propofol API (Isolated)"
    }
]
proj.stages_data = stages_data

# 3. QTPP Specifications
qtpp_list = [
    {
        "id": f"p{PROJECT_ID}-qtpp-1",
        "attribute_name": "Assay (GC / HPLC Anhydrous)",
        "attribute_classification": "Assay",
        "criterion_type": "RANGE",
        "unit": "% w/w",
        "min_value": 99.0,
        "max_value": 101.0,
        "justification": "Pharmacopoeial (USP/Ph. Eur.) - Primary potency specification",
        "reference_source": "USP Monograph / Ph. Eur. 10.0"
    },
    {
        "id": f"p{PROJECT_ID}-qtpp-2",
        "attribute_name": "Critical Regioisomer Impurity J",
        "attribute_classification": "Impurity",
        "criterion_type": "MAX",
        "unit": "% w/w",
        "max_value": 0.05,
        "justification": "Patient-Critical positional isomer (2,4-diisopropylphenol); pharmacopoeial limit ≤ 0.05%",
        "reference_source": "Ph. Eur. Impurity J Specification"
    },
    {
        "id": f"p{PROJECT_ID}-qtpp-3",
        "attribute_name": "Propofol Related Compound C",
        "attribute_classification": "Impurity",
        "criterion_type": "MAX",
        "unit": "% w/w",
        "max_value": 0.10,
        "justification": "USP Related Compound C specification (over-alkylated phenol)",
        "reference_source": "USP Monograph"
    },
    {
        "id": f"p{PROJECT_ID}-qtpp-4",
        "attribute_name": "Propofol Related Compound D",
        "attribute_classification": "Impurity",
        "criterion_type": "MAX",
        "unit": "% w/w",
        "max_value": 0.05,
        "justification": "Potential oxidative degradation product (2,6-diisopropyl-1,4-benzoquinone)",
        "reference_source": "USP Monograph"
    },
    {
        "id": f"p{PROJECT_ID}-qtpp-5",
        "attribute_name": "Residual Phenol (KSM)",
        "attribute_classification": "Impurity",
        "criterion_type": "MAX",
        "unit": "% w/w",
        "max_value": 0.05,
        "justification": "Toxicological threshold for unreacted starting material phenol",
        "reference_source": "Internal Specification / ICH Q3A"
    },
    {
        "id": f"p{PROJECT_ID}-qtpp-6",
        "attribute_name": "Single Maximum Unknown Impurity",
        "attribute_classification": "Impurity",
        "criterion_type": "MAX",
        "unit": "% w/w",
        "max_value": 0.05,
        "justification": "ICH Q3A qualification threshold for parenteral drug substances",
        "reference_source": "ICH Q3A(R2)"
    },
    {
        "id": f"p{PROJECT_ID}-qtpp-7",
        "attribute_name": "Total Impurities",
        "attribute_classification": "Impurity",
        "criterion_type": "MAX",
        "unit": "% w/w",
        "max_value": 0.30,
        "justification": "Cumulative impurities pharmacopoeial monograph specification",
        "reference_source": "USP / Ph. Eur."
    },
    {
        "id": f"p{PROJECT_ID}-qtpp-8",
        "attribute_name": "Water Content (Karl Fischer)",
        "attribute_classification": "Physical",
        "criterion_type": "MAX",
        "unit": "% w/w",
        "max_value": 0.10,
        "justification": "Prevents hydrolysis and emulsion breakdown in drug product formulation",
        "reference_source": "USP <921>"
    },
    {
        "id": f"p{PROJECT_ID}-qtpp-9",
        "attribute_name": "Color & Optical Clarity (APHA)",
        "attribute_classification": "Appearance",
        "criterion_type": "MAX",
        "unit": "APHA",
        "max_value": 15.0,
        "justification": "Visual clarity for injectable emulsion drug product",
        "reference_source": "Ph. Eur. Method 2.2.2"
    },
    {
        "id": f"p{PROJECT_ID}-qtpp-10",
        "attribute_name": "Refractive Index (n20/D)",
        "attribute_classification": "Physical",
        "criterion_type": "RANGE",
        "unit": "",
        "min_value": 1.512,
        "max_value": 1.515,
        "justification": "Physical identity verification per USP/Ph. Eur.",
        "reference_source": "USP <831>"
    },
    {
        "id": f"p{PROJECT_ID}-qtpp-11",
        "attribute_name": "Chemical Reaction Yield",
        "attribute_classification": "Yield",
        "criterion_type": "MIN",
        "unit": "%",
        "min_value": 90.0,
        "justification": "Commercial process feasibility and sustainability target",
        "reference_source": "Internal Target"
    }
]

# Wipe old QTPP & CQAs & links
db.execute(models.cqa_qtpp_link.delete())
db.query(models.CQAAttribute).filter(models.CQAAttribute.project_id == PROJECT_ID).delete()
db.query(models.QTPPSpecification).filter(models.QTPPSpecification.project_id == PROJECT_ID).delete()
db.commit()

qtpp_data_json = []
for idx, q in enumerate(qtpp_list):
    spec = models.QTPPSpecification(
        id=q["id"],
        project_id=PROJECT_ID,
        attribute_name=q["attribute_name"],
        attribute_classification=q["attribute_classification"],
        criterion_type=q["criterion_type"],
        unit=q["unit"],
        min_value=q.get("min_value"),
        max_value=q.get("max_value"),
        justification=q["justification"],
        reference_source=q["reference_source"],
        sort_order=idx
    )
    db.add(spec)
    qtpp_data_json.append({
        "id": q["id"],
        "attribute": q["attribute_name"],
        "criterion": spec.format_target_display(),
        "justification": q["justification"],
        "type": q["attribute_classification"]
    })
db.commit()
proj.qtpp_data = qtpp_data_json

# 4. CQA Attributes
cqa_list = [
    {
        "id": f"p{PROJECT_ID}-cqa-1",
        "cqa_code": "CQA-001",
        "attribute_name": "Assay (GC / HPLC Anhydrous)",
        "description": "Potency and exact concentration of 2,6-diisopropylphenol in API.",
        "scientific_justification": "Directly governs patient clinical dosage, depth of anesthesia, and therapeutic efficacy.",
        "severity_score": 5,
        "classification": "CQA",
        "evidence_basis": ["Clinical Efficacy", "Pharmacopoeial Monograph", "Dosage Accuracy"],
        "decision_justification": "Critical quality attribute per ICH Q8(R2); high severity patient impact.",
        "linked_qtpps": [f"p{PROJECT_ID}-qtpp-1"]
    },
    {
        "id": f"p{PROJECT_ID}-cqa-2",
        "cqa_code": "CQA-002",
        "attribute_name": "Critical Regioisomer Impurity J",
        "attribute_classification": "Impurity",
        "description": "2,4-diisopropylphenol positional isomer formed during ortho/para alkylation competition.",
        "scientific_justification": "Positional isomer with distinct pharmacodynamic and toxicological profile; strictly restricted by Ph. Eur. ≤ 0.05%.",
        "severity_score": 5,
        "classification": "CQA",
        "evidence_basis": ["Pharmacopoeial Limit", "Toxicology Profile", "Co-elution Risk"],
        "decision_justification": "High severity due to biological divergence; must be suppressed in Stage 1 and separated in Stage 3.",
        "linked_qtpps": [f"p{PROJECT_ID}-qtpp-2"]
    },
    {
        "id": f"p{PROJECT_ID}-cqa-3",
        "cqa_code": "CQA-003",
        "attribute_name": "Chemical Isolated Yield",
        "description": "Mass of isolated pharmaceutical-grade Propofol relative to stoichiometric theory.",
        "scientific_justification": "Determines batch throughput, manufacturing cost of goods, and commercial process sustainability.",
        "severity_score": 4,
        "classification": "CQA",
        "evidence_basis": ["Process Economics", "Process Robustness", "Capacity Constraint"],
        "decision_justification": "Critical commercial quality parameter for scale-up.",
        "linked_qtpps": [f"p{PROJECT_ID}-qtpp-11"]
    },
    {
        "id": f"p{PROJECT_ID}-cqa-4",
        "cqa_code": "CQA-004",
        "attribute_name": "Total Impurities",
        "description": "Sum of all related substances including mono-isopropyl, 2,4-isomer, and 2,4,6-triisopropylphenol.",
        "scientific_justification": "ICH Q3A requirement to control cumulative impurity burden for intravenous administration.",
        "severity_score": 4,
        "classification": "CQA",
        "evidence_basis": ["ICH Q3A Guidelines", "Parenteral Safety", "USP Monograph"],
        "decision_justification": "Cumulative toxicology and stability impact.",
        "linked_qtpps": [f"p{PROJECT_ID}-qtpp-7", f"p{PROJECT_ID}-qtpp-3", f"p{PROJECT_ID}-qtpp-6"]
    },
    {
        "id": f"p{PROJECT_ID}-cqa-5",
        "cqa_code": "CQA-005",
        "attribute_name": "Residual Phenol (KSM)",
        "description": "Unreacted starting material raw phenol remaining in product.",
        "scientific_justification": "Phenol is caustic and cytotoxic; strict limit ≤ 0.05% w/w prevents cellular toxicity.",
        "severity_score": 4,
        "classification": "CQA",
        "evidence_basis": ["Toxicology Assessment", "ICH Q3C", "Raw Material Quality"],
        "decision_justification": "Safety threshold control.",
        "linked_qtpps": [f"p{PROJECT_ID}-qtpp-5"]
    },
    {
        "id": f"p{PROJECT_ID}-cqa-6",
        "cqa_code": "CQA-006",
        "attribute_name": "Color & Optical Appearance (APHA)",
        "description": "Absence of colored oxidative quinone degradation by-products.",
        "scientific_justification": "Injectable lipid emulsion appearance and optical stability indicator.",
        "severity_score": 3,
        "classification": "POTENTIAL_CQA",
        "evidence_basis": ["Visual Inspection", "Lipid Emulsion Stability"],
        "decision_justification": "Customer acceptance and drug product compatibility.",
        "linked_qtpps": [f"p{PROJECT_ID}-qtpp-9"]
    }
]

# Wipe old CQAs & links before inserting
db.execute(models.cqa_qtpp_link.delete())
db.query(models.CQAAttribute).filter(models.CQAAttribute.project_id == PROJECT_ID).delete()
db.commit()

cqas_data_json = []
for idx, c in enumerate(cqa_list):
    cqa_obj = models.CQAAttribute(
        id=c["id"],
        cqa_code=c["cqa_code"],
        project_id=PROJECT_ID,
        attribute_name=c["attribute_name"],
        description=c["description"],
        scientific_justification=c["scientific_justification"],
        severity_score=c["severity_score"],
        evidence_basis=c["evidence_basis"],
        classification=c["classification"],
        decision_justification=c["decision_justification"],
        sort_order=idx
    )
    db.add(cqa_obj)
    db.flush()

    # Link to QTPPs
    for qid in c["linked_qtpps"]:
        q_spec = db.query(models.QTPPSpecification).filter(models.QTPPSpecification.id == qid).first()
        if q_spec:
            cqa_obj.linked_qtpp_specs.append(q_spec)

    cqas_data_json.append({
        "id": c["id"],
        "code": c["cqa_code"],
        "name": c["attribute_name"],
        "category": "Direct CQAs",
        "description": c["description"],
        "severity": c["severity_score"],
        "criticality": "Critical" if c["severity_score"] >= 4 else "Moderate",
        "classification": c["classification"],
        "justification": c["scientific_justification"],
        "linkedQtppIds": c["linked_qtpps"]
    })

db.commit()
proj.cqas_data = cqas_data_json

# 5. Parameter Risk Matrix (FMEA / RPN)
risk_assessment_data = {
    "stage-1": {
        "parameters": [
            {
                "id": "p-stage-1-1",
                "name": "Reaction Temperature (°C)",
                "type": "CPP-candidate",
                "linkedCqaIds": [f"p{PROJECT_ID}-cqa-1", f"p{PROJECT_ID}-cqa-2", f"p{PROJECT_ID}-cqa-3"],
                "severity": 5,
                "occurrence": 4,
                "detectability": 2,
                "rpn": 40,
                "criticalFlag": True,
                "rationale": "High temperature accelerates side alkylation yielding 2,4-isomer (Impurity J) and over-alkylated trimers; low temperature retards reaction rate and leaves unreacted phenol.",
                "status": "confirmed"
            },
            {
                "id": "p-stage-1-2",
                "name": "Propylene / Phenol Molar Ratio (eq)",
                "type": "CPP-candidate",
                "linkedCqaIds": [f"p{PROJECT_ID}-cqa-1", f"p{PROJECT_ID}-cqa-3", f"p{PROJECT_ID}-cqa-4"],
                "severity": 5,
                "occurrence": 3,
                "detectability": 2,
                "rpn": 30,
                "criticalFlag": True,
                "rationale": "High propylene ratio promotes poly-alkylation to 2,4,6-triisopropylphenol; low ratio causes incomplete conversion and poor yield.",
                "status": "confirmed"
            },
            {
                "id": "p-stage-1-3",
                "name": "Catalyst Loading (wt %)",
                "type": "CPP-candidate",
                "linkedCqaIds": [f"p{PROJECT_ID}-cqa-1", f"p{PROJECT_ID}-cqa-2", f"p{PROJECT_ID}-cqa-4"],
                "severity": 4,
                "occurrence": 3,
                "detectability": 2,
                "rpn": 24,
                "criticalFlag": True,
                "rationale": "Acidic catalyst concentration governs kinetic selectivity between ortho and para positions.",
                "status": "confirmed"
            },
            {
                "id": "p-stage-1-4",
                "name": "Agitation Speed (rpm)",
                "type": "CPP-candidate",
                "linkedCqaIds": [f"p{PROJECT_ID}-cqa-1", f"p{PROJECT_ID}-cqa-3"],
                "severity": 3,
                "occurrence": 3,
                "detectability": 2,
                "rpn": 18,
                "criticalFlag": True,
                "rationale": "Gas-liquid-solid mass transfer rate of propylene gas into the liquid reaction medium.",
                "status": "confirmed"
            }
        ]
    },
    "stage-2": {
        "parameters": [
            {
                "id": "p-stage-2-1",
                "name": "Quench Neutralization pH",
                "type": "CPP-candidate",
                "linkedCqaIds": [f"p{PROJECT_ID}-cqa-1", f"p{PROJECT_ID}-cqa-6"],
                "severity": 4,
                "occurrence": 2,
                "detectability": 2,
                "rpn": 16,
                "criticalFlag": True,
                "rationale": "Incomplete neutralization leaves trace acid that causes color darkening and degradation during distillation.",
                "status": "confirmed"
            },
            {
                "id": "p-stage-2-2",
                "name": "Phase Separation Settling Time (min)",
                "type": "CMA-candidate",
                "linkedCqaIds": [f"p{PROJECT_ID}-cqa-4"],
                "severity": 3,
                "occurrence": 2,
                "detectability": 2,
                "rpn": 12,
                "criticalFlag": False,
                "rationale": "Ensures sharp boundary separation between aqueous salt layer and organic crude product.",
                "status": "confirmed"
            }
        ]
    },
    "stage-3": {
        "parameters": [
            {
                "id": "p-stage-3-1",
                "name": "Distillation Pot Temperature (°C)",
                "type": "CPP-candidate",
                "linkedCqaIds": [f"p{PROJECT_ID}-cqa-1", f"p{PROJECT_ID}-cqa-2"],
                "severity": 4,
                "occurrence": 3,
                "detectability": 2,
                "rpn": 24,
                "criticalFlag": True,
                "rationale": "Pot temperature governs boil-up rate and vapor-liquid equilibrium fractionation.",
                "status": "confirmed"
            },
            {
                "id": "p-stage-3-2",
                "name": "Column Operating Vacuum (mbar)",
                "type": "CPP-candidate",
                "linkedCqaIds": [f"p{PROJECT_ID}-cqa-2", f"p{PROJECT_ID}-cqa-5"],
                "severity": 4,
                "occurrence": 3,
                "detectability": 2,
                "rpn": 24,
                "criticalFlag": True,
                "rationale": "Operating vacuum prevents thermal decomposition of Propofol in the reboiler.",
                "status": "confirmed"
            },
            {
                "id": "p-stage-3-3",
                "name": "Reflux Ratio",
                "type": "CPP-candidate",
                "linkedCqaIds": [f"p{PROJECT_ID}-cqa-1", f"p{PROJECT_ID}-cqa-2"],
                "severity": 4,
                "occurrence": 2,
                "detectability": 2,
                "rpn": 16,
                "criticalFlag": True,
                "rationale": "Reflux ratio controls stage separation efficiency between 2,6 and 2,4 isomers.",
                "status": "confirmed"
            }
        ]
    }
}
proj.risk_assessment_data = risk_assessment_data

# 6. Factors Table
factors_data = [
    schemas.FactorCreate(
        name="Reaction Temperature (°C)",
        symbol="T",
        unit="°C",
        low=70.0,
        high=95.0,
        baseline=82.5,
        factor_order=0,
        stage_id="stage-1"
    ),
    schemas.FactorCreate(
        name="Propylene / Phenol Molar Ratio (eq)",
        symbol="R",
        unit="eq",
        low=2.0,
        high=2.8,
        baseline=2.4,
        factor_order=1,
        stage_id="stage-1"
    ),
    schemas.FactorCreate(
        name="Catalyst Loading (wt %)",
        symbol="C",
        unit="wt %",
        low=1.5,
        high=4.5,
        baseline=3.0,
        factor_order=2,
        stage_id="stage-1"
    ),
    schemas.FactorCreate(
        name="Agitation Speed (rpm)",
        symbol="RPM",
        unit="rpm",
        low=300.0,
        high=600.0,
        baseline=450.0,
        factor_order=3,
        stage_id="stage-1"
    )
]
crud.replace_factors(db, PROJECT_ID, factors_data)
factors = crud.get_factors(db, PROJECT_ID)

# 7. Responses Table
responses_data = [
    schemas.ResponseCreate(
        name="API Isolated Yield",
        unit="%",
        goal="maximize",
        target=92.0,
        lower_limit=85.0,
        upper_limit=100.0,
        weight=1.0,
        resp_order=0,
        stage_id="stage-1"
    ),
    schemas.ResponseCreate(
        name="HPLC Chemical Purity",
        unit="%",
        goal="maximize",
        target=99.60,
        lower_limit=99.00,
        upper_limit=100.00,
        weight=1.5,
        resp_order=1,
        stage_id="stage-1"
    ),
    schemas.ResponseCreate(
        name="Critical Regioisomer Impurity J",
        unit="%",
        goal="minimize",
        target=0.05,
        lower_limit=0.00,
        upper_limit=0.15,
        weight=1.2,
        resp_order=2,
        stage_id="stage-1"
    )
]
crud.replace_responses(db, PROJECT_ID, responses_data)
responses = crud.get_responses(db, PROJECT_ID)

# 8. Experiments (Face-Centered CCD: 16 Factorial + 8 Axial + 6 Center = 30 runs + 3 Bayesian = 33 runs)
random.seed(42)

# Generate 16 factorial combinations:
factorial_coded = []
for i in range(16):
    coded = [
        -1.0 if (i & 1) == 0 else 1.0,
        -1.0 if (i & 2) == 0 else 1.0,
        -1.0 if (i & 4) == 0 else 1.0,
        -1.0 if (i & 8) == 0 else 1.0
    ]
    factorial_coded.append(coded)

# Generate 8 axial points (Face-centered alpha = 1.0):
axial_coded = []
for dim in range(4):
    for s in [-1.0, 1.0]:
        row = [0.0, 0.0, 0.0, 0.0]
        row[dim] = s
        axial_coded.append(row)

# Generate 6 center points:
center_coded = [[0.0, 0.0, 0.0, 0.0] for _ in range(6)]

all_screening_coded = []
for c in factorial_coded:
    all_screening_coded.append((c, "Factorial"))
for c in axial_coded:
    all_screening_coded.append((c, "Axial"))
for c in center_coded:
    all_screening_coded.append((c, "Center"))

def coded_to_actual(coded):
    actuals = []
    for val, f in zip(coded, factors):
        act = f.low + (val + 1.0) / 2.0 * (f.high - f.low)
        actuals.append(round(act, 2))
    return actuals

def true_chemistry_response(x1, x2, x3, x4, noise=True):
    # Optimum is located near x1=0.15 (84.4 °C), x2=0.12 (2.45 eq), x3=0.10 (3.15 wt%), x4=0.20 (480 rpm)
    # Yield (%)
    y1 = 93.65 - 3.4 * (x1 - 0.15)**2 - 2.9 * (x2 - 0.12)**2 - 2.5 * (x3 - 0.10)**2 - 1.4 * (x4 - 0.20)**2 + 0.85 * x1 * x2 - 0.65 * x1 * x3 + 0.45 * x2 * x3
    # Purity (%)
    y2 = 99.74 - 0.28 * (x1 - 0.12)**2 - 0.22 * (x2 - 0.08)**2 - 0.25 * (x3 - 0.10)**2 - 0.08 * (x4 - 0.18)**2 - 0.14 * x1 * x3 - 0.08 * x1 * x2
    # Impurity J (%) - minimize
    y3 = 0.038 + 0.046 * x1 + 0.028 * x3 + 0.024 * (x1**2) + 0.018 * (x3**2) + 0.014 * x1 * x3 - 0.008 * x2

    if noise:
        y1 += random.gauss(0, 0.18)
        y2 += random.gauss(0, 0.025)
        y3 += random.gauss(0, 0.004)

    y1 = round(max(82.0, min(95.0, y1)), 2)
    y2 = round(max(98.8, min(99.85, y2)), 2)
    y3 = round(max(0.015, min(0.16, y3)), 3)
    return [y1, y2, y3]

# Wipe old experiments
db.query(models.Experiment).filter(models.Experiment.project_id == PROJECT_ID).delete()
db.commit()

exp_records = []
run_no = 1

for coded, rtype in all_screening_coded:
    actual = coded_to_actual(coded)
    res = true_chemistry_response(*coded, noise=True)
    exp = models.Experiment(
        project_id=PROJECT_ID,
        stage_id="stage-1",
        run_number=run_no,
        run_type=rtype,
        coded_values=coded,
        actual_values=actual,
        result_values=res,
        iteration=0,
        is_completed=True,
        notes=f"Screening Run {run_no} ({rtype}) completed with HPLC assay validation."
    )
    db.add(exp)
    exp_records.append(exp)
    run_no += 1

db.commit()

# 9. Statistical Analysis & ANOVA
exp_dicts = [
    {
        "coded_values": e.coded_values,
        "actual_values": e.actual_values,
        "result_values": e.result_values,
        "run_type": e.run_type
    }
    for e in exp_records
]

db.query(models.Analysis).filter(models.Analysis.project_id == PROJECT_ID).delete()
db.commit()

analysis_results = []
for resp_idx in range(len(responses)):
    resp_meta = {
        "name": responses[resp_idx].name,
        "goal": responses[resp_idx].goal,
        "unit": responses[resp_idx].unit
    }
    ana_res = run_analysis(exp_dicts, resp_idx, resp_meta, factors)
    crud.upsert_analysis(
        db,
        PROJECT_ID,
        resp_idx,
        effects=ana_res.get("anova", {}).get("rows", []) if ana_res.get("anova") else [],
        anova=ana_res.get("anova") or {},
        regression=ana_res.get("rsm") or {},
        diagnostics=ana_res.get("diagnostics") or {}
    )
    analysis_results.append(ana_res)

# Run initial multi-response optimization sweet spot
analyses_orm = crud.get_analyses(db, PROJECT_ID)
optimum_calc = run_optimization(analyses_orm, factors, responses)
if analyses_orm:
    analyses_orm[0].optimum = optimum_calc
    db.commit()

print(f"Initial optimization computed composite desirability: {optimum_calc.get('composite_desirability')}")

# 10. Bayesian Optimization Iterations
db.query(models.GPIteration).filter(models.GPIteration.project_id == PROJECT_ID).delete()
db.commit()

bayesian_points = [
    # Iteration 1:
    {
        "iter": 1,
        "coded": [0.12, 0.10, 0.08, 0.15],
        "actual": [83.9, 2.44, 3.12, 472.5],
        "res": [93.85, 99.74, 0.038],
        "ei": 0.048,
        "notes": "Bayesian Iteration 1 - Expected Improvement exploitation in central high-yield domain."
    },
    # Iteration 2:
    {
        "iter": 2,
        "coded": [0.15, 0.12, 0.10, 0.18],
        "actual": [84.4, 2.45, 3.15, 477.0],
        "res": [94.15, 99.76, 0.035],
        "ei": 0.019,
        "notes": "Bayesian Iteration 2 - Refinement confirming sharp peak in composite desirability."
    },
    # Iteration 3:
    {
        "iter": 3,
        "coded": [0.14, 0.12, 0.09, 0.20],
        "actual": [84.25, 2.45, 3.14, 480.0],
        "res": [94.30, 99.78, 0.032],
        "ei": 0.006,
        "notes": "Bayesian Iteration 3 - Verification trial achieving final maximum purity and yield."
    }
]

for bp in bayesian_points:
    # Add experiment run
    exp = models.Experiment(
        project_id=PROJECT_ID,
        stage_id="stage-1",
        run_number=run_no,
        run_type="Bayesian",
        coded_values=bp["coded"],
        actual_values=bp["actual"],
        result_values=bp["res"],
        iteration=bp["iter"],
        is_completed=True,
        notes=bp["notes"]
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    exp_records.append(exp)

    # Add GP iteration
    gp_iter = models.GPIteration(
        project_id=PROJECT_ID,
        iteration=bp["iter"],
        gp_params={"kernel": "Matern 5/2", "length_scale": [0.85, 0.92, 0.78, 1.15], "sigma_f": 1.25, "sigma_n": 0.05},
        recommended={
            "actual_values": bp["actual"],
            "coded_values": bp["coded"],
            "predicted_mean": bp["res"][0],
            "predicted_std": 0.12,
            "expected_improvement": bp["ei"],
            "confidence_95": [round(bp["res"][0] - 0.24, 2), round(bp["res"][0] + 0.24, 2)]
        },
        ei_score=bp["ei"],
        new_result=bp["res"]
    )
    db.add(gp_iter)
    db.commit()
    run_no += 1

# Re-run final combined optimum with all runs included
final_combined = get_final_combined_optimum(exp_records, responses, factors)
print("Final Combined Optimum calculated successfully.")

# 11. Audit Logs & Locked Campaigns
audit_logs = [
    {"id": "log-1", "user": "R&D Head", "timestamp": "2026-11-20T09:00:00Z", "action": "PROJECT_INIT", "details": "Initiated Propofol Complete Synthesis QbD Campaign"},
    {"id": "log-2", "user": "R&D Head", "timestamp": "2026-11-20T10:15:00Z", "action": "QTPP_DEFINE", "details": "Defined 11 QTPP quality attributes based on USP/Ph. Eur. monographs"},
    {"id": "log-3", "user": "R&D Head", "timestamp": "2026-11-20T14:30:00Z", "action": "CQA_IDENTIFY", "details": "Identified 6 CQAs with patient severity scoring"},
    {"id": "log-4", "user": "Process Chemist", "timestamp": "2026-11-21T09:45:00Z", "action": "RISK_ASSESSMENT", "details": "Completed reverse risk walk and FMEA parameter scoring (RPN >= 18 designated as CPPs)"},
    {"id": "log-5", "user": "Statistician", "timestamp": "2026-11-21T11:00:00Z", "action": "DOE_DESIGN", "details": "Generated 30-run Face-Centered Central Composite Design (CCD)"},
    {"id": "log-6", "user": "Analytical Chemist", "timestamp": "2026-11-22T16:30:00Z", "action": "LAB_EXECUTION", "details": "Executed 30 screening trials and uploaded HPLC analytical results"},
    {"id": "log-7", "user": "Statistician", "timestamp": "2026-11-23T11:20:00Z", "action": "INITIAL_OPTIMUM", "details": "Constructed ANOVA response surfaces; Composite Desirability reached 96.5%"},
    {"id": "log-8", "user": "Data Scientist", "timestamp": "2026-11-24T10:00:00Z", "action": "BAYESIAN_OPTIMIZATION", "details": "Executed 3 sequential active learning Bayesian iterations with Expected Improvement"},
    {"id": "log-9", "user": "R&D Head", "timestamp": "2026-11-25T08:00:00Z", "action": "DESIGN_SPACE_ESTABLISHED", "details": "Locked Proven Acceptable Ranges (PAR) and Normal Operating Ranges (NOR)"},
    {"id": "log-10", "user": "Quality Assurance", "timestamp": "2026-11-25T08:30:00Z", "action": "REPORT_GENERATED", "details": "Generated audit-ready regulatory summary dossier compliant with ICH Q8(R2)"}
]
proj.audit_logs = audit_logs

locked_campaigns = ["stage-1"]
proj.locked_campaigns = locked_campaigns

db.commit()
print("Project 7 successfully fully seeded and completed!")
