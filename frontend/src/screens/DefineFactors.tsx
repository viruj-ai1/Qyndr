import { useState, useEffect, useRef } from 'react'
import { useStore, Factor, Response, isPercentageResponse } from '../store/useStore'
import { Projects } from '../services/api'
import { mapTargetToResponse, extractResponsesFromDescription } from '../utils/targetParser'
import toast from 'react-hot-toast'

const emptyFactor = (): Factor => ({ name: '', unit: '', low: 0, high: 1, baseline: 0.5 })
const emptyResponse = (): Response => ({ name: '', unit: '', goal: 'maximize' })

export default function DefineFactors() {
  const { currentProject, apiTargets, setProject, setStep } = useStore()

  const [factors, setFactors] = useState<Factor[]>(() => {
    if (currentProject?.factors && currentProject.factors.length > 0) {
      return currentProject.factors
    }
    return []
  })

  // Pre-seed responses: Use existing project responses if present, else auto-extract from Project Description / api_targets
  const getInitialResponses = (): Response[] => {
    if (currentProject?.responses && currentProject.responses.length > 0) {
      const filtered = currentProject.responses.filter((r: any) => !['impurity b', 'impurity c'].includes(r.name.toLowerCase().trim()))
      if (filtered.length > 0) return filtered
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
  const [saving, setSaving] = useState(false)
  const isFirstMount = useRef(true)

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
  const addFactor = () => setFactors(f => [...f, emptyFactor()])
  const removeFactor = (i: number) => setFactors(f => f.filter((_, idx) => idx !== i))
  const setF = (i: number, key: keyof Factor, val: any) =>
    setFactors(f => f.map((row, idx) => idx === i ? { ...row, [key]: val } : row))

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
        name: r.name.trim(),
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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Define Factors & Responses</h1>
        <p className="page-desc">Select what we will change and what we will measure in the experiments.</p>
      </div>

      {/* ── Factors ── */}
      <div className="card mb-2">
        <div className="flex-between mb-2">
          <div>
            <div className="card-title">Process Factors</div>
            <div className="card-sub">Input variables to be varied in the experiment</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={addFactor}>+ Add Factor</button>
        </div>

        {factors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px', margin: '0.75rem 0' }}>
            No factors defined yet. Click "+ Add Factor" or carry over Critical Process Parameters from Step 06.
          </div>
        ) : (
          <>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 36px', gap: '0.5rem', marginBottom: '0.4rem', padding: '0 0.75rem' }}>
              {['Factor Name', 'Unit', 'Low', 'High', 'Baseline', ''].map(h => (
                <div key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>

            {factors.map((f, i) => (
              <div key={i} className="factor-row">
                <input className={inputCls} placeholder="e.g. Temperature" value={f.name}
                  onChange={e => setF(i, 'name', e.target.value)} />
                <input className={inputCls} placeholder="°C" value={f.unit}
                  onChange={e => setF(i, 'unit', e.target.value)} />
                <input className={inputCls} type="number" value={f.low}
                  onChange={e => setF(i, 'low', +e.target.value)} />
                <input className={inputCls} type="number" value={f.high}
                  onChange={e => setF(i, 'high', +e.target.value)} />
                <input className={inputCls} type="number" value={f.baseline ?? (f.low + f.high) / 2}
                  onChange={e => setF(i, 'baseline', +e.target.value)} />
                <button style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => removeFactor(i)}>✕</button>
              </div>
            ))}
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
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleSyncFromProjectDescription}
              title="Auto-fill response variables directly from Step 01 Project Description"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span>⚡</span> Sync / Auto-fill from Project Description
            </button>
            <button className="btn btn-secondary btn-sm" onClick={addResponse}>+ Add Response</button>
          </div>
        </div>

        {responses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px', margin: '0.75rem 0' }}>
            No responses defined yet. Click "+ Add Response" or use "⚡ Sync / Auto-fill from Project Description".
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
