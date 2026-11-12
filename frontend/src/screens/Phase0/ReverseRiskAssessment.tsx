import { useState, useMemo, useEffect, useRef } from 'react'
import { useStore, RiskParameter } from '../../store/useStore'
import { Projects } from '../../services/api'
import { generateContextAwareRiskParameters, isDummyRiskParams, generateContextAwareCQAs } from '../../utils/routeGenerator'
import { RPN_DIMENSIONS, RPN_GUIDE_CONTENT } from '../../utils/rpnExplanationData'
import { Info, X, SlidersHorizontal } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ReverseRiskAssessment() {
  const {
    currentProject, stages, cqas, setCqas, riskAssessments,
    rpnThreshold, setRpnThreshold, setRiskAssessments, setStep, addAuditLog
  } = useStore()

  // Relevant CQAs for current stage (use project CQAs if defined, else fallback to suggested CQAs for compound)
  const relevantCQAs = useMemo(() => {
    if (cqas && cqas.length > 0) return cqas
    return generateContextAwareCQAs(currentProject, [])
  }, [cqas, currentProject])

  // Stage order index: 0 -> stages.length - 1
  const [currentStageIndex, setCurrentStageIndex] = useState(0)

  // Clamp index safely in case stages were deleted
  const safeStageIndex = stages.length > 0 ? Math.min(currentStageIndex, stages.length - 1) : 0
  const currentStage = stages[safeStageIndex] || { id: 'stage-1', name: 'Stage 1', unitOpType: 'Reaction' }

  // Initial risk assessment dictionary with context-aware parameter generation
  const [localRisk, setLocalRisk] = useState<Record<string, { parameters: RiskParameter[] }>>(() => {
    const defaultDict: Record<string, { parameters: RiskParameter[] }> = { ...riskAssessments }
    stages.forEach((st, idx) => {
      const existing = defaultDict[st.id]?.parameters
      if (!existing || existing.length === 0 || isDummyRiskParams(existing, currentProject)) {
        defaultDict[st.id] = {
          parameters: generateContextAwareRiskParameters(st, idx, currentProject, relevantCQAs)
        }
      }
    })
    return defaultDict
  })
  const isFirstMount = useRef(true)
  const cutoffInputRef = useRef<HTMLInputElement | null>(null)
  const [showRpnGuide, setShowRpnGuide] = useState(false)
  const rpnGuideModalRef = useRef<HTMLDivElement | null>(null)
  const rpnGuideBtnRef = useRef<HTMLButtonElement | null>(null)

  // Close RPN guide modal on outside click or Escape
  useEffect(() => {
    if (!showRpnGuide) return
    function handleClickOutside(e: MouseEvent) {
      if (rpnGuideModalRef.current && !rpnGuideModalRef.current.contains(e.target as Node)) {
        if (rpnGuideBtnRef.current && rpnGuideBtnRef.current.contains(e.target as Node)) return
        setShowRpnGuide(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowRpnGuide(false)
        rpnGuideBtnRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showRpnGuide])

  // Synchronize when stages or project changes
  useEffect(() => {
    setLocalRisk(prev => {
      const next = { ...prev }
      let updated = false
      stages.forEach((st, idx) => {
        const existing = next[st.id]?.parameters
        if (!existing || existing.length === 0 || isDummyRiskParams(existing, currentProject)) {
          next[st.id] = {
            parameters: generateContextAwareRiskParameters(st, idx, currentProject, relevantCQAs)
          }
          updated = true
        }
      })
      return updated ? next : prev
    })
  }, [stages, currentProject?.id, relevantCQAs])

  // Synchronize to store and auto-save so navigating away never loses data
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }
    setRiskAssessments(localRisk)

    if (!currentProject?.id || Object.keys(localRisk).length === 0) return

    const timer = setTimeout(() => {
      Projects.savePhase0(currentProject.id, { riskAssessments: localRisk }).catch(() => {})
    }, 1000)

    return () => clearTimeout(timer)
  }, [localRisk, currentProject?.id, setRiskAssessments])

  // Save to backend on unmount
  useEffect(() => {
    return () => {
      if (currentProject?.id && Object.keys(localRisk).length > 0) {
        Projects.savePhase0(currentProject.id, { riskAssessments: localRisk }).catch(() => {})
      }
    }
  }, [localRisk, currentProject?.id])

  // Get current stage parameters
  const rawParams = localRisk[currentStage?.id]?.parameters
  const currentParams = useMemo(() => {
    if (rawParams && rawParams.length > 0 && !isDummyRiskParams(rawParams, currentProject)) {
      return rawParams
    }
    return generateContextAwareRiskParameters(currentStage, safeStageIndex, currentProject, relevantCQAs)
  }, [rawParams, currentStage, safeStageIndex, currentProject, relevantCQAs])

  // Handle adding custom parameter
  const handleAddParam = () => {
    if (!currentStage) return
    const newParam: RiskParameter = {
      id: `param-${Date.now()}`,
      name: '',
      type: 'CPP-candidate',
      linkedCqaIds: relevantCQAs.length > 0 ? [relevantCQAs[0].id] : [],
      severity: 3,
      occurrence: 3,
      detectability: 3,
      rpn: 27,
      rationale: '',
      criticalFlag: 27 > rpnThreshold,
      overrideReason: ''
    }
    const updatedParams = [...currentParams, newParam]
    setLocalRisk({
      ...localRisk,
      [currentStage.id]: { parameters: updatedParams }
    })
  }


  // Handle parameter field updates
  const handleParamChange = (paramId: string, field: keyof RiskParameter, value: any) => {
    const updated = currentParams.map(p => {
      if (p.id === paramId) {
        const nextP = { ...p, [field]: value }
        if (['severity', 'occurrence', 'detectability'].includes(field)) {
          nextP.rpn = nextP.severity * nextP.occurrence * nextP.detectability
          nextP.criticalFlag = nextP.rpn > rpnThreshold
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

  // Delete parameter
  const handleRemoveParam = (paramId: string) => {
    const updated = currentParams.filter(p => p.id !== paramId)
    setLocalRisk({
      ...localRisk,
      [currentStage.id]: { parameters: updated }
    })
  }

  // Sorted parameters by RPN descending
  const sortedParams = useMemo(() => {
    return [...currentParams].sort((a, b) => b.rpn - a.rpn)
  }, [currentParams])

  // Navigation between stages
  const handleBack = () => {
    setRiskAssessments(localRisk)
    if (currentProject && Object.keys(localRisk).length > 0) {
      Projects.savePhase0(currentProject.id, { riskAssessments: localRisk }).catch(() => {})
    }
    if (safeStageIndex > 0) setCurrentStageIndex(safeStageIndex - 1)
    else setStep('route-mapping')
  }

  const handleConfirmAndNextStage = async () => {
    const updatedDict = {
      ...localRisk,
      [currentStage.id]: { parameters: currentParams }
    }
    setRiskAssessments(updatedDict)
    if (currentProject) {
      try {
        await Projects.savePhase0(currentProject.id, { riskAssessments: updatedDict })
        addAuditLog('RISK_ASSESSMENT_STAGE', `Completed risk assessment for ${currentStage.name}`)
      } catch (e) {
        console.error('Failed to save risk assessment', e)
      }
    }

    if (safeStageIndex < stages.length - 1) {
      setCurrentStageIndex(safeStageIndex + 1)
    } else {
      setStep('stage-campaign-matrix')
    }
  }

  if (stages.length === 0) {
    return (
      <div className="screen-container">
        <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', marginTop: '2rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚠️</div>
          <h2 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem' }}>No Synthesis Stages Defined</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '440px', margin: '0 auto 1.5rem' }}>
            Please return to Step 04 (Route Mapping) to map your synthesis stages before running the Reverse Risk Assessment.
          </p>
          <button className="btn btn-primary" onClick={() => setStep('route-mapping')}>
            ← Back to Route Mapping
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen-container">
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Reverse Risk Assessment</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Identify Critical Process Parameters (CPPs) and Material Attributes (CMAs) impacting CQAs in{' '}
          <strong style={{ color: 'var(--primary-light)' }}>{currentStage.name}</strong>.
        </p>
      </div>

      {/* Progress & Cutoff Header Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
            Risk Walk Navigation
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-light)', marginTop: '2px' }}>
            Assessing Stage {safeStageIndex + 1} of {stages.length}: <span style={{ color: '#fff' }}>{currentStage.name}</span>
            <span className="badge badge-secondary" style={{ marginLeft: '8px', fontSize: '0.75rem' }}>
              {currentStage.unitOpType}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
          {/* RPN Threshold Settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>RPN Critical Cutoff:</label>
            <input
              ref={cutoffInputRef}
              type="number"
              className="input input-sm"
              style={{ width: '65px', textAlign: 'center' }}
              value={rpnThreshold}
              onChange={e => setRpnThreshold(parseInt(e.target.value) || 20)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {stages.map((st, idx) => {
              let label = st.name.includes(':') ? st.name.split(':')[0].trim() : `Stage ${idx + 1}`
              if (label === 'Stage-I' || label === 'Stage I') label = `Stage ${idx + 1}`
              return (
                <button
                  key={st.id}
                  className={`btn btn-xs ${idx === safeStageIndex ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setCurrentStageIndex(idx)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Relevant CQAs banner */}
      <div className="card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
            Target Quality Attributes (CQAs) for {currentStage.name}:
          </div>
          {cqas.length === 0 && relevantCQAs.length > 0 && (
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: 600 }}>Suggested for {currentProject?.compound || 'API'}</span>
              <button
                className="btn btn-secondary btn-xs"
                style={{ fontSize: '0.7rem' }}
                onClick={() => setStep('cqa')}
              >
                Edit in Step 03
              </button>
              <button
                className="btn btn-primary btn-xs"
                style={{ fontSize: '0.7rem' }}
                onClick={() => {
                  setCqas(relevantCQAs)
                  if (currentProject) {
                    Projects.savePhase0(currentProject.id, { cqas: relevantCQAs })
                  }
                  toast.success(`Saved ${relevantCQAs.length} CQAs to project`)
                }}
              >
                💾 Confirm & Save CQAs
              </button>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {relevantCQAs.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No CQAs linked yet. CQAs derived in Step 03 will appear here.</span>
              <button className="btn btn-secondary btn-xs" onClick={() => setStep('cqa')}>← Go to Step 03</button>
            </div>
          ) : (
            relevantCQAs.map(c => (
              <span key={c.id} className="badge badge-secondary" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
                • {c.name} {c.range ? `(${c.range})` : ''}
              </span>
            ))
          )}
        </div>
      </div>

      {/* Fishbone / FMEA Table */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>
              Process Parameter Risk Matrix (Auto-Sorted by RPN)
            </h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '2px' }}>
              <span>RPN = Severity (1-5) × Occurrence (1-5) × Detectability (1-5) · Cutoff: {rpnThreshold}</span>
              <button
                ref={rpnGuideBtnRef}
                type="button"
                aria-label="About RPN and criticality"
                aria-expanded={showRpnGuide}
                aria-controls="rpn-criticality-dialog"
                onClick={() => setShowRpnGuide(true)}
                style={{
                  background: 'rgba(0, 91, 170, 0.08)',
                  border: '1px solid rgba(0, 91, 170, 0.25)',
                  color: 'var(--primary)',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 91, 170, 0.16)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0, 91, 170, 0.08)')}
                title="How RPN decides criticality"
              >
                <Info size={12} />
              </button>
            </div>
          </div>
          <div>
            <button className="btn btn-secondary btn-sm" onClick={handleAddParam}>
              + Add Parameter
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Process Parameter</th>
                <th style={{ width: '12%' }}>Parameter Type</th>
                <th style={{ width: '16%' }}>Linked CQA(s)</th>
                <th style={{ width: '6%', textAlign: 'center' }}>S</th>
                <th style={{ width: '6%', textAlign: 'center' }}>O</th>
                <th style={{ width: '6%', textAlign: 'center' }}>D</th>
                <th style={{ width: '8%', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                    <span>RPN</span>
                    <button
                      type="button"
                      aria-label="About RPN formula"
                      onClick={() => setShowRpnGuide(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'inline-flex'
                      }}
                      title="Click for RPN breakdown"
                    >
                      <Info size={11} />
                    </button>
                  </div>
                </th>
                <th style={{ width: '10%', textAlign: 'center' }}>Status Badge</th>
                <th style={{ width: '17%' }}>Rationale / Failure Mode</th>
                <th style={{ width: '4%', textAlign: 'center' }}>Del</th>
              </tr>
            </thead>
            <tbody>
              {sortedParams.map(p => {
                const isOverThreshold = p.rpn > rpnThreshold
                return (
                  <tr key={p.id} style={{ background: p.criticalFlag ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                    <td>
                      <input
                        type="text"
                        className="input input-sm"
                        placeholder="e.g. Reaction Temperature (°C)"
                        value={p.name}
                        onChange={e => handleParamChange(p.id, 'name', e.target.value)}
                      />
                    </td>
                    <td>
                      <select
                        className="input input-sm"
                        value={p.type}
                        onChange={e => handleParamChange(p.id, 'type', e.target.value as any)}
                      >
                        <option value="CPP-candidate">CPP-candidate</option>
                        <option value="CMA-candidate">CMA-candidate</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                        {relevantCQAs.map(c => {
                          const isSelected = (p.linkedCqaIds || []).includes(c.id)
                          return (
                            <span
                              key={c.id}
                              style={{
                                cursor: 'pointer',
                                padding: '2px 5px',
                                borderRadius: '4px',
                                fontSize: '0.68rem',
                                background: isSelected ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
                                color: isSelected ? '#fff' : 'var(--text-muted)'
                              }}
                              onClick={() => {
                                const current = p.linkedCqaIds || []
                                const updated = current.includes(c.id) ? current.filter(id => id !== c.id) : [...current, c.id]
                                handleParamChange(p.id, 'linkedCqaIds', updated)
                              }}
                            >
                              {c.name.split(' ')[0]}
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <select
                        className="input input-sm"
                        value={p.severity}
                        onChange={e => handleParamChange(p.id, 'severity', parseInt(e.target.value))}
                      >
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <select
                        className="input input-sm"
                        value={p.occurrence}
                        onChange={e => handleParamChange(p.id, 'occurrence', parseInt(e.target.value))}
                      >
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <select
                        className="input input-sm"
                        value={p.detectability}
                        onChange={e => handleParamChange(p.id, 'detectability', parseInt(e.target.value))}
                      >
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.9rem', color: isOverThreshold ? 'var(--danger-light)' : 'var(--success-light)' }}>
                      {p.rpn}
                    </td>
                    {/* Status Badge: Computed criticality indicator based on QbD risk thresholds (non-interactive) */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`badge ${p.criticalFlag ? 'badge-danger' : 'badge-secondary'}`}
                        style={{ userSelect: 'none', display: 'inline-block' }}
                      >
                        {p.criticalFlag ? 'CRITICAL' : 'Non-Critical'}
                      </span>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="input input-sm"
                        placeholder="Risk rationale or failure mode..."
                        value={p.rationale}
                        onChange={e => handleParamChange(p.id, 'rationale', e.target.value)}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-icon btn-xs btn-danger"
                        onClick={() => handleRemoveParam(p.id)}
                        title="Delete parameter"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          className="btn btn-secondary"
          onClick={handleBack}
        >
          ← {safeStageIndex > 0 ? `Back to Stage ${safeStageIndex}` : 'Back to Route Mapping'}
        </button>

        <button className="btn btn-primary" onClick={handleConfirmAndNextStage}>
          {safeStageIndex < stages.length - 1
            ? `Confirm & Move to ${(stages[safeStageIndex + 1]?.name || '').split(':')[0] || `Stage ${safeStageIndex + 2}`} →`
            : 'Confirm & View Stage Campaign Matrix →'}
        </button>
      </div>

      {/* RPN Criticality Explanation Modal Dialog */}
      {showRpnGuide && (
        <div
          id="rpn-criticality-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rpn-modal-title"
          onClick={() => setShowRpnGuide(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.25rem',
            animation: 'fadeIn 0.15s ease-out'
          }}
        >
          <div
            ref={rpnGuideModalRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '540px',
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 10px 25px -5px rgba(0, 91, 170, 0.2)',
              border: '1px solid var(--border)',
              overflow: 'hidden',
              animation: 'popoverFadeScale 150ms ease-out forwards'
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '1.1rem 1.4rem',
                background: 'linear-gradient(135deg, #003d73 0%, #005baa 65%, #00aeb3 100%)',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255, 255, 255, 0.15)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                  <span
                    style={{
                      background: 'rgba(255, 255, 255, 0.2)',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '10px',
                      letterSpacing: '0.04em',
                      textTransform: 'uppercase'
                    }}
                  >
                    ICH Q9 Risk Assessment
                  </span>
                  <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                    FMEA Failure Mode Tool
                  </span>
                </div>
                <h3 id="rpn-modal-title" style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  {RPN_GUIDE_CONTENT.title}
                </h3>
              </div>

              <button
                type="button"
                aria-label="Close"
                onClick={() => {
                  setShowRpnGuide(false)
                  rpnGuideBtnRef.current?.focus()
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 'none',
                  color: '#ffffff',
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', fontSize: '0.82rem', lineHeight: 1.5, maxHeight: '72vh', overflowY: 'auto' }}>
              {/* 1. What is RPN */}
              <div style={{ background: 'rgba(0, 91, 170, 0.04)', padding: '0.75rem 0.9rem', borderRadius: '10px', borderLeft: '4px solid var(--primary)' }}>
                <strong style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--primary)', marginBottom: '0.2rem' }}>
                  1. What is RPN?
                </strong>
                <span style={{ color: 'var(--text-primary)' }}>
                  {RPN_GUIDE_CONTENT.whatIsRpn}
                </span>
              </div>

              {/* 2. Formula & Visual Scale Bar */}
              <div>
                <strong style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                  2. Formula & Range
                </strong>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.45rem' }}>
                  {RPN_GUIDE_CONTENT.formula}
                </div>

                {/* Tiny visual bar (1 - 125) showing current live cutoff marker */}
                <div style={{ background: '#f1f5f9', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Min: 1</span>
                    <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Cutoff: {rpnThreshold}</span>
                    <span>Max: 125</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--border)', borderRadius: '999px', position: 'relative' }}>
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${Math.min(100, (rpnThreshold / 125) * 100)}%`,
                        background: '#10b981',
                        borderRadius: '999px 0 0 999px'
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        left: `${Math.min(100, (rpnThreshold / 125) * 100)}%`,
                        top: 0,
                        height: '100%',
                        right: 0,
                        background: '#ef4444',
                        borderRadius: '0 999px 999px 0'
                      }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        left: `calc(${Math.min(100, (rpnThreshold / 125) * 100)}% - 2px)`,
                        width: '4px',
                        height: '16px',
                        background: '#0f172a',
                        borderRadius: '2px'
                      }}
                      title={`Cutoff marker: ${rpnThreshold}`}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', marginTop: '4px' }}>
                    <span style={{ color: '#059669', fontWeight: 600 }}>← Low Risk (Non-Critical)</span>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>High Risk (CRITICAL) →</span>
                  </div>
                </div>
              </div>

              {/* 3. Three Scores Table */}
              <div>
                <strong style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                  3. The Three Factor Scores (1 to 5 Scale)
                </strong>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                      <th style={{ padding: '6px 8px', width: '28%' }}>Dimension</th>
                      <th style={{ padding: '6px 8px' }}>What it evaluates</th>
                      <th style={{ padding: '6px 8px', width: '28%' }}>1 to 5 Scale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RPN_DIMENSIONS.map((dim, idx) => (
                      <tr key={dim.code} style={{ borderBottom: idx < RPN_DIMENSIONS.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {dim.dimension}
                        </td>
                        <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>
                          {dim.description}
                        </td>
                        <td style={{ padding: '6px 8px' }}>
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                            {dim.levels.map(lvl => (
                              <span
                                key={lvl.score}
                                style={{
                                  background: `${lvl.color}18`,
                                  color: lvl.color,
                                  border: `1px solid ${lvl.color}40`,
                                  borderRadius: '4px',
                                  padding: '1px 4px',
                                  fontSize: '0.65rem',
                                  fontWeight: 700
                                }}
                              >
                                {lvl.score}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 4. Cutoff & Criticality Rule */}
              <div>
                <strong style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                  4. Cutoff & Status Rule
                </strong>
                <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.4rem' }}>
                  Parameters with RPN above the cutoff (currently <strong style={{ color: 'var(--primary)' }}>{rpnThreshold}</strong>) are automatically flagged <span className="badge badge-danger" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>CRITICAL</span>. Rows below the cutoff are typically <span className="badge badge-secondary" style={{ fontSize: '0.68rem', padding: '1px 5px' }}>Non-Critical</span>.
                </p>
                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.74rem', color: '#92400e' }}>
                  📌 <strong>Note on Preset Parameters:</strong> Pharmaceutical route templates pre-tag known high-severity CPPs (e.g. S=4 or 5) as <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>CRITICAL</span> even when their routine RPN is 24 or 32, ensuring safety-critical variables are never lost before DoE. You can click any badge to manually toggle its status.
                </div>
              </div>

              {/* 5. Worked Example */}
              <div>
                <strong style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                  5. Worked Example
                </strong>
                <div style={{ background: '#f8fafc', padding: '0.55rem 0.8rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.78rem' }}>
                  {sortedParams.length > 0 ? (
                    <div>
                      <strong>{sortedParams[0].name || 'Process Parameter'}:</strong> S={sortedParams[0].severity}, O={sortedParams[0].occurrence}, D={sortedParams[0].detectability} →{' '}
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                        RPN = {sortedParams[0].severity} × {sortedParams[0].occurrence} × {sortedParams[0].detectability} = {sortedParams[0].rpn}
                      </span>.
                    </div>
                  ) : (
                    <div>
                      <strong>Reaction Temperature:</strong> S=4, O=4, D=2 →{' '}
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                        RPN = 4 × 4 × 2 = 32
                      </span>.
                    </div>
                  )}
                </div>
              </div>

              {/* 6. Good to know */}
              <div>
                <strong style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>
                  6. Good to Know (ICH Q8 / Q9)
                </strong>
                <ul style={{ paddingLeft: '1.1rem', margin: 0, color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.76rem' }}>
                  {RPN_GUIDE_CONTENT.goodToKnow.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer with "Adjust cutoff" and "Got it" */}
            <div
              style={{
                padding: '0.8rem 1.4rem',
                background: '#f8fafc',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setShowRpnGuide(false)
                  setTimeout(() => {
                    cutoffInputRef.current?.focus()
                    cutoffInputRef.current?.select()
                  }, 100)
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
              >
                <SlidersHorizontal size={13} />
                <span>Adjust cutoff (currently {rpnThreshold})</span>
              </button>

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setShowRpnGuide(false)
                  rpnGuideBtnRef.current?.focus()
                }}
                style={{ padding: '0.4rem 1.1rem', fontSize: '0.8rem', borderRadius: '6px' }}
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
