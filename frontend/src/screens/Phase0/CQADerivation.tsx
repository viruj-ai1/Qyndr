import { useState, useEffect, useRef } from 'react'
import { useStore, CQAMapping, QTPPItem } from '../../store/useStore'
import { Projects, CQAApi } from '../../services/api'
import toast from 'react-hot-toast'

interface AttributeSuggestion {
  qtpp_id: string
  attribute: string
  matched_category: string
  suggested_is_cqa: boolean
  suggested_impact: number
  suggested_uncertainty: number
  suggested_criticality: number
  is_critical: boolean
  suggested_method: string
  suggested_range: string
  rationale: string
  reference: string
  applies_to: string
}

interface MissingCQA {
  name: string
  category: string
  appliesTo: 'Final API' | 'Intermediate'
  method: string
  range: string
  impact_score: number
  uncertainty_score: number
  criticality_score: number
  is_critical: boolean
  rationale: string
  reference: string
  importance: string
  origin: 'suggested'
}

interface ValidationWarning {
  cqa_id: string
  cqa_name: string
  type: string
  message: string
}

interface AuditLogEntry {
  id: number
  project_id: number
  cqa_id: string
  action: string
  old_value?: any
  new_value?: any
  user: string
  timestamp: string
}

export default function CQADerivation() {
  const { currentProject, qtpp, cqas, setCqas, setStep, addAuditLog } = useStore()

  const getInitialCQAs = (): CQAMapping[] => {
    const savedList = (currentProject?.cqas_data && currentProject.cqas_data.length > 0)
      ? currentProject.cqas_data
      : (cqas && cqas.length > 0 ? cqas : [])

    return savedList.map(c => {
      const imp = c.impact_score ?? 3
      const unc = c.uncertainty_score ?? 3
      const critScore = c.criticality_score ?? (imp * unc)
      return {
        ...c,
        impact_score: imp,
        uncertainty_score: unc,
        criticality_score: critScore,
        is_critical: c.is_critical ?? (critScore >= 12),
        origin: c.origin ?? (c.linkedQtppIds && c.linkedQtppIds.length > 0 ? 'suggested' : 'chemist_added'),
        version: c.version ?? 1
      }
    })
  }

  const [items, setItems] = useState<CQAMapping[]>(getInitialCQAs)
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<Record<string, AttributeSuggestion>>({})
  const [missingCqas, setMissingCqas] = useState<MissingCQA[]>([])
  const [validationWarnings, setValidationWarnings] = useState<ValidationWarning[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  // Drawer / Assessment Modal State
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingCqa, setEditingCqa] = useState<CQAMapping | null>(null)

  // Exclusion Modal State (when toggled OFF)
  const [exclusionModalOpen, setExclusionModalOpen] = useState(false)
  const [excludingQtpp, setExcludingQtpp] = useState<QTPPItem | null>(null)
  const [exclusionReason, setExclusionReason] = useState('')

  // Audit History Modal State
  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [activeAuditCqaName, setActiveAuditCqaName] = useState('')
  const [loadingAudit, setLoadingAudit] = useState(false)

  const isFirstMount = useRef(true)

  // Fetch suggestions and missing CQAs from backend service
  useEffect(() => {
    if (!currentProject?.id) return
    setLoadingSuggestions(true)
    CQAApi.suggestions(currentProject.id)
      .then(res => {
        if (res.attribute_suggestions) {
          const map: Record<string, AttributeSuggestion> = {}
          res.attribute_suggestions.forEach((s: AttributeSuggestion) => {
            map[s.qtpp_id] = s
          })
          setSuggestions(map)
        }
        if (res.missing_cqas) {
          setMissingCqas(res.missing_cqas)
        }
      })
      .catch(err => {
        console.error('Failed to load CQA suggestions', err)
      })
      .finally(() => setLoadingSuggestions(false))
  }, [currentProject?.id])

  // Periodic Validation of current items
  useEffect(() => {
    if (!currentProject?.id || items.length === 0) {
      setValidationWarnings([])
      return
    }
    const timer = setTimeout(() => {
      CQAApi.validate(currentProject.id, items)
        .then(res => {
          if (res.warnings) {
            setValidationWarnings(res.warnings)
          }
        })
        .catch(() => {})
    }, 600)
    return () => clearTimeout(timer)
  }, [items, currentProject?.id])

  // Synchronize to store and auto-save
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

  // Toggle CQA on/off
  const handleToggleQtpp = (q: QTPPItem) => {
    const existing = items.find(c =>
      (c.linkedQtppIds && c.linkedQtppIds.includes(q.id)) ||
      c.name.toLowerCase() === q.attribute.toLowerCase()
    )

    if (existing) {
      // Prompt for exclusion reason before removing/toggling OFF
      setExcludingQtpp(q)
      setExclusionReason(existing.exclusion_reason || '')
      setExclusionModalOpen(true)
    } else {
      // Toggle ON: Prepare draft CQA using knowledge base suggestions
      const sugg = suggestions[q.id]
      const imp = sugg ? sugg.suggested_impact : 3
      const unc = sugg ? sugg.suggested_uncertainty : 3
      const critScore = imp * unc
      const isCrit = sugg ? sugg.is_critical : (critScore >= 12)

      const newEntry: CQAMapping = {
        id: `cqa-${q.id}`,
        name: q.attribute,
        appliesTo: (sugg?.applies_to as any) || 'Final API',
        stageName: '',
        method: sugg?.suggested_method || 'HPLC-UV (254 nm)',
        range: (q.operator && q.operator !== '=' ? `${q.operator} ` : '') + (q.criterion || sugg?.suggested_range || ''),
        justification: sugg?.rationale || 'Critical quality attribute essential for drug substance compliance.',
        rationale: sugg?.rationale || 'Critical quality attribute essential for drug substance compliance.',
        reference: sugg?.reference || 'ICH Q6A / Compendial Monograph',
        impact_score: imp,
        uncertainty_score: unc,
        criticality_score: critScore,
        is_critical: isCrit,
        origin: 'suggested',
        decided_by: 'Chemist',
        decided_at: new Date().toISOString(),
        version: 1,
        linkedQtppIds: [q.id]
      }

      // Open side drawer for assessment verification
      setEditingCqa(newEntry)
      setDrawerOpen(true)
    }
  }

  // Confirm Exclusion (toggle OFF)
  const confirmExclusion = () => {
    if (!exclusionReason.trim()) {
      toast.error('Exclusion rationale is mandatory per QbD principles.')
      return
    }
    if (!excludingQtpp) return

    const existing = items.find(c =>
      (c.linkedQtppIds && c.linkedQtppIds.includes(excludingQtpp.id)) ||
      c.name.toLowerCase() === excludingQtpp.attribute.toLowerCase()
    )

    if (existing && currentProject?.id) {
      CQAApi.recordAudit(currentProject.id, {
        cqa_id: existing.id,
        action: 'EXCLUDE',
        old_value: existing,
        new_value: { excluded: true, exclusion_reason: exclusionReason }
      }).catch(() => {})
    }

    setItems(prev =>
      prev.filter(c =>
        !(c.linkedQtppIds && c.linkedQtppIds.includes(excludingQtpp.id)) &&
        c.name.toLowerCase() !== excludingQtpp.attribute.toLowerCase()
      )
    )

    toast.success(`Excluded '${excludingQtpp.attribute}' with documented rationale.`)
    setExclusionModalOpen(false)
    setExcludingQtpp(null)
    setExclusionReason('')
  }

  // Save CQA from Drawer
  const saveDrawerCqa = (cqaToSave: CQAMapping) => {
    if (!cqaToSave.name.trim()) {
      toast.error('CQA name cannot be empty.')
      return
    }
    if (!cqaToSave.rationale?.trim() && !cqaToSave.justification?.trim()) {
      toast.error('QbD Rationale is mandatory.')
      return
    }

    const imp = cqaToSave.impact_score ?? 3
    const unc = cqaToSave.uncertainty_score ?? 3
    const critScore = imp * unc
    const isCrit = critScore >= 12

    const finalCqa: CQAMapping = {
      ...cqaToSave,
      impact_score: imp,
      uncertainty_score: unc,
      criticality_score: critScore,
      is_critical: isCrit,
      justification: cqaToSave.rationale || cqaToSave.justification,
      decided_by: 'Chemist',
      decided_at: new Date().toISOString(),
      version: (cqaToSave.version || 1) + 1
    }

    // Determine origin
    if (finalCqa.origin === 'suggested') {
      const origSugg = Object.values(suggestions).find(s => s.attribute.toLowerCase() === finalCqa.name.toLowerCase())
      if (origSugg && (origSugg.suggested_impact !== imp || origSugg.suggested_uncertainty !== unc || origSugg.rationale !== finalCqa.rationale)) {
        finalCqa.origin = 'suggested_edited'
      }
    }

    setItems(prev => {
      const idx = prev.findIndex(c => c.id === finalCqa.id)
      if (idx >= 0) {
        const old = prev[idx]
        if (currentProject?.id) {
          CQAApi.recordAudit(currentProject.id, {
            cqa_id: finalCqa.id,
            action: 'UPDATE',
            old_value: old,
            new_value: finalCqa
          }).catch(() => {})
        }
        const updated = [...prev]
        updated[idx] = finalCqa
        return updated
      } else {
        if (currentProject?.id) {
          CQAApi.recordAudit(currentProject.id, {
            cqa_id: finalCqa.id,
            action: 'CREATE',
            old_value: null,
            new_value: finalCqa
          }).catch(() => {})
        }
        return [...prev, finalCqa]
      }
    })

    toast.success(`CQA '${finalCqa.name}' assessment saved!`)
    setDrawerOpen(false)
    setEditingCqa(null)
  }

  // Add Missing Standard CQA
  const handleAddMissingCqa = (m: MissingCQA) => {
    const newEntry: CQAMapping = {
      id: `cqa-missing-${Date.now()}`,
      name: m.name,
      appliesTo: m.appliesTo,
      stageName: '',
      method: m.method,
      range: m.range,
      justification: m.rationale,
      rationale: m.rationale,
      reference: m.reference,
      impact_score: m.impact_score,
      uncertainty_score: m.uncertainty_score,
      criticality_score: m.criticality_score,
      is_critical: m.is_critical,
      origin: 'suggested',
      decided_by: 'Chemist',
      decided_at: new Date().toISOString(),
      version: 1,
      linkedQtppIds: []
    }

    setItems(prev => [...prev, newEntry])
    setMissingCqas(prev => prev.filter(item => item.name !== m.name))
    if (currentProject?.id) {
      CQAApi.recordAudit(currentProject.id, {
        cqa_id: newEntry.id,
        action: 'CREATE',
        old_value: null,
        new_value: newEntry
      }).catch(() => {})
    }
    toast.success(`Added standard CQA: ${m.name}`)
  }

  // Add Custom CQA Entry
  const handleAddCustomCQA = () => {
    const newCQA: CQAMapping = {
      id: `cqa-custom-${Date.now()}`,
      name: '',
      appliesTo: 'Intermediate',
      stageName: 'Stage 1',
      method: '',
      range: '',
      justification: '',
      rationale: '',
      reference: '',
      impact_score: 3,
      uncertainty_score: 3,
      criticality_score: 9,
      is_critical: false,
      origin: 'chemist_added',
      decided_by: 'Chemist',
      decided_at: new Date().toISOString(),
      version: 1,
      linkedQtppIds: []
    }
    setEditingCqa(newCQA)
    setDrawerOpen(true)
  }

  // Open Audit History for CQA
  const handleOpenAudit = (cqa: CQAMapping) => {
    if (!currentProject?.id) return
    setActiveAuditCqaName(cqa.name)
    setLoadingAudit(true)
    setAuditModalOpen(true)
    CQAApi.auditLog(currentProject.id, cqa.id)
      .then(res => {
        setAuditLogs(res || [])
      })
      .catch(() => {
        toast.error('Failed to load audit history.')
      })
      .finally(() => setLoadingAudit(false))
  }

  const handleRemoveCQA = (id: string) => {
    const cqa = items.find(c => c.id === id)
    if (cqa && currentProject?.id) {
      CQAApi.recordAudit(currentProject.id, {
        cqa_id: cqa.id,
        action: 'DELETE',
        old_value: cqa,
        new_value: null
      }).catch(() => {})
    }
    setItems(prev => prev.filter(c => c.id !== id))
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
        addAuditLog('CQA_SAVE', `Saved ${valid.length} Critical Quality Attributes with QbD criticality scores.`)
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
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>03. CQA Derivation & Criticality Assessment</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
              ICH Q8(R2) & Q9 compliant assessment: Evaluate severity of harm (Impact), state of knowledge (Uncertainty), and document justification references.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <span className="badge badge-accent" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>
              ICH Q8(R2) · Q9 · Q3A/B/C/D · M7
            </span>
          </div>
        </div>
      </div>

      {/* Validation Warnings Banner */}
      {validationWarnings.length > 0 && (
        <div
          style={{
            marginBottom: '1.25rem',
            padding: '0.85rem 1.1rem',
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#b45309', marginBottom: '0.4rem' }}>
            <span>⚠️</span> QbD Consistency & Threshold Warnings ({validationWarnings.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.8rem', color: '#78350f' }}>
            {validationWarnings.map((w, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                <span style={{ fontWeight: 600 }}>•</span>
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main 2-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'start' }}>
        {/* Left Panel: QTPP Reference List with Toggles */}
        <div className="card" style={{ padding: '1.25rem', position: 'sticky', top: '1rem', maxHeight: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>QTPP Attributes</h3>
            <span className="badge badge-secondary" style={{ fontSize: '0.72rem' }}>{qtpp.length} targets</span>
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.85rem', lineHeight: 1.4 }}>
            Toggle ON to perform QbD assessment. Toggle OFF to document justification for exclusion.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', overflowY: 'auto', paddingRight: '2px' }}>
            {qtpp.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>📋</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>No QTPP Attributes Found</div>
                <div>Please complete Step 02 first.</div>
              </div>
            ) : (
              qtpp.map(q => {
                const isSelected = items.some(c =>
                  (c.linkedQtppIds && c.linkedQtppIds.includes(q.id)) ||
                  c.name.toLowerCase() === q.attribute.toLowerCase()
                )
                const sugg = suggestions[q.id]

                return (
                  <div
                    key={q.id}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: isSelected ? 'rgba(0, 174, 179, 0.05)' : 'var(--bg-surface)',
                      transition: 'all 0.2s ease',
                      boxShadow: isSelected ? '0 2px 10px rgba(0, 174, 179, 0.12)' : 'var(--shadow-sm)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: isSelected ? 'var(--primary)' : 'var(--text-primary)', fontSize: '0.86rem', lineHeight: 1.3 }}>
                          {q.attribute}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Target: {q.operator && q.operator !== '=' ? `${q.operator} ` : ''}{q.criterion || 'N/A'}
                        </div>
                      </div>

                      {/* Interactive Toggle Switch */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}
                        onClick={() => handleToggleQtpp(q)}
                        title={isSelected ? 'Click to exclude attribute' : 'Click to assess as CQA'}
                      >
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isSelected ? 'var(--accent)' : 'var(--text-muted)' }}>
                          {isSelected ? 'CQA' : 'OFF'}
                        </span>
                        <div
                          style={{
                            width: '34px',
                            height: '18px',
                            borderRadius: '999px',
                            background: isSelected ? 'var(--accent)' : '#cbd5e1',
                            position: 'relative',
                            transition: 'background 0.2s ease'
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

                    {/* Recommendation Snippet */}
                    {sugg && (
                      <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>
                          Suggested: <strong style={{ color: sugg.is_critical ? '#dc2626' : '#2563eb' }}>{sugg.is_critical ? 'Critical CQA' : 'Monitored'}</strong> (Score: {sugg.suggested_criticality})
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>{sugg.reference.split(' ')[0]}</span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Right Panel: Active CQAs & QbD Evaluation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Active CQAs Section */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                  Assessed Quality Attributes ({items.length})
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '0.74rem' }}>
                  {items.filter(c => c.is_critical).length} Critical · {items.filter(c => !c.is_critical).length} Monitored
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
                  padding: '3rem 2rem',
                  textAlign: 'center',
                  border: '2px dashed var(--border)',
                  borderRadius: '12px',
                  background: 'rgba(248, 250, 252, 0.8)',
                  color: 'var(--text-muted)'
                }}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎯</div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
                  No CQAs Assessed Yet
                </div>
                <div style={{ fontSize: '0.85rem', maxWidth: '480px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                  Toggle any target on the left QTPP Reference List to evaluate its criticality, or click below to author a custom in-process attribute.
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddCustomCQA}>
                  + Add Custom CQA Entry
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {items.map((cqa, idx) => {
                  const crit = cqa.criticality_score ?? ((cqa.impact_score ?? 3) * (cqa.uncertainty_score ?? 3))
                  const isCrit = cqa.is_critical ?? (crit >= 12)

                  return (
                    <div
                      key={cqa.id}
                      style={{
                        padding: '1.15rem',
                        background: 'var(--bg-surface)',
                        borderRadius: '10px',
                        border: isCrit ? '1.5px solid rgba(220, 38, 38, 0.3)' : '1px solid var(--border)',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      {/* Header Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', paddingBottom: '0.65rem', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary)' }}>
                            {cqa.name || `CQA #${idx + 1}`}
                          </span>

                          {/* Criticality Badge */}
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.55rem',
                              borderRadius: '6px',
                              background: isCrit ? 'rgba(220, 38, 38, 0.12)' : 'rgba(37, 99, 235, 0.1)',
                              color: isCrit ? '#dc2626' : '#2563eb',
                              border: `1px solid ${isCrit ? 'rgba(220, 38, 38, 0.25)' : 'rgba(37, 99, 235, 0.2)'}`
                            }}
                          >
                            {isCrit ? 'CRITICAL CQA' : 'NON-CRITICAL'} (Score: {crit})
                          </span>

                          {/* Origin Badge */}
                          <span
                            className="badge badge-secondary"
                            style={{ fontSize: '0.7rem', textTransform: 'capitalize' }}
                          >
                            {cqa.origin === 'chemist_added' ? 'Chemist-Added' : cqa.origin === 'suggested_edited' ? 'Suggested (Edited)' : 'Suggested CQA'}
                          </span>

                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {cqa.appliesTo} {cqa.stageName ? `· ${cqa.stageName}` : ''}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingCqa(cqa)
                              setDrawerOpen(true)
                            }}
                            style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                          >
                            ✏️ Edit Assessment
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenAudit(cqa)}
                            style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                            title="View audit trail for this CQA"
                          >
                            📜 Audit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => handleRemoveCQA(cqa.id)}
                            style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      {/* Detail Metrics Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.6fr', gap: '1rem', fontSize: '0.8rem', marginBottom: '0.65rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Method:</span>{' '}
                          <strong>{cqa.method || 'Not specified'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Acceptable Limit:</span>{' '}
                          <strong>{cqa.range || 'N/A'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Guideline Reference:</span>{' '}
                          <strong>{cqa.reference || 'None cited'}</strong>
                        </div>
                      </div>

                      {/* Rationale & Scoring Row */}
                      <div style={{ background: 'rgba(241, 245, 249, 0.6)', padding: '0.65rem 0.85rem', borderRadius: '8px', fontSize: '0.78rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>QbD Risk Rationale:</strong>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            Severity of Harm (Impact): <strong>{cqa.impact_score ?? 3}/5</strong> · Knowledge Level (Uncertainty): <strong>{cqa.uncertainty_score ?? 3}/5</strong>
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {cqa.rationale || cqa.justification || 'No rationale provided.'}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Missing Standard CQAs Recommendation Section */}
          {missingCqas.length > 0 && (
            <div
              className="card"
              style={{
                padding: '1.25rem',
                border: '1.5px dashed var(--accent)',
                background: 'rgba(0, 174, 179, 0.03)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>💡</span>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--primary)' }}>
                    Standard Compendial API CQAs Not Yet Included ({missingCqas.length})
                  </h4>
                </div>
                <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>ICH Q6A / Q3 Guidelines</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                The following standard drug substance CQAs are absent from your targets. Click "+ Add to CQAs" to include them with ICH pre-filled criteria.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem' }}>
                {missingCqas.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'white',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <strong style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{m.name}</strong>
                        <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>{m.importance}</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                        Limit: <strong>{m.range}</strong> · Ref: <em>{m.reference.split(' ')[0]}</em>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.35rem', lineHeight: 1.3 }}>
                        {m.rationale}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAddMissingCqa(m)}
                      style={{ marginTop: '0.65rem', alignSelf: 'flex-start', fontSize: '0.75rem', padding: '0.2rem 0.6rem' }}
                    >
                      + Add to CQAs
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        <button className="btn btn-secondary" onClick={() => setStep('qtpp')}>
          ← Back to QTPP
        </button>
        <button className="btn btn-primary" onClick={handleSaveAndNext} disabled={saving}>
          {saving ? 'Saving...' : 'Confirm & Proceed to Route / Stage Mapping →'}
        </button>
      </div>

      {/* Assessment Side Drawer / Modal */}
      {drawerOpen && editingCqa && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end'
          }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            style={{
              width: '520px',
              maxWidth: '90vw',
              height: '100vh',
              background: 'white',
              boxShadow: '-8px 0 25px rgba(0,0,0,0.15)',
              display: 'flex',
              flexDirection: 'column',
              padding: '1.75rem',
              overflowY: 'auto'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--primary)' }}>
                  QbD Criticality Assessment
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  ICH Q8(R2) & Q9 scoring for {editingCqa.name || 'New Attribute'}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setDrawerOpen(false)}
                style={{ fontSize: '0.9rem', padding: '0.2rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              {/* Attribute Name */}
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>Attribute Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingCqa.name}
                  onChange={e => setEditingCqa({ ...editingCqa, name: e.target.value })}
                  placeholder="e.g. Assay (Purity)"
                />
              </div>

              {/* Applies To & Stage */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Applies To</label>
                  <select
                    className="form-select"
                    value={editingCqa.appliesTo}
                    onChange={e => setEditingCqa({ ...editingCqa, appliesTo: e.target.value as any })}
                  >
                    <option value="Final API">Final API</option>
                    <option value="Intermediate">Intermediate</option>
                  </select>
                </div>
                {editingCqa.appliesTo === 'Intermediate' && (
                  <div>
                    <label className="form-label" style={{ fontSize: '0.78rem' }}>Process Stage</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editingCqa.stageName || ''}
                      onChange={e => setEditingCqa({ ...editingCqa, stageName: e.target.value })}
                      placeholder="e.g. Stage 1"
                    />
                  </div>
                )}
              </div>

              {/* Measurement Method & Range */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Measurement Method</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingCqa.method || ''}
                    onChange={e => setEditingCqa({ ...editingCqa, method: e.target.value })}
                    placeholder="e.g. HPLC-UV (254 nm)"
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem' }}>Acceptable Limit / Range</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingCqa.range || ''}
                    onChange={e => setEditingCqa({ ...editingCqa, range: e.target.value })}
                    placeholder="e.g. ≥ 98.0% w/w"
                  />
                </div>
              </div>

              {/* Criticality Scoring Matrix (Impact x Uncertainty) */}
              <div style={{ background: 'rgba(248, 250, 252, 0.9)', border: '1px solid var(--border)', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.65rem' }}>
                  Risk Criticality Evaluation Matrix
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.74rem' }}>
                      Impact / Harm Severity (1–5)
                    </label>
                    <select
                      className="form-select"
                      value={editingCqa.impact_score ?? 3}
                      onChange={e => setEditingCqa({ ...editingCqa, impact_score: parseInt(e.target.value) })}
                    >
                      <option value={5}>5 – Severe / Life-Threatening</option>
                      <option value={4}>4 – Significant Impairment / Safety Risk</option>
                      <option value={3}>3 – Moderate Efficacy / Quality Impact</option>
                      <option value={2}>2 – Minor Quality Flaw</option>
                      <option value={1}>1 – Negligible Patient Harm</option>
                    </select>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontSize: '0.74rem' }}>
                      Uncertainty / Knowledge (1–5)
                    </label>
                    <select
                      className="form-select"
                      value={editingCqa.uncertainty_score ?? 3}
                      onChange={e => setEditingCqa({ ...editingCqa, uncertainty_score: parseInt(e.target.value) })}
                    >
                      <option value={5}>5 – Little/No Data (Novel Mechanism)</option>
                      <option value={4}>4 – Limited Laboratory Data</option>
                      <option value={3}>3 – Moderate Process Knowledge</option>
                      <option value={2}>2 – Established Platform Data</option>
                      <option value={1}>1 – Complete Mechanistic Certainty</option>
                    </select>
                  </div>
                </div>

                {/* Score Calculation Banner */}
                {(() => {
                  const imp = editingCqa.impact_score ?? 3
                  const unc = editingCqa.uncertainty_score ?? 3
                  const score = imp * unc
                  const isCrit = score >= 12

                  return (
                    <div
                      style={{
                        marginTop: '0.85rem',
                        padding: '0.65rem 0.85rem',
                        borderRadius: '8px',
                        background: isCrit ? 'rgba(220, 38, 38, 0.08)' : 'rgba(37, 99, 235, 0.08)',
                        border: `1px solid ${isCrit ? 'rgba(220, 38, 38, 0.25)' : 'rgba(37, 99, 235, 0.2)'}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Computed Criticality:</div>
                        <div style={{ fontWeight: 800, fontSize: '1rem', color: isCrit ? '#dc2626' : '#2563eb' }}>
                          Score = {score} ({isCrit ? 'CRITICAL CQA' : 'NON-CRITICAL / MONITORED'})
                        </div>
                      </div>
                      <span className={`badge ${isCrit ? 'badge-danger' : 'badge-primary'}`} style={{ fontSize: '0.72rem' }}>
                        Threshold ≥ 12
                      </span>
                    </div>
                  )
                })()}
              </div>

              {/* Rationale & Reference */}
              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>
                  QbD Risk Rationale *
                </label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={editingCqa.rationale || editingCqa.justification || ''}
                  onChange={e => setEditingCqa({ ...editingCqa, rationale: e.target.value, justification: e.target.value })}
                  placeholder="Explain why this attribute impacts patient safety, therapeutic efficacy, or downstream processability."
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.78rem' }}>
                  Regulatory / Compendial Reference
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editingCqa.reference || ''}
                  onChange={e => setEditingCqa({ ...editingCqa, reference: e.target.value })}
                  placeholder="e.g. ICH Q3A(R2), ICH Q6A, Ph. Eur. Monograph"
                />
              </div>
            </div>

            {/* Drawer Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDrawerOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => saveDrawerCqa(editingCqa)}>
                Save Assessment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exclusion Reason Modal (Toggle OFF) */}
      {exclusionModalOpen && excludingQtpp && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setExclusionModalOpen(false)}
        >
          <div
            style={{
              width: '460px',
              maxWidth: '90vw',
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.2rem' }}>⚠️</span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Document CQA Exclusion Rationale
              </h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '1rem' }}>
              Per ICH Q9 risk management principles, excluding <strong>'{excludingQtpp.attribute}'</strong> from the CQA register requires a documented scientific justification.
            </p>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontSize: '0.78rem' }}>Exclusion Rationale *</label>
              <textarea
                className="form-input"
                rows={3}
                value={exclusionReason}
                onChange={e => setExclusionReason(e.target.value)}
                placeholder="e.g. Purged completely in Stage 2 crystallization with purging factor > 100; non-critical to patient."
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setExclusionModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={confirmExclusion}>
                Confirm Exclusion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audit History Modal */}
      {auditModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setAuditModalOpen(false)}
        >
          <div
            style={{
              width: '560px',
              maxWidth: '90vw',
              maxHeight: '80vh',
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--primary)' }}>
                  Audit Trail: {activeAuditCqaName}
                </h3>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Chronological record of assessments and changes</div>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAuditModalOpen(false)}>✕</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {loadingAudit ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Loading audit logs...
                </div>
              ) : auditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No audit entries logged yet for this attribute.
                </div>
              ) : (
                auditLogs.map(log => (
                  <div key={log.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', fontSize: '0.8rem', background: 'var(--bg-surface)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                      <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{log.action}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                        {new Date(log.timestamp).toLocaleString()} · User: <strong>{log.user}</strong>
                      </span>
                    </div>
                    {log.action === 'EXCLUDE' && log.new_value?.exclusion_reason && (
                      <div style={{ color: '#b91c1c', marginTop: '0.25rem' }}>
                        <strong>Reason:</strong> {log.new_value.exclusion_reason}
                      </div>
                    )}
                    {log.new_value?.rationale && (
                      <div style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        <strong>Rationale:</strong> {log.new_value.rationale}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
