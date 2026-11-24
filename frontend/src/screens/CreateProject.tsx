// src/screens/CreateProject.tsx – Step 01: Project Setup & QTPP
import React, { useState, useEffect, useRef, useMemo } from 'react'
import ReactDOM from 'react-dom'
import { Info, Plus, Edit, ArrowRight, ArrowLeft, Sparkles, CheckCircle2, Trash2 } from 'lucide-react'
import { useStore, QTPPItem, AcceptanceCriterion } from '../store/useStore'
import { Projects, WorkflowApi, QTPPApi } from '../services/api'
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

import {
  ATTRIBUTE_CLASSIFICATIONS,
  AttributeClassification,
  QTPPCriterionType
} from '../store/useStore'

export interface ExtendedQTPPSpecificationItem {
  id: string
  attribute_name: string
  attribute_classification: AttributeClassification | string
  criterion_type: QTPPCriterionType
  unit: string | null
  min_value: number | null
  max_value: number | null
  target_value: number | null
  qualitative_text: string | null
  justification: string
  reference_source: string
  sort_order: number
  userEdited?: boolean
}

const QUICK_UNITS = ['%', '% w/w', 'mg', 'mg/mL', 'min', 'months', 'ppm', 'N/A']

const CRITERION_TYPE_OPTIONS: { value: QTPPCriterionType; label: string; symbol: string }[] = [
  { value: 'MIN', label: 'Minimum limit (≥)', symbol: '≥' },
  { value: 'MAX', label: 'Maximum limit (≤)', symbol: '≤' },
  { value: 'RANGE', label: 'Range (Between)', symbol: '–' },
  { value: 'EXACT', label: 'Exact target (=)', symbol: '=' },
  { value: 'QUALITATIVE', label: 'Qualitative requirement', symbol: 'Txt' }
]

const IR_TABLET_EXAMPLE: Omit<ExtendedQTPPSpecificationItem, 'id' | 'sort_order'>[] = [
  {
    attribute_name: 'Dosage form',
    attribute_classification: 'Dosage form',
    criterion_type: 'QUALITATIVE',
    unit: 'N/A',
    min_value: null,
    max_value: null,
    target_value: null,
    qualitative_text: 'Immediate release tablet',
    justification: 'Intended product presentation',
    reference_source: 'Product requirement'
  },
  {
    attribute_name: 'Assay',
    attribute_classification: 'Assay / potency',
    criterion_type: 'RANGE',
    unit: '%',
    min_value: 95,
    max_value: 105,
    target_value: null,
    qualitative_text: null,
    justification: 'Ensures drug content',
    reference_source: 'Internal specification'
  },
  {
    attribute_name: 'Related substances',
    attribute_classification: 'Purity / related substances',
    criterion_type: 'MAX',
    unit: '%',
    min_value: null,
    max_value: 0.15,
    target_value: null,
    qualitative_text: null,
    justification: 'Controls impurities',
    reference_source: 'Applicable specification'
  },
  {
    attribute_name: 'Dissolution',
    attribute_classification: 'Dissolution',
    criterion_type: 'MIN',
    unit: '%',
    min_value: 80,
    max_value: null,
    target_value: null,
    qualitative_text: null,
    justification: 'Ensures drug release',
    reference_source: 'Development target'
  },
  {
    attribute_name: 'Content uniformity',
    attribute_classification: 'Content uniformity',
    criterion_type: 'QUALITATIVE',
    unit: 'N/A',
    min_value: null,
    max_value: null,
    target_value: null,
    qualitative_text: 'Compendial compliance',
    justification: 'Ensures dose consistency',
    reference_source: 'USP / applicable pharmacopoeia'
  },
  {
    attribute_name: 'Stability',
    attribute_classification: 'Stability',
    criterion_type: 'MIN',
    unit: 'months',
    min_value: 24,
    max_value: null,
    target_value: null,
    qualitative_text: null,
    justification: 'Supports intended shelf life',
    reference_source: 'Stability requirement'
  },
  {
    attribute_name: 'Container closure',
    attribute_classification: 'Container closure system',
    criterion_type: 'QUALITATIVE',
    unit: 'N/A',
    min_value: null,
    max_value: null,
    target_value: null,
    qualitative_text: 'Protective packaging',
    justification: 'Protects product quality',
    reference_source: 'Packaging requirement'
  }
]

function formatLegacyItemsToSpecs(list: any[]): ExtendedQTPPSpecificationItem[] {
  return list.map((item, idx) => {
    const attrName = (item.attribute_name || item.attribute || `Attribute ${idx + 1}`).trim()
    let classification = item.attribute_classification || item.type || 'Other'
    if (classification === 'Assay-Purity') classification = 'Assay / potency'
    if (classification === 'Impurity') classification = 'Purity / related substances'
    if (classification === 'Physical Property' || classification === 'Physical') classification = 'Physical properties'

    let cType: QTPPCriterionType = item.criterion_type || 'QUALITATIVE'
    let unit: string | null = item.unit ?? null
    let minVal: number | null = item.min_value ?? null
    let maxVal: number | null = item.max_value ?? null
    let targetVal: number | null = item.target_value ?? null
    let qualText: string | null = item.qualitative_text ?? null

    const ac = item.acceptanceCriterion
    if (ac && !item.criterion_type) {
      if (ac.type === 'lower_bound' || ac.type === 'min') {
        cType = 'MIN'
        minVal = ac.minValue ?? null
        unit = ac.unit ?? unit
      } else if (ac.type === 'upper_bound' || ac.type === 'max') {
        cType = 'MAX'
        maxVal = ac.maxValue ?? null
        unit = ac.unit ?? unit
      } else if (ac.type === 'range') {
        cType = 'RANGE'
        minVal = ac.minValue ?? null
        maxVal = ac.maxValue ?? null
        unit = ac.unit ?? unit
      } else if (ac.type === 'exact') {
        cType = 'EXACT'
        targetVal = ac.targetValue ?? null
        unit = ac.unit ?? unit
      } else {
        cType = 'QUALITATIVE'
        qualText = ac.textDescription || item.criterion || 'Conforms'
        unit = 'N/A'
      }
    }

    if (cType === 'QUALITATIVE') {
      unit = 'N/A'
      if (!qualText) qualText = item.criterion || 'Conforms'
    }

    return {
      id: item.id || `qtpp-${idx + 1}`,
      attribute_name: attrName,
      attribute_classification: classification,
      criterion_type: cType,
      unit,
      min_value: minVal,
      max_value: maxVal,
      target_value: targetVal,
      qualitative_text: qualText,
      justification: item.justification || '',
      reference_source: item.reference_source || item.reference || '',
      sort_order: item.sort_order ?? idx,
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
  const getInitialQTPP = (): ExtendedQTPPSpecificationItem[] => {
    const saved = (currentProject?.qtpp_data && currentProject.qtpp_data.length > 0)
      ? currentProject.qtpp_data
      : []

    if (saved.length > 0) {
      return formatLegacyItemsToSpecs(saved)
    }

    return []
  }

  const [items, setItems] = useState<ExtendedQTPPSpecificationItem[]>(getInitialQTPP)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDeleteMode, setIsDeleteMode] = useState(false)
  const [isEditMode, setIsEditMode] = useState(true)
  const [saving, setSaving] = useState(false)
  const [headerError, setHeaderError] = useState<string | null>(null)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)

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
    const newItem: ExtendedQTPPSpecificationItem = {
      id: `qtpp-${Date.now()}`,
      attribute_name: '',
      attribute_classification: 'Assay / potency',
      criterion_type: 'RANGE',
      unit: '%',
      min_value: 98.0,
      max_value: 102.0,
      target_value: null,
      qualitative_text: null,
      justification: 'Pharmacopoeial',
      reference_source: 'Monograph / Standard',
      sort_order: items.length,
      userEdited: true
    }
    setItems(prev => [...prev, newItem])
    setIsEditMode(true)
  }

  const handleDuplicateRow = (id: string) => {
    const src = items.find(i => i.id === id)
    if (!src) return
    const duplicated: ExtendedQTPPSpecificationItem = {
      ...src,
      id: `qtpp-${Date.now()}`,
      attribute_name: `${src.attribute_name} (Copy)`.trim(),
      sort_order: items.length,
      userEdited: true
    }
    setItems(prev => [...prev, duplicated])
    toast.success(`Duplicated "${src.attribute_name || 'Attribute'}"`)
  }

  // Load IR Tablet example (ICH Q8(R2))
  const handleLoadIRTabletExample = () => {
    const exampleItems: ExtendedQTPPSpecificationItem[] = IR_TABLET_EXAMPLE.map((ex, idx) => ({
      ...ex,
      id: `qtpp-ir-${Date.now()}-${idx}`,
      sort_order: idx,
      userEdited: false
    }))
    setItems(exampleItems)
    setIsEditMode(true)
    toast.success('Loaded illustrative immediate-release tablet example specifications!')
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
    setIsDeleteMode(false)
    if (remaining.length === 0) {
      setIsEditMode(false)
    }
    toast.success(`Deleted ${count} ${count === 1 ? 'attribute' : 'attributes'}`)
  }

  const handleSpecFieldChange = (id: string, field: keyof ExtendedQTPPSpecificationItem, value: any) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item
        const updated: ExtendedQTPPSpecificationItem = { ...item, [field]: value, userEdited: true }

        // If switching criterion_type to QUALITATIVE: unit is auto-set to 'N/A'
        if (field === 'criterion_type') {
          if (value === 'QUALITATIVE') {
            updated.unit = 'N/A'
            if (!updated.qualitative_text) {
              updated.qualitative_text = 'Conforms to specification'
            }
          } else {
            if (updated.unit === 'N/A') {
              updated.unit = '%'
            }
            if (value === 'RANGE') {
              if (updated.min_value == null) updated.min_value = 95.0
              if (updated.max_value == null) updated.max_value = 105.0
            } else if (value === 'MIN') {
              if (updated.min_value == null) updated.min_value = 90.0
            } else if (value === 'MAX') {
              if (updated.max_value == null) updated.max_value = 0.15
            } else if (value === 'EXACT') {
              if (updated.target_value == null) updated.target_value = 100.0
            }
          }
        }
        return updated
      })
    )
  }

  // Drag and drop reordering
  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx)
  }

  const handleDragOver = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (draggedIdx === null || draggedIdx === targetIdx) return
    const reordered = [...items]
    const [moved] = reordered.splice(draggedIdx, 1)
    reordered.splice(targetIdx, 0, moved)
    setDraggedIdx(targetIdx)
    setItems(reordered.map((r, i) => ({ ...r, sort_order: i })))
  }

  const handleDragEnd = () => {
    setDraggedIdx(null)
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

  // Validation for Step 2 (QTPP Specifications)
  const validateStep2 = (): { valid: boolean; message?: string } => {
    if (items.length === 0) {
      return { valid: false, message: 'Please define at least one Quality Target Product Profile specification.' }
    }
    const seenNames = new Set<string>()
    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx]
      const name = (item.attribute_name || '').trim()
      if (!name) {
        return { valid: false, message: `Attribute #${idx + 1} requires an attribute name.` }
      }
      const lowerName = name.toLowerCase()
      if (seenNames.has(lowerName)) {
        return { valid: false, message: `Duplicate attribute name "${name}". Attribute names must be unique.` }
      }
      seenNames.add(lowerName)

      // Criterion validation rules matching backend
      if (item.criterion_type === 'MIN') {
        if (item.min_value == null || isNaN(Number(item.min_value))) {
          return { valid: false, message: `Attribute "${name}" requires a valid Minimum limit (min_value).` }
        }
      } else if (item.criterion_type === 'MAX') {
        if (item.max_value == null || isNaN(Number(item.max_value))) {
          return { valid: false, message: `Attribute "${name}" requires a valid Maximum limit (max_value).` }
        }
      } else if (item.criterion_type === 'RANGE') {
        if (item.min_value == null || item.max_value == null || isNaN(Number(item.min_value)) || isNaN(Number(item.max_value))) {
          return { valid: false, message: `Attribute "${name}" requires both Minimum and Maximum values.` }
        }
        if (Number(item.min_value) >= Number(item.max_value)) {
          return { valid: false, message: `Attribute "${name}": Minimum value must be strictly less than Maximum.` }
        }
      } else if (item.criterion_type === 'EXACT') {
        if (item.target_value == null || isNaN(Number(item.target_value))) {
          return { valid: false, message: `Attribute "${name}" requires a valid Exact target value.` }
        }
      } else if (item.criterion_type === 'QUALITATIVE') {
        if (!item.qualitative_text || !item.qualitative_text.trim()) {
          return { valid: false, message: `Attribute "${name}" requires a qualitative requirement description.` }
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
        const seeded: ExtendedQTPPSpecificationItem[] = targets.map((t, idx) => ({
          id: `qtpp-extracted-${idx}`,
          attribute_name: t.name,
          attribute_classification: t.name.toLowerCase().includes('impurity') ? 'Purity / related substances' : 'Assay / potency',
          criterion_type: (t.goal === 'Minimize' ? 'MAX' : t.goal === 'Maximize' ? 'MIN' : 'EXACT') as QTPPCriterionType,
          unit: t.unit || '%',
          min_value: t.goal === 'Maximize' ? (t.target_value ?? 90.0) : null,
          max_value: t.goal === 'Minimize' ? (t.target_value ?? 0.15) : null,
          target_value: t.goal === 'Target' ? (t.target_value ?? 100.0) : null,
          qualitative_text: null,
          justification: 'Internal Spec',
          reference_source: 'Description extraction',
          sort_order: idx,
          userEdited: false
        }))
        setItems(seeded)
        setIsEditMode(true)
      }
    }

    setWizardStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Helper for generating formatted display string
  const formatSpecDisplay = (item: ExtendedQTPPSpecificationItem): string => {
    const u = (item.unit || '').trim()
    const uSuffix = u && u.toUpperCase() !== 'N/A' ? ` ${u}` : ''
    const _fmt = (v: number | null | undefined) => v == null ? '' : `${v}`

    if (item.criterion_type === 'MIN') return `>= ${_fmt(item.min_value)}${uSuffix}`.trim()
    if (item.criterion_type === 'MAX') return `<= ${_fmt(item.max_value)}${uSuffix}`.trim()
    if (item.criterion_type === 'RANGE') return `${_fmt(item.min_value)}-${_fmt(item.max_value)}${uSuffix}`.trim()
    if (item.criterion_type === 'EXACT') return `= ${_fmt(item.target_value)}${uSuffix}`.trim()
    return (item.qualitative_text || 'Conforms').trim()
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
      setHeaderError(v2.message || 'Please check QTPP specifications.')
      toast.error(v2.message || 'Please check QTPP specifications.')
      qtppSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
      return
    }
    setHeaderError(null)

    setSaving(true)
    try {
      const cleanDesc = deduplicateDescriptionSections(form.description)
      const extractedTargets = extractTargetsFromDescription(cleanDesc, form.objective, form.compound)
      const validQtpp = items.filter(i => i.attribute_name.trim() !== '').map((s, idx) => ({
        id: s.id,
        attribute: s.attribute_name,
        criterion: formatSpecDisplay(s),
        justification: s.justification,
        type: s.attribute_classification,
        attribute_name: s.attribute_name,
        attribute_classification: s.attribute_classification,
        criterion_type: s.criterion_type,
        unit: s.unit,
        min_value: s.min_value,
        max_value: s.max_value,
        target_value: s.target_value,
        qualitative_text: s.qualitative_text,
        reference_source: s.reference_source,
        sort_order: idx
      }))

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
        // Also save to relational QTPP Specifications endpoint
        await QTPPApi.save(currentProject.id, items)

        const realignSummary = await WorkflowApi.realign(currentProject.id, 'create-project', updatePayload)
        
        setProject({
          ...currentProject,
          ...updatePayload,
          unlocked_step: null
        })
        setQtpp(validQtpp as any)
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
      setQtpp(validQtpp as any)
      setApiTargets(extractedTargets)
      if (proj.stages_data) {
        setStages(proj.stages_data)
      }
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
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Quality Target Product Profile (QTPP) Specifications
                </h2>
                <span className="badge badge-primary" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}>
                  ICH Q8(R2) - Product development
                </span>
              </div>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0.35rem 0 0', lineHeight: 1.4 }}>
                Define the intended quality characteristics and measurable targets for the finished drug product.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {!isDeleteMode ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (items.length === 0) {
                      toast('No attributes to delete.')
                      return
                    }
                    setIsDeleteMode(true)
                  }}
                  style={{
                    color: '#ef4444',
                    borderColor: 'rgba(239, 68, 68, 0.35)',
                    fontWeight: 600
                  }}
                  title="Enter selection mode to delete QTPP attributes"
                >
                  <Trash2 size={14} style={{ marginRight: '0.25rem' }} /> Delete QTPP
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={handleDeleteSelected}
                    style={{
                      backgroundColor: '#ef4444',
                      borderColor: '#dc2626',
                      color: '#ffffff',
                      fontWeight: 600
                    }}
                    title={selectedIds.length === 0 ? "Select attributes below to delete" : `Delete ${selectedIds.length} selected attributes`}
                  >
                    Confirm Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setIsDeleteMode(false)
                      setSelectedIds([])
                    }}
                    title="Cancel deletion and exit selection mode"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleAddRow}
                title="Add a new quality attribute row"
              >
                <Plus size={14} style={{ marginRight: '0.2rem' }} /> Add Attribute
              </button>
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
            <table className="data-table" style={{ width: '100%', minWidth: '1050px', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  {isDeleteMode && (
                    <th style={{ width: '4%', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={items.length > 0 && selectedIds.length === items.length}
                        onChange={() => {
                          if (selectedIds.length === items.length) {
                            setSelectedIds([])
                          } else {
                            setSelectedIds(items.map(i => i.id))
                          }
                        }}
                        title="Select all"
                        style={{ cursor: 'pointer' }}
                      />
                    </th>
                  )}
                  <th style={{ width: isDeleteMode ? '20%' : '24%' }}>Attribute name</th>
                  <th style={{ width: '16%' }}>Target / acceptance criterion</th>
                  <th style={{ width: '8%' }}>Unit</th>
                  <th style={{ width: '28%' }}>Justification</th>
                  <th style={{ width: '24%' }}>Reference / source</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={isDeleteMode ? 6 : 5} style={{ textAlign: 'center', padding: '2.5rem 1.5rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                        No QTPP Attributes Defined Yet
                      </div>
                      <div style={{ fontSize: '0.82rem', maxWidth: '520px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                        In pharmaceutical Quality by Design (ICH Q8(R2)), the QTPP defines patient-relevant targets (Assay, Purity, Dissolution, Impurities) to evaluate experimental outcomes.
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
                    const isQualitative = row.criterion_type === 'QUALITATIVE'

                    return (
                      <tr
                        key={row.id}
                        draggable
                        onDragStart={() => handleDragStart(idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragEnd={handleDragEnd}
                        style={{
                          background: isChecked ? 'rgba(239, 68, 68, 0.04)' : undefined,
                          cursor: 'default',
                          opacity: draggedIdx === idx ? 0.4 : 1
                        }}
                      >
                        {/* Select checkbox (only rendered in delete mode) */}
                        {isDeleteMode && (
                          <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '1rem' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleSelect(row.id)}
                              title={`Select ${row.attribute_name || 'attribute'} to delete`}
                              style={{ cursor: 'pointer' }}
                            />
                          </td>
                        )}

                        {/* Column: Attribute name & Classification selector */}
                        <td style={{ verticalAlign: 'top', paddingTop: '0.8rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                            <input
                              type="text"
                              className="form-input"
                              style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                              placeholder="e.g. Assay"
                              value={row.attribute_name}
                              onChange={e => handleSpecFieldChange(row.id, 'attribute_name', e.target.value)}
                            />

                            {/* Classification selector per row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                Class:
                              </span>
                              <select
                                className="form-select"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', width: '100%' }}
                                value={row.attribute_classification}
                                onChange={e => handleSpecFieldChange(row.id, 'attribute_classification', e.target.value)}
                              >
                                {ATTRIBUTE_CLASSIFICATIONS.map(cls => (
                                  <option key={cls} value={cls}>{cls}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </td>

                        {/* Column 3: Target / acceptance criterion */}
                        <td style={{ verticalAlign: 'top', paddingTop: '0.8rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                            {/* Dynamic Criterion Type Selector */}
                            <select
                              className="form-select"
                              style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', fontWeight: 600, color: '#1e3a8a' }}
                              value={row.criterion_type}
                              onChange={e => handleSpecFieldChange(row.id, 'criterion_type', e.target.value as QTPPCriterionType)}
                            >
                              {CRITERION_TYPE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>

                            {/* Inputs according to criterion_type */}
                            {row.criterion_type === 'MIN' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>≥</span>
                                <input
                                  type="number"
                                  step="any"
                                  className="form-input"
                                  style={{ padding: '0.38rem 0.6rem', fontSize: '0.85rem' }}
                                  placeholder="Min value"
                                  value={row.min_value ?? ''}
                                  onChange={e => handleSpecFieldChange(row.id, 'min_value', e.target.value ? Number(e.target.value) : null)}
                                />
                              </div>
                            )}

                            {row.criterion_type === 'MAX' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>≤</span>
                                <input
                                  type="number"
                                  step="any"
                                  className="form-input"
                                  style={{ padding: '0.38rem 0.6rem', fontSize: '0.85rem' }}
                                  placeholder="Max limit"
                                  value={row.max_value ?? ''}
                                  onChange={e => handleSpecFieldChange(row.id, 'max_value', e.target.value ? Number(e.target.value) : null)}
                                />
                              </div>
                            )}

                            {row.criterion_type === 'RANGE' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <input
                                  type="number"
                                  step="any"
                                  className="form-input"
                                  style={{ padding: '0.38rem 0.5rem', fontSize: '0.85rem', width: '50%' }}
                                  placeholder="Min"
                                  value={row.min_value ?? ''}
                                  onChange={e => handleSpecFieldChange(row.id, 'min_value', e.target.value ? Number(e.target.value) : null)}
                                />
                                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>–</span>
                                <input
                                  type="number"
                                  step="any"
                                  className="form-input"
                                  style={{ padding: '0.38rem 0.5rem', fontSize: '0.85rem', width: '50%' }}
                                  placeholder="Max"
                                  value={row.max_value ?? ''}
                                  onChange={e => handleSpecFieldChange(row.id, 'max_value', e.target.value ? Number(e.target.value) : null)}
                                />
                              </div>
                            )}

                            {row.criterion_type === 'EXACT' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>=</span>
                                <input
                                  type="number"
                                  step="any"
                                  className="form-input"
                                  style={{ padding: '0.38rem 0.6rem', fontSize: '0.85rem' }}
                                  placeholder="Target value"
                                  value={row.target_value ?? ''}
                                  onChange={e => handleSpecFieldChange(row.id, 'target_value', e.target.value ? Number(e.target.value) : null)}
                                />
                              </div>
                            )}

                            {row.criterion_type === 'QUALITATIVE' && (
                              <input
                                type="text"
                                className="form-input"
                                style={{ padding: '0.38rem 0.6rem', fontSize: '0.82rem' }}
                                placeholder="e.g. Immediate release tablet / Conforms"
                                value={row.qualitative_text ?? ''}
                                onChange={e => handleSpecFieldChange(row.id, 'qualitative_text', e.target.value)}
                              />
                            )}
                          </div>
                        </td>

                        {/* Column 4: Unit dropdown */}
                        <td style={{ verticalAlign: 'top', paddingTop: '0.8rem' }}>
                          <select
                            className="form-select"
                            disabled={isQualitative}
                            style={{
                              padding: '0.38rem 0.55rem',
                              fontSize: '0.82rem',
                              background: isQualitative ? '#f8fafc' : '#ffffff',
                              color: isQualitative ? '#94a3b8' : 'inherit',
                              width: '100%'
                            }}
                            value={isQualitative ? 'N/A' : (row.unit || '%')}
                            onChange={e => handleSpecFieldChange(row.id, 'unit', e.target.value)}
                          >
                            {isQualitative ? (
                              <option value="N/A">N/A</option>
                            ) : (
                              <>
                                {QUICK_UNITS.filter(u => u !== 'N/A').map(u => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                                {row.unit && !QUICK_UNITS.includes(row.unit) && (
                                  <option value={row.unit}>{row.unit}</option>
                                )}
                              </>
                            )}
                          </select>
                        </td>

                        {/* Column 5: Justification */}
                        <td style={{ verticalAlign: 'top', paddingTop: '0.8rem' }}>
                          <textarea
                            className="form-input"
                            rows={2}
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem', resize: 'vertical' }}
                            placeholder="e.g. Ensures drug content / Patient efficacy"
                            value={row.justification}
                            onChange={e => handleSpecFieldChange(row.id, 'justification', e.target.value)}
                          />
                        </td>

                        {/* Column 6: Reference / source */}
                        <td style={{ verticalAlign: 'top', paddingTop: '0.8rem' }}>
                          <input
                            type="text"
                            className="form-input"
                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.82rem' }}
                            placeholder="e.g. USP / Applicable specification"
                            value={row.reference_source}
                            onChange={e => handleSpecFieldChange(row.id, 'reference_source', e.target.value)}
                          />
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
