// frontend/src/components/WorkflowStepper/WorkflowStepper.tsx
import React, { useState, useEffect, useRef } from 'react'
import {
  Check,
  Lock,
  Unlock,
  Edit2,
  AlertTriangle,
  RotateCcw
} from 'lucide-react'
import { WORKFLOW_STEPS, WorkflowStepConfig, StepStatus } from '../../config/workflowSteps'
import { useStore, Step } from '../../store/useStore'
import { WorkflowApi } from '../../services/api'
import UnlockConfirmModal from './UnlockConfirmModal'
import RealignSummaryModal from './RealignSummaryModal'
import CreateProject from '../../screens/CreateProject'
import toast from 'react-hot-toast'

export default function WorkflowStepper() {
  const {
    currentStep,
    setStep,
    currentProject,
    stepStatuses,
    unlockedStep,
    cqas,
    setStepStatuses,
    setUnlockedStep
  } = useStore()

  const [confirmUnlockStep, setConfirmUnlockStep] = useState<WorkflowStepConfig | null>(null)
  const [realignSummary, setRealignSummary] = useState<any | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [isProjectSetupModalOpen, setIsProjectSetupModalOpen] = useState(false)

  const activeStepRef = useRef<HTMLButtonElement | null>(null)
  const stepperNavRef = useRef<HTMLElement | null>(null)

  // Derive status of each step
  const getStatus = (stepId: Step): StepStatus => {
    // If no project is saved yet, Step 1 (cqa-risk) is current, all others are locked
    if (!currentProject?.id) {
      return stepId === 'cqa-risk' ? 'current' : 'locked'
    }
    if (unlockedStep === stepId) return 'editing'

    // If user has CQAs or project has CQAs, permit access to Step 2 (define-factors)
    if (stepId === 'define-factors' && ((cqas && cqas.length > 0) || (currentProject?.cqas_data && currentProject.cqas_data.length > 0))) {
      if (!stepStatuses || stepStatuses['define-factors'] === 'locked') {
        return 'current'
      }
    }

    if (stepStatuses && stepStatuses[stepId]) return stepStatuses[stepId]
    if (currentStep === stepId) return 'current'
    return 'locked'
  }

  const handleStepClick = (step: WorkflowStepConfig) => {
    const status = getStatus(step.id)
    if (status === 'locked') {
      toast(`Complete Step ${step.number - 1} to continue`, { icon: '🔒' })
      return
    }
    setStep(step.id)
  }

  const handleRequestUnlock = (step: WorkflowStepConfig, e: React.MouseEvent) => {
    e.stopPropagation()
    setConfirmUnlockStep(step)
  }

  const handleConfirmUnlock = async () => {
    if (!confirmUnlockStep || !currentProject?.id) return
    setActionLoading(true)
    try {
      const resp = await WorkflowApi.unlock(currentProject.id, confirmUnlockStep.id)
      setStepStatuses(resp.step_statuses)
      setUnlockedStep(confirmUnlockStep.id)
      setStep(confirmUnlockStep.id)
      toast.success(`${confirmUnlockStep.label} unlocked for editing`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to unlock step')
    } finally {
      setActionLoading(false)
      setConfirmUnlockStep(null)
    }
  }

  const handleCancelEdit = async () => {
    if (!unlockedStep || !currentProject?.id) return
    setActionLoading(true)
    try {
      const resp = await WorkflowApi.cancelEdit(currentProject.id, unlockedStep)
      setStepStatuses(resp.step_statuses)
      setUnlockedStep(null)
      toast.success('Edit cancelled. Step statuses restored.')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to cancel edit')
    } finally {
      setActionLoading(false)
    }
  }

  // Auto-scroll the active step into view on mount and whenever currentStep changes
  useEffect(() => {
    if (activeStepRef.current) {
      activeStepRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      })
    }
  }, [currentStep])

  const currentStepConfig = WORKFLOW_STEPS.find(s => s.id === currentStep)
  const isCurrentEditing = unlockedStep === currentStep
  const isCurrentCompleted = currentStepConfig ? getStatus(currentStepConfig.id) === 'completed' : false

  return (
    <div className="workflow-stepper-container">
      {/* Slim Meta Row: Workflow Stepper, Project Name, and Read-Only / Unlock Button */}
      <div className="workflow-stepper-meta">
        {/* Left: Workflow Stepper tag + Project title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              background: '#ffffff',
              border: '1px solid var(--border)',
              padding: '0.15rem 0.5rem',
              borderRadius: '4px',
              whiteSpace: 'nowrap'
            }}
          >
            Workflow Stepper
          </span>
          <span
            style={{
              fontSize: '0.825rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '380px'
            }}
            title={currentProject?.name}
          >
            {currentProject?.name || 'New Project'}
          </span>
        </div>

        {/* Right: Status and Unlock / Cancel Edit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isCurrentEditing ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  color: '#b45309',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Edit2 size={12} style={{ color: '#d97706' }} />
                <span>Editing Step: Saving re-aligns downstream steps</span>
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-xs"
                onClick={handleCancelEdit}
                disabled={actionLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.2rem 0.6rem',
                  fontSize: '0.75rem'
                }}
              >
                <RotateCcw size={12} />
                <span>Cancel Edit</span>
              </button>
            </div>
          ) : isCurrentCompleted ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  color: '#166534',
                  background: '#dcfce7',
                  border: '1px solid #bbf7d0',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                <Check size={12} strokeWidth={3} style={{ color: '#16a34a' }} />
                <span>Completed (Read-Only)</span>
              </span>
              {currentStepConfig && (
                <button
                  type="button"
                  className="btn btn-secondary btn-xs"
                  onClick={(e) => handleRequestUnlock(currentStepConfig, e)}
                  disabled={actionLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.2rem 0.6rem',
                    fontSize: '0.75rem'
                  }}
                >
                  <Unlock size={12} />
                  <span>Unlock to Edit</span>
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Stepper Track: Left-to-Right Horizontal Stepper */}
      <nav
        ref={stepperNavRef}
        aria-label="Workflow Steps"
        className="workflow-stepper-scroll"
      >
        {WORKFLOW_STEPS.map((step, idx) => {
          const status = getStatus(step.id)
          const isCurrent = step.id === currentStep
          const isLocked = status === 'locked'

          // Check if prior step was completed for connector line
          const isPriorCompleted = idx > 0 && getStatus(WORKFLOW_STEPS[idx - 1].id) === 'completed'

          // Status-specific visual styling for circle
          let icon = <span>{step.number}</span>
          let iconBg = '#f1f5f9'
          let iconColor = '#64748b'

          if (status === 'completed') {
            icon = <Check size={12} strokeWidth={3} />
            iconBg = '#dcfce7'
            iconColor = '#16a34a'
          } else if (status === 'editing') {
            icon = <Edit2 size={12} />
            iconBg = '#fef3c7'
            iconColor = '#d97706'
          } else if (status === 'needs-review') {
            icon = <AlertTriangle size={12} />
            iconBg = '#ffedd5'
            iconColor = '#ea580c'
          } else if (status === 'current') {
            icon = <strong>{step.number}</strong>
            iconBg = 'var(--primary)'
            iconColor = '#ffffff'
          } else if (isLocked) {
            icon = <Lock size={11} />
            iconBg = '#f1f5f9'
            iconColor = '#94a3b8'
          }

          if (isCurrent) {
            iconBg = 'rgba(255,255,255,0.25)'
            iconColor = '#ffffff'
          }

          return (
            <React.Fragment key={step.id}>
              {/* Connector line between steps */}
              {idx > 0 && (
                <div
                  className={`workflow-step-connector ${isPriorCompleted ? 'completed' : ''}`}
                  aria-hidden="true"
                />
              )}

              {/* Step Pill Button */}
              <button
                ref={isCurrent ? activeStepRef : null}
                type="button"
                onClick={() => handleStepClick(step)}
                disabled={isLocked}
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={isLocked}
                title={isLocked ? `Complete Step ${step.number - 1} to continue` : `${step.number}. ${step.label}`}
                className={`workflow-step-pill ${isCurrent ? 'active' : status}`}
              >
                <div
                  className="workflow-step-circle"
                  style={{
                    background: iconBg,
                    color: iconColor
                  }}
                >
                  {icon}
                </div>
                <span className="workflow-step-label">
                  {step.number}. {step.label}
                </span>
              </button>
            </React.Fragment>
          )
        })}
      </nav>

      {/* Confirmation Modal */}
      {confirmUnlockStep && (
        <UnlockConfirmModal
          isOpen={Boolean(confirmUnlockStep)}
          stepName={confirmUnlockStep.label}
          onConfirm={handleConfirmUnlock}
          onCancel={() => setConfirmUnlockStep(null)}
        />
      )}

      {/* Re-alignment Summary Modal */}
      {realignSummary && (
        <RealignSummaryModal
          isOpen={Boolean(realignSummary)}
          summary={realignSummary}
          onClose={() => setRealignSummary(null)}
        />
      )}

      {/* Project Setup & QTPP Modal Popup */}
      {isProjectSetupModalOpen && (
        <CreateProject
          isModal={true}
          onClose={() => setIsProjectSetupModalOpen(false)}
          onProjectCreated={() => {
            setIsProjectSetupModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
