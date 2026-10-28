import { useState, useEffect, useRef } from 'react'
import { useStore, StageItem } from '../../store/useStore'
import { Projects } from '../../services/api'
import { isDefaultDummyStages, parseStagesFromDescription } from '../../utils/routeGenerator'
import toast from 'react-hot-toast'

const UNIT_OP_OPTIONS = [
  'Reaction',
  'Workup',
  'Crystallization',
  'Filtration',
  'Drying',
  'Purification',
  'Other'
]

export default function RouteMapping() {
  const { currentProject, cqas, stages, setStages, setStep, addAuditLog } = useStore()

  // Initialize stages with prioritized auto-fill from description & CQAs
  const getInitialStages = (): StageItem[] => {
    // 1. Check for real user-saved stages (must have at least one non-blank name)
    const projStages = currentProject?.stages_data
    if (
      Array.isArray(projStages) &&
      projStages.length > 0 &&
      projStages.some(s => s.name && s.name.trim() !== '') &&
      !isDefaultDummyStages(projStages, currentProject)
    ) {
      return projStages
    }

    // 2. Check global store for valid named stages from current session
    if (
      Array.isArray(stages) &&
      stages.length > 0 &&
      stages.some(s => s.name && s.name.trim() !== '') &&
      !isDefaultDummyStages(stages, currentProject)
    ) {
      return stages
    }

    // 3. AUTO-FILL PRIORITY 1: Parse Chemist's Step 01 Description
    // If the chemist included "Stage 1: ...", "Stage 2: ..." in Step 01, auto-populate them immediately:
    if (currentProject?.description) {
      const fromDesc = parseStagesFromDescription(currentProject.description, currentProject.compound || '')
      if (fromDesc && fromDesc.length > 0) {
        return fromDesc
      }
    }

    // 4. AUTO-FILL PRIORITY 2: Check Step 03 Intermediate CQAs
    // If the chemist defined stage names in Step 03 (e.g. stageName: "Unit Op 1: Friedel-Crafts"):
    if (cqas && cqas.length > 0) {
      const cqaStages = Array.from(new Set(
        cqas
          .filter(c => c.stageName && c.stageName.trim() !== '')
          .map(c => c.stageName!.trim())
      ))
      if (cqaStages.length > 0) {
        return cqaStages.map((stName, idx) => ({
          id: `stage-${idx + 1}`,
          order: idx + 1,
          name: stName.toLowerCase().startsWith('stage') || stName.toLowerCase().startsWith('unit op') ? stName : `Stage ${idx + 1}: ${stName}`,
          unitOpType: (stName.toLowerCase().includes('workup') ? 'Workup' :
                       stName.toLowerCase().includes('crystalliz') ? 'Crystallization' :
                       stName.toLowerCase().includes('distill') || stName.toLowerCase().includes('purif') ? 'Purification' : 'Reaction') as any,
          description: `Derived from Step 03 CQA stage mapping for ${stName}`,
          intermediateProduced: `${currentProject?.compound || 'API'} Stage ${idx + 1} Intermediate`
        }))
      }
    }

    // 5. Default Fallback: If no stages were written in Step 01 or Step 03, start empty (clean slate)
    return []
  }

  const [items, setItems] = useState<StageItem[]>(getInitialStages)
  const [saving, setSaving] = useState(false)
  const isFirstMount = useRef(true)

  // Synchronize when project or description changes
  useEffect(() => {
    setItems(getInitialStages())
  }, [currentProject?.id, currentProject?.description])

  // Synchronize to store and auto-save so navigating away never loses data
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    setStages(items)

    if (!currentProject?.id || items.length === 0) return
    const valid = items.filter(s => s.name.trim() !== '')
    if (valid.length === 0) return

    const timer = setTimeout(() => {
      Projects.savePhase0(currentProject.id, { stages: valid }).catch(() => {})
    }, 1000)

    return () => clearTimeout(timer)
  }, [items, currentProject?.id, setStages])

  // Save to backend on unmount if valid items exist
  useEffect(() => {
    return () => {
      const valid = items.filter(s => s.name.trim() !== '')
      if (valid.length > 0 && currentProject?.id) {
        Projects.savePhase0(currentProject.id, { stages: valid }).catch(() => {})
      }
    }
  }, [items, currentProject?.id])

  const handleAddStage = () => {
    const newStage: StageItem = {
      id: `stage-${Date.now()}`,
      order: items.length + 1,
      name: '', // Blank name so chemist types from scratch
      unitOpType: 'Reaction',
      description: '',
      intermediateProduced: ''
    }
    setItems(prev => [...prev, newStage])
  }

  const handleRemoveStage = (id: string) => {
    const filtered = items.filter(s => s.id !== id)
    setItems(filtered.map((s, idx) => ({ ...s, order: idx + 1 })))
  }

  const handleChange = (id: string, field: keyof StageItem, value: any) => {
    setItems(items.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= items.length) return
    const updated = [...items]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setItems(updated.map((s, idx) => ({ ...s, order: idx + 1 })))
  }

  const handleBack = () => {
    setStages(items)
    const valid = items.filter(s => s.name.trim() !== '')
    if (valid.length > 0 && currentProject?.id) {
      Projects.savePhase0(currentProject.id, { stages: valid }).catch(() => {})
    }
    setStep('cqa')
  }

  const handleSaveAndNext = async () => {
    const valid = items.filter(s => s.name.trim() !== '')
    if (valid.length === 0) {
      toast.error('Please add and name at least one synthesis stage before proceeding.')
      return
    }
    setSaving(true)
    setStages(valid)
    if (currentProject) {
      try {
        await Projects.savePhase0(currentProject.id, { stages: valid })
        addAuditLog('ROUTE_MAPPING_SAVE', `Saved synthetic route map with ${valid.length} stage(s)`)
        toast.success(`Synthetic route saved with ${valid.length} stage(s)`)
      } catch (e) {
        console.error('Failed to save stages to backend', e)
        toast.error('Saved locally. Backend synchronization will retry.')
      }
    }
    setSaving(false)
    setStep('risk-assessment')
  }

  return (
    <div className="screen-container">
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Route Mapping</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Define the sequence of synthesis stages and unit operations for{' '}
          <strong style={{ color: 'var(--primary)' }}>
            {currentProject?.compound ? `${currentProject.compound} (${currentProject.name})` : (currentProject?.name || 'your project')}
          </strong>.
        </p>
      </div>

      {/* Route Backbone Card */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Synthetic Route Backbone</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
              {items.length} {items.length === 1 ? 'stage' : 'stages'} defined · Add and configure unit operations in sequence
            </p>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleAddStage}>
            + Add Stage
          </button>
        </div>

        {items.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3.5rem 1.5rem',
            background: 'rgba(248, 250, 252, 0.8)',
            borderRadius: '12px',
            border: '2px dashed var(--border)',
            margin: '1rem 0'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧪</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              No Synthesis Stages Defined Yet
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
              Define your chemical sequence (e.g., Reaction → Workup → Crystallization) by adding unit operations manually.
            </p>
            <button 
              type="button" 
              className="btn btn-primary btn-sm" 
              onClick={handleAddStage}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.1rem' }}
            >
              + Add First Stage
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {items.map((stage, idx) => (
              <div
                key={stage.id}
                style={{
                  display: 'flex',
                  gap: '1.25rem',
                  alignItems: 'flex-start',
                  padding: '1.25rem',
                  background: 'var(--bg-surface)',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                {/* Order Indicator */}
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    color: '#fff',
                    flexShrink: 0,
                    marginTop: '2px',
                    boxShadow: '0 2px 8px rgba(0, 91, 170, 0.25)'
                  }}
                >
                  {idx + 1}
                </div>

                {/* Form Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', flex: 1 }}>
                  {/* Row 1: Stage Name & Unit Op Type */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        Stage / Unit Operation Name
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Stage 1: Alkylation Reaction"
                        value={stage.name}
                        onChange={e => handleChange(stage.id, 'name', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        Unit Operation Type
                      </label>
                      <select
                        className="form-select"
                        value={stage.unitOpType}
                        onChange={e => handleChange(stage.id, 'unitOpType', e.target.value)}
                      >
                        {UNIT_OP_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 2: Description & Intermediate Produced */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        Brief Chemistry / Engineering Description
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Catalytic alkylation over solid acid catalyst"
                        value={stage.description || ''}
                        onChange={e => handleChange(stage.id, 'description', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        Key Intermediate / Material Produced
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Crude Reaction Mass"
                        value={stage.intermediateProduced || ''}
                        onChange={e => handleChange(stage.id, 'intermediateProduced', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Reordering & Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, justifyContent: 'center', alignSelf: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm btn-secondary"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, 'up')}
                    title="Move Up"
                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm btn-secondary"
                    disabled={idx === items.length - 1}
                    onClick={() => handleMove(idx, 'down')}
                    title="Move Down"
                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    className="btn btn-icon btn-sm btn-danger"
                    onClick={() => handleRemoveStage(stage.id)}
                    title="Delete Stage"
                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={handleBack}>
          ← Back to CQA Derivation
        </button>
        <button className="btn btn-primary" onClick={handleSaveAndNext} disabled={saving || items.length === 0}>
          {saving ? <><div className="spinner" /> Saving…</> : 'Confirm & Proceed to Reverse Risk Assessment →'}
        </button>
      </div>
    </div>
  )
}
