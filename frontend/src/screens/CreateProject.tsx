// src/screens/CreateProject.tsx – Step 01: Project Setup
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { ClipboardList, Info, AlertTriangle, PlusCircle } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Projects } from '../services/api'
import { extractTargetsFromDescription } from '../utils/targetParser'
import toast from 'react-hot-toast'
import ProjectTemplateModal, { TabKey } from '../components/ProjectTemplateModal'
import {
  FieldKey,
  DESCRIPTION_SECTIONS
} from '../data/projectTemplates'

export default function CreateProject() {
  const { currentProject, setProject, setStep, setApiTargets } = useStore()
  const [form, setForm] = useState({
    name:        currentProject?.name        || '',
    compound:    currentProject?.compound    || '',
    objective:   currentProject?.objective   || '',
    description: currentProject?.description || '',
  })

  const [saving, setSaving] = useState(false)

  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templateModalTab, setTemplateModalTab] = useState<TabKey>('description')
  const templateTriggerRef = useRef<HTMLElement | null>(null)

  // Refs for focusing fields after inserting
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const compoundInputRef = useRef<HTMLInputElement | null>(null)
  const objectiveInputRef = useRef<HTMLInputElement | null>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    setForm({
      name:        currentProject?.name        || '',
      compound:    currentProject?.compound    || '',
      objective:   currentProject?.objective   || '',
      description: currentProject?.description || '',
    })
  }, [currentProject?.id])

  function set(key: string, val: string) {
    setForm(f => {
      const next = { ...f, [key]: val }

      // Synchronize in-memory targets from description so other steps have real-time targets
      if (currentProject) {
        const parsedTargets = extractTargetsFromDescription(
          key === 'description' ? val : next.description,
          key === 'objective' ? val : next.objective,
          key === 'compound' ? val : next.compound
        )
        setProject({ ...currentProject, ...next, api_targets: parsedTargets })
        setApiTargets(parsedTargets)
      }
      return next
    })
  }

  // Open Template Modal targeted to a specific field tab
  const handleOpenTemplateModal = (tab: TabKey, triggerEl?: HTMLElement | null) => {
    setTemplateModalTab(tab)
    if (triggerEl) {
      templateTriggerRef.current = triggerEl
    }
    setIsTemplateModalOpen(true)
  }

  // Insert Template or Example into target field with replace/append
  const handleInsert = (fieldKey: FieldKey, text: string, mode: 'replace' | 'append') => {
    const fieldMap: Record<FieldKey, { stateKey: string; ref: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null> }> = {
      projectName: { stateKey: 'name', ref: nameInputRef },
      compound:    { stateKey: 'compound', ref: compoundInputRef },
      objective:   { stateKey: 'objective', ref: objectiveInputRef },
      description: { stateKey: 'description', ref: descriptionInputRef }
    }

    const { stateKey, ref } = fieldMap[fieldKey]
    const currentVal = (form as any)[stateKey] || ''

    let nextVal = text
    if (mode === 'append' && currentVal.trim()) {
      nextVal = `${currentVal.trim()}\n\n${text}`
    }

    set(stateKey, nextVal)

    // Focus target element and highlight first [PLACEHOLDER] if present
    setTimeout(() => {
      const el = ref.current
      if (el) {
        el.focus()
        const firstBracket = nextVal.indexOf('[')
        const closingBracket = nextVal.indexOf(']')
        if (firstBracket !== -1 && closingBracket > firstBracket) {
          el.setSelectionRange(firstBracket, closingBracket + 1)
        }
      }
    }, 100)
  }

  // Check if target field has non-empty content
  const fieldHasContent = (fieldKey: FieldKey): boolean => {
    if (fieldKey === 'projectName') return !!form.name.trim()
    if (fieldKey === 'compound') return !!form.compound.trim()
    if (fieldKey === 'objective') return !!form.objective.trim()
    if (fieldKey === 'description') return !!form.description.trim()
    return false
  }

  // Unfilled bracket warning detection: checks if any field still has [ ... ]
  const unfilledPlaceholderWarnings = useMemo(() => {
    const placeholderRegex = /\[[^\]]+\]/
    const warnings: string[] = []
    if (placeholderRegex.test(form.name)) warnings.push('Project Name')
    if (placeholderRegex.test(form.compound)) warnings.push('Compound / API')
    if (placeholderRegex.test(form.objective)) warnings.push('Primary Objective')
    if (placeholderRegex.test(form.description)) warnings.push('Project Description')
    return warnings
  }, [form.name, form.compound, form.objective, form.description])

  // Live "Description Completeness" calculation for the 8 section headers
  const descriptionCompleteness = useMemo(() => {
    const text = form.description || ''
    const textLower = text.toLowerCase()

    const detected = DESCRIPTION_SECTIONS.filter(header => {
      const headerLower = header.toLowerCase()
      const idx = textLower.indexOf(headerLower)
      if (idx === -1) return false
      // Check if there is some non-empty text after the header before the next header or end
      const after = text.slice(idx + header.length).trim()
      return after.length > 0 && !after.startsWith('[')
    })

    const missing = DESCRIPTION_SECTIONS.filter(h => !detected.includes(h))

    return {
      filledCount: detected.length,
      totalCount: DESCRIPTION_SECTIONS.length,
      percentage: Math.round((detected.length / DESCRIPTION_SECTIONS.length) * 100),
      missing
    }
  }, [form.description])

  // Append a missing section header to the description
  const handleAppendMissingSection = (header: string) => {
    const cur = form.description.trim()
    const addition = `${header}\n`
    const nextDesc = cur ? `${cur}\n\n${addition}` : addition
    set('description', nextDesc)
    setTimeout(() => {
      if (descriptionInputRef.current) {
        descriptionInputRef.current.focus()
        descriptionInputRef.current.setSelectionRange(nextDesc.length, nextDesc.length)
      }
    }, 50)
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Project name is required'); return }
    setSaving(true)
    try {
      // Automatically extract structured process targets directly from Project Description
      const extractedTargets = extractTargetsFromDescription(form.description, form.objective, form.compound)

      const payload = {
        ...form,
        api_targets: extractedTargets,
        current_step: 'qtpp'
      }

      let proj
      if (currentProject?.id) {
        proj = await Projects.update(currentProject.id, payload)
      } else {
        proj = await Projects.create(payload)
      }

      setProject({ ...proj, api_targets: extractedTargets })
      setApiTargets(extractedTargets)
      toast.success(currentProject?.id ? 'Project updated!' : 'Project created!')
      setStep('qtpp')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {/* Page Header with Top-Right "📋 Templates" Button */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Create Project</h1>
          <p className="page-desc">Create the project and enter the API, goal, and process details.</p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={(e) => handleOpenTemplateModal('description', e.currentTarget)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontWeight: 600,
            fontSize: '0.85rem',
            padding: '0.5rem 0.9rem'
          }}
          title="Open Project Input Templates and Examples"
        >
          <ClipboardList size={16} style={{ color: 'var(--primary)' }} />
          <span>📋 Templates</span>
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Project Name */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Project Name *</label>
              <button
                type="button"
                onClick={(e) => handleOpenTemplateModal('projectName', e.currentTarget)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: 0
                }}
                title="View Project Name template and example"
              >
                <Info size={13} />
                <span>ⓘ Template</span>
              </button>
            </div>
            <input
              ref={nameInputRef}
              className="form-input"
              placeholder="e.g. LXP-Stage-1 Crystallization Optimization"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          {/* Compound / API and Primary Objective */}
          <div className="grid-2">
            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Compound / API</label>
                <button
                  type="button"
                  onClick={(e) => handleOpenTemplateModal('compound', e.currentTarget)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: 0
                  }}
                  title="View Compound / API template and example"
                >
                  <Info size={13} />
                  <span>ⓘ Template</span>
                </button>
              </div>
              <input
                ref={compoundInputRef}
                className="form-input"
                placeholder="e.g. Propofol or LXP-001"
                value={form.compound}
                onChange={e => set('compound', e.target.value)}
              />
            </div>

            <div className="form-group">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <label className="form-label" style={{ margin: 0 }}>Primary Objective</label>
                <button
                  type="button"
                  onClick={(e) => handleOpenTemplateModal('objective', e.currentTarget)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--primary)',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    padding: 0
                  }}
                  title="View Primary Objective template and example"
                >
                  <Info size={13} />
                  <span>ⓘ Template</span>
                </button>
              </div>
              <input
                ref={objectiveInputRef}
                className="form-input"
                placeholder="e.g. Maximize yield, minimize impurities"
                value={form.objective}
                onChange={e => set('objective', e.target.value)}
              />
            </div>
          </div>

          {/* Project Description */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <label className="form-label" style={{ margin: 0 }}>Project Description</label>
              <button
                type="button"
                onClick={(e) => handleOpenTemplateModal('description', e.currentTarget)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: 0
                }}
                title="View full structured Project Description template"
              >
                <Info size={13} />
                <span>ⓘ Template</span>
              </button>
            </div>
            <textarea
              ref={descriptionInputRef}
              className="form-textarea"
              rows={8}
              style={{ minHeight: '180px', resize: 'vertical', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.825rem' }}
              placeholder="Describe the process, background, target quality criteria (e.g. assay/purity specifications, impurity limits, reaction yield), and known constraints…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />

            {/* Description Completeness Indicator */}
            <div
              style={{
                marginTop: '0.65rem',
                background: '#f8fafc',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Description Completeness: <strong>{descriptionCompleteness.filledCount} of {descriptionCompleteness.totalCount} sections filled</strong>
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: descriptionCompleteness.percentage >= 75 ? 'var(--success)' : 'var(--primary)' }}>
                  {descriptionCompleteness.percentage}%
                </span>
              </div>

              {/* Thin Progress Bar */}
              <div style={{ width: '100%', height: '5px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${descriptionCompleteness.percentage}%`,
                    height: '100%',
                    background: descriptionCompleteness.percentage >= 75 ? '#10b981' : 'linear-gradient(90deg, #005baa, #00aeb3)',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>

              {/* Missing Section Chips */}
              {descriptionCompleteness.missing.length > 0 && (
                <div style={{ marginTop: '0.55rem', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>+ Add missing:</span>
                  {descriptionCompleteness.missing.map((missingHeader) => (
                    <button
                      key={missingHeader}
                      type="button"
                      onClick={() => handleAppendMissingSection(missingHeader)}
                      style={{
                        background: '#ffffff',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '4px',
                        padding: '1px 6px',
                        fontSize: '0.68rem',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--primary)'
                        e.currentTarget.style.color = 'var(--primary)'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '#cbd5e1'
                        e.currentTarget.style.color = 'var(--text-secondary)'
                      }}
                      title={`Append "${missingHeader}" to description`}
                    >
                      <PlusCircle size={10} />
                      <span>{missingHeader.replace(':', '')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Soft warning for unreplaced [BRACKET] placeholders */}
        {unfilledPlaceholderWarnings.length > 0 && (
          <div
            style={{
              marginTop: '1.25rem',
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '6px',
              padding: '0.5rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.78rem',
              color: '#92400e'
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0, color: '#d97706' }} />
            <span>
              Some bracketed placeholders (e.g. <code>[PLACEHOLDER]</code>) are still unfilled in:{' '}
              <strong>{unfilledPlaceholderWarnings.join(', ')}</strong>. You can still proceed, but replacing them gives better QbD derivation.
            </span>
          </div>
        )}

        {/* Step Navigation */}
        <div className="step-nav" style={{ marginTop: '1.75rem' }}>
          <button className="btn btn-secondary" onClick={() => setStep('welcome')}>← Back</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" />Saving…</> : 'Save & Continue →'}
          </button>
        </div>
      </div>

      {/* Reusable Template Modal */}
      <ProjectTemplateModal
        isOpen={isTemplateModalOpen}
        initialTab={templateModalTab}
        onClose={() => setIsTemplateModalOpen(false)}
        onInsert={handleInsert}
        fieldHasContent={fieldHasContent}
        triggerRef={templateTriggerRef}
      />
    </div>
  )
}
