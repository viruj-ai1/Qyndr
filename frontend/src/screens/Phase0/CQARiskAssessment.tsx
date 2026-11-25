// src/screens/Phase0/CQARiskAssessment.tsx – Step 02: CQA & Risk Assessment (Single Stage)
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useStore, CQAMapping, QTPPItem, RiskParameter, CQAAttributeItem, CQAClassification } from '../../store/useStore'
import { Projects, CQAApi, WorkflowApi, QTPPApi } from '../../services/api'
import CreateProject from '../CreateProject'
import {
  generateContextAwareRiskParameters,
  isDummyRiskParams
} from '../../utils/routeGenerator'
import { isParamLikelyRelevant, sanitizeParamName } from '../../config/unitOpRiskParameters'
import { RPN_DIMENSIONS, RPN_GUIDE_CONTENT } from '../../utils/rpnExplanationData'
import { Info, X, SlidersHorizontal, AlertTriangle, CheckCircle2, Check, Sparkles, ArrowRight, ArrowLeft, Plus, Trash2, Copy, ChevronDown, ChevronRight, Eye } from 'lucide-react'
import toast from 'react-hot-toast'

const EVIDENCE_BASIS_OPTIONS = [
  'Scientific knowledge',
  'Product development literature',
  'Prior knowledge / similar products',
  'Regulatory guidance',
  'Preliminary experimental data',
  'Clinical / patient data',
  'Other'
]

// Custom multi-select dropdown for Linked QTPP Attributes with checkboxes
function QTPPMultiSelectDropdown({
  selectedIds,
  qtppList,
  onChange
}: {
  selectedIds: string[]
  qtppList: QTPPItem[]
  onChange: (ids: string[]) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const selectedCount = selectedIds?.length || 0
  const selectedText = useMemo(() => {
    if (selectedCount === 0) return 'Select QTPP attribute(s)...'
    if (selectedCount === 1) {
      const match = qtppList.find(q => q.id === selectedIds[0])
      return match ? (match.attribute_name || match.attribute) : '1 selected'
    }
    return `${selectedCount} attributes selected`
  }, [selectedCount, selectedIds, qtppList])

  const toggleId = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length === 1) {
        toast.error('At least one QTPP attribute must remain linked.')
        return
      }
      onChange(selectedIds.filter(i => i !== id))
    } else {
      onChange([...selectedIds, id])
    }
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.45rem 0.65rem',
          fontSize: '0.8rem',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          color: selectedCount > 0 ? '#1e293b' : '#94a3b8',
          fontWeight: selectedCount > 0 ? 600 : 400
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '0.5rem' }}>
          {selectedText}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0, color: '#64748b', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '280px',
            maxHeight: '360px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
            zIndex: 100,
            padding: '0.35rem 0'
          }}
        >
          {qtppList.length === 0 ? (
            <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.78rem', color: '#94a3b8' }}>
              No QTPP attributes available
            </div>
          ) : (
            qtppList.map(q => {
              const isChecked = selectedIds.includes(q.id)
              return (
                <label
                  key={q.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.5rem',
                    padding: '0.4rem 0.75rem',
                    cursor: 'pointer',
                    backgroundColor: isChecked ? '#f1f5f9' : 'transparent',
                    fontSize: '0.78rem',
                    userSelect: 'none',
                    lineHeight: 1.3
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = isChecked ? '#e2e8f0' : '#f8fafc')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = isChecked ? '#f1f5f9' : 'transparent')}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleId(q.id)}
                    style={{ marginTop: '0.15rem', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: isChecked ? 600 : 500, color: '#1e293b' }}>
                      {q.attribute_name || q.attribute}
                    </span>
                    {(q.display_string || q.criterion) && (
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {q.display_string || q.criterion}
                      </span>
                    )}
                  </div>
                </label>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function EvidenceBasisMultiSelectDropdown({
  selectedOptions,
  onChange
}: {
  selectedOptions: string[]
  onChange: (options: string[]) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const selectedCount = selectedOptions?.length || 0
  const selectedText = useMemo(() => {
    if (selectedCount === 0) return 'Select evidence basis...'
    if (selectedCount === 1) return selectedOptions[0]
    return `${selectedCount} bases selected`
  }, [selectedCount, selectedOptions])

  const toggleOption = (opt: string) => {
    if (selectedOptions.includes(opt)) {
      onChange(selectedOptions.filter(o => o !== opt))
    } else {
      onChange([...selectedOptions, opt])
    }
  }

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.45rem 0.65rem',
          fontSize: '0.8rem',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          cursor: 'pointer',
          textAlign: 'left',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          color: selectedCount > 0 ? '#1e293b' : '#94a3b8',
          fontWeight: selectedCount > 0 ? 600 : 400
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '0.5rem' }}>
          {selectedText}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0, color: '#64748b', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            width: '260px',
            maxHeight: '340px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            zIndex: 100,
            padding: '0.35rem 0'
          }}
        >
          {EVIDENCE_BASIS_OPTIONS.map(opt => {
            const isChecked = selectedOptions.includes(opt)
            return (
              <label
                key={opt}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.45rem 0.75rem',
                  cursor: 'pointer',
                  backgroundColor: isChecked ? '#f1f5f9' : 'transparent',
                  fontSize: '0.78rem',
                  userSelect: 'none'
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = isChecked ? '#e2e8f0' : '#f8fafc')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = isChecked ? '#f1f5f9' : 'transparent')}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleOption(opt)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontWeight: isChecked ? 600 : 500, color: '#1e293b' }}>
                  {opt}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

const SEVERITY_LEVELS: { value: number; label: string; desc: string }[] = [
  { value: 1, label: '1 Negligible', desc: 'No meaningful patient impact' },
  { value: 2, label: '2 Low', desc: 'Minor potential impact' },
  { value: 3, label: '3 Moderate', desc: 'Potential impact on product performance' },
  { value: 4, label: '4 High', desc: 'Significant potential impact on safety or efficacy' },
  { value: 5, label: '5 Critical', desc: 'Serious potential patient harm' }
]

const IR_TABLET_CQA_EXAMPLE = [
  {
    attribute_name: 'Assay',
    description: 'Active pharmaceutical ingredient potency per unit dose.',
    scientific_justification: 'Potency directly dictates therapeutic dosage received by patient. Subpotency or superpotency leads to clinical failure or toxicity.',
    severity_score: 5,
    evidence_basis: ['Scientific knowledge', 'Regulatory guidance'],
    classification: 'POTENTIAL_CQA' as CQAClassification,
    decision_justification: '',
    match_qtpp_keywords: ['assay', 'dosage strength', 'potency']
  },
  {
    attribute_name: 'Content uniformity',
    description: 'Consistency of active ingredient across individual dosage units.',
    scientific_justification: 'Ensures each tablet provides uniform therapeutic dose within pharmacopoeial acceptance limits.',
    severity_score: 4,
    evidence_basis: ['Scientific knowledge', 'Product development literature'],
    classification: 'POTENTIAL_CQA' as CQAClassification,
    decision_justification: '',
    match_qtpp_keywords: ['content uniformity', 'dose consistency', 'uniformity']
  },
  {
    attribute_name: 'Dissolution',
    description: 'In vitro drug release kinetics from tablet matrix into dissolution media.',
    scientific_justification: 'Dissolution can influence drug release and bioavailability, making it relevant to therapeutic performance.',
    severity_score: 5,
    evidence_basis: ['Scientific knowledge', 'Prior knowledge / similar products'],
    classification: 'POTENTIAL_CQA' as CQAClassification,
    decision_justification: '',
    match_qtpp_keywords: ['dissolution', 'drug release profile', 'stability', 'release']
  },
  {
    attribute_name: 'Related substances / Impurities',
    description: 'Degradation products and process-related chemical impurities.',
    scientific_justification: 'Toxicological threshold of qualification; organic impurities may trigger adverse immunological or clinical reactions.',
    severity_score: 5,
    evidence_basis: ['Scientific knowledge', 'Regulatory guidance'],
    classification: 'POTENTIAL_CQA' as CQAClassification,
    decision_justification: '',
    match_qtpp_keywords: ['purity', 'related substances', 'impurity', 'stability']
  },
  {
    attribute_name: 'Water content',
    description: 'Residual moisture in finished solid oral formulation.',
    scientific_justification: 'Moisture level governs chemical hydrolysis rate and physical tablet hardness over shelf-life.',
    severity_score: 3,
    evidence_basis: ['Product development literature', 'Prior knowledge / similar products'],
    classification: 'POTENTIAL_CQA' as CQAClassification,
    decision_justification: '',
    match_qtpp_keywords: ['stability', 'physical properties']
  }
]

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
    setStepStatuses,
    addAuditLog,
    unlockedStep,
    setUnlockedStep
  } = useStore()

  // ── WIZARD STEP STATE ─────────────────────────────────────────
  // 1 = Derive CQAs, 2 = Process Parameter Risk Matrix
  const [wizardStep, setWizardStep] = useState<1 | 2>(1)
  const [isProjectSetupModalOpen, setIsProjectSetupModalOpen] = useState(false)

  // ── SINGLE STAGE CONTEXT ─────────────────────────────────────
  const currentStage = useMemo(() => {
    if (stages && stages.length > 0) return stages[0]
    if (currentProject?.stages_data && currentProject.stages_data.length > 0) return currentProject.stages_data[0]
    return { id: 'stage-1', name: 'Stage 1 – Reaction', unitOpType: 'Reaction' }
  }, [stages, currentProject?.stages_data])

  // ── PART A: CQA IDENTIFICATION & CRITICALITY STATE ──────────
  const [cqaAttributes, setCqaAttributes] = useState<CQAAttributeItem[]>([])
  const [qtppList, setQtppList] = useState<QTPPItem[]>([])
  const [loadingCqas, setLoadingCqas] = useState(false)
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const [selectedCqaIds, setSelectedCqaIds] = useState<string[]>([])
  const [expandedRiskRowIds, setExpandedRiskRowIds] = useState<string[]>([])
  const [showTraceability, setShowTraceability] = useState(false)
  const [aiSuggestionsDrawerOpen, setAiSuggestionsDrawerOpen] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([])
  const [loadingAi, setLoadingAi] = useState(false)
  const [draggedCqaIdx, setDraggedCqaIdx] = useState<number | null>(null)

  // Fetch QTPP specifications and CQA attributes from backend
  const loadCqasAndQtpp = async () => {
    if (!currentProject?.id) return
    setLoadingCqas(true)
    try {
      const [qtppData, cqaData] = await Promise.all([
        QTPPApi.get(currentProject.id).catch(() => []),
        CQAApi.getAll(currentProject.id).catch(() => [])
      ])
      let finalQtpp = (qtppData && qtppData.length > 0) ? qtppData : qtpp
      // If server returned empty QTPP but we have store QTPP, ensure server has them
      if ((!qtppData || qtppData.length === 0) && qtpp.length > 0) {
        try {
          const saved = await QTPPApi.save(currentProject.id, qtpp)
          if (saved && saved.length > 0) finalQtpp = saved
        } catch {}
      }
      setQtppList(finalQtpp)
      setCqaAttributes(cqaData || [])
    } catch (e) {
      console.error('Error loading CQAs/QTPP:', e)
    } finally {
      setLoadingCqas(false)
    }
  }

  useEffect(() => {
    loadCqasAndQtpp()
  }, [currentProject?.id])

  // Sync approved CQAs to store and cqaItems for downstream DoE and Phase 0
  const cqaItems: CQAMapping[] = useMemo(() => {
    return cqaAttributes.map(c => ({
      id: c.id,
      name: c.attribute_name,
      appliesTo: 'Final API',
      stageName: currentStage.name,
      method: 'Pharmacopoeial standard',
      range: c.linked_qtpp_details?.[0]?.display_string || 'Conforms',
      justification: c.decision_justification || c.scientific_justification,
      linkedQtppIds: c.linked_qtpp_ids || [],
      impact_score: c.severity_score,
      uncertainty_score: c.secondary_risk?.occurrence || 3,
      criticality_score: c.severity_score * (c.secondary_risk?.occurrence || 3),
      is_critical: c.classification === 'CQA',
      rationale: c.scientific_justification,
      reference: 'ICH Q8(R2) / ICH Q9(R1)'
    }))
  }, [cqaAttributes, currentStage.name])

  const [guidelinesModalOpen, setGuidelinesModalOpen] = useState(false)

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

  // ── CQA TABLE ACTIONS & HANDLERS ────────────────────────────
  const handleAddCqaRow = async () => {
    if (!currentProject?.id) return
    if (qtppList.length === 0) {
      toast.error('No QTPP attributes available. Please define QTPP specifications first.')
      return
    }
    try {
      const newAttr = await CQAApi.create(currentProject.id, {
        attribute_name: `New Attribute ${cqaAttributes.length + 1}`,
        description: '',
        scientific_justification: 'Scientific assessment of impact on patient safety and clinical efficacy.',
        severity_score: 3,
        evidence_basis: ['Scientific knowledge'],
        classification: 'POTENTIAL_CQA',
        decision_justification: '',
        linked_qtpp_ids: [qtppList[0].id]
      })
      setCqaAttributes(prev => [...prev, newAttr])
      toast.success('Added new CQA attribute.')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to add CQA attribute.')
    }
  }

  const handleUpdateCqaField = async (cqaId: string, field: string, val: any) => {
    // Optimistic local update
    setCqaAttributes(prev => prev.map(c => {
      if (c.id !== cqaId) return c
      const updated = { ...c, [field]: val }
      return updated
    }))

    if (!currentProject?.id) return
    try {
      const payload: any = { [field]: val }
      // If updating linked_qtpp_ids, pass full array
      if (field === 'linked_qtpp_ids') {
        payload.linked_qtpp_ids = val
      }
      await CQAApi.update(currentProject.id, cqaId, payload)
    } catch (e: any) {
      console.error('Update error:', e)
    }
  }

  const handleUpdateSecondaryRisk = async (cqaId: string, field: 'occurrence' | 'detectability' | 'notes', val: any) => {
    setCqaAttributes(prev => prev.map(c => {
      if (c.id !== cqaId) return c
      const sec = { ...(c.secondary_risk || { cqa_id: cqaId, occurrence: null, detectability: null, notes: '' }), [field]: val }
      return { ...c, secondary_risk: sec }
    }))

    if (!currentProject?.id) return
    try {
      await CQAApi.update(currentProject.id, cqaId, {
        secondary_risk: { [field]: val }
      })
    } catch (e: any) {
      console.error('Risk update error:', e)
    }
  }

  const handleDeleteSelectedCqas = async () => {
    if (!currentProject?.id || selectedCqaIds.length === 0) return
    try {
      for (const id of selectedCqaIds) {
        await CQAApi.delete(currentProject.id, id)
      }
      setCqaAttributes(prev => prev.filter(c => !selectedCqaIds.includes(c.id)))
      setSelectedCqaIds([])
      setIsDeleteMode(false)
      toast.success(`Deleted ${selectedCqaIds.length} CQA attribute(s).`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to delete CQA attributes.')
    }
  }

  const handleDuplicateCqa = async (row: CQAAttributeItem) => {
    if (!currentProject?.id) return
    try {
      const newAttr = await CQAApi.create(currentProject.id, {
        attribute_name: `${row.attribute_name} (Copy)`,
        description: row.description,
        scientific_justification: row.scientific_justification,
        severity_score: row.severity_score,
        evidence_basis: row.evidence_basis,
        classification: row.classification,
        decision_justification: row.decision_justification,
        linked_qtpp_ids: row.linked_qtpp_ids.length > 0 ? row.linked_qtpp_ids : [qtppList[0]?.id]
      })
      setCqaAttributes(prev => [...prev, newAttr])
      toast.success(`Duplicated "${row.attribute_name}".`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to duplicate CQA.')
    }
  }



  const handleLoadIRTabletCQAs = async () => {
    if (!currentProject?.id) return
    if (qtppList.length === 0) {
      toast.error('No QTPP attributes available. Please define QTPP specifications first.')
      return
    }

    try {
      const newCreated: CQAAttributeItem[] = []
      for (const ex of IR_TABLET_CQA_EXAMPLE) {
        // Find matching QTPP attributes by keyword
        const matchingQtpps = qtppList.filter(q => {
          const qName = (q.attribute_name || q.attribute || '').toLowerCase()
          return ex.match_qtpp_keywords.some(kw => qName.includes(kw))
        })
        const linkedIds = matchingQtpps.length > 0 ? matchingQtpps.map(q => q.id) : [qtppList[0].id]

        const created = await CQAApi.create(currentProject.id, {
          attribute_name: ex.attribute_name,
          description: ex.description,
          scientific_justification: ex.scientific_justification,
          severity_score: ex.severity_score,
          evidence_basis: ex.evidence_basis,
          classification: ex.classification,
          decision_justification: ex.decision_justification,
          linked_qtpp_ids: linkedIds
        })
        newCreated.push(created)
      }
      setCqaAttributes(prev => [...prev, ...newCreated])
      toast.success('Loaded illustrative IR tablet CQA examples.')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to load example CQAs.')
    }
  }

  const handleSuggestAI = async () => {
    if (!currentProject?.id) return
    setLoadingAi(true)
    try {
      const res = await CQAApi.suggestAI(currentProject.id)
      setAiSuggestions(res.suggestions || [])
      setAiSuggestionsDrawerOpen(true)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to generate AI suggestions.')
    } finally {
      setLoadingAi(false)
    }
  }

  const handleAcceptAiSuggestion = async (sugg: any) => {
    if (!currentProject?.id) return
    try {
      const created = await CQAApi.create(currentProject.id, {
        attribute_name: sugg.attribute_name,
        description: sugg.description,
        scientific_justification: sugg.scientific_justification,
        severity_score: sugg.suggested_severity,
        evidence_basis: sugg.suggested_evidence_basis,
        classification: 'POTENTIAL_CQA',
        decision_justification: '',
        linked_qtpp_ids: sugg.linked_qtpp_ids
      })
      setCqaAttributes(prev => [...prev, created])
      setAiSuggestions(prev => prev.filter(s => s.temp_id !== sugg.temp_id))
      toast.success(`Accepted "${sugg.attribute_name}" as Potential CQA (Review required).`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to accept suggestion.')
    }
  }

  // Drag and drop reordering
  const handleDragStart = (idx: number) => setDraggedCqaIdx(idx)
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault()
    if (draggedCqaIdx === null || draggedCqaIdx === idx) return
    const reordered = [...cqaAttributes]
    const [moved] = reordered.splice(draggedCqaIdx, 1)
    reordered.splice(idx, 0, moved)
    setDraggedCqaIdx(idx)
    setCqaAttributes(reordered)
  }
  const handleDragEnd = async () => {
    setDraggedCqaIdx(null)
    if (!currentProject?.id) return
    const items = cqaAttributes.map((c, idx) => ({ id: c.id, sort_order: idx }))
    try {
      await CQAApi.reorder(currentProject.id, items)
    } catch (e) {
      console.error('Reorder error:', e)
    }
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
      issues.push('Assess at least one Critical Quality Attribute (CQA).')
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
        const resp = await WorkflowApi.complete(currentProject.id, 'cqa-risk', {
          cqas_data: cqaItems,
          risk_assessment_data: localRisk
        })
        if (resp?.step_statuses) {
          setStepStatuses(resp.step_statuses)
        }
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
      {/* Main Page Title */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 700, margin: 0 }}>CQA & Risk Assessment</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.35rem' }}>
          {wizardStep === 1
            ? 'Step 1 of 2: Derive Critical Quality Attributes (CQAs) from QTPP targets (ICH Q8(R2)).'
            : `Step 2 of 2: Process Parameter Risk Matrix for ${currentStage.name}.`}
        </p>
      </div>

      {/* Wizard Progress Stepper Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setWizardStep(1)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: wizardStep === 1 ? '2px solid #2563eb' : '1px solid var(--border)',
            background: wizardStep === 1 ? '#eff6ff' : '#ffffff',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: wizardStep === 1 ? '#2563eb' : cqaItems.length > 0 ? '#10b981' : '#e2e8f0',
            color: wizardStep === 1 || cqaItems.length > 0 ? '#ffffff' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: 700
          }}>
            {cqaItems.length > 0 && wizardStep !== 1 ? '✓' : '1'}
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: wizardStep === 1 ? '#1d4ed8' : 'var(--text-main)' }}>
              1. Derive CQAs
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {cqaItems.length} Quality Attributes Assessed
            </div>
          </div>
        </button>

        <div style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>→</div>

        <button
          type="button"
          onClick={() => {
            if (cqaItems.length > 0) {
              setWizardStep(2)
            } else {
              toast.error('Please assess at least one CQA before proceeding.')
            }
          }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: wizardStep === 2 ? '2px solid #2563eb' : '1px solid var(--border)',
            background: wizardStep === 2 ? '#eff6ff' : '#ffffff',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: wizardStep === 2 ? '#2563eb' : currentParams.filter(p => p.criticalFlag).length > 0 ? '#10b981' : '#e2e8f0',
            color: wizardStep === 2 || currentParams.filter(p => p.criticalFlag).length > 0 ? '#ffffff' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: 700
          }}>
            {currentParams.filter(p => p.criticalFlag).length > 0 && wizardStep !== 2 ? '✓' : '2'}
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: wizardStep === 2 ? '#1d4ed8' : 'var(--text-main)' }}>
              2. Parameter Risk Matrix
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {currentParams.length} Parameters · {currentParams.filter(p => p.criticalFlag).length} Critical CPPs
            </div>
          </div>
        </button>
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
          CQA IDENTIFICATION & CRITICALITY ASSESSMENT (STEP 1)
          ════════════════════════════════════════════════════════════ */}
      {wizardStep === 1 && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem 1.75rem', minHeight: '620px' }}>
            {/* Header section matching QTPP table */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    CQA Identification & Criticality Assessment
                  </h2>
                  <span className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>
                    ICH Q8(R2) / ICH Q9(R1)
                  </span>
                  <span className="badge" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                    ✓ QTPP linked
                  </span>
                </div>
                <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0.35rem 0 0', lineHeight: 1.4 }}>
                  Identify potential CQAs from the established QTPP and document their scientific criticality.
                </p>
                <div style={{ marginTop: '0.35rem', fontSize: '0.74rem', color: '#64748b' }}>
                  <strong>Note:</strong> Proposed application scoring descriptions, not official ICH thresholds. Have your formulation scientists approve the definitions.
                </div>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleSuggestAI}
                  disabled={loadingAi}
                  style={{
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    color: '#7c3aed',
                    borderColor: '#ddd6fe',
                    background: '#f5f3ff'
                  }}
                >
                  <Sparkles size={14} />
                  <span>{loadingAi ? 'Analyzing QTPP...' : 'Suggest CQAs from QTPP'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowTraceability(prev => !prev)}
                  style={{
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                >
                  <Eye size={14} />
                  <span>{showTraceability ? 'Hide Traceability' : 'Traceability Matrix'}</span>
                </button>

                {!isDeleteMode ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (cqaAttributes.length === 0) {
                        toast('No attributes to delete.')
                        return
                      }
                      setIsDeleteMode(true)
                    }}
                    style={{
                      color: '#ef4444',
                      borderColor: 'rgba(239, 68, 68, 0.35)',
                      fontWeight: 600
                    }}
                  >
                    <Trash2 size={14} style={{ marginRight: '0.25rem' }} /> Delete
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={handleDeleteSelectedCqas}
                      style={{
                        backgroundColor: '#ef4444',
                        borderColor: '#dc2626',
                        color: '#ffffff',
                        fontWeight: 600
                      }}
                    >
                      Confirm Delete {selectedCqaIds.length > 0 ? `(${selectedCqaIds.length})` : ''}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setIsDeleteMode(false)
                        setSelectedCqaIds([])
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleAddCqaRow}
                  title="Add a new CQA attribute row"
                >
                  <Plus size={14} style={{ marginRight: '0.2rem' }} /> Add Attribute
                </button>
              </div>
            </div>

            {/* QTPP-to-CQA Traceability View (Collapsible) */}
            {showTraceability && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.25rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <strong style={{ fontSize: '0.88rem', color: '#1e293b' }}>QTPP to CQA Traceability Matrix</strong>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Ensures every quality target is evaluated for criticality</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#edf2f7', borderBottom: '1px solid #cbd5e1', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem 0.6rem' }}>QTPP Specification</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Classification</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Target Criteria</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Linked CQAs</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Coverage Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {qtppList.map(q => {
                        const linked = cqaAttributes.filter(c => c.linked_qtpp_ids && c.linked_qtpp_ids.includes(q.id))
                        const isCovered = linked.length > 0
                        return (
                          <tr key={q.id} style={{ borderBottom: '1px solid #f1f5f9', background: isCovered ? '#ffffff' : '#fffbeb' }}>
                            <td style={{ padding: '0.4rem 0.6rem', fontWeight: 600 }}>{q.attribute_name || q.attribute}</td>
                            <td style={{ padding: '0.4rem 0.6rem', color: '#64748b' }}>{q.attribute_classification || q.type || 'Other'}</td>
                            <td style={{ padding: '0.4rem 0.6rem' }}>{q.display_string || q.criterion || 'Defined'}</td>
                            <td style={{ padding: '0.4rem 0.6rem' }}>
                              {linked.length > 0 ? (
                                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                  {linked.map(c => (
                                    <span key={c.id} className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                                      {c.cqa_code}: {c.attribute_name} ({c.classification})
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ color: '#d97706', fontWeight: 600 }}>⚠️ No CQA linked</span>
                              )}
                            </td>
                            <td style={{ padding: '0.4rem 0.6rem' }}>
                              <span className={`badge ${isCovered ? 'badge-primary' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                                {isCovered ? `${linked.length} CQA(s)` : 'Needs CQA evaluation'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CQA Table Container with Horizontal and Vertical Scrolling */}
            <div
              style={{
                overflowX: 'auto',
                overflowY: 'visible',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.5rem',
                backgroundColor: '#ffffff',
                minHeight: '440px'
              }}
            >
              <table className="data-table" style={{ width: '100%', minWidth: '1350px', fontSize: '0.84rem' }}>
                <thead>
                  <tr>
                    {isDeleteMode && (
                      <th style={{ width: '3%', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={cqaAttributes.length > 0 && selectedCqaIds.length === cqaAttributes.length}
                          onChange={() => {
                            if (selectedCqaIds.length === cqaAttributes.length) {
                              setSelectedCqaIds([])
                            } else {
                              setSelectedCqaIds(cqaAttributes.map(c => c.id))
                            }
                          }}
                          style={{ cursor: 'pointer' }}
                        />
                      </th>
                    )}
                    <th style={{ width: '6%' }}>CQA ID</th>
                    <th style={{ width: '14%' }}>Quality attribute name</th>
                    <th style={{ width: '16%' }}>Linked QTPP attribute(s)</th>
                    <th style={{ width: '16%' }}>Description</th>
                    <th style={{ width: '18%' }}>Scientific justification</th>
                    <th style={{ width: '13%' }}>Severity of patient impact</th>
                    <th style={{ width: '14%' }}>Evidence / basis</th>
                    <th style={{ width: '18%' }}>Criticality classification</th>
                  </tr>
                </thead>
                <tbody>
                  {cqaAttributes.length === 0 ? (
                    <tr>
                      <td colSpan={isDeleteMode ? 9 : 8} style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔬</div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                          No CQAs Identified Yet
                        </div>
                        <div style={{ fontSize: '0.82rem', maxWidth: '540px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                          According to ICH Q8(R2), the Quality Target Product Profile (QTPP) forms the basis for identifying potential Critical Quality Attributes (CQAs).
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button className="btn btn-primary btn-sm" onClick={handleAddCqaRow}>
                            <Plus size={14} style={{ marginRight: '0.3rem' }} /> Add Attribute
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={handleSuggestAI}>
                            <Sparkles size={14} style={{ marginRight: '0.3rem' }} /> Suggest CQAs from QTPP
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    cqaAttributes.map((row, idx) => {
                      const isChecked = selectedCqaIds.includes(row.id)
                      const isRiskExpanded = expandedRiskRowIds.includes(row.id)
                      const hasHighSeverity = row.severity_score >= 4
                      const isClassificationFinal = row.classification === 'CQA' || row.classification === 'NON_CQA'
                      const decisionMissing = isClassificationFinal && (!row.decision_justification || !row.decision_justification.trim())

                      return (
                        <React.Fragment key={row.id}>
                          <tr
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDragEnd={handleDragEnd}
                            style={{
                              background: isChecked ? 'rgba(239, 68, 68, 0.04)' : undefined,
                              cursor: 'default',
                              opacity: draggedCqaIdx === idx ? 0.4 : 1
                            }}
                          >
                            {/* Checkbox (in delete mode) */}
                            {isDeleteMode && (
                              <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '1rem' }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    setSelectedCqaIds(prev =>
                                      prev.includes(row.id) ? prev.filter(i => i !== row.id) : [...prev, row.id]
                                    )
                                  }}
                                  style={{ cursor: 'pointer' }}
                                />
                              </td>
                            )}

                            {/* Column 1: CQA ID (read-only code) */}
                            <td style={{ verticalAlign: 'top', paddingTop: '0.8rem' }}>
                              <span className="badge badge-primary" style={{ fontWeight: 700, fontSize: '0.78rem' }}>
                                {row.cqa_code}
                              </span>
                            </td>

                            {/* Column 2: Quality attribute name */}
                            <td style={{ verticalAlign: 'top', paddingTop: '0.8rem' }}>
                              <input
                                type="text"
                                className="form-input"
                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', fontWeight: 600 }}
                                value={row.attribute_name}
                                onChange={e => handleUpdateCqaField(row.id, 'attribute_name', e.target.value)}
                                placeholder="e.g. Assay"
                              />
                            </td>

                            {/* Column 3: Linked QTPP attribute(s) (multi-select dropdown) */}
                            <td style={{ verticalAlign: 'top', paddingTop: '0.8rem' }}>
                              <QTPPMultiSelectDropdown
                                selectedIds={row.linked_qtpp_ids || []}
                                qtppList={qtppList}
                                onChange={newIds => handleUpdateCqaField(row.id, 'linked_qtpp_ids', newIds)}
                              />
                            </td>

                            {/* Column 4: Description */}
                            <td style={{ verticalAlign: 'top', paddingTop: '0.8rem' }}>
                              <textarea
                                className="form-input"
                                rows={2}
                                style={{ padding: '0.35rem 0.55rem', fontSize: '0.8rem', resize: 'vertical' }}
                                value={row.description || ''}
                                onChange={e => handleUpdateCqaField(row.id, 'description', e.target.value)}
                                placeholder="Attribute description..."
                              />
                            </td>

                            {/* Column 5: Scientific justification */}
                            <td style={{ verticalAlign: 'top', paddingTop: '0.8rem' }}>
                              <textarea
                                className="form-input"
                                rows={2}
                                style={{ padding: '0.35rem 0.55rem', fontSize: '0.8rem', resize: 'vertical' }}
                                value={row.scientific_justification || ''}
                                onChange={e => handleUpdateCqaField(row.id, 'scientific_justification', e.target.value)}
                                placeholder="Scientific rationale on patient safety/efficacy..."
                              />
                            </td>

                            {/* Column 6: Severity of patient impact (1-5) */}
                            <td style={{ verticalAlign: 'top', paddingTop: '0.8rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                <select
                                  className="form-select"
                                  style={{ padding: '0.4rem 0.55rem', fontSize: '0.82rem', fontWeight: 600 }}
                                  value={row.severity_score}
                                  onChange={e => handleUpdateCqaField(row.id, 'severity_score', parseInt(e.target.value, 10))}
                                >
                                  {SEVERITY_LEVELS.map(lvl => (
                                    <option key={lvl.value} value={lvl.value}>
                                      {lvl.label}
                                    </option>
                                  ))}
                                </select>
                                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                  {SEVERITY_LEVELS.find(l => l.value === row.severity_score)?.desc}
                                </span>
                              </div>
                            </td>

                            {/* Column 7: Evidence / basis (multi-select dropdown) */}
                            <td style={{ verticalAlign: 'top', paddingTop: '0.8rem' }}>
                              <EvidenceBasisMultiSelectDropdown
                                selectedOptions={row.evidence_basis || []}
                                onChange={newOpts => handleUpdateCqaField(row.id, 'evidence_basis', newOpts)}
                              />
                            </td>

                            {/* Column 8: Criticality classification */}
                            <td style={{ verticalAlign: 'top', paddingTop: '0.8rem' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                <select
                                  className="form-select"
                                  style={{
                                    padding: '0.4rem 0.55rem',
                                    fontSize: '0.82rem',
                                    fontWeight: 700,
                                    borderColor: row.classification === 'CQA' ? '#dc2626' : row.classification === 'POTENTIAL_CQA' ? '#d97706' : '#94a3b8',
                                    color: row.classification === 'CQA' ? '#b91c1c' : row.classification === 'POTENTIAL_CQA' ? '#b45309' : '#475569'
                                  }}
                                  value={row.classification}
                                  onChange={e => handleUpdateCqaField(row.id, 'classification', e.target.value as CQAClassification)}
                                >
                                  <option value="CQA">CQA (Critical)</option>
                                  <option value="POTENTIAL_CQA">Potential CQA</option>
                                  <option value="NON_CQA">Non-CQA</option>
                                </select>

                                {/* Soft guidance hint */}
                                {hasHighSeverity && row.classification !== 'CQA' && (
                                  <span style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 600 }}>
                                    💡 High severity - review for CQA
                                  </span>
                                )}

                                {/* Classification helper text */}
                                <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                                  {row.classification === 'CQA' && 'Scientific assessment supports critical link to patient safety/efficacy.'}
                                  {row.classification === 'POTENTIAL_CQA' && 'Insufficient evidence to establish final criticality; experiments needed.'}
                                  {row.classification === 'NON_CQA' && 'Scientific justification supports non-critical classification for this product.'}
                                </span>

                                {/* Required Decision Justification for CQA or Non-CQA */}
                                {isClassificationFinal && (
                                  <div style={{ marginTop: '0.2rem' }}>
                                    <textarea
                                      className="form-input"
                                      rows={2}
                                      style={{
                                        padding: '0.3rem 0.5rem',
                                        fontSize: '0.78rem',
                                        resize: 'vertical',
                                        borderColor: decisionMissing ? '#ef4444' : undefined,
                                        background: decisionMissing ? '#fff5f5' : '#ffffff'
                                      }}
                                      placeholder="* Required decision justification..."
                                      value={row.decision_justification || ''}
                                      onChange={e => handleUpdateCqaField(row.id, 'decision_justification', e.target.value)}
                                    />
                                    {decisionMissing && (
                                      <span style={{ color: '#dc2626', fontSize: '0.68rem', fontWeight: 600 }}>
                                        Decision justification required.
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Toggle Secondary Risk Panel Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setExpandedRiskRowIds(prev =>
                                      prev.includes(row.id) ? prev.filter(id => id !== row.id) : [...prev, row.id]
                                    )
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    color: '#005baa',
                                    fontSize: '0.72rem',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem',
                                    marginTop: '0.2rem'
                                  }}
                                >
                                  {isRiskExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                  <span>Risk assessment (secondary)</span>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Secondary Risk Assessment Collapsible Row */}
                          {isRiskExpanded && (
                            <tr style={{ background: '#f8fafc' }}>
                              <td colSpan={isDeleteMode ? 9 : 8} style={{ padding: '0.75rem 1.25rem', borderBottom: '1.5px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <strong style={{ fontSize: '0.82rem', color: '#1e3a8a' }}>Secondary Risk Assessment (Informational)</strong>
                                    <span className="badge" style={{ fontSize: '0.68rem', background: '#e0e7ff', color: '#3730a3' }}>
                                      Does not determine CQA status
                                    </span>
                                  </div>
                                  <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                    RPN = Severity ({row.severity_score}) × Occurrence × Detectability
                                  </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '160px 160px 100px 1fr', gap: '1rem', alignItems: 'center' }}>
                                  <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                                      Occurrence (1-5):
                                    </label>
                                    <select
                                      className="form-select"
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                                      value={row.secondary_risk?.occurrence ?? ''}
                                      onChange={e => handleUpdateSecondaryRisk(row.id, 'occurrence', e.target.value ? parseInt(e.target.value, 10) : null)}
                                    >
                                      <option value="">Not evaluated</option>
                                      <option value="1">1 Rare</option>
                                      <option value="2">2 Low</option>
                                      <option value="3">3 Moderate</option>
                                      <option value="4">4 Frequent</option>
                                      <option value="5">5 Inevitable</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                                      Detectability (1-5):
                                    </label>
                                    <select
                                      className="form-select"
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                                      value={row.secondary_risk?.detectability ?? ''}
                                      onChange={e => handleUpdateSecondaryRisk(row.id, 'detectability', e.target.value ? parseInt(e.target.value, 10) : null)}
                                    >
                                      <option value="">Not evaluated</option>
                                      <option value="1">1 Verified online</option>
                                      <option value="2">2 Standard QC test</option>
                                      <option value="3">3 Moderate detect</option>
                                      <option value="4">4 Difficult</option>
                                      <option value="5">5 Undetectable</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                                      Informational RPN:
                                    </label>
                                    <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e3a8a' }}>
                                      {row.secondary_risk?.occurrence && row.secondary_risk?.detectability
                                        ? row.severity_score * row.secondary_risk.occurrence * row.secondary_risk.detectability
                                        : '—'}
                                    </span>
                                  </div>

                                  <div>
                                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>
                                      Secondary Assessment Notes:
                                    </label>
                                    <input
                                      type="text"
                                      className="form-input"
                                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.78rem' }}
                                      placeholder="Optional notes on detectability / occurrence..."
                                      value={row.secondary_risk?.notes || ''}
                                      onChange={e => handleUpdateSecondaryRisk(row.id, 'notes', e.target.value)}
                                    />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Step 1 Navigation Action Bar */}
          <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsProjectSetupModalOpen(true)}
            >
              ← Review Project Setup & QTPP
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (cqaAttributes.length === 0) {
                  toast.error('Please define at least one CQA attribute before proceeding.')
                  return
                }
                // Check if any CQA or NON_CQA attribute is missing decision justification
                const missingJust = cqaAttributes.find(c =>
                  (c.classification === 'CQA' || c.classification === 'NON_CQA') &&
                  (!c.decision_justification || !c.decision_justification.trim())
                )
                if (missingJust) {
                  toast.error(`Decision justification is required for "${missingJust.attribute_name}" (${missingJust.classification}).`)
                  return
                }

                // Auto-unlock upcoming steps if data is filled: sync step status with backend
                if (currentProject?.id) {
                  WorkflowApi.complete(currentProject.id, 'cqa-risk', {
                    cqas_data: cqaItems,
                    risk_assessment_data: localRisk
                  }).then(resp => {
                    if (resp?.step_statuses) {
                      setStepStatuses(resp.step_statuses)
                    }
                  }).catch(() => {})
                }

                setWizardStep(2)
                window.scrollTo({ top: 0, behavior: 'smooth' })
              }}
              style={{ minWidth: '220px', fontWeight: 600 }}
            >
              Save & Continue to Risk Matrix →
            </button>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════
          PARAMETER RISK MATRIX (STEP 2)
          ════════════════════════════════════════════════════════════ */}
      {wizardStep === 2 && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Process Parameter Risk Matrix
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
              ⚠️ No CQAs assessed. Please assess at least one CQA in Step 1 (Derive CQAs).
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

      {/* Step 2 Action Bar */}
      <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setWizardStep(1)
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        >
          ← Back to Derive CQAs
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
            'Confirm & Continue to Experiment Setup →'
          )}
        </button>
      </div>
    </>
  )}



      {/* AI Suggestions Review Drawer */}
      {aiSuggestionsDrawerOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '540px',
          background: '#ffffff',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={16} style={{ color: '#7c3aed' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#1e293b' }}>
                  AI-Suggested CQAs from QTPP
                </h3>
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                Proposed from QTPP quality targets. Scientist review is required before approval.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAiSuggestionsDrawerOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}
            >
              ✕
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {aiSuggestions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#64748b' }}>
                <p>No remaining AI suggestions.</p>
              </div>
            ) : (
              aiSuggestions.map(sugg => (
                <div
                  key={sugg.temp_id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderLeft: '4px solid #7c3aed',
                    borderRadius: '8px',
                    padding: '1rem',
                    background: '#ffffff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: '0.92rem', color: '#1e293b' }}>{sugg.attribute_name}</strong>
                    <span className="badge" style={{ fontSize: '0.7rem', background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
                      Suggested Severity: {sugg.suggested_severity}/5
                    </span>
                  </div>

                  <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                    {sugg.description}
                  </div>

                  <div style={{ fontSize: '0.74rem', background: '#f8fafc', padding: '0.5rem', borderRadius: '6px' }}>
                    <div style={{ marginBottom: '0.25rem' }}>
                      <strong>Linked QTPP:</strong> {sugg.linked_qtpp_names?.join(', ')} ({sugg.linked_qtpp_targets?.join(', ')})
                    </div>
                    <div>
                      <strong>Scientific Rationale:</strong> {sugg.scientific_justification}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setAiSuggestions(prev => prev.filter(s => s.temp_id !== sugg.temp_id))}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleAcceptAiSuggestion(sugg)}
                      style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem', background: '#7c3aed', borderColor: '#6d28d9' }}
                    >
                      Accept as Potential CQA
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setAiSuggestionsDrawerOpen(false)}
            >
              Close Drawer
            </button>
          </div>
        </div>
      )}



      {/* Review Project Setup & QTPP Modal */}
      {isProjectSetupModalOpen && (
        <CreateProject
          isModal={true}
          onClose={() => setIsProjectSetupModalOpen(false)}
          onProjectCreated={() => {
            setIsProjectSetupModalOpen(false)
          }}
        />
      )}
    </div>
  )
}
