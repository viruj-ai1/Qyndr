import { useStore } from '../../store/useStore'
import { useAuth } from '../../context/AuthContext'

export default function Header() {
  const { currentProject, stages, activeStageId, setStep } = useStore()
  const { user, logout } = useAuth()

  const activeStage = stages.find(s => s.id === activeStageId)

  return (
    <header className="app-header">
      {/* Top-Left: User Profile & Project Name Details */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
        {/* User Badge moved to top-left */}
        {user && (
          <span
            style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              background: 'rgba(0, 91, 170, 0.08)',
              padding: '0.35rem 0.75rem',
              borderRadius: '999px',
              border: '1px solid var(--border)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
            title={user.username ? `Logged in as ${user.username}` : undefined}
          >
            👤 R&D Head
          </span>
        )}

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

              {stages.length >= 2 && activeStage && (
                <button
                  type="button"
                  className="badge badge-primary"
                  onClick={() => {
                    setStep('define-factors')
                    setTimeout(() => {
                      const el = document.getElementById('stage-switcher-section')
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }, 50)
                  }}
                  title="Click to jump to Stage section in Experiment Setup"
                  style={{
                    marginLeft: '0.5rem',
                    fontSize: '0.75rem',
                    padding: '0.15rem 0.5rem',
                    cursor: 'pointer',
                    border: 'none'
                  }}
                >
                  Active Stage: {activeStage.name}
                </button>
              )}
            </div>
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No project loaded</span>
          )}
        </div>
      </div>

      {/* Top-Right: Actions & Logout */}
      <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => setStep('welcome')}>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
          Dashboard
        </button>

        {/* Logout */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', marginLeft: '0.5rem', paddingLeft: '0.75rem', borderLeft: '1px solid var(--border)' }}>
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

