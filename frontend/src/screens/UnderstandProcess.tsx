// src/screens/UnderstandProcess.tsx
import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store/useStore'
import { Projects } from '../services/api'
import toast from 'react-hot-toast'

const QUESTIONS = [
  { key: 'what_is_product',      label: 'What is the product / API?',           placeholder: 'e.g. LXP-001 – an antiviral compound' },
  { key: 'what_is_process',      label: 'Describe the process step',            placeholder: 'e.g. Batch crystallization from ethanol/water system' },
  { key: 'current_performance',  label: 'Current performance / baseline',       placeholder: 'e.g. 72% yield, 0.8% impurity A' },
  { key: 'target_performance',   label: 'Target performance',                   placeholder: 'e.g. >85% yield, <0.3% impurity A' },
  { key: 'known_constraints',    label: 'Known constraints / fixed parameters', placeholder: 'e.g. Temperature must not exceed 60°C' },
  { key: 'previous_doe',         label: 'Previous studies / history',           placeholder: 'e.g. Previous DoE showed temperature is critical' },
]

const DEFAULT_ROCURONIUM_ANSWERS: Record<string, string> = {
  what_is_product: 'Rocuronium Bromide (Stage-I Intermediate: 2β-Morpholino-16α,17α-epoxy-5α-androstan-3α-ol)',
  what_is_process: 'Nucleophilic ring-opening & condensation reaction of 2β,3β-epoxy-5α-androstan-17-one with morpholine at 50–60°C in an aqueous/solvent system, followed by quenching and controlled crystallization.',
  current_performance: '84%–88% molar yield, 0.5%–0.8% Impurity A (epoxy-morpholine isomer), 96.0% HPLC purity, residual morpholine >0.25%.',
  target_performance: '≥ 92.0% molar yield, ≤ 0.20% Impurity A, ≥ 97.5% HPLC purity, and residual morpholine ≤ 0.10%.',
  known_constraints: 'Reaction temperature must not exceed 65°C to avoid thermal degradation of the steroid core. Morpholine molar ratio capped at 1.8 eq for cost & effluent reduction. Agitation fixed at 350 RPM.',
  previous_doe: 'Risk assessment & preliminary screening identified reaction temperature and morpholine charge ratio as CPPs impacting conversion rate and Impurity A kinetics. Extended heating (>12 hours) leads to product degradation.'
}

export default function UnderstandProcess() {
  const { currentProject, setProject, setStep } = useStore()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle')

  useEffect(() => {
    const parsed: Record<string, string> = {}
    if (currentProject?.description) {
      const desc = currentProject.description
      QUESTIONS.forEach(q => {
        const labelHeader = `${q.label}:`
        const idx = desc.indexOf(labelHeader)
        if (idx !== -1) {
          const start = idx + labelHeader.length
          let nextIdx = desc.length
          QUESTIONS.forEach(otherQ => {
            if (otherQ.key !== q.key) {
              const oIdx = desc.indexOf(`${otherQ.label}:`, start)
              if (oIdx !== -1 && oIdx < nextIdx) nextIdx = oIdx
            }
          })
          const endSep = desc.indexOf('---', start)
          if (endSep !== -1 && endSep < nextIdx) nextIdx = endSep
          const val = desc.slice(start, nextIdx).trim()
          if (val && val !== 'Not specified') parsed[q.key] = val
        }
      })
    }

    if (Object.keys(parsed).length > 0) {
      setAnswers(parsed)
    } else if (currentProject?.compound?.toLowerCase().includes('rocuronium') || currentProject?.name?.toLowerCase().includes('rocuronium')) {
      setAnswers(DEFAULT_ROCURONIUM_ANSWERS)
    }
  }, [currentProject?.id, currentProject?.description, currentProject?.compound, currentProject?.name])

  function setA(key: string, val: string) { setAnswers(a => ({ ...a, [key]: val })) }

  const saveAnswersToBackend = useCallback(async (currAnswers: Record<string, string>, nextStep?: boolean) => {
    if (!currentProject?.id) return
    if (nextStep) setSaving(true)
    else setAutoSaveStatus('saving')
    try {
      const rawDesc = currentProject.description || ''
      const baseDesc = rawDesc.split('\n\n--- Process Understanding ---')[0].trim()
      const answersText = QUESTIONS
        .map(q => `${q.label}:\n${currAnswers[q.key] ? currAnswers[q.key].trim() : 'Not specified'}`)
        .join('\n\n')

      const newDescription = baseDesc
        ? `${baseDesc}\n\n--- Process Understanding ---\n${answersText}`
        : `--- Process Understanding ---\n${answersText}`

      const updatePayload: any = { description: newDescription }
      if (nextStep) updatePayload.current_step = 'define-factors'

      const proj = await Projects.update(currentProject.id, updatePayload)
      setProject(proj)
      if (nextStep) {
        setStep('define-factors')
        toast.success('Process understanding saved!')
      } else {
        setAutoSaveStatus('saved')
      }
    } catch {
      if (nextStep) toast.error('Failed to save process understanding')
      else setAutoSaveStatus('idle')
    } finally {
      if (nextStep) setSaving(false)
    }
  }, [currentProject?.id, currentProject?.description, setProject, setStep])

  // Real-time debounced auto-save on input change
  useEffect(() => {
    if (Object.keys(answers).length === 0) return
    const timer = setTimeout(() => {
      saveAnswersToBackend(answers)
    }, 600)
    return () => clearTimeout(timer)
  }, [answers, saveAnswersToBackend])

  async function handleNext() {
    await saveAnswersToBackend(answers, true)
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="page-header-tag">Step 01 · Process Details</div>
          <h1 className="page-title">Create Project & Process Details</h1>
          <p className="page-desc">Create the project and enter the API, goal, and process details.</p>
        </div>
        <div style={{ marginTop: '1rem' }}>
          {autoSaveStatus === 'saving' && <span className="badge badge-accent">Saving changes…</span>}
          {autoSaveStatus === 'saved' && <span className="badge badge-success">✓ Saved automatically</span>}
        </div>
      </div>

      <div className="alert alert-info mb-2">
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        These answers help frame the DOE study. Inputs are saved automatically as you type.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {QUESTIONS.map(q => (
          <div key={q.key} className="card">
            <label className="form-label" style={{ fontSize: '0.85rem', marginBottom: '0.6rem', display: 'block' }}>{q.label}</label>
            <textarea className="form-textarea" rows={2} placeholder={q.placeholder}
              value={answers[q.key] || ''} onChange={e => setA(q.key, e.target.value)}
              onBlur={() => saveAnswersToBackend(answers)} />
          </div>
        ))}
      </div>

      <div className="step-nav">
        <button className="btn btn-secondary" onClick={() => setStep('create-project')}>← Back</button>
        <button className="btn btn-primary" onClick={handleNext} disabled={saving}>
          {saving ? <><div className="spinner" />Saving…</> : 'Continue to Define Factors →'}
        </button>
      </div>
    </div>
  )
}
