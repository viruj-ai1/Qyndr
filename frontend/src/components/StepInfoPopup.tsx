import React, { useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { StepBriefing, STEP_BRIEFINGS } from '../config/stepBriefings'

interface StepInfoPopupProps {
  briefing: StepBriefing
  anchorRect?: DOMRect | null
  onClose: () => void
  returnFocusEl?: HTMLElement | null
}

export const StepInfoPopup: React.FC<StepInfoPopupProps> = ({
  briefing,
  onClose,
  returnFocusEl
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Focus trap / initial focus & Esc handler
  useEffect(() => {
    closeBtnRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 10)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
      clearTimeout(timer)
      returnFocusEl?.focus()
    }
  }, [onClose, returnFocusEl])

  const stepNumberFormatted = String(briefing.step).padStart(2, '0')

  return ReactDOM.createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`step-briefing-title-${briefing.id}`}
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '1.25rem',
        animation: 'fadeIn 0.15s ease-out'
      }}
    >
      <div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 10px 25px -5px rgba(0, 91, 170, 0.2)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          animation: 'popoverFadeScale 150ms ease-out forwards',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Modal Header styled exactly like Step 08 Guide */}
        <div
          style={{
            padding: '1.1rem 1.4rem',
            background: 'linear-gradient(135deg, #003d73 0%, #005baa 65%, #00aeb3 100%)',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
            flexShrink: 0
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: '10px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}
              >
                Step {stepNumberFormatted} Guide
              </span>
              <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                QbD Workflow
              </span>
            </div>
            <h3
              id={`step-briefing-title-${briefing.id}`}
              style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#ffffff' }}
            >
              {briefing.title}
            </h3>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem',
              lineHeight: 1,
              transition: 'background 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
          >
            ×
          </button>
        </div>

        {/* Modal Body with clean typography and spacing matching image 1 */}
        <div
          style={{
            padding: '1.25rem 1.4rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            fontSize: '0.84rem',
            lineHeight: 1.5,
            overflowY: 'auto',
            maxHeight: 'calc(85vh - 140px)'
          }}
        >
          {/* Purpose block */}
          <div
            style={{
              background: 'rgba(0, 91, 170, 0.04)',
              padding: '0.75rem 0.9rem',
              borderRadius: '10px',
              borderLeft: '4px solid var(--primary)'
            }}
          >
            <strong
              style={{
                display: 'block',
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--primary)',
                marginBottom: '0.15rem'
              }}
            >
              🎯 Purpose
            </strong>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
              {briefing.purpose}
            </span>
          </div>

          {/* Section: What you do here */}
          <div>
            <strong
              style={{
                display: 'block',
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-primary)',
                marginBottom: '0.25rem'
              }}
            >
              👤 What you do here
            </strong>
            <ul style={{ margin: 0, paddingLeft: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {briefing.youDo.map((item, i) => (
                <li key={i} style={{ color: 'var(--text-secondary)' }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Section: What the system does */}
          <div>
            <strong
              style={{
                display: 'block',
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-primary)',
                marginBottom: '0.25rem'
              }}
            >
              ⚙️ What the system does
            </strong>
            <ul style={{ margin: 0, paddingLeft: '1.15rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {briefing.systemDoes.map((item, i) => (
                <li key={i} style={{ color: 'var(--text-secondary)' }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Section: Output passed forward */}
          <div
            style={{
              background: 'rgba(5, 150, 105, 0.06)',
              padding: '0.7rem 0.9rem',
              borderRadius: '10px',
              border: '1px solid rgba(5, 150, 105, 0.2)'
            }}
          >
            <strong
              style={{
                display: 'block',
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#059669',
                marginBottom: '0.15rem'
              }}
            >
              📤 Output passed forward
            </strong>
            <span style={{ color: '#0f766e', fontWeight: 500 }}>
              {briefing.output}
            </span>
          </div>
        </div>

        {/* Modal Footer with "Got it" button */}
        <div
          style={{
            padding: '0.8rem 1.4rem',
            background: '#f8fafc',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'flex-end',
            flexShrink: 0
          }}
        >
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={onClose}
            style={{ padding: '0.4rem 1.25rem', fontSize: '0.82rem', borderRadius: '6px', fontWeight: 600 }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

interface StepInfoButtonProps {
  stepId: string
  stepTitle: string
  stepNumber: number
  isOpen: boolean
  onToggle: (btnEl: HTMLElement, briefing: StepBriefing) => void
}

export const StepInfoButton: React.FC<StepInfoButtonProps> = ({
  stepId,
  stepTitle,
  stepNumber,
  isOpen,
  onToggle
}) => {
  const btnRef = useRef<HTMLButtonElement>(null)
  const briefing = STEP_BRIEFINGS[stepId]

  if (!briefing) return null

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    e.preventDefault()
    if (btnRef.current) {
      onToggle(btnRef.current, briefing)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.stopPropagation()
      e.preventDefault()
      if (btnRef.current) {
        onToggle(btnRef.current, briefing)
      }
    }
  }

  return (
    <button
      ref={btnRef}
      type="button"
      className="step-info-btn"
      aria-label={`About step ${stepNumber}: ${stepTitle}`}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        width: '22px',
        height: '22px',
        minWidth: '22px',
        borderRadius: '50%',
        border: '1px solid transparent',
        background: isOpen ? 'rgba(0, 91, 170, 0.15)' : 'transparent',
        color: isOpen ? 'var(--primary)' : 'var(--text-muted)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        cursor: 'pointer',
        fontSize: '0.72rem',
        fontFamily: 'serif',
        fontStyle: 'italic',
        fontWeight: 700,
        marginLeft: 'auto',
        flexShrink: 0,
        transition: 'all 0.15s ease'
      }}
      title={`What happens in ${stepTitle}?`}
    >
      i
    </button>
  )
}


