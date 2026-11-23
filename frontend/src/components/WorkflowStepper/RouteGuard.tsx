// frontend/src/components/WorkflowStepper/RouteGuard.tsx
import React, { useEffect } from 'react'
import { useStore, Step, normalizeStep } from '../../store/useStore'
import { WORKFLOW_STEPS } from '../../config/workflowSteps'
import toast from 'react-hot-toast'

interface RouteGuardProps {
  children: React.ReactNode
}

export default function RouteGuard({ children }: RouteGuardProps) {
  const { currentStep, setStep, currentProject, stepStatuses, unlockedStep } = useStore()

  useEffect(() => {
    if (!currentProject || !currentProject.id) return

    const rawStep = normalizeStep(currentStep)
    const stepConfig = WORKFLOW_STEPS.find(s => s.id === rawStep)
    if (!stepConfig) return

    // If currently editing this step, it is permitted
    if (unlockedStep === rawStep) return

    const status = stepStatuses?.[rawStep]
    // If the step is locked, redirect to the current active incomplete step
    if (status === 'locked') {
      const firstActiveStep = WORKFLOW_STEPS.find(s => {
        const st = stepStatuses?.[s.id]
        return st === 'current' || st === 'editing' || !st
      })

      const fallback: Step = firstActiveStep ? firstActiveStep.id : 'cqa-risk'
      toast(`Step is locked. Redirecting to active step.`, { icon: '🔒' })
      setStep(fallback)
    }
  }, [currentStep, stepStatuses, unlockedStep, currentProject?.id])

  return <>{children}</>
}
