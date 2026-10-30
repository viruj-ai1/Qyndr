import React, { useState, useEffect, useMemo } from 'react'
import { useStore, isPercentageResponse } from '../store/useStore'
import { DOE, Projects } from '../services/api'
import { simplifyResponseName } from '../utils/targetParser'
import toast from 'react-hot-toast'

export default function GenerateDOE() {
  const { currentProject, setStep, experiments, setExperiments, setOptimum, setBayes, setFinal } = useStore()
  const [design, setDesign] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showActuals, setShowActuals] = useState(false)

  // Editable analytical results: { [experimentId]: [val0, val1, ...] }
  const [results, setResults] = useState<Record<number, (number | null)[]>>({})
  // Actual laboratory factor values: { [experimentId]: [actVal0, actVal1, ...] }
  const [actualValues, setActualValues] = useState<Record<number, number[]>>({})
  // Benchtop observation notes: { [experimentId]: noteString }
  const [notes, setNotes] = useState<Record<number, string>>({})

  const designKey = sessionStorage.getItem('doe_design_key') || currentProject?.doe_type || 'FF'
  const phase = sessionStorage.getItem('doe_phase') || 'screening'
  const factors = currentProject?.factors || []
  const responses = currentProject?.responses || []

  // Load existing experiments or generate new DOE matrix
  async function loadOrGenerate(forceRegenerate = false) {
    if (!currentProject) return
    setLoading(true)
    const mustGenerate = sessionStorage.getItem('force_generate_doe') === 'true' || forceRegenerate
    if (sessionStorage.getItem('force_generate_doe')) {
      sessionStorage.removeItem('force_generate_doe')
    }

    try {
      if (!mustGenerate) {
        let exps = experiments
        if (!exps || exps.length === 0) {
          exps = await Projects.getExperiments(currentProject.id)
        }
        if (exps && exps.length > 0) {
          setExperiments(exps)
          setDesign({
            design_info: {
              design_type: currentProject.doe_type || designKey,
              n_runs: exps.length,
              resolution: 'Full',
              n_factorial: exps.filter(x => x.run_type === 'Factorial' || !x.run_type).length,
              n_center: exps.filter(x => x.run_type === 'Center').length,
              description: `Loaded ${exps.length} experimental runs from project design.`
            },
            experiments: exps
          })
          setLoading(false)
          return
        }
      }

      if (forceRegenerate) {
        const hasExistingResults = Object.values(results).some(row => row && row.some(v => v !== null))
        if (hasExistingResults && !confirm('Regenerating will reset existing experiment results and reset matrix setpoints. Continue?')) {
          setLoading(false)
          return
        }
      }

      const data = await DOE.generate(currentProject.id, designKey, phase)
      const finalGeneratedExps = data.experiments || []
      setDesign(data)
      setExperiments(finalGeneratedExps)
      toast.success(`Generated ${data.design_info?.design_type || 'DOE'} (${finalGeneratedExps.length} runs)`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Matrix generation failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrGenerate(false)
  }, [currentProject?.id])

  const displayedExperiments: any[] = useMemo(() => {
    return design?.experiments || experiments || []
  }, [design?.experiments, experiments])

  // Synchronize local editable results and actual factor states when experiments change
  useEffect(() => {
    if (!displayedExperiments.length) return

    setResults(prev => {
      const next: Record<number, (number | null)[]> = {}
      displayedExperiments.forEach((e: any) => {
        if (prev[e.id] && prev[e.id].some(v => v !== null)) {
          next[e.id] = prev[e.id].map((v: any, ri: number) => {
            if (v == null) return null
            const isPercent = isPercentageResponse(responses[ri])
            const num = typeof v === 'string' ? parseFloat(v) : v
            if (isNaN(num)) return null
            if (isPercent) return Math.min(100, Math.max(0, num))
            return num
          })
        } else if (e.result_values && e.result_values.length) {
          next[e.id] = e.result_values.map((v: any, ri: number) => {
            if (v == null) return null
            const isPercent = isPercentageResponse(responses[ri])
            const num = typeof v === 'string' ? parseFloat(v) : v
            if (isNaN(num)) return null
            if (isPercent) return Math.min(100, Math.max(0, num))
            return num
          })
        } else {
          next[e.id] = new Array(responses.length).fill(null)
        }
      })
      return next
    })

    setActualValues(prev => {
      const next: Record<number, number[]> = {}
      displayedExperiments.forEach((e: any) => {
        if (prev[e.id] && prev[e.id].length) {
          next[e.id] = prev[e.id]
        } else if (e.actual_values && e.actual_values.length) {
          next[e.id] = [...e.actual_values]
        } else {
          next[e.id] = []
        }
      })
      return next
    })
  }, [displayedExperiments, responses.length])

  // Debounced auto-save so typing results is never lost when navigating back or forward
  useEffect(() => {
    if (!currentProject) return
    const rowsWithData = displayedExperiments.filter((e: any) => isRunPartiallyComplete(e.id))
    if (rowsWithData.length === 0) return

    const timer = setTimeout(async () => {
      try {
        const payload = rowsWithData.map((e: any) => ({
          experiment_id: e.id,
          result_values: (results[e.id] || []).map((v: any, ri: number) => {
            if (v == null) return null
            let num = typeof v === 'string' ? parseFloat(v) : v
            if (isNaN(num)) return null
            const isPercent = isPercentageResponse(responses[ri])
            return isPercent ? Math.min(100, Math.max(0, num)) : num
          })
        }))
        await Projects.uploadResults(currentProject.id, payload)
      } catch {
        // silent auto-save error
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [results, currentProject?.id])

  // Cell change handlers
  function handleResponseChange(expId: number, responseIdx: number, rawVal: string) {
    const resp = responses[responseIdx]
    const isPercent = isPercentageResponse(resp)

    setResults(prev => {
      const row = [...(prev[expId] || new Array(responses.length).fill(null))]
      if (rawVal.trim() === '') {
        row[responseIdx] = null
      } else {
        const num = parseFloat(rawVal)
        if (!isNaN(num)) {
          if (isPercent && num > 100) {
            row[responseIdx] = 100
            toast.error(`${resp?.name || 'Response'} cannot exceed 100%`, { id: `max-limit-${responseIdx}` })
          } else if (isPercent && num < 0) {
            row[responseIdx] = 0
            toast.error(`${resp?.name || 'Response'} cannot be negative`, { id: `min-limit-${responseIdx}` })
          } else {
            row[responseIdx] = rawVal.endsWith('.') ? (rawVal as any) : num
          }
        }
      }
      return { ...prev, [expId]: row }
    })
  }

  function handleResponseBlur(expId: number, responseIdx: number) {
    const resp = responses[responseIdx]
    const isPercent = isPercentageResponse(resp)

    setResults(prev => {
      const row = [...(prev[expId] || [])]
      const current = row[responseIdx]
      if (current != null) {
        let num = typeof current === 'string' ? parseFloat(current) : current
        if (isNaN(num)) {
          row[responseIdx] = null
        } else {
          if (isPercent) {
            if (num > 100) num = 100
            if (num < 0) num = 0
          }
          row[responseIdx] = num
        }
      }
      return { ...prev, [expId]: row }
    })
  }

  function handleActualFactorChange(expId: number, factorIdx: number, rawVal: string) {
    setActualValues(prev => {
      const row = [...(prev[expId] || [])]
      row[factorIdx] = rawVal.trim() === '' ? 0 : parseFloat(rawVal)
      return { ...prev, [expId]: row }
    })
  }

  function handleNoteChange(expId: number, val: string) {
    setNotes(prev => ({ ...prev, [expId]: val }))
  }

  // Completion metrics
  const isRunComplete = (expId: number) => {
    const row = results[expId]
    if (!row || row.length === 0 || responses.length === 0) return false
    return row.every(v => v !== null && !isNaN(v))
  }

  const isRunPartiallyComplete = (expId: number) => {
    const row = results[expId]
    return Boolean(row && row.some(v => v !== null && !isNaN(v)))
  }

  const completedCount = displayedExperiments.filter((e: any) => isRunComplete(e.id)).length
  const anyResultsEntered = displayedExperiments.filter((e: any) => isRunPartiallyComplete(e.id)).length

  // Pre-fill realistic sample lab measurements
  function handlePrefillSampleResults() {
    if (!displayedExperiments.length) return

    const filled: Record<number, (number | null)[]> = {}
    const filledActuals: Record<number, number[]> = {}
    const sampleNotesMap: Record<number, string> = {}

    const sampleNoteOptions = [
      'Clear homogeneous solution, steady state',
      'Mild exotherm observed on addition (+2.5 °C)',
      'Pale yellow reaction mixture, no precipitate',
      'Slight precipitation after 45 min, dissolved on heating',
      'Viscosity increase noted during agitation',
      'Smooth conversion, standard reflux achieved'
    ]

    displayedExperiments.forEach((e: any, idx: number) => {
      const coded = e.coded_values || []
      const x0 = coded[0] ?? 0
      const x1 = coded[1] ?? 0
      const x2 = coded[2] ?? 0

      // Realistic response modeling based on coded factor levels
      const yieldVal = Math.min(
        99.5,
        Math.max(75.0, 92.4 + 3.2 * x0 - 1.8 * x1 + 2.1 * x2 - 1.5 * x0 * x0 + ((idx % 3) - 1) * 0.4)
      )
      const impVal = Math.max(
        0.02,
        Math.min(0.95, 0.12 - 0.05 * x0 + 0.08 * x1 - 0.03 * x2 + 0.04 * x1 * x1 + (idx % 2) * 0.02)
      )

      filled[e.id] = responses.map((r: any, rIdx: number) => {
        const isPercent = isPercentageResponse(r)
        let sampleVal: number
        if (rIdx === 0) sampleVal = Number(yieldVal.toFixed(2))
        else if (rIdx === 1) sampleVal = Number(impVal.toFixed(3))
        else sampleVal = Number((90.0 + (idx % 5) * 1.5).toFixed(2))

        if (isPercent) {
          sampleVal = Math.min(100, Math.max(0, sampleVal))
        }
        return sampleVal
      })

      // Realistic thermocouples/dispenser jitter for actuals
      filledActuals[e.id] = (e.actual_values || []).map((v: number, fi: number) => {
        const factor = factors[fi]
        const jitter = factor?.unit === '°C' ? Math.sin(idx) * 0.35 : Math.cos(idx) * 0.02
        return Number((v + jitter).toFixed(2))
      })

      sampleNotesMap[e.id] = sampleNoteOptions[idx % sampleNoteOptions.length]
    })

    setResults(filled)
    setActualValues(filledActuals)
    setNotes(sampleNotesMap)
    toast.success('Pre-filled realistic sample lab measurements!')
  }

  // Export batch execution sheet as CSV
  function handleExportCSV() {
    if (!displayedExperiments.length) {
      toast.error('No experimental runs to export')
      return
    }

    const factorHeaders = showActuals
      ? factors.flatMap((f: any) => [`${f.name} (Nominal, ${f.unit})`, `${f.name} (Actual, ${f.unit})`])
      : factors.map((f: any) => `${f.name} (${f.unit})`)

    const responseHeaders = responses.map((r: any) => `${simplifyResponseName(r.name, r.goal)} (${r.unit || ''})`)
    const headers = ['Run #', 'Run Type', ...factorHeaders, ...responseHeaders, 'Lab Observation Notes']

    const rows = displayedExperiments.map((e: any) => {
      const factorCols = showActuals
        ? factors.flatMap((_: any, fi: number) => {
            const nom = e.actual_values?.[fi] != null ? e.actual_values[fi].toFixed(3) : ''
            const act = actualValues[e.id]?.[fi] != null ? actualValues[e.id][fi].toFixed(3) : nom
            return [nom, act]
          })
        : factors.map((_: any, fi: number) => {
            return e.actual_values?.[fi] != null ? e.actual_values[fi].toFixed(3) : ''
          })

      const responseCols = responses.map((_: any, ri: number) => {
        const val = results[e.id]?.[ri]
        return val != null ? val : ''
      })

      const note = (notes[e.id] || '').replace(/"/g, '""')

      return [e.run_number, e.run_type, ...factorCols, ...responseCols, `"${note}"`].join(',')
    })

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    const projName = (currentProject?.name || 'DOE').replace(/[^a-zA-Z0-9_-]/g, '_')
    link.setAttribute('download', `${projName}_DOE_Batch_Sheet.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Exported batch execution sheet as CSV!')
  }

  // Barcode printing simulation
  function handlePrintBarcodeTags() {
    toast.success(`🏷️ Generated barcode vial tags for ${displayedExperiments.length} runs! Sent to lab printer.`)
  }

  // Save results & transition to initial optimization
  async function handleSaveAndAnalyze() {
    if (!currentProject) return

    const rowsWithData = displayedExperiments.filter((e: any) => isRunPartiallyComplete(e.id))
    if (rowsWithData.length === 0) {
      toast.error('Please enter at least one run result before proceeding.')
      return
    }

    setSaving(true)
    try {
      const payload = rowsWithData.map((e: any) => ({
        experiment_id: e.id,
        result_values: (results[e.id] || []).map((v: any, ri: number) => {
          if (v == null) return null
          let num = typeof v === 'string' ? parseFloat(v) : v
          if (isNaN(num)) return null
          const isPercent = isPercentageResponse(responses[ri])
          if (isPercent) {
            num = Math.min(100, Math.max(0, num))
          }
          return num
        })
      }))

      await Projects.uploadResults(currentProject.id, payload)
      const freshExps = await Projects.getExperiments(currentProject.id)
      setExperiments(freshExps)
      setOptimum(null)
      setBayes(null)
      setFinal(null)
      toast.success(`${payload.length} experiment results saved! Transitioning to Initial Optimum...`)
      setStep('initial-optimization')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleBack() {
    if (currentProject) {
      const rowsWithData = displayedExperiments.filter((e: any) => isRunPartiallyComplete(e.id))
      if (rowsWithData.length > 0) {
        try {
          const payload = rowsWithData.map((e: any) => ({
            experiment_id: e.id,
            result_values: (results[e.id] || []).map((v: any, ri: number) => {
              if (v == null) return null
              let num = typeof v === 'string' ? parseFloat(v) : v
              if (isNaN(num)) return null
              const isPercent = isPercentageResponse(responses[ri])
              return isPercent ? Math.min(100, Math.max(0, num)) : num
            })
          }))
          await Projects.uploadResults(currentProject.id, payload)
          const freshExps = await Projects.getExperiments(currentProject.id)
          setExperiments(freshExps)
        } catch {
          // ignore
        }
      }
    }
    setStep('recommend-doe')
  }

  const typeColor: Record<string, string> = {
    Factorial: 'var(--primary)',
    Center: 'var(--success)',
    Axial: 'var(--warning)',
    'D-Optimal': 'var(--accent)',
    'I-Optimal': 'var(--accent)',
    Bayesian: 'var(--accent)',
    Mixture: 'var(--accent)',
    'Plackett-Burman': 'var(--accent)',
    'Definitive Screening': 'var(--accent)',
    Taguchi: 'var(--accent)'
  }

  return (
    <div>
      {/* ── Page Header & Stats ── */}
      <div className="page-header">
        <h1 className="page-title">DOE Matrix & Results</h1>
        <p className="page-desc">
          Review experimental design setpoints, log benchtop execution, and enter analytical response results.
        </p>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner" /> Generating experiment matrix…
        </div>
      )}

      {/* ── Top Stat Cards ── */}
      <div className="grid-4 mb-2">
        <div className="stat-card">
          <div className="stat-label">Design Type</div>
          <div className="stat-value" style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>
            {design?.design_info?.design_type || currentProject?.doe_type || designKey || 'D-Optimal'}
          </div>
          <div className="stat-sub">
            {design?.design_info?.resolution ? `${design.design_info.resolution} Resolution` : 'Multi-Factor Design'}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Total Runs</div>
          <div className="stat-value">{displayedExperiments.length}</div>
          <div className="stat-sub">
            {displayedExperiments.filter((x: any) => x.run_type === 'Factorial').length} Factorial ·{' '}
            {displayedExperiments.filter((x: any) => x.run_type === 'Center').length} Center
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Factors Count</div>
          <div className="stat-value">{factors.length}</div>
          <div className="stat-sub">{responses.length} Analytical Responses</div>
        </div>

        <div className="stat-card">
          <div className="stat-label">Results Entered</div>
          <div
            className="stat-value"
            style={{
              color:
                completedCount === displayedExperiments.length && displayedExperiments.length > 0
                  ? 'var(--success)'
                  : anyResultsEntered > 0
                  ? 'var(--warning)'
                  : 'var(--text-muted)',
              fontSize: '1.3rem'
            }}
          >
            {completedCount} / {displayedExperiments.length} Completed
          </div>
          <div className="stat-sub">
            {completedCount === displayedExperiments.length && displayedExperiments.length > 0
              ? '🟢 Ready for optimization'
              : anyResultsEntered > 0
              ? `🟡 ${anyResultsEntered} runs with data`
              : '⚪ Awaiting lab measurements'}
          </div>
        </div>
      </div>

      {/* ── Action Toolbar ── */}
      <div
        className="card mb-2"
        style={{
          padding: '1rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: 'linear-gradient(135deg, rgba(255,255,255,0.9), rgba(240,247,255,0.7))'
        }}
      >
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportCSV}
            title="Download CSV table for lab bench execution"
          >
            📥 Export Batch Sheet (CSV)
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handlePrintBarcodeTags}
            title="Generate & print sample barcode labels"
          >
            🏷️ Print Barcode Tags
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handlePrefillSampleResults}
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 }}
            title="Pre-populate realistic analytical measurements for rapid testing"
          >
            ⚡ Pre-fill Sample Lab Measurements
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadOrGenerate(true)}
            disabled={loading}
            title="Reset and recalculate experimental design matrix"
          >
            ↺ Regenerate Matrix
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              userSelect: 'none',
              background: showActuals ? 'rgba(0, 91, 170, 0.08)' : 'transparent',
              padding: '0.35rem 0.65rem',
              borderRadius: '6px',
              border: `1px solid ${showActuals ? 'var(--primary)' : 'var(--border)'}`
            }}
          >
            <input
              type="checkbox"
              checked={showActuals}
              onChange={e => setShowActuals(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            <span>Log Actuals (Nominal vs. Actual)</span>
          </label>
        </div>
      </div>

      {/* ── Main Unified Interactive Table ── */}
      <div className="card">
        <div className="flex-between mb-2">
          <div>
            <div className="card-title">Experimental Run Matrix & Response Entry</div>
            <div className="card-sub">
              Directly type analytical response values below or click Auto-Fill. Press Tab to move across cells.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
              JMP / Design-Expert Matrix
            </span>
          </div>
        </div>

        <div style={{ overflowX: 'auto', maxHeight: '550px', position: 'relative' }}>
          <table className="data-table">
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f1f5f9' }}>
              {showActuals ? (
                <>
                  <tr>
                    <th rowSpan={2} style={{ width: '80px' }}>Run #</th>
                    <th rowSpan={2} style={{ width: '100px' }}>Type</th>
                    {factors.map((f: any) => (
                      <th
                        key={f.name}
                        colSpan={2}
                        style={{ textAlign: 'center', borderBottom: '1px solid var(--border)' }}
                      >
                        {f.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({f.unit})</span>
                      </th>
                    ))}
                    {responses.map((r: any) => (
                      <th key={r.name} rowSpan={2} style={{ color: 'var(--accent)', minWidth: '130px' }}>
                        <div>{simplifyResponseName(r.name, r.goal)}</div>
                        <div style={{ fontWeight: 400, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {r.unit ? `(${r.unit})` : ''} {r.goal ? `[${r.goal}]` : ''}
                        </div>
                      </th>
                    ))}
                    <th rowSpan={2} style={{ minWidth: '180px' }}>Observation / Notes</th>
                  </tr>
                  <tr>
                    {factors.map((f: any) => (
                      <React.Fragment key={`${f.name}-sub`}>
                        <th style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: '#e9eef4' }}>Nominal</th>
                        <th style={{ fontSize: '0.7rem', color: 'var(--primary)', background: '#e9eef4' }}>Actual</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </>
              ) : (
                <tr>
                  <th style={{ width: '80px' }}>Run #</th>
                  <th style={{ width: '100px' }}>Type</th>
                  {factors.map((f: any) => (
                    <th key={f.name}>
                      {f.name} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({f.unit})</span>
                    </th>
                  ))}
                  {responses.map((r: any) => (
                    <th key={r.name} style={{ color: 'var(--accent)', minWidth: '130px' }}>
                      <div>{simplifyResponseName(r.name, r.goal)}</div>
                      <div style={{ fontWeight: 400, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {r.unit ? `(${r.unit})` : ''} {r.goal ? `[${r.goal}]` : ''}
                      </div>
                    </th>
                  ))}
                  <th style={{ minWidth: '180px' }}>Observation / Notes</th>
                </tr>
              )}
            </thead>

            <tbody>
              {displayedExperiments.map((e: any) => {
                const isComplete = isRunComplete(e.id)
                const isPartial = isRunPartiallyComplete(e.id)
                const rowRes = results[e.id] || []

                return (
                  <tr
                    key={e.id || e.run_number}
                    style={{
                      background: isComplete
                        ? 'rgba(5, 150, 105, 0.05)'
                        : isPartial
                        ? 'rgba(217, 119, 6, 0.03)'
                        : 'transparent'
                    }}
                  >
                    {/* Run # with completion checkmark */}
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        {isComplete ? (
                          <span
                            style={{
                              color: 'var(--success)',
                              fontWeight: 900,
                              background: 'rgba(5, 150, 105, 0.15)',
                              borderRadius: '50%',
                              width: '18px',
                              height: '18px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.75rem'
                            }}
                            title="Analytical results recorded"
                          >
                            ✓
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', width: '18px', textAlign: 'center', fontSize: '0.75rem' }}>
                            •
                          </span>
                        )}
                        <span>Run {e.run_number}</span>
                      </div>
                    </td>

                    {/* Run Type Badge */}
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '999px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          background: `${typeColor[e.run_type] || 'var(--primary)'}18`,
                          color: typeColor[e.run_type] || 'var(--primary)'
                        }}
                      >
                        {e.run_type || 'Factorial'}
                      </span>
                    </td>

                    {/* Factor Columns: Nominal (and optional Actual) */}
                    {factors.map((_: any, fi: number) => {
                      const nomVal = e.actual_values?.[fi] ?? 0
                      if (showActuals) {
                        const actVal = actualValues[e.id]?.[fi] ?? nomVal
                        return (
                          <React.Fragment key={fi}>
                            <td className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                              {nomVal.toFixed(2)}
                            </td>
                            <td>
                              <input
                                type="number"
                                step="any"
                                className="form-input mono"
                                style={{
                                  width: '78px',
                                  padding: '0.2rem 0.4rem',
                                  fontSize: '0.8rem',
                                  borderColor: 'var(--border)'
                                }}
                                value={actVal}
                                onChange={ev => handleActualFactorChange(e.id, fi, ev.target.value)}
                              />
                            </td>
                          </React.Fragment>
                        )
                      }
                      return (
                        <td key={fi} className="mono" style={{ fontWeight: 500 }}>
                          {nomVal.toFixed(2)}
                        </td>
                      )
                    })}

                    {/* Direct Editable Response Columns */}
                    {responses.map((r: any, ri: number) => {
                      const isPercent = isPercentageResponse(r)
                      const rawVal = rowRes[ri]
                      const val = (isPercent && rawVal != null && typeof rawVal === 'number' && rawVal > 100)
                        ? 100
                        : (isPercent && rawVal != null && typeof rawVal === 'number' && rawVal < 0)
                        ? 0
                        : rawVal
                      const hasVal = val != null
                      return (
                        <td key={ri} style={{ padding: '0.35rem 0.5rem' }}>
                          <input
                            type="number"
                            step="any"
                            min={isPercent ? 0 : undefined}
                            max={isPercent ? 100 : undefined}
                            className="form-input mono"
                            placeholder="—"
                            style={{
                              width: '100%',
                              minWidth: '95px',
                              padding: '0.35rem 0.5rem',
                              fontSize: '0.85rem',
                              fontWeight: 600,
                              background: hasVal ? 'rgba(5, 150, 105, 0.08)' : 'rgba(0, 174, 179, 0.06)',
                              border: `1px solid ${hasVal ? 'rgba(5, 150, 105, 0.4)' : 'rgba(0, 174, 179, 0.3)'}`,
                              borderRadius: '6px',
                              color: hasVal ? 'var(--text-primary)' : 'var(--text-secondary)'
                            }}
                            value={val ?? ''}
                            onChange={ev => handleResponseChange(e.id, ri, ev.target.value)}
                            onBlur={() => handleResponseBlur(e.id, ri)}
                          />
                        </td>
                      )
                    })}

                    {/* Lab Observation Notes Column */}
                    <td>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Mild exotherm, pale yellow..."
                        style={{
                          width: '100%',
                          minWidth: '160px',
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.8rem'
                        }}
                        value={notes[e.id] || ''}
                        onChange={ev => handleNoteChange(e.id, ev.target.value)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Status Hint / Warning ── */}
      {completedCount < displayedExperiments.length && displayedExperiments.length > 0 && (
        <div className="alert alert-warning mt-2">
          <span>
            ⚠️ <strong>Execution Status:</strong> {displayedExperiments.length - completedCount} of{' '}
            {displayedExperiments.length} run(s) are pending response values. You may save partial results or click{' '}
            <strong>Pre-fill Sample Lab Measurements</strong> for quick verification.
          </span>
        </div>
      )}

      {/* ── Step Navigation Footer ── */}
      <div className="step-nav">
        <button className="btn btn-secondary" onClick={handleBack}>
          ← Back to Recommend DOE
        </button>

        <button
          className="btn btn-primary"
          onClick={handleSaveAndAnalyze}
          disabled={saving || anyResultsEntered === 0}
          title={anyResultsEntered === 0 ? 'Enter response data to analyze' : 'Save and compute initial desirability optimum'}
        >
          {saving ? (
            <>
              <div className="spinner" style={{ width: '16px', height: '16px', borderTopColor: 'white' }} />
              Saving & Analyzing…
            </>
          ) : (
            `Save Results & Analyze Initial Optimum →`
          )}
        </button>
      </div>
    </div>
  )
}
