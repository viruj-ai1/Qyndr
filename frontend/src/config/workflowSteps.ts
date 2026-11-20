// frontend/src/config/workflowSteps.ts
import { Step } from '../store/useStore'

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
    id: 'create-project',
    number: 1,
    label: 'Create Project',
    phase: 'Phase 0 · Process Setup',
    route: 'create-project',
    dependencies: [],
    description: 'Project setup, API identification, and process context'
  },
  {
    id: 'qtpp',
    number: 2,
    label: 'QTPP Definition',
    phase: 'Phase 0 · Target Quality',
    route: 'qtpp',
    dependencies: ['create-project'],
    description: 'Quality Target Product Profile specifications'
  },
  {
    id: 'cqa',
    number: 3,
    label: 'CQA Derivation',
    phase: 'Phase 0 · Quality Attributes',
    route: 'cqa',
    dependencies: ['qtpp'],
    description: 'Critical Quality Attributes prioritization and thresholds'
  },
  {
    id: 'route-mapping',
    number: 4,
    label: 'Route Mapping',
    phase: 'Phase 0 · Route Architecture',
    route: 'route-mapping',
    dependencies: ['create-project'],
    description: 'Synthesis route mapping and unit operations'
  },
  {
    id: 'risk-assessment',
    number: 5,
    label: 'Risk Assessment',
    phase: 'Phase 0 · FMEA Risk Walk',
    route: 'risk-assessment',
    dependencies: ['route-mapping', 'cqa'],
    description: 'FMEA severity, occurrence, detectability scoring & RPN'
  },
  {
    id: 'stage-campaign-matrix',
    number: 6,
    label: 'Stage Campaign Matrix',
    phase: 'Phase 0 · Campaign Lock',
    route: 'stage-campaign-matrix',
    dependencies: ['risk-assessment', 'route-mapping'],
    description: 'Prioritized CPPs and DoE campaign initialization'
  },
  {
    id: 'define-factors',
    number: 7,
    label: 'Define Factors & Responses',
    phase: 'Phase 1 · DoE Formulation',
    route: 'define-factors',
    dependencies: ['stage-campaign-matrix', 'cqa'],
    description: 'Experimental ranges, units, and target responses'
  },
  {
    id: 'recommend-doe',
    number: 8,
    label: 'Recommend DOE',
    phase: 'Phase 1 · Design Selection',
    route: 'recommend-doe',
    dependencies: ['define-factors'],
    description: 'Statistical experimental design selection'
  },
  {
    id: 'generate-doe',
    number: 9,
    label: 'DOE Matrix & Results',
    phase: 'Phase 1 · Execution & Trials',
    route: 'generate-doe',
    dependencies: ['recommend-doe'],
    description: 'Randomized run sheet execution and lab results entry'
  },
  {
    id: 'initial-optimization',
    number: 10,
    label: 'Initial Optimum',
    phase: 'Phase 2 · Empirical Modeling',
    route: 'initial-optimization',
    dependencies: ['generate-doe'],
    description: 'Response surface modeling and desirability sweet spot'
  },
  {
    id: 'enough-data',
    number: 11,
    label: 'Enough Data?',
    phase: 'Phase 2 · Decision Gate',
    route: 'enough-data',
    dependencies: ['initial-optimization'],
    description: 'Evaluation of model certainty vs active learning need'
  },
  {
    id: 'gp-model',
    number: 12,
    label: 'GP Model',
    phase: 'Phase 2 · Active Learning',
    route: 'gp-model',
    dependencies: ['enough-data', 'generate-doe'],
    description: 'Gaussian Process non-parametric surrogate fitting'
  },
  {
    id: 'bayesian-opt',
    number: 13,
    label: 'Bayesian Optimization',
    phase: 'Phase 2 · Smart Acquisition',
    route: 'bayesian-opt',
    dependencies: ['gp-model'],
    description: 'Expected improvement acquisition & targeted next runs'
  },
  {
    id: 'new-experiment',
    number: 14,
    label: 'New Experiment',
    phase: 'Phase 2 · Iterative Trials',
    route: 'new-experiment',
    dependencies: ['bayesian-opt'],
    description: 'Execution of sequential confirmatory experiments'
  },
  {
    id: 'final-optimum',
    number: 15,
    label: 'Final Optimum',
    phase: 'Phase 3 · Control Space',
    route: 'final-optimum',
    dependencies: ['initial-optimization'],
    description: 'Normal Operating Ranges (NOR) & Proven Acceptable Ranges (PAR)'
  },
  {
    id: 'report',
    number: 16,
    label: 'Generate Report',
    phase: 'Phase 3 · Audit Dossier',
    route: 'report',
    dependencies: ['final-optimum'],
    description: 'Regulatory audit-ready PDF/Excel export'
  }
]
