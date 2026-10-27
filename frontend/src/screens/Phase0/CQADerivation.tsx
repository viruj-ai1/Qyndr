import { useState, useEffect, useRef } from 'react'
import { useStore, CQAMapping } from '../../store/useStore'
import { Projects } from '../../services/api'
import { generateContextAwareCQAs } from '../../utils/routeGenerator'

export default function CQADerivation() {
  const { currentProject, qtpp, cqas, setCqas, setStep, addAuditLog } = useStore()

  const getInitialCQAs = (): CQAMapping[] => {
    const list = (currentProject?.cqas_data && currentProject.cqas_data.length > 0)
      ? currentProject.cqas_data
      : (cqas && cqas.length > 0 ? cqas : [])

    const isOldDummy =
      list.length > 0 &&
      list.some(c => c.name === 'API HPLC Purity' && c.stageName === 'Stage 3') &&
      !qtpp.some(q => q.attribute === 'API HPLC Purity')

    if (list.length > 0 && !isOldDummy) {
      return list
    }

    // Derive CQAs based on the QTPPs filled in Step 2:
    if (qtpp.length > 0) {
      return qtpp.map((q, idx) => {
        let method = 'HPLC-UV (254 nm)'
        const attrLower = (q.attribute || '').toLowerCase()
        const typeLower = (q.type || '').toLowerCase()

        if (attrLower.includes('gc') || typeLower.includes('gc')) method = 'GC-FID'
        else if (attrLower.includes('headspace') || attrLower.includes('solvent')) method = 'GC-Headspace'
        else if (attrLower.includes('ir') || attrLower.includes('spectrum')) method = 'FTIR Spectrometry'
        else if (attrLower.includes('karl fischer') || attrLower.includes('water')) method = 'Karl Fischer Titration'
        else if (attrLower.includes('rotation') || attrLower.includes('sor')) method = 'Polarimetry (589 nm)'
        else if (attrLower.includes('melting') || attrLower.includes('dsc')) method = 'Capillary Melting Point'
        else if (attrLower.includes('particle') || attrLower.includes('psd')) method = 'Laser Diffraction'
        else if (typeLower.includes('impurity') || attrLower.includes('impurity')) method = 'LC-MS/MS'
        else if (typeLower.includes('assay') || attrLower.includes('assay')) method = 'HPLC-UV (254 nm)'

        let range = q.criterion || ''
        if (q.operator && q.operator !== '=' && q.operator !== 'Conforms' && !range.startsWith(q.operator)) {
          range = `${q.operator} ${range}`
        }

        let justification = ''
        if (q.justification === 'Patient-Critical') {
          justification = 'Directly impacts clinical safety and therapeutic efficacy.'
        } else if (q.justification === 'Pharmacopoeial') {
          justification = 'Pharmacopoeial compendial specification for release.'
        } else if (q.justification === 'Regulatory Guideline') {
          justification = 'ICH guideline qualification threshold for quality.'
        } else {
          justification = 'Essential quality attribute to satisfy finished product QTPP.'
        }

        return {
          id: `cqa-${idx + 1}`,
          name: q.attribute,
          appliesTo: 'Final API',
          stageName: '',
          method,
          range,
          justification,
          linkedQtppIds: [q.id]
        }
      })
    }

    return generateContextAwareCQAs(currentProject, qtpp)
  }

  const [items, setItems] = useState<CQAMapping[]>(getInitialCQAs)
  const [saving, setSaving] = useState(false)
  const isFirstMount = useRef(true)

  useEffect(() => {
    setItems(getInitialCQAs())
  }, [currentProject?.id])

  // Synchronize to store and auto-save so navigating away never loses data
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    setCqas(items)

    if (!currentProject?.id || items.length === 0) return
    const valid = items.filter(c => c.name.trim() !== '')
    if (valid.length === 0) return

    const timer = setTimeout(() => {
      Projects.savePhase0(currentProject.id, { cqas: valid }).catch(() => {})
    }, 1000)

    return () => clearTimeout(timer)
  }, [items, currentProject?.id, setCqas])

  // Save to backend on unmount if valid items exist
  useEffect(() => {
    return () => {
      const valid = items.filter(c => c.name.trim() !== '')
      if (valid.length > 0 && currentProject?.id) {
        Projects.savePhase0(currentProject.id, { cqas: valid }).catch(() => {})
      }
    }
  }, [items, currentProject?.id])

  const handleAddCQA = () => {
    const newCQA: CQAMapping = {
      id: `cqa-${Date.now()}`,
      name: '',
      appliesTo: 'Final API',
      stageName: '',
      method: '',
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
        const updatedLinks = currentLinks.includes(qtppId)
          ? currentLinks.filter(id => id !== qtppId)
          : [...currentLinks, qtppId]
        return { ...c, linkedQtppIds: updatedLinks }
      }
      return c
    }))
  }

  const handleBack = () => {
    setCqas(items)
    const valid = items.filter(c => c.name.trim() !== '')
    if (valid.length > 0 && currentProject?.id) {
      Projects.savePhase0(currentProject.id, { cqas: valid }).catch(() => {})
    }
    setStep('qtpp')
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
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Spec: {q.operator && q.operator !== '=' ? `${q.operator} ` : ''}{q.criterion}
                </div>
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                  <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>{q.type}</span>
                  <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>{q.justification}</span>
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
                    <input
                      type="text"
                      className="input input-sm"
                      placeholder="e.g. ≤ 0.20%"
                      value={cqa.range || ''}
                      onChange={e => handleChange(cqa.id, 'range', e.target.value)}
                    />
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
        <button className="btn btn-secondary" onClick={handleBack}>
          ← Back to QTPP
        </button>
        <button className="btn btn-primary" onClick={handleSaveAndNext} disabled={saving}>
          {saving ? 'Saving...' : 'Confirm & Proceed to Route / Stage Mapping →'}
        </button>
      </div>
    </div>
  )
}
