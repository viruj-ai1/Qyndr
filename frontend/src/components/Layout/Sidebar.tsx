// src/components/Layout/Sidebar.tsx
import { useStore, Step } from '../../store/useStore'

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
  { key: 'generate-doe',         label: '10. Generate DOE',         icon: '10', category: 'DOE Campaign' },
  { key: 'lab-experiments',      label: '11. Laboratory Runs',      icon: '11', category: 'DOE Campaign' },
  { key: 'upload-results',       label: '12. Upload Results',       icon: '12', category: 'DOE Campaign' },
  { key: 'initial-optimization', label: '13. Initial Optimum',      icon: '13', category: 'DOE Campaign' },
  { key: 'enough-data',          label: '14. Enough Data?',         icon: '14', category: 'DOE Campaign' },
  { key: 'gp-model',             label: '15. GP Model',             icon: '15', category: 'DOE Campaign' },
  { key: 'bayesian-opt',         label: '16. Bayesian Optimization',icon: '16', category: 'DOE Campaign' },
  { key: 'new-experiment',       label: '17. New Experiment',       icon: '17', category: 'DOE Campaign' },
  { key: 'final-optimum',        label: '18. Final Optimum',        icon: '18', category: 'DOE Campaign' },
  { key: 'report',               label: '19. Generate Report',      icon: '19', category: 'Report' },
]

const STEP_ORDER = WORKFLOW_STEPS.map(s => s.key)

function stepIndex(s: Step) { return STEP_ORDER.indexOf(s) }

export default function Sidebar() {
  const { currentStep, setStep } = useStore()
  const currentIdx = stepIndex(currentStep)

  return (
    <nav className="sidebar" style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 60px)' }}>
      <div className="sidebar-label">DOE Workflow Navigation</div>

      {WORKFLOW_STEPS.map((step, idx) => {
        const isActive    = step.key === currentStep
        const isCompleted = idx < currentIdx
        return (
          <div
            key={step.key}
            className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            onClick={() => setStep(step.key)}
            title={step.label}
          >
            <div className="step-num" style={{ fontSize: '0.65rem' }}>
              {isCompleted ? (
                <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <polyline points="20,6 9,17 4,12"/>
                </svg>
              ) : step.icon}
            </div>
            <span style={{ fontSize: '0.8rem' }}>{step.label}</span>
          </div>
        )
      })}

      {/* GP Loop indicator */}
      <div style={{ margin: '1rem 1rem 0.5rem', padding: '0.6rem', background: 'rgba(99,102,241,0.08)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.15)' }}>
        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Bayesian Loop</div>
        <div style={{ fontSize: '0.7rem', color: 'var(--primary-light)', lineHeight: 1.4 }}>
          Steps 12–13 repeat per stage until optimization convergence
        </div>
      </div>
    </nav>
  )
}

