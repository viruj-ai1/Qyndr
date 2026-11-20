// frontend/src/components/WorkflowStepper/WorkflowStepper.tsx
import React, { useState } from 'react'
import {
  Check,
  Lock,
  Unlock,
  Edit2,
  AlertTriangle,
  RotateCcw,
  ChevronRight
} from 'lucide-react'
import { WORKFLOW_STEPS, WorkflowStepConfig, StepStatus } from '../../config/workflowSteps'
import { useStore, Step } from '../../store/useStore'
import { WorkflowApi } from '../../services/api'
import UnlockConfirmModal from './UnlockConfirmModal'
import RealignSummaryModal from './RealignSummaryModal'
import toast from 'react-hot-toast'

export default function WorkflowStepper() {
  const {
    currentStep,
    setStep,
    currentProject,
    stepStatuses,
    unlockedStep,
    setStepStatuses,
    setUnlockedStep
  } = useStore()

  const [confirmUnlockStep, setConfirmUnlockStep] = useState<WorkflowStepConfig | null>(null)
  const [realignSummary, setRealignSummary] = useState<any | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  if (!currentProject || !currentProject.id) {
    return null
  }

  // Derive status of each step
  const getStatus = (stepId: Step): StepStatus => {
    if (unlockedStep === stepId) return 'editing'
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

  const currentStepConfig = WORKFLOW_STEPS.find(s => s.id === currentStep)
  const isCurrentEditing = unlockedStep === currentStep
  const isCurrentCompleted = currentStepConfig ? getStatus(currentStepConfig.id) === 'completed' : false

  return (
    <div
      style={{
        background: '#ffffff',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}
    >
      {/* Top Banner for Edit / Read-Only Mode */}
      {isCurrentEditing ? (
        <div
          style={{
            background: '#fffbeb',
            borderBottom: '1px solid #fef3c7',
            padding: '0.45rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.825rem',
            color: '#92400e'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Edit2 size={14} style={{ color: '#d97706' }} />
            <span>
              <strong>Editing Mode:</strong> You are editing an earlier step. Saving will re-align downstream data.
            </span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={handleCancelEdit}
            disabled={actionLoading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <RotateCcw size={12} />
            <span>Cancel Edit</span>
          </button>
        </div>
      ) : isCurrentCompleted ? (
        <div
          style={{
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '0.45rem 1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.825rem',
            color: '#475569'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Check size={14} style={{ color: '#10b981' }} />
            <span>
              <strong>Completed Step (Read-Only):</strong> Information in this step is locked.
            </span>
          </div>
          {currentStepConfig && (
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={(e) => handleRequestUnlock(currentStepConfig, e)}
              disabled={actionLoading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Unlock size={12} />
              <span>Unlock to Edit</span>
            </button>
          )}
        </div>
      ) : null}

      {/* Stepper Navigation Strip */}
      <nav
        aria-label="Workflow Navigation"
        style={{
          display: 'flex',
          alignItems: 'center',
          overflowX: 'auto',
          padding: '0.65rem 1.25rem',
          gap: '0.35rem',
          scrollbarWidth: 'thin'
        }}
      >
        {WORKFLOW_STEPS.map((step, idx) => {
          const status = getStatus(step.id)
          const isCurrent = step.id === currentStep
          const isLocked = status === 'locked'

          // Status-specific visual styling
          let bg = '#f8fafc'
          let borderColor = '#e2e8f0'
          let textColor = '#64748b'
          let icon = <span>{step.number}</span>

          if (status === 'completed') {
            bg = '#f0fdf4'
            borderColor = '#bbf7d0'
            textColor = '#166534'
            icon = <Check size={12} strokeWidth={3} />
          } else if (status === 'editing') {
            bg = '#fffbeb'
            borderColor = '#fde68a'
            textColor = '#b45309'
            icon = <Edit2 size={12} />
          } else if (status === 'needs-review') {
            bg = '#fff7ed'
            borderColor = '#fed7aa'
            textColor = '#c2410c'
            icon = <AlertTriangle size={12} />
          } else if (status === 'current') {
            bg = 'rgba(0, 91, 170, 0.08)'
            borderColor = 'var(--primary)'
            textColor = 'var(--primary)'
            icon = <strong>{step.number}</strong>
          } else if (isLocked) {
            bg = '#f1f5f9'
            borderColor = '#e2e8f0'
            textColor = '#94a3b8'
            icon = <Lock size={11} />
          }

          return (
            <React.Fragment key={step.id}>
              <button
                type="button"
                onClick={() => handleStepClick(step)}
                disabled={isLocked}
                aria-current={isCurrent ? 'step' : undefined}
                aria-disabled={isLocked}
                title={isLocked ? `Complete Step ${step.number - 1} to continue` : step.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.35rem 0.65rem',
                  borderRadius: '6px',
                  background: isCurrent ? 'var(--primary)' : bg,
                  border: `1px solid ${isCurrent ? 'var(--primary)' : borderColor}`,
                  color: isCurrent ? '#ffffff' : textColor,
                  fontSize: '0.78rem',
                  fontWeight: isCurrent ? 700 : 500,
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  opacity: isLocked ? 0.65 : 1,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'all 0.15s ease'
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isCurrent ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.05)',
                    fontSize: '0.7rem'
                  }}
                >
                  {icon}
                </div>
                <span>{step.label}</span>
              </button>
              {idx < WORKFLOW_STEPS.length - 1 && (
                <ChevronRight size={13} style={{ color: '#cbd5e1', flexShrink: 0 }} />
              )}
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
    </div>
  )
}
