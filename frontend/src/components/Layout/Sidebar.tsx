import { useState } from 'react'
import { useStore, Step, normalizeStep } from '../../store/useStore'
import { Projects } from '../../services/api'
import { StepInfoButton, StepInfoPopup } from '../StepInfoPopup'
import { StepBriefing, STEP_BRIEFINGS } from '../../config/stepBriefings'

interface StepDef { key: Step; title: string; category?: string }

const BASE_STEPS: StepDef[] = [
  { key: 'create-project',       title: 'Create Project',             category: 'Project' },
  { key: 'qtpp',                 title: 'QTPP Definition',            category: 'Phase 0' },
  { key: 'cqa',                  title: 'CQA Derivation',             category: 'Phase 0' },
  { key: 'route-mapping',        title: 'Route Mapping',              category: 'Phase 0' },
  { key: 'risk-assessment',      title: 'Risk Assessment',            category: 'Phase 0' },
  { key: 'stage-campaign-matrix',title: 'Stage Campaign Matrix',      category: 'Phase 0' },
  { key: 'define-factors',       title: 'Define Factors & Responses', category: 'DOE Campaign' },
  { key: 'recommend-doe',        title: 'Recommend DOE',              category: 'DOE Campaign' },
  { key: 'generate-doe',         title: 'DOE Matrix & Results',       category: 'DOE Campaign' },
  { key: 'initial-optimization', title: 'Initial Optimum',            category: 'DOE Campaign' },
  { key: 'enough-data',          title: 'Enough Data?',               category: 'DOE Campaign' },
  { key: 'gp-model',             title: 'GP Model',                   category: 'DOE Campaign' },
  { key: 'bayesian-opt',         title: 'Bayesian Optimization',      category: 'DOE Campaign' },
  { key: 'new-experiment',       title: 'New Experiment',             category: 'DOE Campaign' },
  { key: 'final-optimum',        title: 'Final Optimum',              category: 'DOE Campaign' },
  { key: 'report',               title: 'Generate Report',            category: 'Report' },
]

const ALL_STEP_KEYS = BASE_STEPS.map(s => s.key)

function stepIndex(s: Step) {
  if (s === 'lab-experiments' || s === 'upload-results') return ALL_STEP_KEYS.indexOf('generate-doe')
  return ALL_STEP_KEYS.indexOf(s)
}

function isStepDone(stepKey: Step, idx: number, currentIdx: number, store: any): boolean {
  const { currentProject, qtpp, cqas, stages, riskAssessments, experiments, optimumResult, finalResult } = store

  // 1. Mandatory guard: New project or no project loaded -> ZERO checkmarks
  if (!currentProject || !currentProject.id) {
    return false
  }

  // 2. Strict evaluation for valid active project
  switch (stepKey) {
    case 'create-project':
      return Boolean(currentProject.name && currentProject.name.trim().length > 0)

    case 'qtpp':
      return Boolean((qtpp && qtpp.length > 0) || (currentProject.qtpp_data && currentProject.qtpp_data.length > 0))

    case 'cqa':
      return Boolean((cqas && cqas.length > 0) || (currentProject.cqas_data && currentProject.cqas_data.length > 0))

    case 'route-mapping':
      return Boolean((stages && stages.length > 0) || (currentProject.stages_data && currentProject.stages_data.length > 0))

    case 'risk-assessment':
      return Boolean(
        (riskAssessments && Object.keys(riskAssessments).length > 0) ||
        (currentProject.risk_assessment_data && Object.keys(currentProject.risk_assessment_data).length > 0)
      )

    case 'stage-campaign-matrix':
    case 'phase0-summary':
    case 'campaign-dashboard':
      // Done only if both stages AND risk assessment are completed
      return Boolean(
        ((stages && stages.length > 0) || (currentProject.stages_data && currentProject.stages_data.length > 0)) &&
        ((riskAssessments && Object.keys(riskAssessments).length > 0) || (currentProject.risk_assessment_data && Object.keys(currentProject.risk_assessment_data).length > 0))
      )

    case 'define-factors':
      return Boolean(currentProject.factors && currentProject.factors.length > 0 && currentProject.responses && currentProject.responses.length > 0)

    case 'recommend-doe':
      return Boolean(currentProject.doe_type)

    case 'generate-doe':
      return Boolean(
        experiments &&
        experiments.length > 0 &&
        experiments.some((e: any) => e.is_completed || (e.result_values && e.result_values.some((v: any) => v != null)))
      )

    case 'initial-optimization':
      return Boolean(optimumResult && currentProject.experiments && currentProject.experiments.length > 0)

    case 'enough-data':
      return Boolean(optimumResult)

    case 'gp-model':
      return Boolean(store.bayesResult && currentProject.experiments && currentProject.experiments.length > 0)

    case 'bayesian-opt':
      return Boolean(store.bayesResult)

    case 'new-experiment':
      return Boolean(experiments && experiments.some((e: any) => e.run_type === 'Bayesian'))

    case 'final-optimum':
      return Boolean(finalResult || optimumResult)

    case 'report':
      return Boolean((finalResult || optimumResult) && currentProject.id)

    default:
      return false
  }
}

export default function Sidebar() {
  const store = useStore()
  const { currentStep, setStep, currentProject, isBayesianEnabled, bayesResult, experiments } = store
  const currentIdx = stepIndex(normalizeStep(currentStep))

  // State for Step Info Popup
  const [activeBriefing, setActiveBriefing] = useState<{
    briefing: StepBriefing
    anchorRect: DOMRect | null
    returnFocusEl: HTMLElement | null
  } | null>(null)

  // Strictly hide unless user chooses Bayesian Optimization
  const isBayesianActive = Boolean(isBayesianEnabled)

  // Filter steps conditionally
  const visibleSteps = BASE_STEPS.filter(step => {
    if (['gp-model', 'bayesian-opt', 'new-experiment'].includes(step.key)) {
      return isBayesianActive
    }
    return true
  }).map((step, idx) => {
    const numStr = String(idx + 1).padStart(2, '0')
    return {
      ...step,
      stepNumber: idx + 1,
      label: `${numStr}. ${step.title}`,
      icon: numStr,
    }
  })

  const handleStepClick = (stepKey: Step) => {
    setStep(stepKey)
    if (currentProject?.id) {
      Projects.update(currentProject.id, { current_step: stepKey }).catch(() => {})
    }
  }

  const handleToggleInfo = (btnEl: HTMLElement, briefing: StepBriefing) => {
    if (activeBriefing && activeBriefing.briefing.id === briefing.id) {
      setActiveBriefing(null)
    } else {
      const rect = btnEl.getBoundingClientRect()
      setActiveBriefing({
        briefing,
        anchorRect: rect,
        returnFocusEl: btnEl
      })
    }
  }

  return (
    <nav className="sidebar" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 60px)' }}>
      <div className="sidebar-label">DOE Workflow Navigation</div>

      {visibleSteps.map((step, idx) => {
        const isActive = step.key === currentStep || (step.key === 'generate-doe' && (currentStep === 'lab-experiments' || currentStep === 'upload-results'))
        const isCompleted = isStepDone(step.key, idx, currentIdx, store)
        const isPopupOpen = activeBriefing?.briefing.id === step.key

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

            {/* What happens on this page? Info button */}
            <StepInfoButton
              stepId={step.key}
              stepTitle={step.title}
              stepNumber={step.stepNumber}
              isOpen={isPopupOpen}
              onToggle={handleToggleInfo}
            />
          </div>
        )
      })}

      {/* Active Step Info Briefing Dialog */}
      {activeBriefing && (
        <StepInfoPopup
          briefing={activeBriefing.briefing}
          anchorRect={activeBriefing.anchorRect}
          returnFocusEl={activeBriefing.returnFocusEl}
          onClose={() => setActiveBriefing(null)}
        />
      )}

      {/* GP Loop indicator - only shown when Bayesian Optimization is active */}
      {isBayesianActive && (
        <div style={{ margin: '1rem 1rem 0.5rem', padding: '0.75rem', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.15)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Bayesian Loop</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--primary-light)', lineHeight: 1.45 }}>
            Steps 13–14 repeat per stage until optimization convergence
          </div>
        </div>
      )}
    </nav>
  )
}
