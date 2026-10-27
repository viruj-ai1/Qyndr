import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { DOE, Projects } from '../services/api'
import toast from 'react-hot-toast'
import PreRunDiagnosticsModal from './PreRunDiagnosticsModal'
import DoEManualModal from '../components/DoEManualModal'
import { DoECategory } from '../utils/doeManualData'
import { BookOpen, ExternalLink, Sparkles, ArrowRight } from 'lucide-react'

const KEY_TO_MANUAL_ID: Record<string, string> = {
  PB: 'pb',
  FF: 'fractional_factorial',
  FF_S: 'fractional_factorial',
  TAGUCHI: 'taguchi',
  DSD: 'dsd',
  CCD_FC: 'ccd',
  CCD_ROT: 'ccd',
  BBD: 'bbd',
  MIXTURE: 'mixture',
  D_OPTIMAL: 'd_optimal',
  BAYESIAN_GP: 'bayesian_gp'
}

export default function RecommendDOE() {
  const { currentProject, setProject, setStep } = useStore()
  const [phase, setPhase]           = useState<'screening'|'optimization'>('screening')
  const [options, setOptions]       = useState<any[]>([])
  const [selected, setSelected]     = useState<string>('')
  const [loading, setLoading]       = useState(false)
  const [errorMsg, setErrorMsg]     = useState<string | null>(null)
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false)
  const [showManualModal, setShowManualModal]           = useState(false)
  const [manualInitialTab, setManualInitialTab]         = useState<'wizard' | 'matrix' | 'deep-dives'>('wizard')
  const [manualInitialDesignId, setManualInitialDesignId] = useState<string | undefined>(undefined)

  async function loadOptions(ph: string, preferredKey?: string) {
    if (!currentProject?.id) return
    setLoading(true)
    setErrorMsg(null)
    try {
      const data = await DOE.recommend(currentProject.id, ph)
      const opts = data.options || []
      setOptions(opts)
      const targetKey = preferredKey || selected
      const keyExists = opts.some((o: any) => o.key === targetKey)
      if (keyExists && targetKey) {
        setSelected(targetKey)
      } else {
        const rec = opts.find((o: any) => o.recommended)
        setSelected(rec?.key || opts[0]?.key || '')
      }
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

  function handleSelectFromManual(designKey: string, category: DoECategory) {
    const targetPhase: 'screening' | 'optimization' = category === 'Screening' ? 'screening' : 'optimization'
    setSelected(designKey)
    if (phase !== targetPhase) {
      setPhase(targetPhase)
      loadOptions(targetPhase, designKey)
    }
    setShowManualModal(false)
    toast.success(`Applied ${designKey} design from Manual`, { icon: '🎯' })
  }

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
        <p className="page-desc">The system suggests the best experiment plan based on quality-by-design principles.</p>
      </div>

      {/* Top Banner: DoE Selection Manual & Strategy Guide */}
      <div
        className="card mb-2"
        style={{
          background: 'linear-gradient(135deg, rgba(0, 91, 170, 0.08) 0%, rgba(0, 174, 179, 0.08) 100%)',
          border: '1.5px solid rgba(0, 91, 170, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.1rem 1.35rem',
          borderRadius: '14px',
          boxShadow: '0 4px 15px rgba(0, 91, 170, 0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '1.35rem',
              boxShadow: '0 4px 12px rgba(0, 91, 170, 0.22)',
              flexShrink: 0
            }}
          >
            📖
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                DoE Selection Wizard & Strategy Guide
              </h3>
              <span className="badge badge-accent" style={{ fontSize: '0.7rem', padding: '1px 7px', fontWeight: 700 }}>
                ICH Q8(R2) Aligned
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              Minimal 3-question guided visual stepper to recommend the optimal experimental design in under 10 seconds.
            </p>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setManualInitialDesignId(undefined)
            setShowManualModal(true)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            whiteSpace: 'nowrap',
            fontWeight: 700,
            padding: '0.55rem 1.15rem',
            borderRadius: '8px'
          }}
        >
          <BookOpen size={16} />
          <span>Open 3-Question Wizard</span>
          <ArrowRight size={15} />
        </button>
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
                style={{
                  cursor: 'pointer',
                  padding: '1.15rem',
                  border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: '10px',
                  background: isSelected ? 'rgba(0, 91, 170, 0.05)' : '#ffffff',
                  boxShadow: isSelected ? '0 4px 15px rgba(0, 91, 170, 0.08)' : 'var(--shadow-sm)',
                  transition: 'all 0.18s'
                }}
              >
                {opt.recommended && (
                  <div style={{ marginBottom: '0.4rem', color: 'var(--success)', fontWeight: 700, fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Sparkles size={14} color="var(--success)" />
                    <span>Algorithmic Top Recommendation for Active Factor Set</span>
                  </div>
                )}
                <div style={{ display:'flex', alignItems:'flex-start', gap:'1rem' }}>
                  <div style={{ fontSize:'2rem', lineHeight:1 }}>{icons[opt.key]||'📐'}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div className="design-option-title" style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)' }}>{opt.label}</div>
                      <div style={{ fontSize:'0.78rem', color:'var(--primary)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Key: {opt.key}</div>
                    </div>
                    <div style={{ fontSize:'0.82rem', color:'var(--primary)', marginBottom:'0.3rem', fontWeight: 600 }}>{opt.design_type}</div>
                    <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', lineHeight:1.5 }}>{opt.description}</div>
                    
                    {/* Badges & Inline Rationale Link */}
                    <div style={{ display:'flex', justifyContent: 'space-between', alignItems: 'center', marginTop:'0.75rem', flexWrap:'wrap', gap:'0.6rem' }}>
                      <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
                        <span className="badge badge-accent">Total: {opt.n_runs} runs</span>
                        <span className="badge badge-primary">{opt.resolution}</span>
                        {opt.n_center > 0 && <span className="badge badge-warning">{opt.n_center} center pts</span>}
                        {opt.n_axial > 0  && <span className="badge badge-warning">{opt.n_axial} axial pts</span>}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          const targetId = KEY_TO_MANUAL_ID[opt.key] || 'dsd'
                          setManualInitialDesignId(targetId)
                          setManualInitialTab('deep-dives')
                          setShowManualModal(true)
                        }}
                        style={{
                          background: 'rgba(0, 91, 170, 0.08)',
                          border: '1px solid rgba(0, 91, 170, 0.25)',
                          padding: '0.3rem 0.65rem',
                          borderRadius: '6px',
                          color: 'var(--primary)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 91, 170, 0.15)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 91, 170, 0.08)')}
                      >
                        <BookOpen size={13} />
                        <span>Why this design? View scientific rationale in Manual</span>
                        <ExternalLink size={12} />
                      </button>
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
            className="btn btn-secondary"
            onClick={() => {
              setManualInitialDesignId(undefined)
              setShowManualModal(true)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <BookOpen size={15} />
            <span>🧙‍♂️ DoE Selection Wizard</span>
          </button>
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

      <DoEManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        onSelectDesign={handleSelectFromManual}
        initialTab={manualInitialTab}
        initialDesignId={manualInitialDesignId}
      />
    </div>
  )
}


