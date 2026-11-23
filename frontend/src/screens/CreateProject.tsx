// src/screens/CreateProject.tsx – Step 01: Project Setup & QTPP
import React, { useState, useEffect, useRef, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { Info, Plus, Edit, ArrowRight, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react'
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
import toast from 'react-hot-toast'
import {
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

export default function CreateProject({
  isModal,
  onClose,
  onProjectCreated
}: {
  isModal?: boolean
  onClose?: () => void
  onProjectCreated?: (proj: any) => void
}) {
  const { currentProject, setProject, setStep, setApiTargets, setQtpp, setStages, unlockedStep, setUnlockedStep, creationProductContext, setCreationProductContext, setEditMode } = useStore()

  // Wizard Step: 1 = Project Details, 2 = QTPP Specifications
  const [wizardStep, setWizardStep] = useState<1 | 2>(1)

  const initialUnitOp = (currentProject?.stages_data && currentProject.stages_data[0]?.unitOpType) || 'Reaction'
  const [unitOpType, setUnitOpType] = useState<string>(initialUnitOp)
  const [isUnitOpManuallySet, setIsUnitOpManuallySet] = useState(Boolean(currentProject?.stages_data && currentProject.stages_data.length > 0))

  const [form, setForm] = useState({
    name:        currentProject?.name        || '',
    compound:    currentProject?.compound    || creationProductContext?.fullCompound || '',
    objective:   currentProject?.objective   || '',
    description: currentProject?.description || '',
  })

  // If creationProductContext changes and we are creating a project under that product, prefill compound
  useEffect(() => {
    if (!currentProject && creationProductContext?.fullCompound) {
      setForm(prev => ({
        ...prev,
        compound: creationProductContext.fullCompound
      }))
    }
  }, [creationProductContext, currentProject])

  // QTPP State
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
  const [headerError, setHeaderError] = useState<string | null>(null)

  // Determine if this is an unlock-to-edit session on an existing project
  const isEditingExisting = Boolean(currentProject?.id && unlockedStep === 'create-project')

  // Refs for focusing fields
  const nameInputRef = useRef<HTMLInputElement | null>(null)
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

      // Synchronize in-memory targets from description
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

  // Load standard pharmaceutical QbD preset attributes (ICH Q8 / Q6A)
  const handleLoadQbdPreset = () => {
    const compoundName = form.compound || 'Drug Substance'
    const presetAttributes: ExtendedQTPPItem[] = [
      {
        id: `qtpp-assay-${Date.now()}`,
        attribute: `${compoundName} Assay`,
        operator: 'Between',
        criterion: '98.0 – 102.0 % w/w',
        justification: 'Pharmacopoeial',
        type: 'Assay-Purity',
        acceptanceCriterion: { type: 'range', minValue: 98.0, maxValue: 102.0, unit: '% w/w', displayString: '98.0 – 102.0 % w/w' },
        userEdited: false
      },
      {
        id: `qtpp-purity-${Date.now() + 1}`,
        attribute: 'Chromatographic Purity (HPLC)',
        operator: '≥',
        criterion: '≥ 99.5 % area',
        justification: 'Regulatory Guideline',
        type: 'Assay-Purity',
        acceptanceCriterion: { type: 'lower_bound', minValue: 99.5, unit: '%', displayString: '≥ 99.5 %' },
        userEdited: false
      },
      {
        id: `qtpp-specified-imp-${Date.now() + 2}`,
        attribute: 'Total Related Substances (Impurities)',
        operator: '≤',
        criterion: '≤ 0.50 % area',
        justification: 'Regulatory Guideline',
        type: 'Impurity',
        acceptanceCriterion: { type: 'upper_bound', maxValue: 0.50, unit: '%', displayString: '≤ 0.50 %' },
        userEdited: false
      },
      {
        id: `qtpp-solvents-${Date.now() + 3}`,
        attribute: 'Residual Solvents (ICH Q3C)',
        operator: '≤',
        criterion: '≤ Option 1 limits',
        justification: 'Regulatory Guideline',
        type: 'Residual Solvent',
        acceptanceCriterion: { type: 'qualitative', textDescription: 'Meets ICH Q3C Class 2/3 limits', displayString: 'Meets ICH Q3C limits' },
        userEdited: false
      },
      {
        id: `qtpp-solid-state-${Date.now() + 4}`,
        attribute: 'Polymorphic Form & Crystal Habit',
        operator: 'Target',
        criterion: 'Form I (Single Polymorph by XRPD)',
        justification: 'Patient-Critical',
        type: 'Physical Property',
        acceptanceCriterion: { type: 'qualitative', textDescription: 'Conforms to Form I standard', displayString: 'Form I Single Polymorph' },
        userEdited: false
      }
    ]

    setItems(presetAttributes)
    setIsEditMode(true)
    toast.success('Loaded standard ICH Q8 QbD specification profile!')
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

  // Validation for Step 1 (Project Details)
  const validateStep1 = (): { valid: boolean; message?: string } => {
    if (!form.name.trim()) {
      return { valid: false, message: 'Project Name is required.' }
    }
    return { valid: true }
  }

  // Validation for Step 2 (QTPP)
  const validateStep2 = (): { valid: boolean; message?: string } => {
    if (items.length === 0) {
      return { valid: false, message: 'Please define at least one Quality Target Product Profile attribute.' }
    }
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx]
      if (!item.attribute.trim()) {
        return { valid: false, message: `Attribute #${idx + 1} requires an attribute name.` }
      }
      const ac = item.acceptanceCriterion
      if (ac) {
        if (ac.type === 'range') {
          if (ac.minValue == null || ac.maxValue == null) {
            return { valid: false, message: `Attribute "${item.attribute}" requires both Minimum and Maximum values.` }
          }
          if (Number(ac.minValue) > Number(ac.maxValue)) {
            return { valid: false, message: `Attribute "${item.attribute}": Minimum value cannot be greater than Maximum.` }
          }
        } else if (ac.type === 'upper_bound') {
          if (ac.maxValue == null && ac.targetValue == null) {
            return { valid: false, message: `Attribute "${item.attribute}" requires a valid upper limit (≤).` }
          }
        } else if (ac.type === 'lower_bound') {
          if (ac.minValue == null && ac.targetValue == null) {
            return { valid: false, message: `Attribute "${item.attribute}" requires a valid lower limit (≥).` }
          }
        } else if (ac.type === 'qualitative') {
          if (!ac.textDescription?.trim() && !item.criterion?.trim()) {
            return { valid: false, message: `Attribute "${item.attribute}" requires a qualitative specification description.` }
          }
        }
      }
    }
    return { valid: true }
  }

  // Move to Step 2
  const handleProceedToQtpp = () => {
    const v1 = validateStep1()
    if (!v1.valid) {
      setHeaderError(v1.message || 'Please complete required project details.')
      toast.error(v1.message || 'Please complete required project details.')
      nameInputRef.current?.focus()
      return
    }
    setHeaderError(null)

    // Auto-seed from description/objective if table is empty
    if (items.length === 0) {
      const cleanDesc = deduplicateDescriptionSections(form.description)
      const targets = extractTargetsFromDescription(cleanDesc, form.objective, form.compound)
      if (targets.length > 0) {
        const seeded = targets.map((t, idx) => ({
          id: `qtpp-extracted-${idx}`,
          attribute: t.name,
          operator: t.goal === 'Minimize' ? '≤' : t.goal === 'Maximize' ? '≥' : 'Target',
          criterion: t.specification || `${t.goal} ${t.name}`,
          justification: 'Internal Spec',
          type: t.name.toLowerCase().includes('impurity') ? 'Impurity' : 'Assay-Purity',
          acceptanceCriterion: {
            type: (t.goal === 'Minimize' ? 'upper_bound' : t.goal === 'Maximize' ? 'lower_bound' : 'qualitative') as any,
            targetValue: t.target_value ?? undefined,
            unit: t.unit || '',
            displayString: t.specification
          },
          userEdited: false
        }))
        setItems(seeded)
        setIsEditMode(true)
      }
    }

    setWizardStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Final Project Submission
  async function handleSubmit() {
    const v1 = validateStep1()
    if (!v1.valid) {
      setWizardStep(1)
      setHeaderError(v1.message || 'Please check project details.')
      toast.error(v1.message || 'Please check project details.')
      nameInputRef.current?.focus()
      return
    }

    const v2 = validateStep2()
    if (!v2.valid) {
      setWizardStep(2)
      setHeaderError(v2.message || 'Please check QTPP attributes.')
      toast.error(v2.message || 'Please check QTPP attributes.')
      qtppSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    setHeaderError(null)

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

      if (onProjectCreated) {
        onProjectCreated(proj)
      } else if (isModal && onClose) {
        onClose()
        setStep('welcome')
      } else {
        setStep('welcome')
      }
    } catch (e: any) {
      console.error('Failed to create/save project with QTPP:', e)
      toast.error(e.response?.data?.detail || 'Failed to save project. Please check required fields.')
    } finally {
      setSaving(false)
    }
  }

  const content = (
    <div
      className={isModal ? undefined : "screen-container"}
      style={isModal ? {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        maxHeight: '96vh',
        overflow: 'hidden'
      } : undefined}
    >
      {/* Page Header */}
      <div
        className={isModal ? undefined : "page-header"}
        style={isModal ? {
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg, #003d73 0%, #005baa 65%, #00aeb3 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '1rem',
          borderRadius: '12px 12px 0 0'
        } : { marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <div>
          <h1
            className="page-title"
            style={{
              fontSize: isModal ? '1.25rem' : '1.45rem',
              fontWeight: 700,
              margin: 0,
              color: isModal ? '#ffffff' : 'var(--text-main)'
            }}
          >
            Project Setup & QTPP
          </h1>
          <p
            className="page-desc"
            style={{
              marginTop: '0.35rem',
              color: isModal ? 'rgba(255, 255, 255, 0.9)' : 'var(--text-muted)',
              fontSize: '0.85rem'
            }}
          >
            {wizardStep === 1
              ? 'Step 1 of 2: Define core project identity, synthesis objectives, and primary unit operation.'
              : 'Step 2 of 2: Establish Quality Target Product Profile (QTPP) specifications according to ICH Q8(R2).'}
          </p>
        </div>

        {/* Right Header Area: Error Banner Box (Highlighted Area) & Close Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', flexShrink: 0 }}>
          {headerError && (
            <div
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.9)',
                border: '1px solid rgba(254, 202, 202, 0.6)',
                borderRadius: '8px',
                padding: '0.45rem 0.85rem',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                animation: 'fadeIn 0.2s ease',
                maxWidth: '450px'
              }}
            >
              <span>⚠️</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {headerError}
              </span>
              <button
                type="button"
                onClick={() => setHeaderError(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  padding: '0 0.2rem',
                  opacity: 0.8
                }}
                title="Dismiss message"
              >
                ✕
              </button>
            </div>
          )}

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: 'pointer',
                padding: '0.35rem 0.6rem',
                fontSize: '1rem',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease'
              }}
              title="Close modal"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Modal Scrollable Body */}
      <div
        className="modal-scroll-body"
        style={isModal ? {
          padding: '1.5rem',
          overflowY: 'auto',
          overflowX: 'auto',
          flex: 1,
          minHeight: 0,
          WebkitOverflowScrolling: 'touch'
        } : undefined}
      >

      {/* Wizard Progress Stepper Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setWizardStep(1)}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: wizardStep === 1 ? '2px solid #2563eb' : '1px solid var(--border)',
            background: wizardStep === 1 ? '#eff6ff' : '#ffffff',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: wizardStep === 1 ? '#2563eb' : form.name.trim() ? '#10b981' : '#e2e8f0',
            color: wizardStep === 1 || form.name.trim() ? '#ffffff' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: 700
          }}>
            {form.name.trim() && wizardStep !== 1 ? '✓' : '1'}
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: wizardStep === 1 ? '#1d4ed8' : 'var(--text-main)' }}>
              1. Project Details
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Name, Unit Operation & Description
            </div>
          </div>
        </button>

        <div style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>→</div>

        <button
          type="button"
          onClick={() => {
            if (validateStep1().valid) {
              setWizardStep(2)
            } else {
              toast.error('Please enter a Project Name first.')
            }
          }}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: wizardStep === 2 ? '2px solid #2563eb' : '1px solid var(--border)',
            background: wizardStep === 2 ? '#eff6ff' : '#ffffff',
            cursor: 'pointer',
            textAlign: 'left',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{
            width: '26px',
            height: '26px',
            borderRadius: '50%',
            background: wizardStep === 2 ? '#2563eb' : items.length > 0 ? '#10b981' : '#e2e8f0',
            color: wizardStep === 2 || items.length > 0 ? '#ffffff' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.8rem',
            fontWeight: 700
          }}>
            {items.length > 0 && wizardStep !== 2 ? '✓' : '2'}
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: wizardStep === 2 ? '#1d4ed8' : 'var(--text-main)' }}>
              2. QTPP Specifications
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Target specifications & criteria
            </div>
          </div>
        </button>
      </div>

      {/* STEP 1: Project Details Form */}
      {wizardStep === 1 && (
        <div className="card" style={{ marginBottom: '1.75rem', padding: '1.5rem' }}>
          <div style={{ marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>Project Details</h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>Core project identification, synthesis objectives, and chemical description.</p>
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
                  autoFocus
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

            {/* Primary Objective */}
            <div className="form-group">
              <label className="form-label">Primary Objective</label>
              <input
                ref={objectiveInputRef}
                className="form-input"
                placeholder="e.g. Maximize yield, minimize impurities, expand crystallization design space"
                value={form.objective}
                onChange={e => set('objective', e.target.value)}
              />
            </div>

            {/* Project Description */}
            <div className="form-group">
              <label className="form-label" style={{ marginBottom: '0.35rem' }}>Project Description</label>
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

            {/* Action Bar for Step 1 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (form.name.trim()) {
                    if (window.confirm('Discard changes and return to Dashboard?')) {
                      if (isModal && onClose) {
                        onClose()
                      } else {
                        setStep('welcome')
                      }
                    }
                  } else {
                    if (isModal && onClose) {
                      onClose()
                    } else {
                      setStep('welcome')
                    }
                  }
                }}
              >
                {isModal ? 'Cancel' : '← Back to Dashboard'}
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleProceedToQtpp}
                style={{ minWidth: '180px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
              >
                <span>Continue to QTPP Setup</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: QTPP Definition Table */}
      {wizardStep === 2 && (
        <div ref={qtppSectionRef} className="card" style={{ marginBottom: '1.75rem', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.85rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-main)' }}>
                  Quality Target Product Profile (QTPP) Specifications
                </h2>
                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>ICH Q8(R2)</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                Target quality criteria and acceptance ranges that govern Critical Quality Attributes (CQAs) and DoE response variables.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {!isEditMode ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsEditMode(true)}
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
                    Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
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

          {/* QTPP Data Table Container with Horizontal and Vertical Scrolling */}
          <div
            style={{
              overflowX: 'auto',
              overflowY: 'visible',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '0.25rem',
              backgroundColor: '#ffffff'
            }}
          >
            <table className="data-table" style={{ width: '100%', minWidth: '950px', fontSize: '0.85rem' }}>
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
                      <div style={{ fontSize: '0.82rem', maxWidth: '520px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                        In pharmaceutical Quality by Design (QbD) and modern DoE platforms (like MODDE and JMP), the QTPP specifies patient-relevant targets (Assay, Purity, Dissolution, Impurities) to evaluate experimental outcomes.
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
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

          {/* Action Bar for Step 2 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setWizardStep(1)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <ArrowLeft size={15} />
              <span>← Back to Project Details</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={saving || items.length === 0}
              style={{ minWidth: '180px', fontWeight: 600 }}
            >
              {saving ? (
                <><div className="spinner" /> {isEditingExisting ? 'Saving Changes…' : 'Creating Project…'}</>
              ) : (
                isEditingExisting ? 'Save Changes →' : 'Create Project →'
              )}
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  )

  if (isModal) {
    const modalElement = (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 1050,
          backgroundColor: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0.75rem 0.5rem'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && onClose) {
            onClose()
          }
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Project Setup & QTPP"
      >
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0,0,0,0.08)',
            width: '98vw',
            maxWidth: '1620px',
            height: '94vh',
            maxHeight: '94vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {content}
        </div>
      </div>
    )

    if (typeof document !== 'undefined') {
      return ReactDOM.createPortal(modalElement, document.body)
    }

    return modalElement
  }

  return content
}
