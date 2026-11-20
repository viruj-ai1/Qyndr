// frontend/src/components/WorkflowStepper/RealignSummaryModal.tsx
import React from 'react'
import { CheckCircle2, AlertCircle, ArrowRight, X } from 'lucide-react'

interface RealignSummaryModalProps {
  isOpen: boolean
  summary: {
    edited_step?: string
    changes_detected?: boolean
    affected_steps?: string[]
    details?: Record<string, string>
  } | null
  onClose: () => void
}

export default function RealignSummaryModal({
  isOpen,
  summary,
  onClose
}: RealignSummaryModalProps) {
  if (!isOpen || !summary) return null

  const affected = summary.affected_steps || []
  const details = summary.details || {}

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          maxWidth: '560px',
          width: '100%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0,0,0,0.08)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: 'linear-gradient(135deg, #003d73 0%, #005baa 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <CheckCircle2 size={22} style={{ color: '#4ade80' }} />
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
              Downstream Re-Alignment Summary
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#ffffff',
              padding: '0.25rem'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
            Changes to <strong>{summary.edited_step}</strong> have been saved. Downstream dependencies have been inspected and synchronized.
          </p>

          {affected.length === 0 ? (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                fontSize: '0.85rem',
                color: '#166534'
              }}
            >
              ✓ All downstream parameters remain valid with zero conflict.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.05em' }}>
                Updated Downstream Steps ({affected.length})
              </div>
              {affected.map((stepKey) => (
                <div
                  key={stepKey}
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fef3c7',
                    borderRadius: '8px',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem'
                  }}
                >
                  <AlertCircle size={16} style={{ color: '#d97706', marginTop: '2px', flexShrink: 0 }} />
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#92400e', textTransform: 'capitalize' }}>
                      {stepKey.replace(/-/g, ' ')}
                    </strong>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#78350f' }}>
                      {details[stepKey] || 'Dependencies re-aligned. Please review before proceeding.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.45 }}>
            You will now proceed step-by-step through each step in sequence to confirm the aligned parameters.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end'
          }}
        >
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onClose}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <span>Proceed to Next Step</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
