// src/screens/PreRunDiagnosticsModal.tsx – Part C2: Pre-Run Design Diagnostics
import { useState, useEffect } from 'react'
import { DOE } from '../services/api'

interface PreRunDiagnosticsModalProps {
  projectId: number
  designKey: string
  onClose: () => void
  onProceed: () => void
}

export default function PreRunDiagnosticsModal({ projectId, designKey, onClose, onProceed }: PreRunDiagnosticsModalProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    DOE.evaluate(projectId, designKey)
      .then(res => { if (isMounted) { setData(res); setLoading(false); } })
      .catch(err => { console.error(err); if (isMounted) setLoading(false); })
    return () => { isMounted = false }
  }, [projectId, designKey])

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', padding: '1.5rem', background: '#0f172a', border: '1px solid rgba(99,102,241,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <div className="badge badge-accent">Part C2 · Diagnostics</div>
            <h2 style={{ fontSize: '1.25rem', margin: '4px 0 0' }}>Pre-Run Design Diagnostics ({designKey})</h2>
          </div>
          <button className="btn btn-icon btn-secondary" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            Evaluating design matrix (Calculating Alias structure, VIF, Power analysis & FDS curve)...
          </div>
        ) : !data ? (
          <div style={{ color: 'var(--danger-light)' }}>Failed to evaluate design diagnostics.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Power Analysis & VIF Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>Statistical Power Analysis</h4>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: data.power_analysis?.adequate_power ? 'var(--success-light)' : 'var(--warning-light)' }}>
                  {data.power_analysis?.power_percentage}% Power
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Probability of detecting signal-to-noise ratio ≥ 2.0 at α = 0.05.
                </div>
              </div>

              <div className="card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>Multicollinearity (VIF Summary)</h4>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(data.vif || []).map((v: any) => (
                    <span key={v.factor} className={`badge ${v.vif <= 5 ? 'badge-secondary' : 'badge-danger'}`} style={{ fontSize: '0.75rem' }}>
                      {v.factor}: VIF = {v.vif}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Alias Structure Table */}
            <div className="card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 600, margin: '0 0 0.75rem' }}>Alias / Confounding Structure Table</h4>
              <table className="data-table" style={{ width: '100%', fontSize: '0.8rem' }}>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Factor Effect</th>
                    <th>Confounded With (Aliased Terms)</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.alias_structure || []).map((a: any, i: number) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, color: 'var(--primary-light)' }}>{a.term}</td>
                      <td style={{ color: a.confounded_with.includes('Clean') ? 'var(--success-light)' : 'var(--warning-light)' }}>
                        {a.confounded_with}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* FDS Curve Summary */}
            <div className="card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 600, margin: '0 0 0.5rem' }}>Fraction of Design Space (FDS) Distribution</h4>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <div>Min Scaled Prediction Variance: <strong style={{ color: '#fff' }}>{data.fds?.min_spv}</strong></div>
                <div>Median SPV: <strong style={{ color: '#fff' }}>{data.fds?.median_spv}</strong></div>
                <div>Max SPV: <strong style={{ color: '#fff' }}>{data.fds?.max_spv}</strong></div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={onClose}>
                Regenerate / Pick Different Design
              </button>
              <button className="btn btn-primary" onClick={onProceed}>
                Proceed with this Design →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
