import { useState, useEffect, useRef } from 'react'
import { useStore, CQAMapping, QTPPItem } from '../../store/useStore'
import { Projects } from '../../services/api'
import toast from 'react-hot-toast'

// Auto-detect analytical method from QTPP attribute name and type
function getMethodForAttribute(attr: string = '', type: string = ''): string {
  const a = attr.toLowerCase()
  const t = type.toLowerCase()
  if (a.includes('gc') || t.includes('gc')) return 'GC-FID'
  if (a.includes('headspace') || a.includes('solvent')) return 'GC-Headspace'
  if (a.includes('ir') || a.includes('spectrum')) return 'FTIR Spectrometry'
  if (a.includes('karl fischer') || a.includes('water') || a.includes('moisture')) return 'Karl Fischer Titration'
  if (a.includes('rotation') || a.includes('sor')) return 'Polarimetry (589 nm)'
  if (a.includes('melting') || a.includes('dsc')) return 'Capillary Melting Point'
  if (a.includes('particle') || a.includes('psd')) return 'Laser Diffraction'
  if (t.includes('impurity') || a.includes('impurity')) return 'HPLC-UV (254 nm)'
  if (t.includes('assay') || a.includes('assay')) return 'HPLC-UV (254 nm)'
  if (a.includes('ash') || a.includes('residue')) return 'Gravimetric Sulfated Ash'
  if (a.includes('refract')) return 'Refractometry (20°C)'
  if (a.includes('appearance') || a.includes('color')) return 'Visual Inspection'
  return 'HPLC-UV (254 nm)'
}

// Format acceptable range / limit from operator & criterion
function formatRange(operator?: string, criterion?: string): string {
  if (!criterion) return ''
  if (operator && operator !== '=' && operator !== 'Conforms' && !criterion.startsWith(operator)) {
    return `${operator} ${criterion}`
  }
  return criterion
}

// Generate default risk justification from QTPP justification tier
function getJustificationText(justification?: string): string {
  if (justification === 'Patient-Critical') {
    return 'Critical quality attribute directly affecting patient safety and clinical efficacy.'
  }
  if (justification === 'Pharmacopoeial') {
    return 'Pharmacopoeial compendial specification required for drug substance release.'
  }
  if (justification === 'Regulatory Guideline') {
    return 'ICH qualification threshold to ensure drug substance purity and stability.'
  }
  return 'Essential quality attribute to satisfy finished product profile.'
}

export default function CQADerivation() {
  const { currentProject, qtpp, cqas, setCqas, setStep, addAuditLog } = useStore()

  const getInitialCQAs = (): CQAMapping[] => {
    // 1. Check if the project already has user-saved CQAs from prior deliberate work
    const savedList = (currentProject?.cqas_data && currentProject.cqas_data.length > 0)
      ? currentProject.cqas_data
      : (cqas && cqas.length > 0 ? cqas : [])

    // 2. Safety filter: Purge any legacy unlinked demo/template artifacts (e.g. Stage-1 Intermediate Yield template fallbacks)
    // that may have been erroneously auto-saved to backend database in earlier versions
    const isLegacyTemplate = (c: CQAMapping) =>
      (!c.linkedQtppIds || c.linkedQtppIds.length === 0) &&
      !qtpp.some(q => q.attribute.toLowerCase() === c.name.toLowerCase()) &&
      (c.name.includes('Stage-1 Intermediate Yield') ||
        c.name.includes('Mono-alkylated Impurity: 3-isopropyl') ||
        c.name.includes('Unreacted 4-Hydroxybenzoic') ||
        c.name.includes('HPLC Assay Purity (%)'))

    const userAuthorList = savedList.filter(c => !isLegacyTemplate(c))

    if (userAuthorList.length > 0) {
      return userAuthorList
    }

    // 3. ZERO TEMPLATE STARTING POINT:
    // For all projects, do NOT auto-map QTPPs and do NOT load template fallbacks.
    // Start 100% clean from scratch:
    return []
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

    if (!currentProject?.id) return
    const valid = items.filter(c => c.name.trim() !== '')

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

  const toggleQtppSelection = (q: QTPPItem) => {
    const isSelected = items.some(c =>
      (c.linkedQtppIds && c.linkedQtppIds.includes(q.id)) ||
      c.name.toLowerCase() === q.attribute.toLowerCase()
    )

    if (isSelected) {
      setItems(prev =>
        prev.filter(c =>
          !(c.linkedQtppIds && c.linkedQtppIds.includes(q.id)) &&
          c.name.toLowerCase() !== q.attribute.toLowerCase()
        )
      )
    } else {
      const newEntry: CQAMapping = {
        id: `cqa-${q.id}`,
        name: q.attribute,
        appliesTo: 'Final API',
        stageName: '',
        method: getMethodForAttribute(q.attribute, q.type),
        range: formatRange(q.operator, q.criterion),
        justification: getJustificationText(q.justification),
        linkedQtppIds: [q.id]
      }
      setItems(prev => [...prev, newEntry])
    }
  }

  const handleAddCustomCQA = () => {
    const newCQA: CQAMapping = {
      id: `cqa-custom-${Date.now()}`,
      name: '',
      appliesTo: 'Intermediate',
      stageName: 'Stage 1',
      method: '',
      range: '',
      justification: '',
      linkedQtppIds: []
    }
    setItems(prev => [...prev, newCQA])
  }

  const handleRemoveCQA = (id: string) => {
    setItems(prev => prev.filter(c => c.id !== id))
  }

  const handleChange = (id: string, field: keyof CQAMapping, value: any) => {
    setItems(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
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
      toast.error('Please define at least one Critical Quality Attribute (CQA).')
      return
    }
    setSaving(true)
    setCqas(valid)
    if (currentProject) {
      try {
        await Projects.savePhase0(currentProject.id, { cqas: valid })
        addAuditLog('CQA_SAVE', `Saved ${valid.length} Critical Quality Attributes`)
        toast.success(`Saved ${valid.length} Critical Quality Attributes!`)
      } catch (e) {
        console.error('Failed to save CQAs to backend', e)
        toast.error('Failed to save to server, saved locally.')
      }
    }
    setSaving(false)
    setStep('route-mapping')
  }

  return (
    <div className="screen-container">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>CQA Derivation</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Select and define Critical Quality Attributes (CQAs) that must be controlled within specified limits to ensure product quality.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'start' }}>
        {/* Left Panel: Interactive QTPP Reference List with Toggles */}
        <div className="card" style={{ padding: '1.25rem', position: 'sticky', top: '1rem', maxHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>QTPP Reference List</h3>
            <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>{qtpp.length} attributes</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.4 }}>
            Click or toggle any attribute to designate it as a CQA.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', paddingRight: '2px' }}>
            {qtpp.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>📋</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No QTPP Attributes Found</div>
                <div>Please complete Step 02 (QTPP Definition) first to populate target attributes.</div>
              </div>
            ) : (
              qtpp.map(q => {
                const isSelected = items.some(c =>
                  (c.linkedQtppIds && c.linkedQtppIds.includes(q.id)) ||
                  c.name.toLowerCase() === q.attribute.toLowerCase()
                )

                return (
                  <div
                    key={q.id}
                    onClick={() => toggleQtppSelection(q)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      border: isSelected
                        ? '2px solid var(--accent)'
                        : '1px solid var(--border)',
                      background: isSelected
                        ? 'rgba(0, 174, 179, 0.06)'
                        : 'var(--bg-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected
                        ? '0 2px 10px rgba(0, 174, 179, 0.15)'
                        : 'var(--shadow-sm)'
                    }}
                    title={isSelected ? 'Click to exclude from CQAs' : 'Click to include as CQA'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ fontWeight: 600, color: isSelected ? 'var(--primary)' : 'var(--text-primary)', fontSize: '0.86rem', lineHeight: 1.3 }}>
                        {q.attribute}
                      </div>

                      {/* Interactive Toggle Switch */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleQtppSelection(q)
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            color: isSelected ? 'var(--accent)' : 'var(--text-muted)',
                            letterSpacing: '0.04em'
                          }}
                        >
                          {isSelected ? 'CQA' : 'OFF'}
                        </span>
                        <div
                          style={{
                            width: '34px',
                            height: '18px',
                            borderRadius: '999px',
                            background: isSelected ? 'var(--accent)' : '#cbd5e1',
                            position: 'relative',
                            transition: 'background 0.2s ease',
                            cursor: 'pointer'
                          }}
                        >
                          <div
                            style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '50%',
                              background: '#ffffff',
                              position: 'absolute',
                              top: '2px',
                              left: isSelected ? '18px' : '2px',
                              transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.3 }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Target:</span> {q.operator && q.operator !== '=' ? `${q.operator} ` : ''}{q.criterion || 'N/A'}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', flexWrap: 'wrap', gap: '4px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {q.type && (
                          <span className="badge badge-secondary" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
                            {q.type}
                          </span>
                        )}
                        {q.justification && (
                          <span className="badge badge-primary" style={{ fontSize: '0.65rem', padding: '0.15rem 0.45rem' }}>
                            {q.justification}
                          </span>
                        )}
                      </div>
                      {isSelected ? (
                        <span className="badge badge-accent" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem' }}>
                          ✓ Included in CQAs
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ fontSize: '0.65rem', padding: '0.15rem 0.5rem', color: 'var(--text-muted)' }}>
                          + Click to Include
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Panel: Active Critical Quality Attributes (CQAs) Manager */}
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Critical Quality Attributes (CQAs)
              </h3>
              <span className="badge badge-primary" style={{ fontSize: '0.74rem' }}>
                {items.length} {items.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleAddCustomCQA}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              + Add Custom CQA Entry
            </button>
          </div>

          {items.length === 0 ? (
            <div
              style={{
                padding: '3.5rem 2rem',
                textAlign: 'center',
                border: '2px dashed var(--border)',
                borderRadius: '12px',
                background: 'rgba(248, 250, 252, 0.8)',
                color: 'var(--text-muted)'
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎯</div>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                No CQAs Selected Yet
              </div>
              <div style={{ fontSize: '0.86rem', maxWidth: '480px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
                All projects start from scratch. Click or toggle any attribute on the left QTPP Reference List to designate it as a CQA, or click '+ Add Custom CQA Entry' to author a custom in-process attribute.
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddCustomCQA}
              >
                + Add Custom CQA Entry
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {items.map((cqa, idx) => {
                const isLinkedToQtpp = (cqa.linkedQtppIds && cqa.linkedQtppIds.length > 0) || qtpp.some(q => q.attribute.toLowerCase() === cqa.name.toLowerCase() && cqa.name.trim() !== '')

                return (
                  <div
                    key={cqa.id}
                    style={{
                      padding: '1.15rem',
                      background: 'var(--bg-surface)',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    {/* Card Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem', paddingBottom: '0.65rem', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--primary)' }}>
                          CQA #{idx + 1}
                        </span>
                        {isLinkedToQtpp ? (
                          <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
                            Source: QTPP
                          </span>
                        ) : (
                          <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>
                            Custom / In-Process
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        onClick={() => handleRemoveCQA(cqa.id)}
                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        ✕ Remove
                      </button>
                    </div>

                    {/* Form Grid Row 1 (3 Columns): CQA Name, Applies To (+ Stage input if Intermediate), Measurement Method */}
                    <div style={{ display: 'grid', gridTemplateColumns: cqa.appliesTo === 'Intermediate' ? '1.2fr 1.3fr 1fr' : '1.2fr 1fr 1fr', gap: '0.85rem', marginBottom: '0.85rem' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>CQA Name</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Assay (Purity)"
                          value={cqa.name}
                          onChange={e => handleChange(cqa.id, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Applies To</label>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <select
                            className="form-select"
                            value={cqa.appliesTo}
                            onChange={e => handleChange(cqa.id, 'appliesTo', e.target.value as any)}
                            style={{ minWidth: '110px' }}
                          >
                            <option value="Final API">Final API</option>
                            <option value="Intermediate">Intermediate</option>
                          </select>
                          {cqa.appliesTo === 'Intermediate' && (
                            <input
                              type="text"
                              className="form-input"
                              placeholder="Stage (e.g. Stage 1)"
                              value={cqa.stageName || ''}
                              onChange={e => handleChange(cqa.id, 'stageName', e.target.value)}
                            />
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Measurement Method</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. HPLC-UV (254 nm)"
                          value={cqa.method || ''}
                          onChange={e => handleChange(cqa.id, 'method', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Form Grid Row 2 (2 Columns: 1fr 2fr): Acceptable Range / Limit (1 col), Risk Justification (2 cols) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.85rem' }}>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Acceptable Range / Limit</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. ≥ 98.0 %"
                          value={cqa.range || ''}
                          onChange={e => handleChange(cqa.id, 'range', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Risk Justification (Impact on QTPP)</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Why does this CQA threaten final product quality?"
                          value={cqa.justification || ''}
                          onChange={e => handleChange(cqa.id, 'justification', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
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
