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
import {
  ProjectSection,
  ProjectCard
} from '../components/dashboard'

export default function Welcome() {
  const { setProject, setStep } = useStore()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
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
      const isFinished = p.status?.toLowerCase() === 'completed' || p.is_finished || false
      const stage = getProjectStage(stepNum, isFinished, p.status)

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

  // Search filter applied in real-time across all sections
  const filterList = (list: any[]) => {
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    return list.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.compound && p.compound.toLowerCase().includes(q)) ||
      (p.objective && p.objective.toLowerCase().includes(q)) ||
      (p.doe_type && p.doe_type.toLowerCase().includes(q))
    )
  }

  const filteredPlanning = useMemo(() => filterList(categorized.planning), [categorized.planning, searchQuery])
  const filteredOngoing = useMemo(() => filterList(categorized.ongoing), [categorized.ongoing, searchQuery])
  const filteredCompleted = useMemo(() => filterList(categorized.completed), [categorized.completed, searchQuery])

  const totalMatches = filteredPlanning.length + filteredOngoing.length + filteredCompleted.length
  const searchActive = Boolean(searchQuery.trim())

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
            {/* Search Input in Top Header */}
            <div style={{ position: 'relative', width: '280px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  padding: '0.45rem 2rem 0.45rem 2.1rem',
                  fontSize: '0.875rem',
                  height: '38px',
                  borderRadius: '999px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  width: '100%',
                  boxSizing: 'border-box'
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  left: '0.75rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  opacity: 0.5,
                  fontSize: '0.82rem',
                  pointerEvents: 'none'
                }}
              >
                🔍
              </span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                  style={{
                    position: 'absolute',
                    right: '0.65rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    padding: '2px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>

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


        {/* Global Search Status Banner */}
        {searchActive && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.6rem 1rem',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.25rem',
              fontSize: '0.82rem',
              color: '#1e40af'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🔍</span>
              <span>
                Searching across all stage sections for: <strong>"{searchQuery}"</strong> ({totalMatches} match{totalMatches === 1 ? '' : 'es'} found)
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}
              onClick={() => setSearchQuery('')}
            >
              Reset Search ✕
            </button>
          </div>
        )}

        {/* ── Project Sections Container ── */}
        <div id="dashboard-sections-container">
          {loading ? (
            <div className="loading-overlay" style={{ minHeight: '300px' }}>
              <div className="spinner" /> Loading projects…
            </div>
          ) : projects.length === 0 ? (
            /* Dashboard Zero State */
            <div
              style={{
                textAlign: 'center',
                padding: '4rem 2rem',
                color: 'var(--text-muted)',
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius)',
                background: 'white'
              }}
            >
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
          ) : (
            <>
              {/* ── Section 1: Planning Stage Projects (Steps 1–7) ── */}
              <ProjectSection
                id="section-planning"
                title="Planning Stage Projects"
                status="planning"
                count={categorized.planning.length}
                filteredCount={filteredPlanning.length}
                subtitle="QbD Foundation & Scoping · Steps 1–7"
                accentColor="#F59E0B"
                badgeText="PLANNING"
                searchActive={searchActive}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
                emptyStateMessage="No planning stage projects currently."
              >
                {filteredPlanning.map(p => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onOpen={openProject}
                  />
                ))}
              </ProjectSection>

              {/* ── Section 2: On-going Projects (Steps 8–15) ── */}
              <ProjectSection
                id="section-ongoing"
                title="On-going Projects"
                status="ongoing"
                count={categorized.ongoing.length}
                filteredCount={filteredOngoing.length}
                subtitle="DoE Runs & Bayesian Loop · Steps 8–15"
                accentColor="#2563EB"
                badgeText="ON-GOING"
                searchActive={searchActive}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
                emptyStateMessage="No on-going projects currently."
              >
                {filteredOngoing.map(p => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onOpen={openProject}
                  />
                ))}
              </ProjectSection>

              {/* ── Section 3: Completed Projects (Steps 16–17) ── */}
              <ProjectSection
                id="section-completed"
                title="Completed Projects"
                status="completed"
                count={categorized.completed.length}
                filteredCount={filteredCompleted.length}
                subtitle="Optimum & Final Reports · Steps 16–17"
                accentColor="#10B981"
                badgeText="COMPLETED"
                searchActive={searchActive}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
                emptyStateMessage="No completed projects yet. Ongoing projects will appear here once finalized."
              >
                {filteredCompleted.map(p => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onOpen={openProject}
                  />
                ))}
              </ProjectSection>
            </>
          )}
        </div>

        {/* ── 17-Step Workflow Pipeline Diagram (Stage Categorized) ── */}
        <div style={{ marginTop: '2.5rem' }}>
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <div className="card-title" style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    17-Step QbD & DoE Workflow Architecture
                  </div>
                  <div className="card-sub" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Structured progress across the three operational stages
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span className="stage-badge bg-amber-50 text-amber-700 border-amber-200" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', fontWeight: 600 }}>Planning: Steps 1–7</span>
                  <span className="stage-badge bg-blue-50 text-blue-700 border-blue-200" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', fontWeight: 600 }}>On-going: Steps 8–15</span>
                  <span className="stage-badge bg-emerald-50 text-emerald-700 border-emerald-200" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', fontWeight: 600 }}>Completed: Steps 16–17</span>
                </div>
              </div>
            </div>

            {/* Stages Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '0.75rem' }}>
              {/* Stage 1: Planning Section */}
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, color: '#b45309', fontSize: '0.875rem', marginBottom: '0.65rem', paddingBottom: '0.45rem', borderBottom: '1px solid #fde68a' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>📋</span>
                    <span>Stage 1: Planning</span>
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.85, background: '#fef3c7', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    Steps 01–07
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem', color: '#92400e', lineHeight: 1.5 }}>
                  <div>01. Project Setup & API Details</div>
                  <div>02. QTPP Definition (Context-Aware Criteria)</div>
                  <div>03. Critical Quality Attributes (CQAs)</div>
                  <div>04. Synthetic Route & Unit Operations</div>
                  <div>05. Reverse Risk Assessment (FMEA / RPN)</div>
                  <div>06. Phase 0 Foundation Summary</div>
                  <div>07. Campaign Dashboard & Scoping</div>
                </div>
              </div>

              {/* Stage 2: On-going Section */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, color: '#1d4ed8', fontSize: '0.875rem', marginBottom: '0.65rem', paddingBottom: '0.45rem', borderBottom: '1px solid #bfdbfe' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>🧪</span>
                    <span>Stage 2: On-going</span>
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.85, background: '#dbeafe', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    Steps 08–15
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem', color: '#1e40af', lineHeight: 1.5 }}>
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

              {/* Stage 3: Completed Section */}
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700, color: '#047857', fontSize: '0.875rem', marginBottom: '0.65rem', paddingBottom: '0.45rem', borderBottom: '1px solid #a7f3d0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <span>✅</span>
                    <span>Stage 3: Completed</span>
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.85, background: '#d1fae5', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    Steps 16–17
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem', color: '#065f46', lineHeight: 1.5 }}>
                  <div>16. Final Optimum & Process Design Space</div>
                  <div>17. Comprehensive PDF / Excel Report</div>
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.45rem', borderTop: '1px dashed #a7f3d0', fontSize: '0.75rem', opacity: 0.9, fontStyle: 'italic', lineHeight: 1.45 }}>
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
