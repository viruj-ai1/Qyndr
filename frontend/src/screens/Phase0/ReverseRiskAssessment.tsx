// src/screens/Phase0/ReverseRiskAssessment.tsx – Screen A4: Reverse Risk Assessment
import { useState, useMemo, useEffect } from 'react'
import { useStore, RiskParameter } from '../../store/useStore'
import { Projects } from '../../services/api'
import { generateContextAwareRiskParameters, isDummyRiskParams } from '../../utils/routeGenerator'
import toast from 'react-hot-toast'

export default function ReverseRiskAssessment() {
  const {
    currentProject, stages, cqas, riskAssessments,
    rpnThreshold, setRpnThreshold, setRiskAssessments, setStep, addAuditLog
  } = useStore()

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
          parameters: generateContextAwareRiskParameters(st, idx, currentProject, cqas)
        }
      }
    })
    return defaultDict
  })

  // Synchronize when stages or project changes
  useEffect(() => {
    setLocalRisk(prev => {
      const next = { ...prev }
      let updated = false
      stages.forEach((st, idx) => {
        const existing = next[st.id]?.parameters
        if (!existing || existing.length === 0 || isDummyRiskParams(existing, currentProject)) {
          next[st.id] = {
            parameters: generateContextAwareRiskParameters(st, idx, currentProject, cqas)
          }
          updated = true
        }
      })
      return updated ? next : prev
    })
  }, [stages, currentProject?.id])

  // Relevant CQAs for current stage
  const relevantCQAs = useMemo(() => {
    if (!currentStage) return cqas
    return cqas
  }, [cqas, currentStage])

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

  // Re-derive parameters tailored for this specific stage and API
  const handleRederiveParams = () => {
    if (!currentStage) return
    const fresh = generateContextAwareRiskParameters(currentStage, safeStageIndex, currentProject, relevantCQAs)
    setLocalRisk({
      ...localRisk,
      [currentStage.id]: { parameters: fresh }
    })
    toast.success(`Risk parameters re-derived for ${currentStage.name}`)
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

  // Toggle Critical Flag Override
  const handleToggleOverride = (paramId: string) => {
    const updated = currentParams.map(p => {
      if (p.id === paramId) {
        return { ...p, criticalFlag: !p.criticalFlag }
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
      setStep('phase0-summary')
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="badge badge-accent">Step 05 · Phase 0</div>
          <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Reverse Risk Assessment</h1>
        </div>
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
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>
          Target Quality Attributes (CQAs) for {currentStage.name}:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {relevantCQAs.length === 0 ? (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No CQAs linked yet. CQAs derived in Step 03 will appear here.</span>
          ) : (
            relevantCQAs.map(c => (
              <span key={c.id} className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
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
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              RPN = Severity (1-5) × Occurrence (1-5) × Detectability (1-5) · Cutoff: {rpnThreshold}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleRederiveParams}
              title="Re-populate parameters adapting to current unit operation and compound"
            >
              ⚡ Re-derive Stage Parameters
            </button>
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
                <th style={{ width: '7%', textAlign: 'center' }}>RPN</th>
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
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className={`badge ${p.criticalFlag ? 'badge-danger' : 'badge-secondary'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={() => handleToggleOverride(p.id)}
                        title="Click to toggle Critical Flag manual override"
                      >
                        {p.criticalFlag ? 'CRITICAL' : 'Non-Critical'}
                      </button>
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
          onClick={() => {
            if (safeStageIndex > 0) setCurrentStageIndex(safeStageIndex - 1)
            else setStep('route-mapping')
          }}
        >
          ← {safeStageIndex > 0 ? `Back to Stage ${safeStageIndex}` : 'Back to Route Mapping'}
        </button>

        <button className="btn btn-primary" onClick={handleConfirmAndNextStage}>
          {safeStageIndex < stages.length - 1
            ? `Confirm & Move to ${(stages[safeStageIndex + 1]?.name || '').split(':')[0] || `Stage ${safeStageIndex + 2}`} →`
            : 'Confirm & View Phase 0 Handoff Summary →'}
        </button>
      </div>
    </div>
  )
}
