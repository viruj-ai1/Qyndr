// src/screens/GPModel.tsx
import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
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

  async function runGP(respIdx?: number) {
    if (!currentProject?.id) return
    const targetIdx = respIdx !== undefined ? respIdx : selResp
    setLoading(true)
    try {
      const data = await Optimization.recommend(currentProject.id, targetIdx)
      setResult(data)
      setBayes(data)
      const respName = responses[targetIdx]?.name || `Response ${targetIdx + 1}`
      toast.success(`GP model fitted for ${respName}`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'GP model failed')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (currentProject?.id) {
      runGP(selResp)
    }
  }, [currentProject?.id])

  const gp = result?.gp_summary
  const slices = result?.slices || []
  const currentResp = responses[selResp]

  return (
    <div>
      <div className="page-header">
        <div className="page-header-tag">Step 13 · Machine Learning</div>
        <h1 className="page-title">Gaussian Process Surrogate Model</h1>
        <p className="page-desc">
          Fits a non-parametric Bayesian Gaussian Process with Matérn kernel to your analytical response data to model nonlinear curvature and quantify prediction uncertainty across the experimental space.
        </p>
      </div>

      {/* Response Selector & Refit Button */}
      <div style={{ display:'flex', gap:'0.6rem', marginBottom:'1.2rem', flexWrap:'wrap', alignItems:'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '0.25rem' }}>
            Active Response:
          </span>
          {responses.map((r: any, i: number) => (
            <button
              key={i}
              className={`btn ${selResp===i ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              style={{ fontWeight: selResp===i ? 700 : 500 }}
              onClick={() => {
                setSelResp(i)
                runGP(i)
              }}
            >
              {r.name} {r.unit ? `(${r.unit})` : ''}
            </button>
          ))}
        </div>

        <button className="btn btn-accent btn-sm" onClick={() => runGP(selResp)} disabled={loading}>
          {loading ? <><div className="spinner"/>Fitting GP…</> : '↺ Refit GP Model'}
        </button>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"/> Fitting Gaussian Process regression & calculating posterior slices…
        </div>
      )}

      {gp && !loading && (
        <>
          {/* GP Stats */}
          <div className="grid-4 mb-2">
            {[
              { l: 'Training Observations', v: gp.n_obs, sub: 'completed experimental runs' },
              { l: 'Best Observed Result', v: gp.y_best?.toFixed(3), sub: `${currentResp?.name || 'Response'} value` },
              { l: 'Dataset Grand Mean', v: gp.y_mean?.toFixed(3), sub: 'prior regression mean' },
              { l: 'Log Marginal Likelihood', v: gp.log_likelihood?.toFixed(2), sub: 'model goodness-of-fit' },
            ].map(s => (
              <div key={s.l} className="stat-card">
                <div className="stat-label">{s.l}</div>
                <div className="stat-value" style={{ fontSize:'1.25rem', color: 'var(--text-primary)' }}>{s.v}</div>
                <div className="stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* 1D Posterior slices */}
          <div className="card mb-2">
            <div className="flex-between mb-2" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div className="card-title">GP Posterior – 1D Factor Profiles (95% Confidence Band)</div>
                <div className="card-sub">
                  Predicted response behavior across each factor range evaluated around the optimal experimental condition.
                </div>
              </div>

              {/* Legend */}
              <div style={{ display: 'flex', gap: '0.85rem', fontSize: '0.72rem', color: 'var(--text-muted)', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 14, height: 3, background: 'var(--primary)', display: 'inline-block', borderRadius: 2 }} />
                  <strong style={{ color: 'var(--text-primary)' }}>GP Posterior Mean</strong>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 14, height: 0, borderTop: '2px dashed #818cf8', display: 'inline-block' }} />
                  <span>95% Confidence Band</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 14, height: 0, borderTop: '2px dashed #f59e0b', display: 'inline-block' }} />
                  <span>Best Observed</span>
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 14, height: 0, borderTop: '2px dashed #10b981', display: 'inline-block' }} />
                  <span>Optimum Coordinate</span>
                </span>
              </div>
            </div>

            <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
              {slices.map((slice: any, idx: number) => {
                const chartData = (slice.x || []).map((x: number, i: number) => ({
                  x: typeof x === 'number' ? Number(x.toFixed(3)) : x,
                  mean: slice.mean?.[i],
                  upper: slice.upper?.[i],
                  lower: slice.lower?.[i]
                }))

                // Calculate dynamic Y domain so response curves and confidence bands are clearly visible
                const allVals = chartData.flatMap((d: any) => [d.mean, d.upper, d.lower]).filter((v: any) => v != null && !isNaN(v))
                const minV = allVals.length ? Math.min(...allVals) : 0
                const maxV = allVals.length ? Math.max(...allVals) : 100
                const pad = Math.max(0.5, (maxV - minV) * 0.12)
                const yDomain = [
                  Math.floor((minV - pad) * 10) / 10,
                  Math.ceil((maxV + pad) * 10) / 10
                ]

                return (
                  <div
                    key={idx}
                    style={{
                      flex: '1 1 calc(50% - 0.5rem)',
                      minWidth: '290px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      padding: '0.85rem',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {slice.factor_name} {slice.factor_unit ? `(${slice.factor_unit})` : ''}
                      </span>
                      {slice.reference_x != null && (
                        <span style={{ fontSize: '0.7rem', color: '#047857', background: 'rgba(16,185,129,0.1)', padding: '0.15rem 0.45rem', borderRadius: 4, fontWeight: 600 }}>
                          Profile slice at: {Number(slice.reference_x).toFixed(2)} {slice.factor_unit || ''}
                        </span>
                      )}
                    </div>

                    <ResponsiveContainer width="100%" height={170}>
                      <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 6, left: 2 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis
                          dataKey="x"
                          tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                          tickFormatter={(v) => typeof v === 'number' ? v.toFixed(1) : v}
                          interval="preserveStartEnd"
                          minTickGap={28}
                        />
                        <YAxis
                          domain={yDomain}
                          tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                          tickFormatter={(v) => typeof v === 'number' ? v.toFixed(1) : v}
                          width={44}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--bg-elevated, #ffffff)',
                            border: '1px solid var(--border)',
                            borderRadius: 8,
                            fontSize: '0.78rem',
                            boxShadow: '0 4px 14px rgba(0,0,0,0.08)'
                          }}
                          formatter={(value: any, name: string) => [
                            typeof value === 'number' ? value.toFixed(3) : value,
                            name
                          ]}
                          labelFormatter={(label) => `${slice.factor_name}: ${typeof label === 'number' ? label.toFixed(2) : label} ${slice.factor_unit || ''}`}
                        />
                        <ReferenceLine
                          y={gp.y_best}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                          strokeWidth={1.2}
                        />
                        {slice.reference_x != null && (
                          <ReferenceLine
                            x={slice.reference_x}
                            stroke="#10b981"
                            strokeDasharray="2 2"
                            strokeWidth={1}
                          />
                        )}
                        {/* Upper 95% Confidence Bound */}
                        <Line
                          type="monotone"
                          dataKey="upper"
                          stroke="#818cf8"
                          strokeDasharray="3 3"
                          strokeWidth={1.4}
                          dot={false}
                          name="Upper 95% CI"
                        />
                        {/* GP Posterior Mean */}
                        <Line
                          type="monotone"
                          dataKey="mean"
                          stroke="var(--primary)"
                          strokeWidth={2.5}
                          dot={false}
                          name="GP Posterior Mean"
                        />
                        {/* Lower 95% Confidence Bound */}
                        <Line
                          type="monotone"
                          dataKey="lower"
                          stroke="#818cf8"
                          strokeDasharray="3 3"
                          strokeWidth={1.4}
                          dot={false}
                          name="Lower 95% CI"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="alert alert-success">
            🎯 <strong>GP model fitted successfully.</strong> The response surface captures non-linear curvature and quantifies spatial uncertainty (tight confidence bounds near completed runs, expanding uncertainty in unexplored design regions).
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

