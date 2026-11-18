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

export const PLATFORM_WORKFLOW_INTRO =
  "The DoE and QbD Platform guides chemists through the complete Quality by Design (ICH Q8/Q9/Q14) and Design of Experiments (DoE) lifecycle. It takes a drug substance from its quality target profile (QTPP), identifies critical quality targets and process risks, designs lab experiments, finds the optimal reaction sweet spot, and freezes regulatory operating ranges (PAR and NOR) for tech transfer and manufacturing.";

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
