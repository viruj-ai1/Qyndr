import { STEP_BRIEFINGS } from '../config/stepBriefings';

export interface WorkflowStepItem {
  number: number;
  id: string;
  name: string;
  whatHappens: string;
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
        whatHappens: 'Chemist enters API, salt form and development objective.',
        output: STEP_BRIEFINGS['create-project']?.output || 'Central project record that all later stages and DOE matrices attach to.'
      },
      {
        number: 2,
        id: 'qtpp',
        name: 'QTPP Definition',
        whatHappens: 'Define patient safety and therapeutic requirements.',
        output: STEP_BRIEFINGS['qtpp']?.output || 'QTPP specification table serving as the baseline to derive Critical Quality Attributes.'
      },
      {
        number: 3,
        id: 'cqa',
        name: 'CQA Derivation',
        whatHappens: 'Map QTPP goals to measurable attributes and score them for severity and uncertainty.',
        output: STEP_BRIEFINGS['cqa']?.output || 'Prioritized CQA registry with validated specification limits.'
      },
      {
        number: 4,
        id: 'route-mapping',
        name: 'Route Mapping',
        whatHappens: 'Structure the synthesis route into stages with reagents, solvents and intermediates.',
        output: STEP_BRIEFINGS['route-mapping']?.output || 'Detailed process map linking chemistry unit operations to potential risk factors.'
      },
      {
        number: 5,
        id: 'risk-assessment',
        name: 'Risk Assessment (FMEA Parameter Matrix)',
        whatHappens: 'Evaluate parameters with FMEA (Severity × Occurrence × Detectability).',
        output: STEP_BRIEFINGS['risk-assessment']?.output || 'Ranked FMEA risk matrix isolating high-risk parameters requiring empirical DOE study.'
      },
      {
        number: 6,
        id: 'stage-campaign-matrix',
        name: 'Stage Campaign Matrix',
        whatHappens: 'Review risks across stages and select the unit operation to run DoE on.',
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
        whatHappens: 'Set factor ranges and units, and select CQA responses with optimization goals.',
        output: STEP_BRIEFINGS['define-factors']?.output || 'Rigorous factor and response definition governing experimental design construction.'
      },
      {
        number: 8,
        id: 'recommend-doe',
        name: 'Recommend DoE',
        whatHappens: 'System recommends a statistical design (DSD, CCD, Box-Behnken, Fractional Factorial) based on factors, interactions and budget.',
        output: STEP_BRIEFINGS['recommend-doe']?.output || 'Selected DOE design architecture with target run counts and center points.'
      },
      {
        number: 9,
        id: 'generate-doe',
        name: 'DoE Matrix & Lab Results Entry',
        whatHappens: 'Generate the randomized run table, export the batch sheet, run trials and enter results.',
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
        whatHappens: 'Response surface models and a desirability function compute the initial optimum.',
        output: STEP_BRIEFINGS['initial-optimization']?.output || 'First-iteration optimal parameter coordinates and initial empirical model.'
      },
      {
        number: 11,
        id: 'enough-data',
        name: 'Enough Data? (Chemist Decision Gate)',
        whatHappens: 'Chemist reviews desirability and model confidence. Option A (high desirability, strong fit): finalize. Option B (uncertainty or off-target CQAs): go to targeted refinement.',
        output: STEP_BRIEFINGS['enough-data']?.output || 'Workflow branch decision: finalize optimum or proceed to active GP learning.'
      },
      {
        number: 12,
        id: 'gp-model',
        name: 'GP Model',
        whatHappens: 'Factor slices with uncertainty bands show process sensitivity around the optimum.',
        output: STEP_BRIEFINGS['gp-model']?.output || 'Trained GP probabilistic model providing mean predictions and uncertainty intervals.'
      },
      {
        number: 13,
        id: 'bayesian-opt',
        name: 'Targeted Optimization',
        whatHappens: 'Acquisition logic proposes the single best follow-up experiment.',
        output: STEP_BRIEFINGS['bayesian-opt']?.output || 'High-utility candidate experiment recipe recommended for laboratory testing.'
      },
      {
        number: 14,
        id: 'new-experiment',
        name: 'New Experiment & Model Update',
        whatHappens: 'Run the recommended experiment, enter the result, and the models update.',
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
        whatHappens: 'Lock the best setpoints and compute PAR (Proven Acceptable Ranges) and NOR (Normal Operating Ranges).',
        output: STEP_BRIEFINGS['final-optimum']?.output || 'Validated optimal setpoints and robust regulatory design space boundaries (PAR/NOR).'
      },
      {
        number: 16,
        id: 'report',
        name: 'Generate Report',
        whatHappens: 'Compile full traceability (QTPP → CQA → CPP → DoE → Lab Data → PAR/NOR → Optimum) with audit trail and PDF/Excel export.',
        output: STEP_BRIEFINGS['report']?.output || 'Comprehensive QbD regulatory report package ready for tech transfer or filing.'
      }
    ]
  }
];
