// frontend/src/components/ProjectTemplateModal.tsx
import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import {
  X,
  Copy,
  Check,
  ClipboardList,
  FileText,
  Lightbulb
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
  onInsert?: (fieldKey: FieldKey, text: string, mode: 'replace' | 'append') => void
  onBatchApply?: (values: Partial<Record<FieldKey, string>>) => void
  fieldHasContent?: (fieldKey: FieldKey) => boolean
  triggerRef?: React.RefObject<HTMLElement | null>
}

export default function ProjectTemplateModal({
  isOpen,
  initialTab = 'description',
  onClose,
  triggerRef
}: ProjectTemplateModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const modalRef = useRef<HTMLDivElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  // Sync activeTab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  // Focus trap & Escape key handler
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
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
  }, [isOpen, onClose, triggerRef])

  if (!isOpen) return null

  const currentTemplate = PROJECT_TEMPLATES[activeTab]

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

  // Helper to render template text with highlighted bracket placeholders
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
          onClose()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Project Input Reference Guide"
    >
      <div
        ref={modalRef}
        style={{
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '12px',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(0,0,0,0.08)',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
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
                Project Input Reference Guide
              </h2>
            </div>
            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.9)' }}>
              Reference guidelines and examples on how to structure information for each project setup field.
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
                  <span>Standard Format & Placeholders</span>
                </div>
                <div style={{ display: 'flex', gap: '0.45rem' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => handleCopy(currentTemplate.template, `tpl-${activeTab}`)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    {copiedKey === `tpl-${activeTab}` ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                    <span>Copy Format</span>
                  </button>
                </div>
              </div>

              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '0.85rem 1rem',
                  maxHeight: activeTab === 'description' ? '240px' : '110px',
                  overflowY: 'auto'
                }}
              >
                {renderHighlightedTemplate(currentTemplate.template)}
              </div>
            </div>

            {/* c) Tips & Best Practices */}
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
