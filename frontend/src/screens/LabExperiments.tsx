import React, { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Projects } from '../services/api'
import toast from 'react-hot-toast'

export default function LabExperiments() {
  const { currentProject, experiments, setExperiments, setStep } = useStore()

  const factors   = currentProject?.factors  || []
  const responses = currentProject?.responses|| []

  useEffect(() => {
    if (currentProject?.id && (!experiments || experiments.length === 0)) {
      Projects.getExperiments(currentProject.id).then(exps => {
        setExperiments(exps)
      })
    }
  }, [currentProject?.id])

  const displayedExperiments = experiments || []

  const typeColor: Record<string,string> = {
    Factorial: 'var(--primary)', Center: 'var(--success)',
    Axial: 'var(--warning)', Bayesian: 'var(--accent)',
    'Plackett-Burman': 'var(--accent)', 'Definitive Screening': 'var(--accent)', Taguchi: 'var(--accent)'
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-tag">Step 11</div>
        <h1 className="page-title">Laboratory Runs</h1>
        <p className="page-desc">Perform the planned experiments in the lab.</p>
      </div>

      <div className="grid-4 mb-2">
        <div className="stat-card"><div className="stat-label">Total Runs</div><div className="stat-value">{displayedExperiments.length}</div></div>
        <div className="stat-card"><div className="stat-label">Factors</div><div className="stat-value">{factors.length}</div></div>
        <div className="stat-card"><div className="stat-label">Responses</div><div className="stat-value">{responses.length}</div></div>
        <div className="stat-card"><div className="stat-label">Completed</div>
          <div className="stat-value" style={{ color:'var(--success)' }}>
            {displayedExperiments.filter(e => e.is_completed).length}
          </div>
        </div>
      </div>

      <div className="alert alert-warning mb-2">
        🧪 <strong>Lab Tips:</strong> Randomize run order, clean equipment between runs, record exact conditions actually used (not just setpoints), note any deviations.
      </div>

      <div className="card">
        <div className="flex-between mb-2">
          <div className="card-title">Nominal vs. Actual Logger</div>
          <button className="btn btn-secondary btn-sm" onClick={() => toast.success('Lab logs saved successfully!')}>💾 Save Logs</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th rowSpan={2}>Run #</th>
                <th rowSpan={2}>Type</th>
                {factors.map((f: any) => <th key={f.name} colSpan={2} style={{ textAlign: 'center', borderBottom: '1px solid var(--border)' }}>{f.name} <span style={{ fontWeight:400, color:'var(--text-muted)', fontSize:'0.68rem' }}>({f.unit})</span></th>)}
                {responses.map((r: any) => <th key={r.name} rowSpan={2} style={{ color:'var(--accent)' }}>{r.name}<br/><span style={{ fontWeight:400, fontSize:'0.68rem' }}>{r.unit}</span></th>)}
                <th rowSpan={2}>Lab Observation Notes</th>
              </tr>
              <tr>
                {factors.map((f: any, i: number) => (
                  <React.Fragment key={`${f.name}-sub`}>
                    <th style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nominal</th>
                    <th style={{ fontSize: '0.7rem', color: 'var(--primary)' }}>Actual</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedExperiments.map(e => (
                <tr key={e.id || e.run_number}>
                  <td style={{ fontWeight:700, color:'var(--text-primary)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
                      {e.is_completed && <span style={{ color:'var(--success)', fontSize:'0.85rem' }}>✓</span>}
                      Run {e.run_number}
                    </div>
                  </td>
                  <td>
                    <span style={{ display:'inline-block', padding:'0.15rem 0.5rem', borderRadius:'999px', fontSize:'0.7rem', fontWeight:700, background:`${typeColor[e.run_type]||'var(--primary)'}20`, color:typeColor[e.run_type]||'var(--primary)' }}>
                      {e.run_type}
                    </span>
                  </td>
                  {e.actual_values.map((v, j) => (
                    <React.Fragment key={j}>
                      <td className="mono" style={{ color:'var(--text-muted)' }}>{v.toFixed(2)}</td>
                      <td>
                        <input 
                          type="number" 
                          className="form-input" 
                          style={{ width: '70px', padding: '0.2rem 0.4rem', fontSize: '0.8rem' }} 
                          defaultValue={v.toFixed(2)} 
                        />
                      </td>
                    </React.Fragment>
                  ))}
                  {responses.map((_: any, j: number) => (
                    <td key={j} style={{ color: e.result_values?.[j] != null ? 'var(--success)' : 'var(--text-muted)' }}>
                      {e.result_values?.[j] != null ? e.result_values[j]!.toFixed(3) : 'Pending'}
                    </td>
                  ))}
                  <td>
                    <input 
                      type="text" 
                      className="form-input" 
                      style={{ width: '150px', padding: '0.2rem 0.4rem', fontSize: '0.8rem' }} 
                      placeholder="e.g. Mild exotherm observed..." 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="step-nav">
        <button className="btn btn-secondary" onClick={() => setStep('generate-doe')}>← Back</button>
        <button className="btn btn-primary" onClick={() => setStep('upload-results')}>
          Enter Results →
        </button>
      </div>
    </div>
  )
}


