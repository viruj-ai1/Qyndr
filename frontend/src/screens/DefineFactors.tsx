import { useState, useEffect, useRef } from 'react'
import { useStore, Factor, Response, isPercentageResponse } from '../store/useStore'
import { Projects } from '../services/api'
import toast from 'react-hot-toast'

const emptyFactor = (): Factor => ({ name: '', unit: '', low: 0, high: 1, baseline: 0.5 })
const emptyResponse = (): Response => ({ name: '', unit: '', goal: 'maximize' })

export default function DefineFactors() {
  const { currentProject, setProject, setStep } = useStore()

  const [factors, setFactors] = useState<Factor[]>(() => {
    if (currentProject?.factors && currentProject.factors.length > 0) {
      return currentProject.factors
    }
    // Start clean from scratch for new projects
    return []
  })

  const [responses, setResponses] = useState<Response[]>(() => {
    if (currentProject?.responses && currentProject.responses.length > 0) {
      return currentProject.responses.filter((r: any) => !['impurity b', 'impurity c'].includes(r.name.toLowerCase().trim()))
    }
    // Start clean from scratch for new projects
    return []
  })

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

  /* ── Factors helpers ─── */
  const addFactor = () => setFactors(f => [...f, emptyFactor()])
  const removeFactor = (i: number) => setFactors(f => f.filter((_, idx) => idx !== i))
  const setF = (i: number, key: keyof Factor, val: any) =>
    setFactors(f => f.map((row, idx) => idx === i ? { ...row, [key]: val } : row))

  /* ── Responses helpers ─── */
  const addResponse = () => setResponses(r => [...r, emptyResponse()])
  const removeResponse = (i: number) => setResponses(r => r.filter((_, idx) => idx !== i))
  const setR = (i: number, key: keyof Response, val: any) =>
    setResponses(r => r.map((row, idx) => idx === i ? { ...row, [key]: val } : row))

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
        <div className="flex-between mb-2">
          <div>
            <div className="card-title">Response Variables</div>
            <div className="card-sub">Output variables to measure after each experiment</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={addResponse}>+ Add Response</button>
        </div>

        {responses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px', margin: '0.75rem 0' }}>
            No responses defined yet. Click "+ Add Response" to specify output variables to measure.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 36px', gap: '0.5rem', marginBottom: '0.4rem', padding: '0 0.75rem' }}>
              {['Response Name', 'Unit', 'Goal', 'Target', ''].map(h => (
                <div key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>

            {responses.map((r, i) => (
              <div key={i} className="response-row">
                <input className={inputCls} placeholder="e.g. Yield %" value={r.name}
                  onChange={e => setR(i, 'name', e.target.value)} />
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
            ))}
          </>
        )}
      </div>

      <div className="step-nav">
        <button
          className="btn btn-secondary"
          onClick={() => {
            if (currentProject) {
              setProject({ ...currentProject, factors, responses })
            }
            setStep('campaign-dashboard')
          }}
        >
          ← Back to Campaign Dashboard
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
