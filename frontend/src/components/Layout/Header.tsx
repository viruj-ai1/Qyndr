import { useStore } from '../../store/useStore'
import { useAuth } from '../../context/AuthContext'

export default function Header() {
  const { currentProject, stages, activeStageId, setStep, reset } = useStore()
  const { user, logout } = useAuth()

  const activeStage = stages.find(s => s.id === activeStageId)

  return (
    <header className="app-header">
      {/* Top-Left: Project Name & Details */}
      <div className="header-project-name">
        {currentProject ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.875rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Project:</span>
            <span style={{ color: 'var(--primary-light)', fontWeight: 700 }}>{currentProject.name}</span>
            {currentProject.compound && (
              <span style={{ color: 'var(--accent)', fontSize: '0.8125rem', fontWeight: 600 }}>
                · {currentProject.compound}
              </span>
            )}

            {activeStage && (
              <span className="badge badge-primary" style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.15rem 0.5rem' }}>
                Active Stage: {activeStage.name}
              </span>
            )}
          </div>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No project loaded</span>
        )}
      </div>

      {/* Top-Right: Actions & User Info */}
      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setStep('welcome')}>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
          Dashboard
        </button>
        <button className="btn btn-primary btn-sm" onClick={() => { reset(); setStep('create-project'); }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          New Project
        </button>

        {/* User Account / Logout */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem', paddingLeft: '0.75rem', borderLeft: '1px solid var(--border)' }}>
            <span
              style={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                background: 'rgba(0, 91, 170, 0.08)',
                padding: '0.2rem 0.6rem',
                borderRadius: '12px'
              }}
              title={`Logged in as ${user.username}`}
            >
              👤 {user.username}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={logout}
              title="Sign out of DOE"
              style={{ padding: '0.25rem 0.55rem', fontSize: '0.78rem' }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

