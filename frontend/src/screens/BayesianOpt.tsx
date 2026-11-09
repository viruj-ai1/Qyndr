import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Optimization } from '../services/api'
import toast from 'react-hot-toast'

export default function BayesianOpt() {
  const { currentProject, bayesResult, setStep, setBayes } = useStore()
  const factors   = currentProject?.factors   || []
  const responses = currentProject?.responses || []
  const rec       = bayesResult?.recommendation

  useEffect(() => {
    if (!bayesResult && currentProject) {
      Optimization.latest(currentProject.id)
        .then(setBayes)
        .catch(() => toast.error('Failed to load recommendation details'))
    }
  }, [bayesResult, currentProject, setBayes])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Bayesian Optimization</h1>
        <p className="page-desc">Choose the next experiment that may give a better result.</p>
      </div>

      {!rec ? (
        <div className="alert alert-warning">No recommendation available. Go back to the GP Model step.</div>
      ) : (
        <>
          {/* EI Score */}
          <div className="card mb-2" style={{ textAlign:'center', padding:'1.5rem' }}>
            <div style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'0.5rem' }}>Expected Improvement</div>
            <div style={{ fontSize:'3rem', fontWeight:900, color:'var(--accent)', lineHeight:1 }}>
              {rec.expected_improvement != null ? (
                (() => {
                  const rawEI = rec.expected_improvement
                  const norm = rawEI > 1 ? rawEI / 100 : rawEI
                  const pct = norm * 100
                  return pct >= 1 ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`
                })()
              ) : '—'}
            </div>
            <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginTop:'0.5rem' }}>
              {((rec.expected_improvement > 1 ? rec.expected_improvement / 100 : rec.expected_improvement) || 0) > 0.01 ? '🚀 High improvement potential – strongly recommend this experiment' :
               ((rec.expected_improvement > 1 ? rec.expected_improvement / 100 : rec.expected_improvement) || 0) > 0.001 ? '📈 Moderate improvement potential' :
               '📉 Low improvement – consider stopping'}
            </div>
          </div>

          {/* Prediction interval */}
          <div className="grid-2 mb-2">
            <div className="stat-card">
              <div className="stat-label">Predicted Response</div>
              <div className="stat-value" style={{ color:'var(--accent)' }}>{rec.predicted_mean?.toFixed(3)}</div>
              <div className="stat-sub">GP posterior mean</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">95% Confidence Interval</div>
              <div className="stat-value" style={{ fontSize:'0.95rem', color:'var(--text-secondary)' }}>
                [{rec.confidence_95?.[0]?.toFixed(3)}, {rec.confidence_95?.[1]?.toFixed(3)}]
              </div>
              <div className="stat-sub">Uncertainty range</div>
            </div>
          </div>

          {/* Recommended factor settings */}
          <div className="card mb-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.85rem' }}>
              <div className="card-title" style={{ margin: 0 }}>Recommended Next Experiment</div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Target operating setpoints suggested by Bayesian acquisition function
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
              {factors.map((f: any, i: number) => {
                const val = rec.actual_values?.[i]
                const low = f.low ?? 0
                const high = f.high ?? 1
                const range = (high - low) || 1
                const rawPct = val != null ? ((val - low) / range) * 100 : 50
                // Strictly clamp percentage between 0% and 100%
                const pct = Math.max(0, Math.min(100, isNaN(rawPct) || !isFinite(rawPct) ? 50 : rawPct))

                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {/* Factor name & unit */}
                      <div style={{ width: '180px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
                        {f.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.78rem' }}>({f.unit || 'units'})</span>
                      </div>
                      
                      {/* Visual gauge bar showing where this recommended setpoint sits within Low and High range */}
                      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <div style={{ width: '100%', height: '8px', background: 'var(--border)', borderRadius: '999px', position: 'relative' }}>
                          {/* Active filled line */}
                          <div 
                            style={{ 
                              position: 'absolute', 
                              left: 0, 
                              top: 0, 
                              height: '100%', 
                              width: `${pct}%`, 
                              maxWidth: '100%',
                              background: 'linear-gradient(90deg, var(--primary), var(--accent))', 
                              borderRadius: '999px', 
                              transition: 'width 0.4s ease' 
                            }}
                          />
                          {/* Indicator dot */}
                          <div 
                            style={{ 
                              position: 'absolute', 
                              top: '-4px', 
                              left: `calc(${pct}% - 8px)`, 
                              width: '16px', 
                              height: '16px', 
                              borderRadius: '50%', 
                              background: 'var(--accent)', 
                              border: '2px solid #ffffff', 
                              boxShadow: '0 2px 8px rgba(0, 174, 179, 0.4)',
                              pointerEvents: 'none'
                            }}
                          />
                        </div>
                      </div>

                      {/* Recommended Setpoint Value */}
                      <div style={{ width: '120px', textAlign: 'right', display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '0.35rem', flexShrink: 0 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.05rem', fontWeight: 800, color: 'var(--primary)' }}>
                          {typeof val === 'number' && !isNaN(val) ? Number(val.toFixed(3)) : '—'}
                        </span>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          {f.unit || ''}
                        </span>
                      </div>
                    </div>

                    {/* Low and High bounds guide below the bar */}
                    <div style={{ display: 'flex', paddingLeft: '180px', paddingRight: '120px', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      <span>Min: {low} {f.unit || ''}</span>
                      <span style={{ color: pct >= 99 ? 'var(--warning)' : 'inherit' }}>
                        {pct >= 99 ? 'At upper bound (100%)' : pct <= 1 ? 'At lower bound (0%)' : `${Math.round(pct)}% of range`}
                      </span>
                      <span>Max: {high} {f.unit || ''}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="alert alert-info">
            🧪 Run this experiment in the lab, then record the result to update the GP model.
          </div>

          <div style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:'var(--radius)', padding:'1rem', marginTop:'1rem' }}>
            <div style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--primary-light)', marginBottom:'0.5rem' }}>
              📊 Acquisition Details
            </div>
            <div style={{ display:'flex', gap:'1.5rem', fontSize:'0.78rem', color:'var(--text-secondary)' }}>
              <span>Type: <strong style={{ color:'var(--text-primary)' }}>{rec.acquisition_type || 'Expected Improvement'}</strong></span>
              <span>ξ (xi): <strong style={{ color:'var(--text-primary)' }}>{rec.xi || 0.01}</strong></span>
              <span>GP Observations: <strong style={{ color:'var(--text-primary)' }}>{bayesResult?.gp_summary?.n_obs}</strong></span>
            </div>
          </div>
        </>
      )}

      <div className="step-nav">
        <button className="btn btn-secondary" onClick={() => setStep('gp-model')}>← Back to GP Model</button>
        <button className="btn btn-primary" onClick={() => setStep('new-experiment')} disabled={!rec}>
          Proceed to Lab →
        </button>
      </div>
    </div>
  )
}
