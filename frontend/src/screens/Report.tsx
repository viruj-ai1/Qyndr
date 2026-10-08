import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Reports } from '../services/api'

export default function Report() {
  const { currentProject, setStep, finalResult, optimumResult } = useStore()
  const factors   = currentProject?.factors   || []
  const responses = currentProject?.responses || []
  const [summaryData, setSummaryData] = useState<any>(null)

  useEffect(() => {
    if (currentProject) {
      Reports.summary(currentProject.id)
        .then(res => setSummaryData(res))
        .catch(err => console.error(err))
    }
  }, [currentProject?.id])

  const opt = finalResult?.final_optimum || optimumResult
  const traceMatrix = summaryData?.traceability_matrix || []

  return (
    <div>
      <div className="page-header">
        <div className="page-header-tag">Step 21</div>
        <h1 className="page-title">Generate Report</h1>
        <p className="page-desc">Create a report showing everything done in the project and the final result.</p>
      </div>

      {/* Project summary card */}
      <div className="card mb-2" style={{ background:'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(6,182,212,0.06))', border:'1px solid rgba(99,102,241,0.2)' }}>
        <div style={{ display:'flex', gap:'1rem', alignItems:'flex-start' }}>
          <div style={{ fontSize:'3rem' }}>📋</div>
          <div>
            <div style={{ fontWeight:800, fontSize:'1.2rem', marginBottom:'0.3rem' }}>{currentProject?.name}</div>
            {currentProject?.compound && <div style={{ color:'var(--accent)', fontSize:'0.88rem', marginBottom:'0.5rem' }}>{currentProject.compound}</div>}
            {currentProject?.objective && <div style={{ color:'var(--text-secondary)', fontSize:'0.82rem', lineHeight:1.6 }}>{currentProject.objective}</div>}
            <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.75rem', flexWrap:'wrap' }}>
              <span className="badge badge-primary">{factors.length} factors</span>
              <span className="badge badge-accent">{responses.length} responses</span>
              {currentProject?.doe_type && <span className="badge badge-warning">{currentProject.doe_type}</span>}
              {currentProject?.bayes_iter && currentProject.bayes_iter > 0 && <span className="badge badge-success">Bayes: {currentProject.bayes_iter} iters</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Opening QTPP -> CQA -> CPP/CMA -> DOE Traceability Matrix Table */}
      <div className="card mb-2" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--primary-light)' }}>
            QbD Traceability Matrix (QTPP → CQA → CPP/CMA → DOE Results)
          </h3>
          <span className="badge badge-accent">ICH Q8 Opening Summary</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th>Synthesis Stage</th>
                <th>Linked QTPP Attribute</th>
                <th>Target CQA</th>
                <th>Parameter Name</th>
                <th>RPN</th>
                <th>Criticality</th>
                <th>ANOVA Status</th>
              </tr>
            </thead>
            <tbody>
              {traceMatrix.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem' }}>
                    Phase 0 risk assessment traceability details will populate here upon completing Phase 0.
                  </td>
                </tr>
              ) : (
                traceMatrix.map((row: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{row.stage}</td>
                    <td style={{ color: 'var(--primary-light)' }}>{row.qtpp}</td>
                    <td style={{ color: 'var(--accent)' }}>{row.cqa}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{row.parameter}</td>
                    <td style={{ textAlign: 'center', fontWeight: 800 }}>{row.rpn}</td>
                    <td>
                      <span className={`badge ${row.is_critical ? 'badge-danger' : 'badge-secondary'}`}>
                        {row.is_critical ? 'Critical (CPP)' : 'Non-Critical'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${row.anova_status.includes('Significant') ? 'badge-success' : 'badge-secondary'}`}>
                        {row.anova_status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Optimal conditions summary with PAR/NOR */}
      {opt?.actual_optimum && (
        <div className="card mb-2">
          <div className="card-title mb-2">📌 Safe Operating Window (PAR/NOR)</div>
          <table className="data-table">
            <thead>
              <tr><th>Factor</th><th>Unit</th><th style={{ color:'var(--success)' }}>Optimal Value</th><th>Proven Acceptable Range (PAR)</th></tr>
            </thead>
            <tbody>
              {factors.map((f: any, i: number) => {
                const val = opt.actual_optimum?.[i]
                const tolerance = (f.high - f.low) * 0.1; // 10% tolerance for PAR
                return (
                  <tr key={i}>
                    <td style={{ fontWeight:700 }}>{f.name}</td>
                    <td style={{ color:'var(--text-muted)' }}>{f.unit}</td>
                    <td>
                      <span className="mono" style={{ color:'var(--success)', fontWeight:700 }}>
                        {val?.toFixed(2)} {f.unit}
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
        </div>
      )}

      {/* Report contents */}
      <div className="card mb-2">
        <div className="card-title mb-2">Report Contents</div>
        {[
          { icon: '🎯', title: 'QbD Foundation Traceability', desc: 'Complete QTPP → CQA → CPP/CMA risk matrix' },
          { icon: '🏢', title: 'AI Executive Summary',    desc: 'Quantitative Wins, Process Mass Intensity (PMI), E-Factor, Cost' },
          { icon: '⚗️', title: 'Factors & Responses',    desc: 'All input variables, physical guardrails, and response definitions' },
          { icon: '🔢', title: 'Experiment Matrix',       desc: 'Complete run table with actual executed values, lab notes, and HPLC references' },
          { icon: '⚖️', title: 'Batch Recipes',           desc: 'Stoichiometry sheet and scale-up notes based on generated runs' },
          { icon: '📊', title: 'Statistical Analysis',    desc: 'ANOVA, 4-in-1 residual diagnostics, Lack of fit, R² statistics' },
          { icon: '🌐', title: 'Design Space (PAR/NOR)',  desc: 'Safe operating ranges, sweet spot overlay, edge-of-failure warnings' },
          { icon: '🤖', title: 'Bayesian Optimization',   desc: 'GP model history and iteration-by-iteration improvement' },
        ].map((item, i) => (
          <div key={i} style={{ display:'flex', gap:'0.75rem', padding:'0.6rem 0', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontSize:'1.2rem', flexShrink:0 }}>{item.icon}</span>
            <div>
              <div style={{ fontWeight:600, fontSize:'0.85rem', marginBottom:'0.15rem' }}>{item.title}</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Download buttons */}
      <div className="card">
        <div className="card-title mb-2">📥 Download Report</div>
        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
          <button className="btn btn-primary btn-lg" onClick={() => Reports.pdf(currentProject!.id)}
            style={{ flex:1, justifyContent:'center' }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>
            </svg>
            Download PDF Report
          </button>
          <button className="btn btn-accent btn-lg" onClick={() => Reports.excel(currentProject!.id)}
            style={{ flex:1, justifyContent:'center' }}>
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/>
              <line x1="8" y1="10" x2="16" y2="18"/><line x1="16" y1="10" x2="8" y2="18"/>
            </svg>
            Download Excel Report
          </button>
        </div>
        <div style={{ marginTop:'1rem', fontSize:'0.78rem', color:'var(--text-muted)', lineHeight:1.6 }}>
          <strong>PDF:</strong> Fully formatted report with QTPP traceability matrix, 4-in-1 diagnostic plots, and design space overlay.<br/>
          <strong>Excel:</strong> Multi-sheet workbook with raw data, ANOVA results, and optimization history.
        </div>
      </div>

      <div style={{ textAlign:'center', marginTop:'2rem', color:'var(--text-muted)', fontSize:'0.82rem' }}>
        🎉 Congratulations! Your QbD + DOE + Bayesian optimization workflow is complete.
      </div>

      <div className="step-nav">
        <button className="btn btn-secondary" onClick={() => setStep('final-optimum')}>← Back</button>
        <button className="btn btn-secondary" onClick={() => setStep('campaign-dashboard')}>🏠 Campaign Matrix</button>
      </div>
    </div>
  )
}

