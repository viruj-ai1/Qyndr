// src/screens/DefineFactors.tsx
import { useState } from 'react'
import { useStore, Factor, Response, CQAMapping, RiskParameter } from '../store/useStore'
import { Projects } from '../services/api'
import toast from 'react-hot-toast'

const emptyFactor  = (): Factor  => ({ name:'', unit:'', low:0, high:1, baseline:0.5 })
const emptyResponse= (): Response=> ({ name:'', unit:'', goal:'maximize' })

function parseFactorFromCPP(cppName: string): { name: string; unit: string; low: number; high: number; baseline: number } {
  let name = cppName.trim()
  let unit = ''
  
  const parenMatch = cppName.match(/^(.*?)\s*\(([^)]+)\)$/)
  if (parenMatch) {
    name = parenMatch[1].trim()
    unit = parenMatch[2].trim()
  }

  if (name.toLowerCase() === 'morpholine molar ratio') name = 'Morpholine Ratio'

  let low = 0
  let high = 100
  let baseline = 50

  const lowerName = name.toLowerCase()
  if (lowerName.includes('temp')) {
    low = 45; high = 65; baseline = 55
    if (!unit) unit = '°C'
  } else if (lowerName.includes('ratio')) {
    low = 1.1; high = 1.6; baseline = 1.35
    if (!unit) unit = 'eq'
  } else if (lowerName.includes('time')) {
    low = 4; high = 10; baseline = 7
    if (!unit) unit = 'h'
  } else if (lowerName.includes('volume')) {
    low = 5; high = 15; baseline = 10
    if (!unit) unit = 'L/kg'
  } else if (lowerName.includes('rpm') || lowerName.includes('speed') || lowerName.includes('agitation')) {
    low = 250; high = 450; baseline = 350
    if (!unit) unit = 'RPM'
  } else if (lowerName.includes('rate') || lowerName.includes('cooling')) {
    low = 0.5; high = 3.0; baseline = 1.5
    if (!unit) unit = '°C/min'
  } else if (lowerName.includes('seed') || lowerName.includes('quantity')) {
    low = 0.5; high = 2.5; baseline = 1.5
    if (!unit) unit = '%'
  }

  return { name, unit, low, high, baseline }
}

function getAutoFactors(riskAssessments: Record<string, { parameters: RiskParameter[] }>, activeStageId?: string | null): Factor[] {
  const criticalCPPs: { name: string; unit: string; low: number; high: number; baseline: number }[] = []
  
  let stagesToSearch = activeStageId && riskAssessments[activeStageId]
    ? [riskAssessments[activeStageId]]
    : Object.values(riskAssessments)

  if (stagesToSearch.length === 0 || stagesToSearch.every(s => !s?.parameters || s.parameters.length === 0)) {
    return [
      { name: 'Reaction Temperature', symbol: 'Temp', unit: '°C', low: 45, high: 65, baseline: 55 },
      { name: 'Morpholine Ratio', symbol: 'Ratio', unit: 'eq', low: 1.1, high: 1.6, baseline: 1.35 },
      { name: 'Reaction Time', symbol: 'Time', unit: 'h', low: 4, high: 10, baseline: 7 },
      { name: 'Solvent Volume', symbol: 'Vol', unit: 'L/kg', low: 5, high: 15, baseline: 10 },
    ]
  }

  const seenNames = new Set<string>()

  stagesToSearch.forEach(stage => {
    (stage?.parameters || []).forEach(p => {
      if (p.criticalFlag || p.type === 'CPP-candidate') {
        const parsed = parseFactorFromCPP(p.name)
        const customUnit = (p as any).unit
        if (customUnit && customUnit !== 'unit') parsed.unit = customUnit
        if (!seenNames.has(parsed.name)) {
          seenNames.add(parsed.name)
          criticalCPPs.push(parsed)
        }
      }
    })
  })

  if (criticalCPPs.length === 0) {
    return [
      { name: 'Reaction Temperature', symbol: 'Temp', unit: '°C', low: 45, high: 65, baseline: 55 },
      { name: 'Morpholine Ratio', symbol: 'Ratio', unit: 'eq', low: 1.1, high: 1.6, baseline: 1.35 },
      { name: 'Reaction Time', symbol: 'Time', unit: 'h', low: 4, high: 10, baseline: 7 },
      { name: 'Solvent Volume', symbol: 'Vol', unit: 'L/kg', low: 5, high: 15, baseline: 10 },
    ]
  }

  return criticalCPPs.map((f, i) => ({
    name: f.name,
    symbol: `F${i + 1}`,
    unit: f.unit,
    low: f.low,
    high: f.high,
    baseline: f.baseline
  }))
}

function parseResponseFromCQA(cqa: CQAMapping): Response {
  const rawName = cqa.name || ''
  const lowerName = rawName.toLowerCase()
  const rangeStr = cqa.range || ''
  const op = cqa.operator || ''

  // Goal logic based on requirements:
  // Impurity CQAs -> Auto-sets Goal to Minimize with Target limit from Step 03
  // Yield & Purity CQAs -> Auto-sets Goal to Maximize with Target limit from Step 03
  let goal = 'maximize'
  const isImpurity = lowerName.includes('impurity') || lowerName.includes('solvent') || lowerName.includes('degradant') || lowerName.includes('heavy metal') || lowerName.includes('loss') || op === '<=' || op === '<'
  const isYieldOrPurity = lowerName.includes('yield') || lowerName.includes('purity') || lowerName.includes('assay') || lowerName.includes('recovery') || op === '>=' || op === '>'

  if (isImpurity && !isYieldOrPurity) {
    goal = 'minimize'
  } else if (isYieldOrPurity) {
    goal = 'maximize'
  } else if (op === '<=' || op === '<') {
    goal = 'minimize'
  } else if (op === 'Range') {
    goal = 'target'
  }

  let unit = '%'
  if (rangeStr.includes('ppm')) unit = 'ppm'
  else if (rangeStr.includes('µm') || rangeStr.includes('um')) unit = 'µm'
  else if (rangeStr.includes('%')) unit = '%'

  let target: number | undefined = undefined
  let lower_limit: number | undefined = undefined
  let upper_limit: number | undefined = undefined

  const rangeNumbers = rangeStr.match(/(\d+(?:\.\d+)?)/g)
  if (rangeNumbers && rangeNumbers.length > 0) {
    if (rangeNumbers.length === 1) {
      target = parseFloat(rangeNumbers[0])
      if (goal === 'minimize') {
        lower_limit = 0.0
        upper_limit = target
      } else if (goal === 'maximize') {
        lower_limit = target
        upper_limit = 100.0
      }
    } else if (rangeNumbers.length >= 2) {
      lower_limit = parseFloat(rangeNumbers[0])
      upper_limit = parseFloat(rangeNumbers[1])
      target = (lower_limit + upper_limit) / 2
    }
  }

  return {
    name: rawName,
    unit,
    goal,
    target: target ?? (goal === 'maximize' ? 95.0 : goal === 'minimize' ? 0.15 : 50.0),
    lower_limit,
    upper_limit,
    weight: 1.0,
    linked_cqa_ids: [cqa.id]
  }
}

function getAutoResponses(cqas: CQAMapping[]): Response[] {
  if (!cqas || cqas.length === 0) {
    return [
      { name: '% Reaction Yield', unit: '%', goal: 'maximize', target: 95.0, lower_limit: 88.0, upper_limit: 100.0, weight: 1.0 },
      { name: '% Impurity A', unit: '%', goal: 'minimize', target: 0.1, lower_limit: 0.0, upper_limit: 0.50, weight: 1.0 },
    ]
  }

  return cqas.map(parseResponseFromCQA)
}

export default function DefineFactors() {
  const { currentProject, riskAssessments, cqas, activeStageId, setProject, setStep } = useStore()

  const [factors, setFactors]     = useState<Factor[]>(() =>
    currentProject?.factors?.length ? currentProject.factors : getAutoFactors(riskAssessments, activeStageId))
  const [responses, setResponses] = useState<Response[]>(() =>
    currentProject?.responses?.length ? currentProject.responses : getAutoResponses(cqas))
  const [saving, setSaving]       = useState(false)

  /* ── Auto-Population Handlers ─── */
  const handleAutoPopulateFactors = () => {
    const autoF = getAutoFactors(riskAssessments, activeStageId)
    setFactors(autoF)
    toast.success(`Pre-filled ${autoF.length} Critical Process Parameters (CPPs) from Step 05 Risk Assessment`)
  }

  const handleAutoPopulateResponses = () => {
    const autoR = getAutoResponses(cqas)
    setResponses(autoR)
    toast.success(`Pre-filled ${autoR.length} Response Variables & Goals from Step 03 CQAs`)
  }

  /* ── Factors helpers ─── */
  const addFactor = () => setFactors(f => [...f, emptyFactor()])
  const removeFactor = (i: number) => setFactors(f => f.filter((_,idx) => idx!==i))
  const setF = (i: number, key: keyof Factor, val: any) =>
    setFactors(f => f.map((row, idx) => idx===i ? { ...row, [key]: val } : row))

  /* ── Responses helpers ─── */
  const addResponse = () => setResponses(r => [...r, emptyResponse()])
  const removeResponse = (i: number) => setResponses(r => r.filter((_,idx)=>idx!==i))
  const setR = (i: number, key: keyof Response, val: any) =>
    setResponses(r => r.map((row, idx) => idx===i ? { ...row, [key]: val } : row))

  async function handleSave() {
    if (factors.some(f => !f.name.trim())) { toast.error('All factors need a name'); return }
    if (factors.some(f => f.high <= f.low)) { toast.error('High must be > Low for each factor'); return }
    if (responses.some(r => !r.name.trim())) { toast.error('All responses need a name'); return }
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
        name: r.name.trim(),
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

  const inputCls = 'form-input'

  return (
    <div>
      <div className="page-header">
        <div className="page-header-tag">Step 08</div>
        <h1 className="page-title">Define Factors & Responses</h1>
        <p className="page-desc">Select what we will change and what we will measure in the experiments.</p>
      </div>

      {/* Auto-Inheritance Summary Info Banner */}
      <div className="alert alert-info mb-2" style={{ borderLeft: '4px solid var(--accent)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>⚡ Auto-Inheriting QbD Parameters from Phase 0</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Process Factors auto-inherit CPPs from Step 05 Risk Assessment. Response Variables & Goals auto-inherit CQAs and Target specs from Step 03 CQAs.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={handleAutoPopulateFactors} title="Re-fill CPPs from Step 05">
            🔄 Sync CPPs (Step 05)
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleAutoPopulateResponses} title="Re-fill CQAs from Step 03">
            🔄 Sync CQAs (Step 03)
          </button>
        </div>
      </div>

      {/* ── Factors ── */}
      <div className="card mb-2">
        <div className="flex-between mb-2">
          <div>
            <div className="card-title">Process Factors</div>
            <div className="card-sub">Input variables to be varied in the experiment (Auto-populated from Step 05 CPPs)</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleAutoPopulateFactors}>⚡ Pre-fill from Step 05 CPPs</button>
            <button className="btn btn-secondary btn-sm" onClick={addFactor}>+ Add Factor</button>
          </div>
        </div>

        {/* Header row */}
        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 1fr 36px', gap:'0.5rem', marginBottom:'0.4rem', padding:'0 0.75rem' }}>
          {['Factor Name','Unit','Low','High','Baseline',''].map(h=>(
            <div key={h} style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</div>
          ))}
        </div>

        {factors.map((f, i) => (
          <div key={i} className="factor-row">
            <input className={inputCls} placeholder="e.g. Temperature" value={f.name}
              onChange={e => setF(i,'name',e.target.value)} />
            <input className={inputCls} placeholder="°C" value={f.unit}
              onChange={e => setF(i,'unit',e.target.value)} />
            <input className={inputCls} type="number" value={f.low}
              onChange={e => setF(i,'low',+e.target.value)} />
            <input className={inputCls} type="number" value={f.high}
              onChange={e => setF(i,'high',+e.target.value)} />
            <input className={inputCls} type="number" value={f.baseline ?? (f.low+f.high)/2}
              onChange={e => setF(i,'baseline',+e.target.value)} />
            <button style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', color:'var(--danger)', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
              onClick={() => removeFactor(i)} disabled={factors.length===1}>✕</button>
          </div>
        ))}

        <div className="alert alert-info mt-1">
          💡 Tip: Use 3–7 factors for a good DOE. Too many factors → consider Plackett-Burman for screening first.
        </div>
      </div>

      {/* ── Physicochemical Safety Guardrails ── */}
      <div className="card mb-2" style={{ borderLeft: '4px solid var(--warning)' }}>
        <div className="card-title mb-2">Physicochemical Safety Guardrails</div>
        <p className="card-sub mb-2">Define any physical or chemical limits to prevent dangerous lab conditions during execution.</p>
        <div className="grid-2">
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Max Temperature Limit (°C)</label>
            <input className={inputCls} placeholder="e.g. 75 (Solvent Boiling Point)" />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Prevents DOE from recommending runs above this temperature.</div>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Max Exotherm / Heat Flow Limit</label>
            <input className={inputCls} placeholder="e.g. 50 W/kg" />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Safety threshold for thermal runaway.</div>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Min Reagent Ratio Limit</label>
            <input className={inputCls} placeholder="e.g. 1.05 eq" />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Minimum stoichiometry required to avoid incomplete reaction.</div>
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Custom Safety Constraint</label>
            <input className={inputCls} placeholder="e.g. Pressure < 2 atm" />
          </div>
        </div>
      </div>

      {/* ── Responses ── */}
      <div className="card">
        <div className="flex-between mb-2">
          <div>
            <div className="card-title">Response Variables</div>
            <div className="card-sub">Output variables to measure after each experiment (Auto-populated from Step 03 CQAs)</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleAutoPopulateResponses}>⚡ Pre-fill from Step 03 CQAs</button>
            <button className="btn btn-secondary btn-sm" onClick={addResponse}>+ Add Response</button>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1.5fr 1fr 36px', gap:'0.5rem', marginBottom:'0.4rem', padding:'0 0.75rem' }}>
          {['Response Name','Unit','Goal','Target',''].map(h=>(
            <div key={h} style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>{h}</div>
          ))}
        </div>

        {responses.map((r, i) => (
          <div key={i} className="response-row">
            <input className={inputCls} placeholder="e.g. Yield %" value={r.name}
              onChange={e => setR(i,'name',e.target.value)} />
            <input className={inputCls} placeholder="%" value={r.unit}
              onChange={e => setR(i,'unit',e.target.value)} />
            <select className="form-select" value={r.goal}
              onChange={e => setR(i,'goal',e.target.value)}>
              <option value="maximize">Maximize</option>
              <option value="minimize">Minimize</option>
              <option value="target">Hit Target</option>
            </select>
            <input className={inputCls} type="number" placeholder="Optional"
              value={r.target ?? ''} onChange={e => setR(i,'target',e.target.value?+e.target.value:undefined)} />
            <button style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', color:'var(--danger)', borderRadius:'6px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
              onClick={() => removeResponse(i)} disabled={responses.length===1}>✕</button>
          </div>
        ))}
      </div>

      <div className="step-nav">
        <button className="btn btn-secondary" onClick={() => setStep('understand-process')}>← Back</button>
        <div style={{ display:'flex', gap:'0.75rem', alignItems:'center' }}>
          <span style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{factors.length} factors · {responses.length} responses</span>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" />Saving…</> : 'Save & Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}

