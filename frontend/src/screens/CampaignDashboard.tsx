// src/screens/CampaignDashboard.tsx – Part B: Top-Level Campaign Dashboard
import { useStore } from '../store/useStore'

export default function CampaignDashboard() {
  const { currentProject, stages, experiments, analysisResults, lockedCampaigns, setStep, setActiveStageId } = useStore()

  const getStageStatus = (stageId: string) => {
    const isLocked = (lockedCampaigns || []).includes(stageId)
    if (isLocked) return { label: 'Report Generated & Locked', badge: 'badge-accent', icon: '🔒' }
    if (Object.keys(analysisResults).length > 0) return { label: 'Design Space Established', badge: 'badge-primary', icon: '✨' }
    if (experiments.length > 0) return { label: 'DOE Running', badge: 'badge-warning', icon: '🧪' }
    return { label: 'Not Started / Factors Pending', badge: 'badge-secondary', icon: '⏳' }
  }

  const handleOpenStageCampaign = (stageId: string) => {
    setActiveStageId(stageId)
    setStep('define-factors')
  }

  return (
    <div className="screen-container">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="badge badge-primary">Step 07</div>
          <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Campaign Dashboard</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          See the overall status of all process stages and experiments.
        </p>
      </div>

      {/* Campaign Status Matrix Table */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Stage-by-Stage Campaign Matrix</h3>
          <button className="btn btn-secondary btn-sm" onClick={() => setStep('qtpp')}>
            ⚙ Edit Phase 0 QbD Specifications
          </button>
        </div>

        <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={{ width: '8%' }}>Stage #</th>
              <th style={{ width: '22%' }}>Stage Name</th>
              <th style={{ width: '15%' }}>Unit Operation</th>
              <th style={{ width: '25%' }}>Current Campaign Status</th>
              <th style={{ width: '15%', textAlign: 'center' }}>Version Lock</th>
              <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {stages.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  No stages defined. Please complete Phase 0 Route Mapping first.
                </td>
              </tr>
            ) : (
              stages.map((stage, idx) => {
                const status = getStageStatus(stage.id)
                const isLocked = (lockedCampaigns || []).includes(stage.id)

                return (
                  <tr key={stage.id}>
                    <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{stage.name}</td>
                    <td><span className="badge badge-secondary">{stage.unitOpType}</span></td>
                    <td>
                      <span className={`badge ${status.badge}`}>
                        {status.icon} {status.label}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isLocked ? (
                        <span className="badge badge-accent">Locked</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Editable</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleOpenStageCampaign(stage.id)}
                      >
                        Enter Campaign →
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
