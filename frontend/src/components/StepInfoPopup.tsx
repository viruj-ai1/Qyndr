import React, { useState, useEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { StepBriefing, STEP_BRIEFINGS } from '../config/stepBriefings'

interface StepInfoPopupProps {
  briefing: StepBriefing
  anchorRect: DOMRect | null
  onClose: () => void
  returnFocusEl: HTMLElement | null
}

export const StepInfoPopup: React.FC<StepInfoPopupProps> = ({
  briefing,
  anchorRect,
  onClose,
  returnFocusEl
}) => {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  // Focus trap / initial focus & Esc handler
  useEffect(() => {
    // Focus close button on mount
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
    // Delay outside click listener slightly so the open click doesn't trigger close
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

  // Calculate position: anchor to the right of the button on wide screens, centered/bottom-sheet on mobile
  const [stylePos, setStylePos] = useState<React.CSSProperties>({
    position: 'fixed',
    zIndex: 99999,
    visibility: 'hidden'
  })

  useEffect(() => {
    if (!dialogRef.current) return
    const isMobile = window.innerWidth <= 640

    if (isMobile) {
      setStylePos({
        position: 'fixed',
        left: '1rem',
        right: '1rem',
        bottom: '1rem',
        maxHeight: '85vh',
        zIndex: 99999,
        visibility: 'visible',
        animation: 'popoverFadeScale 150ms ease-out forwards'
      })
      return
    }

    if (anchorRect) {
      const popupWidth = 360
      const popupHeight = dialogRef.current.offsetHeight || 420
      const padding = 12

      // Preferred position: directly right of the button
      let left = anchorRect.right + 10
      // If overflowing right of screen, place on left of sidebar button
      if (left + popupWidth > window.innerWidth - padding) {
        left = Math.max(padding, anchorRect.left - popupWidth - 10)
      }

      // Vertical align: vertically centered with the button, clamped to viewport
      let top = anchorRect.top + anchorRect.height / 2 - Math.min(popupHeight / 2, 140)
      if (top < padding) top = padding
      if (top + popupHeight > window.innerHeight - padding) {
        top = Math.max(padding, window.innerHeight - popupHeight - padding)
      }

      setStylePos({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        width: `${popupWidth}px`,
        maxHeight: `calc(100vh - ${padding * 2}px)`,
        zIndex: 99999,
        visibility: 'visible',
        animation: 'popoverFadeScale 150ms ease-out forwards'
      })
    } else {
      // Fallback centered
      setStylePos({
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '360px',
        maxHeight: '85vh',
        zIndex: 99999,
        visibility: 'visible',
        animation: 'popoverFadeScale 150ms ease-out forwards'
      })
    }
  }, [anchorRect])

  const stepNumberFormatted = String(briefing.step).padStart(2, '0')

  return ReactDOM.createPortal(
    <>
      {/* Mobile backdrop */}
      <div
        className="step-info-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(2px)',
          zIndex: 99998,
          animation: 'fadeIn 0.15s ease-out'
        }}
        onClick={onClose}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`step-briefing-title-${briefing.id}`}
        style={{
          ...stylePos,
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 40px -10px rgba(0, 40, 80, 0.25), 0 8px 16px -4px rgba(0, 91, 170, 0.15)',
          border: '1.5px solid rgba(0, 174, 179, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: 'var(--text-primary)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient palette matching DoE Wizard */}
        <div
          style={{
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg, #003d73 0%, #005baa 65%, #00aeb3 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.75rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
            flexShrink: 0
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.25rem' }}>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.22)',
                  color: '#ffffff',
                  fontSize: '0.66rem',
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: '10px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase'
                }}
              >
                Step {stepNumberFormatted} Guide
              </span>
              <span style={{ fontSize: '0.72rem', opacity: 0.85, fontWeight: 500 }}>
                QbD Workflow
              </span>
            </div>
            <h3
              id={`step-briefing-title-${briefing.id}`}
              style={{
                fontSize: '1.05rem',
                fontWeight: 800,
                margin: 0,
                color: '#ffffff',
                lineHeight: 1.3
              }}
            >
              {briefing.title}
            </h3>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            aria-label="Close step briefing"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              flexShrink: 0,
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

        {/* Scrollable Content Body */}
        <div
          style={{
            padding: '1.1rem 1.25rem',
            overflowY: 'auto',
            maxHeight: '65vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.9rem',
            fontSize: '0.84rem'
          }}
        >
          {/* Purpose banner */}
          <div
            style={{
              padding: '0.65rem 0.8rem',
              background: 'rgba(0, 91, 170, 0.05)',
              borderRadius: '8px',
              borderLeft: '3.5px solid var(--primary)',
              lineHeight: 1.45,
              color: '#1e293b'
            }}
          >
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--primary)',
                marginBottom: '0.2rem'
              }}
            >
              🎯 Purpose
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>
              {briefing.purpose}
            </div>
          </div>

          {/* Section: What you do here */}
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-muted)',
                marginBottom: '0.4rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <span>👤</span> What you do here
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {briefing.youDo.map((item, i) => (
                <li key={i} style={{ lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Section: What the system does */}
          <div>
            <div
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--text-muted)',
                marginBottom: '0.4rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <span>⚙️</span> What the system does
            </div>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {briefing.systemDoes.map((item, i) => (
                <li key={i} style={{ lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Section: Output passed to next step */}
          <div
            style={{
              padding: '0.65rem 0.8rem',
              background: 'rgba(5, 150, 105, 0.06)',
              borderRadius: '8px',
              border: '1px solid rgba(5, 150, 105, 0.2)',
              lineHeight: 1.45
            }}
          >
            <div
              style={{
                fontSize: '0.68rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--success)',
                marginBottom: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem'
              }}
            >
              <span>📤</span> Output passed forward
            </div>
            <div style={{ fontSize: '0.82rem', color: '#0f766e', fontWeight: 500 }}>
              {briefing.output}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.65rem 1.25rem',
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
            style={{ padding: '0.35rem 0.9rem', fontSize: '0.78rem' }}
          >
            Got it
          </button>
        </div>
      </div>
    </>,
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

