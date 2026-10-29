// src/screens/StageCampaignMatrix.tsx – Screen 06: Stage Campaign Matrix
import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Projects } from '../services/api'
import toast from 'react-hot-toast'

export default function StageCampaignMatrix() {
  const {
    currentProject,
    stages,
    riskAssessments,
    cqas,
    experiments,
    analysisResults,
    lockedCampaigns,
    activeStageId,
    setStep,
    setActiveStageId,
    setStages,
    setRiskAssessments,
    setCqas,
    setExperiments,
    addAuditLog
  } = useStore()

  const [loading, setLoading] = useState(false)
  const [startingStageId, setStartingStageId] = useState<string | null>(null)

  // Combined data fetching hook: fetch stage risk parameters and campaign statuses in one go
  useEffect(() => {
    if (!currentProject?.id) return
    let isCancelled = false

    const fetchProjectData = async () => {
      try {
        setLoading(true)
        const projData = await Projects.get(currentProject.id)
        if (isCancelled) return

        if (projData) {
          if (projData.stages_data && projData.stages_data.length > 0 && stages.length === 0) {
            setStages(projData.stages_data)
          }
          if (
            projData.risk_assessment_data &&
            Object.keys(projData.risk_assessment_data).length > 0 &&
            Object.keys(riskAssessments).length === 0
          ) {
            setRiskAssessments(projData.risk_assessment_data)
          }
          if (projData.cqas_data && projData.cqas_data.length > 0 && cqas.length === 0) {
            setCqas(projData.cqas_data)
          }
          if (projData.experiments && projData.experiments.length > 0 && experiments.length === 0) {
            setExperiments(projData.experiments)
          }
        }
      } catch (err) {
        console.error('Error fetching stage campaign matrix data:', err)
      } finally {
        if (!isCancelled) setLoading(false)
      }
    }

    fetchProjectData()
    return () => {
      isCancelled = true
    }
  }, [currentProject?.id])

  // Resilient fallback accessors
  const stageList = stages.length > 0 ? stages : (currentProject?.stages_data || [])
  const riskDict = riskAssessments && Object.keys(riskAssessments).length > 0 ? riskAssessments : (currentProject?.risk_assessment_data || {})
  const cqaList = cqas.length > 0 ? cqas : (currentProject?.cqas_data || [])
  const lockedList = lockedCampaigns && lockedCampaigns.length > 0 ? lockedCampaigns : (currentProject?.locked_campaigns || [])

  // Determines campaign execution status and whether a campaign is underway/initialized
  const getStageStatusInfo = (stageId: string) => {
    const isLocked = lockedList.includes(stageId)
    if (isLocked) {
      return {
        label: 'Report Generated & Locked',
        badgeClass: 'badge-accent',
        icon: '🔒',
        isStarted: true,
        isLocked: true
      }
    }

    const hasAnalysis = Object.keys(analysisResults || {}).length > 0
    const hasExperiments = (experiments || []).length > 0 || ((currentProject?.experiments || []).length > 0)
    const projectFactors = currentProject?.factors || []
    const hasStageFactors = projectFactors.some(f => f.stage_id === stageId)
    const isActiveAndHasFactors = (activeStageId === stageId || stageList.length === 1) && projectFactors.length > 0

    if (hasAnalysis && (hasStageFactors || isActiveAndHasFactors)) {
      return {
        label: 'Design Space Established',
        badgeClass: 'badge-primary',
        icon: '✨',
        isStarted: true,
        isLocked: false
      }
    }

    if (hasExperiments && (hasStageFactors || isActiveAndHasFactors)) {
      return {
        label: 'DOE Running',
        badgeClass: 'badge-warning',
        icon: '🧪',
        isStarted: true,
        isLocked: false
      }
    }

    if (hasStageFactors || isActiveAndHasFactors) {
      return {
        label: 'In Progress',
        badgeClass: 'badge-info',
        icon: '⚡',
        isStarted: true,
        isLocked: false
      }
    }

    return {
      label: 'Not Started / Factors Pending',
      badgeClass: 'badge-secondary',
      icon: '⏳',
      isStarted: false,
      isLocked: false
    }
  }

  // CTA Action: Start DOE Campaign (pre-populate critical parameters if not started)
  const handleStartDOECampaign = async (stageId: string, stageName: string) => {
    try {
      setStartingStageId(stageId)
      setActiveStageId(stageId)

      // Pre-populate Step Factors with Critical parameters for this stage
      const stageParams = riskDict[stageId]?.parameters || []
      const criticalParams = stageParams.filter(p => p.criticalFlag)

      const factorsToCreate = criticalParams.map((p, idx) => ({
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
      }))

      if (currentProject && factorsToCreate.length > 0) {
        await Projects.saveFactors(currentProject.id, factorsToCreate)
        addAuditLog('START_DOE_CAMPAIGN', `Initialized DOE campaign for ${stageName} with ${factorsToCreate.length} critical factors`)
        toast.success(`Initialized DOE campaign with ${factorsToCreate.length} critical factors`)
      }

      setStep('define-factors')
    } catch (e) {
      console.error('Failed to pre-populate factors', e)
      toast.error('Failed to pre-populate stage factors')
      setStep('define-factors')
    } finally {
      setStartingStageId(null)
    }
  }

  // CTA Action: Enter existing campaign
  const handleEnterCampaign = (stageId: string) => {
    setActiveStageId(stageId)
    setStep('define-factors')
  }

  return (
    <div className="screen-container">
      {/* Header with Title and Subtitle */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0 }}>Stage Campaign Matrix</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
          Monitor critical process parameters (CPPs) and launch DOE campaigns by stage.
        </p>
      </div>

      {/* Main Unified Table Card */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            Synthesis Stages & DOE Status
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ width: '8%', textAlign: 'center' }}>STAGE #</th>
                <th style={{ width: '25%' }}>STAGE NAME & UNIT OP</th>
                <th style={{ width: '20%' }}>PARAMETERS & RISK</th>
                <th style={{ width: '22%' }}>CAMPAIGN STATUS</th>
                <th style={{ width: '12%', textAlign: 'center' }}>VERSION LOCK</th>
                <th style={{ width: '13%', textAlign: 'right' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {stageList.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                    <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.35rem', color: 'var(--text-primary)' }}>
                      No Synthesis Stages Defined
                    </div>
                    <p style={{ fontSize: '0.85rem', margin: '0 auto 1.25rem', maxWidth: '400px' }}>
                      Please define your process synthesis route in Step 04 Route Mapping to establish the stage campaign matrix.
                    </p>
                    <button className="btn btn-primary btn-sm" onClick={() => setStep('route-mapping')}>
                      Map Synthesis Stages →
                    </button>
                  </td>
                </tr>
              ) : (
                stageList.map((stage, idx) => {
                  const params = riskDict[stage.id]?.parameters || []
                  const criticalCount = params.filter(p => p.criticalFlag).length
                  const totalParams = params.length
                  const status = getStageStatusInfo(stage.id)
                  const isLocked = status.isLocked
                  const isStarting = startingStageId === stage.id

                  return (
                    <tr key={stage.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {/* STAGE # */}
                      <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                        {idx + 1}
                      </td>

                      {/* STAGE NAME & UNIT OP */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--primary-light)', fontSize: '0.92rem' }}>
                          {stage.name}
                        </div>
                        <div style={{ marginTop: '0.3rem' }}>
                          <span
                            className="badge badge-secondary"
                            style={{
                              fontSize: '0.72rem',
                              padding: '0.15rem 0.5rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em'
                            }}
                          >
                            {stage.unitOpType}
                          </span>
                        </div>
                      </td>

                      {/* PARAMETERS & RISK */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <span
                            className={`badge ${criticalCount > 0 ? 'badge-danger' : 'badge-secondary'}`}
                            style={{ fontWeight: 600, fontSize: '0.76rem' }}
                          >
                            {criticalCount} Critical
                          </span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 500 }}>
                            / {totalParams} Total
                          </span>
                        </div>
                      </td>

                      {/* CAMPAIGN STATUS */}
                      <td>
                        <span
                          className={`badge ${status.badgeClass}`}
                          style={{
                            fontSize: '0.78rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.25rem 0.6rem'
                          }}
                        >
                          <span>{status.icon}</span>
                          <span>{status.label}</span>
                        </span>
                      </td>

                      {/* VERSION LOCK */}
                      <td style={{ textAlign: 'center' }}>
                        {isLocked ? (
                          <span className="badge badge-accent" style={{ fontSize: '0.76rem', fontWeight: 600 }}>
                            Locked
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 500 }}>
                            Editable
                          </span>
                        )}
                      </td>

                      {/* ACTIONS (Dynamic CTA) */}
                      <td style={{ textAlign: 'right' }}>
                        {status.isStarted ? (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleEnterCampaign(stage.id)}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            Enter Campaign →
                          </button>
                        ) : (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleStartDOECampaign(stage.id, stage.name)}
                            disabled={isStarting}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {isStarting ? (
                              <>
                                <div className="spinner" style={{ width: '12px', height: '12px', marginRight: '4px' }} />
                                Initializing…
                              </>
                            ) : (
                              '⚡ Start DOE Campaign'
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '1.5rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() => setStep('risk-assessment')}
        >
          ← Back to Risk Assessment
        </button>
      </div>
    </div>
  )
}
