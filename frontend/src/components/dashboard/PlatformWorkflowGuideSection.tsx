import React, { useState } from 'react';
import { PLATFORM_WORKFLOW_INTRO_DATA, PLATFORM_PHASES } from '../../data/platformGuide';

export interface PlatformWorkflowGuideSectionProps {
  id?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const PlatformWorkflowGuideSection: React.FC<PlatformWorkflowGuideSectionProps> = ({
  id = 'platform-workflow-guide',
  isExpanded: controlledExpanded,
  onToggleExpand
}) => {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const handleToggle = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded(!internalExpanded);
    }
  };

  // Phase collapse/expand state (all open by default)
  const [openPhases, setOpenPhases] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    PLATFORM_PHASES.forEach(p => {
      init[p.id] = true;
    });
    return init;
  });

  // Step details collapse/expand state (all closed by default)
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});

  const togglePhase = (phaseId: string) => {
    setOpenPhases(prev => ({
      ...prev,
      [phaseId]: !prev[phaseId]
    }));
  };

  const toggleStep = (stepNumber: number) => {
    setOpenSteps(prev => ({
      ...prev,
      [stepNumber]: !prev[stepNumber]
    }));
  };

  const expandAllSteps = () => {
    const next: Record<number, boolean> = {};
    const phasesNext: Record<string, boolean> = {};
    PLATFORM_PHASES.forEach(phase => {
      phasesNext[phase.id] = true;
      phase.steps.forEach(step => {
        next[step.number] = true;
      });
    });
    setOpenPhases(phasesNext);
    setOpenSteps(next);
  };

  const collapseAllSteps = () => {
    setOpenSteps({});
  };

  const tealColor = '#0d9488'; // distinct brand teal tone
  const totalPhases = PLATFORM_PHASES.length;

  return (
    <div style={{ marginTop: '1.5rem', marginBottom: '2rem' }}>
      {/* ── Section Label & Thin Divider ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '0.85rem',
          paddingTop: '0.5rem'
        }}
      >
        <span
          style={{
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}
        >
          REFERENCE
        </span>
        <div style={{ flex: 1, height: '1px', background: 'var(--border)', opacity: 0.8 }} />
      </div>

      {/* ── Collapsible Row / Card ── */}
      <section
        id={id}
        className="project-section"
        style={{
          margin: 0,
          background: 'white',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
          transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
        }}
      >
        {/* Row Header (Clickable) */}
        <div
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-controls={`${id}-body`}
          onClick={handleToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleToggle();
            }
          }}
          className="project-section-header"
          style={{
            margin: 0,
            border: 'none',
            borderRadius: 0,
            boxShadow: 'none',
            cursor: 'pointer',
            userSelect: 'none'
          }}
        >
          <div className="project-section-header-left">
            {/* Left Accent Bar */}
            <div
              className="stage-indicator-bar"
              style={{ backgroundColor: tealColor }}
            />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                {/* Title & Icon */}
                <h3 className="project-section-title">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: tealColor }}>
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                  </svg>
                  <span>Platform Workflow Guide</span>
                </h3>

                {/* Badge Pill: GUIDE */}
                <span
                  className="stage-badge"
                  style={{
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    color: tealColor,
                    border: '1px solid rgba(13, 148, 136, 0.3)',
                    fontSize: '0.75rem',
                    padding: '0.18rem 0.5rem',
                    fontWeight: 700,
                    borderRadius: '4px'
                  }}
                >
                  GUIDE
                </span>

                {/* Count Bubble: 4 */}
                <span
                  className="badge"
                  style={{
                    backgroundColor: '#f1f5f9',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.55rem',
                    borderRadius: '999px'
                  }}
                >
                  {totalPhases}
                </span>
              </div>

              {/* Subtitle */}
              <div className="project-section-subtitle" style={{ marginTop: '0.25rem', fontSize: '0.8125rem' }}>
                Overview &amp; step-by-step walkthrough · Phases 0–3
              </div>
            </div>
          </div>

          {/* Right: Expand / Collapse Button */}
          <div className="project-section-header-right">
            <button
              type="button"
              className="section-collapse-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleToggle();
              }}
              aria-label={isExpanded ? 'Collapse Platform Workflow Guide' : 'Expand Platform Workflow Guide'}
              title={isExpanded ? 'Collapse guide' : 'Expand guide'}
              style={{ fontSize: '0.75rem' }}
            >
              <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
              <span style={{ fontSize: '0.72rem', display: 'inline-block' }}>
                {isExpanded ? '▼' : '▶'}
              </span>
            </button>
          </div>
        </div>

        {/* ── Expanded Content Body ── */}
        {isExpanded && (
          <div
            id={`${id}-body`}
            style={{
              borderTop: '1px solid var(--border)',
              padding: '1.25rem 1.5rem',
              background: '#ffffff',
              animation: 'fadeIn 0.2s ease-in-out'
            }}
          >
            {/* Top Bar inside Guide Body: Intro + Expand/Collapse all controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                marginBottom: '0.75rem',
                gap: '0.75rem'
              }}
            >
              {/* Expand all / Collapse all links */}
              <button
                type="button"
                onClick={expandAllSteps}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                Expand all details
              </button>
              <span style={{ color: 'var(--border)' }}>|</span>
              <button
                type="button"
                onClick={collapseAllSteps}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline'
                }}
              >
                Collapse all details
              </button>
            </div>

            {/* Structured Intro Callout Box */}
            <div
              style={{
                padding: '1.1rem 1.25rem',
                borderRadius: '8px',
                background: 'rgba(239, 246, 255, 0.75)',
                border: '1px solid #bfdbfe',
                color: '#1e3a8a',
                fontSize: '0.835rem',
                lineHeight: 1.55,
                marginBottom: '1.25rem'
              }}
            >
              {/* 1) Title */}
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.92rem',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  color: '#1d4ed8'
                }}
              >
                <span>💡</span> {PLATFORM_WORKFLOW_INTRO_DATA.title}
              </div>

              {/* 2) Intro paragraph */}
              <p style={{ margin: '0 0 1rem 0', color: '#1e3a8a', fontSize: '0.84rem', lineHeight: 1.55 }}>
                {PLATFORM_WORKFLOW_INTRO_DATA.introParagraph}
              </p>

              {/* 3) "How it works" 4 mini-cards row */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '0.75rem',
                  marginBottom: '1rem'
                }}
              >
                {PLATFORM_WORKFLOW_INTRO_DATA.howItWorks.map((card) => {
                  return (
                    <div
                      key={card.phaseId}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #bfdbfe',
                        borderRadius: '6px',
                        padding: '0.65rem 0.8rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        boxShadow: '0 1px 2px rgba(30, 58, 138, 0.04)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            color: '#2563eb',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            background: 'rgba(37, 99, 235, 0.08)',
                            padding: '1px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          {card.phaseTag}
                        </span>
                        <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>
                          {card.title}
                        </strong>
                      </div>
                      <div style={{ fontSize: '0.76rem', color: '#475569', lineHeight: 1.45 }}>
                        {card.description}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 4) "What you get" line */}
              <div
                style={{
                  fontSize: '0.8rem',
                  color: '#1e3a8a',
                  lineHeight: 1.5,
                  paddingTop: '0.5rem',
                  borderTop: '1px solid rgba(191, 219, 254, 0.7)',
                  marginBottom: '0.35rem'
                }}
              >
                <strong style={{ color: '#1d4ed8' }}>What you get:</strong>{' '}
                <span>{PLATFORM_WORKFLOW_INTRO_DATA.whatYouGet.join(' · ')}</span>
              </div>

              {/* 5) "Best for" line */}
              <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.45 }}>
                <strong style={{ color: '#475569' }}>Best for:</strong>{' '}
                <span>{PLATFORM_WORKFLOW_INTRO_DATA.bestFor}</span>
              </div>
            </div>

            {/* ── 4 Phases List ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {PLATFORM_PHASES.map((phase) => {
                const isPhaseOpen = openPhases[phase.id] !== false;

                return (
                  <div
                    key={phase.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      background: '#f8fafc'
                    }}
                  >
                    {/* Phase Header */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => togglePhase(phase.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          togglePhase(phase.id);
                        }
                      }}
                      style={{
                        padding: '0.7rem 1rem',
                        background: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        userSelect: 'none',
                        borderBottom: isPhaseOpen ? '1px solid #e2e8f0' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          {isPhaseOpen ? '▼' : '▶'}
                        </span>
                        <h4
                          style={{
                            margin: 0,
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            color: '#1e293b'
                          }}
                        >
                          {phase.title}
                        </h4>
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-muted)',
                          fontWeight: 600
                        }}
                      >
                        {phase.steps.length} steps
                      </span>
                    </div>

                    {/* Phase Steps Body */}
                    {isPhaseOpen && (
                      <div
                        style={{
                          padding: '0.75rem 1rem',
                          background: '#ffffff',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.5rem'
                        }}
                      >
                        {phase.steps.map((step) => {
                          const isStepOpen = Boolean(openSteps[step.number]);

                          return (
                            <div
                              key={step.number}
                              style={{
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                overflow: 'hidden',
                                background: isStepOpen ? '#f8fafc' : '#ffffff',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {/* Step Compact Row (Clickable) */}
                              <div
                                role="button"
                                tabIndex={0}
                                aria-expanded={isStepOpen}
                                onClick={() => toggleStep(step.number)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleStep(step.number);
                                  }
                                }}
                                style={{
                                  padding: '0.55rem 0.85rem',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  cursor: 'pointer',
                                  userSelect: 'none'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      width: '22px',
                                      height: '22px',
                                      borderRadius: '999px',
                                      background: isStepOpen ? 'rgba(13, 148, 136, 0.15)' : '#f1f5f9',
                                      color: isStepOpen ? tealColor : 'var(--text-secondary)',
                                      fontSize: '0.72rem',
                                      fontWeight: 800,
                                      flexShrink: 0
                                    }}
                                  >
                                    {step.number}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '0.84rem',
                                      fontWeight: 700,
                                      color: '#0f172a'
                                    }}
                                  >
                                    {step.name}
                                  </span>
                                </div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {isStepOpen ? 'Hide details ▲' : 'Details ▼'}
                                </span>
                              </div>

                              {/* Step Details (Expanded rich view) */}
                              {isStepOpen && (
                                <div
                                  style={{
                                    padding: '0.75rem 1rem 0.85rem 2.5rem',
                                    borderTop: '1px solid #edf2f7',
                                    fontSize: '0.82rem',
                                    lineHeight: 1.55,
                                    color: '#334155',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.5rem'
                                  }}
                                >
                                  {step.purpose && (
                                    <div style={{ color: '#475569', fontSize: '0.8rem', fontStyle: 'italic', marginBottom: '0.15rem' }}>
                                      {step.purpose}
                                    </div>
                                  )}

                                  <div>
                                    <strong style={{ color: '#0f172a' }}>What happens:</strong>{' '}
                                    <span style={{ color: '#334155' }}>{step.whatHappens}</span>
                                  </div>

                                  {((step.youDo && step.youDo.length > 0) || (step.systemDoes && step.systemDoes.length > 0)) && (
                                    <div
                                      style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                        gap: '0.65rem',
                                        margin: '0.35rem 0',
                                        background: 'rgba(241, 245, 249, 0.7)',
                                        padding: '0.65rem 0.85rem',
                                        borderRadius: '6px',
                                        border: '1px solid #e2e8f0'
                                      }}
                                    >
                                      {step.youDo && step.youDo.length > 0 && (
                                        <div>
                                          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                                            👤 Chemist Action
                                          </div>
                                          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: '#475569', lineHeight: 1.45 }}>
                                            {step.youDo.map((item, idx) => (
                                              <li key={idx}>{item}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      {step.systemDoes && step.systemDoes.length > 0 && (
                                        <div>
                                          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#005baa', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
                                            ⚙️ Platform Execution
                                          </div>
                                          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: '#475569', lineHeight: 1.45 }}>
                                            {step.systemDoes.map((item, idx) => (
                                              <li key={idx}>{item}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'flex-start',
                                      gap: '0.4rem',
                                      background: 'rgba(13, 148, 136, 0.06)',
                                      padding: '0.45rem 0.75rem',
                                      borderRadius: '4px',
                                      border: '1px solid rgba(13, 148, 136, 0.2)',
                                      fontSize: '0.79rem'
                                    }}
                                  >
                                    <strong style={{ color: '#0f766e', flexShrink: 0 }}>Output:</strong>{' '}
                                    <span style={{ color: '#134e4a' }}>{step.output}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default PlatformWorkflowGuideSection;
