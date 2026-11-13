// frontend/src/components/ProjectTemplateModal.tsx
import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Copy,
  Check,
  Sparkles,
  ClipboardList,
  FileText,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  Plus
} from 'lucide-react'
import toast from 'react-hot-toast'
import {
  FieldKey,
  PROJECT_TEMPLATES
} from '../data/projectTemplates'

export type TabKey = FieldKey

interface ProjectTemplateModalProps {
  isOpen: boolean
  initialTab?: TabKey
  onClose: () => void
  onInsert: (fieldKey: FieldKey, text: string, mode: 'replace' | 'append') => void
  fieldHasContent: (fieldKey: FieldKey) => boolean
  triggerRef?: React.RefObject<HTMLElement | null>
}

interface OverwriteConfirmState {
  targetKey: FieldKey
  textToInsert: string
  actionLabel: string
}

export default function ProjectTemplateModal({
  isOpen,
  initialTab = 'description',
  onClose,
  onInsert,
  fieldHasContent,
  triggerRef
}: ProjectTemplateModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [overwriteConfirm, setOverwriteConfirm] = useState<OverwriteConfirmState | null>(null)

  const modalRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  // Sync activeTab when modal opens with an initialTab
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
    // Focus close button initially
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus()
    }, 50)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      clearTimeout(timer)
      // Return focus to trigger element on close
      if (triggerRef?.current) {
        triggerRef.current.focus()
      }
    }
  }, [isOpen, overwriteConfirm, onClose, triggerRef])

  if (!isOpen) return null

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

  // Trigger insert with overwrite protection
  const triggerInsert = (fieldKey: FieldKey, text: string, actionLabel: string) => {
    if (fieldHasContent(fieldKey)) {
      setOverwriteConfirm({ targetKey: fieldKey, textToInsert: text, actionLabel })
    } else {
      onInsert(fieldKey, text, 'replace')
      onClose()
    }
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

  const currentTemplate = PROJECT_TEMPLATES[activeTab]

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
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
          maxWidth: '920px',
          maxHeight: '86vh',
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
              Use these guides to enter complete details. Well-structured input gives better CPP/CQA seeding and DoE suggestions.
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

        {/* Modal Body: Tabs + Panel */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
            minHeight: 0
          }}
          className="template-modal-body"
        >
          {/* Left Sidebar / Tabs */}
          <div
            style={{
              width: '240px',
              borderRight: '1px solid var(--border)',
              background: '#f8fafc',
              padding: '1rem 0.75rem',
              overflowY: 'auto',
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.35rem'
            }}
            className="template-sidebar"
          >
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                letterSpacing: '0.05em',
                padding: '0.25rem 0.5rem 0.45rem'
              }}
            >
              Fields & Examples
            </div>
            {tabs.map((tab) => {
              const isSelected = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    textAlign: 'left',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                    background: isSelected ? '#e0f2fe' : 'transparent',
                    border: isSelected ? '1px solid rgba(0, 91, 170, 0.3)' : '1px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </div>

          {/* Right Content Panel */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              background: '#ffffff'
            }}
          >
            {currentTemplate ? (
              /* Single Field Tab Content */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* a) What to enter */}
                <div
                  style={{
                    background: 'rgba(0, 91, 170, 0.04)',
                    borderLeft: '4px solid var(--primary)',
                    padding: '0.75rem 1rem',
                    borderRadius: '0 8px 8px 0'
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.2rem' }}>
                    What to enter
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {currentTemplate.guidance}
                  </div>
                </div>

                {/* b) Template Monospace Block */}
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
                        onClick={() => triggerInsert(activeTab as FieldKey, currentTemplate.template, 'Template')}
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
                      maxHeight: activeTab === 'description' ? '220px' : '100px',
                      overflowY: 'auto'
                    }}
                  >
                    {renderHighlightedTemplate(currentTemplate.template)}
                  </div>
                </div>

                {/* c) Filled example */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Sparkles size={14} style={{ color: 'var(--accent)' }} />
                      <span>Filled Example (Rocuronium Bromide)</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.45rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={() => handleCopy(currentTemplate.example, `ex-${activeTab}`)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        {copiedKey === `ex-${activeTab}` ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                        <span>Copy</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-xs"
                        onClick={() => triggerInsert(activeTab as FieldKey, currentTemplate.example, 'Example')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                      >
                        <ArrowRight size={12} />
                        <span>Insert Example</span>
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '8px',
                      padding: '0.85rem 1rem',
                      maxHeight: activeTab === 'description' ? '240px' : '100px',
                      overflowY: 'auto'
                    }}
                  >
                    <pre
                      style={{
                        margin: 0,
                        fontFamily: 'var(--font-mono, monospace)',
                        fontSize: '0.8125rem',
                        lineHeight: 1.55,
                        color: '#14532d',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {currentTemplate.example}
                    </pre>
                  </div>
                  {activeTab === 'description' && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      📌 Illustrative example – replace with your target drug substance or synthesis data.
                    </div>
                  )}
                </div>

                {/* d) Tips & Best Practices */}
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
            ) : null}
          </div>
        </div>

        {/* Overwrite Protection Confirm Modal for Single Field */}
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
                    Field Already Has Content
                  </h3>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Target: <strong style={{ textTransform: 'capitalize' }}>{overwriteConfirm.targetKey}</strong>
                  </p>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                This field already contains text. Do you want to replace the current text or append this {overwriteConfirm.actionLabel.toLowerCase()} to the end?
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setOverwriteConfirm(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    onInsert(overwriteConfirm.targetKey, overwriteConfirm.textToInsert, 'append')
                    setOverwriteConfirm(null)
                    onClose()
                  }}
                >
                  Append
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    onInsert(overwriteConfirm.targetKey, overwriteConfirm.textToInsert, 'replace')
                    setOverwriteConfirm(null)
                    onClose()
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
}

