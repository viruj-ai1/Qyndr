import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { DOE, Projects } from '../services/api'
import toast from 'react-hot-toast'
import PreRunDiagnosticsModal from './PreRunDiagnosticsModal'

export default function RecommendDOE() {
  const { currentProject, setProject, setStep } = useStore()
  const [phase, setPhase]           = useState<'screening'|'optimization'>('screening')
  const [options, setOptions]       = useState<any[]>([])
  const [selected, setSelected]     = useState<string>('')
  const [loading, setLoading]       = useState(false)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false)

  async function loadOptions(ph: string) {
    if (!currentProject?.id) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const data = await DOE.recommend(currentProject.id, ph)
      setOptions(data.options || [])
      const rec = data.options?.find((o: any) => o.recommended)
      setSelected(rec?.key || data.options?.[0]?.key || '')
    } catch (e: any) {
      const detail = e.response?.data?.detail || e.message || 'Failed to load recommendations'
      setErrorMsg(detail)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (currentProject?.id) {
      loadOptions(phase)
    }
  }, [phase, currentProject?.id])

  const { setExperiments } = useStore()

  async function handleNext() {
    if (!selected) { toast.error('Please select a design'); return }
    sessionStorage.setItem('doe_design_key', selected)
    sessionStorage.setItem('doe_phase', phase)
    sessionStorage.setItem('force_generate_doe', 'true')
    setExperiments([])
    try {
      if (currentProject) {
        const proj = await Projects.update(currentProject.id, {
          doe_type: selected,
          current_step: 'generate-doe'
        })
        setProject(proj)
      }
    } catch {
      // Continue anyway
    }
    setStep('generate-doe')
  }

  if (!currentProject) {
    return (
      <div style={{ maxWidth: '860px' }}>
        <div className="page-header">
          <div className="page-header-tag">Step 04</div>
          <h1 className="page-title">Recommend DOE Design</h1>
          <p className="page-desc">Choose the right design for your experiment. The system recommends optimal classical & QbD designs based on your factors.</p>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
          <div style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem' }}>No Active Project Loaded</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Please select or create a project first before generating DOE recommendations.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => setStep('create-project')}>Create New Project</button>
            <button className="btn btn-secondary" onClick={() => setStep('campaign-dashboard')}>Campaign Matrix</button>
          </div>
        </div>
      </div>
    )
  }

  const icons: Record<string,string> = { FF:'🔢', FF_S:'🔢', PB:'📊', TAGUCHI:'⚙️', CCD_FC:'🎯', CCD_ROT:'🌀', BBD:'🔷', MIXTURE:'🧪', DSD:'⚡', D_OPTIMAL:'🎯', SPLIT_PLOT:'🧱' }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-tag">Step 09</div>
        <h1 className="page-title">Recommend DOE</h1>
        <p className="page-desc">The system suggests the best experiment plan.</p>
      </div>

      {/* Phase toggle */}
      <div className="card mb-2">
        <div className="card-title mb-2">Experiment Phase</div>
        <div style={{ display:'flex', gap:'0.75rem' }}>
          {[{k:'screening',label:'Screening (Classical & DSD)',desc:'Identify key factors (Definitive Screening, Fractional, PB)'},{k:'optimization',label:'Optimization / RSM',desc:'Model response surfaces (CCD, BBD, D-Optimal)'}].map(p=>(
            <div key={p.k}
              onClick={()=>setPhase(p.k as any)}
              style={{ flex:1, padding:'1rem', border:`2px solid ${phase===p.k?'var(--primary)':'var(--border)'}`, borderRadius:'var(--radius)', cursor:'pointer', background:phase===p.k?'rgba(99,102,241,0.1)':'var(--bg-card)', transition:'all 0.2s' }}>
              <div style={{ fontWeight:700, marginBottom:'0.3rem', color:phase===p.k?'var(--primary-light)':'var(--text-primary)' }}>{p.label}</div>
              <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {errorMsg ? (
        <div className="card mb-2" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>⚠️</span>
            <span>{errorMsg}</span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Process factors must be defined for this project in Step 03 before generating DOE design recommendations.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={() => setStep('define-factors')}>
            ← Go to Step 03: Define Factors
          </button>
        </div>
      ) : loading ? (
        <div className="loading-overlay"><div className="spinner" /> Calculating optimal design…</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
          {options.map((opt) => {
            const isSelected = selected === opt.key
            return (
              <div
                key={opt.key}
                className={`design-option ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelected(opt.key)}
                style={{ cursor: 'pointer', padding: '1rem', border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`, borderRadius: '8px', background: isSelected ? 'rgba(99,102,241,0.06)' : 'transparent' }}
              >
                {opt.recommended && (
                  <div style={{ marginBottom: '0.4rem', color: 'var(--success-light)', fontWeight: 600, fontSize: '0.82rem' }}>
                    ✨ Recommended Option
                  </div>
                )}
                <div style={{ display:'flex', alignItems:'flex-start', gap:'1rem' }}>
                  <div style={{ fontSize:'1.8rem', lineHeight:1 }}>{icons[opt.key]||'📐'}</div>
                  <div style={{ flex:1 }}>
                    <div className="design-option-title" style={{ fontWeight: 700, fontSize: '1rem' }}>{opt.label}</div>
                    <div style={{ fontSize:'0.82rem', color:'var(--primary-light)', marginBottom:'0.3rem' }}>{opt.design_type}</div>
                    <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)', lineHeight:1.5 }}>{opt.description}</div>
                    <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.5rem', flexWrap:'wrap' }}>
                      <span className="badge badge-accent">Total: {opt.n_runs} runs</span>
                      <span className="badge badge-primary">{opt.resolution}</span>
                      {opt.n_center > 0 && <span className="badge badge-warning">{opt.n_center} center pts</span>}
                      {opt.n_axial > 0  && <span className="badge badge-warning">{opt.n_axial} axial pts</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="step-nav" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
        <button className="btn btn-secondary" onClick={() => setStep('define-factors')}>← Back</button>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            className="btn btn-accent"
            onClick={() => setShowDiagnosticsModal(true)}
            disabled={!selected || loading || !!errorMsg}
          >
            🔍 Evaluate Pre-Run Diagnostics
          </button>
          <button className="btn btn-primary" onClick={handleNext} disabled={!selected||loading||!!errorMsg}>
            Generate Experiment Matrix →
          </button>
        </div>
      </div>

      {showDiagnosticsModal && currentProject && (
        <PreRunDiagnosticsModal
          projectId={currentProject.id}
          designKey={selected}
          onClose={() => setShowDiagnosticsModal(false)}
          onProceed={() => {
            setShowDiagnosticsModal(false)
            handleNext()
          }}
        />
      )}
    </div>
  )

}

