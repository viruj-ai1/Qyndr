// src/screens/CreateProject.tsx – Step 01: Project Setup
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Info, AlertTriangle } from 'lucide-react'
import { useStore } from '../store/useStore'
import { Projects } from '../services/api'
import { extractTargetsFromDescription } from '../utils/targetParser'
import toast from 'react-hot-toast'
import ProjectTemplateModal, { TabKey } from '../components/ProjectTemplateModal'
import {
  FieldKey,
  deduplicateDescriptionSections
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

  // Refs for focusing fields
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const compoundInputRef = useRef<HTMLInputElement | null>(null)
  const objectiveInputRef = useRef<HTMLInputElement | null>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const rawDesc = currentProject?.description || ''
    const cleanDesc = deduplicateDescriptionSections(rawDesc)
    if (cleanDesc !== rawDesc && currentProject) {
      setProject({ ...currentProject, description: cleanDesc })
    }
    setForm({
      name:        currentProject?.name        || '',
      compound:    currentProject?.compound    || '',
      objective:   currentProject?.objective   || '',
      description: cleanDesc,
    })
  }, [currentProject?.id])

  // Clean up any duplicate section headers on initial load
  useEffect(() => {
    if (form.description) {
      const clean = deduplicateDescriptionSections(form.description)
      if (clean !== form.description) {
        set('description', clean)
      }
    }
  }, [])

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

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Project name is required'); return }
    setSaving(true)
    try {
      // Automatically extract structured process targets directly from Project Description
      const cleanDesc = deduplicateDescriptionSections(form.description)
      const extractedTargets = extractTargetsFromDescription(cleanDesc, form.objective, form.compound)

      const payload = {
        ...form,
        description: cleanDesc,
        api_targets: extractedTargets,
        current_step: 'qtpp'
      }

      let proj
      if (currentProject?.id) {
        try {
          proj = await Projects.update(currentProject.id, payload)
        } catch (updateErr: any) {
          // If project was deleted or not found on server, seamlessly create fresh project
          if (updateErr?.response?.status === 404) {
            proj = await Projects.create(payload)
          } else {
            throw updateErr
          }
        }
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
      {/* Page Header with Top-Right Templates Button */}
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
          title="Open Project Input Reference Guide"
        >
          <Info size={15} style={{ color: 'var(--primary)' }} />
          <span>Reference Guide</span>
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Project Name */}
          <div className="form-group">
            <label className="form-label">Project Name *</label>
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
              <label className="form-label">Compound / API</label>
              <input
                ref={compoundInputRef}
                className="form-input"
                placeholder="e.g. Propofol or LXP-001"
                value={form.compound}
                onChange={e => set('compound', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Primary Objective</label>
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
            <label className="form-label">Project Description</label>
            <textarea
              ref={descriptionInputRef}
              className="form-textarea"
              rows={8}
              style={{
                minHeight: '180px',
                resize: 'vertical',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: '0.825rem',
                transition: 'all 0.3s ease'
              }}
              placeholder="Describe the process, background, target quality criteria (e.g. assay/purity specifications, impurity limits, reaction yield), and known constraints…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              onBlur={() => {
                const clean = deduplicateDescriptionSections(form.description)
                if (clean !== form.description) {
                  set('description', clean)
                }
              }}
            />
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
              <strong>{unfilledPlaceholderWarnings.join(', ')}</strong>. Replacing them with your specific experimental details gives more accurate downstream QbD derivation.
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

      {/* Reference Guide Modal */}
      <ProjectTemplateModal
        isOpen={isTemplateModalOpen}
        initialTab={templateModalTab}
        onClose={() => setIsTemplateModalOpen(false)}
        fieldHasContent={fieldHasContent}
        triggerRef={templateTriggerRef}
      />
    </div>
  )
}
