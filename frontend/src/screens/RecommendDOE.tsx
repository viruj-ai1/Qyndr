import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { DOE, Projects } from '../services/api'
import toast from 'react-hot-toast'
import PreRunDiagnosticsModal from './PreRunDiagnosticsModal'
import DoEManualModal from '../components/DoEManualModal'
import { DoECategory } from '../utils/doeManualData'
import { getLocalRecommendations } from '../utils/doeLocalRecommender'
import { EXPERIMENT_PHASES, PhaseInfo } from '../utils/experimentPhaseData'
import { BookOpen, ExternalLink, Sparkles, ArrowRight, RefreshCw, AlertCircle, Info, X } from 'lucide-react'

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
  const [isOfflineFallback, setIsOfflineFallback] = useState(false)
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false)
  const [showManualModal, setShowManualModal]           = useState(false)
  const [manualInitialTab, setManualInitialTab]         = useState<'wizard' | 'matrix' | 'deep-dives'>('wizard')
  const [manualInitialDesignId, setManualInitialDesignId] = useState<string | undefined>(undefined)
  const [activeInfoPhase, setActiveInfoPhase]           = useState<'screening' | 'optimization' | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const infoBtnScreeningRef = useRef<HTMLButtonElement | null>(null)
  const infoBtnOptimizationRef = useRef<HTMLButtonElement | null>(null)

  // Close popover when clicking outside or pressing Escape
  useEffect(() => {
    if (!activeInfoPhase) return

    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        const btnRef = activeInfoPhase === 'screening' ? infoBtnScreeningRef.current : infoBtnOptimizationRef.current
        if (btnRef && btnRef.contains(event.target as Node)) {
          return
        }
        setActiveInfoPhase(null)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        const currentPhase = activeInfoPhase
        setActiveInfoPhase(null)
        if (currentPhase === 'screening') {
          infoBtnScreeningRef.current?.focus()
        } else if (currentPhase === 'optimization') {
          infoBtnOptimizationRef.current?.focus()
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeInfoPhase])

  // Helper to ensure strictly at most one design has recommended === true
  function enforceSingleRecommendation(rawOpts: any[]): any[] {
    let foundFirst = false
    return rawOpts.map((opt) => {
      if (opt.recommended) {
        if (!foundFirst) {
          foundFirst = true
          return opt
        }
        return { ...opt, recommended: false }
      }
      return opt
    })
  }

  async function loadOptions(ph: 'screening' | 'optimization', preferredKey?: string) {
    if (!currentProject?.id) return
    const projectFactors = currentProject.factors || []

    // If factors are not defined, guide user to Step 07
    if (projectFactors.length === 0) {
      setErrorMsg('No process factors found. Process factors must be defined in Step 07 before generating DOE recommendations.')
      setOptions([])
      return
    }

    setLoading(true)
    setErrorMsg(null)
    setIsOfflineFallback(false)

    try {
      const data = await DOE.recommend(currentProject.id, ph)
      const opts = enforceSingleRecommendation(data.options || [])
      if (opts.length > 0) {
        setOptions(opts)
        const targetKey = preferredKey || selected
        const keyExists = opts.some((o: any) => o.key === targetKey)
        if (keyExists && targetKey) {
          setSelected(targetKey)
        } else {
          const rec = opts.find((o: any) => o.recommended)
          setSelected(rec?.key || opts[0]?.key || '')
        }
        return
      }
      throw new Error('No design options returned from backend server')
    } catch (e: any) {
      console.warn('Backend recommendation error/timeout, applying offline algorithmic recommender:', e)
      const detail = e.response?.data?.detail || e.message || 'API connection unavailable'

      // Check if it's truly an issue of zero factors defined on backend
      if (typeof detail === 'string' && detail.toLowerCase().includes('no factors')) {
        setErrorMsg('Process factors must be defined for this project in Step 07 before generating DOE design recommendations.')
        setOptions([])
        return
      }

      // Automatically fallback to client-side algorithmic recommender based on active factors
      const fallbackOpts = enforceSingleRecommendation(getLocalRecommendations(projectFactors.length, ph))
      setOptions(fallbackOpts)
      setIsOfflineFallback(true)

      const targetKey = preferredKey || selected
      const keyExists = fallbackOpts.some(o => o.key === targetKey)
      if (keyExists && targetKey) {
        setSelected(targetKey)
      } else {
        const rec = fallbackOpts.find(o => o.recommended)
        setSelected(rec?.key || fallbackOpts[0]?.key || '')
      }

      if (e.code === 'ECONNABORTED' || (e.message && e.message.includes('timeout'))) {
        toast('Loaded algorithmic recommendations (offline mode)', { icon: '⚡' })
      }
    } finally {
      setLoading(false)
    }
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
            <button className="btn btn-secondary" onClick={() => setStep('stage-campaign-matrix')}>Campaign Matrix</button>
          </div>
        </div>
      </div>
    )
  }

  const icons: Record<string,string> = { FF:'🔢', FF_S:'🔢', PB:'📊', TAGUCHI:'⚙️', CCD_FC:'🎯', CCD_ROT:'🌀', BBD:'🔷', MIXTURE:'🧪', DSD:'⚡', D_OPTIMAL:'🎯', SPLIT_PLOT:'🧱' }

  return (
    <div>
      <div className="page-header">
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
      <div className="card mb-2" style={{ position: 'relative' }}>
        <div className="card-title mb-2">Experiment Phase</div>
        <div style={{ display:'flex', gap:'0.75rem', flexWrap: 'wrap' }}>
          {(['screening', 'optimization'] as const).map((pk) => {
            const pInfo = EXPERIMENT_PHASES[pk]
            const isSelected = phase === pk
            const isInfoOpen = activeInfoPhase === pk
            const btnRef = pk === 'screening' ? infoBtnScreeningRef : infoBtnOptimizationRef

            return (
              <div
                key={pk}
                onClick={() => setPhase(pk)}
                style={{
                  flex: 1,
                  minWidth: '260px',
                  position: 'relative',
                  padding: '1rem',
                  border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius)',
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
                  transition: 'all 0.2s'
                }}
              >
                {/* Header row with Title and Info Icon */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.3rem' }}>
                  <div style={{ fontWeight: 700, color: isSelected ? 'var(--primary-light)' : 'var(--text-primary)' }}>
                    {pInfo.title === 'Screening' ? 'Screening (Classical & DSD)' : 'Optimization / RSM'}
                  </div>

                  <button
                    ref={btnRef}
                    type="button"
                    aria-label={`About ${pInfo.title} phase`}
                    aria-expanded={isInfoOpen}
                    aria-controls={`phase-popover-${pk}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveInfoPhase(prev => (prev === pk ? null : pk))
                    }}
                    style={{
                      border: 'none',
                      background: isInfoOpen ? 'var(--primary)' : 'rgba(0, 91, 170, 0.08)',
                      color: isInfoOpen ? '#ffffff' : 'var(--primary)',
                      borderRadius: '50%',
                      width: '24px',
                      height: '24px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'all 0.15s ease-in-out',
                      padding: 0
                    }}
                    title={`About ${pInfo.title} phase`}
                  >
                    <Info size={14} />
                  </button>
                </div>

                <div style={{ fontSize:'0.78rem', color:'var(--text-secondary)' }}>
                  {pInfo.subtitle}
                </div>

                {/* Popover anchored to the card */}
                {isInfoOpen && (
                  <div
                    id={`phase-popover-${pk}`}
                    ref={popoverRef}
                    role="tooltip"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 10px)',
                      right: 0,
                      width: '320px',
                      maxWidth: 'calc(100vw - 32px)',
                      background: '#ffffff',
                      border: '1.5px solid var(--primary)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 30px rgba(0, 91, 170, 0.16), 0 4px 10px rgba(0,0,0,0.06)',
                      padding: '1.1rem',
                      zIndex: 100,
                      animation: 'popoverFadeScale 120ms ease-out forwards',
                      color: 'var(--text-primary)',
                      cursor: 'default',
                      textAlign: 'left'
                    }}
                  >
                    {/* Popover Top Arrow */}
                    <div
                      style={{
                        position: 'absolute',
                        top: '-8px',
                        right: '18px',
                        width: '14px',
                        height: '14px',
                        background: '#ffffff',
                        borderLeft: '1.5px solid var(--primary)',
                        borderTop: '1.5px solid var(--primary)',
                        transform: 'rotate(45deg)'
                      }}
                    />

                    {/* Popover Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.65rem' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.98rem', color: 'var(--primary)' }}>
                        {pInfo.title}
                      </div>
                      <button
                        type="button"
                        aria-label="Close details"
                        onClick={() => {
                          setActiveInfoPhase(null)
                          btnRef.current?.focus()
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '4px'
                        }}
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {/* Popover Sections */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.79rem', lineHeight: 1.45 }}>
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)' }}>Purpose</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>{pInfo.purpose}</span>
                      </div>

                      <div>
                        <strong style={{ display: 'block', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#059669' }}>Use when</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>{pInfo.useWhen}</span>
                      </div>

                      <div>
                        <strong style={{ display: 'block', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)' }}>You get</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>{pInfo.youGet}</span>
                      </div>

                      <div>
                        <strong style={{ display: 'block', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#dc2626' }}>Not for</strong>
                        <span style={{ color: 'var(--text-secondary)' }}>{pInfo.notFor}</span>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.45rem', marginTop: '0.2rem' }}>
                        <strong style={{ display: 'block', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)' }}>Designs</strong>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{pInfo.designs}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {isOfflineFallback && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.82rem', color: '#1e40af' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={15} color="#2563eb" />
            <span>Showing optimal algorithmic recommendations for <strong>{currentProject?.factors?.length || 4} defined factors</strong>.</span>
          </div>
          <button
            onClick={() => loadOptions(phase)}
            style={{ background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: '4px', padding: '0.2rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, color: '#1d4ed8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <RefreshCw size={12} />
            <span>Refresh Backend</span>
          </button>
        </div>
      )}

      {errorMsg ? (
        <div className="card mb-2" style={{ border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)', padding: '1.25rem' }}>
          <div style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} color="var(--danger)" />
            <span>{errorMsg}</span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Process factors must be defined for this project in Step 07 before generating DOE design recommendations.
          </p>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setStep('define-factors')}>
              ← Go to Step 07: Define Factors & Responses
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => loadOptions(phase)}>
              🔄 Retry Connection
            </button>
          </div>
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


