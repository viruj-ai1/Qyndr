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
        <div className="page-header-tag">Step 14</div>
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
              {rec.expected_improvement?.toFixed(4)}
            </div>
            <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginTop:'0.5rem' }}>
              {rec.expected_improvement > 0.01 ? '🚀 High improvement potential – strongly recommend this experiment' :
               rec.expected_improvement > 0.001 ? '📈 Moderate improvement potential' :
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
            <div className="card-title mb-2">Recommended Next Experiment</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {factors.map((f: any, i: number) => {
                const val = rec.actual_values?.[i]
                const range = (f.high - f.low) || 1
                const rawPct = val != null ? ((val - f.low) / range) * 100 : 50
                // Strictly clamp percentage between 0% and 100%, guarding against Infinity/NaN
                const pct = Math.max(0, Math.min(100, isNaN(rawPct) || !isFinite(rawPct) ? 50 : rawPct))

                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '160px', fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      {f.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({f.unit || 'units'})</span>
                    </div>
                    
                    {/* Track container with explicit clipping boundaries */}
                    <div style={{ flex: 1, height: '8px', background: 'var(--border)', borderRadius: '999px', position: 'relative', minWidth: '140px' }}>
                      {/* Active filled line strictly clamped within track */}
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
                      {/* Position indicator dot clamped within track limits */}
                      <div 
                        style={{ 
                          position: 'absolute', 
                          top: '-4px', 
                          left: `calc(${pct}% - 8px)`, 
                          width: '16px', 
                          height: '16px', 
                          borderRadius: '50%', 
                          background: 'var(--accent)', 
                          border: '2px solid var(--bg-base)', 
                          boxShadow: '0 2px 8px rgba(6, 182, 212, 0.4)',
                          pointerEvents: 'none'
                        }}
                      />
                    </div>

                    {/* Formatted Value & Unit */}
                    <div style={{ width: '85px', textAlign: 'right', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.88rem', fontWeight: 700, color: 'var(--success)', flexShrink: 0 }}>
                      {typeof val === 'number' && !isNaN(val) ? val.toFixed(3) : '—'}
                    </div>
                    <div style={{ width: '35px', fontSize: '0.74rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {f.unit || ''}
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
