// src/screens/CreateProject.tsx – Step 01: Project Setup & QTPP
import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Info, AlertTriangle, Trash2, Plus, Edit, Lock } from 'lucide-react'
import { useStore, QTPPItem, AcceptanceCriterion } from '../store/useStore'
import { Projects, WorkflowApi } from '../services/api'
import { extractTargetsFromDescription } from '../utils/targetParser'
import { CriterionInput } from '../components/CriterionInput'
import {
  parseLegacyCriterion,
  formatCriterionDisplay,
  getCriterionOperator,
  getDefaultCriterionForAttribute
} from '../utils/criterionUtils'
import { generateContextAwareQTPP } from '../utils/routeGenerator'
import { normalizeProductGroup } from '../utils/projectUtils'
import toast from 'react-hot-toast'
import ProjectTemplateModal, { TabKey } from '../components/ProjectTemplateModal'
import {
  FieldKey,
  deduplicateDescriptionSections
} from '../data/projectTemplates'

interface ExtendedQTPPItem extends QTPPItem {
  userEdited?: boolean
}

const JUSTIFICATION_OPTIONS = [
  'Pharmacopoeial',
  'Regulatory Guideline',
  'Patient-Critical',
  'Internal Spec'
]

const TYPE_OPTIONS = [
  'Identity',
  'Assay-Purity',
  'Impurity',
  'Physical Property',
  'Residual Solvent',
  'Microbial',
  'Stability',
  'Appearance & Color'
]

function formatItems(list: any[]): ExtendedQTPPItem[] {
  return list.map(item => {
    let ac = item.acceptanceCriterion
    if (!ac) {
      ac = parseLegacyCriterion(item.criterion, item.operator, item.type)
    }
    const op = getCriterionOperator(ac.type)
    const crit = ac.displayString || formatCriterionDisplay(ac) || item.criterion || ''

    return {
      ...item,
      operator: op,
      criterion: crit,
      acceptanceCriterion: ac,
      userEdited: item.userEdited ?? false
    }
  })
}

const UNIT_OP_OPTIONS = [
  'Reaction',
  'Workup',
  'Crystallization',
  'Filtration',
  'Drying',
  'Distillation',
  'Purification',
  'Milling',
  'Blending',
  'Other'
]

function detectUnitOp(text: string): string {
  const t = text.toLowerCase()
  if (t.includes('crystalliz')) return 'Crystallization'
  if (t.includes('filtrat')) return 'Filtration'
  if (t.includes('dry') || t.includes('drying')) return 'Drying'
  if (t.includes('workup') || t.includes('extract') || t.includes('quench')) return 'Workup'
  if (t.includes('distill')) return 'Distillation'
  if (t.includes('purif') || t.includes('chromatograph')) return 'Purification'
  if (t.includes('mill')) return 'Milling'
  if (t.includes('blend')) return 'Blending'
  if (t.includes('react') || t.includes('coupling') || t.includes('synthesis')) return 'Reaction'
  return 'Reaction'
}

export default function CreateProject() {
  const { currentProject, setProject, setStep, setApiTargets, setQtpp, setStages, unlockedStep, setUnlockedStep, creationProductContext, setCreationProductContext, setEditMode } = useStore()

  const initialUnitOp = (currentProject?.stages_data && currentProject.stages_data[0]?.unitOpType) || 'Reaction'
  const [unitOpType, setUnitOpType] = useState<string>(initialUnitOp)
  const [isUnitOpManuallySet, setIsUnitOpManuallySet] = useState(Boolean(currentProject?.stages_data && currentProject.stages_data.length > 0))

  const [form, setForm] = useState({
    name:        currentProject?.name        || '',
    compound:    currentProject?.compound    || creationProductContext?.fullCompound || '',
    objective:   currentProject?.objective   || '',
    description: currentProject?.description || '',
  })

  // Known existing products list for duplicate prevention in "New Product" flow
  const [existingProjects, setExistingProjects] = useState<any[]>([])

  useEffect(() => {
    Projects.list().then(res => {
      setExistingProjects(Array.isArray(res) ? res : [])
    }).catch(err => {
      console.warn('Could not load existing projects for product validation:', err)
    })
  }, [])

  // If creationProductContext changes and we are creating a project under that product, prefill compound
  useEffect(() => {
    if (!currentProject && creationProductContext?.fullCompound) {
      setForm(prev => ({
        ...prev,
        compound: creationProductContext.fullCompound
      }))
    }
  }, [creationProductContext, currentProject])

  // QTPP State: Do not auto-feed QTPPs for new projects; chemist adds them manually.
  const getInitialQTPP = (): ExtendedQTPPItem[] => {
    const saved = (currentProject?.qtpp_data && currentProject.qtpp_data.length > 0)
      ? currentProject.qtpp_data
      : []

    if (saved.length > 0) {
      return formatItems(saved)
    }

    return []
  }

  const [items, setItems] = useState<ExtendedQTPPItem[]>(getInitialQTPP)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isEditMode, setIsEditMode] = useState(true)
  const [saving, setSaving] = useState(false)

  // Determine if this is an unlock-to-edit session on an existing project
  const isEditingExisting = Boolean(currentProject?.id && unlockedStep === 'create-project')

  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templateModalTab, setTemplateModalTab] = useState<TabKey>('description')
  const templateTriggerRef = useRef<HTMLElement | null>(null)

  // Refs for focusing fields
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const compoundInputRef = useRef<HTMLInputElement | null>(null)
  const objectiveInputRef = useRef<HTMLInputElement | null>(null)
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null)
  const qtppSectionRef = useRef<HTMLDivElement | null>(null)

  // Auto-detect Unit Operation Type when not manually edited
  useEffect(() => {
    if (isUnitOpManuallySet) return
    const combined = `${form.name} ${form.objective} ${form.compound} ${form.description}`
    const detected = detectUnitOp(combined)
    setUnitOpType(detected)
  }, [form.name, form.objective, form.compound, form.description, isUnitOpManuallySet])

  // Sync when active project changes
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
    const existingOp = currentProject?.stages_data && currentProject.stages_data[0]?.unitOpType
    if (existingOp) {
      setUnitOpType(existingOp)
      setIsUnitOpManuallySet(true)
    }
    const initialItems = getInitialQTPP()
    setItems(initialItems)
    setSelectedIds([])
    setIsEditMode(initialItems.length === 0)
  }, [currentProject?.id])

  // Prune any selectedIds that no longer exist in items
  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => items.some(i => i.id === id)))
  }, [items])

  function set(key: string, val: string) {
    setForm(f => {
      const next = { ...f, [key]: val }

      // Synchronize in-memory targets from description so other components have real-time targets
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

  // QTPP Table handlers
  const handleAddRow = () => {
    const defaultType = 'Assay-Purity'
    const defaultCriterion = getDefaultCriterionForAttribute(defaultType)
    const newItem: ExtendedQTPPItem = {
      id: `qtpp-${Date.now()}`,
      attribute: '',
      operator: getCriterionOperator(defaultCriterion.type),
      criterion: defaultCriterion.displayString || formatCriterionDisplay(defaultCriterion),
      justification: 'Pharmacopoeial',
      type: defaultType,
      acceptanceCriterion: defaultCriterion,
      userEdited: true
    }
    setItems(prev => [...prev, newItem])
    setIsEditMode(true)
  }

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    )
  }

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      toast('Select the checkbox next to each attribute you want to delete.')
      return
    }
    const count = selectedIds.length
    const remaining = items.filter(i => !selectedIds.includes(i.id))
    setItems(remaining)
    setSelectedIds([])
    if (remaining.length === 0) {
      setIsEditMode(false)
    }
    toast.success(`Deleted ${count} ${count === 1 ? 'attribute' : 'attributes'}`)
  }

  const handleCriterionChange = (id: string, newCriterion: AcceptanceCriterion) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item
        const op = getCriterionOperator(newCriterion.type)
        const display = newCriterion.displayString || formatCriterionDisplay(newCriterion)
        return {
          ...item,
          operator: op,
          criterion: display,
          acceptanceCriterion: newCriterion,
          userEdited: true
        }
      })
    )
  }

  const handleChange = (id: string, field: keyof QTPPItem, value: string) => {
    setItems(prev =>
      prev.map(i => {
        if (i.id !== id) return i
        if (field === 'type') {
          const isEmpty =
            !i.acceptanceCriterion ||
            (i.acceptanceCriterion.type === 'qualitative' && !i.acceptanceCriterion.textDescription) ||
            (i.acceptanceCriterion.type !== 'qualitative' &&
              i.acceptanceCriterion.minValue == null &&
              i.acceptanceCriterion.maxValue == null &&
              i.acceptanceCriterion.targetValue == null)

          if (isEmpty) {
            const defCriterion = getDefaultCriterionForAttribute(value, i.attribute)
            return {
              ...i,
              type: value,
              operator: getCriterionOperator(defCriterion.type),
              criterion: defCriterion.displayString || formatCriterionDisplay(defCriterion),
              acceptanceCriterion: defCriterion,
              userEdited: true
            }
          }
        }
        return { ...i, [field]: value, userEdited: true }
      })
    )
  }

  const handleClearAll = () => {
    setItems([])
    setSelectedIds([])
    setIsEditMode(false)
    toast('Cleared all QTPP specifications.')
  }

  // Check if current flow is locked to a specific product
  const isProductLocked = Boolean(creationProductContext?.isLocked)

  // Map existing projects into product groups for duplicate detection
  const existingProductsMap = useMemo(() => {
    const map = new Map<string, { key: string; displayName: string; fullCompound: string }>()
    existingProjects.forEach(p => {
      const { key, displayName } = normalizeProductGroup(p.compound)
      if (key !== '__unassigned__' && !map.has(key)) {
        map.set(key, { key, displayName, fullCompound: p.compound || displayName })
      }
    })
    return map
  }, [existingProjects])

  // Check for duplicate product when in "New Product" flow (not locked and not editing existing project)
  const duplicateProductMatch = useMemo(() => {
    if (isEditingExisting || isProductLocked) return null
    if (!form.compound.trim()) return null
    const { key } = normalizeProductGroup(form.compound)
    if (key === '__unassigned__') return null
    return existingProductsMap.get(key) || null
  }, [isEditingExisting, isProductLocked, form.compound, existingProductsMap])

  // Validation
  const validateForm = (): { valid: boolean; message?: string; focusTarget?: 'name' | 'compound' | 'qtpp' } => {
    if (!form.name.trim()) {
      return { valid: false, message: 'Project Name is required.', focusTarget: 'name' }
    }
    // Validation on blank compound in New Product flow
    if (!isEditingExisting && !isProductLocked && !form.compound.trim()) {
      return { valid: false, message: 'Please enter an API / Compound name for the new product.', focusTarget: 'compound' }
    }
    // Block creation if product already exists
    if (duplicateProductMatch) {
      return { valid: false, message: 'This product already exists. Add a project to it instead.', focusTarget: 'compound' }
    }
    if (items.length === 0) {
      return { valid: false, message: 'Please define at least one Quality Target Product Profile attribute.', focusTarget: 'qtpp' }
    }
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx]
      if (!item.attribute.trim()) {
        return { valid: false, message: `Attribute #${idx + 1} requires an attribute name.`, focusTarget: 'qtpp' }
      }
      const ac = item.acceptanceCriterion
      if (ac) {
        if (ac.type === 'range') {
          if (ac.minValue == null || ac.maxValue == null) {
            return { valid: false, message: `Attribute "${item.attribute}" requires both Minimum and Maximum values.`, focusTarget: 'qtpp' }
          }
          if (Number(ac.minValue) > Number(ac.maxValue)) {
            return { valid: false, message: `Attribute "${item.attribute}": Minimum value cannot be greater than Maximum.`, focusTarget: 'qtpp' }
          }
        } else if (ac.type === 'upper_bound') {
          if (ac.maxValue == null && ac.targetValue == null) {
            return { valid: false, message: `Attribute "${item.attribute}" requires a valid upper limit (≤).`, focusTarget: 'qtpp' }
          }
        } else if (ac.type === 'lower_bound') {
          if (ac.minValue == null && ac.targetValue == null) {
            return { valid: false, message: `Attribute "${item.attribute}" requires a valid lower limit (≥).`, focusTarget: 'qtpp' }
          }
        } else if (ac.type === 'qualitative') {
          if (!ac.textDescription?.trim() && !item.criterion?.trim()) {
            return { valid: false, message: `Attribute "${item.attribute}" requires a qualitative specification description.`, focusTarget: 'qtpp' }
          }
        }
      }
    }
    return { valid: true }
  }

  const isFormValid = useMemo(() => {
    return validateForm().valid
  }, [form.name, form.compound, duplicateProductMatch, items, isEditingExisting, isProductLocked])

  // Single submit action: "Create Project" or "Save Changes"
  async function handleSubmit() {
    const val = validateForm()
    if (!val.valid) {
      toast.error(val.message || 'Please correct errors before proceeding.')
      if (val.focusTarget === 'name') {
        nameInputRef.current?.focus()
      } else if (val.focusTarget === 'compound') {
        compoundInputRef.current?.focus()
      } else if (val.focusTarget === 'qtpp') {
        qtppSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
      return
    }

    setSaving(true)
    try {
      const cleanDesc = deduplicateDescriptionSections(form.description)
      const extractedTargets = extractTargetsFromDescription(cleanDesc, form.objective, form.compound)
      const validQtpp = items.filter(i => i.attribute.trim() !== '')

      // IF EDITING EXISTING UNLOCKED PROJECT
      if (isEditingExisting && currentProject?.id) {
        const updatePayload = {
          name: form.name.trim(),
          compound: form.compound.trim(),
          objective: form.objective.trim(),
          description: cleanDesc,
          unit_op_type: unitOpType,
          api_targets: extractedTargets,
          qtpp_data: validQtpp
        }

        await Projects.update(currentProject.id, updatePayload)
        const realignSummary = await WorkflowApi.realign(currentProject.id, 'create-project', updatePayload)
        
        setProject({
          ...currentProject,
          ...updatePayload,
          unlocked_step: null
        })
        setQtpp(validQtpp)
        setApiTargets(extractedTargets)
        setUnlockedStep(null)

        if (realignSummary.changes_detected && realignSummary.affected_steps.length > 0) {
          toast.success(`Changes saved. Downstream steps re-aligned: ${realignSummary.affected_steps.join(', ')}`)
        } else {
          toast.success('Changes saved successfully.')
        }

        setStep('cqa-risk')
        return
      }

      // ATOMIC CREATION FOR NEW PROJECT
      const payload = {
        name: form.name.trim(),
        compound: form.compound.trim(),
        objective: form.objective.trim(),
        description: cleanDesc,
        unit_op_type: unitOpType,
        api_targets: extractedTargets,
        qtpp_data: validQtpp
      }

      const proj = await Projects.createWithQTPP(payload)
      setProject({
        ...proj,
        api_targets: extractedTargets,
        qtpp_data: validQtpp
      })
      setQtpp(validQtpp)
      setApiTargets(extractedTargets)
      if (proj.stages_data) {
        setStages(proj.stages_data)
      }
      // Safety behavior: Turn Edit mode OFF automatically after product or project creation
      setEditMode(false)
      toast.success('Project created!')
      setStep('cqa-risk')
    } catch (e: any) {
      console.error('Failed to create/save project with QTPP:', e)
      toast.error(e.response?.data?.detail || 'Failed to save project. Please check required fields.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="screen-container">
      {/* Page Header with Reference Guide */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">
            {isEditingExisting
              ? 'Project Setup & QTPP'
              : isProductLocked
                ? `New Project in ${creationProductContext?.productName || form.compound}`
                : 'New Product'}
          </h1>
          <p className="page-desc">
            {isEditingExisting
              ? 'Enter the project, API and goal details, then define the quality attributes the final API should have.'
              : isProductLocked
                ? `Create a new QbD campaign under ${creationProductContext?.productName || form.compound}.`
                : 'Initialize a new product portfolio and configure its first QbD design campaign.'}
          </p>
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

      {/* SECTION A: Project Details */}
      <div className="card" style={{ marginBottom: '1.75rem', padding: '1.5rem' }}>
        <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>Section A · Project Details</h2>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>Core project identification and synthesis objectives.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Project Name & Unit Operation */}
          <div className="grid-2">
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

            <div className="form-group">
              <label className="form-label">
                Unit Operation Type (Single Stage)
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '0.4rem', fontWeight: 'normal' }}>
                  (Auto-detected, selectable)
                </span>
              </label>
              <select
                className="form-select"
                value={unitOpType}
                onChange={e => {
                  setUnitOpType(e.target.value)
                  setIsUnitOpManuallySet(true)
                }}
              >
                {UNIT_OP_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Compound / API and Primary Objective */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>
                  Compound / API {!isEditingExisting && !isProductLocked ? '*' : ''}
                </span>
                {isProductLocked && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.72rem',
                      color: '#005baa',
                      background: '#eff6ff',
                      padding: '0.1rem 0.45rem',
                      borderRadius: '4px',
                      fontWeight: 600
                    }}
                    title="Locked to this product section"
                  >
                    <Lock size={11} /> Locked
                  </span>
                )}
              </label>

              <div style={{ position: 'relative' }}>
                <input
                  ref={compoundInputRef}
                  className="form-input"
                  placeholder="e.g. Propofol or LXP-001"
                  value={form.compound}
                  readOnly={isProductLocked}
                  disabled={isProductLocked}
                  onChange={e => set('compound', e.target.value)}
                  style={{
                    backgroundColor: isProductLocked ? '#f8fafc' : 'white',
                    color: isProductLocked ? '#334155' : 'inherit',
                    cursor: isProductLocked ? 'not-allowed' : 'text',
                    borderColor: duplicateProductMatch ? '#ef4444' : undefined,
                    paddingRight: isProductLocked ? '2rem' : undefined
                  }}
                />
                {isProductLocked && (
                  <span
                    style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#64748b',
                      pointerEvents: 'none'
                    }}
                  >
                    <Lock size={14} />
                  </span>
                )}
              </div>

              {/* Helper text for New Product flow */}
              {!isEditingExisting && !isProductLocked && !duplicateProductMatch && (
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  This creates a new product with its first project.
                </p>
              )}

              {/* Duplicate product warning banner */}
              {duplicateProductMatch && (
                <div
                  style={{
                    marginTop: '0.45rem',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    fontSize: '0.78rem',
                    color: '#991b1b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <AlertTriangle size={14} color="#dc2626" />
                    <span>This product already exists. Add a project to it instead.</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{
                      fontSize: '0.74rem',
                      padding: '0.2rem 0.55rem',
                      color: '#005baa',
                      borderColor: '#93c5fd',
                      background: '#ffffff',
                      fontWeight: 600
                    }}
                    onClick={() => {
                      setCreationProductContext({
                        productName: duplicateProductMatch.displayName,
                        fullCompound: duplicateProductMatch.fullCompound,
                        isLocked: true
                      })
                      setForm(prev => ({
                        ...prev,
                        compound: duplicateProductMatch.fullCompound
                      }))
                    }}
                  >
                    Switch to {duplicateProductMatch.displayName} →
                  </button>
                </div>
              )}
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
              rows={6}
              style={{
                minHeight: '140px',
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
              <strong>{unfilledPlaceholderWarnings.join(', ')}</strong>. Replacing them with your specific experimental details gives more accurate downstream derivation.
            </span>
          </div>
        )}
      </div>

      {/* SECTION B: QTPP: API Quality Attributes */}
      <div ref={qtppSectionRef} className="card" style={{ marginBottom: '1.75rem', padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>Section B · QTPP: API Quality Attributes</h2>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Define attributes and criteria specific to {form.compound ? <strong>{form.compound}</strong> : 'the API'}.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {!isEditMode ? (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsEditMode(true)}
                title="Edit QTPP attributes"
                style={{
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
              >
                <Edit size={14} />
                Edit
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleDeleteSelected}
                  style={{
                    color: selectedIds.length > 0 ? '#ef4444' : 'var(--danger)',
                    borderColor: 'rgba(239, 68, 68, 0.35)',
                    fontWeight: 600
                  }}
                  title={selectedIds.length === 0 ? "Select rows below using checkboxes to delete" : `Delete ${selectedIds.length} selected attributes`}
                >
                  Delete QTPP {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                </button>

                {items.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleClearAll}
                    title="Clear all rows to start with a blank table"
                  >
                    Clear All
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleAddRow}
                  title="Add a new quality attribute row"
                >
                  <Plus size={14} style={{ marginRight: '0.2rem' }} /> Add Attribute
                </button>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setIsEditMode(false)
                    setSelectedIds([])
                  }}
                  style={{ fontWeight: 600 }}
                  title="Done editing"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                {isEditMode && (
                  <th style={{ width: '3%', textAlign: 'center' }} />
                )}
                <th style={{ width: '4%' }}>#</th>
                <th style={{ width: isEditMode ? '24%' : '25%' }}>Attribute Name</th>
                <th style={{ width: isEditMode ? '38%' : '40%' }}>Target / Acceptance Criterion</th>
                <th style={{ width: isEditMode ? '20%' : '20%' }}>Justification / Source</th>
                <th style={{ width: isEditMode ? '15%' : '15%' }}>Attribute Type</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={isEditMode ? 6 : 5} style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                      No QTPP Attributes Defined Yet
                    </div>
                    <div style={{ fontSize: '0.82rem', maxWidth: '480px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                      Target specifications establish the foundation of Quality by Design (QbD). Add custom attributes to define the target quality profile for <strong>{form.compound || 'the API'}</strong>.
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                      <button className="btn btn-primary btn-sm" onClick={handleAddRow}>
                        <Plus size={14} style={{ marginRight: '0.3rem' }} /> Add Attribute
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((row, idx) => {
                  const isChecked = selectedIds.includes(row.id)
                  return (
                    <tr key={row.id} style={{ background: isChecked ? 'rgba(239, 68, 68, 0.04)' : undefined }}>
                      {isEditMode && (
                        <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '1.05rem' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelect(row.id)}
                            title={`Select ${row.attribute || 'attribute'} to delete`}
                            style={{ cursor: 'pointer' }}
                          />
                        </td>
                      )}
                      <td style={{ color: 'var(--text-muted)', fontWeight: 600, verticalAlign: 'top', paddingTop: '1rem' }}>
                        {idx + 1}
                      </td>
                      <td style={{ verticalAlign: 'top', paddingTop: '0.85rem' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                          placeholder="e.g. Assay (Purity)"
                          value={row.attribute}
                          onChange={e => handleChange(row.id, 'attribute', e.target.value)}
                        />
                      </td>
                      <td style={{ verticalAlign: 'top', padding: '0.75rem 0.5rem' }}>
                        <CriterionInput
                          value={row.acceptanceCriterion}
                          onChange={newCrit => handleCriterionChange(row.id, newCrit)}
                          attributeType={row.type}
                          attributeName={row.attribute}
                        />
                      </td>
                      <td style={{ verticalAlign: 'top', paddingTop: '0.85rem' }}>
                        <select
                          className="form-select"
                          style={{ padding: '0.45rem 0.65rem', fontSize: '0.82rem' }}
                          value={row.justification}
                          onChange={e => handleChange(row.id, 'justification', e.target.value)}
                        >
                          {JUSTIFICATION_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>
                      <td style={{ verticalAlign: 'top', paddingTop: '0.85rem' }}>
                        <select
                          className="form-select"
                          style={{ padding: '0.45rem 0.65rem', fontSize: '0.82rem' }}
                          value={row.type}
                          onChange={e => handleChange(row.id, 'type', e.target.value)}
                        >
                          {TYPE_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="card" style={{ padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            if (form.name.trim() || items.some(i => i.userEdited)) {
              if (window.confirm('You have unsaved changes. Return to Dashboard?')) {
                setStep('welcome')
              }
            } else {
              setStep('welcome')
            }
          }}
        >
          ← Back to Dashboard
        </button>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={saving || !isFormValid}
          style={{ minWidth: '170px', fontWeight: 600 }}
        >
          {saving ? (
            <><div className="spinner" /> {isEditingExisting ? 'Saving Changes…' : 'Creating Project…'}</>
          ) : (
            isEditingExisting ? 'Save Changes →' : 'Create Project →'
          )}
        </button>
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
