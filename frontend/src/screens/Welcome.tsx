// src/screens/Welcome.tsx  –  Project Dashboard & Main Landing
import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../store/useStore'
import { useAuth } from '../context/AuthContext'
import { Projects } from '../services/api'
import toast from 'react-hot-toast'
import logo from '../assets/logo.png'
import {
  ProjectStage,
  getProjectStage,
  getStepNumber,
  getStepLabel,
  STAGE_META,
  formatDateDMY,
  normalizeProductGroup
} from '../utils/projectUtils'
import {
  ProjectSection,
  ProjectCard
} from '../components/dashboard'

// LocalStorage key for storing user expanded/collapsed product sections
const PRODUCT_SECTIONS_STORAGE_KEY = 'doe_product_sections_collapsed'

export default function Welcome() {
  const { setProject, setStep, setCreationProductContext, isEditMode, setEditMode } = useStore()
  const { user, logout } = useAuth()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteMode, setDeleteMode] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedDeleteId, setSelectedDeleteId] = useState<number | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteSearchQuery, setDeleteSearchQuery] = useState('')

  // Edit Product Name Modal State
  const [editProductModalOpen, setEditProductModalOpen] = useState(false)
  const [editingProductGroup, setEditingProductGroup] = useState<{ key: string; displayName: string; projects: any[] } | null>(null)
  const [editProductNameValue, setEditProductNameValue] = useState('')
  const [isUpdatingProductName, setIsUpdatingProductName] = useState(false)

  // Safety: Edit mode always defaults to OFF on page load
  useEffect(() => {
    setEditMode(false)
  }, [setEditMode])

  // Safety: If Edit mode turns OFF while delete flow or modal is active, cancel it immediately
  useEffect(() => {
    if (!isEditMode) {
      if (deleteMode) setDeleteMode(false)
      if (deleteModalOpen) setDeleteModalOpen(false)
      if (selectedDeleteId) setSelectedDeleteId(null)
      if (deleteSearchQuery) setDeleteSearchQuery('')
      if (editProductModalOpen) {
        setEditProductModalOpen(false)
        setEditingProductGroup(null)
        setEditProductNameValue('')
      }
    }
  }, [isEditMode, deleteMode, deleteModalOpen, selectedDeleteId, deleteSearchQuery, editProductModalOpen])

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

  function openEditProductModal(group: { key: string; displayName: string; projects: any[] }) {
    setEditingProductGroup(group)
    setEditProductNameValue(group.displayName)
    setEditProductModalOpen(true)
  }

  async function handleConfirmRenameProduct() {
    if (!editingProductGroup || !editProductNameValue.trim()) return
    const newName = editProductNameValue.trim()
    if (newName === editingProductGroup.displayName) {
      setEditProductModalOpen(false)
      setEditingProductGroup(null)
      return
    }

    try {
      setIsUpdatingProductName(true)
      // Update each project's compound field in this product group
      const updatePromises = editingProductGroup.projects.map(p =>
        Projects.update(p.id, { compound: newName })
      )
      await Promise.all(updatePromises)

      // Update local projects list
      setProjects(prev =>
        prev.map(p => {
          if (editingProductGroup.projects.some(gp => gp.id === p.id)) {
            return { ...p, compound: newName }
          }
          return p
        })
      )

      // Update currentProject in store if currently loaded
      const current = useStore.getState().currentProject
      if (current && editingProductGroup.projects.some(gp => gp.id === current.id)) {
        setProject({ ...current, compound: newName })
      }

      toast.success(`Product renamed to "${newName}" across ${editingProductGroup.projects.length} project${editingProductGroup.projects.length === 1 ? '' : 's'}`)
      setEditProductModalOpen(false)
      setEditingProductGroup(null)
      setEditProductNameValue('')
    } catch (err: any) {
      console.error('Failed to rename product:', err)
      toast.error(err?.response?.data?.detail || 'Failed to rename product')
    } finally {
      setIsUpdatingProductName(false)
    }
  }

  // Collapsed state map keyed by product group key
  const [collapsedProducts, setCollapsedProducts] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(PRODUCT_SECTIONS_STORAGE_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  const toggleProductCollapse = (groupKey: string) => {
    setCollapsedProducts(prev => {
      const next = { ...prev, [groupKey]: !prev[groupKey] }
      try {
        localStorage.setItem(PRODUCT_SECTIONS_STORAGE_KEY, JSON.stringify(next))
      } catch {}
      return next
    })
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

  // Helper for sorting cards inside each product:
  // Stage (Planning -> On-going -> Completed), then updated_at (newest first)
  const stageSortOrder: Record<ProjectStage, number> = {
    planning: 1,
    ongoing: 2,
    completed: 3
  }

  const sortCardsWithinProduct = (cards: any[]) => {
    return [...cards].sort((a, b) => {
      const stageA = stageSortOrder[a._stage as ProjectStage] || 99
      const stageB = stageSortOrder[b._stage as ProjectStage] || 99
      if (stageA !== stageB) return stageA - stageB

      const timeA = new Date(a.updated_at || a.created_at || 0).getTime()
      const timeB = new Date(b.updated_at || b.created_at || 0).getTime()
      return timeB - timeA
    })
  }

  // Group enriched projects by product (API / Compound)
  const productGroups = useMemo(() => {
    const groupsMap = new Map<string, {
      key: string;
      displayName: string;
      allProjects: any[];
      latestUpdated: number;
    }>()

    enrichedProjects.forEach(p => {
      const { key, displayName } = normalizeProductGroup(p.compound)
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          key,
          displayName,
          allProjects: [],
          latestUpdated: 0
        })
      }
      const grp = groupsMap.get(key)!
      grp.allProjects.push(p)

      const pTime = new Date(p.updated_at || p.created_at || 0).getTime()
      if (pTime > grp.latestUpdated) {
        grp.latestUpdated = pTime
      }
    })

    // Sort products by most recently updated project, newest first.
    // "__unassigned__" (Other / Unassigned) always lands at the bottom.
    const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => {
      if (a.key === '__unassigned__') return 1
      if (b.key === '__unassigned__') return -1
      return b.latestUpdated - a.latestUpdated
    })

    return sortedGroups.map(grp => {
      const sortedProjects = sortCardsWithinProduct(grp.allProjects)

      // Count stages for subtitle summary
      let planningCount = 0
      let ongoingCount = 0
      let completedCount = 0
      sortedProjects.forEach(p => {
        if (p._stage === 'planning') planningCount++
        else if (p._stage === 'ongoing') ongoingCount++
        else if (p._stage === 'completed') completedCount++
      })

      const stageParts: string[] = []
      if (planningCount > 0) stageParts.push(`${planningCount} Planning`)
      if (ongoingCount > 0) stageParts.push(`${ongoingCount} On-going`)
      if (completedCount > 0) stageParts.push(`${completedCount} Completed`)

      const totalCount = sortedProjects.length
      const subtitle = `${totalCount} ${totalCount === 1 ? 'project' : 'projects'}${stageParts.length > 0 ? ` · ${stageParts.join(' · ')}` : ''}`

      return {
        ...grp,
        projects: sortedProjects,
        subtitle
      }
    })
  }, [enrichedProjects])

  // Search filter applied in real-time across cards
  const filterCards = (list: any[]) => {
    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    return list.filter(p =>
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.compound && p.compound.toLowerCase().includes(q)) ||
      (p.objective && p.objective.toLowerCase().includes(q)) ||
      (p.doe_type && p.doe_type.toLowerCase().includes(q))
    )
  }

  // Filtered product groups: hides sections with 0 matching cards during active search
  const filteredProductGroups = useMemo(() => {
    if (!searchQuery.trim()) {
      return productGroups.map(g => ({
        ...g,
        filteredProjects: g.projects
      }))
    }

    return productGroups
      .map(g => {
        const matching = filterCards(g.projects)
        return {
          ...g,
          filteredProjects: matching
        }
      })
      .filter(g => g.filteredProjects.length > 0)
  }, [productGroups, searchQuery])

  const totalMatches = useMemo(() => {
    return filteredProductGroups.reduce((acc, g) => acc + g.filteredProjects.length, 0)
  }, [filteredProductGroups])

  const searchActive = Boolean(searchQuery.trim())

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── 1. Top-Bar Navigation ── */}
      <header className="landing-top-bar">
        <div className="landing-nav-container">
          {/* Top-Left: Inline Brand Logo & Typography and R&D Head User Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
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

            {/* User Profile Pill moved to top-left */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.35rem 0.85rem',
                background: 'rgba(0, 91, 170, 0.08)',
                borderRadius: '999px',
                border: '1px solid var(--border)',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap'
              }}
              title={user ? `Signed in as ${user.username}` : undefined}
            >
              <span style={{ fontSize: '0.95rem' }}>👤</span>
              <span>R&D Head</span>
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

            {/* Delete Project Action Toggle (Only visible when Edit mode is ON) */}
            {isEditMode && (
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
                  boxShadow: deleteMode ? '0 2px 8px rgba(220, 38, 38, 0.35)' : 'none',
                  animation: 'fadeIn 0.15s ease'
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
            )}

            {/* Edit Mode Toggle Button */}
            <button
              type="button"
              className={`btn ${isEditMode ? 'btn-primary' : 'btn-secondary'}`}
              aria-pressed={isEditMode}
              aria-label={isEditMode ? 'Exit Edit Mode' : 'Enable Edit Mode'}
              title={isEditMode ? 'Turn off Edit mode' : 'Turn on Edit mode to add products and projects'}
              onClick={() => setEditMode(!isEditMode)}
              style={{
                padding: '0.6rem 1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                gap: '0.45rem',
                backgroundColor: isEditMode ? 'var(--primary)' : '#ffffff',
                borderColor: isEditMode ? 'var(--primary)' : 'var(--border)',
                color: isEditMode ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: isEditMode ? '0 2px 8px rgba(0, 91, 170, 0.25)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {isEditMode ? (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>Editing</span>
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <span>Edit</span>
                </>
              )}
            </button>

            {/* Primary Action Button: New Product (Only visible when Edit mode is ON) */}
            {isEditMode && (
              <button
                className="btn btn-primary"
                style={{
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.9rem',
                  gap: '0.45rem',
                  fontWeight: 700,
                  animation: 'fadeIn 0.15s ease'
                }}
                onClick={() => {
                  setCreationProductContext(null)
                  setProject(null)
                  setStep('create-project')
                }}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Product
              </button>
            )}

            {/* Logout Button */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={logout}
              title="Log out and return to login page"
              aria-label="Log out"
              style={{
                padding: '0.6rem 0.95rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                gap: '0.4rem',
                color: '#64748b',
                borderColor: 'var(--border)'
              }}
            >
              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Landing Body ── */}
      <main style={{ flex: 1, width: '100%', padding: '1.5rem 2.5rem 2.5rem 2.5rem' }}>
        {/* Edit Mode Active Banner / Indicator */}
        {isEditMode && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.65rem 1.25rem',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '1.25rem',
              fontSize: '0.84rem',
              color: '#1e40af',
              animation: 'fadeIn 0.15s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>✏️</span>
              <span>
                <strong>Edit Mode Active:</strong> You can add new products via the top bar or add new projects directly inside any product section.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.65rem',
                borderColor: '#93c5fd',
                color: '#005baa',
                background: '#ffffff'
              }}
              onClick={() => setEditMode(false)}
            >
              Done Editing ✕
            </button>
          </div>
        )}


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
                {isEditMode ? (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setCreationProductContext(null)
                      setProject(null)
                      setStep('create-project')
                    }}
                  >
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New Product
                  </button>
                ) : (
                  <button
                    className="btn btn-primary"
                    onClick={() => setEditMode(true)}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Enable Edit Mode to Add Product
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* ── Product Sections (Grouped by API / Compound) ── */}
              {filteredProductGroups.map(group => {
                // Find canonical full compound string from projects or group name
                const fullCompound = group.projects.find(p => p.compound && p.compound.trim())?.compound || (group.key === '__unassigned__' ? '' : group.displayName)
                const isUnassigned = group.key === '__unassigned__'

                return (
                  <ProjectSection
                    key={group.key}
                    id={`section-product-${group.key}`}
                    title={group.displayName}
                    count={group.projects.length}
                    filteredCount={group.filteredProjects.length}
                    subtitle={group.subtitle}
                    accentColor="#005baa"
                    badgeText="PRODUCT"
                    isCollapsed={collapsedProducts[group.key] ?? false}
                    onToggleCollapse={() => toggleProductCollapse(group.key)}
                    searchActive={searchActive}
                    searchQuery={searchQuery}
                    onClearSearch={() => setSearchQuery('')}
                    emptyStateMessage={`No projects under ${group.displayName} currently.`}
                    isEditMode={isEditMode}
                    onEditProductName={isUnassigned ? undefined : () => openEditProductModal(group)}
                    onNewProject={() => {
                      setCreationProductContext({
                        productName: isUnassigned ? '' : group.displayName,
                        fullCompound: isUnassigned ? '' : fullCompound,
                        isLocked: !isUnassigned
                      })
                      setProject(null)
                      setStep('create-project')
                    }}
                  >
                    {group.filteredProjects.map(p => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        onOpen={openProject}
                        deleteEnabled={deleteMode}
                        onDelete={(_e, id) => openDeleteModal(id)}
                      />
                    ))}
                  </ProjectSection>
                )
              })}
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

      {/* ── Edit Product Name Modal ── */}
      {editProductModalOpen && editingProductGroup && (
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
            if (e.target === e.currentTarget && !isUpdatingProductName) {
              setEditProductModalOpen(false)
              setEditingProductGroup(null)
            }
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
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
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#005baa'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>
                    Edit Product Name
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                    Updating will rename the compound across all {editingProductGroup.projects.length} linked project{editingProductGroup.projects.length === 1 ? '' : 's'}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (!isUpdatingProductName) {
                    setEditProductModalOpen(false)
                    setEditingProductGroup(null)
                  }
                }}
                disabled={isUpdatingProductName}
                style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={e => {
                e.preventDefault()
                handleConfirmRenameProduct()
              }}
            >
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: '0.45rem' }}>
                  Product (API / Compound) Name *
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={editProductNameValue}
                  onChange={e => setEditProductNameValue(e.target.value)}
                  placeholder="e.g. Propofol, Loxoprofen, BXP-001"
                  autoFocus
                  disabled={isUpdatingProductName}
                  style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.9rem' }}
                />
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.74rem', color: '#64748b' }}>
                  Current: <strong>{editingProductGroup.displayName}</strong>
                </p>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    if (!isUpdatingProductName) {
                      setEditProductModalOpen(false)
                      setEditingProductGroup(null)
                    }
                  }}
                  disabled={isUpdatingProductName}
                  style={{ padding: '0.55rem 1.1rem', fontSize: '0.85rem' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!editProductNameValue.trim() || isUpdatingProductName}
                  style={{
                    padding: '0.55rem 1.25rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem'
                  }}
                >
                  {isUpdatingProductName ? (
                    <>
                      <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
