// src/screens/Welcome.tsx  –  Project Dashboard & Main Landing
import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { Projects } from '../services/api'
import toast from 'react-hot-toast'
import logo from '../assets/logo.png'
import {
  ProjectStage,
  getProjectStage,
  getStepNumber,
  getStepLabel,
  STAGE_META
} from '../utils/projectUtils'

export default function Welcome() {
  const { setProject, setStep } = useStore()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStage, setSelectedStage] = useState<'all' | ProjectStage>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let retries = 3
    async function loadProjects() {
      try {
        const data = await Projects.list()
        setProjects(data)
      } catch (err) {
        if (retries > 0) {
          retries--
          setTimeout(loadProjects, 1000)
        } else {
          toast.error('Could not connect to backend')
        }
      } finally {
        setLoading(false)
      }
    }
    loadProjects()
  }, [])

  async function openProject(p: any) {
    try {
      const fullProj = await Projects.get(p.id)
      setProject(fullProj)
      setStep(fullProj.current_step || 'create-project')
    } catch {
      setProject(p)
      setStep(p.current_step || 'create-project')
    }
  }

  async function deleteProject(e: React.MouseEvent, id: number) {
    e.stopPropagation()
    if (!confirm('Delete this project?')) return
    await Projects.delete(id)
    setProjects(prev => prev.filter(p => p.id !== id))
    toast.success('Project deleted')
  }

  // Categorize projects into Planning, On-going, and Completed
  const categorized = useMemo(() => {
    const planning: any[] = []
    const ongoing: any[] = []
    const completed: any[] = []

    projects.forEach(p => {
      const stepNum = getStepNumber(p.current_step)
      const isFinished = p.status === 'completed' || p.is_finished || false
      const stage = getProjectStage(stepNum, isFinished)

      const enriched = {
        ...p,
        _stepNum: stepNum,
        _stepLabel: getStepLabel(p.current_step),
        _stage: stage
      }

      if (stage === 'planning') planning.push(enriched)
      else if (stage === 'ongoing') ongoing.push(enriched)
      else completed.push(enriched)
    })

    return { planning, ongoing, completed }
  }, [projects])

  // Filter based on stage tab & search query
  const filteredProjects = useMemo(() => {
    let list: any[] = []
    if (selectedStage === 'all') {
      list = [...categorized.planning, ...categorized.ongoing, ...categorized.completed]
    } else {
      list = categorized[selectedStage] || []
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(p =>
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.compound && p.compound.toLowerCase().includes(q)) ||
        (p.objective && p.objective.toLowerCase().includes(q))
      )
    }

    return list
  }, [categorized, selectedStage, searchQuery])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── 1. Top-Bar Navigation ── */}
      <header className="landing-top-bar">
        <div className="landing-nav-container">
          {/* Top-Left: Inline Brand Logo & Typography */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
            <img
              src={logo}
              alt="Viruj Chematrix Logo"
              style={{ height: '48px', width: 'auto', objectFit: 'contain' }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', lineHeight: 1 }}>
                <span style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>
                  Viruj
                </span>
                <span style={{ fontSize: '1.55rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.025em' }}>
                  Chematrix
                </span>
              </div>
              <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '3px' }}>
                DoE & QbD Platform
              </div>
            </div>
          </div>

          {/* Top-Right: Actions & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {/* User Profile Pill */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 0.95rem',
                background: '#f8fafc',
                borderRadius: '999px',
                border: '1px solid var(--border)',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: 'var(--text-secondary)'
              }}
            >
              <span style={{ fontSize: '0.95rem' }}>👨‍🔬</span>
              <span>R&D Scientist</span>
            </div>

            {/* Primary Action Button */}
            <button
              className="btn btn-primary"
              style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem', gap: '0.45rem', fontWeight: 700 }}
              onClick={() => { setProject(null); setStep('create-project'); }}
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Project
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Landing Body ── */}
      <main style={{ flex: 1, width: '100%', padding: '1.5rem 2.5rem 2.5rem 2.5rem' }}>
        {/* Stage Overview Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}>
          {/* Total Projects (All Projects) with Search Option */}
          <div
            className={`stage-metric-card ${selectedStage === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedStage('all')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  All Projects
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '1px', lineHeight: 1.1 }}>
                  {projects.length}
                </div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>Complete portfolio</div>
              </div>
              <div style={{ fontSize: '1.35rem', opacity: 0.8 }}>📁</div>
            </div>

            {/* Search Option in All Projects Section */}
            <div
              style={{ position: 'relative', width: '100%' }}
              onClick={e => e.stopPropagation()}
            >
              <input
                type="text"
                className="form-input"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  if (selectedStage !== 'all') setSelectedStage('all')
                }}
                style={{
                  padding: '0.3rem 0.55rem 0.3rem 1.65rem',
                  fontSize: '0.76rem',
                  height: '28px',
                  borderRadius: '6px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  width: '100%'
                }}
              />
              <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.5, fontSize: '0.72rem', pointerEvents: 'none' }}>
                🔍
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  style={{
                    position: 'absolute',
                    right: '0.45rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.72rem',
                    padding: '2px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Planning Metric */}
          <div
            className={`stage-metric-card ${selectedStage === 'planning' ? 'active' : ''}`}
            onClick={() => setSelectedStage('planning')}
            style={{
              borderLeft: '4px solid #d97706',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span className="stage-badge bg-amber-50 text-amber-700 border-amber-200" style={{ fontSize: '0.66rem', padding: '0.15rem 0.45rem' }}>
                    Planning
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600 }}>Steps 1–7</span>
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#b45309', marginTop: '1px', lineHeight: 1.1 }}>
                  {categorized.planning.length}
                </div>
              </div>
              <div style={{ fontSize: '1.35rem' }}>📋</div>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>QbD Foundation & Scoping</div>
          </div>

          {/* On-going Metric */}
          <div
            className={`stage-metric-card ${selectedStage === 'ongoing' ? 'active' : ''}`}
            onClick={() => setSelectedStage('ongoing')}
            style={{
              borderLeft: '4px solid #2563eb',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span className="stage-badge bg-blue-50 text-blue-700 border-blue-200" style={{ fontSize: '0.66rem', padding: '0.15rem 0.45rem' }}>
                    On-going
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600 }}>Steps 8–15</span>
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1d4ed8', marginTop: '1px', lineHeight: 1.1 }}>
                  {categorized.ongoing.length}
                </div>
              </div>
              <div style={{ fontSize: '1.35rem' }}>🧪</div>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>DOE Runs & Bayesian Loop</div>
          </div>

          {/* Completed Metric */}
          <div
            className={`stage-metric-card ${selectedStage === 'completed' ? 'active' : ''}`}
            onClick={() => setSelectedStage('completed')}
            style={{
              borderLeft: '4px solid #059669',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.5rem',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span className="stage-badge bg-emerald-50 text-emerald-700 border-emerald-200" style={{ fontSize: '0.66rem', padding: '0.15rem 0.45rem' }}>
                    Completed
                  </span>
                  <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 600 }}>Steps 16–17</span>
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#047857', marginTop: '1px', lineHeight: 1.1 }}>
                  {categorized.completed.length}
                </div>
              </div>
              <div style={{ fontSize: '1.35rem' }}>✅</div>
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Optimum & Final Reports</div>
          </div>
        </div>

        {/* Section Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', marginTop: '0.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {selectedStage === 'all'
                ? 'All Projects'
                : `${STAGE_META[selectedStage]?.icon} ${STAGE_META[selectedStage]?.title} Projects`}
            </h2>
            <span className="badge badge-accent" style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem' }}>
              {filteredProjects.length}
            </span>
            {searchQuery && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                matching "{searchQuery}"
              </span>
            )}
          </div>

          {selectedStage !== 'all' && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedStage('all')}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: '999px' }}
            >
              Show All Projects ✕
            </button>
          )}
        </div>

        {/* ── Project Grid / Categorized View ── */}
        {loading ? (
          <div className="loading-overlay" style={{ minHeight: '300px' }}>
            <div className="spinner" /> Loading projects…
          </div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)', background: 'white' }}>
            <div style={{ fontSize: '3.2rem', marginBottom: '1rem' }}>🔬</div>
            <div style={{ fontWeight: 700, fontSize: '1.2rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              No projects created yet
            </div>
            <div style={{ fontSize: '0.88rem', maxWidth: '460px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
              Launch a new QbD design of experiments campaign to begin the workflow.
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => { setProject(null); setStep('create-project'); }}>
                + Start New Project
              </button>
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3.5rem', color: 'var(--text-muted)', background: 'white', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔍</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '0.4rem' }}>
              No projects found in this view
            </div>
            <div style={{ fontSize: '0.82rem', marginBottom: '1rem' }}>
              No matching projects for {selectedStage !== 'all' ? `stage "${STAGE_META[selectedStage]?.title}"` : 'your search query'}.
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => { setSelectedStage('all'); setSearchQuery(''); }}>
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="project-grid">
            {filteredProjects.map(p => {
              const stageMeta = STAGE_META[p._stage as ProjectStage] || STAGE_META.planning
              const progressPct = Math.round((p._stepNum / 17) * 100)

              return (
                <div
                  key={p.id}
                  className="project-card"
                  onClick={() => openProject(p)}
                  style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                >
                  <div>
                    {/* Top Row: Title, Stage Badge & Delete */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.45rem', marginBottom: '0.3rem' }}>
                      <div className="project-card-name" style={{ margin: 0, lineHeight: 1.3, fontSize: '0.92rem' }}>
                        {p.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                        <span className={`stage-badge ${stageMeta.badgeClasses}`} style={{ fontSize: '0.66rem', padding: '0.15rem 0.45rem' }} title={stageMeta.includedSteps}>
                          {stageMeta.icon} {stageMeta.title}
                        </span>
                        <button
                          className="btn btn-danger btn-sm"
                          style={{ padding: '0.12rem 0.38rem', fontSize: '0.68rem' }}
                          onClick={e => deleteProject(e, p.id)}
                          title="Delete project"
                        >
                          ✕
                        </button>
                      </div>
                    </div>

                    {/* Compound Pill */}
                    {p.compound && (
                      <div className="project-card-compound" style={{ marginBottom: '0.35rem', fontSize: '0.74rem' }}>
                        API / Compound: <strong>{p.compound}</strong>
                      </div>
                    )}

                    {/* Objective / Description */}
                    {p.objective && (
                      <div style={{ fontSize: '0.73rem', color: '#475569', marginBottom: '0.45rem', lineHeight: 1.4 }}>
                        {p.objective.slice(0, 95)}
                        {p.objective.length > 95 ? '…' : ''}
                      </div>
                    )}
                  </div>

                  <div>
                    {/* Workflow Step Progress Bar */}
                    <div style={{ marginTop: '0.35rem', marginBottom: '0.45rem', padding: '0.45rem 0.65rem', background: '#f8fafc', borderRadius: 'var(--radius-sm)', border: '1px solid #f1f5f9' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', fontWeight: 600 }}>
                        <span style={{ color: stageMeta.accentColor }}>
                          {p._stepLabel}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          Step {p._stepNum} of 17 ({progressPct}%)
                        </span>
                      </div>
                      <div className="stage-progress-bar">
                        <div
                          className="stage-progress-fill"
                          style={{
                            width: `${progressPct}%`,
                            background: stageMeta.accentColor
                          }}
                        />
                      </div>
                    </div>

                    {/* Metadata Badges */}
                    <div className="project-card-meta">
                      <span>📊 {p.experiment_count || 0} runs</span>
                      {p.doe_type && <span>🧪 {p.doe_type}</span>}
                      {p.bayes_iter > 0 && (
                        <span className="badge badge-success" style={{ fontSize: '0.62rem', padding: '0.1rem 0.35rem' }}>
                          Bayes Iter: {p.bayes_iter}
                        </span>
                      )}
                    </div>

                    {/* Updated Timestamp */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.45rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.4rem' }}>
                      <span>Updated: {new Date(p.updated_at).toLocaleDateString()}</span>
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Open Project →</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── 17-Step Workflow Pipeline Diagram (Stage Categorized) ── */}
        <div style={{ marginTop: '2rem' }}>
          <div className="card" style={{ padding: '1.15rem 1.35rem' }}>
            <div className="card-header" style={{ marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div className="card-title" style={{ fontSize: '0.92rem', fontWeight: 700 }}>17-Step QbD & DoE Workflow Architecture</div>
                  <div className="card-sub" style={{ fontSize: '0.74rem' }}>Structured progress across the three operational stages</div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <span className="stage-badge bg-amber-50 text-amber-700 border-amber-200" style={{ fontSize: '0.66rem', padding: '0.15rem 0.45rem' }}>Planning: Steps 1–7</span>
                  <span className="stage-badge bg-blue-50 text-blue-700 border-blue-200" style={{ fontSize: '0.66rem', padding: '0.15rem 0.45rem' }}>On-going: Steps 8–15</span>
                  <span className="stage-badge bg-emerald-50 text-emerald-700 border-emerald-200" style={{ fontSize: '0.66rem', padding: '0.15rem 0.45rem' }}>Completed: Steps 16–17</span>
                </div>
              </div>
            </div>

            {/* Stages Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
              {/* Planning Section */}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#b45309', fontSize: '0.76rem', marginBottom: '0.45rem' }}>
                  <span>📋 Stage 1: Planning</span>
                  <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>(Steps 01–07)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.22rem', fontSize: '0.7rem', color: '#92400e', lineHeight: 1.4 }}>
                  <div>01. Project Setup & API Details</div>
                  <div>02. QTPP Definition (Context-Aware Criteria)</div>
                  <div>03. Critical Quality Attributes (CQAs)</div>
                  <div>04. Synthetic Route & Unit Operations</div>
                  <div>05. Reverse Risk Assessment (FMEA / RPN)</div>
                  <div>06. Phase 0 Foundation Summary</div>
                  <div>07. Campaign Dashboard & Scoping</div>
                </div>
              </div>

              {/* On-going Section */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#1d4ed8', fontSize: '0.76rem', marginBottom: '0.45rem' }}>
                  <span>🧪 Stage 2: On-going</span>
                  <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>(Steps 08–15)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.22rem', fontSize: '0.7rem', color: '#1e40af', lineHeight: 1.4 }}>
                  <div>08. Factors & Responses Specification</div>
                  <div>09. DOE Algorithm Recommendation</div>
                  <div>10. DOE Execution & Measurement Results</div>
                  <div>11. Initial Response Surface Optimum</div>
                  <div>12. Diagnostic Evaluation (Enough Data?)</div>
                  <div>13. Gaussian Process Surrogate Modeling</div>
                  <div>14. Bayesian Optimization & Acquisition</div>
                  <div>15. Adaptive Loop Iterations</div>
                </div>
              </div>

              {/* Completed Section */}
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700, color: '#047857', fontSize: '0.76rem', marginBottom: '0.45rem' }}>
                  <span>✅ Stage 3: Completed</span>
                  <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>(Steps 16–17)</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.22rem', fontSize: '0.7rem', color: '#065f46', lineHeight: 1.4 }}>
                  <div>16. Final Optimum & Process Design Space</div>
                  <div>17. Comprehensive PDF / Excel Report</div>
                  <div style={{ marginTop: '0.35rem', fontSize: '0.66rem', opacity: 0.85, fontStyle: 'italic' }}>
                    Locked design space verification and regulatory submission dossier generation.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
