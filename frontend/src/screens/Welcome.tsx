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
  STAGE_META,
  formatDateDMY
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
  const [deleteMode, setDeleteMode] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedDeleteId, setSelectedDeleteId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteSearchQuery, setDeleteSearchQuery] = useState('')

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

  function openDeleteModal(projectId?: number) {
    setSelectedDeleteId(projectId ?? null)
    setDeleteSearchQuery('')
    setDeleteModalOpen(true)
  }

  async function handleConfirmDelete() {
    if (!selectedDeleteId) return
    const projToDelete = projects.find(p => p.id === selectedDeleteId)
    try {
      setIsDeleting(true)
      await Projects.delete(selectedDeleteId)
      setProjects(prev => {
        const remaining = prev.filter(p => p.id !== selectedDeleteId)
        if (remaining.length === 0) setDeleteMode(false)
        return remaining
      })
      const current = useStore.getState().currentProject
      if (current && current.id === selectedDeleteId) {
        setProject(null)
      }
      toast.success(`Project "${projToDelete?.name || ''}" deleted successfully`)
      setSelectedDeleteId(null)
      setDeleteModalOpen(false)
    } catch (err: any) {
      console.error('Failed to delete project:', err)
      toast.error(err?.response?.data?.detail || 'Failed to delete project')
    } finally {
      setIsDeleting(false)
    }
  }

  // Enrich projects with step and stage
  const enrichedProjects = useMemo(() => {
    return projects.map(p => {
      const stepNum = getStepNumber(p.current_step)
      const isFinished = p.status?.toLowerCase() === 'completed' || p.is_finished || false
      const stage = getProjectStage(stepNum, isFinished, p.status)

      return {
        ...p,
        _stepNum: stepNum,
        _stepLabel: getStepLabel(p.current_step),
        _stage: stage
      }
    })
  }, [projects])

  const selectedProjectDetails = useMemo(() => {
    if (!selectedDeleteId) return null
    return enrichedProjects.find(p => p.id === selectedDeleteId) || null
  }, [enrichedProjects, selectedDeleteId])

  // Categorize projects into Planning, On-going, and Completed
  const categorized = useMemo(() => {
    const planning: any[] = []
    const ongoing: any[] = []
    const completed: any[] = []

    enrichedProjects.forEach(p => {
      if (p._stage === 'planning') planning.push(p)
      else if (p._stage === 'ongoing') ongoing.push(p)
      else completed.push(p)
    })

    return { planning, ongoing, completed }
  }, [enrichedProjects])

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

            {/* Delete Project Action Toggle */}
            <button
              type="button"
              id="delete-project-btn"
              onClick={() => {
                const nextState = !deleteMode;
                setDeleteMode(nextState);
                if (nextState) {
                  toast('Delete option enabled. Click the 🗑️ icon on any project card to delete.', {
                    icon: '🗑️',
                    duration: 3500
                  });
                }
              }}
              title={deleteMode ? "Click to disable delete mode" : "Enable delete option to remove projects"}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.5rem 0.95rem',
                background: deleteMode ? '#dc2626' : '#ffffff',
                borderRadius: '999px',
                border: deleteMode ? '1px solid #b91c1c' : '1px solid #fca5a5',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: deleteMode ? '#ffffff' : '#dc2626',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                height: '38px',
                boxSizing: 'border-box',
                whiteSpace: 'nowrap',
                boxShadow: deleteMode ? '0 2px 8px rgba(220, 38, 38, 0.35)' : 'none'
              }}
              onMouseEnter={e => {
                if (!deleteMode) {
                  e.currentTarget.style.background = '#fef2f2';
                  e.currentTarget.style.borderColor = '#ef4444';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 2px 6px rgba(239, 68, 68, 0.15)';
                } else {
                  e.currentTarget.style.background = '#b91c1c';
                }
              }}
              onMouseLeave={e => {
                if (!deleteMode) {
                  e.currentTarget.style.background = '#ffffff';
                  e.currentTarget.style.borderColor = '#fca5a5';
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                } else {
                  e.currentTarget.style.background = '#dc2626';
                }
              }}
            >
              {deleteMode ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span>Exit Delete Mode</span>
                </>
              ) : (
                <>
                  <svg
                    width="15"
                    height="15"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                  <span>Delete Project</span>
                </>
              )}
            </button>

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

        {/* Delete Mode Active Banner */}
        {deleteMode && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 1.25rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.25rem',
              fontSize: '0.84rem',
              color: '#991b1b',
              animation: 'fadeIn 0.2s ease-in-out'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>🗑️</span>
              <span>
                <strong>Delete Option Enabled:</strong> Click the red trash icon on any project card to delete that project.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.65rem',
                borderColor: '#fca5a5',
                color: '#dc2626',
                background: '#ffffff'
              }}
              onClick={() => setDeleteMode(false)}
            >
              Done Deleting ✕
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
                    deleteEnabled={deleteMode}
                    onDelete={(_e, id) => openDeleteModal(id)}
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
                    deleteEnabled={deleteMode}
                    onDelete={(_e, id) => openDeleteModal(id)}
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
                    deleteEnabled={deleteMode}
                    onDelete={(_e, id) => openDeleteModal(id)}
                  />
                ))}
              </ProjectSection>
            </>
          )}
        </div>
      </main>

      {/* ── Delete Project Modal ── */}
      {deleteModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem'
          }}
          onClick={e => {
            if (e.target === e.currentTarget && !isDeleting) {
              setDeleteModalOpen(false)
              setSelectedDeleteId(null)
            }
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '580px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '1.75rem',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1.25rem',
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '1rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '10px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#dc2626'
                  }}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                    Delete Project
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                    Select a QbD campaign to permanently remove from the platform
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (!isDeleting) {
                    setDeleteModalOpen(false)
                    setSelectedDeleteId(null)
                  }
                }}
                disabled={isDeleting}
                style={{
                  borderRadius: '999px',
                  width: '32px',
                  height: '32px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid #cbd5e1'
                }}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            {projects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📂</div>
                <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '0.25rem' }}>No projects available</div>
                <div style={{ fontSize: '0.84rem' }}>There are currently no active projects created in the system.</div>
              </div>
            ) : (
              <div>
                {/* Project Selection Dropdown */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label
                    htmlFor="delete-project-select"
                    style={{
                      display: 'block',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      color: '#334155',
                      marginBottom: '0.45rem'
                    }}
                  >
                    Select Project to Delete
                  </label>
                  <select
                    id="delete-project-select"
                    className="form-select"
                    value={selectedDeleteId ?? ''}
                    onChange={e => setSelectedDeleteId(e.target.value ? Number(e.target.value) : null)}
                    disabled={isDeleting}
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.85rem',
                      borderRadius: '8px',
                      border: selectedDeleteId ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                      background: '#fff',
                      fontSize: '0.88rem',
                      color: '#0f172a',
                      fontWeight: 500
                    }}
                  >
                    <option value="">-- Choose a project ({projects.length} available) --</option>
                    {enrichedProjects.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.compound ? `(API: ${p.compound})` : ''} — Stage: {p._stage?.toUpperCase() || 'PLANNING'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* If a project is selected: Show Preview Details & Irreversible Warning */}
                {selectedProjectDetails ? (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '1.15rem',
                      marginBottom: '1.25rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', wordBreak: 'break-word' }}>
                          {selectedProjectDetails.name}
                        </div>
                        {selectedProjectDetails.compound && (
                          <div style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 600, marginTop: '2px' }}>
                            API / Compound: <strong>{selectedProjectDetails.compound}</strong>
                          </div>
                        )}
                      </div>
                      <span
                        className="stage-badge"
                        style={{
                          backgroundColor: STAGE_META[selectedProjectDetails._stage as ProjectStage]?.bgLight || '#f1f5f9',
                          color: STAGE_META[selectedProjectDetails._stage as ProjectStage]?.textColor || '#334155',
                          border: `1px solid ${STAGE_META[selectedProjectDetails._stage as ProjectStage]?.borderColor || '#cbd5e1'}`,
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.5rem',
                          fontWeight: 700,
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}
                      >
                        {selectedProjectDetails._stage}
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '0.75rem',
                        padding: '0.75rem',
                        background: '#ffffff',
                        borderRadius: '6px',
                        border: '1px solid #f1f5f9',
                        fontSize: '0.78rem',
                        color: '#64748b'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: '#334155' }}>Workflow Step</div>
                        <div>Step {selectedProjectDetails._stepNum} of 17</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#334155' }}>Experiments</div>
                        <div>{(Array.isArray(selectedProjectDetails.experiments) ? selectedProjectDetails.experiments.length : selectedProjectDetails.experiment_count) || 0} runs</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#334155' }}>Last Updated</div>
                        <div>{formatDateDMY(selectedProjectDetails.updated_at || selectedProjectDetails.created_at)}</div>
                      </div>
                    </div>

                    {/* Warning Callout */}
                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '0.85rem 1rem',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        display: 'flex',
                        gap: '0.65rem',
                        alignItems: 'flex-start'
                      }}
                    >
                      <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>⚠️</span>
                      <div style={{ fontSize: '0.8rem', color: '#991b1b', lineHeight: 1.45 }}>
                        <strong>Action cannot be undone:</strong> Deleting this project will permanently erase all associated experimental runs, Bayesian model iterations, factor matrices, and audit logs.
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Quick selection list when no project chosen yet */
                  <div style={{ marginBottom: '1.25rem' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.5rem'
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>
                        Or pick from projects ({projects.length}):
                      </span>
                      {projects.length > 4 && (
                        <input
                          type="text"
                          placeholder="Quick filter..."
                          value={deleteSearchQuery}
                          onChange={e => setDeleteSearchQuery(e.target.value)}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #cbd5e1',
                            width: '130px'
                          }}
                        />
                      )}
                    </div>
                    <div
                      style={{
                        maxHeight: '220px',
                        overflowY: 'auto',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        background: '#f8fafc'
                      }}
                    >
                      {enrichedProjects
                        .filter(p => !deleteSearchQuery || p.name?.toLowerCase().includes(deleteSearchQuery.toLowerCase()) || p.compound?.toLowerCase().includes(deleteSearchQuery.toLowerCase()))
                        .map(p => (
                          <div
                            key={p.id}
                            onClick={() => setSelectedDeleteId(p.id)}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.6rem 0.85rem',
                              borderBottom: '1px solid #e2e8f0',
                              cursor: 'pointer',
                              background: '#fff',
                              transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                          >
                            <div style={{ overflow: 'hidden', paddingRight: '0.5rem' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {p.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {p.compound ? `API: ${p.compound}` : 'Standard QbD'} · Step {p._stepNum} of 17
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.25rem 0.6rem',
                                color: '#dc2626',
                                borderColor: '#fca5a5',
                                flexShrink: 0
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDeleteId(p.id);
                              }}
                            >
                              Select 🗑️
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Modal Footer Buttons */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '0.75rem',
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '1rem'
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (!isDeleting) {
                        setDeleteModalOpen(false)
                        setSelectedDeleteId(null)
                      }
                    }}
                    disabled={isDeleting}
                    style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    id="confirm-delete-project-btn"
                    className="btn btn-danger"
                    onClick={handleConfirmDelete}
                    disabled={!selectedDeleteId || isDeleting}
                    style={{
                      padding: '0.55rem 1.25rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      background: selectedDeleteId ? '#dc2626' : '#f87171',
                      color: '#ffffff',
                      border: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      cursor: selectedDeleteId && !isDeleting ? 'pointer' : 'not-allowed',
                      opacity: selectedDeleteId ? 1 : 0.6
                    }}
                  >
                    {isDeleting ? (
                      <>
                        <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                        <span>Confirm & Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
