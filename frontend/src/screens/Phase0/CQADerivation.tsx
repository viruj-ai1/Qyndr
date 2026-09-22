// src/screens/Phase0/CQADerivation.tsx – Screen A2: CQA Derivation
import { useState } from 'react'
import { useStore, CQAMapping, QTPPItem } from '../../store/useStore'
import { Projects } from '../../services/api'

function parseOperatorAndRange(operator?: string, range?: string): { operator: string; range: string } {
  if (operator && ['>', '<', '>=', '<=', '=', 'Range'].includes(operator)) {
    return { operator, range: range || '' }
  }
  if (!range) return { operator: '<=', range: '' }

  let op = '<='
  let val = range.trim()

  if (val.startsWith('>=') || val.startsWith('≥')) {
    op = '>='
    val = val.replace(/^(>=|≥)\s*/, '')
  } else if (val.startsWith('<=') || val.startsWith('≤')) {
    op = '<='
    val = val.replace(/^(<=|≤)\s*/, '')
  } else if (val.startsWith('>')) {
    op = '>'
    val = val.replace(/^>\s*/, '')
  } else if (val.startsWith('<')) {
    op = '<'
    val = val.replace(/^<\s*/, '')
  } else if (val.startsWith('=')) {
    op = '='
    val = val.replace(/^=\s*/, '')
  } else if (val.includes('-') || val.toLowerCase().includes('to') || val.toLowerCase().includes('range')) {
    op = 'Range'
  }

  return { operator: op, range: val }
}

function extractQtppSpec(q: QTPPItem): { operator: string; range: string } {
  let rawOp = q.operator || ''
  let rawCrit = q.criterion || ''

  if (rawOp === '≤') rawOp = '<='
  if (rawOp === '≥') rawOp = '>='

  if (['>', '<', '>=', '<=', '=', 'Range'].includes(rawOp)) {
    return { operator: rawOp, range: rawCrit }
  }

  return parseOperatorAndRange(undefined, rawCrit)
}

export default function CQADerivation() {
  const { currentProject, qtpp, cqas, setCqas, setStep, addAuditLog } = useStore()

  const [items, setItems] = useState<CQAMapping[]>(() => {
    const initial: CQAMapping[] = cqas.length > 0 ? cqas : [
      {
        id: 'cqa-1',
        name: 'API HPLC Purity',
        appliesTo: 'Final API',
        stageName: 'Stage 3',
        method: 'HPLC-UV (254 nm)',
        operator: '>=',
        range: '99.0%',
        justification: 'High purity is essential for safety and therapeutic efficacy.',
        linkedQtppIds: qtpp.length > 0 ? [qtpp[0].id] : []
      },
      {
        id: 'cqa-2',
        name: 'Impurity B (Process Impurity)',
        appliesTo: 'Intermediate',
        stageName: 'Stage 2',
        method: 'LC-MS/MS',
        operator: '<=',
        range: '0.15%',
        justification: 'Uncontrolled buildup in Stage 2 leads to toxic impurity in final API.',
        linkedQtppIds: qtpp.length > 1 ? [qtpp[1].id] : []
      },
      {
        id: 'cqa-3',
        name: 'Residual Solvents (ICH Class 2)',
        appliesTo: 'Final API',
        stageName: 'Stage 3',
        method: 'GC-Headspace',
        operator: '<=',
        range: '500 ppm',
        justification: 'Residual organic solvents must strictly comply with ICH Q3C limits.',
        linkedQtppIds: qtpp.length > 3 ? [qtpp[3].id] : []
      },
      {
        id: 'cqa-4',
        name: 'Particle Size Distribution (d90)',
        appliesTo: 'Final API',
        stageName: 'Stage 3',
        method: 'Laser Diffraction',
        operator: 'Range',
        range: '10 µm - 50 µm',
        justification: 'Particle size governs dissolution kinetics and bio-availability.',
        linkedQtppIds: qtpp.length > 7 ? [qtpp[7].id] : []
      }
    ]

    return initial.map((item): CQAMapping => {
      const parsed = parseOperatorAndRange(item.operator, item.range)
      return { ...item, operator: parsed.operator, range: parsed.range }
    })
  })
  const [saving, setSaving] = useState(false)

  const handleAddCQA = () => {
    const newCQA: CQAMapping = {
      id: `cqa-${Date.now()}`,
      name: '',
      appliesTo: 'Final API',
      stageName: '',
      method: '',
      operator: '<=',
      range: '',
      justification: '',
      linkedQtppIds: qtpp.length > 0 ? [qtpp[0].id] : []
    }
    setItems([...items, newCQA])
  }

  const handleRemoveCQA = (id: string) => {
    setItems(items.filter(c => c.id !== id))
  }

  const handleChange = (id: string, field: keyof CQAMapping, value: any) => {
    setItems(items.map(c => c.id === id ? { ...c, [field]: value } : c))
  }

  const toggleQtppLink = (cqaId: string, qtppId: string) => {
    setItems(items.map(c => {
      if (c.id === cqaId) {
        const currentLinks = c.linkedQtppIds || []
        const isCurrentlyLinked = currentLinks.includes(qtppId)
        const updatedLinks = isCurrentlyLinked
          ? currentLinks.filter(id => id !== qtppId)
          : [...currentLinks, qtppId]

        let updatedOperator = c.operator
        let updatedRange = c.range

        // Auto-fill Range/Limit from target QTPP spec when linking
        if (!isCurrentlyLinked) {
          const targetQtpp = qtpp.find(q => q.id === qtppId)
          if (targetQtpp) {
            const { operator: autoOp, range: autoRange } = extractQtppSpec(targetQtpp)
            if (autoRange) {
              updatedRange = autoRange
            }
            if (autoOp) {
              updatedOperator = autoOp
            }
          }
        }

        return {
          ...c,
          linkedQtppIds: updatedLinks,
          operator: updatedOperator,
          range: updatedRange
        }
      }
      return c
    }))
  }

  const handleSaveAndNext = async () => {
    const valid = items.filter(c => c.name.trim() !== '')
    if (valid.length === 0) {
      alert('Please define at least one Critical Quality Attribute (CQA).')
      return
    }
    setSaving(true)
    setCqas(valid)
    if (currentProject) {
      try {
        await Projects.savePhase0(currentProject.id, { cqas: valid })
        addAuditLog('CQA_SAVE', `Saved ${valid.length} Critical Quality Attributes`)
      } catch (e) {
        console.error('Failed to save CQAs to backend', e)
      }
    }
    setSaving(false)
    setStep('route-mapping')
  }

  return (
    <div className="screen-container">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="badge badge-accent">Step 03 · Phase 0</div>
          <h1 style={{ fontSize: '1.4rem', margin: 0 }}>CQA Derivation</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Identify the important quality properties that need to be controlled.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Left Panel: Read-only QTPP reference */}
        <div className="card" style={{ padding: '1.25rem', height: 'fit-content' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>QTPP Reference List</h3>
            <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{qtpp.length} attributes</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Select items on the right to link CQAs to these target attributes.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {qtpp.map(q => (
              <div key={q.id} style={{ padding: '0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontWeight: 600, color: 'var(--primary-light)', fontSize: '0.82rem' }}>{q.attribute}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>Spec: {q.criterion}</div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>{q.type}</span>
                  <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>
                    {q.justification === 'Patient-Critical' ? 'Critical Spec' : q.justification}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: CQA Manager */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Critical Quality Attributes (CQAs)</h3>
            <button className="btn btn-secondary btn-sm" onClick={handleAddCQA}>
              + Add CQA Entry
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {items.map((cqa, idx) => (
              <div key={cqa.id} style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)' }}>CQA #{idx + 1}</span>
                  <button className="btn btn-icon btn-xs btn-danger" onClick={() => handleRemoveCQA(cqa.id)}>✕ Delete</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>CQA Name</label>
                    <input
                      type="text"
                      className="input input-sm"
                      placeholder="e.g. Total Impurities"
                      value={cqa.name}
                      onChange={e => handleChange(cqa.id, 'name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Applies To</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        className="input input-sm"
                        value={cqa.appliesTo}
                        onChange={e => handleChange(cqa.id, 'appliesTo', e.target.value as any)}
                        style={{ flex: 1 }}
                      >
                        <option value="Final API">Final API</option>
                        <option value="Intermediate">Intermediate</option>
                      </select>
                      {cqa.appliesTo === 'Intermediate' && (
                        <input
                          type="text"
                          className="input input-sm"
                          placeholder="Stage Name (e.g. Stage 2)"
                          value={cqa.stageName || ''}
                          onChange={e => handleChange(cqa.id, 'stageName', e.target.value)}
                          style={{ flex: 1 }}
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Measurement Method</label>
                    <input
                      type="text"
                      className="input input-sm"
                      placeholder="e.g. HPLC / GC-MS"
                      value={cqa.method || ''}
                      onChange={e => handleChange(cqa.id, 'method', e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Acceptable Range / Limit</label>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <select
                        className="input input-sm"
                        value={cqa.operator || '<='}
                        onChange={e => handleChange(cqa.id, 'operator', e.target.value)}
                        style={{ width: '90px', flexShrink: 0 }}
                      >
                        <option value=">">&gt;</option>
                        <option value="<">&lt;</option>
                        <option value=">=">&ge;</option>
                        <option value="<=">&le;</option>
                        <option value="=">=</option>
                        <option value="Range">Range</option>
                      </select>
                      <input
                        type="text"
                        className="input input-sm"
                        placeholder="e.g. 0.20% or 10 µm - 50 µm"
                        value={cqa.range || ''}
                        onChange={e => handleChange(cqa.id, 'range', e.target.value)}
                        style={{ flex: 1 }}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Risk Justification (Impact on QTPP)</label>
                    <input
                      type="text"
                      className="input input-sm"
                      placeholder="Why does this CQA threaten final product quality?"
                      value={cqa.justification || ''}
                      onChange={e => handleChange(cqa.id, 'justification', e.target.value)}
                    />
                  </div>
                </div>

                {/* Linked QTPPs (Multi-Select Tags) */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Linked QTPP Attribute(s) (Click to toggle mapping):
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {qtpp.map(q => {
                      const isLinked = (cqa.linkedQtppIds || []).includes(q.id)
                      return (
                        <button
                          key={q.id}
                          type="button"
                          className={`badge ${isLinked ? 'badge-primary' : 'badge-secondary'}`}
                          style={{ cursor: 'pointer', padding: '0.35rem 0.6rem', border: isLinked ? '1px solid var(--primary-light)' : '1px solid transparent' }}
                          onClick={() => toggleQtppLink(cqa.id, q.id)}
                        >
                          {isLinked ? '✓ ' : '+ '}{q.attribute}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-secondary" onClick={() => setStep('qtpp')}>
          ← Back to QTPP
        </button>
        <button className="btn btn-primary" onClick={handleSaveAndNext} disabled={saving}>
          {saving ? 'Saving...' : 'Confirm & Proceed to Route / Stage Mapping →'}
        </button>
      </div>
    </div>
  )
}
