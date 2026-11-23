// frontend/src/config/workflowSteps.ts
import { Step } from '../store/useStore'

export const EXPERIMENT_SETUP_TITLE = 'Experiment Setup'
export const EXPERIMENT_SETUP_SUBTITLE = 'Choose a stage, define what we will change and measure, and launch the DoE campaign.'

export type StepStatus = 'completed' | 'current' | 'locked' | 'editing' | 'needs-review'

export interface WorkflowStepConfig {
  id: Step
  number: number
  label: string
  phase: string
  route: string
  dependencies: Step[]
  description: string
}

export const WORKFLOW_STEPS: WorkflowStepConfig[] = [
  {
    id: 'cqa-risk',
    number: 1,
    label: 'CQA & Risk Assessment',
    phase: 'Phase 0 · Quality & Reverse Risk Walk',
    route: 'cqa-risk',
    dependencies: [],
    description: 'Critical Quality Attributes and parameter risk walk (RPN/CPPs)'
  },
  {
    id: 'define-factors',
    number: 2,
    label: EXPERIMENT_SETUP_TITLE,
    phase: 'Phase 1 · DoE Formulation',
    route: 'define-factors',
    dependencies: ['cqa-risk'],
    description: 'Experimental ranges, units, and target responses'
  },
  {
    id: 'recommend-doe',
    number: 3,
    label: 'Recommend DOE',
    phase: 'Phase 1 · Design Selection',
    route: 'recommend-doe',
    dependencies: ['define-factors'],
    description: 'Statistical experimental design selection'
  },
  {
    id: 'generate-doe',
    number: 4,
    label: 'DOE Matrix & Results',
    phase: 'Phase 1 · Execution & Trials',
    route: 'generate-doe',
    dependencies: ['recommend-doe'],
    description: 'Randomized run sheet execution and lab results entry'
  },
  {
    id: 'initial-optimization',
    number: 5,
    label: 'Initial Optimum',
    phase: 'Phase 2 · Empirical Modeling',
    route: 'initial-optimization',
    dependencies: ['generate-doe'],
    description: 'Response surface modeling and desirability sweet spot'
  },
  {
    id: 'enough-data',
    number: 6,
    label: 'Enough Data?',
    phase: 'Phase 2 · Decision Gate',
    route: 'enough-data',
    dependencies: ['initial-optimization'],
    description: 'Evaluation of model certainty vs active learning need'
  },
  {
    id: 'gp-model',
    number: 7,
    label: 'GP Model',
    phase: 'Phase 2 · Active Learning',
    route: 'gp-model',
    dependencies: ['enough-data', 'generate-doe'],
    description: 'Gaussian Process non-parametric surrogate fitting'
  },
  {
    id: 'bayesian-opt',
    number: 8,
    label: 'Bayesian Optimization',
    phase: 'Phase 2 · Smart Acquisition',
    route: 'bayesian-opt',
    dependencies: ['gp-model'],
    description: 'Expected improvement acquisition & targeted next runs'
  },
  {
    id: 'new-experiment',
    number: 9,
    label: 'New Experiment',
    phase: 'Phase 2 · Iterative Trials',
    route: 'new-experiment',
    dependencies: ['bayesian-opt'],
    description: 'Execution of sequential confirmatory experiments'
  },
  {
    id: 'final-optimum',
    number: 10,
    label: 'Final Optimum',
    phase: 'Phase 3 · Control Space',
    route: 'final-optimum',
    dependencies: ['initial-optimization'],
    description: 'Normal Operating Ranges (NOR) & Proven Acceptable Ranges (PAR)'
  },
  {
    id: 'report',
    number: 11,
    label: 'Generate Report',
    phase: 'Phase 3 · Audit Dossier',
    route: 'report',
    dependencies: ['final-optimum'],
    description: 'Regulatory audit-ready PDF/Excel export'
  }
]
