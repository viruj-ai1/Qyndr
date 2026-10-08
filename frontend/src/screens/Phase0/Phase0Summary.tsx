// src/screens/Phase0/Phase0Summary.tsx – Screen A5: Phase 0 Summary & DOE Handoff
import { useStore } from '../../store/useStore'
import { Projects } from '../../services/api'

export default function Phase0Summary() {
  const {
    currentProject, stages, riskAssessments, cqas,
    setStep, setActiveStageId, addAuditLog
  } = useStore()

  const handleStartDOECampaign = async (stageId: string, stageName: string) => {
    setActiveStageId(stageId)

    // Pre-populate Step 03 Factors with Critical parameters for this stage
    const stageParams = riskAssessments[stageId]?.parameters || []
    const criticalParams = stageParams.filter(p => p.criticalFlag)

    const factorsToCreate = criticalParams.map((p, idx) => {
      // Find linked CQAs
      const cqaNames = (p.linkedCqaIds || [])
        .map(cid => cqas.find(c => c.id === cid)?.name)
        .filter(Boolean)

      return {
        name: p.name,
        symbol: `X${idx + 1}`,
        unit: 'unit',
        low: 20.0,
        high: 80.0,
        baseline: 50.0,
        factor_order: idx,
        is_categorical: false,
        stage_id: stageId,
        linked_cqa_ids: p.linkedCqaIds
      }
    })

    if (currentProject && factorsToCreate.length > 0) {
      try {
        await Projects.saveFactors(currentProject.id, factorsToCreate)
        addAuditLog('START_DOE_CAMPAIGN', `Initialized DOE campaign for ${stageName} with ${factorsToCreate.length} critical factors`)
      } catch (e) {
        console.error('Failed to pre-populate factors', e)
      }
    }

    setStep('define-factors')
  }

  return (
    <div className="screen-container">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="badge badge-accent">Step 06 · Phase 0</div>
          <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Phase 0 Summary</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Get a summary of the quality and risk assessment for each stage.
        </p>
      </div>

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Stage Risk Assessment Dashboard</h3>

        <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
          <thead>
            <tr>
              <th style={{ width: '8%' }}>Stage #</th>
              <th style={{ width: '22%' }}>Stage Name</th>
              <th style={{ width: '15%' }}>Unit Op Type</th>
              <th style={{ width: '15%', textAlign: 'center' }}>Total Parameters</th>
              <th style={{ width: '15%', textAlign: 'center' }}>Critical Parameters (CPPs)</th>
              <th style={{ width: '25%', textAlign: 'right' }}>DOE Handoff Action</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, idx) => {
              const params = riskAssessments[stage.id]?.parameters || []
              const criticalCount = params.filter(p => p.criticalFlag).length

              return (
                <tr key={stage.id}>
                  <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{idx + 1}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{stage.name}</td>
                  <td><span className="badge badge-secondary">{stage.unitOpType}</span></td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{params.length}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge ${criticalCount > 0 ? 'badge-danger' : 'badge-secondary'}`}>
                      {criticalCount} Critical
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleStartDOECampaign(stage.id, stage.name)}
                    >
                      ⚡ Start DOE Campaign for this Stage
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button className="btn btn-secondary" onClick={() => setStep('risk-assessment')}>
          ← Back to Risk Assessment
        </button>
        <button className="btn btn-accent" onClick={() => setStep('campaign-dashboard')}>
          Open Campaign Dashboard Matrix →
        </button>
      </div>
    </div>
  )
}
