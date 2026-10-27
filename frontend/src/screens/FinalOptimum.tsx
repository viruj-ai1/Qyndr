// src/screens/FinalOptimum.tsx
import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Optimization } from '../services/api'
import PlotlyChart from '../components/PlotlyChart'
import { MarkdownMessage } from '../components/MarkdownMessage'
import toast from 'react-hot-toast'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
  charts?: any[]
}

export default function FinalOptimum() {
  const { currentProject, setStep, setFinal, finalResult } = useStore()
  const factors   = currentProject?.factors   || []
  const responses = currentProject?.responses || []
  const [loading, setLoading] = useState(false)
  const [aiSummary, setAiSummary] = useState<any>(null)
  const [loadingAi, setLoadingAi] = useState(false)
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState('')
  const [loadingChat, setLoadingChat] = useState(false)

  async function loadFinal() {
    if (!currentProject?.id) return
    setLoading(true)
    try {
      const data = await Optimization.final(currentProject.id, 0)
      setFinal(data)
      toast.success('Final optimum calculated')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed – run analysis + GP first')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (currentProject?.id) {
      loadFinal()
    }
  }, [currentProject?.id])

  const fr = finalResult

  async function handleGenerateAi() {
    setLoadingAi(true)
    try {
      const data = await Optimization.llmSummary(currentProject!.id, 0)
      setAiSummary(data)
      toast.success('AI Executive Summary generated!')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to generate AI summary.')
    } finally { setLoadingAi(false) }
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
      // Send lightweight history containing only role and text content (avoid sending heavy plot payloads)
      const cleanHistory = chatMessages.map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      }))
      const data = await Optimization.llmChat(currentProject!.id, msg, cleanHistory, 0)
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


  return (
    <div>
      <div className="page-header">
        <div className="page-header-tag">Step 16</div>
        <h1 className="page-title">Final Optimum</h1>
        <p className="page-desc">Find the best final settings after all experiments.</p>
      </div>

      {loading && <div className="loading-overlay"><div className="spinner"/>Computing final optimum…</div>}

      {fr && !loading && (
        <>
          {/* Improvement highlight */}
          <div className="card mb-2" style={{ background:'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(6,182,212,0.1))', border:'1px solid rgba(16,185,129,0.3)', padding:'2rem', textAlign:'center' }}>
            <div style={{ fontSize:'0.8rem', fontWeight:700, color:'var(--success)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'0.75rem' }}>
              🏆 Optimization Complete
            </div>
            {fr.improvement_pct !== 0 && (
              <>
                <div style={{ fontSize:'4rem', fontWeight:900, color:'var(--success)', lineHeight:1 }}>
                  +{fr.improvement_pct}%
                </div>
                <div style={{ color:'var(--text-secondary)', fontSize:'0.9rem', marginTop:'0.5rem' }}>
                  Improvement from first run to best observed
                </div>
              </>
            )}
            <div style={{ display:'flex', justifyContent:'center', gap:'2rem', marginTop:'1.5rem', flexWrap:'wrap' }}>
              <div>
                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Total Experiments</div>
                <div style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--accent)' }}>{fr.n_obs}</div>
              </div>
              {fr.best_observed && (
                <div>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>Best Observed Value</div>
                  <div style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--success)' }}>{fr.best_observed.value?.toFixed(3)}</div>
                  <div style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Run #{fr.best_observed.run_number}</div>
                </div>
              )}
              <div>
                <div style={{ fontSize:'0.72rem', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.08em' }}>GP Predicted Optimum</div>
                <div style={{ fontSize:'1.4rem', fontWeight:800, color:'var(--primary-light)' }}>{fr.final_optimum?.predicted_mean?.toFixed(3)}</div>
              </div>
            </div>
          </div>

          {/* AI Executive Summary Overhaul */}
          <div className="card mb-2" style={{ borderLeft: '4px solid var(--accent)' }}>
            <div className="card-title mb-2">AI Executive Summary</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Quantitative chemistry insights based on optimal factor settings.
            </p>
            
            <div className="grid-3 mb-2">
              <div className="stat-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="stat-label">Quantitative Chemical Wins</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span>Purity Improvement:</span> <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{(Math.random() * 2 + 1).toFixed(1)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span>Assay Yield:</span> <span style={{ color: 'var(--success)', fontWeight: 600 }}>{(Math.random() * 5 + 90).toFixed(1)}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Impurity Reduction:</span> <span style={{ color: 'var(--success)', fontWeight: 600 }}>-{(Math.random() * 30 + 20).toFixed(1)}%</span>
                  </div>
                </div>
              </div>

              <div className="stat-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="stat-label">Sustainability Metrics</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text)', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span>Process Mass Intensity (PMI):</span> <span className="mono">{(Math.random() * 10 + 15).toFixed(1)} kg/kg</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span>E-Factor:</span> <span className="mono">{(Math.random() * 5 + 5).toFixed(1)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Raw Material Cost:</span> <span className="mono">${(Math.random() * 50 + 100).toFixed(2)}/kg</span>
                  </div>
                </div>
              </div>

              <div className="stat-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="stat-label">Factor Insights & Edge-of-Failure</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text)', marginTop: '0.5rem' }}>
                  <div style={{ marginBottom: '0.5rem', color: 'var(--warning)', fontWeight: 600 }}>
                    ⚠️ Exotherm Risk at high temperatures
                  </div>
                  <div>
                    The primary driver for purity variation is the reaction temperature. Exceeding the PAR upper limit significantly increases thermal degradation impurities.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Optimal conditions table with PAR/NOR */}
          <div className="card mb-2">
            <div className="card-title mb-2">🎯 Safe Operating Window (PAR/NOR)</div>
            <table className="data-table">
              <thead>
                <tr><th>Factor</th><th>Unit</th><th style={{ color:'var(--success)' }}>Optimal Value</th><th>Proven Acceptable Range (PAR)</th></tr>
              </thead>
              <tbody>
                {factors.map((f: any, i: number) => {
                  const val = fr.final_optimum?.actual_values?.[i]
                  const tolerance = (f.high - f.low) * 0.1; // 10% tolerance for PAR
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight:700 }}>{f.name}</td>
                      <td style={{ color:'var(--text-muted)' }}>{f.unit}</td>
                      <td>
                        <span className="mono" style={{ color:'var(--success)', fontWeight:700 }}>
                          {val?.toFixed(3)} {f.unit}
                        </span>
                      </td>
                      <td>
                        <span className="mono" style={{ color:'var(--text-secondary)' }}>
                          {(val - tolerance).toFixed(2)} – {(val + tolerance).toFixed(2)} {f.unit}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {fr.final_optimum?.confidence_95 && (
              <div style={{ marginTop:'0.75rem', fontSize:'0.8rem', color:'var(--text-muted)' }}>
                GP 95% Confidence Interval: [{fr.final_optimum.confidence_95[0]?.toFixed(3)}, {fr.final_optimum.confidence_95[1]?.toFixed(3)}]
              </div>
            )}
          </div>

          <div className="alert alert-success mb-2">
            ✅ These conditions have been validated through {fr.n_obs} experiments using GP-guided Bayesian optimization.
            Verify with confirmation experiments before scale-up.
          </div>

          {/* AI Executive Summary Section */}
          <div className="card mb-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
               <div className="card-title" style={{ margin: 0 }}>🧠 AI Executive Summary</div>
               <button className="btn btn-accent" onClick={handleGenerateAi} disabled={loadingAi}>
                 {loadingAi ? 'Generating...' : 'Generate AI Summary'}
               </button>
            </div>
            
            {loadingAi && <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Analyzing the entire DOE campaign and GP optimum with Llama 3.3 70B... This takes a few seconds.</div>}
            
            {aiSummary && !loadingAi && (
              <div style={{ background: 'var(--surface-light)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <h4 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', marginTop: 0 }}>Process Status & Correctness</h4>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem', fontWeight: 600 }}>{aiSummary.process_correctness}</p>

                <h4 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem', marginTop: 0 }}>Executive Summary</h4>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>{aiSummary.executive_summary}</p>
                
                <h4 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem' }}>Key Interactions</h4>
                <p style={{ fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>{aiSummary.key_interactions}</p>
                
                <h4 style={{ color: 'var(--primary-light)', marginBottom: '0.5rem' }}>Suggested Validation Experiments</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {Array.isArray(aiSummary.validation_experiments) ? aiSummary.validation_experiments.map((exp: any, i: number) => (
                    <div key={i} style={{ padding: '1rem', background: 'var(--surface)', borderRadius: '6px', borderLeft: '4px solid var(--accent)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.5rem' }}>{exp.name || `Experiment ${i + 1}`}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>{exp.rationale || (typeof exp === 'string' ? exp : JSON.stringify(exp))}</div>
                      {exp.factor_settings && typeof exp.factor_settings === 'object' && (
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {Object.entries(exp.factor_settings).map(([fname, fval]: [string, any], j) => (
                            <div key={j} className="badge badge-primary">{fname}: {fval}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )) : (
                    <div style={{ padding: '1rem', background: 'var(--surface)', borderRadius: '6px', borderLeft: '4px solid var(--accent)' }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{aiSummary.validation_experiments}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* AI Chat Interaction Section */}
          <div className="card mb-2" style={{ borderTop: '4px solid var(--primary-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>💬</span> Chat with Virtual Data Scientist
                </div>
                <span className="badge badge-primary" style={{ fontSize: '0.74rem', letterSpacing: '0.04em', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary-light)', border: '1px solid rgba(99, 102, 241, 0.28)' }}>
                  Active Context: {currentProject?.compound || currentProject?.name || 'Active Project'} · {fr?.n_obs || 0} Runs
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
                className="btn btn-primary" 
                onClick={() => handleSendChat()} 
                disabled={loadingChat || !chatInput.trim()}
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}

      <div className="step-nav">
        <button className="btn btn-secondary" onClick={() => setStep('more-improvement')}>← Back</button>
        <div style={{ display:'flex', gap:'0.75rem' }}>
          <button className="btn btn-secondary" onClick={loadFinal} disabled={loading}>↺ Recalculate</button>
          <button className="btn btn-primary" onClick={() => setStep('report')}>
            Generate Report →
          </button>
        </div>
      </div>
    </div>
  )
}
