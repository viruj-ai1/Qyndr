// src/screens/GPModel.tsx
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useStore } from '../store/useStore'
import { Optimization } from '../services/api'
import toast from 'react-hot-toast'

export default function GPModel() {
  const { currentProject, setStep, setBayes } = useStore()
  const factors   = currentProject?.factors   || []
  const responses = currentProject?.responses || []
  const [selResp, setSelResp] = useState(0)
  const [result, setResult]   = useState<any>(null)
  const [loading, setLoading] = useState(false)

  async function runGP() {
    if (!currentProject?.id) return
    setLoading(true)
    try {
      const data = await Optimization.recommend(currentProject.id, selResp)
      setResult(data)
      setBayes(data)
      toast.success('GP model fitted & recommendation ready')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'GP model failed')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (currentProject?.id) {
      runGP()
    }
  }, [selResp, currentProject?.id])

  const gp = result?.gp_summary
  const slices = result?.slices || []

  return (
    <div>
      <div className="page-header">
        <div className="page-header-tag">Step 17</div>
        <h1 className="page-title">GP Model</h1>
        <p className="page-desc">Use the existing results to predict better settings.</p>
      </div>

      <div style={{ display:'flex', gap:'0.5rem', marginBottom:'1.5rem', flexWrap:'wrap', alignItems:'center' }}>
        {responses.map((r: any, i: number) => (
          <button key={i} className={`btn ${selResp===i?'btn-primary':'btn-secondary'} btn-sm`}
            onClick={() => setSelResp(i)}>{r.name}</button>
        ))}
        <button className="btn btn-accent btn-sm" onClick={runGP} disabled={loading}>
          {loading ? <><div className="spinner"/>Fitting…</> : '↺ Refit GP'}
        </button>
      </div>

      {loading && <div className="loading-overlay"><div className="spinner"/> Fitting Gaussian Process model…</div>}

      {gp && !loading && (
        <>
          {/* GP Stats */}
          <div className="grid-4 mb-2">
            {[
              { l:'Training Points', v: gp.n_obs },
              { l:'Best Observed',   v: gp.y_best?.toFixed(3) },
              { l:'Mean Response',   v: gp.y_mean?.toFixed(3) },
              { l:'Log Likelihood',  v: gp.log_likelihood?.toFixed(2) },
            ].map(s => (
              <div key={s.l} className="stat-card">
                <div className="stat-label">{s.l}</div>
                <div className="stat-value" style={{ fontSize:'1.2rem' }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* 1D Posterior slices */}
          <div className="card mb-2">
            <div className="card-title mb-2">GP Posterior – 1D Factor Slices (95% Confidence Band)</div>
            <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
              {slices.slice(0,4).map((slice: any, idx: number) => {
                const chartData = slice.x.map((x: number, i: number) => ({
                  x, mean: slice.mean[i], upper: slice.upper[i], lower: slice.lower[i]
                }))
                return (
                  <div key={idx} style={{ flex:'1 1 45%', minWidth:'280px' }}>
                    <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--text-secondary)', marginBottom:'0.5rem' }}>
                      {slice.factor_name} {slice.factor_unit&&`(${slice.factor_unit})`}
                    </div>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={chartData} margin={{ top:5, right:10, bottom:5, left:0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="x" tick={{ fill:'var(--text-muted)', fontSize:9 }} />
                        <YAxis tick={{ fill:'var(--text-muted)', fontSize:9 }} />
                        <Tooltip contentStyle={{ background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:8, fontSize:'0.75rem' }} />
                        <ReferenceLine y={gp.y_best} stroke="rgba(245,158,11,0.6)" strokeDasharray="4 4" />
                        <Line type="monotone" dataKey="upper" stroke="rgba(99,102,241,0.2)" dot={false} strokeWidth={0} fill="rgba(99,102,241,0.1)" />
                        <Line type="monotone" dataKey="mean"  stroke="var(--primary)" dot={false} strokeWidth={2} name="GP Mean" />
                        <Line type="monotone" dataKey="lower" stroke="rgba(99,102,241,0.2)" dot={false} strokeWidth={0} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="alert alert-success">
            🎯 GP model ready. The model captures uncertainty (exploration) and predicted improvement (exploitation) across the factor space.
          </div>
        </>
      )}

      <div className="step-nav">
        <button className="btn btn-secondary" onClick={() => setStep('enough-data')}>← Back</button>
        <button className="btn btn-primary" onClick={() => setStep('bayesian-opt')} disabled={!result || loading}>
          View Bayesian Recommendation →
        </button>
      </div>
    </div>
  )
}
