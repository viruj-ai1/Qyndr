// src/screens/Phase0/CQARiskAssessment.tsx – Step 02: CQA & Risk Assessment (Single Stage)
import { useState, useMemo, useEffect, useRef } from 'react'
import { useStore, CQAMapping, QTPPItem, RiskParameter } from '../../store/useStore'
import { Projects, CQAApi, WorkflowApi } from '../../services/api'
import {
  generateContextAwareRiskParameters,
  isDummyRiskParams,
  generateContextAwareCQAs
} from '../../utils/routeGenerator'
import { isParamLikelyRelevant, sanitizeParamName } from '../../config/unitOpRiskParameters'
import { RPN_DIMENSIONS, RPN_GUIDE_CONTENT } from '../../utils/rpnExplanationData'
import { Info, X, SlidersHorizontal, AlertTriangle, CheckCircle2, Check, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'

interface AttributeSuggestion {
  qtpp_id: string
  attribute: string
  matched_category: string
  suggested_is_cqa: boolean
  suggested_impact: number
  suggested_uncertainty: number
  suggested_criticality: number
  is_critical: boolean
  suggested_method: string
  suggested_range: string
  rationale: string
  reference: string
  applies_to: string
}

interface AuditLogEntry {
  id: number
  project_id: number
  cqa_id: string
  action: string
  old_value?: any
  new_value?: any
  user: string
  timestamp: string
}

export default function CQARiskAssessment() {
  const {
    currentProject,
    qtpp,
    cqas,
    setCqas,
    stages,
    riskAssessments,
    setRiskAssessments,
    rpnThreshold,
    setRpnThreshold,
    setStep,
    addAuditLog,
    unlockedStep,
    setUnlockedStep
  } = useStore()

  // ── SINGLE STAGE CONTEXT ─────────────────────────────────────
  const currentStage = useMemo(() => {
    if (stages && stages.length > 0) return stages[0]
    if (currentProject?.stages_data && currentProject.stages_data.length > 0) return currentProject.stages_data[0]
    return { id: 'stage-1', name: 'Stage 1 – Reaction', unitOpType: 'Reaction' }
  }, [stages, currentProject?.stages_data])

  // ── PART A: CQA DERIVATION STATE ─────────────────────────────
  const getInitialCQAs = (): CQAMapping[] => {
    const savedList = (currentProject?.cqas_data && currentProject.cqas_data.length > 0)
      ? currentProject.cqas_data
      : (cqas && cqas.length > 0 ? cqas : [])

    return savedList.map(c => {
      const imp = c.impact_score ?? 3
      const unc = c.uncertainty_score ?? 3
      const critScore = c.criticality_score ?? (imp * unc)
      return {
        ...c,
        stageName: currentStage.name,
        reference: c.reference?.trim() ? c.reference : 'Internal Specification / Monograph',
        impact_score: imp,
        uncertainty_score: unc,
        criticality_score: critScore,
        is_critical: c.is_critical ?? (critScore >= 12),
        origin: c.origin ?? (c.linkedQtppIds && c.linkedQtppIds.length > 0 ? 'suggested' : 'chemist_added'),
        version: c.version ?? 1
      }
    })
  }

  const [cqaItems, setCqaItems] = useState<CQAMapping[]>(getInitialCQAs)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingCqa, setEditingCqa] = useState<CQAMapping | null>(null)
  const [guidelinesModalOpen, setGuidelinesModalOpen] = useState(false)
  const [auditModalOpen, setAuditModalOpen] = useState(false)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [activeAuditCqaName, setActiveAuditCqaName] = useState('')
  const [loadingAudit, setLoadingAudit] = useState(false)
  const [suggestions, setSuggestions] = useState<Record<string, AttributeSuggestion>>({})

  // ── PART B: REVERSE RISK STATE ───────────────────────────────
  const [localRisk, setLocalRisk] = useState<Record<string, { parameters: RiskParameter[] }>>(() => {
    const defaultDict: Record<string, { parameters: RiskParameter[] }> = { ...riskAssessments }
    const existing = defaultDict[currentStage.id]?.parameters
    if (!existing || existing.length === 0 || isDummyRiskParams(existing, currentProject)) {
      defaultDict[currentStage.id] = {
        parameters: generateContextAwareRiskParameters(currentStage as any, 0, currentProject, cqaItems)
      }
    }
    return defaultDict
  })

  const [isRiskEditMode, setIsRiskEditMode] = useState(false)
  const [selectedParamIds, setSelectedParamIds] = useState<string[]>([])
  const [showRpnGuide, setShowRpnGuide] = useState(false)
  const [isMatrixConfirmed, setIsMatrixConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removedNotification, setRemovedNotification] = useState<string | null>(null)

  // Current parameters for the single stage
  const currentParams: RiskParameter[] = useMemo(() => {
    const params = localRisk[currentStage.id]?.parameters
    if (params && params.length > 0 && !isDummyRiskParams(params, currentProject)) {
      return params
    }
    return generateContextAwareRiskParameters(currentStage as any, 0, currentProject, cqaItems)
  }, [localRisk, currentStage, currentProject, cqaItems])

  // Sync to store & debounced autosave
  useEffect(() => {
    setCqas(cqaItems)
    setRiskAssessments(localRisk)

    if (!currentProject?.id) return
    const timer = setTimeout(() => {
      Projects.savePhase0(currentProject.id, {
        cqas: cqaItems,
        riskAssessments: localRisk
      }).catch(() => {})
    }, 1000)
    return () => clearTimeout(timer)
  }, [cqaItems, localRisk, currentProject?.id])

  // Fetch AI CQA suggestions on load if available
  useEffect(() => {
    if (!currentProject?.id || qtpp.length === 0) return
    CQAApi.suggestions(currentProject.id)
      .then(res => {
        if (res && res.suggestions) {
          const dict: Record<string, AttributeSuggestion> = {}
          res.suggestions.forEach((s: AttributeSuggestion) => {
            dict[s.qtpp_id] = s
          })
          setSuggestions(dict)
        }
      })
      .catch(() => {})
  }, [currentProject?.id, qtpp.length])

  // ── LIVE INTEGRITY ENGINE ─────────────────────────────────────
  // 1. When a CQA is removed/toggled OFF, prune it from all parameter linkedCqaIds
  const removeCqaFromParameters = (cqaId: string, cqaName: string) => {
    let prunedCount = 0
    const updatedParams = currentParams.map(p => {
      if (p.linkedCqaIds && p.linkedCqaIds.includes(cqaId)) {
        prunedCount++
        return {
          ...p,
          linkedCqaIds: p.linkedCqaIds.filter(id => id !== cqaId)
        }
      }
      return p
    })

    if (prunedCount > 0) {
      setLocalRisk({
        ...localRisk,
        [currentStage.id]: { parameters: updatedParams }
      })
      setRemovedNotification(`Removed "${cqaName}" from ${prunedCount} process parameter(s).`)
      setTimeout(() => setRemovedNotification(null), 5000)
    }
  }

  // 2. Criticality change recalculation: update suggested Severity (S) for linked parameters
  const handleCqaCriticalityChange = (cqaId: string, newImpact: number) => {
    const updatedParams = currentParams.map(p => {
      if (p.linkedCqaIds && p.linkedCqaIds.includes(cqaId)) {
        // If user manually set severity, keep it; else adopt max impact of linked CQAs
        const suggestedS = Math.min(5, Math.max(1, newImpact))
        const finalS = (p as any).manualSeverity ? p.severity : suggestedS
        let newRpn: number | null = null
        let isCrit = false
        if (finalS !== null && p.occurrence !== null && p.detectability !== null) {
          newRpn = finalS * p.occurrence * p.detectability
          isCrit = newRpn > rpnThreshold
        }
        return {
          ...p,
          severity: finalS,
          rpn: newRpn,
          criticalFlag: isCrit
        }
      }
      return p
    })
    setLocalRisk({
      ...localRisk,
      [currentStage.id]: { parameters: updatedParams }
    })
  }

  // CQA Action Handlers
  const handleToggleQtpp = (q: QTPPItem) => {
    const existing = cqaItems.find(c =>
      (c.linkedQtppIds && c.linkedQtppIds.includes(q.id)) ||
      c.name.toLowerCase() === q.attribute.toLowerCase()
    )

    if (existing) {
      // Toggle OFF: Remove and clean up parameter linkages
      removeCqaFromParameters(existing.id, existing.name)
      setCqaItems(prev => prev.filter(c => c.id !== existing.id))
      toast(`Removed CQA: ${existing.name}`)
    } else {
      // Toggle ON
      const sugg = suggestions[q.id]
      const imp = sugg?.suggested_impact ?? 3
      const unc = sugg?.suggested_uncertainty ?? 3
      const critScore = imp * unc
      const newCqa: CQAMapping = {
        id: `cqa-${Date.now()}`,
        name: q.attribute,
        appliesTo: 'Final API',
        stageName: currentStage.name,
        method: sugg?.suggested_method || 'HPLC / Pharmacopoeial standard',
        range: sugg?.suggested_range || q.criterion || 'Conforms',
        justification: q.justification || 'Pharmacopoeial Specification',
        linkedQtppIds: [q.id],
        impact_score: imp,
        uncertainty_score: unc,
        criticality_score: critScore,
        is_critical: critScore >= 12,
        rationale: sugg?.rationale || 'Critical therapeutic quality requirement.',
        reference: sugg?.reference || 'ICH Q8(R2) / USP Standard',
        origin: 'suggested',
        version: 1
      }
      setCqaItems(prev => [...prev, newCqa])
      toast.success(`Assessed as CQA: ${q.attribute}`)
    }
  }

  const handleDeleteCQA = (cqaId: string, name: string) => {
    removeCqaFromParameters(cqaId, name)
    setCqaItems(prev => prev.filter(c => c.id !== cqaId))
    toast.success(`Deleted ${name}`)
  }

  const saveDrawerCqa = (updated: CQAMapping | null) => {
    if (!updated || !updated.name.trim()) {
      toast.error('Attribute Name is required.')
      return
    }
    const imp = updated.impact_score ?? 3
    const unc = updated.uncertainty_score ?? 3
    const critScore = imp * unc
    const isCrit = critScore >= 12

    const finalCqa = {
      ...updated,
      impact_score: imp,
      uncertainty_score: unc,
      criticality_score: critScore,
      is_critical: isCrit,
      stageName: currentStage.name
    }

    setCqaItems(prev => prev.map(c => c.id === finalCqa.id ? finalCqa : c))
    handleCqaCriticalityChange(finalCqa.id, imp)
    setDrawerOpen(false)
    setEditingCqa(null)
    toast.success('CQA assessment saved.')
  }

  // ── PARAMETER ACTION HANDLERS ─────────────────────────────────
  const handleParamChange = (paramId: string, field: keyof RiskParameter | 'notImpacting' | 'manualSeverity' | 'status', value: any) => {
    const updated = currentParams.map(p => {
      if (p.id === paramId) {
        const nextP: any = { ...p, [field]: value }
        if (field === 'name') {
          nextP.name = sanitizeParamName(value)
        }
        if (field === 'severity') {
          nextP.manualSeverity = true
        }
        // If chemist modifies any score, transition status to 'confirmed' if previously 'suggested'
        if (['severity', 'occurrence', 'detectability'].includes(field)) {
          if (nextP.status === 'suggested') {
            nextP.status = 'confirmed'
          }
          if (nextP.severity !== null && nextP.occurrence !== null && nextP.detectability !== null) {
            nextP.rpn = nextP.severity * nextP.occurrence * nextP.detectability
            nextP.criticalFlag = nextP.rpn > rpnThreshold
          } else {
            nextP.rpn = null
            nextP.criticalFlag = false
          }
        }
        return nextP
      }
      return p
    })
    setLocalRisk({
      ...localRisk,
      [currentStage.id]: { parameters: updated }
    })
  }

  const handleConfirmParam = (paramId: string) => {
    const updated = currentParams.map(p => {
      if (p.id === paramId) {
        return { ...p, status: 'confirmed' as const }
      }
      return p
    })
    setLocalRisk({
      ...localRisk,
      [currentStage.id]: { parameters: updated }
    })
    toast.success('Parameter confirmed.')
  }

  const handleConfirmAllScored = () => {
    let confirmedCount = 0
    const updated = currentParams.map(p => {
      const isScored = p.severity !== null && p.occurrence !== null && p.detectability !== null
      if (p.status === 'suggested' && isScored) {
        confirmedCount++
        return { ...p, status: 'confirmed' as const }
      }
      return p
    })
    setLocalRisk({
      ...localRisk,
      [currentStage.id]: { parameters: updated }
    })
    if (confirmedCount > 0) {
      toast.success(`Confirmed ${confirmedCount} scored parameter(s).`)
    } else {
      toast('No unconfirmed scored parameters found.')
    }
  }

  const handleAddParam = () => {
    const newParam: RiskParameter = {
      id: `param-${Date.now()}`,
      name: '',
      type: 'CPP-candidate',
      linkedCqaIds: cqaItems.length > 0 ? [cqaItems[0].id] : [],
      severity: null,
      occurrence: null,
      detectability: null,
      rpn: null,
      rationale: '',
      criticalFlag: false,
      overrideReason: '',
      status: 'custom',
      notImpacting: false
    }
    const updated = [...currentParams, newParam]
    setLocalRisk({
      ...localRisk,
      [currentStage.id]: { parameters: updated }
    })
    setIsRiskEditMode(true)
  }

  const handleDeleteSelectedParams = () => {
    if (selectedParamIds.length === 0) {
      toast('Select the checkbox next to each parameter to delete.')
      return
    }
    const remaining = currentParams.filter(p => !selectedParamIds.includes(p.id))
    setLocalRisk({
      ...localRisk,
      [currentStage.id]: { parameters: remaining }
    })
    setSelectedParamIds([])
    toast.success(`Deleted ${selectedParamIds.length} parameter(s)`)
  }

  // Validation before step completion
  const validationIssues = useMemo(() => {
    const issues: string[] = []
    if (cqaItems.length === 0) {
      issues.push('Assess at least one Critical Quality Attribute (CQA) in Part A.')
    }
    if (currentParams.length === 0) {
      issues.push('Add at least one process parameter in the Risk Matrix.')
    }
    currentParams.forEach((p, idx) => {
      const pName = p.name ? `"${p.name}"` : `Parameter #${idx + 1}`
      if (!p.name.trim()) {
        issues.push(`Parameter #${idx + 1} is missing a parameter name.`)
      }
      if (p.status === 'suggested') {
        issues.push(`${pName} is still marked as "Suggested" — please review, confirm, score, or delete it.`)
      }
      if (p.severity === null || p.occurrence === null || p.detectability === null) {
        issues.push(`${pName} is unscored (requires S, O, and D scores).`)
      }
      const isLinked = p.linkedCqaIds && p.linkedCqaIds.length > 0
      const isMarkedNotImpacting = (p as any).notImpacting === true
      if (!isLinked && !isMarkedNotImpacting) {
        issues.push(`${pName} is not linked to any CQA and not marked as "Not Impacting".`)
      }
    })
    return issues
  }, [cqaItems, currentParams])

  const canComplete = validationIssues.length === 0

  const handleCompleteStep = async () => {
    if (!canComplete) {
      toast.error('Please address all validation criteria before proceeding.')
      return
    }

    setSaving(true)
    try {
      if (currentProject?.id) {
        // Complete step atomically via Workflow API
        await WorkflowApi.complete(currentProject.id, 'cqa-risk', {
          cqas_data: cqaItems,
          risk_assessment_data: localRisk
        })
        addAuditLog('CQA_RISK_COMPLETE', `Completed CQA & Risk Assessment with ${cqaItems.length} CQAs and ${currentParams.length} parameters.`)
        toast.success('CQA & Risk Assessment confirmed!')
        setStep('define-factors')
      }
    } catch (e: any) {
      console.error('Failed to complete CQA & Risk Assessment:', e)
      toast.error(e.response?.data?.detail || 'Failed to complete step.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen-container">
      {/* Sticky Mini Progress Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border-color)',
        padding: '0.65rem 1.25rem',
        marginBottom: '1.25rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.85rem' }}>
          <div>
            <strong>Active Stage:</strong> <span className="badge badge-primary">{currentStage.name}</span>
          </div>
          <div style={{ color: 'var(--text-muted)' }}>|</div>
          <div>
            <strong>Part A:</strong> {cqaItems.length} CQAs Assessed
          </div>
          <div style={{ color: 'var(--text-muted)' }}>|</div>
          <div>
            <strong>Part B:</strong> {currentParams.filter(p => p.criticalFlag).length} Critical CPPs of {currentParams.filter(p => p.severity !== null && p.occurrence !== null && p.detectability !== null).length} scored ({currentParams.filter(p => p.severity === null || p.occurrence === null || p.detectability === null).length} unscored)
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setStep('create-project')}>
            ← Back to Setup
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleCompleteStep}
            disabled={saving || !canComplete}
            style={{ fontWeight: 600 }}
          >
            {saving ? 'Completing…' : 'Confirm & Continue to Define Factors →'}
          </button>
        </div>
      </div>

      {/* Main Page Title */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0 }}>CQA & Risk Assessment</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
          Define the Critical Quality Attributes, then work backwards through the process to find the parameters that can affect them (ICH Q8(R2) / Q9).
        </p>
      </div>

      {/* Inline Pruning Notification */}
      {removedNotification && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.85rem',
          color: '#1e40af'
        }}>
          <Info size={16} />
          <span>{removedNotification}</span>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          PART A: DERIVE CQAs
          ════════════════════════════════════════════════════════════ */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Part A · Derive Critical Quality Attributes (CQAs)
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
              Assess each target attribute against severity of harm (Impact) and state of knowledge (Uncertainty).
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setGuidelinesModalOpen(true)}
            style={{ fontSize: '0.78rem' }}
          >
            📖 Regulatory Guidelines
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Left Column: QTPP Toggles */}
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <strong style={{ fontSize: '0.9rem' }}>QTPP Target Attributes</strong>
              <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>{qtpp.length} targets</span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Toggle ON to assess as CQA for this unit operation.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {qtpp.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No QTPP attributes found. Return to Step 01 to define targets.
                </div>
              ) : (
                qtpp.map(q => {
                  const isAssessed = cqaItems.some(c =>
                    (c.linkedQtppIds && c.linkedQtppIds.includes(q.id)) ||
                    c.name.toLowerCase() === q.attribute.toLowerCase()
                  )
                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: '0.65rem 0.85rem',
                        borderRadius: '6px',
                        border: isAssessed ? '1.5px solid var(--accent)' : '1px solid var(--border-color)',
                        background: isAssessed ? 'rgba(0, 174, 179, 0.05)' : '#ffffff',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: isAssessed ? 'var(--primary)' : 'inherit' }}>
                          {q.attribute}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {q.criterion || 'Specification defined'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleQtpp(q)}
                        className={`badge ${isAssessed ? 'badge-primary' : 'badge-secondary'}`}
                        style={{ cursor: 'pointer', padding: '0.3rem 0.6rem', border: 'none', fontWeight: 600 }}
                      >
                        {isAssessed ? 'CQA ON' : 'OFF'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Assessed CQAs Cards */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '1.15rem',
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)' }}>
                  Assessed Quality Attributes
                </strong>
                <span className="badge badge-primary" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  {cqaItems.length} active
                </span>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const newCqa: CQAMapping = {
                    id: `cqa-custom-${Date.now()}`,
                    name: '',
                    appliesTo: 'Final API',
                    stageName: currentStage.name,
                    method: '',
                    range: '',
                    justification: 'Internal Spec',
                    linkedQtppIds: [],
                    impact_score: 3,
                    uncertainty_score: 3,
                    criticality_score: 9,
                    is_critical: false,
                    rationale: '',
                    reference: 'In-house specification',
                    origin: 'chemist_added',
                    version: 1
                  }
                  setEditingCqa(newCqa)
                  setDrawerOpen(true)
                }}
                style={{ fontSize: '0.78rem' }}
              >
                + Add Custom CQA
              </button>
            </div>

            {cqaItems.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                background: '#ffffff',
                borderRadius: '8px',
                border: '1px dashed #cbd5e1'
              }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
                  No CQAs assessed yet. Toggle ON QTPP attributes on the left to derive CQAs for <strong>{currentStage.name}</strong>.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1rem' }}>
                {cqaItems.map(cqa => (
                  <div
                    key={cqa.id}
                    style={{
                      border: cqa.is_critical ? '1.5px solid #fecaca' : '1px solid #e2e8f0',
                      borderTop: cqa.is_critical ? '3px solid #ef4444' : '3px solid #005baa',
                      borderRadius: '8px',
                      padding: '1rem',
                      background: '#ffffff',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      transition: 'box-shadow 0.2s, transform 0.15s'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: 1.3 }}>{cqa.name}</strong>
                        <span className={`badge ${cqa.is_critical ? 'badge-danger' : 'badge-secondary'}`} style={{ fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                          {cqa.is_critical ? 'CRITICAL CQA' : 'Non-Critical'}
                        </span>
                      </div>

                      <div style={{
                        fontSize: '0.78rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.75rem',
                        background: '#f8fafc',
                        padding: '0.5rem 0.65rem',
                        borderRadius: '6px',
                        border: '1px solid #f1f5f9'
                      }}>
                        <div style={{ marginBottom: '0.2rem' }}><strong>Target:</strong> {cqa.range || 'Defined'}</div>
                        <div><strong>Method:</strong> {cqa.method || 'Standard HPLC'}</div>
                      </div>

                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        padding: '0.5rem 0.65rem',
                        borderRadius: '6px',
                        fontSize: '0.74rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.75rem'
                      }}>
                        <span>Severity: <strong>{cqa.impact_score}/5</strong></span>
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        <span>Uncertainty: <strong>{cqa.uncertainty_score}/5</strong></span>
                        <span style={{ color: '#cbd5e1' }}>|</span>
                        <span>Score: <strong>{cqa.criticality_score}</strong></span>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '0.6rem',
                      borderTop: '1px solid #f1f5f9'
                    }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingCqa(cqa)
                          setDrawerOpen(true)
                        }}
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                      >
                        Edit Assessment
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCQA(cqa.id, cqa.name)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════
          PART B: REVERSE RISK WALK
          ════════════════════════════════════════════════════════════ */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Part B · Reverse Risk Walk: Process Parameter Risk Matrix
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
              Evaluate whether parameter fluctuations in <strong>{currentStage.name}</strong> can compromise your assessed CQAs.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem' }}>
              <label><strong>RPN Cutoff:</strong></label>
              <input
                type="number"
                className="form-input"
                style={{ width: '70px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                value={rpnThreshold}
                onChange={e => {
                  const val = parseInt(e.target.value, 10) || 100
                  setRpnThreshold(val)
                  // Recalculate flags
                  const updated = currentParams.map(p => ({
                    ...p,
                    criticalFlag: p.rpn !== null && p.rpn > val
                  }))
                  setLocalRisk({
                    ...localRisk,
                    [currentStage.id]: { parameters: updated }
                  })
                }}
              />
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowRpnGuide(true)}
              style={{ fontSize: '0.78rem' }}
            >
              RPN Scale Guide
            </button>
          </div>
        </div>

        {/* Target CQAs Strip for Active Stage */}
        <div style={{
          background: '#f8fafc',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          marginBottom: '1.25rem',
          border: '1px solid var(--border-color)'
        }}>
          <strong style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginRight: '0.5rem' }}>
            Target CQAs for {currentStage.name}:
          </strong>
          {cqaItems.length === 0 ? (
            <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
              ⚠️ No CQAs assessed. Please assess at least one CQA in Part A above.
            </span>
          ) : (
            <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.4rem', verticalAlign: 'middle' }}>
              {cqaItems.map(c => (
                <span key={c.id} className={`badge ${c.is_critical ? 'badge-danger' : 'badge-secondary'}`} style={{ fontSize: '0.72rem' }}>
                  {c.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Process Parameter Table */}
        <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                {isRiskEditMode && <th style={{ width: '3%' }} />}
                <th style={{ width: '3%' }}>#</th>
                <th style={{ width: '22%' }}>Process Parameter</th>
                <th style={{ width: '14%' }}>Type</th>
                <th style={{ width: '19%' }}>Linked CQA(s)</th>
                <th style={{ width: '7%', textAlign: 'center' }}>S</th>
                <th style={{ width: '6%', textAlign: 'center' }}>O</th>
                <th style={{ width: '6%', textAlign: 'center' }}>D</th>
                <th style={{ width: '7%', textAlign: 'center' }}>RPN</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Status</th>
                <th style={{ width: '8%', textAlign: 'center' }}>Review</th>
              </tr>
            </thead>
            <tbody>
              {currentParams.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No parameters recorded. Click "+ Add Parameter" to begin the risk walk.
                  </td>
                </tr>
              ) : (
                currentParams
                  .slice()
                  .sort((a, b) => {
                    const rpnA = a.rpn ?? -1
                    const rpnB = b.rpn ?? -1
                    return rpnB - rpnA
                  })
                  .map((param, idx) => {
                    const isLinked = param.linkedCqaIds && param.linkedCqaIds.length > 0
                    const isMarkedNotImpacting = (param as any).notImpacting === true
                    const hasOverriddenS = (param as any).manualSeverity === true
                    const isSuggested = param.status === 'suggested'
                    const isScored = param.severity !== null && param.occurrence !== null && param.detectability !== null
                    const isLikelyRelevant = isParamLikelyRelevant(param.name, cqaItems)

                    // Compute maximum impact of linked CQAs as non-binding hint
                    const linkedCqas = cqaItems.filter(c => (param.linkedCqaIds || []).includes(c.id))
                    const maxLinkedImpact = linkedCqas.length > 0
                      ? Math.max(...linkedCqas.map(c => c.impact_score || 1))
                      : null

                    return (
                      <tr key={param.id} style={{ background: isSuggested ? 'rgba(254, 249, 195, 0.15)' : undefined }}>
                        {isRiskEditMode && (
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={selectedParamIds.includes(param.id)}
                              onChange={() => {
                                setSelectedParamIds(prev =>
                                  prev.includes(param.id) ? prev.filter(id => id !== param.id) : [...prev, param.id]
                                )
                              }}
                            />
                          </td>
                        )}
                        <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <input
                              type="text"
                              className="form-input"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', flex: 1 }}
                              value={param.name}
                              onChange={e => handleParamChange(param.id, 'name', e.target.value)}
                              placeholder="e.g. Reaction Temperature"
                            />
                            {isLikelyRelevant && (
                              <span
                                className="badge badge-secondary"
                                style={{
                                  fontSize: '0.68rem',
                                  background: '#e0f2fe',
                                  color: '#0369a1',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  padding: '0.15rem 0.4rem',
                                  whiteSpace: 'nowrap'
                                }}
                                title="This parameter directly correlates with one or more of your assessed CQAs"
                              >
                                <Sparkles size={11} /> Likely relevant
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <select
                            className="form-select"
                            style={{
                              padding: '0.35rem 1.6rem 0.35rem 0.5rem',
                              fontSize: '0.8rem',
                              minWidth: '125px',
                              backgroundPosition: 'right 0.35rem center',
                              backgroundSize: '1.1em 1.1em'
                            }}
                            value={param.type}
                            onChange={e => handleParamChange(param.id, 'type', e.target.value)}
                          >
                            <option value="CPP-candidate">CPP-candidate</option>
                            <option value="CMA-candidate">CMA-candidate</option>
                          </select>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', alignItems: 'center' }}>
                            {cqaItems.map(c => {
                              const isSelected = (param.linkedCqaIds || []).includes(c.id)
                              return (
                                <span
                                  key={c.id}
                                  onClick={() => {
                                    const current = param.linkedCqaIds || []
                                    const updated = isSelected ? current.filter(id => id !== c.id) : [...current, c.id]
                                    handleParamChange(param.id, 'linkedCqaIds', updated)
                                  }}
                                  style={{
                                    cursor: 'pointer',
                                    padding: '0.2rem 0.45rem',
                                    borderRadius: '4px',
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    background: isSelected ? 'rgba(0, 174, 179, 0.15)' : '#f1f5f9',
                                    color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                                    border: isSelected ? '1px solid var(--accent)' : '1px solid transparent'
                                  }}
                                  title={`Click to ${isSelected ? 'unlink' : 'link'} ${c.name}`}
                                >
                                  {c.name.split(' ')[0]}
                                </span>
                              )
                            })}
                          </div>
                          {!isLinked && (
                            <div style={{ fontSize: '0.7rem', color: isMarkedNotImpacting ? 'var(--text-muted)' : '#d97706', marginTop: '3px' }}>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={isMarkedNotImpacting}
                                  onChange={e => handleParamChange(param.id, 'notImpacting', e.target.checked)}
                                />
                                Mark as not impacting
                              </label>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            max="5"
                            placeholder="—"
                            className="form-input"
                            style={{ width: '45px', textAlign: 'center', padding: '0.25rem' }}
                            value={param.severity ?? ''}
                            onChange={e => {
                              const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                              handleParamChange(param.id, 'severity', val)
                            }}
                          />
                          {hasOverriddenS && (
                            <div style={{ fontSize: '0.62rem', color: '#d97706' }} title="Severity overridden by chemist">Manual S</div>
                          )}
                          {!hasOverriddenS && maxLinkedImpact !== null && param.severity === null && (
                            <div style={{ fontSize: '0.65rem', marginTop: '2px' }}>
                              <button
                                type="button"
                                onClick={() => handleParamChange(param.id, 'severity', maxLinkedImpact)}
                                style={{
                                  background: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '3px',
                                  fontSize: '0.62rem',
                                  cursor: 'pointer',
                                  padding: '1px 3px',
                                  color: '#334155'
                                }}
                                title={`Linked CQA highest impact is ${maxLinkedImpact}. Click to apply as S.`}
                              >
                                S hint: {maxLinkedImpact} [Apply]
                              </button>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            max="5"
                            placeholder="—"
                            className="form-input"
                            style={{ width: '45px', textAlign: 'center', padding: '0.25rem' }}
                            value={param.occurrence ?? ''}
                            onChange={e => {
                              const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                              handleParamChange(param.id, 'occurrence', val)
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="1"
                            max="5"
                            placeholder="—"
                            className="form-input"
                            style={{ width: '45px', textAlign: 'center', padding: '0.25rem' }}
                            value={param.detectability ?? ''}
                            onChange={e => {
                              const val = e.target.value === '' ? null : parseInt(e.target.value, 10)
                              handleParamChange(param.id, 'detectability', val)
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.92rem' }}>
                          {isScored && param.rpn !== null ? param.rpn : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {!isScored ? (
                            <span className="badge badge-secondary" style={{ fontSize: '0.72rem', background: '#f1f5f9', color: '#64748b' }}>
                              Not scored
                            </span>
                          ) : (
                            <span className={`badge ${param.criticalFlag ? 'badge-danger' : 'badge-secondary'}`} style={{ fontSize: '0.72rem' }}>
                              {param.criticalFlag ? 'CRITICAL (CPP)' : 'Low Risk'}
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {isSuggested ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <span
                                className="badge"
                                style={{
                                  fontSize: '0.68rem',
                                  background: '#fef3c7',
                                  color: '#b45309',
                                  border: '1px solid #fde68a'
                                }}
                              >
                                Suggested
                              </span>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleConfirmParam(param.id)}
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.72rem', color: '#16a34a' }}
                                title="Confirm this suggested parameter"
                              >
                                <Check size={13} />
                              </button>
                            </div>
                          ) : (
                            <span
                              className="badge"
                              style={{
                                fontSize: '0.68rem',
                                background: param.status === 'custom' ? '#f3e8ff' : '#ecfdf5',
                                color: param.status === 'custom' ? '#7e22ce' : '#047857'
                              }}
                            >
                              {param.status === 'custom' ? 'Custom' : 'Confirmed'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* Action Controls for Risk Matrix */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddParam}>
              + Add Parameter
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleConfirmAllScored}
              title="Confirm all suggested rows that already have S, O, and D scores"
            >
              ✓ Confirm all scored rows
            </button>
            {isRiskEditMode ? (
              <>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleDeleteSelectedParams} style={{ color: '#ef4444' }}>
                  Delete Selected ({selectedParamIds.length})
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => setIsRiskEditMode(false)}>
                  Done
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsRiskEditMode(true)}>
                Manage / Delete Rows
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Validation Checklist if Blocked */}
      {validationIssues.length > 0 && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fef3c7',
          borderRadius: '8px',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          color: '#92400e'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, marginBottom: '0.4rem' }}>
            <AlertTriangle size={18} color="#d97706" />
            <span>Criteria required to complete CQA & Risk Assessment:</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem' }}>
            {validationIssues.map((issue, idx) => (
              <li key={idx} style={{ marginTop: '0.2rem' }}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Bottom Sticky Action Bar */}
      <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" className="btn btn-secondary" onClick={() => setStep('create-project')}>
          ← Back to Project Setup & QTPP
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleCompleteStep}
          disabled={saving || !canComplete}
          style={{ minWidth: '220px', fontWeight: 600 }}
        >
          {saving ? (
            <><div className="spinner" /> Saving…</>
          ) : (
            'Confirm & Continue to Stage Campaign Matrix →'
          )}
        </button>
      </div>

      {/* CQA Drawer / Modal */}
      {drawerOpen && editingCqa && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            width: '480px',
            maxWidth: '90vw',
            height: '100vh',
            background: '#ffffff',
            padding: '1.5rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0 }}>CQA Assessment</h3>
                <button type="button" onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Attribute Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingCqa.name}
                    onChange={e => setEditingCqa({ ...editingCqa, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Specification / Range</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingCqa.range || ''}
                    onChange={e => setEditingCqa({ ...editingCqa, range: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Analytical Method</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingCqa.method || ''}
                    onChange={e => setEditingCqa({ ...editingCqa, method: e.target.value })}
                  />
                </div>

                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Severity of Harm (1-5)</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      className="form-input"
                      value={editingCqa.impact_score ?? 3}
                      onChange={e => setEditingCqa({ ...editingCqa, impact_score: parseInt(e.target.value, 10) || 1 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Uncertainty (1-5)</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      className="form-input"
                      value={editingCqa.uncertainty_score ?? 3}
                      onChange={e => setEditingCqa({ ...editingCqa, uncertainty_score: parseInt(e.target.value, 10) || 1 })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Guideline Reference / Monograph</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editingCqa.reference || ''}
                    onChange={e => setEditingCqa({ ...editingCqa, reference: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setDrawerOpen(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={() => saveDrawerCqa(editingCqa)}>Save Assessment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
