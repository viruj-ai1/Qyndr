// src/screens/Phase0/RouteMapping.tsx – Screen A3: Route / Stage Mapping
import { useState } from 'react'
import { useStore, StageItem } from '../../store/useStore'
import { Projects } from '../../services/api'

const UNIT_OP_OPTIONS = [
  'Reaction',
  'Workup / Extraction',
  'Crystallization / Isolation',
  'Distillation / Solvent Swap',
  'Drying / Micronization'
]

function normalizeUnitOp(op?: string): string {
  if (!op) return 'Reaction'
  if (op === 'Workup') return 'Workup / Extraction'
  if (op === 'Crystallization') return 'Crystallization / Isolation'
  if (op === 'Drying' || op === 'Filtration') return 'Drying / Micronization'
  if (op === 'Purification') return 'Crystallization / Isolation'
  if (UNIT_OP_OPTIONS.includes(op)) return op
  return 'Reaction'
}

export default function RouteMapping() {
  const { currentProject, stages, setStages, setStep, addAuditLog } = useStore()

  const [items, setItems] = useState<StageItem[]>(() => {
    const stage1DefaultName = (currentProject as any)?.activeStage || (currentProject as any)?.active_stage ||
      (currentProject?.name && currentProject.name.toLowerCase().includes('stage') ? currentProject.name : 'Stage 1: Morpholine Condensation & Ring-Opening')

    const initial: StageItem[] = stages.length > 0 ? stages : [
      {
        id: 'stage-1',
        order: 1,
        name: stage1DefaultName,
        unitOpType: 'Reaction',
        description: 'Nucleophilic ring-opening & condensation reaction with morpholine',
        intermediateProduced: '2β-Morpholino-16α,17α-epoxy-5α-androstan-3α-ol'
      },
      {
        id: 'stage-2',
        order: 2,
        name: 'Stage 2: Quenching & Aqueous Extraction',
        unitOpType: 'Workup / Extraction',
        description: 'Aqueous wash and phase separation to remove excess morpholine',
        intermediateProduced: 'Crude Stage-I Liquid Extract'
      },
      {
        id: 'stage-3',
        order: 3,
        name: 'Stage 3: Crystallization & Isolation',
        unitOpType: 'Crystallization / Isolation',
        description: 'Controlled cooling crystallization and vacuum drying',
        intermediateProduced: 'Pure Stage-I Intermediate'
      }
    ]

    return initial.map((s, idx): StageItem => {
      let stageName = s.name
      if (idx === 0 && (!stageName || stageName.trim() === '' || stageName === 'Stage 1: Coupling Reaction')) {
        stageName = stage1DefaultName
      }
      return {
        ...s,
        name: stageName,
        unitOpType: normalizeUnitOp(s.unitOpType)
      }
    })
  })
  const [saving, setSaving] = useState(false)

  const handleAddStage = () => {
    const newStage: StageItem = {
      id: `stage-${Date.now()}`,
      order: items.length + 1,
      name: `Stage ${items.length + 1}: `,
      unitOpType: 'Reaction',
      description: '',
      intermediateProduced: ''
    }
    setItems([...items, newStage])
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

  const handleSaveAndNext = async () => {
    const valid = items.filter(s => s.name.trim() !== '')
    if (valid.length === 0) {
      alert('Please add at least one synthesis stage.')
      return
    }
    setSaving(true)
    setStages(valid)
    if (currentProject) {
      try {
        await Projects.savePhase0(currentProject.id, { stages: valid })
        addAuditLog('ROUTE_MAPPING_SAVE', `Saved synthetic route map with ${valid.length} stages`)
      } catch (e) {
        console.error('Failed to save stages to backend', e)
      }
    }
    setSaving(false)
    setStep('risk-assessment')
  }

  return (
    <div className="screen-container">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="badge badge-accent">Step 04 · Phase 0</div>
          <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Route Mapping</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Map the different steps of the API manufacturing process.
        </p>
      </div>

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Synthetic Route Backbone</h3>
          <button className="btn btn-secondary btn-sm" onClick={handleAddStage}>
            + Add Stage
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {items.map((stage, idx) => (
            <div key={stage.id} style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Order Indicator */}
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.15rem', color: '#fff', flexShrink: 0, marginTop: '4px' }}>
                {idx + 1}
              </div>

              {/* Form Controls in 2 Spacious Rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', flex: 1 }}>
                {/* Row 1: Stage Name & Unit Op Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Stage Name</label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.88rem' }}
                      placeholder="e.g. Stage 1: Coupling Reaction"
                      value={stage.name}
                      onChange={e => handleChange(stage.id, 'name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Unit Operation Type</label>
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
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Brief Description</label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.88rem' }}
                      placeholder="e.g. Condensation reaction at 50-60°C"
                      value={stage.description || ''}
                      onChange={e => handleChange(stage.id, 'description', e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600 }}>Key Intermediate Produced</label>
                    <input
                      type="text"
                      className="input"
                      style={{ width: '100%', padding: '0.55rem 0.85rem', fontSize: '0.88rem' }}
                      placeholder="e.g. 2β-Morpholino-16α,17α-epoxy-5α-androstan-3α-ol"
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
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-secondary" onClick={() => setStep('cqa')}>
          ← Back to CQA Derivation
        </button>
        <button className="btn btn-primary" onClick={handleSaveAndNext} disabled={saving}>
          {saving ? 'Saving...' : 'Confirm & Proceed to Reverse Risk Assessment →'}
        </button>
      </div>
    </div>
  )
}
