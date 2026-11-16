import { useState, useEffect, useRef } from 'react'
import { useStore, Factor, Response, isPercentageResponse } from '../store/useStore'
import { Projects } from '../services/api'
import { mapTargetToResponse, extractResponsesFromDescription, simplifyResponseName } from '../utils/targetParser'
import toast from 'react-hot-toast'

const emptyFactor = (): Factor => ({ name: '', unit: '', low: 0, high: 1, baseline: 0.5 })
const emptyResponse = (): Response => ({ name: '', unit: '', goal: 'maximize' })

export default function DefineFactors() {
  const { currentProject, apiTargets, cqas, setProject, setStep } = useStore()

  const [factors, setFactors] = useState<Factor[]>(() => {
    if (currentProject?.factors && currentProject.factors.length > 0) {
      return currentProject.factors
    }
    return []
  })

  // Pre-seed responses: prioritize Step 03 Critical CQAs, then targets/description
  const getInitialResponses = (): Response[] => {
    if (currentProject?.responses && currentProject.responses.length > 0) {
      const filtered = currentProject.responses
        .filter((r: any) => !['impurity b', 'impurity c'].includes(r.name.toLowerCase().trim()))
        .map((r: any) => ({ ...r, name: simplifyResponseName(r.name, r.goal) }))
      if (filtered.length > 0) return filtered
    }

    // 0. Prioritize Critical CQAs from Step 03
    const projectCqas = (currentProject?.cqas_data && currentProject.cqas_data.length > 0)
      ? currentProject.cqas_data
      : (cqas && cqas.length > 0 ? cqas : [])

    const criticalCqas = projectCqas.filter(c => c.is_critical && c.name?.trim())
    if (criticalCqas.length > 0) {
      return criticalCqas.map(c => {
        const nameLower = c.name.toLowerCase()
        const isImpurity = nameLower.includes('impurity') || nameLower.includes('substance') || nameLower.includes('solvent')
        return {
          name: simplifyResponseName(c.name, isImpurity ? 'minimize' : 'maximize'),
          unit: c.range?.includes('%') ? '%' : c.range?.includes('ppm') ? 'ppm' : '',
          goal: isImpurity ? 'minimize' : 'maximize',
          inherited_from_target: true
        }
      })
    }

    // 1. If structured api_targets exist (saved from Step 01), use them
    const targets = (currentProject?.api_targets && currentProject.api_targets.length > 0)
      ? currentProject.api_targets
      : (apiTargets && apiTargets.length > 0 ? apiTargets : [])

    if (targets.length > 0) {
      return targets.map(mapTargetToResponse)
    }

    // 2. Extract directly from Project Description, Objective, and Compound
    const extracted = extractResponsesFromDescription(
      currentProject?.description,
      currentProject?.objective,
      currentProject?.compound
    )
    if (extracted.length > 0) {
      return extracted
    }

    return []
  }

  const [responses, setResponses] = useState<Response[]>(getInitialResponses)
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [isEditMode, setIsEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const isFirstMount = useRef(true)

  // Prune selectedIndices when factors length changes
  useEffect(() => {
    setSelectedIndices(prev => prev.filter(idx => idx < factors.length))
  }, [factors.length])

  // Keep store in sync so switching steps never wipes factors or responses
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    if (currentProject) {
      setProject({ ...currentProject, factors, responses })
    }
  }, [factors, responses])

  // If responses are empty and targets become available, auto-populate
  // If responses are empty, auto-populate from Project Description / api_targets
  useEffect(() => {
    if (responses.length === 0) {
      const targets = (currentProject?.api_targets && currentProject.api_targets.length > 0)
        ? currentProject.api_targets
        : (apiTargets && apiTargets.length > 0 ? apiTargets : [])
      if (targets.length > 0) {
        setResponses(targets.map(mapTargetToResponse))
      } else {
        const extracted = extractResponsesFromDescription(
          currentProject?.description,
          currentProject?.objective,
          currentProject?.compound
        )
        if (extracted.length > 0) {
          setResponses(extracted)
        }
      }
    }
  }, [currentProject?.id, currentProject?.api_targets, currentProject?.description, apiTargets])

  /* ── Quick sync / auto-fill from Step 01 Project Description ── */
  const handleSyncFromProjectDescription = () => {
    // 1. Direct extraction from current description
    const extracted = extractResponsesFromDescription(
      currentProject?.description,
      currentProject?.objective,
      currentProject?.compound
    )
    if (extracted.length > 0) {
      setResponses(extracted)
      toast.success(`Auto-filled ${extracted.length} response variables from Project Description!`)
      return
    }

    // 2. Fallback to api_targets if available
    const targets = (currentProject?.api_targets && currentProject.api_targets.length > 0)
      ? currentProject.api_targets
      : (apiTargets && apiTargets.length > 0 ? apiTargets : [])

    if (targets.length > 0) {
      const seeded = targets.map(mapTargetToResponse)
      setResponses(seeded)
      toast.success(`Auto-filled ${seeded.length} response variables from Project Description!`)
    }
  }

  /* ── Factors helpers ─── */
  const addFactor = () => {
    setFactors(f => [...f, emptyFactor()])
    setIsEditMode(true)
  }
  const removeFactor = (i: number) => setFactors(f => f.filter((_, idx) => idx !== i))
  const setF = (i: number, key: keyof Factor, val: any) =>
    setFactors(f => f.map((row, idx) => idx === i ? { ...row, [key]: val } : row))

  const handleToggleSelect = (index: number) => {
    setSelectedIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const handleDeleteSelected = () => {
    if (selectedIndices.length === 0) {
      toast('Select the checkbox next to each factor you want to delete.')
      return
    }
    const count = selectedIndices.length
    const remaining = factors.filter((_, idx) => !selectedIndices.includes(idx))
    setFactors(remaining)
    setSelectedIndices([])
    if (remaining.length === 0) {
      setIsEditMode(false)
    }
    toast.success(`Deleted ${count} ${count === 1 ? 'factor' : 'factors'}`)
  }

  const handleClearAll = () => {
    if (factors.length === 0) return
    setFactors([])
    setSelectedIndices([])
    setIsEditMode(false)
    toast.success('Cleared all process factors')
  }

  /* ── Responses helpers ─── */
  const addResponse = () => setResponses(r => [...r, emptyResponse()])
  const removeResponse = (i: number) => setResponses(r => r.filter((_, idx) => idx !== i))
  const setR = (i: number, key: keyof Response, val: any) =>
    setResponses(r => r.map((row, idx) => idx === i ? { ...row, [key]: val, inherited_from_target: false } : row))

  async function handleSave() {
    if (factors.length === 0) { toast.error('Please define at least one factor'); return }
    if (factors.some(f => !f.name.trim())) { toast.error('All factors need a name'); return }
    if (factors.some(f => f.high <= f.low)) { toast.error('High must be > Low for each factor'); return }
    if (responses.length === 0) { toast.error('Please define at least one response'); return }
    if (responses.some(r => !r.name.trim())) { toast.error('All responses need a name'); return }
    if (responses.some(r => isPercentageResponse(r) && r.target != null && r.target > 100)) {
      toast.error('Response target percentage cannot exceed 100%')
      return
    }
    if (responses.some(r => isPercentageResponse(r) && r.upper_limit != null && r.upper_limit > 100)) {
      toast.error('Response upper limit percentage cannot exceed 100%')
      return
    }
    setSaving(true)
    try {
      const id = currentProject!.id
      const savedFactors = await Projects.saveFactors(id, factors.map((f, i) => ({
        name: f.name.trim(),
        symbol: f.symbol || '',
        unit: f.unit.trim(),
        low: Number(f.low),
        high: Number(f.high),
        baseline: f.baseline ?? (Number(f.low) + Number(f.high)) / 2,
        factor_order: i,
        is_categorical: f.is_categorical || false
      })))
      const savedResponses = await Projects.saveResponses(id, responses.map((r, i) => ({
        name: simplifyResponseName(r.name.trim(), r.goal),
        unit: r.unit.trim(),
        goal: r.goal || 'maximize',
        target: r.target != null ? Number(r.target) : null,
        lower_limit: r.lower_limit != null ? Number(r.lower_limit) : null,
        upper_limit: r.upper_limit != null ? Number(r.upper_limit) : null,
        weight: r.weight != null ? Number(r.weight) : 1.0,
        resp_order: i
      })))
      const proj = await Projects.update(id, { current_step: 'recommend-doe' })
      setProject({ ...proj, factors: savedFactors, responses: savedResponses })
      toast.success('Factors & responses saved!')
      setStep('recommend-doe')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to save factors & responses')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'form-input'
  const factorGridCols = isEditMode ? '32px 2fr 1fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr'
  const factorInputStyle = !isEditMode ? {
    cursor: 'default',
    backgroundColor: 'rgba(241, 245, 249, 0.7)',
    color: 'var(--text-main)',
    borderColor: 'rgba(203, 213, 225, 0.6)'
  } : undefined

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Define Factors & Responses</h1>
        <p className="page-desc">Select what we will change and what we will measure in the experiments.</p>
      </div>

      {/* ── Factors ── */}
      <div className="card mb-2">
        <div className="flex-between mb-2" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div className="card-title">Process Factors</div>
            <div className="card-sub">Input variables to be varied in the experiment</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {!isEditMode ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditMode(true)}
                title="Edit factors (modify numbers, add, delete, or clear)"
                style={{
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDeleteSelected}
                  style={{
                    color: selectedIndices.length > 0 ? '#ef4444' : 'var(--danger)',
                    borderColor: 'rgba(239, 68, 68, 0.35)',
                    fontWeight: 600
                  }}
                  title={selectedIndices.length === 0 ? "Select factors using checkboxes to delete" : `Delete ${selectedIndices.length} selected factors`}
                >
                  Delete Factor {selectedIndices.length > 0 ? `(${selectedIndices.length})` : ''}
                </button>

                {factors.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleClearAll}
                    title="Clear all factors"
                  >
                    Clear All
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={addFactor}
                  title="Add a new factor"
                >
                  + Add Factor
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setIsEditMode(false)
                    setSelectedIndices([])
                  }}
                  style={{ fontWeight: 600 }}
                  title="Done editing"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>

        {factors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px', margin: '0.75rem 0' }}>
            <p style={{ margin: '0 0 0.75rem' }}>No factors defined yet. Click "+ Add Factor" or carry over Critical Process Parameters from Step 06.</p>
            <button className="btn btn-primary btn-sm" onClick={addFactor}>
              + Add First Factor
            </button>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: factorGridCols, gap: '0.75rem', marginBottom: '0.4rem', padding: '0 1rem', alignItems: 'center' }}>
              {isEditMode && <div style={{ width: '32px' }} />}
              {['Factor Name', 'Unit', 'Low', 'High', 'Baseline'].map(h => (
                <div key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>

            {factors.map((f, i) => {
              const isChecked = selectedIndices.includes(i)
              return (
                <div
                  key={i}
                  className="factor-row"
                  style={{
                    gridTemplateColumns: factorGridCols,
                    background: isChecked ? 'rgba(239, 68, 68, 0.04)' : undefined,
                    border: isChecked ? '1px solid rgba(239, 68, 68, 0.4)' : undefined
                  }}
                >
                  {isEditMode && (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleSelect(i)}
                      title={`Select ${f.name || `Factor ${i + 1}`} to delete`}
                      style={{ cursor: 'pointer', justifySelf: 'center', width: '15px', height: '15px' }}
                    />
                  )}
                  <input
                    className={inputCls}
                    placeholder="e.g. Temperature"
                    value={f.name}
                    readOnly={!isEditMode}
                    style={factorInputStyle}
                    onChange={e => setF(i, 'name', e.target.value)}
                  />
                  <input
                    className={inputCls}
                    placeholder="°C"
                    value={f.unit}
                    readOnly={!isEditMode}
                    style={factorInputStyle}
                    onChange={e => setF(i, 'unit', e.target.value)}
                  />
                  <input
                    className={inputCls}
                    type="number"
                    value={f.low}
                    readOnly={!isEditMode}
                    style={factorInputStyle}
                    onChange={e => setF(i, 'low', +e.target.value)}
                  />
                  <input
                    className={inputCls}
                    type="number"
                    value={f.high}
                    readOnly={!isEditMode}
                    style={factorInputStyle}
                    onChange={e => setF(i, 'high', +e.target.value)}
                  />
                  <input
                    className={inputCls}
                    type="number"
                    value={f.baseline ?? (f.low + f.high) / 2}
                    readOnly={!isEditMode}
                    style={factorInputStyle}
                    onChange={e => setF(i, 'baseline', +e.target.value)}
                  />
                </div>
              )
            })}
          </>
        )}

        <div className="alert alert-info mt-1">
          💡 Tip: Use 3–7 factors for a good DOE. Too many factors → consider Plackett-Burman for screening first.
        </div>
      </div>

      {/* ── Responses ── */}
      <div className="card">
        <div className="flex-between mb-2" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div className="card-title">Response Variables</div>
            <div className="card-sub">Output variables to measure after each experiment</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary btn-sm" onClick={addResponse}>+ Add Response</button>
          </div>
        </div>

        {responses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px', margin: '0.75rem 0' }}>
            No responses defined yet. Click "+ Add Response" to define CQAs.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 36px', gap: '0.5rem', marginBottom: '0.4rem', padding: '0 0.75rem' }}>
              {['Response Name', 'Unit', 'Goal', 'Target Value', ''].map(h => (
                <div key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>

            {responses.map((r, i) => (
              <div key={i} style={{ marginBottom: '0.5rem' }}>
                <div className="response-row">
                  <div>
                    <input className={inputCls} placeholder="e.g. Yield %" value={r.name}
                      onChange={e => setR(i, 'name', e.target.value)} />
                    {r.inherited_from_target && (
                      <div style={{ marginTop: '0.2rem' }}>
                        <span className="badge badge-accent" style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                          <span>🎯</span> Inherited from Project Description
                        </span>
                      </div>
                    )}
                  </div>
                  <input className={inputCls} placeholder="%" value={r.unit}
                    onChange={e => setR(i, 'unit', e.target.value)} />
                  <select className="form-select" value={r.goal}
                    onChange={e => setR(i, 'goal', e.target.value)}>
                    <option value="maximize">Maximize</option>
                    <option value="minimize">Minimize</option>
                    <option value="target">Hit Target</option>
                  </select>
                  <input className={inputCls} type="number" placeholder="Optional"
                    value={r.target ?? ''} onChange={e => setR(i, 'target', e.target.value ? +e.target.value : undefined)} />
                  <button style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => removeResponse(i)}>✕</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="step-nav" style={{ marginTop: '1.5rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() => {
            if (currentProject) {
              setProject({ ...currentProject, factors, responses })
            }
            setStep('stage-campaign-matrix')
          }}
        >
          ← Back to Stage Campaign Matrix
        </button>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{factors.length} factors · {responses.length} responses</span>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" />Saving…</> : 'Save & Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
