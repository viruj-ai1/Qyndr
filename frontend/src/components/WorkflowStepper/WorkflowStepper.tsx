// frontend/src/components/WorkflowStepper/WorkflowStepper.tsx
import React, { useState } from 'react'
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
    setStepStatuses,
    setUnlockedStep
  } = useStore()

  const [confirmUnlockStep, setConfirmUnlockStep] = useState<WorkflowStepConfig | null>(null)
  const [realignSummary, setRealignSummary] = useState<any | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [isProjectSetupModalOpen, setIsProjectSetupModalOpen] = useState(false)

  // Derive status of each step
  const getStatus = (stepId: Step): StepStatus => {
    // If no project is saved yet, Step 1 (cqa-risk) is current, all others are locked
    if (!currentProject?.id) {
      return stepId === 'cqa-risk' ? 'current' : 'locked'
    }
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
    <aside
      className="workflow-stepper-sidebar"
      style={{
        width: '260px',
        minWidth: '260px',
        maxWidth: '260px',
        background: '#ffffff',
        borderRight: '1px solid var(--border)',
        boxShadow: '1px 0 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        zIndex: 20
      }}
    >
      {/* Sidebar Header Title */}
      <div
        style={{
          padding: '0.85rem 1rem 0.65rem',
          borderBottom: '1px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.2rem'
        }}
      >
        <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>
          Workflow Stepper
        </div>
        <div style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {currentProject?.name || 'New Project'}
        </div>
      </div>

      {/* Editing / Read-Only Notice Bar */}
      {isCurrentEditing ? (
        <div
          style={{
            background: '#fffbeb',
            borderBottom: '1px solid #fef3c7',
            padding: '0.65rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            fontSize: '0.78rem',
            color: '#92400e'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Edit2 size={13} style={{ color: '#d97706', flexShrink: 0 }} />
            <span><strong>Editing Step:</strong> Saving re-aligns downstream steps.</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={handleCancelEdit}
            disabled={actionLoading}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', width: '100%' }}
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
            padding: '0.65rem 0.85rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.45rem',
            fontSize: '0.78rem',
            color: '#475569'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Check size={13} style={{ color: '#10b981', flexShrink: 0 }} />
            <span><strong>Completed (Read-Only)</strong></span>
          </div>
          {currentStepConfig && (
            <button
              type="button"
              className="btn btn-secondary btn-xs"
              onClick={(e) => handleRequestUnlock(currentStepConfig, e)}
              disabled={actionLoading}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', width: '100%' }}
            >
              <Unlock size={12} />
              <span>Unlock to Edit</span>
            </button>
          )}
        </div>
      ) : null}

      {/* Vertical Steps List */}
      <nav
        aria-label="Workflow Navigation"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.65rem 0.65rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem'
        }}
      >
        {WORKFLOW_STEPS.map((step) => {
          const status = getStatus(step.id)
          const isCurrent = step.id === currentStep
          const isLocked = status === 'locked'

          // Status-specific visual styling
          let bg = '#ffffff'
          let borderColor = '#e2e8f0'
          let textColor = '#475569'
          let icon = <span>{step.number}</span>
          let iconBg = '#f1f5f9'
          let iconColor = '#64748b'

          if (status === 'completed') {
            bg = '#f0fdf4'
            borderColor = '#bbf7d0'
            textColor = '#166534'
            icon = <Check size={12} strokeWidth={3} />
            iconBg = '#dcfce7'
            iconColor = '#16a34a'
          } else if (status === 'editing') {
            bg = '#fffbeb'
            borderColor = '#fde68a'
            textColor = '#b45309'
            icon = <Edit2 size={12} />
            iconBg = '#fef3c7'
            iconColor = '#d97706'
          } else if (status === 'needs-review') {
            bg = '#fff7ed'
            borderColor = '#fed7aa'
            textColor = '#c2410c'
            icon = <AlertTriangle size={12} />
            iconBg = '#ffedd5'
            iconColor = '#ea580c'
          } else if (status === 'current') {
            bg = 'rgba(0, 91, 170, 0.08)'
            borderColor = 'var(--primary)'
            textColor = 'var(--primary)'
            icon = <strong>{step.number}</strong>
            iconBg = 'var(--primary)'
            iconColor = '#ffffff'
          } else if (isLocked) {
            bg = '#f8fafc'
            borderColor = '#f1f5f9'
            textColor = '#94a3b8'
            icon = <Lock size={11} />
            iconBg = '#f1f5f9'
            iconColor = '#94a3b8'
          }

          if (isCurrent) {
            bg = 'var(--primary)'
            borderColor = 'var(--primary)'
            textColor = '#ffffff'
            iconBg = 'rgba(255,255,255,0.25)'
            iconColor = '#ffffff'
          }

          return (
            <button
              key={step.id}
              type="button"
              onClick={() => handleStepClick(step)}
              disabled={isLocked}
              aria-current={isCurrent ? 'step' : undefined}
              aria-disabled={isLocked}
              title={isLocked ? `Complete Step ${step.number - 1} to continue` : step.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.55rem 0.75rem',
                borderRadius: '8px',
                background: bg,
                border: `1px solid ${borderColor}`,
                color: textColor,
                fontSize: '0.8rem',
                fontWeight: isCurrent ? 700 : 500,
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.6 : 1,
                textAlign: 'left',
                width: '100%',
                transition: 'all 0.15s ease'
              }}
            >
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  minWidth: '22px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: iconBg,
                  color: iconColor,
                  fontSize: '0.7rem'
                }}
              >
                {icon}
              </div>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {step.number}. {step.label}
              </span>
            </button>
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
    </aside>
  )
}
