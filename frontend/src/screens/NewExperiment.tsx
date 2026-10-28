import { useState, useEffect } from 'react'
import { useStore, isPercentageResponse } from '../store/useStore'
import { Projects, Optimization } from '../services/api'
import toast from 'react-hot-toast'

export default function NewExperiment() {
  const { currentProject, bayesResult, setStep, setBayes } = useStore()
  const factors   = currentProject?.factors   || []
  const responses = currentProject?.responses || []
  const rec       = bayesResult?.recommendation
  const iteration = bayesResult?.iteration ?? 0

  const [results, setResults] = useState<(number|null)[]>(new Array(responses.length).fill(null))
  const [saving, setSaving]   = useState(false)

  useEffect(() => {
    if (!bayesResult && currentProject) {
      Optimization.latest(currentProject.id)
        .then(setBayes)
        .catch(() => toast.error('Failed to load recommendation details'))
    }
  }, [bayesResult, currentProject, setBayes])

  function setVal(i: number, val: string) {
    const resp = responses[i]
    const isPercent = isPercentageResponse(resp)

    setResults(r => r.map((v, idx) => {
      if (idx !== i) return v
      if (val.trim() === '') return null
      const num = parseFloat(val)
      if (isNaN(num)) return v
      if (isPercent && num > 100) {
        toast.error(`${resp?.name || 'Response'} cannot exceed 100%`, { id: `bayes-max-${i}` })
        return 100
      }
      if (isPercent && num < 0) {
        toast.error(`${resp?.name || 'Response'} cannot be negative`, { id: `bayes-min-${i}` })
        return 0
      }
      return val.endsWith('.') ? (val as any) : num
    }))
  }

  async function handleSave() {
    if (results.every(v => v === null)) { toast.error('Enter at least one result'); return }
    const actuals = rec?.actual_values || []
    if (actuals.length === 0) {
      toast.error('Missing recommendation values. Please refresh or refit the GP model.')
      return
    }
    setSaving(true)
    try {
      const sanitizedResults = results.map((v: any, idx: number) => {
        if (v == null) return null
        let num = typeof v === 'string' ? parseFloat(v) : v
        if (isNaN(num)) return null
        const isPercent = isPercentageResponse(responses[idx])
        if (isPercent) {
          num = Math.min(100, Math.max(0, num))
        }
        return num
      })

      await Projects.bayesResult(currentProject!.id, {
        project_id: currentProject!.id,
        iteration,
        result_values: sanitizedResults,
        actual_values: actuals
      })
      const freshExps = await Projects.getExperiments(currentProject!.id)
      useStore.getState().setExperiments(freshExps)
      toast.success('Result saved! GP model will be updated.')
      setBayes(null) // clear old iteration recommendation
      setStep('more-improvement')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally { setSaving(false) }
  }


  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">New Experiment</h1>
        <p className="page-desc">Do the new experiment and add its results.</p>
      </div>

      {/* Conditions to set */}
      <div className="card mb-2">
        <div className="card-title mb-2">📋 Laboratory Conditions to Set</div>
        <table className="data-table">
          <thead><tr><th>Factor</th><th>Unit</th><th style={{ color:'var(--accent)' }}>Set Value</th></tr></thead>
          <tbody>
            {factors.map((f: any, i: number) => (
              <tr key={i}>
                <td style={{ fontWeight:600 }}>{f.name}</td>
                <td style={{ color:'var(--text-muted)' }}>{f.unit}</td>
                <td className="mono" style={{ color:'var(--accent)', fontWeight:700, fontSize:'1rem' }}>
                  {rec?.actual_values?.[i]?.toFixed(4) || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Results entry */}
      <div className="card">
        <div className="card-title mb-2">📥 Enter Measured Results</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
          {responses.map((r: any, i: number) => {
            const isPercent = isPercentageResponse(r)
            const rawVal = results[i]
            const val = (isPercent && rawVal != null && typeof rawVal === 'number' && rawVal > 100)
              ? 100
              : (isPercent && rawVal != null && typeof rawVal === 'number' && rawVal < 0)
              ? 0
              : rawVal
            return (
              <div key={i} className="form-group">
                <label className="form-label">{r.name} {r.unit && `(${r.unit})`} — Goal: {r.goal}</label>
                <input
                  type="number"
                  step="any"
                  min={isPercent ? 0 : undefined}
                  max={isPercent ? 100 : undefined}
                  className="form-input"
                  placeholder={`Measured ${r.name}…`}
                  value={val ?? ''}
                  onChange={e => setVal(i, e.target.value)}
                  style={{ fontFamily:'JetBrains Mono, monospace', fontSize:'1.1rem' }}
                />
              </div>
            )
          })}
        </div>

        {rec?.predicted_mean != null && (
          <div className="alert alert-info mt-2">
            🎯 GP predicted: <strong>{rec.predicted_mean?.toFixed(3)}</strong> (95% CI: [{rec.confidence_95?.[0]?.toFixed(3)}, {rec.confidence_95?.[1]?.toFixed(3)}])
          </div>
        )}
      </div>

      <div className="step-nav">
        <button className="btn btn-secondary" onClick={() => setStep('bayesian-opt')}>← Back</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || results.every(v => v===null)}>
          {saving ? <><div className="spinner"/>Saving…</> : 'Save Result & Update Model →'}
        </button>
      </div>
    </div>
  )
}
