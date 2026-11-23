import { useState, useEffect, useRef } from 'react'
import { useStore, Factor, Response, StageItem, isPercentageResponse } from '../store/useStore'
import { Projects } from '../services/api'
import { mapTargetToResponse, extractResponsesFromDescription, simplifyResponseName } from '../utils/targetParser'
import toast from 'react-hot-toast'

const emptyFactor = (): Factor => ({ name: '', unit: '', low: 0, high: 1, baseline: 0.5 })
const emptyResponse = (): Response => ({ name: '', unit: '', goal: 'maximize' })

export default function DefineFactors() {
  const {
    currentProject,
    stages,
    riskAssessments,
    cqas,
    experiments,
    analysisResults,
    lockedCampaigns,
    activeStageId,
    apiTargets,
    setProject,
    setStep,
    setActiveStageId,
    setStages,
    setRiskAssessments,
    setCqas,
    setExperiments,
    addAuditLog
  } = useStore()

  // Multi-stage detection
  const stageList: StageItem[] = stages.length > 0 ? stages : (currentProject?.stages_data || [])
  const isMultiStage = stageList.length >= 2
  const riskDict = riskAssessments && Object.keys(riskAssessments).length > 0 ? riskAssessments : (currentProject?.risk_assessment_data || {})
  const lockedList = lockedCampaigns && lockedCampaigns.length > 0 ? lockedCampaigns : (currentProject?.locked_campaigns || [])

  // Auto-select initial stage if multi-stage and activeStageId not set
  useEffect(() => {
    if (isMultiStage && !activeStageId && stageList.length > 0) {
      setActiveStageId(stageList[0].id)
    }
  }, [isMultiStage, activeStageId, stageList])

  // Fetch project data if needed (e.g. if stages or risk assessments are not loaded)
  useEffect(() => {
    if (!currentProject?.id) return
    let isCancelled = false

    const fetchProjectData = async () => {
      try {
        const projData = await Projects.get(currentProject.id)
        if (isCancelled || !projData) return
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
      } catch (err) {
        console.error('Error fetching project data in DefineFactors:', err)
      }
    }

    if (stages.length === 0 || Object.keys(riskAssessments).length === 0) {
      fetchProjectData()
    }

    return () => {
      isCancelled = true
    }
  }, [currentProject?.id])

  // Active stage object
  const currentStage = isMultiStage
    ? stageList.find(s => s.id === activeStageId) || stageList[0]
    : stageList[0]

  // UI state for stages
  const [showAllStagesOverview, setShowAllStagesOverview] = useState(false)
  const [expandedStageDetails, setExpandedStageDetails] = useState(false)
  const [startingStageId, setStartingStageId] = useState<string | null>(null)

  // Status helper for a stage
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

  const [factors, setFactors] = useState<Factor[]>(() => {
    if (currentProject?.factors && currentProject.factors.length > 0) {
      return currentProject.factors
    }
    return []
  })

  // Pre-seed responses: prioritize Step 03 Critical CQAs, then targets/description
  const getInitialResponses = (): Response[] => {
    if (currentProject?.responses && currentProject.responses.length > 0) {
      const filtered = currentProject.responses
        .filter((r: any) => !['impurity b', 'impurity c'].includes(r.name.toLowerCase().trim()))
        .map((r: any) => ({ ...r, name: simplifyResponseName(r.name, r.goal) }))
      if (filtered.length > 0) return filtered
    }

    // 0. Prioritize Critical CQAs from Step 03
    const projectCqas = (currentProject?.cqas_data && currentProject.cqas_data.length > 0)
      ? currentProject.cqas_data
      : (cqas && cqas.length > 0 ? cqas : [])

    const criticalCqas = projectCqas.filter(c => c.is_critical && c.name?.trim())
    if (criticalCqas.length > 0) {
      return criticalCqas.map(c => {
        const nameLower = c.name.toLowerCase()
        const isImpurity = nameLower.includes('impurity') || nameLower.includes('substance') || nameLower.includes('solvent')
        return {
          name: simplifyResponseName(c.name, isImpurity ? 'minimize' : 'maximize'),
          unit: c.range?.includes('%') ? '%' : c.range?.includes('ppm') ? 'ppm' : '',
          goal: isImpurity ? 'minimize' : 'maximize',
          inherited_from_target: true
        }
      })
    }

    // 1. If structured api_targets exist (saved from Step 01), use them
    const targets = (currentProject?.api_targets && currentProject.api_targets.length > 0)
      ? currentProject.api_targets
      : (apiTargets && apiTargets.length > 0 ? apiTargets : [])

    if (targets.length > 0) {
      return targets.map(mapTargetToResponse)
    }

    // 2. Extract directly from Project Description, Objective, and Compound
    const extracted = extractResponsesFromDescription(
      currentProject?.description,
      currentProject?.objective,
      currentProject?.compound
    )
    if (extracted.length > 0) {
      return extracted
    }

    return []
  }

  const [responses, setResponses] = useState<Response[]>(getInitialResponses)
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedResponseIndices, setSelectedResponseIndices] = useState<number[]>([])
  const [isResponseEditMode, setIsResponseEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const isFirstMount = useRef(true)

  // Prune selectedIndices when factors length changes
  useEffect(() => {
    setSelectedIndices(prev => prev.filter(idx => idx < factors.length))
  }, [factors.length])

  // Prune selectedResponseIndices when responses length changes
  useEffect(() => {
    setSelectedResponseIndices(prev => prev.filter(idx => idx < responses.length))
  }, [responses.length])

  // Keep store in sync so switching steps never wipes factors or responses
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    if (currentProject) {
      setProject({ ...currentProject, factors, responses })
    }
  }, [factors, responses])

  // If responses are empty and targets become available, auto-populate
  // If responses are empty, auto-populate from Project Description / api_targets
  useEffect(() => {
    if (responses.length === 0) {
      const targets = (currentProject?.api_targets && currentProject.api_targets.length > 0)
        ? currentProject.api_targets
        : (apiTargets && apiTargets.length > 0 ? apiTargets : [])
      if (targets.length > 0) {
        setResponses(targets.map(mapTargetToResponse))
      } else {
        const extracted = extractResponsesFromDescription(
          currentProject?.description,
          currentProject?.objective,
          currentProject?.compound
        )
        if (extracted.length > 0) {
          setResponses(extracted)
        }
      }
    }
  }, [currentProject?.id, currentProject?.api_targets, currentProject?.description, apiTargets])

  /* ── Quick sync / auto-fill from Step 01 Project Description ── */
  const handleSyncFromProjectDescription = () => {
    // 1. Direct extraction from current description
    const extracted = extractResponsesFromDescription(
      currentProject?.description,
      currentProject?.objective,
      currentProject?.compound
    )
    if (extracted.length > 0) {
      setResponses(extracted)
      toast.success(`Auto-filled ${extracted.length} response variables from Project Description!`)
      return
    }

    // 2. Fallback to api_targets if available
    const targets = (currentProject?.api_targets && currentProject.api_targets.length > 0)
      ? currentProject.api_targets
      : (apiTargets && apiTargets.length > 0 ? apiTargets : [])

    if (targets.length > 0) {
      const seeded = targets.map(mapTargetToResponse)
      setResponses(seeded)
      toast.success(`Auto-filled ${seeded.length} response variables from Project Description!`)
    }
  }

  /* ── Factors helpers ─── */
  const addFactor = () => {
    setFactors(f => [...f, emptyFactor()])
    setIsEditMode(true)
  }
  const removeFactor = (i: number) => setFactors(f => f.filter((_, idx) => idx !== i))
  const setF = (i: number, key: keyof Factor, val: any) =>
    setFactors(f => f.map((row, idx) => idx === i ? { ...row, [key]: val } : row))

  const handleToggleSelect = (index: number) => {
    setSelectedIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const handleDeleteSelected = () => {
    if (selectedIndices.length === 0) {
      toast('Select the checkbox next to each factor you want to delete.')
      return
    }
    const count = selectedIndices.length
    const remaining = factors.filter((_, idx) => !selectedIndices.includes(idx))
    setFactors(remaining)
    setSelectedIndices([])
    if (remaining.length === 0) {
      setIsEditMode(false)
    }
    toast.success(`Deleted ${count} ${count === 1 ? 'factor' : 'factors'}`)
  }

  const handleClearAll = () => {
    if (factors.length === 0) return
    setFactors([])
    setSelectedIndices([])
    setIsEditMode(false)
    toast.success('Cleared all process factors')
  }

  /* ── Responses helpers ─── */
  const addResponse = () => {
    setResponses(r => [...r, emptyResponse()])
    setIsResponseEditMode(true)
  }
  const removeResponse = (i: number) => setResponses(r => r.filter((_, idx) => idx !== i))
  const setR = (i: number, key: keyof Response, val: any) =>
    setResponses(r => r.map((row, idx) => idx === i ? { ...row, [key]: val, inherited_from_target: false } : row))

  const handleToggleSelectResponse = (index: number) => {
    setSelectedResponseIndices(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    )
  }

  const handleDeleteSelectedResponses = () => {
    if (selectedResponseIndices.length === 0) {
      toast('Select the checkbox next to each response you want to delete.')
      return
    }
    const count = selectedResponseIndices.length
    const remaining = responses.filter((_, idx) => !selectedResponseIndices.includes(idx))
    setResponses(remaining)
    setSelectedResponseIndices([])
    if (remaining.length === 0) {
      setIsResponseEditMode(false)
    }
    toast.success(`Deleted ${count} ${count === 1 ? 'response' : 'responses'}`)
  }

  const handleClearAllResponses = () => {
    if (responses.length === 0) return
    setResponses([])
    setSelectedResponseIndices([])
    setIsResponseEditMode(false)
    toast.success('Cleared all response variables')
  }

  async function handleSave() {
    if (factors.length === 0) { toast.error('Please define at least one factor'); return }
    if (factors.some(f => !f.name.trim())) { toast.error('All factors need a name'); return }
    if (factors.some(f => f.high <= f.low)) { toast.error('High must be > Low for each factor'); return }
    if (responses.length === 0) { toast.error('Please define at least one response'); return }
    if (responses.some(r => !r.name.trim())) { toast.error('All responses need a name'); return }
    if (responses.some(r => isPercentageResponse(r) && r.target != null && r.target > 100)) {
      toast.error('Response target percentage cannot exceed 100%')
      return
    }
    if (responses.some(r => isPercentageResponse(r) && r.upper_limit != null && r.upper_limit > 100)) {
      toast.error('Response upper limit percentage cannot exceed 100%')
      return
    }
    setSaving(true)
    try {
      const id = currentProject!.id
      const savedFactors = await Projects.saveFactors(id, factors.map((f, i) => ({
        name: f.name.trim(),
        symbol: f.symbol || '',
        unit: f.unit.trim(),
        low: Number(f.low),
        high: Number(f.high),
        baseline: f.baseline ?? (Number(f.low) + Number(f.high)) / 2,
        factor_order: i,
        is_categorical: f.is_categorical || false
      })))
      const savedResponses = await Projects.saveResponses(id, responses.map((r, i) => ({
        name: simplifyResponseName(r.name.trim(), r.goal),
        unit: r.unit.trim(),
        goal: r.goal || 'maximize',
        target: r.target != null ? Number(r.target) : null,
        lower_limit: r.lower_limit != null ? Number(r.lower_limit) : null,
        upper_limit: r.upper_limit != null ? Number(r.upper_limit) : null,
        weight: r.weight != null ? Number(r.weight) : 1.0,
        resp_order: i
      })))
      const proj = await Projects.update(id, { current_step: 'recommend-doe' })
      setProject({ ...proj, factors: savedFactors, responses: savedResponses })
      toast.success('Factors & responses saved!')
      setStep('recommend-doe')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to save factors & responses')
    } finally {
      setSaving(false)
    }
  }

  // Handle stage selection with unsaved edits guard
  const handleSelectStage = (stageId: string) => {
    if (stageId === activeStageId) return

    if (isEditMode || isResponseEditMode) {
      const confirmDiscard = window.confirm(
        'You have unsaved changes in edit mode. Discard them and switch stage?'
      )
      if (!confirmDiscard) return
      setIsEditMode(false)
      setIsResponseEditMode(false)
      setSelectedIndices([])
      setSelectedResponseIndices([])
    }

    setActiveStageId(stageId)
  }

  // Start DOE campaign for a stage (prepopulate critical parameters if empty)
  const handleStartDOECampaign = async (stageId: string, stageName: string) => {
    try {
      setStartingStageId(stageId)
      setActiveStageId(stageId)

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

      if (factorsToCreate.length > 0) {
        setFactors(factorsToCreate)
        if (currentProject) {
          await Projects.saveFactors(currentProject.id, factorsToCreate)
          addAuditLog('START_DOE_CAMPAIGN', `Initialized DOE campaign for ${stageName} with ${factorsToCreate.length} critical factors`)
        }
        toast.success(`Initialized DOE campaign with ${factorsToCreate.length} critical factors`)
      } else {
        toast.success(`Active stage set to ${stageName}`)
      }
    } catch (e) {
      console.error('Failed to pre-populate factors', e)
      toast.error('Failed to pre-populate stage factors')
    } finally {
      setStartingStageId(null)
    }
  }

  const inputCls = 'form-input'
  const factorGridCols = isEditMode ? '32px 2fr 1fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr'
  const factorInputStyle = !isEditMode ? {
    cursor: 'default',
    backgroundColor: 'rgba(241, 245, 249, 0.7)',
    color: 'var(--text-main)',
    borderColor: 'rgba(203, 213, 225, 0.6)'
  } : undefined

  const responseGridCols = isResponseEditMode ? '32px 2fr 1fr 1.5fr 1fr' : '2fr 1fr 1.5fr 1fr'
  const responseInputStyle = !isResponseEditMode ? {
    cursor: 'default',
    backgroundColor: 'rgba(241, 245, 249, 0.7)',
    color: 'var(--text-main)',
    borderColor: 'rgba(203, 213, 225, 0.6)'
  } : undefined

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Define Factors & Responses</h1>
        <p className="page-desc">Select what we will change and what we will measure in the experiments.</p>
      </div>

      {/* ── Multi-Stage Campaign Selector & Status (Multi-stage projects only) ── */}
      {isMultiStage && (
        <div id="stage-switcher-section" className="card mb-2" style={{ padding: '1.25rem', border: '1px solid #bfdbfe', background: 'linear-gradient(to bottom, #f8fafc, #ffffff)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem' }}>🔬</span>
                <span style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-main)' }}>Synthesis Stage</span>
                <span className="badge badge-primary" style={{ fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  {stageList.length} Stages
                </span>
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Select a stage to manage its experimental factors, responses, and campaign execution.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowAllStagesOverview(v => !v)}
              style={{ fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span>{showAllStagesOverview ? '▲ Hide' : '▼ View'} All Stages Overview</span>
            </button>
          </div>

          {/* Stage Selector Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(240px, 1fr))`, gap: '0.75rem', marginBottom: '0.75rem' }}>
            {stageList.map((stg, idx) => {
              const isSelected = (activeStageId === stg.id) || (!activeStageId && idx === 0)
              const params = riskDict[stg.id]?.parameters || []
              const criticalCount = params.filter(p => p.criticalFlag).length
              const totalParams = params.length
              const status = getStageStatusInfo(stg.id)

              // Short name (split by ":" or " - ")
              const shortName = stg.name.split(/[:\-–—]/)[0].trim()

              return (
                <div
                  key={stg.id}
                  onClick={() => handleSelectStage(stg.id)}
                  title={stg.name}
                  style={{
                    border: isSelected ? '2px solid #2563eb' : '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.85rem',
                    backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                    boxShadow: isSelected ? '0 2px 8px rgba(37, 99, 235, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? '#2563eb' : 'var(--border)',
                        color: isSelected ? '#ffffff' : 'var(--text-muted)',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}>
                        {idx + 1}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isSelected ? '#1d4ed8' : 'var(--text-main)' }}>
                        {shortName}
                      </span>
                    </div>

                    <span
                      className="badge badge-secondary"
                      style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', textTransform: 'uppercase' }}
                    >
                      {stg.unitOpType || 'Stage'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <span
                      className={`badge ${criticalCount > 0 ? 'badge-danger' : 'badge-secondary'}`}
                      style={{ fontSize: '0.68rem', padding: '0.1rem 0.4rem' }}
                    >
                      {criticalCount} Critical / {totalParams} Total
                    </span>

                    <span
                      className={`badge ${status.badgeClass}`}
                      style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                    >
                      <span>{status.icon}</span>
                      <span>{status.label}</span>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Active Stage Detail & Action Bar */}
          {currentStage && (
            <div style={{
              backgroundColor: '#f1f5f9',
              borderRadius: '6px',
              padding: '0.75rem 1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b' }}>
                      Active Stage: {currentStage.name}
                    </span>
                    {lockedList.includes(currentStage.id) ? (
                      <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>🔒 Locked</span>
                    ) : (
                      <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>✏️ Editable</span>
                    )}
                  </div>
                  {currentStage.description && (
                    <div style={{ marginTop: '0.2rem' }}>
                      <p style={{
                        margin: 0,
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                        whiteSpace: expandedStageDetails ? 'normal' : 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '650px'
                      }}>
                        {currentStage.description}
                      </p>
                      {currentStage.description.length > 90 && (
                        <button
                          type="button"
                          onClick={() => setExpandedStageDetails(v => !v)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: '#2563eb',
                            fontSize: '0.74rem',
                            cursor: 'pointer',
                            marginTop: '0.15rem'
                          }}
                        >
                          {expandedStageDetails ? 'Show less' : 'Read full description...'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Campaign Action Button */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {(() => {
                    const status = getStageStatusInfo(currentStage.id)
                    const isStarting = startingStageId === currentStage.id

                    return (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={isStarting || status.isLocked}
                        onClick={() => handleStartDOECampaign(currentStage.id, currentStage.name)}
                        style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}
                      >
                        {isStarting ? (
                          <>
                            <div className="spinner" style={{ width: '12px', height: '12px', marginRight: '4px' }} />
                            Initializing…
                          </>
                        ) : status.isStarted ? (
                          `✓ Campaign Active for ${currentStage.name.split(/[:\-–—]/)[0].trim()}`
                        ) : (
                          `⚡ Start DOE Campaign for ${currentStage.name.split(/[:\-–—]/)[0].trim()}`
                        )}
                      </button>
                    )
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Collapsible All Stages Overview Table */}
          {showAllStagesOverview && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.85rem' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.5rem' }}>
                All Stages Overview
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '8%', textAlign: 'center' }}>STAGE #</th>
                      <th style={{ width: '28%' }}>STAGE NAME & UNIT OP</th>
                      <th style={{ width: '22%' }}>PARAMETERS & RISK</th>
                      <th style={{ width: '22%' }}>CAMPAIGN STATUS</th>
                      <th style={{ width: '10%', textAlign: 'center' }}>VERSION LOCK</th>
                      <th style={{ width: '10%', textAlign: 'right' }}>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stageList.map((stg, idx) => {
                      const params = riskDict[stg.id]?.parameters || []
                      const criticalCount = params.filter(p => p.criticalFlag).length
                      const totalParams = params.length
                      const status = getStageStatusInfo(stg.id)
                      const isLocked = status.isLocked
                      const isCurrent = (activeStageId === stg.id) || (!activeStageId && idx === 0)

                      return (
                        <tr key={stg.id} style={{ backgroundColor: isCurrent ? 'rgba(37, 99, 235, 0.04)' : undefined }}>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-muted)' }}>
                            {idx + 1}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: isCurrent ? '#2563eb' : 'var(--text-main)' }}>
                              {stg.name}
                            </div>
                            <span className="badge badge-secondary" style={{ fontSize: '0.68rem', marginTop: '0.2rem' }}>
                              {stg.unitOpType || 'Stage'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${criticalCount > 0 ? 'badge-danger' : 'badge-secondary'}`} style={{ fontSize: '0.72rem' }}>
                              {criticalCount} Critical
                            </span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: '0.35rem' }}>
                              / {totalParams} Total
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${status.badgeClass}`} style={{ fontSize: '0.72rem' }}>
                              {status.icon} {status.label}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {isLocked ? (
                              <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>Locked</span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Editable</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {isCurrent ? (
                              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb' }}>Active</span>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                                onClick={() => handleSelectStage(stg.id)}
                              >
                                Select
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Factors ── */}
      <div className="card mb-2">
        <div className="flex-between mb-2" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div className="card-title">Process Factors</div>
            <div className="card-sub">Input variables to be varied in the experiment</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {!isEditMode ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditMode(true)}
                title="Edit factors (modify numbers, add, delete, or clear)"
                style={{
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDeleteSelected}
                  style={{
                    color: selectedIndices.length > 0 ? '#ef4444' : 'var(--danger)',
                    borderColor: 'rgba(239, 68, 68, 0.35)',
                    fontWeight: 600
                  }}
                  title={selectedIndices.length === 0 ? "Select factors using checkboxes to delete" : `Delete ${selectedIndices.length} selected factors`}
                >
                  Delete Factor {selectedIndices.length > 0 ? `(${selectedIndices.length})` : ''}
                </button>

                {factors.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleClearAll}
                    title="Clear all factors"
                  >
                    Clear All
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={addFactor}
                  title="Add a new factor"
                >
                  + Add Factor
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setIsEditMode(false)
                    setSelectedIndices([])
                  }}
                  style={{ fontWeight: 600 }}
                  title="Done editing"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>

        {factors.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px', margin: '0.75rem 0' }}>
            <p style={{ margin: '0 0 0.75rem' }}>No factors defined yet. Click "+ Add Factor" or carry over Critical Process Parameters from Step 06.</p>
            <button className="btn btn-primary btn-sm" onClick={addFactor}>
              + Add First Factor
            </button>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div style={{ display: 'grid', gridTemplateColumns: factorGridCols, gap: '0.75rem', marginBottom: '0.4rem', padding: '0 1rem', alignItems: 'center' }}>
              {isEditMode && <div style={{ width: '32px' }} />}
              {['Factor Name', 'Unit', 'Low', 'High', 'Baseline'].map(h => (
                <div key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>

            {factors.map((f, i) => {
              const isChecked = selectedIndices.includes(i)
              return (
                <div
                  key={i}
                  className="factor-row"
                  style={{
                    gridTemplateColumns: factorGridCols,
                    background: isChecked ? 'rgba(239, 68, 68, 0.04)' : undefined,
                    border: isChecked ? '1px solid rgba(239, 68, 68, 0.4)' : undefined
                  }}
                >
                  {isEditMode && (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleSelect(i)}
                      title={`Select ${f.name || `Factor ${i + 1}`} to delete`}
                      style={{ cursor: 'pointer', justifySelf: 'center', width: '15px', height: '15px' }}
                    />
                  )}
                  <input
                    className={inputCls}
                    placeholder="e.g. Temperature"
                    value={f.name}
                    readOnly={!isEditMode}
                    style={factorInputStyle}
                    onChange={e => setF(i, 'name', e.target.value)}
                  />
                  <input
                    className={inputCls}
                    placeholder="°C"
                    value={f.unit}
                    readOnly={!isEditMode}
                    style={factorInputStyle}
                    onChange={e => setF(i, 'unit', e.target.value)}
                  />
                  <input
                    className={inputCls}
                    type="number"
                    value={f.low}
                    readOnly={!isEditMode}
                    style={factorInputStyle}
                    onChange={e => setF(i, 'low', +e.target.value)}
                  />
                  <input
                    className={inputCls}
                    type="number"
                    value={f.high}
                    readOnly={!isEditMode}
                    style={factorInputStyle}
                    onChange={e => setF(i, 'high', +e.target.value)}
                  />
                  <input
                    className={inputCls}
                    type="number"
                    value={f.baseline ?? (f.low + f.high) / 2}
                    readOnly={!isEditMode}
                    style={factorInputStyle}
                    onChange={e => setF(i, 'baseline', +e.target.value)}
                  />
                </div>
              )
            })}
          </>
        )}

        <div className="alert alert-info mt-1">
          💡 Tip: Use 3–7 factors for a good DOE. Too many factors → consider Plackett-Burman for screening first.
        </div>
      </div>

      {/* ── Responses ── */}
      <div className="card">
        <div className="flex-between mb-2" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <div className="card-title">Response Variables</div>
            <div className="card-sub">Output variables to measure after each experiment</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {!isResponseEditMode ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsResponseEditMode(true)}
                title="Edit response variables (modify values, add, delete, or clear)"
                style={{
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Edit
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDeleteSelectedResponses}
                  style={{
                    color: selectedResponseIndices.length > 0 ? '#ef4444' : 'var(--danger)',
                    borderColor: 'rgba(239, 68, 68, 0.35)',
                    fontWeight: 600
                  }}
                  title={selectedResponseIndices.length === 0 ? "Select responses using checkboxes to delete" : `Delete ${selectedResponseIndices.length} selected responses`}
                >
                  Delete Response {selectedResponseIndices.length > 0 ? `(${selectedResponseIndices.length})` : ''}
                </button>

                {responses.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleClearAllResponses}
                    title="Clear all responses"
                  >
                    Clear All
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={addResponse}
                  title="Add a new response variable"
                >
                  + Add Response
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setIsResponseEditMode(false)
                    setSelectedResponseIndices([])
                  }}
                  style={{ fontWeight: 600 }}
                  title="Done editing"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>

        {responses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', border: '1px dashed var(--border)', borderRadius: '8px', margin: '0.75rem 0' }}>
            <p style={{ margin: '0 0 0.75rem' }}>No responses defined yet.</p>
            <button className="btn btn-primary btn-sm" onClick={addResponse}>
              + Add First Response
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: responseGridCols, gap: '0.75rem', marginBottom: '0.4rem', padding: '0 1rem', alignItems: 'center' }}>
              {isResponseEditMode && <div style={{ width: '32px' }} />}
              {['Response Name', 'Unit', 'Goal', 'Target Value'].map(h => (
                <div key={h} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</div>
              ))}
            </div>

            {responses.map((r, i) => {
              const isChecked = selectedResponseIndices.includes(i)
              return (
                <div key={i} style={{ marginBottom: '0.5rem' }}>
                  <div
                    className="response-row"
                    style={{
                      gridTemplateColumns: responseGridCols,
                      background: isChecked ? 'rgba(239, 68, 68, 0.04)' : undefined,
                      border: isChecked ? '1px solid rgba(239, 68, 68, 0.4)' : undefined
                    }}
                  >
                    {isResponseEditMode && (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSelectResponse(i)}
                        title={`Select ${r.name || `Response ${i + 1}`} to delete`}
                        style={{ cursor: 'pointer', justifySelf: 'center', width: '15px', height: '15px' }}
                      />
                    )}
                    <div>
                      <input
                        className={inputCls}
                        placeholder="e.g. Yield %"
                        value={r.name}
                        readOnly={!isResponseEditMode}
                        style={responseInputStyle}
                        onChange={e => setR(i, 'name', e.target.value)}
                      />
                      {r.inherited_from_target && (
                        <div style={{ marginTop: '0.2rem' }}>
                          <span className="badge badge-accent" style={{ fontSize: '0.68rem', padding: '0.1rem 0.45rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                            <span>🎯</span> Inherited from Project Description
                          </span>
                        </div>
                      )}
                    </div>
                    <input
                      className={inputCls}
                      placeholder="%"
                      value={r.unit}
                      readOnly={!isResponseEditMode}
                      style={responseInputStyle}
                      onChange={e => setR(i, 'unit', e.target.value)}
                    />
                    <select
                      className="form-select"
                      value={r.goal}
                      disabled={!isResponseEditMode}
                      style={responseInputStyle}
                      onChange={e => setR(i, 'goal', e.target.value)}
                    >
                      <option value="maximize">Maximize</option>
                      <option value="minimize">Minimize</option>
                      <option value="target">Hit Target</option>
                    </select>
                    <input
                      className={inputCls}
                      type="number"
                      placeholder="Optional"
                      value={r.target ?? ''}
                      readOnly={!isResponseEditMode}
                      style={responseInputStyle}
                      onChange={e => setR(i, 'target', e.target.value ? +e.target.value : undefined)}
                    />
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>

      <div className="step-nav" style={{ marginTop: '1.5rem' }}>
        <button
          className="btn btn-secondary"
          onClick={() => {
            if (currentProject) {
              setProject({ ...currentProject, factors, responses })
            }
            setStep('cqa-risk')
          }}
        >
          ← Back to CQA & Risk Assessment
        </button>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{factors.length} factors · {responses.length} responses</span>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" />Saving…</> : 'Save & Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
