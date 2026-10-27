import { useState, useEffect, useRef } from 'react'
import { useStore, StageItem } from '../../store/useStore'
import { Projects } from '../../services/api'
import { generateContextAwareStages, isDefaultDummyStages } from '../../utils/routeGenerator'
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
  const { currentProject, qtpp, cqas, stages, setStages, setStep, addAuditLog } = useStore()

  // Initialize stages with context-aware derivation based on all data until Route Mapping
  const getInitialStages = (): StageItem[] => {
    // 1. Check currentProject.stages_data
    const projStages = currentProject?.stages_data
    if (Array.isArray(projStages) && projStages.length > 0 && !isDefaultDummyStages(projStages, currentProject)) {
      return projStages
    }
    // 2. Check global store stages
    if (Array.isArray(stages) && stages.length > 0 && !isDefaultDummyStages(stages, currentProject)) {
      return stages
    }
    // 3. Fallback to smart derivation based on all data until Route Mapping (Project, QTPP, CQAs)
    return generateContextAwareStages(currentProject, qtpp, cqas)
  }

  const [items, setItems] = useState<StageItem[]>(getInitialStages)
  const [saving, setSaving] = useState(false)
  const [loadingAI, setLoadingAI] = useState(false)
  const isFirstMount = useRef(true)

  // Synchronize when project ID changes
  useEffect(() => {
    setItems(getInitialStages())
  }, [currentProject?.id])

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

  // Detect whether the current project is scoped to a single stage / unit operation
  const projectCombined = `${currentProject?.name || ''} ${currentProject?.compound || ''} ${currentProject?.objective || ''} ${currentProject?.description || ''}`.toLowerCase()
  const isSingleStageScope =
    /\bstage[\s-_]*(?:\d+|i|ii|iii|iv|one|two|three|four)\b/i.test(projectCombined) ||
    /\bstep[\s-_]*(?:\d+|i|ii|iii|iv|one|two|three|four)\b/i.test(projectCombined) ||
    /\b(single[\s-_]*stage|stage[\s-_]*specific|single[\s-_]*step|unit[\s-_]*operation)\b/i.test(projectCombined) ||
    (/\b(crystalliz|precipitat|alkylat|distill|fractionat|hydrogenat|filtrat|drying|purif)\b/i.test(projectCombined) &&
     !projectCombined.includes('multi-stage') && !projectCombined.includes('full synthesis'))

  const handleAddStage = () => {
    const newStage: StageItem = {
      id: `stage-${Date.now()}`,
      order: items.length + 1,
      name: `Stage ${items.length + 1}: `,
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

  // AI Suggest Stages / Regenerate from Step 01 Project Info
  const handleAISuggestStages = async () => {
    setLoadingAI(true)
    try {
      const res = await Projects.suggestStages({
        project_name: currentProject?.name || '',
        compound: currentProject?.compound || '',
        objective: currentProject?.objective || '',
        description: currentProject?.description || ''
      })
      if (res && res.stages && Array.isArray(res.stages) && res.stages.length > 0) {
        const formatted: StageItem[] = res.stages.map((st: any, idx: number) => ({
          id: st.id || `stage-${idx + 1}`,
          order: idx + 1,
          name: st.name || `Stage ${idx + 1}`,
          unitOpType: (st.unitOpType || 'Reaction') as any,
          description: st.description || '',
          intermediateProduced: st.intermediateProduced || ''
        }))
        setItems(formatted)
        toast.success(`AI derived ${formatted.length} stage(s) tailored to ${currentProject?.compound || currentProject?.name || 'project'}`)
        return
      }
    } catch (err) {
      console.warn('AI stages endpoint fallback:', err)
    } finally {
      setLoadingAI(false)
    }

    // Fallback to domain-specific derivation based on all prior steps
    const fallbackStages = generateContextAwareStages(currentProject, qtpp, cqas)
    setItems(fallbackStages)
    toast.success(`Derived ${fallbackStages.length} synthesis stage(s) from project specifications & CQAs`)
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
      toast.error('Please add or generate at least one synthesis stage before proceeding.')
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="badge badge-accent">Step 04 · Phase 0</div>
          <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Route Mapping</h1>
          {isSingleStageScope && (
            <span className="badge badge-primary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}>
              ⚡ Single-Stage Scope (Unit Operation Breakdown)
            </span>
          )}
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Synthesized from Step 01 Project Details, Step 02 QTPP, and Step 03 CQAs for{' '}
          <strong style={{ color: 'var(--primary-light)' }}>
            {currentProject?.compound ? `${currentProject.compound} (${currentProject.name})` : (currentProject?.name || 'your project')}
          </strong>.
        </p>
      </div>

      {/* Route Backbone Card */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Synthetic Route Backbone</h3>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {items.length} stage{items.length === 1 ? '' : 's'} defined · Derived from Step 01 Process Details & Step 03 CQAs
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleAISuggestStages}
              disabled={loadingAI}
              title="Re-derive synthesis stages from Step 01 project metadata and Step 03 CQAs"
            >
              {loadingAI ? <><div className="spinner" /> Deriving…</> : '⚡ Derive from Prior Steps (01–03)'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleAddStage}>
              + Add Stage
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '2.5rem 1.5rem',
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '8px',
              border: '1px dashed rgba(255,255,255,0.12)'
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🧪</div>
            <h4 style={{ margin: '0 0 0.4rem', fontSize: '1rem', fontWeight: 600 }}>No Stages Defined</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: '440px', margin: '0 auto 1.25rem' }}>
              All stages have been removed. Add a custom stage manually or derive stages directly from your Step 01 project details and Step 03 CQAs.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleAddStage}>
                + Add Stage
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleAISuggestStages} disabled={loadingAI}>
                {loadingAI ? <><div className="spinner" /> Deriving…</> : '⚡ Derive from Prior Steps (01–03)'}
              </button>
            </div>
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
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                {/* Order Indicator */}
                <div
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.15rem',
                    color: '#fff',
                    flexShrink: 0,
                    marginTop: '4px'
                  }}
                >
                  {idx + 1}
                </div>

                {/* Form Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', flex: 1 }}>
                  {/* Row 1: Stage Name & Unit Op Type */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                        Stage / Unit Operation Name
                      </label>
                      <input
                        type="text"
                        className="input"
                        style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.88rem' }}
                        placeholder="e.g. Unit Op 1: Friedel-Crafts Alkylation Reaction"
                        value={stage.name}
                        onChange={e => handleChange(stage.id, 'name', e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                        Unit Operation Type
                      </label>
                      <select
                        className="input"
                        style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.88rem' }}
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
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                        Brief Chemistry / Engineering Description
                      </label>
                      <input
                        type="text"
                        className="input"
                        style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.88rem' }}
                        placeholder="e.g. Catalytic alkylation over solid acid catalyst at 200-240°C"
                        value={stage.description || ''}
                        onChange={e => handleChange(stage.id, 'description', e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                        Key Intermediate / Material Produced
                      </label>
                      <input
                        type="text"
                        className="input"
                        style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.88rem' }}
                        placeholder="e.g. Crude 2,6-Diisopropylphenol Reaction Mass"
                        value={stage.intermediateProduced || ''}
                        onChange={e => handleChange(stage.id, 'intermediateProduced', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Reordering & Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0, justifyContent: 'center', alignSelf: 'center' }}>
                  <button
                    className="btn btn-icon btn-sm"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, 'up')}
                    title="Move Up"
                  >
                    ▲
                  </button>
                  <button
                    className="btn btn-icon btn-sm"
                    disabled={idx === items.length - 1}
                    onClick={() => handleMove(idx, 'down')}
                    title="Move Down"
                  >
                    ▼
                  </button>
                  <button
                    className="btn btn-icon btn-sm btn-danger"
                    onClick={() => handleRemoveStage(stage.id)}
                    title="Delete Stage"
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
