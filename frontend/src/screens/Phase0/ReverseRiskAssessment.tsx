// src/screens/Phase0/ReverseRiskAssessment.tsx – Screen A4: Reverse Risk Assessment
import { useState, useMemo } from 'react'
import { useStore, RiskParameter } from '../../store/useStore'
import { Projects } from '../../services/api'

export default function ReverseRiskAssessment() {
  const {
    currentProject, stages, cqas, riskAssessments,
    rpnThreshold, setRpnThreshold, setRiskAssessments, setStep, addAuditLog
  } = useStore()

  // Stage order from Stage 1 -> Stage N
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  
  const currentStage = stages[currentStageIndex] || stages[0] || { id: 'stage-1', name: 'Stage 1' }

  function getDefaultStageParams(stageId: string, idx: number, stageObj?: any): RiskParameter[] {
    const sId = (stageId || '').toLowerCase()
    const unitOp = (stageObj?.unitOpType || '').toLowerCase()
    const name = (stageObj?.name || '').toLowerCase()

    const isStage2 = sId === 'stage-2' || sId.endsWith('-2') || idx === 1 || (idx === 2 && !sId.includes('stage-3')) || unitOp.includes('workup') || name.includes('workup') || name.includes('extraction') || name.includes('quench')
    const isStage3 = sId === 'stage-3' || sId.endsWith('-3') || (idx === 2 && sId.includes('stage-3')) || idx === 3 || unitOp.includes('crystallization') || name.includes('crystallization') || name.includes('isolation') || unitOp.includes('drying')

    if (isStage2 && !isStage3) {
      return [
        { id: `p-${stageId}-1`, name: 'Quench Water Temperature (°C)', type: 'CPP-candidate', linkedCqaIds: cqas.map(c => c.id), severity: 4, occurrence: 3, detectability: 2, rpn: 24, rationale: 'Elevated quench temp triggers hydrolytic decomposition.', criticalFlag: true, overrideReason: '' },
        { id: `p-${stageId}-2`, name: 'Aqueous Extraction Ratio (v/v)', type: 'CPP-candidate', linkedCqaIds: cqas.map(c => c.id), severity: 3, occurrence: 3, detectability: 2, rpn: 18, rationale: 'Determines residual morpholine removal efficiency.', criticalFlag: true, overrideReason: '' },
        { id: `p-${stageId}-3`, name: 'Phase Separation Time (min)', type: 'CMA-candidate', linkedCqaIds: cqas.map(c => c.id), severity: 3, occurrence: 2, detectability: 2, rpn: 12, rationale: 'Incomplete settling leads to rag layer carryover.', criticalFlag: false, overrideReason: '' },
        { id: `p-${stageId}-4`, name: 'Extraction Agitation Speed (RPM)', type: 'CMA-candidate', linkedCqaIds: cqas.map(c => c.id), severity: 2, occurrence: 2, detectability: 2, rpn: 8, rationale: 'Ensures uniform phase mixing without forming emulsion.', criticalFlag: false, overrideReason: '' }
      ]
    } else if (isStage3) {
      return [
        { id: `p-${stageId}-1`, name: 'Crystallization Cooling Rate (°C/min)', type: 'CPP-candidate', linkedCqaIds: cqas.map(c => c.id), severity: 4, occurrence: 4, detectability: 2, rpn: 32, rationale: 'Fast cooling entraps impurities; slow cooling reduces crystal yield.', criticalFlag: true, overrideReason: '' },
        { id: `p-${stageId}-2`, name: 'Acetonitrile Seed Quantity (%)', type: 'CPP-candidate', linkedCqaIds: cqas.map(c => c.id), severity: 4, occurrence: 3, detectability: 2, rpn: 24, rationale: 'Controls crystal polymorphic form and supersaturation.', criticalFlag: true, overrideReason: '' },
        { id: `p-${stageId}-3`, name: 'Filtration Wash Volume (L/kg)', type: 'CPP-candidate', linkedCqaIds: cqas.map(c => c.id), severity: 3, occurrence: 3, detectability: 2, rpn: 18, rationale: 'Removes mother liquor impurities from wet cake.', criticalFlag: true, overrideReason: '' },
        { id: `p-${stageId}-4`, name: 'Vacuum Drying Temperature (°C)', type: 'CMA-candidate', linkedCqaIds: cqas.map(c => c.id), severity: 2, occurrence: 3, detectability: 2, rpn: 12, rationale: 'Removes residual solvent below ICH guideline limit.', criticalFlag: false, overrideReason: '' }
      ]
    } else {
      return [
        { id: `p-${stageId}-1`, name: 'Reaction Temperature (°C)', type: 'CPP-candidate', linkedCqaIds: cqas.map(c => c.id), severity: 4, occurrence: 4, detectability: 2, rpn: 32, rationale: 'High temp drives Impurity A formation; low temp causes slow conversion.', criticalFlag: true, overrideReason: '' },
        { id: `p-${stageId}-2`, name: 'Morpholine Molar Ratio (eq)', type: 'CPP-candidate', linkedCqaIds: cqas.map(c => c.id), severity: 4, occurrence: 3, detectability: 2, rpn: 24, rationale: 'Excess morpholine increases residual solvent burden.', criticalFlag: true, overrideReason: '' },
        { id: `p-${stageId}-3`, name: 'Reaction Time (h)', type: 'CPP-candidate', linkedCqaIds: cqas.map(c => c.id), severity: 3, occurrence: 3, detectability: 2, rpn: 18, rationale: 'Extended time causes product degradation.', criticalFlag: true, overrideReason: '' },
        { id: `p-${stageId}-4`, name: 'Solvent Volume (L/kg)', type: 'CMA-candidate', linkedCqaIds: cqas.map(c => c.id), severity: 2, occurrence: 3, detectability: 2, rpn: 12, rationale: 'Affects reaction rate and crystallization recovery.', criticalFlag: false, overrideReason: '' }
      ]
    }
  }

  // Initial risk assessment dictionary
  const [localRisk, setLocalRisk] = useState<Record<string, { parameters: RiskParameter[] }>>(() => {
    const defaultDict: Record<string, { parameters: RiskParameter[] }> = { ...riskAssessments }
    stages.forEach((st, idx) => {
      if (!defaultDict[st.id] || !defaultDict[st.id].parameters || defaultDict[st.id].parameters.length === 0) {
        defaultDict[st.id] = { parameters: getDefaultStageParams(st.id, idx, st) }
      }
    })
    return defaultDict
  })

  // Get current stage parameters
  const rawParams = localRisk[currentStage?.id]?.parameters
  const currentParams = (rawParams && rawParams.length > 0)
    ? rawParams
    : getDefaultStageParams(currentStage?.id || 'stage-1', currentStageIndex, currentStage)

  // Relevant CQAs for current stage
  const relevantCQAs = useMemo(() => {
    if (!currentStage) return cqas
    return cqas
  }, [cqas, currentStage])

  // Handle adding parameter
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
    setRiskAssessments(localRisk)
    if (currentProject) {
      try {
        await Projects.savePhase0(currentProject.id, { riskAssessments: localRisk })
        addAuditLog('RISK_ASSESSMENT_STAGE', `Completed risk assessment for ${currentStage.name}`)
      } catch (e) {
        console.error('Failed to save risk assessment', e)
      }
    }

    if (currentStageIndex < stages.length - 1) {
      setCurrentStageIndex(currentStageIndex + 1)
    } else {
      setStep('phase0-summary')
    }
  }

  return (
    <div className="screen-container">
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="badge badge-accent">Step 05 · Phase 0</div>
          <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Risk Assessment</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Find which process factors can cause problems in product quality.
        </p>
      </div>

      {/* Progress & Cutoff Header Bar */}
      <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
            Reverse Assessment Walk
          </div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-light)', marginTop: '2px' }}>
            Assessing Stage {currentStageIndex + 1} of {stages.length}: <span style={{ color: '#fff' }}>{currentStage.name}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          {/* RPN Threshold Settings */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(255,255,255,0.03)', padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>RPN Critical Cutoff:</label>
            <input
              type="number"
              className="input input-sm"
              style={{ width: '70px', textAlign: 'center' }}
              value={rpnThreshold}
              onChange={e => setRpnThreshold(parseInt(e.target.value) || 100)}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {stages.map((st, idx) => {
              let label = st.name.includes(':') ? st.name.split(':')[0].trim() : `Stage ${idx + 1}`
              if (label === 'Stage-I' || label === 'Stage I') label = `Stage ${idx + 1}`
              return (
                <button
                  key={st.id}
                  className={`btn btn-xs ${idx === currentStageIndex ? 'btn-primary' : 'btn-secondary'}`}
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
          Relevant CQAs for {currentStage.name}:
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {relevantCQAs.map(c => (
            <span key={c.id} className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
              • {c.name} ({c.appliesTo})
            </span>
          ))}
        </div>
      </div>

      {/* Fishbone / FMEA Table */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>Process Parameter Risk Matrix (Auto-Sorted by RPN)</h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>RPN = Severity (1-5) × Occurrence (1-5) × Detectability (1-5)</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={handleAddParam}>
            + Add Parameter
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '0.82rem' }}>
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Process Parameter</th>
                <th style={{ width: '12%' }}>Parameter Type</th>
                <th style={{ width: '18%' }}>Linked CQA(s)</th>
                <th style={{ width: '6%', textAlign: 'center' }}>S</th>
                <th style={{ width: '6%', textAlign: 'center' }}>O</th>
                <th style={{ width: '6%', textAlign: 'center' }}>D</th>
                <th style={{ width: '7%', textAlign: 'center' }}>RPN</th>
                <th style={{ width: '10%', textAlign: 'center' }}>Status Badge</th>
                <th style={{ width: '13%' }}>Rationale / Override Reason</th>
                <th style={{ width: '4%', textAlign: 'center' }}>Actions</th>
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
                        placeholder="e.g. Reaction Temperature"
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
                        placeholder="Risk rationale or override reason..."
                        value={p.rationale}
                        onChange={e => handleParamChange(p.id, 'rationale', e.target.value)}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-icon btn-xs btn-danger"
                        onClick={() => handleRemoveParam(p.id)}
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

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          className="btn btn-secondary"
          onClick={() => {
            if (currentStageIndex > 0) setCurrentStageIndex(currentStageIndex - 1)
            else setStep('route-mapping')
          }}
        >
          ← Previous Step
        </button>

        <button className="btn btn-primary" onClick={handleConfirmAndNextStage}>
          {currentStageIndex < stages.length - 1
            ? `Confirm & Move to ${stages[currentStageIndex + 1].name.split(':')[0]} →`
            : 'Confirm & View Phase 0 Handoff Summary →'}
        </button>
      </div>
    </div>
  )
}
