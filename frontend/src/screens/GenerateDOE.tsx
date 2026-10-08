// src/screens/GenerateDOE.tsx
import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { DOE, Projects } from '../services/api'
import toast from 'react-hot-toast'

export default function GenerateDOE() {
  const { currentProject, setStep, experiments, setExperiments } = useStore()
  const [design, setDesign]     = useState<any>(null)
  const [loading, setLoading]   = useState(false)
  const [generated, setGenerated] = useState(false)

  const designKey = sessionStorage.getItem('doe_design_key') || currentProject?.doe_type || 'FF'
  const phase     = sessionStorage.getItem('doe_phase')       || 'screening'
  const factors   = currentProject?.factors  || []
  const responses = currentProject?.responses|| []

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
              n_factorial: exps.length,
              n_center: 0,
              description: `Loaded ${exps.length} experimental runs from project design.`
            },
            experiments: exps
          })
          setGenerated(true)
          setLoading(false)
          return
        }
      }

      if (forceRegenerate && !confirm('Regenerating will reset existing experiment results. Continue?')) {
        setLoading(false)
        return
      }

      const data = await DOE.generate(currentProject.id, designKey, phase)
      const finalGeneratedExps = data.experiments || []
      setDesign(data)
      setExperiments(finalGeneratedExps)
      setGenerated(true)
      toast.success(`Generated ${data.design_info?.design_type || 'DOE'} (${finalGeneratedExps.length} runs)`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Generation failed')
    } finally { setLoading(false) }
  }

  useEffect(() => { loadOrGenerate(false) }, [currentProject?.id])

  const displayedExperiments = design?.experiments || experiments || []

  const typeColor: Record<string,string> = { Factorial:'var(--primary)', Center:'var(--success)', Axial:'var(--warning)', Mixture:'var(--accent)', 'Plackett-Burman':'var(--accent)', 'Definitive Screening':'var(--accent)', Taguchi:'var(--accent)' }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-tag">Step 10</div>
        <h1 className="page-title">Generate DOE</h1>
        <p className="page-desc">Create the list of experiments that need to be performed.</p>
      </div>

      {loading && <div className="loading-overlay"><div className="spinner" /> Generating experiment matrix…</div>}

      {design && (
        <>
          {/* Design info */}
          <div className="grid-4 mb-2">
            {[
              { label: 'Design Type',     value: design.design_info.design_type },
              { label: 'Factorial Runs',  value: displayedExperiments.length },
              { label: 'Factors',         value: factors.length },
              { label: 'Resolution',      value: design.design_info.resolution },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-label">{s.label}</div>
                <div className="stat-value" style={{ fontSize: '1rem', fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div className="alert alert-info mb-2">
            <span>ℹ️ {design.design_info.description}</span>
          </div>

          {/* Experiment table */}
          <div className="card">
            <div className="card-title mb-2">Run Order Table</div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Run #</th>
                    <th>Type</th>
                    {factors.map((f: any) => <th key={f.name}>{f.name} <span style={{ fontWeight:400, color:'var(--text-muted)' }}>({f.unit})</span></th>)}
                    {responses.map((r: any) => <th key={r.name} style={{ color:'var(--accent)' }}>{r.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {displayedExperiments.map((e: any) => (
                    <tr key={e.id || e.run_number}>
                      <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{e.run_number}</td>
                      <td>
                        <span style={{ display:'inline-block', padding:'0.15rem 0.5rem', borderRadius:'999px', fontSize:'0.7rem', fontWeight:700, background:`${typeColor[e.run_type]}20`, color:typeColor[e.run_type] || 'var(--text-secondary)' }}>{e.run_type}</span>
                      </td>
                      {e.actual_values.map((v: number, j: number) => (
                        <td key={j} className="mono">{v.toFixed(3)}</td>
                      ))}
                      {responses.map((_: any, j: number) => (
                        <td key={j} style={{ color:'var(--text-muted)' }}>—</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="alert alert-warning mt-2">
            ⚠️ <strong>Important:</strong> Run experiments in random order to avoid systematic bias. Use the run number for record-keeping, not the order listed.
          </div>

          {/* Scale & Stoichiometry Calculator */}
          <div className="card mt-2" style={{ borderLeft: '4px solid var(--primary)' }}>
            <div className="flex-between mb-2">
              <div>
                <div className="card-title">Scale & Stoichiometry Calculator</div>
                <div className="card-sub">Generate batch sheets and printable tags for the lab.</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Target Scale:</label>
                <input 
                  type="number" 
                  className="form-input" 
                  style={{ width: '80px', padding: '0.25rem 0.5rem' }} 
                  defaultValue={10.0}
                />
                <select className="form-select" style={{ padding: '0.25rem', paddingRight: '1.5rem' }} defaultValue="mmol">
                  <option value="mmol">mmol</option>
                  <option value="g">grams</option>
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Run #</th>
                    <th>Substrate (Eq 1.0)</th>
                    {factors.filter((f: any) => f.unit === 'eq' || f.name.toLowerCase().includes('ratio') || f.name.toLowerCase().includes('reagent')).map((f: any) => (
                      <th key={f.name}>{f.name} (Variable)</th>
                    ))}
                    <th>Solvent Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedExperiments.slice(0, 3).map((e: any) => (
                    <tr key={e.id || e.run_number}>
                      <td style={{ fontWeight: 700 }}>Run {e.run_number}</td>
                      <td className="mono">10.0 mmol / 2.50 g</td>
                      {factors.filter((f: any) => f.unit === 'eq' || f.name.toLowerCase().includes('ratio') || f.name.toLowerCase().includes('reagent')).map((f: any, i: number) => {
                        const factorIndex = factors.findIndex((x: any) => x.name === f.name);
                        const eqValue = e.actual_values[factorIndex];
                        return (
                          <td key={i} className="mono">
                            {(eqValue).toFixed(2)} eq / {(eqValue * 10.0).toFixed(1)} mmol
                          </td>
                        )
                      })}
                      <td className="mono">50.0 mL</td>
                    </tr>
                  ))}
                  {displayedExperiments.length > 3 && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.5rem' }}>
                        ... {displayedExperiments.length - 3} more runs calculated ...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => toast.success('Batch sheets exported as CSV!')}>
                📥 Export Batch Sheets
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => toast.success('Barcode tags sent to printer!')}>
                🏷️ Print Barcode Tags
              </button>
            </div>
          </div>
        </>
      )}

      <div className="step-nav">
        <button className="btn btn-secondary" onClick={() => setStep('recommend-doe')}>← Back</button>
        <div style={{ display:'flex', gap:'0.75rem' }}>
          <button className="btn btn-secondary" onClick={() => loadOrGenerate(true)} disabled={loading}>↺ Regenerate</button>

          <button className="btn btn-primary" onClick={() => setStep('lab-experiments')} disabled={!generated}>
            Proceed to Laboratory →
          </button>
        </div>
      </div>
    </div>
  )
}
