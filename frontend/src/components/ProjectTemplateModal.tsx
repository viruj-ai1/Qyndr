// frontend/src/components/ProjectTemplateModal.tsx
import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import {
  X,
  Copy,
  Check,
  Sparkles,
  ClipboardList,
  FileText,
  AlertTriangle,
  Lightbulb,
  Plus,
  Upload,
  RefreshCw,
  Loader2,
  Trash2,
  CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  FieldKey,
  PROJECT_TEMPLATES
} from '../data/projectTemplates'
import { ProjectInputApi } from '../services/api'
import type { ProjectInputField, SingleProjectInputField } from '../types/projectInput'

export type TabKey = FieldKey

interface AlignedFieldState {
  rawText: string
  fileName?: string
  alignedValue?: string
  missing: string[]
  warnings: string[]
  status: 'idle' | 'loading' | 'success' | 'error'
  error?: string
}

interface ProjectTemplateModalProps {
  isOpen: boolean
  initialTab?: TabKey
  onClose: () => void
  onInsert: (fieldKey: FieldKey, text: string, mode: 'replace' | 'append') => void
  onBatchApply?: (values: Partial<Record<FieldKey, string>>) => void
  fieldHasContent: (fieldKey: FieldKey) => boolean
  triggerRef?: React.RefObject<HTMLElement | null>
}

interface OverwriteConfirmState {
  type: 'single' | 'batch'
  targetKey?: FieldKey
  singleText?: string
  batchValues?: Partial<Record<FieldKey, string>>
  conflicts: FieldKey[]
}

const TAB_TO_FIELD: Record<FieldKey, SingleProjectInputField> = {
  projectName: 'project_name',
  compound: 'compound_api',
  objective: 'primary_objective',
  description: 'project_description'
}

const FIELD_TO_TAB: Record<string, FieldKey> = {
  project_name: 'projectName',
  compound_api: 'compound',
  primary_objective: 'objective',
  project_description: 'description'
}

export default function ProjectTemplateModal({
  isOpen,
  initialTab = 'description',
  onClose,
  onInsert,
  onBatchApply,
  fieldHasContent,
  triggerRef
}: ProjectTemplateModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [overwriteConfirm, setOverwriteConfirm] = useState<OverwriteConfirmState | null>(null)
  const [alignAllFields, setAlignAllFields] = useState<boolean>(false)

  // Per-tab user raw text & alignment state
  const [tabData, setTabData] = useState<Record<TabKey, AlignedFieldState>>({
    projectName: { rawText: '', missing: [], warnings: [], status: 'idle' },
    compound:    { rawText: '', missing: [], warnings: [], status: 'idle' },
    objective:   { rawText: '', missing: [], warnings: [], status: 'idle' },
    description: { rawText: '', missing: [], warnings: [], status: 'idle' }
  })

  // Global upload loading state
  const [uploadingFile, setUploadingFile] = useState(false)

  const modalRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const rawTextareaRef = useRef<HTMLTextAreaElement | null>(null)

  // Sync activeTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      setOverwriteConfirm(null)
    }
  }, [isOpen, initialTab])

  // Focus trap & Escape key handler
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (overwriteConfirm) {
          setOverwriteConfirm(null)
        } else {
          onClose()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus()
    }, 50)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      clearTimeout(timer)
      if (triggerRef?.current) {
        triggerRef.current.focus()
      }
    }
  }, [isOpen, overwriteConfirm, onClose, triggerRef])

  if (!isOpen) return null

  const currentTabState = tabData[activeTab]
  const currentTemplate = PROJECT_TEMPLATES[activeTab]

  // Update per-tab raw text
  const handleRawTextChange = (text: string) => {
    setTabData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        rawText: text,
        // Reset error on edit
        status: prev[activeTab].status === 'error' ? 'idle' : prev[activeTab].status,
        error: undefined
      }
    }))
  }

  // File Upload Handler (.txt, .docx, .pdf, .xlsx, .csv)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    try {
      const resp = await ProjectInputApi.extractDoc(file)
      setTabData(prev => ({
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          rawText: resp.extracted_text,
          fileName: resp.filename,
          status: 'idle',
          error: undefined
        }
      }))
      toast.success(`Extracted ${resp.char_count.toLocaleString()} characters from ${resp.filename}`)
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'File extraction failed'
      toast.error(msg)
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Remove uploaded file chip
  const handleRemoveFileChip = () => {
    setTabData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        fileName: undefined
      }
    }))
  }

  // Auto-Align API Call
  const handleAutoAlign = async () => {
    const raw = currentTabState.rawText.trim()
    if (!raw) return

    const targetField: ProjectInputField = alignAllFields ? 'all' : TAB_TO_FIELD[activeTab]

    setTabData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        status: 'loading',
        error: undefined
      }
    }))

    try {
      const resp = await ProjectInputApi.align({
        field: targetField,
        raw_text: raw
      })

      if (alignAllFields) {
        // Distribute to all tabs
        setTabData(prev => {
          const next = { ...prev }
          for (const [backendField, value] of Object.entries(resp.aligned)) {
            const tabKey = FIELD_TO_TAB[backendField]
            if (tabKey && value) {
              next[tabKey] = {
                ...next[tabKey],
                rawText: raw, // keep same raw text for all tabs
                alignedValue: value,
                missing: resp.missing[backendField] || [],
                warnings: resp.warnings || [],
                status: 'success',
                error: undefined
              }
            }
          }
          return next
        })
        toast.success('Auto-aligned all 4 project fields from your data ✓')
      } else {
        // Single active tab update
        const singleKey = TAB_TO_FIELD[activeTab]
        const alignedVal = resp.aligned[singleKey] || '[Not provided]'
        const missingList = resp.missing[singleKey] || []

        setTabData(prev => ({
          ...prev,
          [activeTab]: {
            ...prev[activeTab],
            alignedValue: alignedVal,
            missing: missingList,
            warnings: resp.warnings || [],
            status: 'success',
            error: undefined
          }
        }))
        toast.success(`Aligned ${currentTemplate.label} ✓`)
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Auto-alignment failed'
      setTabData(prev => ({
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          status: 'error',
          error: msg
        }
      }))
      toast.error(msg)
    }
  }

  // Editable aligned text change
  const handleAlignedValueChange = (val: string) => {
    setTabData(prev => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        alignedValue: val
      }
    }))
  }

  // Clear aligned result for active tab
  const handleClear = () => {
    setTabData(prev => ({
      ...prev,
      [activeTab]: {
        rawText: '',
        fileName: undefined,
        alignedValue: undefined,
        missing: [],
        warnings: [],
        status: 'idle',
        error: undefined
      }
    }))
  }

  // Copy helper
  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(id)
      toast.success('Copied to clipboard ✓')
      setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      toast.error('Failed to copy')
    }
  }

  // Trigger insert for Blank Template
  const triggerInsertBlankTemplate = (fieldKey: FieldKey, text: string) => {
    if (fieldHasContent(fieldKey)) {
      setOverwriteConfirm({
        type: 'single',
        targetKey: fieldKey,
        singleText: text,
        conflicts: [fieldKey]
      })
    } else {
      onInsert(fieldKey, text, 'replace')
      onClose()
    }
  }

  // Trigger Apply to Form for aligned data
  const handleApplyToForm = () => {
    if (alignAllFields) {
      // Gather all fields that have an alignedValue
      const batchValues: Partial<Record<FieldKey, string>> = {}
      const conflicts: FieldKey[] = []

      ;(Object.keys(tabData) as FieldKey[]).forEach(k => {
        const val = tabData[k].alignedValue
        if (val && val.trim()) {
          batchValues[k] = val
          if (fieldHasContent(k)) {
            conflicts.push(k)
          }
        }
      })

      if (Object.keys(batchValues).length === 0) {
        toast.error('No aligned data available to apply')
        return
      }

      if (conflicts.length > 0) {
        setOverwriteConfirm({
          type: 'batch',
          batchValues,
          conflicts
        })
      } else {
        executeBatchApply(batchValues)
      }
    } else {
      const val = currentTabState.alignedValue
      if (!val || !val.trim()) {
        toast.error('No aligned data to apply')
        return
      }

      if (fieldHasContent(activeTab)) {
        setOverwriteConfirm({
          type: 'single',
          targetKey: activeTab,
          singleText: val,
          conflicts: [activeTab]
        })
      } else {
        executeSingleApply(activeTab, val)
      }
    }
  }

  const executeSingleApply = (fieldKey: FieldKey, text: string) => {
    onInsert(fieldKey, text, 'replace')
    setOverwriteConfirm(null)
    onClose()
  }

  const executeBatchApply = (values: Partial<Record<FieldKey, string>>) => {
    if (onBatchApply) {
      onBatchApply(values)
    } else {
      Object.entries(values).forEach(([k, v]) => {
        if (v) onInsert(k as FieldKey, v, 'replace')
      })
    }
    setOverwriteConfirm(null)
    onClose()
  }

  // Highlight bracketed [PLACEHOLDERS] in monospace block
  const renderHighlightedTemplate = (text: string) => {
    const parts = text.split(/(\[[^\]]+\])/g)
    return (
      <pre
        style={{
          margin: 0,
          fontFamily: 'var(--font-mono, "SFMono-Regular", Consolas, monospace)',
          fontSize: '0.8125rem',
          lineHeight: 1.55,
          color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {parts.map((part, idx) => {
          if (part.startsWith('[') && part.endsWith(']')) {
            return (
              <span
                key={idx}
                style={{
                  background: 'rgba(0, 91, 170, 0.12)',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  border: '1px solid rgba(0, 91, 170, 0.25)'
                }}
              >
                {part}
              </span>
            )
          }
          return <span key={idx}>{part}</span>
        })}
      </pre>
    )
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'projectName', label: 'Project Name' },
    { key: 'compound', label: 'Compound / API' },
    { key: 'objective', label: 'Primary Objective' },
    { key: 'description', label: 'Project Description' }
  ]

  const projectNameLen = (activeTab === 'projectName' && currentTabState.alignedValue) ? currentTabState.alignedValue.length : 0

  const modalElement = (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem 1rem'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (overwriteConfirm) {
            setOverwriteConfirm(null)
          } else {
            onClose()
          }
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Project Input Templates"
    >
      <div
        ref={modalRef}
        style={{
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '12px',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0,0,0,0.08)',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, #003d73 0%, #005baa 65%, #00aeb3 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ClipboardList size={22} style={{ color: '#67e8f9' }} />
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                Project Input Templates
              </h2>
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              Structure your project notes into standardized QbD fields with intelligent template auto-alignment.
            </p>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              borderRadius: '6px',
              padding: '0.45rem',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Left Tab List + Right Detail View */}
        <div className="template-modal-body" style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Left Tab List */}
          <div
            className="template-sidebar"
            style={{
              width: '240px',
              minWidth: '240px',
              borderRight: '1px solid var(--border)',
              background: '#f8fafc',
              padding: '1rem 0.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem',
              overflowY: 'auto'
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '0.25rem 0.5rem 0.5rem' }}>
              Project Fields
            </div>
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              const hasAligned = Boolean(tabData[tab.key].alignedValue)
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: isActive ? 'var(--primary)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-secondary)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(0, 91, 170, 0.08)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <span>{tab.label}</span>
                  {hasAligned && (
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: isActive ? '#a7f3d0' : '#10b981'
                      }}
                      title="Has aligned data"
                    />
                  )}
                </button>
              )
            })}
          </div>

          {/* Right Content Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.25rem 1.75rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}
          >
            {/* a) What to enter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                What to Enter
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {currentTemplate.guidance}
              </div>
            </div>

            {/* b) Blank Template Monospace Block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <FileText size={14} />
                  <span>Blank Template with Placeholders</span>
                </div>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => handleCopy(currentTemplate.template, `tpl-${activeTab}`)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    {copiedKey === `tpl-${activeTab}` ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                    <span>Copy</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-xs"
                    onClick={() => triggerInsertBlankTemplate(activeTab, currentTemplate.template)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Plus size={12} />
                    <span>Insert Template</span>
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  maxHeight: activeTab === 'description' ? '180px' : '90px',
                  overflowY: 'auto'
                }}
              >
                {renderHighlightedTemplate(currentTemplate.template)}
              </div>
            </div>

            {/* c) YOUR DATA (AUTO-ALIGN TO TEMPLATE) */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '1.1rem 1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', letterSpacing: '0.04em' }}>
                  <Sparkles size={15} style={{ color: 'var(--accent)' }} />
                  <span>YOUR DATA (AUTO-ALIGN TO TEMPLATE)</span>
                </div>
              </div>

              {/* Removable file chip if present */}
              {currentTabState.fileName && (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    background: '#e0f2fe',
                    color: '#0369a1',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    width: 'fit-content'
                  }}
                >
                  <span>📎 {currentTabState.fileName}</span>
                  <button
                    type="button"
                    onClick={handleRemoveFileChip}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#0369a1', padding: '0 2px' }}
                    title="Remove file"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}

              {/* Textarea */}
              <textarea
                ref={rawTextareaRef}
                className="form-textarea"
                rows={activeTab === 'description' ? 5 : 3}
                placeholder="Paste your notes, batch record text, spec sheet or rough description here. It will be aligned to the template above."
                value={currentTabState.rawText}
                onChange={(e) => handleRawTextChange(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault()
                    if (currentTabState.rawText.trim() && currentTabState.status !== 'loading') {
                      handleAutoAlign()
                    }
                  }
                }}
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.825rem',
                  lineHeight: 1.5,
                  background: '#ffffff',
                  borderColor: '#cbd5e1'
                }}
              />

              {/* Controls bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontSize: '0.8rem',
                    color: '#475569',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={alignAllFields}
                    onChange={(e) => setAlignAllFields(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <span>Align all four fields from this data</span>
                </label>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleAutoAlign}
                    disabled={!currentTabState.rawText.trim() || currentTabState.status === 'loading'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontWeight: 700,
                      padding: '0.45rem 1.1rem'
                    }}
                    title="Shortcut: Ctrl+Enter or Cmd+Enter"
                  >
                    {currentTabState.status === 'loading' ? (
                      <>
                        <Loader2 size={14} className="spin" />
                        <span>Auto-Aligning…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>Auto-Align</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Error message with Retry button */}
              {currentTabState.status === 'error' && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '6px',
                    padding: '0.65rem 0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.5rem',
                    fontSize: '0.8rem',
                    color: '#991b1b'
                  }}
                >
                  <span>⚠️ {currentTabState.error || 'Alignment failed'}</span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={handleAutoAlign}
                    style={{ color: '#991b1b', borderColor: '#fca5a5' }}
                  >
                    <RefreshCw size={12} style={{ marginRight: '4px' }} />
                    Retry
                  </button>
                </div>
              )}
            </div>

            {/* d) ALIGNED PREVIEW (Shown after successful alignment) */}
            {currentTabState.status === 'success' && currentTabState.alignedValue && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1.5px solid #86efac',
                  borderRadius: '10px',
                  padding: '1.1rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle2 size={16} color="#16a34a" />
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: '#15803d', letterSpacing: '0.04em' }}>
                      ALIGNED PREVIEW ({currentTemplate.label})
                    </span>
                  </div>

                  {activeTab === 'projectName' && (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        color: projectNameLen > 80 ? '#dc2626' : '#15803d'
                      }}
                    >
                      {projectNameLen} / 80 characters {projectNameLen > 80 && '(⚠️ exceeds recommended limit)'}
                    </div>
                  )}
                </div>

                {/* Editable Preview Input / Textarea */}
                {activeTab === 'description' ? (
                  <textarea
                    className="form-textarea"
                    rows={8}
                    value={currentTabState.alignedValue}
                    onChange={(e) => handleAlignedValueChange(e.target.value)}
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '0.825rem',
                      lineHeight: 1.5,
                      background: '#ffffff',
                      borderColor: '#86efac',
                      minHeight: '180px'
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    className="form-input"
                    value={currentTabState.alignedValue}
                    onChange={(e) => handleAlignedValueChange(e.target.value)}
                    style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: '0.85rem',
                      background: '#ffffff',
                      borderColor: '#86efac'
                    }}
                  />
                )}

                {/* Missing elements highlight */}
                {currentTabState.missing && currentTabState.missing.length > 0 && (
                  <div
                    style={{
                      background: '#fef3c7',
                      border: '1px solid #fde68a',
                      borderRadius: '6px',
                      padding: '0.5rem 0.75rem',
                      fontSize: '0.78rem',
                      color: '#92400e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      flexWrap: 'wrap'
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>Missing from your notes:</span>
                    <span>{currentTabState.missing.join(', ')}</span>
                    <span style={{ color: '#b45309', fontStyle: 'italic' }}>(marked as [Not provided] above)</span>
                  </div>
                )}

                {/* Warnings if any */}
                {currentTabState.warnings && currentTabState.warnings.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#b45309' }}>
                    {currentTabState.warnings.map((w, idx) => (
                      <div key={idx}>⚠️ {w}</div>
                    ))}
                  </div>
                )}

                {/* Preview Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleClear}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Trash2 size={13} />
                    <span>Clear</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleAutoAlign}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <RefreshCw size={13} />
                    <span>Re-run</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={handleApplyToForm}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontWeight: 700,
                      padding: '0.45rem 1.25rem'
                    }}
                  >
                    <Check size={14} />
                    <span>Apply to Form</span>
                  </button>
                </div>
              </div>
            )}

            {/* e) Tips & Best Practices */}
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: '8px',
                padding: '0.85rem 1rem'
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#92400e', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                <Lightbulb size={14} />
                <span>Best Practices & Tips</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8125rem', color: '#78350f', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                {currentTemplate.tips.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Overwrite Protection Confirm Modal */}
        {overwriteConfirm && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(3px)',
              zIndex: 1100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1.5rem'
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: '10px',
                padding: '1.5rem',
                maxWidth: '460px',
                width: '100%',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <div style={{ background: '#fef3c7', padding: '0.5rem', borderRadius: '50%', color: '#d97706' }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Replace Existing Content?
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Target field(s) with data: <strong style={{ textTransform: 'capitalize' }}>{overwriteConfirm.conflicts.join(', ')}</strong>
                  </p>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                {overwriteConfirm.type === 'batch'
                  ? 'One or more form fields already contain text. Do you want to overwrite them with the auto-aligned data?'
                  : 'This form field already contains text. Do you want to replace the current text or append the new content?'}
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setOverwriteConfirm(null)}
                >
                  Cancel
                </button>
                {overwriteConfirm.type === 'single' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (overwriteConfirm.targetKey && overwriteConfirm.singleText) {
                        onInsert(overwriteConfirm.targetKey, overwriteConfirm.singleText, 'append')
                      }
                      setOverwriteConfirm(null)
                      onClose()
                    }}
                  >
                    Append
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    if (overwriteConfirm.type === 'batch' && overwriteConfirm.batchValues) {
                      executeBatchApply(overwriteConfirm.batchValues)
                    } else if (overwriteConfirm.targetKey && overwriteConfirm.singleText) {
                      executeSingleApply(overwriteConfirm.targetKey, overwriteConfirm.singleText)
                    }
                  }}
                >
                  Replace
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          .template-modal-body {
            flex-direction: column !important;
          }
          .template-sidebar {
            width: 100% !important;
            flex-direction: row !important;
            border-right: none !important;
            border-bottom: 1px solid var(--border) !important;
            overflow-x: auto !important;
            white-space: nowrap !important;
            padding: 0.5rem !important;
          }
        }
      `}</style>
    </div>
  )

  if (typeof document !== 'undefined') {
    return ReactDOM.createPortal(modalElement, document.body)
  }

  return modalElement
}
