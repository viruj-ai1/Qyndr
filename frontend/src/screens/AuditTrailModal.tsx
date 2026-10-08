// src/screens/AuditTrailModal.tsx – Part C7: Audit Trail Modal
import { useStore } from '../store/useStore'

interface AuditTrailModalProps {
  onClose: () => void
}

export default function AuditTrailModal({ onClose }: AuditTrailModalProps) {
  const { currentProject, auditLogs, lockedCampaigns, activeStageId } = useStore()

  const stageLogs = (auditLogs || []).filter((l: any) => l)
  const isLocked = activeStageId ? (lockedCampaigns || []).includes(activeStageId) : false

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div className="card" style={{ width: '100%', maxWidth: '800px', maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem', background: '#0f172a', border: '1px solid rgba(99,102,241,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="badge badge-accent">Audit Trail</div>
              {isLocked && <span className="badge badge-danger">🔒 Campaign Version Locked</span>}
            </div>
            <h2 style={{ fontSize: '1.2rem', margin: '4px 0 0' }}>Audit & Integrity Logs ({currentProject?.name})</h2>
          </div>
          <button className="btn btn-icon btn-secondary" onClick={onClose}>✕</button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Timestamp</th>
                <th style={{ width: '18%' }}>User</th>
                <th style={{ width: '22%' }}>Action</th>
                <th style={{ width: '38%' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {stageLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No audit log entries recorded yet.
                  </td>
                </tr>
              ) : (
                stageLogs.map((log: any, idx: number) => (
                  <tr key={log.id || idx}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td style={{ fontWeight: 600 }}>{log.user}</td>
                    <td><span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{log.action}</span></td>
                    <td style={{ color: 'var(--primary-light)' }}>{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
