import { useStore, Step, normalizeStep } from '../../store/useStore'
import { Projects } from '../../services/api'

interface StepDef { key: Step; label: string; icon: string; category?: string }

const WORKFLOW_STEPS: StepDef[] = [
  { key: 'create-project',       label: '01. Create Project',       icon: '01', category: 'Project' },
  { key: 'qtpp',                 label: '02. QTPP Definition',      icon: '02', category: 'Phase 0' },
  { key: 'cqa',                  label: '03. CQA Derivation',       icon: '03', category: 'Phase 0' },
  { key: 'route-mapping',        label: '04. Route Mapping',        icon: '04', category: 'Phase 0' },
  { key: 'risk-assessment',      label: '05. Risk Assessment',      icon: '05', category: 'Phase 0' },
  { key: 'phase0-summary',       label: '06. Phase 0 Summary',      icon: '06', category: 'Phase 0' },
  { key: 'campaign-dashboard',   label: '07. Campaign Dashboard',   icon: '07', category: 'Dashboard' },
  { key: 'define-factors',       label: '08. Define Factors & Responses', icon: '08', category: 'DOE Campaign' },
  { key: 'recommend-doe',        label: '09. Recommend DOE',        icon: '09', category: 'DOE Campaign' },
  { key: 'generate-doe',         label: '10. DOE Matrix & Results', icon: '10', category: 'DOE Campaign' },
  { key: 'initial-optimization', label: '11. Initial Optimum',      icon: '11', category: 'DOE Campaign' },
  { key: 'enough-data',          label: '12. Enough Data?',         icon: '12', category: 'DOE Campaign' },
  { key: 'gp-model',             label: '13. GP Model',             icon: '13', category: 'DOE Campaign' },
  { key: 'bayesian-opt',         label: '14. Bayesian Optimization',icon: '14', category: 'DOE Campaign' },
  { key: 'new-experiment',       label: '15. New Experiment',       icon: '15', category: 'DOE Campaign' },
  { key: 'final-optimum',        label: '16. Final Optimum',        icon: '16', category: 'DOE Campaign' },
  { key: 'report',               label: '17. Generate Report',      icon: '17', category: 'Report' },
]

const STEP_ORDER = WORKFLOW_STEPS.map(s => s.key)

function stepIndex(s: Step) {
  if (s === 'lab-experiments' || s === 'upload-results') return STEP_ORDER.indexOf('generate-doe')
  return STEP_ORDER.indexOf(s)
}

function isStepDone(stepKey: Step, idx: number, currentIdx: number, store: any): boolean {
  const { currentProject, qtpp, cqas, stages, riskAssessments, experiments, optimumResult, finalResult } = store
  switch (stepKey) {
    case 'create-project':
      return Boolean(currentProject?.name)
    case 'qtpp':
      return Boolean((qtpp && qtpp.length > 0) || (currentProject?.qtpp_data && currentProject.qtpp_data.length > 0))
    case 'cqa':
      return Boolean((cqas && cqas.length > 0) || (currentProject?.cqas_data && currentProject.cqas_data.length > 0))
    case 'route-mapping':
      return Boolean((stages && stages.length > 0) || (currentProject?.stages_data && currentProject.stages_data.length > 0))
    case 'risk-assessment':
      return Boolean(
        (riskAssessments && Object.keys(riskAssessments).length > 0) ||
        (currentProject?.risk_assessment_data && Object.keys(currentProject.risk_assessment_data).length > 0)
      )
    case 'phase0-summary':
      return Boolean((stages && stages.length > 0) || (currentProject?.stages_data && currentProject.stages_data.length > 0))
    case 'campaign-dashboard':
      return Boolean(currentProject)
    case 'define-factors':
      return Boolean(currentProject?.factors && currentProject.factors.length > 0)
    case 'recommend-doe':
      return Boolean(currentProject?.doe_type)
    case 'generate-doe':
      return Boolean(
        experiments &&
        experiments.length > 0 &&
        experiments.some((e: any) => e.is_completed || (e.result_values && e.result_values.some((v: any) => v != null)))
      )
    case 'initial-optimization':
      return Boolean(optimumResult)
    case 'enough-data':
      return Boolean(optimumResult)
    case 'gp-model':
      return Boolean(store.bayesResult || optimumResult)
    case 'bayesian-opt':
      return Boolean(store.bayesResult)
    case 'new-experiment':
      return Boolean(experiments && experiments.some((e: any) => e.run_type === 'Bayesian'))
    case 'final-optimum':
      return Boolean(finalResult || optimumResult)
    case 'report':
      return Boolean(finalResult || optimumResult)
    default:
      return idx < currentIdx
  }
}

export default function Sidebar() {
  const store = useStore()
  const { currentStep, setStep, currentProject } = store
  const currentIdx = stepIndex(normalizeStep(currentStep))

  const handleStepClick = (stepKey: Step) => {
    setStep(stepKey)
    if (currentProject?.id) {
      Projects.update(currentProject.id, { current_step: stepKey }).catch(() => {})
    }
  }

  return (
    <nav className="sidebar" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 60px)' }}>
      <div className="sidebar-label">DOE Workflow Navigation</div>

      {WORKFLOW_STEPS.map((step, idx) => {
        const isActive = step.key === currentStep || (step.key === 'generate-doe' && (currentStep === 'lab-experiments' || currentStep === 'upload-results'))
        const isCompleted = isStepDone(step.key, idx, currentIdx, store)
        return (
          <div
            key={step.key}
            className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            onClick={() => handleStepClick(step.key)}
            title={step.label}
          >
            <div className="step-num">
              {isCompleted ? (
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              ) : step.icon}
            </div>
            <span className="step-label">{step.label}</span>
          </div>
        )
      })}

      {/* GP Loop indicator */}
      <div style={{ margin: '1rem 1rem 0.5rem', padding: '0.75rem', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.15)' }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Bayesian Loop</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)', lineHeight: 1.45 }}>
          Steps 14–15 repeat per stage until optimization convergence
        </div>
      </div>
    </nav>
  )
}

