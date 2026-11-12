import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore, StageItem } from '../../store/useStore'
import { Projects, RouteApi } from '../../services/api'
import { isDefaultDummyStages, parseStagesFromDescription } from '../../utils/routeGenerator'
import toast from 'react-hot-toast'

const UNIT_OP_OPTIONS = [
  'Reaction',
  'Workup',
  'Crystallization',
  'Filtration',
  'Drying',
  'Distillation',
  'Purification',
  'Milling',
  'Blending',
  'Other'
]

interface RouteWarning {
  type: string
  stage_id?: string
  stage_name?: string
  cqa_id?: string
  message: string
}

export default function RouteMapping() {
  const { currentProject, cqas, stages, setStages, setStep, addAuditLog } = useStore()

  // Initialize stages with prioritized auto-fill from description & CQAs
  const getInitialStages = (): StageItem[] => {
    // 1. Check for real user-saved stages (must have at least one non-blank name)
    const projStages = currentProject?.stages_data
    if (
      Array.isArray(projStages) &&
      projStages.length > 0 &&
      projStages.some(s => s.name && s.name.trim() !== '') &&
      !isDefaultDummyStages(projStages, currentProject)
    ) {
      return projStages
    }

    // 2. Check global store for valid named stages from current session
    if (
      Array.isArray(stages) &&
      stages.length > 0 &&
      stages.some(s => s.name && s.name.trim() !== '') &&
      !isDefaultDummyStages(stages, currentProject)
    ) {
      return stages
    }

    // 3. AUTO-FILL PRIORITY 1: Parse Chemist's Step 01 Description
    if (currentProject?.description) {
      const fromDesc = parseStagesFromDescription(currentProject.description, currentProject.compound || '')
      if (fromDesc && fromDesc.length > 0) {
        return fromDesc
      }
    }

    // 4. AUTO-FILL PRIORITY 2: Check Step 03 Intermediate CQAs
    if (cqas && cqas.length > 0) {
      const cqaStages = Array.from(new Set(
        cqas
          .filter(c => c.stageName && c.stageName.trim() !== '')
          .map(c => c.stageName!.trim())
      ))
      if (cqaStages.length > 0) {
        return cqaStages.map((stName, idx) => ({
          id: `stage-${idx + 1}`,
          order: idx + 1,
          name: stName.toLowerCase().startsWith('stage') || stName.toLowerCase().startsWith('unit op') ? stName : `Stage ${idx + 1}: ${stName}`,
          unitOpType: (stName.toLowerCase().includes('workup') ? 'Workup' :
                       stName.toLowerCase().includes('crystalliz') ? 'Crystallization' :
                       stName.toLowerCase().includes('distill') || stName.toLowerCase().includes('purif') ? 'Purification' : 'Reaction') as any,
          description: `Derived from Step 03 CQA stage mapping for ${stName}`,
          intermediateProduced: `${currentProject?.compound || 'API'} Stage ${idx + 1} Intermediate`,
          source: 'from_cqa',
          confidence: 'medium'
        }))
      }
    }

    return []
  }

  const [items, setItems] = useState<StageItem[]>(getInitialStages)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<RouteWarning[]>([])
  const [warningsOpen, setWarningsOpen] = useState(true)
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({})
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)

  const isFirstMount = useRef(true)

  // Synchronize when project or description changes
  useEffect(() => {
    setItems(getInitialStages())
  }, [currentProject?.id, currentProject?.description])

  // Periodic route validation checks
  const runValidation = useCallback((currentStages: StageItem[]) => {
    if (!currentProject?.id || currentStages.length === 0) {
      setWarnings([])
      return
    }
    RouteApi.validate(currentProject.id)
      .then((res: RouteWarning[]) => {
        if (Array.isArray(res)) setWarnings(res)
      })
      .catch(() => {})
  }, [currentProject?.id])

  // Synchronize to store and auto-save (debounced)
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    setStages(items)

    if (!currentProject?.id || items.length === 0) return
    const valid = items.filter(s => s.name.trim() !== '')
    if (valid.length === 0) return

    const timer = setTimeout(() => {
      RouteApi.save(currentProject.id, valid)
        .then(() => runValidation(valid))
        .catch(() => {
          Projects.savePhase0(currentProject.id, { stages: valid }).catch(() => {})
        })
    }, 800)

    return () => clearTimeout(timer)
  }, [items, currentProject?.id, setStages, runValidation])

  // Full Route Generation
  const handleGenerateRoute = async () => {
    if (!currentProject?.id) return
    setGenerating(true)
    setGenerationError(null)
    setConfirmModalOpen(false)
    try {
      const res = await RouteApi.generate(currentProject.id)
      if (res && res.stages && Array.isArray(res.stages)) {
        const mappedStages: StageItem[] = res.stages.map((s: any) => ({
          ...s,
          unitOpType: s.unit_operation_type || s.unitOpType || 'Reaction',
          description: s.chemistry_description || s.description || '',
          intermediateProduced: s.key_intermediate || s.intermediateProduced || '',
          source: s.source || 'ai_inferred',
          confidence: s.confidence || 'medium'
        }))
        setItems(mappedStages)
        setStages(mappedStages)
        addAuditLog('ROUTE_GENERATE', `Generated structured ${mappedStages.length}-stage route with grounded QbD parameters`)
        toast.success(`Generated ${mappedStages.length} grounded synthesis stages!`)
        runValidation(mappedStages)
      }
    } catch (e: any) {
      console.error('Route generation failed:', e)
      setGenerationError(e.response?.data?.detail || e.message || 'Route generation failed. Please retry.')
      toast.error('Failed to generate route from project knowledge.')
    } finally {
      setGenerating(false)
    }
  }

  // Single Stage In-Place Regeneration
  const handleRegenerateSingleStage = async (stageId: string) => {
    if (!currentProject?.id) return
    setRegeneratingId(stageId)
    try {
      const updated: any = await RouteApi.regenerateStage(currentProject.id, stageId)
      if (updated) {
        setItems(prev => prev.map(s => {
          if (s.id === stageId) {
            return {
              ...s,
              ...updated,
              unitOpType: updated.unit_operation_type || updated.unitOpType || s.unitOpType,
              description: updated.chemistry_description || updated.description || s.description,
              intermediateProduced: updated.key_intermediate || updated.intermediateProduced || s.intermediateProduced,
              source: updated.source || 'ai_inferred',
              confidence: updated.confidence || 'medium'
            }
          }
          return s
        }))
        toast.success(`Regenerated Stage ${updated.order || ''}!`)
        runValidation(items)
      }
    } catch (e: any) {
      console.error('Failed to regenerate stage:', e)
      toast.error('Failed to regenerate this stage.')
    } finally {
      setRegeneratingId(null)
    }
  }

  const handleAddStage = () => {
    const newStage: StageItem = {
      id: `stage-${Date.now()}`,
      order: items.length + 1,
      name: '',
      unitOpType: 'Reaction',
      description: '',
      intermediateProduced: '',
      inputs: [],
      outputs: [],
      candidate_cpps: [],
      linked_cqas: [],
      source: 'user_edited',
      confidence: 'medium'
    }
    setItems(prev => [...prev, newStage])
  }

  const handleRemoveStage = (id: string) => {
    const filtered = items.filter(s => s.id !== id)
    setItems(filtered.map((s, idx) => ({ ...s, order: idx + 1 })))
  }

  const handleChange = (id: string, field: keyof StageItem, value: any) => {
    setItems(items.map(s => {
      if (s.id === id) {
        return {
          ...s,
          [field]: value,
          source: 'user_edited' // Mark field changes as user edited
        }
      }
      return s
    }))
  }

  const toggleDetails = (stageId: string) => {
    setExpandedDetails(prev => ({ ...prev, [stageId]: !prev[stageId] }))
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= items.length) return
    const updated = [...items]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setItems(updated.map((s, idx) => ({ ...s, order: idx + 1, source: 'user_edited' })))
  }

  const handleBack = () => {
    setStages(items)
    const valid = items.filter(s => s.name.trim() !== '')
    if (valid.length > 0 && currentProject?.id) {
      RouteApi.save(currentProject.id, valid).catch(() => {})
    }
    setStep('cqa')
  }

  const handleSaveAndNext = async () => {
    const valid = items.filter(s => s.name.trim() !== '')
    if (valid.length === 0) {
      toast.error('Please add and name at least one synthesis stage before proceeding.')
      return
    }
    setSaving(true)
    setStages(valid)
    if (currentProject) {
      try {
        await RouteApi.save(currentProject.id, valid)
        addAuditLog('ROUTE_MAPPING_SAVE', `Saved synthetic route map with ${valid.length} stage(s)`)
        toast.success(`Synthetic route saved with ${valid.length} stage(s)`)
      } catch (e) {
        console.error('Failed to save stages to backend', e)
        toast.error('Saved locally. Backend synchronization will retry.')
      }
    }
    setSaving(false)
    setStep('risk-assessment')
  }

  const renderConfidenceDot = (conf?: string) => {
    const color = conf === 'high' ? '#10b981' : conf === 'low' ? '#f59e0b' : '#3b82f6'
    const title = conf === 'high' ? 'High Confidence (Grounded in documents/context)' : conf === 'low' ? 'Low Confidence (Please verify)' : 'Medium Confidence'
    return (
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: color,
          display: 'inline-block',
          marginRight: '6px'
        }}
        title={title}
      />
    )
  }

  const renderSourceBadge = (source?: string) => {
    let label = 'AI Inferred'
    let bg = 'rgba(100, 116, 139, 0.12)'
    let color = '#475569'

    if (source === 'from_document') {
      label = '📄 Document Grounded'
      bg = 'rgba(16, 185, 129, 0.12)'
      color = '#047857'
    } else if (source === 'from_description') {
      label = '✍️ From Description'
      bg = 'rgba(59, 130, 246, 0.12)'
      color = '#1d4ed8'
    } else if (source === 'from_cqa') {
      label = '🎯 From CQA'
      bg = 'rgba(139, 92, 246, 0.12)'
      color = '#6d28d9'
    } else if (source === 'user_edited') {
      label = '✏️ User Edited'
      bg = 'rgba(245, 158, 11, 0.12)'
      color = '#b45309'
    }

    return (
      <span
        style={{
          fontSize: '0.68rem',
          fontWeight: 600,
          padding: '0.15rem 0.5rem',
          borderRadius: '999px',
          background: bg,
          color: color,
          letterSpacing: '0.02em'
        }}
      >
        {label}
      </span>
    )
  }

  return (
    <div className="screen-container">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', margin: 0 }}>04. Route Mapping & Unit Operations</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
              Define the sequence of synthesis stages and unit operations for{' '}
              <strong style={{ color: 'var(--primary)' }}>
                {currentProject?.compound ? `${currentProject.compound} (${currentProject.name})` : (currentProject?.name || 'your project')}
              </strong>.
            </p>
          </div>
          <span className="badge badge-accent" style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>
            ICH Q8(R2) · Q11 Synthesis Route
          </span>
        </div>
      </div>

      {/* Generation Error Banner with Retry */}
      {generationError && (
        <div
          style={{
            padding: '0.85rem 1.15rem',
            marginBottom: '1rem',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ fontSize: '0.82rem', color: '#b91c1c' }}>
            <strong>Error:</strong> {generationError}
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleGenerateRoute}
            style={{ fontSize: '0.76rem', padding: '0.2rem 0.65rem' }}
          >
            Retry Generation
          </button>
        </div>
      )}

      {/* Route Backbone Card */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Synthetic Route Backbone</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0.2rem 0 0' }}>
              {items.length} {items.length === 1 ? 'stage' : 'stages'} defined · Grounded in QbD RAG & Process Context
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (items.length > 0) {
                  setConfirmModalOpen(true)
                } else {
                  handleGenerateRoute()
                }
              }}
              disabled={generating}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <span>⚡</span> {items.length > 0 ? 'Re-generate Full Route' : 'Auto-Generate Route'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleAddStage} disabled={generating}>
              + Add Stage
            </button>
          </div>
        </div>

        {/* Loading Skeleton */}
        {generating && (
          <div style={{ padding: '2.5rem', textAlign: 'center', background: 'rgba(248, 250, 252, 0.8)', borderRadius: '10px', border: '1px dashed var(--border)' }}>
            <div className="spinner" style={{ width: '32px', height: '32px', margin: '0 auto 1rem', borderColor: 'var(--primary)', borderTopColor: 'transparent' }} />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 0.35rem' }}>Analyzing Synthetic Route with QbD Engine...</h4>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '440px', margin: '0 auto' }}>
              Retrieving process literature, analyzing Step 02 QTPP & Step 03 CQAs, and structuring candidate CPPs.
            </p>
          </div>
        )}

        {!generating && items.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '3.5rem 1.5rem',
            background: 'rgba(248, 250, 252, 0.8)',
            borderRadius: '12px',
            border: '2px dashed var(--border)',
            margin: '1rem 0'
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🧪</div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
              No Synthesis Stages Defined Yet
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 1.25rem' }}>
              Generate a structured synthesis route using QbD RAG knowledge or add stages manually.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleGenerateRoute}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1.1rem' }}
              >
                <span>⚡</span> Auto-Generate Route from QbD Knowledge
              </button>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={handleAddStage}
                style={{ padding: '0.5rem 1.1rem' }}
              >
                + Add First Stage Manually
              </button>
            </div>
          </div>
        )}

        {!generating && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {items.map((stage, idx) => {
              const isLowConfidence = stage.confidence === 'low'
              const isRegenerating = regeneratingId === stage.id
              const isExpanded = !!expandedDetails[stage.id]

              return (
                <div
                  key={stage.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '1.25rem',
                    background: 'var(--bg-surface)',
                    borderRadius: '10px',
                    border: isLowConfidence ? '1.5px solid #f59e0b' : '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Top Header Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: '0.95rem',
                          color: '#fff',
                          boxShadow: '0 2px 6px rgba(0, 91, 170, 0.2)'
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        {renderConfidenceDot(stage.confidence)}
                        {renderSourceBadge(stage.source)}
                        {isLowConfidence && (
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '0.15rem 0.45rem', borderRadius: '4px' }}>
                            Please verify
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRegenerateSingleStage(stage.id)}
                        disabled={isRegenerating}
                        title="Regenerate this single stage using neighbor context"
                        style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                      >
                        <span>🔄</span> {isRegenerating ? 'Regenerating...' : 'Regenerate Stage'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => toggleDetails(stage.id)}
                        style={{ fontSize: '0.74rem', padding: '0.2rem 0.55rem' }}
                      >
                        {isExpanded ? 'Hide Details ▲' : 'Details ▼'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm btn-secondary"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, 'up')}
                        title="Move Up"
                        style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm btn-secondary"
                        disabled={idx === items.length - 1}
                        onClick={() => handleMove(idx, 'down')}
                        title="Move Down"
                        style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className="btn btn-icon btn-sm btn-danger"
                        onClick={() => handleRemoveStage(stage.id)}
                        title="Delete Stage"
                        style={{ padding: '0.2rem 0.45rem', fontSize: '0.72rem' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Main Input Form Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '1rem', marginBottom: '0.85rem' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        Stage / Unit Operation Name
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Stage 1: Alkylation Reaction"
                        value={stage.name}
                        onChange={e => handleChange(stage.id, 'name', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        Unit Operation Type
                      </label>
                      <select
                        className="form-select"
                        value={stage.unitOpType || 'Reaction'}
                        onChange={e => handleChange(stage.id, 'unitOpType', e.target.value)}
                      >
                        {UNIT_OP_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        Brief Chemistry / Engineering Description
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Catalytic alkylation over solid acid catalyst"
                        value={stage.description || stage.chemistry_description || ''}
                        onChange={e => handleChange(stage.id, 'description', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                        Key Intermediate / Material Produced
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Crude Reaction Mass"
                        value={stage.intermediateProduced || stage.key_intermediate || ''}
                        onChange={e => handleChange(stage.id, 'intermediateProduced', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Expandable Details Section */}
                  {isExpanded && (
                    <div style={{ marginTop: '0.9rem', paddingTop: '0.85rem', borderTop: '1px dashed var(--border)', background: 'rgba(241, 245, 249, 0.5)', padding: '0.85rem', borderRadius: '8px' }}>
                      {/* Candidate CPPs */}
                      <div style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                          Candidate Process Parameters (CPPs) for Step 05/06:
                        </div>
                        {stage.candidate_cpps && stage.candidate_cpps.length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0.5rem' }}>
                            {stage.candidate_cpps.map((cpp, cIdx) => (
                              <div key={cIdx} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.45rem 0.65rem', fontSize: '0.74rem' }}>
                                <div style={{ fontWeight: 600, color: 'var(--primary)' }}>
                                  {cpp.name} {cpp.unit ? `(${cpp.unit})` : ''}
                                </div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                                  Range: {cpp.low != null ? cpp.low : '—'} to {cpp.high != null ? cpp.high : '—'} {cpp.unit}
                                </div>
                                {cpp.rationale && (
                                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.68rem', marginTop: '2px', lineHeight: 1.25 }}>
                                    {cpp.rationale}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            No candidate CPPs defined yet. Will be inferred during Step 05 Risk Assessment.
                          </div>
                        )}
                      </div>

                      {/* Linked CQAs */}
                      <div style={{ marginBottom: '0.65rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                          Linked Quality Attributes (CQAs):
                        </div>
                        {stage.linked_cqas && stage.linked_cqas.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {stage.linked_cqas.map((cid, cIdx) => {
                              const matchCqa = cqas.find(c => c.id === cid)
                              return (
                                <span key={cIdx} className="badge badge-primary" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
                                  {matchCqa?.name || cid}
                                </span>
                              )
                            })}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            No explicit CQA links assigned.
                          </div>
                        )}
                      </div>

                      {/* Source References */}
                      {stage.source_refs && stage.source_refs.length > 0 && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          <strong>Source References:</strong> {stage.source_refs.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Collapsible Route Validation Checks Panel */}
      {items.length > 0 && (
        <div
          style={{
            marginBottom: '1.25rem',
            background: warnings.length > 0 ? 'rgba(245, 158, 11, 0.06)' : 'rgba(16, 185, 129, 0.06)',
            border: `1px solid ${warnings.length > 0 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
            borderRadius: '10px',
            overflow: 'hidden'
          }}
        >
          <div
            onClick={() => setWarningsOpen(!warningsOpen)}
            style={{
              padding: '0.75rem 1.1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: warnings.length > 0 ? '#b45309' : '#047857' }}>
              <span>{warnings.length > 0 ? '⚠️' : '✓'}</span>
              <span>Route Quality & Continuity Checks ({warnings.length} {warnings.length === 1 ? 'warning' : 'warnings'})</span>
            </div>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {warningsOpen ? 'Collapse ▲' : 'Expand ▼'}
            </span>
          </div>

          {warningsOpen && (
            <div style={{ padding: '0 1.1rem 0.85rem', fontSize: '0.8rem', color: '#78350f' }}>
              {warnings.length === 0 ? (
                <div style={{ color: '#047857', fontSize: '0.8rem' }}>
                  ✓ All synthesis streams demonstrate continuity and all CQAs are mapped to at least one unit operation.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {warnings.map((w, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.45rem' }}>
                      <span style={{ fontWeight: 700 }}>•</span>
                      <span>{w.message}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', fontStyle: 'italic' }}>
                    Note: Validation warnings are advisory QbD checks and do not block confirming this step.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="btn btn-secondary" onClick={handleBack}>
          ← Back to CQA Derivation
        </button>
        <button className="btn btn-primary" onClick={handleSaveAndNext} disabled={saving || items.length === 0}>
          {saving ? <><div className="spinner" /> Saving…</> : 'Confirm & Proceed to Reverse Risk Assessment →'}
        </button>
      </div>

      {/* Full Route Overwrite Confirmation Modal */}
      {confirmModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setConfirmModalOpen(false)}
        >
          <div
            style={{
              width: '460px',
              maxWidth: '92vw',
              background: 'white',
              borderRadius: '12px',
              padding: '1.5rem',
              boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Re-generate Full Route?
              </h3>
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '1.25rem' }}>
              Re-generating the full synthetic route will re-query the QbD RAG knowledge base and overwrite your existing {items.length} stage(s) and any custom edits.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConfirmModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleGenerateRoute}
              >
                Confirm & Re-generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
