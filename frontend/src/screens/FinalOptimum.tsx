import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Optimization, Analysis } from '../services/api'
import PlotlyChart from '../components/PlotlyChart'
import { MarkdownMessage } from '../components/MarkdownMessage'
import { simplifyResponseName } from '../utils/targetParser'
import toast from 'react-hot-toast'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  charts?: any[]
}

export default function FinalOptimum() {
  const { currentProject, setStep, setFinal, finalResult, setOptimum, optimumResult, experiments, isBayesianEnabled } = useStore()
  const factors   = currentProject?.factors   || []
  const responses = currentProject?.responses || []

  // 'combined' represents the multi-objective all-combined mode; numbers represent individual response indices
  const [activeTab, setActiveTab] = useState<'combined' | number>('combined')
  const [combinedOptimum, setCombinedOptimum] = useState<any>(optimumResult || null)
  const [loading, setLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [loadingChat, setLoadingChat] = useState(false)
  // Feature flag to disable Chat with Virtual Data Scientist for now without removing code
  const SHOW_VIRTUAL_DATA_SCIENTIST = false

  async function loadCombinedOptimum() {
    if (!currentProject?.id) return
    setLoading(true)
    try {
      const data = await Optimization.finalCombined(currentProject.id)
      setCombinedOptimum(data)
      setOptimum(data)
      toast.success('Multi-response combined optimum calculated!')
    } catch (e: any) {
      console.warn('GP final-combined optimum error, falling back to analysis:', e)
      try {
        const data = await Analysis.optimize(currentProject.id)
        setCombinedOptimum(data)
        setOptimum(data)
        toast.success('Multi-response combined optimum calculated!')
      } catch (err: any) {
        toast.error(e.response?.data?.detail || err.response?.data?.detail || 'Failed to calculate multi-response optimum. Run analysis first.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadIndividualFinal(respIdx: number) {
    if (!currentProject?.id) return
    setLoading(true)
    try {
      const data = await Optimization.final(currentProject.id, respIdx)
      setFinal(data)
      const respName = simplifyResponseName(responses[respIdx]?.name, responses[respIdx]?.goal) || `Response ${respIdx + 1}`
      toast.success(`Final optimum calculated for ${respName}`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed – run analysis + GP first')
    } finally {
      setLoading(false)
    }
  }

  // Load default on mount or project switch
  useEffect(() => {
    if (!currentProject?.id) return
    if (activeTab === 'combined') {
      loadCombinedOptimum()
    } else {
      loadIndividualFinal(activeTab)
    }
  }, [currentProject?.id])

  const handleSelectTab = (tab: 'combined' | number) => {
    setActiveTab(tab)
    if (tab === 'combined') {
      loadCombinedOptimum()
    } else {
      loadIndividualFinal(tab)
    }
  }

  const handleRecalculate = () => {
    if (activeTab === 'combined') {
      loadCombinedOptimum()
    } else {
      loadIndividualFinal(activeTab)
    }
  }

  async function handleSendChat(overrideMsg?: string) {
    const text = overrideMsg !== undefined ? overrideMsg : chatInput
    if (!text.trim()) return
    const msg = text.trim()
    if (overrideMsg === undefined) setChatInput('')
    const newHistory: ChatMsg[] = [...chatMessages, { role: 'user', content: msg }]
    setChatMessages(newHistory)
    setLoadingChat(true)
    try {
      const cleanHistory = chatMessages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      }))
      const respIdx = activeTab === 'combined' ? 0 : activeTab
      const data = await Optimization.llmChat(currentProject!.id, msg, cleanHistory, respIdx)
      setChatMessages([...newHistory, { 
        role: 'assistant', 
        content: data.response || data.response_text || '',
        charts: data.charts || []
      }])
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Chat failed')
      setChatMessages([...newHistory, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }])
    } finally {
      setLoadingChat(false)
    }
  }

  const fr = finalResult
  const totalObs = combinedOptimum?.n_obs ?? fr?.n_obs ?? experiments?.length ?? 0

  const rawDesirability = combinedOptimum?.composite_desirability
  const hasDesirability = rawDesirability != null && !isNaN(Number(rawDesirability))
  const compositeScore = hasDesirability ? Number(rawDesirability) : 0
  const compositeDesirabilityPct = hasDesirability ? (compositeScore * 100).toFixed(1) : null

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Final Optimum</h1>
        <p className="page-desc">Find the best final settings after all experiments.</p>
      </div>

      {/* Response & Mode Selector Toolbar */}
      <div style={{ display:'flex', gap:'0.6rem', marginBottom:'1.2rem', flexWrap:'wrap', alignItems:'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: '0.25rem' }}>
            Optimization Mode:
          </span>
          <button
            type="button"
            className={`btn ${activeTab === 'combined' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            style={{ fontWeight: activeTab === 'combined' ? 700 : 500 }}
            onClick={() => handleSelectTab('combined')}
          >
            🌟 All Combined (Multi-Objective)
          </button>
          {responses.map((r: any, i: number) => (
            <button
              key={i}
              type="button"
              className={`btn ${activeTab === i ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              style={{ fontWeight: activeTab === i ? 700 : 500 }}
              onClick={() => handleSelectTab(i)}
            >
              {simplifyResponseName(r.name, r.goal)} {r.unit ? `(${r.unit})` : ''}
            </button>
          ))}
        </div>

        <button className="btn btn-accent btn-sm" onClick={handleRecalculate} disabled={loading}>
          {loading ? (
            <><div className="spinner"/>Calculating…</>
          ) : activeTab === 'combined' ? (
            '↺ Recalculate Combined Optimum'
          ) : (
            '↺ Recalculate Final Optimum'
          )}
        </button>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"/>
          {activeTab === 'combined' ? 'Computing multi-response combined optimum…' : 'Computing GP final optimum…'}
        </div>
      )}

      {/* Mode 1: All Combined (Multi-Objective) Active */}
      {activeTab === 'combined' && !loading && (
        <>
          {combinedOptimum ? (
            <>
              {/* Global Composite Desirability Index Hero Card */}
              <div className="card mb-2" style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,253,250,0.85) 100%)',
                border: '1.5px solid rgba(0, 174, 179, 0.25)',
                borderRadius: '16px',
                padding: '1.6rem 2rem',
                boxShadow: '0 10px 30px rgba(0, 91, 170, 0.06)'
              }}>
                {/* Top Badge & Title Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '0.9rem', borderBottom: '1px solid rgba(0, 91, 170, 0.08)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(0, 91, 170, 0.1)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1rem'
                    }}>
                      🎯
                    </div>
                    <div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                        Global Composite Desirability Index (D-Optimum)
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        Multi-criteria joint objective optimization according to Derringer & Suich
                      </div>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '3px 10px',
                    borderRadius: '20px',
                    background: compositeScore > 0.8 ? 'rgba(5,150,105,0.1)' : compositeScore > 0.6 ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.1)',
                    color: compositeScore > 0.8 ? '#059669' : compositeScore > 0.6 ? '#d97706' : '#dc2626',
                    border: `1px solid ${compositeScore > 0.8 ? 'rgba(5,150,105,0.25)' : compositeScore > 0.6 ? 'rgba(217,119,6,0.25)' : 'rgba(220,38,38,0.25)'}`
                  }}>
                    {compositeScore > 0.8 ? 'Optimal Convergence' : compositeScore > 0.6 ? 'Moderate Compromise' : 'Sub-Optimal Convergence'}
                  </span>
                </div>

                {/* Score & Gauge Meter Section */}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 240px) 1fr', gap: '2rem', alignItems: 'center' }}>
                  {/* Big Percentage Display */}
                  <div style={{ textAlign: 'center', padding: '1rem 0', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
                    <div style={{
                      fontSize: '3.6rem',
                      fontWeight: 900,
                      fontFamily: 'var(--font-sans)',
                      background: compositeScore > 0.8
                        ? 'linear-gradient(135deg, #059669, #00aeb3)'
                        : compositeScore > 0.6
                        ? 'linear-gradient(135deg, #d97706, #00aeb3)'
                        : 'linear-gradient(135deg, #dc2626, #f97316)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      lineHeight: 1
                    }}>
                      {compositeDesirabilityPct != null ? `${compositeDesirabilityPct}%` : '—'}
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.4rem' }}>
                      Overall D Score: {compositeScore.toFixed(3)}
                    </div>
                  </div>

                  {/* Progress Gauge & Status Breakdown */}
                  <div>
                    {/* Visual Progress Track */}
                    <div style={{ marginBottom: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                        <span>0% (Unacceptable)</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Quality Threshold: 80%</span>
                        <span>100% (Ideal)</span>
                      </div>
                      <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '999px', position: 'relative', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, Math.max(0, compositeScore * 100))}%`,
                            background: compositeScore > 0.8
                              ? 'linear-gradient(90deg, #10b981, #00aeb3)'
                              : compositeScore > 0.6
                              ? 'linear-gradient(90deg, #f59e0b, #00aeb3)'
                              : 'linear-gradient(90deg, #ef4444, #f97316)',
                            borderRadius: '999px',
                            transition: 'width 0.5s ease'
                          }}
                        />
                      </div>
                    </div>

                    {/* Status Text Card */}
                    <div style={{
                      background: compositeScore > 0.8 ? 'rgba(5, 150, 105, 0.06)' : compositeScore > 0.6 ? 'rgba(217, 119, 6, 0.06)' : 'rgba(220, 38, 38, 0.06)',
                      border: `1px solid ${compositeScore > 0.8 ? 'rgba(5, 150, 105, 0.2)' : compositeScore > 0.6 ? 'rgba(217, 119, 6, 0.2)' : 'rgba(220, 38, 38, 0.2)'}`,
                      borderRadius: '8px',
                      padding: '0.65rem 0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem'
                    }}>
                      <span style={{ fontSize: '1.1rem' }}>
                        {compositeScore > 0.8 ? '🟢' : compositeScore > 0.6 ? '🟡' : '🔴'}
                      </span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.45, fontWeight: 500 }}>
                        {compositeScore > 0.8
                          ? 'Global Pareto-Optimal Coordinate – Simultaneous convergence across all Critical Quality Attributes (CQAs).'
                          : compositeScore > 0.6
                          ? 'Constrained Multi-Response Trade-off – Acceptable compromise across CQA specification boundaries.'
                          : 'Sub-optimal Multi-Criteria Convergence – One or more responses are near specification limits. Consider re-evaluating factor constraints or response weighting.'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom 3-Card Metrics Strip */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1rem',
                  marginTop: '1.4rem',
                  paddingTop: '1.1rem',
                  borderTop: '1px solid rgba(0, 91, 170, 0.08)'
                }}>
                  <div style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Total Runs Evaluated</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent)', marginTop: '2px' }}>
                      {totalObs} <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>runs</span>
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Active CQAs</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)', marginTop: '2px' }}>
                      {responses.length} <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>Responses</span>
                    </div>
                  </div>

                  <div style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Optimization Engine</div>
                    <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--success)', marginTop: '4px' }}>
                      Derringer-Suich (DE)
                    </div>
                  </div>
                </div>
              </div>

              {/* Predicted CQAs at Combined Optimum Card */}
              <div className="card mb-2" style={{ borderLeft: '4px solid var(--accent)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <div>
                    <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>📈</span> Predicted CQAs at Combined Optimum
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                      Simultaneous predicted outputs for all Critical Quality Attributes at the global multi-response optimum.
                    </p>
                  </div>
                  
                  <div style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem'
                  }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Composite Desirability:
                    </span>
                    <span className="mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>
                      {compositeDesirabilityPct != null ? `${compositeDesirabilityPct}%` : '—'}
                    </span>
                  </div>
                </div>

                <div className="grid-3" style={{ gap: '1rem' }}>
                  {responses.map((r: any, i: number) => {
                    const predVal = combinedOptimum?.predicted_responses?.[i]
                    const hasPred = predVal != null && !isNaN(Number(predVal))
                    const numPred = hasPred ? Number(predVal) : null
                    const goalStr = r.goal ? r.goal.toUpperCase() : 'MAXIMIZE'
                    const unitStr = r.unit ? r.unit : ''
                    
                    return (
                      <div key={i} className="stat-card" style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                            <span className="stat-label" style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.88rem' }}>
                              {simplifyResponseName(r.name, r.goal)}
                            </span>
                            <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem', textTransform: 'uppercase' }}>
                              {goalStr}
                            </span>
                          </div>
                          
                          <div className="stat-value" style={{
                            fontSize: '1.85rem',
                            fontWeight: 800,
                            color: 'var(--accent)',
                            margin: '0.35rem 0'
                          }}>
                            {numPred != null ? numPred.toFixed(3) : '—'}
                            {unitStr && <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: '0.3rem' }}>{unitStr}</span>}
                          </div>
                        </div>

                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: '0.5rem', marginTop: '0.35rem', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.25rem' }}>
                          <span>Target Spec:</span>
                          <span className="mono" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                            {r.target != null ? `${r.target} ${unitStr}` : (r.lower_limit != null || r.upper_limit != null ? `${r.lower_limit ?? '-∞'} to ${r.upper_limit ?? '+∞'} ${unitStr}` : 'Optimal')}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Proven Acceptable Ranges (PAR/NOR) Table for Multi-Response Pareto Optimum */}
              <div className="card mb-2">
                <div className="card-title mb-2">🎯 Proven Acceptable Range (PAR / NOR) – Multi-Response Pareto Optimum</div>
                <table className="data-table">
                  <thead>
                    <tr><th>Factor</th><th>Unit</th><th style={{ color:'var(--success)' }}>Optimal Setting</th><th>Proven Acceptable Range (PAR)</th></tr>
                  </thead>
                  <tbody>
                    {factors.map((f: any, i: number) => {
                      const rawVal = combinedOptimum?.actual_optimum?.[i]
                      const isValidVal = rawVal != null && !isNaN(Number(rawVal))
                      const numVal = isValidVal ? Number(rawVal) : null

                      const fLow = (f.low != null && !isNaN(Number(f.low))) ? Number(f.low) : null
                      const fHigh = (f.high != null && !isNaN(Number(f.high))) ? Number(f.high) : null

                      let tolerance = 0
                      if (fHigh != null && fLow != null && fHigh !== fLow) {
                        tolerance = Math.abs(fHigh - fLow) * 0.1
                      } else if (numVal != null && numVal !== 0) {
                        tolerance = Math.abs(numVal) * 0.1
                      } else {
                        tolerance = 1.0
                      }

                      const unitStr = f.unit ? ` ${f.unit}` : ''

                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{f.name || `Factor ${i + 1}`}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{f.unit || '—'}</td>
                          <td>
                            <span className="mono" style={{ color: 'var(--success)', fontWeight: 700 }}>
                              {numVal != null ? `${numVal.toFixed(3)}${unitStr}` : '—'}
                            </span>
                          </td>
                          <td>
                            <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                              {numVal != null ? `${(numVal - tolerance).toFixed(2)} – ${(numVal + tolerance).toFixed(2)}${unitStr}` : '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="alert alert-success mb-2">
                ✅ These multi-objective operating settings optimize all {responses.length} CQAs simultaneously using Derringer-Suich desirability functions across {totalObs} completed experiments. Verify with confirmation experiments before scale-up.
              </div>
            </>
          ) : (
            <div className="card mb-2" style={{ textAlign: 'center', padding: '2.5rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>No Multi-Response Optimum Found</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                Ensure lab experiments and regression analysis have been completed for this campaign.
              </p>
              <button className="btn btn-primary" onClick={loadCombinedOptimum} disabled={loading}>
                ↺ Compute Combined Optimum
              </button>
            </div>
          )}
        </>
      )}

      {/* Mode 2: Individual Response Selected */}
      {typeof activeTab === 'number' && !loading && (
        <>
          {fr ? (
            <>
              {/* Improvement highlight Hero Card matching Multi-Objective layout */}
              {(() => {
                const currentResp = responses[activeTab]
                const respName = simplifyResponseName(currentResp?.name, currentResp?.goal)
                const unitStr = currentResp?.unit ? ` ${currentResp.unit}` : ''
                const impPct = fr.improvement_pct != null && !isNaN(Number(fr.improvement_pct)) ? Number(fr.improvement_pct) : 0
                const isPositiveImp = impPct >= 0
                const predOptVal = fr.final_optimum?.predicted_mean != null && !isNaN(Number(fr.final_optimum.predicted_mean)) ? Number(fr.final_optimum.predicted_mean) : null
                const bestObsVal = fr.best_observed?.value != null && !isNaN(Number(fr.best_observed.value)) ? Number(fr.best_observed.value) : null
                const targetSpec = currentResp?.target != null ? `${currentResp.target}${unitStr}` : (currentResp?.lower_limit != null || currentResp?.upper_limit != null ? `${currentResp?.lower_limit ?? '-∞'} to ${currentResp?.upper_limit ?? '+∞'}${unitStr}` : 'Optimal')

                return (
                  <div className="card mb-2" style={{
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(240,253,250,0.85) 100%)',
                    border: '1.5px solid rgba(0, 174, 179, 0.25)',
                    borderRadius: '16px',
                    padding: '1.6rem 2rem',
                    boxShadow: '0 10px 30px rgba(0, 91, 170, 0.06)'
                  }}>
                    {/* Top Badge & Title Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '0.9rem', borderBottom: '1px solid rgba(0, 91, 170, 0.08)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: 'rgba(0, 91, 170, 0.1)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '1rem'
                        }}>
                          🏆
                        </div>
                        <div>
                          <div style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
                            {respName} GP Optimum Model
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            Gaussian Process response surface optimization & predictive convergence
                          </div>
                        </div>
                      </div>

                      <span style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: 'rgba(5,150,105,0.1)',
                        color: '#059669',
                        border: '1px solid rgba(5,150,105,0.25)'
                      }}>
                        {currentResp?.goal ? `${currentResp.goal.toUpperCase()} OPTIMUM` : 'OPTIMAL CONVERGENCE'}
                      </span>
                    </div>

                    {/* Score & Gauge Section */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 240px) 1fr', gap: '2rem', alignItems: 'center' }}>
                      {/* Big Value Display */}
                      <div style={{ textAlign: 'center', padding: '1rem 0', borderRight: '1px solid rgba(0,0,0,0.06)' }}>
                        <div style={{
                          fontSize: '3.6rem',
                          fontWeight: 900,
                          fontFamily: 'var(--font-sans)',
                          background: 'linear-gradient(135deg, #059669, #00aeb3)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          lineHeight: 1
                        }}>
                          {isPositiveImp ? `+${impPct.toFixed(1)}%` : `${impPct.toFixed(1)}%`}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.4rem' }}>
                          Improvement from first run
                        </div>
                      </div>

                      {/* Progress / Gauge & Status Breakdown */}
                      <div>
                        {/* Visual Progress Track */}
                        <div style={{ marginBottom: '0.85rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '5px' }}>
                            <span>Initial Baseline</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Target Spec: {targetSpec}</span>
                            <span>Best Peak ({bestObsVal != null ? `${bestObsVal.toFixed(2)}${unitStr}` : '—'})</span>
                          </div>
                          <div style={{ height: '10px', background: '#e2e8f0', borderRadius: '999px', position: 'relative', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.min(100, Math.max(15, Math.abs(impPct) * 8 + 20))}%`,
                                background: 'linear-gradient(90deg, #10b981, #00aeb3)',
                                borderRadius: '999px',
                                transition: 'width 0.5s ease'
                              }}
                            />
                          </div>
                        </div>

                        {/* Status Text Card */}
                        <div style={{
                          background: 'rgba(5, 150, 105, 0.06)',
                          border: '1px solid rgba(5, 150, 105, 0.2)',
                          borderRadius: '8px',
                          padding: '0.65rem 0.9rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem'
                        }}>
                          <span style={{ fontSize: '1.1rem' }}>🟢</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.45, fontWeight: 500 }}>
                            Optimal Coordinate Identified – Best observed value of <strong>{bestObsVal != null ? `${bestObsVal.toFixed(3)}${unitStr}` : '—'}</strong> attained at Run #{fr.best_observed?.run_number ?? '—'} with predicted mean of <strong>{predOptVal != null ? `${predOptVal.toFixed(3)}${unitStr}` : '—'}</strong>.
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom 3-Card Metrics Strip */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: '1rem',
                      marginTop: '1.4rem',
                      paddingTop: '1.1rem',
                      borderTop: '1px solid rgba(0, 91, 170, 0.08)'
                    }}>
                      <div style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Total Experiments</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--accent)', marginTop: '2px' }}>
                          {fr.n_obs ?? totalObs} <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>runs</span>
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Best Observed Value</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--success)', marginTop: '2px' }}>
                          {bestObsVal != null ? bestObsVal.toFixed(3) : '—'} {unitStr && <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>{unitStr}</span>}
                        </div>
                        {fr.best_observed?.run_number != null && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Run #{fr.best_observed.run_number} · {respName}
                          </div>
                        )}
                      </div>

                      <div style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>GP Predicted Optimum</div>
                        <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary-light)', marginTop: '2px' }}>
                          {predOptVal != null ? predOptVal.toFixed(3) : '—'} {unitStr && <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>{unitStr}</span>}
                        </div>
                        {fr.final_optimum?.confidence_95 && Array.isArray(fr.final_optimum.confidence_95) && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            95% CI: [{Number(fr.final_optimum.confidence_95[0] ?? 0).toFixed(2)}, {Number(fr.final_optimum.confidence_95[1] ?? 0).toFixed(2)}]
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Optimal conditions table with PAR/NOR for Individual Response */}
              <div className="card mb-2">
                <div className="card-title mb-2">
                  🎯 Safe Operating Window (PAR/NOR) – {simplifyResponseName(responses[activeTab]?.name, responses[activeTab]?.goal)}
                </div>
                <table className="data-table">
                  <thead>
                    <tr><th>Factor</th><th>Unit</th><th style={{ color:'var(--success)' }}>Optimal Value</th><th>Proven Acceptable Range (PAR)</th></tr>
                  </thead>
                  <tbody>
                    {factors.map((f: any, i: number) => {
                      const rawVal = fr.final_optimum?.actual_values?.[i]
                      const isValidVal = rawVal != null && !isNaN(Number(rawVal))
                      const numVal = isValidVal ? Number(rawVal) : null

                      const fLow = (f.low != null && !isNaN(Number(f.low))) ? Number(f.low) : null
                      const fHigh = (f.high != null && !isNaN(Number(f.high))) ? Number(f.high) : null

                      let tolerance = 0
                      if (fHigh != null && fLow != null && fHigh !== fLow) {
                        tolerance = Math.abs(fHigh - fLow) * 0.1
                      } else if (numVal != null && numVal !== 0) {
                        tolerance = Math.abs(numVal) * 0.1
                      } else {
                        tolerance = 1.0
                      }

                      const unitStr = f.unit ? ` ${f.unit}` : ''

                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{f.name || `Factor ${i + 1}`}</td>
                          <td style={{ color: 'var(--text-muted)' }}>{f.unit || '—'}</td>
                          <td>
                            <span className="mono" style={{ color: 'var(--success)', fontWeight: 700 }}>
                              {numVal != null ? `${numVal.toFixed(3)}${unitStr}` : '—'}
                            </span>
                          </td>
                          <td>
                            <span className="mono" style={{ color: 'var(--text-secondary)' }}>
                              {numVal != null ? `${(numVal - tolerance).toFixed(2)} – ${(numVal + tolerance).toFixed(2)}${unitStr}` : '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {fr.final_optimum?.confidence_95 && Array.isArray(fr.final_optimum.confidence_95) && (
                  <div style={{ marginTop:'0.75rem', fontSize:'0.8rem', color:'var(--text-muted)' }}>
                    GP 95% Confidence Interval: [{Number(fr.final_optimum.confidence_95[0] ?? 0).toFixed(3)}, {Number(fr.final_optimum.confidence_95[1] ?? 0).toFixed(3)}]
                  </div>
                )}
              </div>

              <div className="alert alert-success mb-2">
                ✅ These conditions have been validated through {fr.n_obs ?? totalObs} experiments using GP-guided Bayesian optimization.
                Verify with confirmation experiments before scale-up.
              </div>
            </>
          ) : (
            <div className="card mb-2" style={{ textAlign: 'center', padding: '2.5rem' }}>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>No GP Optimum Found for this Response</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                Calculate the Gaussian Process optimum for {simplifyResponseName(responses[activeTab]?.name, responses[activeTab]?.goal)}.
              </p>
              <button className="btn btn-primary" onClick={() => loadIndividualFinal(activeTab)} disabled={loading}>
                ↺ Compute Response Optimum
              </button>
            </div>
          )}
        </>
      )}

      {/* Chat with Virtual Data Scientist Section (Disabled for now) */}
      {SHOW_VIRTUAL_DATA_SCIENTIST && (
        <div className="card mb-2" style={{ borderTop: '4px solid var(--primary-light)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>💬</span> Chat with Virtual Data Scientist
              </div>
              <span className="badge badge-primary" style={{ fontSize: '0.74rem', letterSpacing: '0.04em', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary-light)', border: '1px solid rgba(99, 102, 241, 0.28)' }}>
                Active Context: {currentProject?.compound || currentProject?.name || 'Active Project'} · {totalObs} Runs {activeTab === 'combined' ? '· Multi-Objective' : `· Response: ${simplifyResponseName(responses[activeTab]?.name, responses[activeTab]?.goal)}`}
              </span>
            </div>
            <span className="badge badge-accent" style={{ fontSize: '0.72rem', letterSpacing: '0.05em' }}>
              GROQ LLAMA-3.3-70B + DoE RAG
            </span>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Query QbD regulatory guidance (ICH Q8/Q9/Q10/Q14), inspect ANOVA and Pareto significance, request interactive 2D/3D response surface plots, or generate 4-in-1 model diagnostics.
          </p>

          {/* Quick Action Suggestion Pills */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {[
              `Difference between NOR & PAR (${currentProject?.compound || 'ICH Q8'})`,
              "Generate 2D sweet spot contour map",
              "Show Pareto chart of effects with Bonferroni line",
              "Show 4-in-1 residual diagnostics",
              "Identify critical interaction effects & CPPs",
              "Recommend next validation run settings"
            ].map((suggestion, sIdx) => (
              <button
                key={sIdx}
                type="button"
                className="btn btn-secondary"
                style={{
                  fontSize: '0.78rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  color: 'var(--primary-light)',
                  cursor: 'pointer'
                }}
                disabled={loadingChat}
                onClick={() => handleSendChat(suggestion)}
              >
                ⚡ {suggestion}
              </button>
            ))}
          </div>

          {/* Chat Messages Stream */}
          <div style={{ 
            background: 'var(--surface)', 
            borderRadius: '8px', 
            padding: '1.25rem', 
            maxHeight: '560px', 
            overflowY: 'auto', 
            marginBottom: '1rem', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '1.25rem',
            border: '1px solid var(--border)'
          }}>
            {chatMessages.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem' }}>
                Ask me any questions about your DoE dataset, optimal settings, ANOVA models, or QbD regulatory standards for {currentProject?.compound || 'your API'}!
              </div>
            )}
            {chatMessages.map((msg, idx) => (
              <div 
                key={idx} 
                style={{ 
                  alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', 
                  background: msg.role === 'user' ? 'var(--primary-dark)' : 'var(--surface-light)', 
                  color: msg.role === 'user' ? '#fff' : 'var(--text)', 
                  padding: '0.85rem 1.15rem', 
                  borderRadius: '10px', 
                  maxWidth: msg.charts && msg.charts.length > 0 ? '95%' : '85%', 
                  width: msg.charts && msg.charts.length > 0 ? '100%' : 'auto',
                  fontSize: '0.9rem', 
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none', 
                  boxShadow: '0 2px 6px rgba(0,0,0,0.06)'
                }}
              >
                <div style={{ 
                  fontSize: '0.72rem', 
                  fontWeight: 700, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em', 
                  marginBottom: '0.4rem', 
                  opacity: 0.8 
                }}>
                  {msg.role === 'user' ? 'You' : 'Virtual Data Scientist'}
                </div>

                {msg.role === 'assistant' ? (
                  <MarkdownMessage content={msg.content} />
                ) : (
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{msg.content}</div>
                )}

                {/* Inline Plotly Charts */}
                {msg.charts && msg.charts.length > 0 && (
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {msg.charts.map((chart: any, cIdx: number) => (
                      <div 
                        key={cIdx} 
                        style={{ 
                          background: '#ffffff', 
                          borderRadius: '8px', 
                          padding: '0.5rem', 
                          border: '1px solid #e2e8f0', 
                          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                          overflow: 'hidden'
                        }}
                      >
                        <PlotlyChart 
                          data={chart.data} 
                          layout={chart.layout} 
                          config={chart.config || { responsive: true }} 
                          style={{ width: '100%', minHeight: '380px' }} 
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loadingChat && (
              <div style={{ 
                alignSelf: 'flex-start', 
                background: 'var(--surface-light)', 
                padding: '0.75rem 1.25rem', 
                borderRadius: '10px', 
                fontSize: '0.9rem', 
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                Virtual Data Scientist is calculating & evaluating...
              </div>
            )}
          </div>

          {/* Input Row */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              className="input" 
              style={{ flex: 1 }}
              placeholder="Ask about ANOVA, Pareto effects, contour sweet spots, or ICH standards..." 
              value={chatInput} 
              onChange={e => setChatInput(e.target.value)} 
              onKeyDown={e => e.key === 'Enter' && handleSendChat()}
              disabled={loadingChat}
            />
            <button 
              type="button"
              className="btn btn-primary" 
              onClick={() => handleSendChat()} 
              disabled={loadingChat || !chatInput.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}

      <div className="step-nav">
        <button className="btn btn-secondary" onClick={() => setStep(isBayesianEnabled ? 'more-improvement' : 'enough-data')}>← Back</button>
        <div style={{ display:'flex', gap:'0.75rem' }}>
          <button className="btn btn-secondary" onClick={handleRecalculate} disabled={loading}>↺ Recalculate</button>
          <button className="btn btn-primary" onClick={() => setStep('report')}>
            Generate Report →
          </button>
        </div>
      </div>
    </div>
  )
}
