import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { Projects, Analysis } from '../../services/api'
import toast from 'react-hot-toast'
import AuditTrailModal from '../../screens/AuditTrailModal'
import logo from '../../assets/logo.png'

export default function Header() {
  const { currentProject, stages, activeStageId, setStep, setProject, setAnalysis, setOptimum } = useStore()
  const [showAuditModal, setShowAuditModal] = useState(false)
  const [loadingPreset, setLoadingPreset] = useState(false)

  const activeStage = stages.find(s => s.id === activeStageId)

  async function handleLoadPreset() {
    setLoadingPreset(true)
    try {
      const proj = await Projects.loadRocuroniumPreset()
      setProject(proj)
      setOptimum(null)
      try {
        const res = await Analysis.runAll(proj.id)
        if (res && typeof res === 'object') {
          Object.entries(res).forEach(([idx, a]) => setAnalysis(+idx, a))
        }
        const opt = await Analysis.optimize(proj.id)
        if (opt) setOptimum(opt)
      } catch (err) {
        console.warn('Preset analysis load:', err)
      }
      toast.success('Loaded ROCURONIUM BROMIDE STAGE-I process dataset!')
      setStep('initial-optimization')
    } catch (e: any) {
      toast.error('Failed to load preset dataset')
    } finally {
      setLoadingPreset(false)
    }
  }

  return (
    <>
      <header className="app-header">
        <div className="header-logo">
          <img src={logo} alt="Viruj Pharma" style={{ height: '44px', objectFit: 'contain' }} />
          <div>
            <div className="logo-sub" style={{ marginTop: '4px' }}>Viruj Chematrix</div>
          </div>
        </div>

        <div className="header-project-name">
          {currentProject ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-muted)' }}>Project:</span>
              <span style={{ color: 'var(--primary-light)', fontWeight: 700 }}>{currentProject.name}</span>
              {currentProject.compound && (
                <span style={{ color: 'var(--accent)', fontSize: '0.78rem' }}>
                  · {currentProject.compound}
                </span>
              )}

              {activeStage && (
                <span className="badge badge-primary" style={{ marginLeft: '0.5rem', fontSize: '0.72rem' }}>
                  Active Stage: {activeStage.name}
                </span>
              )}
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No project loaded</span>
          )}
        </div>

        <div className="header-actions">

          {currentProject && (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAuditModal(true)}>
              📜 Audit Log
            </button>
          )}

          <button className="btn btn-secondary btn-sm" onClick={() => setStep('campaign-dashboard')}>
            Campaign Matrix
          </button>

          <button className="btn btn-secondary btn-sm" onClick={() => setStep('welcome')}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
            </svg>
            Dashboard
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => { setProject(null); setStep('create-project'); }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Project
          </button>
        </div>
      </header>

      {showAuditModal && (
        <AuditTrailModal onClose={() => setShowAuditModal(false)} />
      )}
    </>
  )
}

