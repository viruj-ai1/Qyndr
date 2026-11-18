import { STEP_BRIEFINGS } from '../config/stepBriefings';

export interface WorkflowStepItem {
  number: number;
  id: string;
  name: string;
  purpose?: string;
  whatHappens: string;
  youDo?: string[];
  systemDoes?: string[];
  output: string;
}

export interface WorkflowPhase {
  id: string;
  title: string;
  steps: WorkflowStepItem[];
}

export interface PlatformWorkflowIntroData {
  title: string;
  introParagraph: string;
  howItWorks: Array<{
    phaseId: string;
    phaseTag: string;
    title: string;
    description: string;
  }>;
  whatYouGet: string[];
  bestFor: string;
}

export const PLATFORM_WORKFLOW_INTRO_DATA: PlatformWorkflowIntroData = {
  title: "About the DoE and QbD Platform",
  introParagraph:
    "The DoE and QbD Platform is an end-to-end workspace for pharmaceutical process development. It guides chemists through the complete Quality by Design (ICH Q8/Q9/Q14) and Design of Experiments (DoE) lifecycle, from defining the quality target of the drug substance to filing a validated design space. Every decision is linked, so each parameter range, experiment and conclusion can be traced back to the patient-quality requirement it protects.",
  howItWorks: [
    {
      phaseId: "phase-0",
      phaseTag: "Phase 0",
      title: "Define & Assess",
      description: "Set the quality targets (QTPP, CQAs), map the synthesis route and rank process risks with FMEA to find the critical parameters."
    },
    {
      phaseId: "phase-1",
      phaseTag: "Phase 1",
      title: "Design & Run",
      description: "Set factor ranges and responses, get a recommended statistical design, and run the lab trials with a randomized run sheet."
    },
    {
      phaseId: "phase-2",
      phaseTag: "Phase 2",
      title: "Optimize & Refine",
      description: "Model the results, find the optimal setpoints, and use targeted follow-up experiments where uncertainty remains."
    },
    {
      phaseId: "phase-3",
      phaseTag: "Phase 3",
      title: "Lock & File",
      description: "Fix the Proven Acceptable Ranges (PAR) and Normal Operating Ranges (NOR) and generate the audit-ready report."
    }
  ],
  whatYouGet: [
    "Validated CQA list",
    "Prioritized CPP risk matrix",
    "Statistically designed experiments",
    "Optimal reaction conditions",
    "PAR/NOR design space",
    "Audit-ready PDF/Excel report"
  ],
  bestFor:
    "process chemists, formulation and CMC scientists, and QA/regulatory teams preparing for technology transfer and regulatory submission."
};

// Backward compatibility if imported elsewhere
export const PLATFORM_WORKFLOW_INTRO = PLATFORM_WORKFLOW_INTRO_DATA.introParagraph;

export const PLATFORM_PHASES: WorkflowPhase[] = [
  {
    id: 'phase-0',
    title: 'Phase 0 — QbD Risk Assessment & Process Definition',
    steps: [
      {
        number: 1,
        id: 'create-project',
        name: 'Create Project',
        purpose: STEP_BRIEFINGS['create-project']?.purpose || 'Set up the project foundation with API/compound details and overarching development goals.',
        whatHappens: 'Chemist enters API, salt form and development objective to establish a persistent development repository.',
        youDo: STEP_BRIEFINGS['create-project']?.youDo,
        systemDoes: STEP_BRIEFINGS['create-project']?.systemDoes,
        output: STEP_BRIEFINGS['create-project']?.output || 'A centralized project record that all later stages and DOE matrices attach to.'
      },
      {
        number: 2,
        id: 'qtpp',
        name: 'QTPP Definition',
        purpose: STEP_BRIEFINGS['qtpp']?.purpose || 'Define the Quality Target Product Profile stating target therapeutic & manufacturing requirements.',
        whatHappens: 'Define patient safety, route of administration, clinical specifications, stability, and release criteria.',
        youDo: STEP_BRIEFINGS['qtpp']?.youDo,
        systemDoes: STEP_BRIEFINGS['qtpp']?.systemDoes,
        output: STEP_BRIEFINGS['qtpp']?.output || 'QTPP specification table serving as the baseline to derive Critical Quality Attributes.'
      },
      {
        number: 3,
        id: 'cqa',
        name: 'CQA Derivation',
        purpose: STEP_BRIEFINGS['cqa']?.purpose || 'Identify and prioritize Critical Quality Attributes that directly impact patient safety and efficacy.',
        whatHappens: 'Map QTPP goals to measurable product attributes and score severity impact and uncertainty to prioritize CQAs.',
        youDo: STEP_BRIEFINGS['cqa']?.youDo,
        systemDoes: STEP_BRIEFINGS['cqa']?.systemDoes,
        output: STEP_BRIEFINGS['cqa']?.output || 'Prioritized CQA registry with validated specification limits.'
      },
      {
        number: 4,
        id: 'route-mapping',
        name: 'Route Mapping',
        purpose: STEP_BRIEFINGS['route-mapping']?.purpose || 'Map synthetic chemistry routes, unit operations, input materials, and process conditions.',
        whatHappens: 'Structure the synthesis route into unit operations, specifying raw materials, reagents, solvents, and intermediates.',
        youDo: STEP_BRIEFINGS['route-mapping']?.youDo,
        systemDoes: STEP_BRIEFINGS['route-mapping']?.systemDoes,
        output: STEP_BRIEFINGS['route-mapping']?.output || 'Detailed process map linking chemistry unit operations to potential risk factors.'
      },
      {
        number: 5,
        id: 'risk-assessment',
        name: 'Risk Assessment (FMEA Parameter Matrix)',
        purpose: STEP_BRIEFINGS['risk-assessment']?.purpose || 'Perform reverse FMEA risk analysis to evaluate which parameters could potentially deviate CQAs.',
        whatHappens: 'Evaluate parameters with FMEA (Severity × Occurrence × Detectability) against the RPN threshold.',
        youDo: STEP_BRIEFINGS['risk-assessment']?.youDo,
        systemDoes: STEP_BRIEFINGS['risk-assessment']?.systemDoes,
        output: STEP_BRIEFINGS['risk-assessment']?.output || 'Ranked FMEA risk matrix isolating high-risk parameters requiring empirical DOE study.'
      },
      {
        number: 6,
        id: 'stage-campaign-matrix',
        name: 'Stage Campaign Matrix',
        purpose: STEP_BRIEFINGS['stage-campaign-matrix']?.purpose || 'Select and activate the specific manufacturing unit operation to optimize in this DOE campaign.',
        whatHappens: 'Review risk distributions across all stages and select the target unit operation to carry into experimental design.',
        youDo: STEP_BRIEFINGS['stage-campaign-matrix']?.youDo,
        systemDoes: STEP_BRIEFINGS['stage-campaign-matrix']?.systemDoes,
        output: STEP_BRIEFINGS['stage-campaign-matrix']?.output || 'Active campaign context configured for experimental study.'
      }
    ]
  },
  {
    id: 'phase-1',
    title: 'Phase 1 — Design of Experiments (DoE) Execution',
    steps: [
      {
        number: 7,
        id: 'define-factors',
        name: 'Define Factors & Responses',
        purpose: STEP_BRIEFINGS['define-factors']?.purpose || 'Establish operational ranges for process factors and quantitative metrics for response variables.',
        whatHappens: 'Set factor ranges, engineering units, baseline levels, and define CQA responses with optimization goals.',
        youDo: STEP_BRIEFINGS['define-factors']?.youDo,
        systemDoes: STEP_BRIEFINGS['define-factors']?.systemDoes,
        output: STEP_BRIEFINGS['define-factors']?.output || 'Rigorous factor and response definition governing experimental design construction.'
      },
      {
        number: 8,
        id: 'recommend-doe',
        name: 'Recommend DoE',
        purpose: STEP_BRIEFINGS['recommend-doe']?.purpose || 'Evaluate factor space geometry and recommend the optimal experimental design strategy.',
        whatHappens: 'System recommends a statistical design (DSD, CCD, Box-Behnken, Fractional Factorial) based on factors, interactions and budget.',
        youDo: STEP_BRIEFINGS['recommend-doe']?.youDo,
        systemDoes: STEP_BRIEFINGS['recommend-doe']?.systemDoes,
        output: STEP_BRIEFINGS['recommend-doe']?.output || 'Selected DOE design architecture with target run counts and center points.'
      },
      {
        number: 9,
        id: 'generate-doe',
        name: 'DoE Matrix & Lab Results Entry',
        purpose: STEP_BRIEFINGS['generate-doe']?.purpose || 'Generate randomized experimental run matrix, execute laboratory trials, and record response data.',
        whatHappens: 'Generate the randomized run matrix, export batch sheets, execute bench trials, and record measured response data.',
        youDo: STEP_BRIEFINGS['generate-doe']?.youDo,
        systemDoes: STEP_BRIEFINGS['generate-doe']?.systemDoes,
        output: STEP_BRIEFINGS['generate-doe']?.output || 'Completed empirical dataset ready for statistical and machine learning analysis.'
      }
    ]
  },
  {
    id: 'phase-2',
    title: 'Phase 2 — Optimization & Targeted Refinement',
    steps: [
      {
        number: 10,
        id: 'initial-optimization',
        name: 'Initial Optimum',
        purpose: STEP_BRIEFINGS['initial-optimization']?.purpose || 'Fit response surface regression models to uncover factor effects and identify initial sweet spot.',
        whatHappens: 'Fit response surface models, evaluate factor effects and interactions, and calculate initial composite desirability.',
        youDo: STEP_BRIEFINGS['initial-optimization']?.youDo,
        systemDoes: STEP_BRIEFINGS['initial-optimization']?.systemDoes,
        output: STEP_BRIEFINGS['initial-optimization']?.output || 'First-iteration optimal parameter coordinates and initial empirical model.'
      },
      {
        number: 11,
        id: 'enough-data',
        name: 'Enough Data? (Chemist Decision Gate)',
        purpose: STEP_BRIEFINGS['enough-data']?.purpose || 'Assess model predictive certainty and determine whether to proceed directly or run Bayesian iterations.',
        whatHappens: 'Review model quality and confidence: proceed directly to lock design space or trigger targeted follow-up experiments.',
        youDo: STEP_BRIEFINGS['enough-data']?.youDo,
        systemDoes: STEP_BRIEFINGS['enough-data']?.systemDoes,
        output: STEP_BRIEFINGS['enough-data']?.output || 'Workflow branch decision: finalize optimum or proceed to active GP learning.'
      },
      {
        number: 12,
        id: 'gp-model',
        name: 'GP Model',
        purpose: STEP_BRIEFINGS['gp-model']?.purpose || 'Fit non-parametric Gaussian Process regression surrogate to model complex response behaviors.',
        whatHappens: 'Inspect 1D factor slice curves with 95% confidence bands to evaluate process sensitivities and response curvature.',
        youDo: STEP_BRIEFINGS['gp-model']?.youDo,
        systemDoes: STEP_BRIEFINGS['gp-model']?.systemDoes,
        output: STEP_BRIEFINGS['gp-model']?.output || 'Trained GP probabilistic model providing mean predictions and uncertainty intervals.'
      },
      {
        number: 13,
        id: 'bayesian-opt',
        name: 'Targeted Optimization',
        purpose: STEP_BRIEFINGS['bayesian-opt']?.purpose || 'Leverage acquisition functions to balance exploration and exploitation for the next experiment.',
        whatHappens: 'Acquisition algorithms identify optimal candidate experiment coordinates balancing high reward and uncertainty reduction.',
        youDo: STEP_BRIEFINGS['bayesian-opt']?.youDo,
        systemDoes: STEP_BRIEFINGS['bayesian-opt']?.systemDoes,
        output: STEP_BRIEFINGS['bayesian-opt']?.output || 'High-utility candidate experiment recipe recommended for laboratory testing.'
      },
      {
        number: 14,
        id: 'new-experiment',
        name: 'New Experiment & Model Update',
        purpose: STEP_BRIEFINGS['new-experiment']?.purpose || 'Execute the Bayesian-recommended experiment in the laboratory and record observed responses.',
        whatHappens: 'Conduct the targeted confirmatory experiment at specified coordinates and input analytical results to update models.',
        youDo: STEP_BRIEFINGS['new-experiment']?.youDo,
        systemDoes: STEP_BRIEFINGS['new-experiment']?.systemDoes,
        output: STEP_BRIEFINGS['new-experiment']?.output || 'Updated empirical dataset enriching the surrogate model with targeted knowledge.'
      }
    ]
  },
  {
    id: 'phase-3',
    title: 'Phase 3 — Design Space & Regulatory Filing',
    steps: [
      {
        number: 15,
        id: 'final-optimum',
        name: 'Final Optimum & Design Space',
        purpose: STEP_BRIEFINGS['final-optimum']?.purpose || 'Synthesize all empirical runs to establish the global Pareto optimum and Proven Acceptable Ranges.',
        whatHappens: 'Establish the global multi-response optimum and calculate Proven Acceptable Ranges (PAR) and Normal Operating Ranges (NOR).',
        youDo: STEP_BRIEFINGS['final-optimum']?.youDo,
        systemDoes: STEP_BRIEFINGS['final-optimum']?.systemDoes,
        output: STEP_BRIEFINGS['final-optimum']?.output || 'Validated optimal setpoints and robust regulatory design space boundaries (PAR/NOR).'
      },
      {
        number: 16,
        id: 'report',
        name: 'Generate Report',
        purpose: STEP_BRIEFINGS['report']?.purpose || 'Compile comprehensive QbD regulatory summary documenting the complete development lifecycle.',
        whatHappens: 'Compile full end-to-end traceability (QTPP → CQA → CPP → DoE → Lab Data → PAR/NOR → Optimum) with audit history.',
        youDo: STEP_BRIEFINGS['report']?.youDo,
        systemDoes: STEP_BRIEFINGS['report']?.systemDoes,
        output: STEP_BRIEFINGS['report']?.output || 'Comprehensive QbD regulatory report package ready for tech transfer or filing.'
      }
    ]
  }
];
