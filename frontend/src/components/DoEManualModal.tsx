// ============================================================
// frontend/src/components/DoEManualModal.tsx
// Refactored to Option 1: Minimal 3-Question Visual Stepper
// Instant, cognitive-load-free DoE selection under 10 seconds
// ============================================================

import React, { useState, useMemo, useEffect } from 'react'
import { useStore } from '../store/useStore'
import {
  DOE_MANUAL_DESIGNS,
  DoEDesignManualEntry,
  DoECategory,
  StepperAnswers,
  getStepperRecommendation
} from '../utils/doeManualData'
import {
  Sparkles,
  Check,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  FlaskConical,
  Zap,
  ShieldCheck,
  Info,
  RotateCcw,
  Search
} from 'lucide-react'

interface DoEManualModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectDesign: (designKey: string, category: DoECategory) => void
  initialTab?: 'wizard' | 'matrix' | 'deep-dives'
  initialDesignId?: string
}

export default function DoEManualModal({
  isOpen,
  onClose,
  onSelectDesign,
  initialDesignId
}: DoEManualModalProps) {
  const { currentProject } = useStore()

  // Auto-detect factor count from active project
  const projectFactorCount = currentProject?.factors?.length || 0
  const detectedBucket: 'few' | 'moderate' | 'many' = useMemo(() => {
    if (projectFactorCount >= 9) return 'many'
    if (projectFactorCount >= 5) return 'moderate'
    return 'few'
  }, [projectFactorCount])

  // View state: 'stepper' (default primary view) vs 'case-studies' (discrete secondary view)
  const [viewMode, setViewMode] = useState<'stepper' | 'case-studies'>('stepper')
  const [selectedCaseStudyId, setSelectedCaseStudyId] = useState<string>(initialDesignId || 'dsd')
  const [caseStudySearch, setCaseStudySearch] = useState('')

  // 3-Question Stepper State
  const [answers, setAnswers] = useState<StepperAnswers>({
    objective: 'screening',
    factorCount: detectedBucket,
    priority: 'fast'
  })

  // Sync initialDesignId if passed specifically to view case studies
  useEffect(() => {
    if (initialDesignId) {
      setSelectedCaseStudyId(initialDesignId)
      setViewMode('case-studies')
    } else {
      setViewMode('stepper')
    }
  }, [initialDesignId, isOpen])

  // Sync detected factor count if project loads
  useEffect(() => {
    if (projectFactorCount > 0) {
      setAnswers(prev => ({ ...prev, factorCount: detectedBucket }))
    }
  }, [projectFactorCount, detectedBucket])

  // Real-time Hero recommendation
  const recommendation = useMemo(() => {
    return getStepperRecommendation(answers)
  }, [answers])

  const activeCaseStudy = useMemo(() => {
    return DOE_MANUAL_DESIGNS.find(d => d.id === selectedCaseStudyId) || DOE_MANUAL_DESIGNS[0]
  }, [selectedCaseStudyId])

  const filteredDesigns = useMemo(() => {
    const q = caseStudySearch.toLowerCase().trim()
    if (!q) return DOE_MANUAL_DESIGNS
    return DOE_MANUAL_DESIGNS.filter(
      d =>
        d.name.toLowerCase().includes(q) ||
        d.shortName.toLowerCase().includes(q) ||
        d.key.toLowerCase().includes(q) ||
        d.caseStudy.unitOperation.toLowerCase().includes(q) ||
        d.caseStudy.compoundExample.toLowerCase().includes(q)
    )
  }, [caseStudySearch])

  if (!isOpen) return null

  const getCategoryBadgeStyle = (category: DoECategory) => {
    switch (category) {
      case 'Screening':
        return { background: 'rgba(0, 91, 170, 0.1)', color: '#005baa', border: '1px solid rgba(0, 91, 170, 0.25)' }
      case 'Optimization / RSM':
        return { background: 'rgba(5, 150, 105, 0.1)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.25)' }
      case 'Formulation / Mixture':
        return { background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', border: '1px solid rgba(124, 58, 237, 0.25)' }
      case 'Sequential / Adaptive':
        return { background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', border: '1px solid rgba(217, 119, 6, 0.25)' }
    }
  }

  const resetQuestions = () => {
    setAnswers({
      objective: 'screening',
      factorCount: detectedBucket,
      priority: 'fast'
    })
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '960px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          padding: 0
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            background: 'linear-gradient(135deg, #003d73 0%, #005baa 65%, #00aeb3 100%)',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.15)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.2rem' }}>
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase'
                }}
              >
                ICH Q8(R2) · Fast DoE Advisor
              </span>
              <span style={{ fontSize: '0.75rem', opacity: 0.9 }}>
                Formulation & Process Strategy
              </span>
            </div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
              {viewMode === 'stepper' ? 'DoE Selection Wizard' : 'Pharma DoE Case Studies & Reference'}
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', opacity: 0.88, lineHeight: 1.4 }}>
              {viewMode === 'stepper'
                ? 'Answer 3 simple questions to find the ideal experimental design in under 10 seconds.'
                : 'Scientific case studies across API synthesis, fluid bed granulation, and lipid formulations.'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.2rem',
              transition: 'background 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: '#f8fafc' }}>
          {viewMode === 'stepper' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Question 1: Experimental Objective (3 large clickable cards) */}
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  padding: '1.25rem',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      style={{
                        background: 'var(--primary)',
                        color: '#fff',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      1
                    </span>
                    <label style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                      What is your experimental objective?
                    </label>
                  </div>
                  <button
                    onClick={resetQuestions}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.75rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      cursor: 'pointer'
                    }}
                  >
                    <RotateCcw size={12} />
                    <span>Reset</span>
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                  {[
                    {
                      key: 'screening',
                      icon: '🔍',
                      title: 'Screening & Factor Reduction',
                      subtitle: 'Identify the vital few critical process parameters (CPPs) from a large pool.'
                    },
                    {
                      key: 'optimization',
                      icon: '🎯',
                      title: 'Optimization & Design Space',
                      subtitle: 'Find the sweet spot, model curvature, and define Normal / Proven Acceptable Ranges (NOR/PAR).'
                    },
                    {
                      key: 'mixture',
                      icon: '🧪',
                      title: 'Formulation & Mixtures',
                      subtitle: 'Blend ingredients and excipients whose proportions must sum to 100%.'
                    }
                  ].map(opt => {
                    const isSelected = answers.objective === opt.key
                    return (
                      <div
                        key={opt.key}
                        onClick={() => setAnswers(prev => ({ ...prev, objective: opt.key as any }))}
                        style={{
                          padding: '1rem',
                          borderRadius: '12px',
                          border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                          background: isSelected ? 'rgba(0, 91, 170, 0.05)' : '#ffffff',
                          cursor: 'pointer',
                          transition: 'all 0.18s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          boxShadow: isSelected ? '0 4px 12px rgba(0, 91, 170, 0.1)' : 'none'
                        }}
                      >
                        <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>{opt.icon}</div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: isSelected ? 'var(--primary)' : 'var(--text-primary)', marginBottom: '0.25rem' }}>
                          {opt.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                          {opt.subtitle}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Questions 2 & 3 in a 2-Column Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                {/* Question 2: Factor Count (Pill buttons + Auto-detect bonus) */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    border: '1px solid var(--border)',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          background: 'var(--primary)',
                          color: '#fff',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        2
                      </span>
                      <label style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        Factors (Parameters)
                      </label>
                    </div>

                    {projectFactorCount > 0 && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          background: 'rgba(0, 174, 179, 0.12)',
                          color: '#00838f',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <Zap size={11} />
                        <span>Auto-detected: k = {projectFactorCount}</span>
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {[
                      { key: 'few', label: '2 to 4 Factors', desc: 'Focused space' },
                      { key: 'moderate', label: '5 to 8 Factors', desc: 'Standard sweet-spot' },
                      { key: 'many', label: '9+ Factors', desc: 'Wide pool' }
                    ].map(p => {
                      const isSelected = answers.factorCount === p.key
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setAnswers(prev => ({ ...prev, factorCount: p.key as any }))}
                          style={{
                            padding: '0.65rem 0.5rem',
                            borderRadius: '10px',
                            border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                            background: isSelected ? 'var(--primary)' : '#ffffff',
                            color: isSelected ? '#ffffff' : 'var(--text-primary)',
                            cursor: 'pointer',
                            textAlign: 'center',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px'
                          }}
                        >
                          <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>{p.label}</span>
                          <span style={{ fontSize: '0.68rem', opacity: isSelected ? 0.9 : 0.65 }}>{p.desc}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Question 3: Resource & Precision Priority */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '14px',
                    border: '1px solid var(--border)',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <span
                      style={{
                        background: 'var(--primary)',
                        color: '#fff',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      3
                    </span>
                    <label style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      Resource & Precision Priority
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    {[
                      {
                        key: 'fast',
                        icon: '⚡',
                        title: 'Fast & Economical',
                        desc: 'Minimal runs, fast turnaround'
                      },
                      {
                        key: 'rigorous',
                        icon: '🔬',
                        title: 'High Rigor & RSM',
                        desc: 'Curvature, center pts & error estimation'
                      }
                    ].map(p => {
                      const isSelected = answers.priority === p.key
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => setAnswers(prev => ({ ...prev, priority: p.key as any }))}
                          style={{
                            padding: '0.65rem 0.75rem',
                            borderRadius: '10px',
                            border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                            background: isSelected ? 'var(--primary)' : '#ffffff',
                            color: isSelected ? '#ffffff' : 'var(--text-primary)',
                            cursor: 'pointer',
                            textAlign: 'left',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem'
                          }}
                        >
                          <span style={{ fontSize: '1.25rem' }}>{p.icon}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{p.title}</div>
                            <div style={{ fontSize: '0.68rem', opacity: isSelected ? 0.9 : 0.65 }}>{p.desc}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* SINGLE HERO RECOMMENDATION CARD */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)',
                  borderRadius: '16px',
                  border: '2px solid var(--accent)',
                  padding: '1.4rem',
                  boxShadow: '0 8px 30px rgba(0, 174, 179, 0.12)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  position: 'relative'
                }}
              >
                {/* Hero Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          background: 'rgba(0, 174, 179, 0.15)',
                          color: '#00838f',
                          padding: '3px 10px',
                          borderRadius: '20px',
                          fontSize: '0.78rem',
                          fontWeight: 700
                        }}
                      >
                        <Sparkles size={14} />
                        <span>Recommended Best Fit ({recommendation.matchScore}% Match)</span>
                      </span>
                      <span className="badge" style={getCategoryBadgeStyle(recommendation.design.category)}>
                        {recommendation.design.category}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      {recommendation.design.name}
                    </h3>
                  </div>

                  {/* Clean Badges (Human-Readable Runs & Capability) */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="badge badge-accent" style={{ fontSize: '0.82rem', padding: '4px 10px', fontWeight: 700 }}>
                      {recommendation.runBadge}
                    </span>
                    <span className="badge badge-primary" style={{ fontSize: '0.82rem', padding: '4px 10px', fontWeight: 600 }}>
                      {recommendation.capabilityBadge}
                    </span>
                  </div>
                </div>

                {/* Why This Fits Bullets */}
                <div style={{ background: '#ffffff', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid rgba(0, 174, 179, 0.2)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Why this fits your campaign:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {recommendation.whyFitsBullets.map((bullet, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                        <CheckCircle2 size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Primary Action Button & Alternative Option Hint */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '0.25rem' }}>
                  {/* Alternative Hint */}
                  {recommendation.alternative ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      <span>💡</span>
                      <span>
                        <strong>{recommendation.alternative.shortName}</strong> ({recommendation.alternative.runBadge}) — {recommendation.alternative.hint}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectDesign(recommendation.alternative!.key, recommendation.alternative!.category)}
                        style={{
                          background: 'rgba(0, 91, 170, 0.08)',
                          border: '1px solid rgba(0, 91, 170, 0.2)',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          color: 'var(--primary)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Apply Alternative
                      </button>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Primary Hero Button */}
                  <button
                    className="btn btn-primary"
                    onClick={() => onSelectDesign(recommendation.design.key, recommendation.design.category)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontWeight: 700,
                      padding: '0.7rem 1.5rem',
                      fontSize: '0.92rem',
                      borderRadius: '10px',
                      boxShadow: '0 4px 15px rgba(0, 91, 170, 0.25)'
                    }}
                  >
                    <Check size={18} />
                    <span>Apply This Design to Step 09</span>
                  </button>
                </div>
              </div>

              {/* Discrete Bottom Link: View Case Studies */}
              <div style={{ textAlign: 'center', paddingTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('case-studies')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    textDecoration: 'underline',
                    transition: 'color 0.15s'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--primary)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <BookOpen size={14} />
                  <span>Need advanced scientific details? View Pharmaceutical Case Studies</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>
          ) : (
            /* CASE STUDIES VIEW (Discrete Secondary View) */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Back to Stepper Bar */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#ffffff',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border)'
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setViewMode('stepper')}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}
                >
                  <ArrowLeft size={15} />
                  <span>← Back to 3-Question Wizard</span>
                </button>

                <div style={{ position: 'relative', width: '260px' }}>
                  <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={caseStudySearch}
                    onChange={(e) => setCaseStudySearch(e.target.value)}
                    placeholder="Search 10 pharma cases…"
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.75rem 0.4rem 2rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      fontSize: '0.8rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* 2-Column Case Studies Layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: '1.25rem', alignItems: 'start' }}>
                {/* Left: Design Selector List */}
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    overflow: 'hidden',
                    maxHeight: '65vh',
                    overflowY: 'auto'
                  }}
                >
                  {filteredDesigns.map(d => {
                    const isSelected = d.id === selectedCaseStudyId
                    return (
                      <div
                        key={d.id}
                        onClick={() => setSelectedCaseStudyId(d.id)}
                        style={{
                          padding: '0.75rem 1rem',
                          borderBottom: '1px solid var(--border)',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(0, 91, 170, 0.08)' : 'transparent',
                          borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent',
                          transition: 'all 0.15s'
                        }}
                      >
                        <div style={{ fontWeight: isSelected ? 700 : 600, fontSize: '0.84rem', color: isSelected ? 'var(--primary)' : 'var(--text-primary)', marginBottom: '0.15rem' }}>
                          {d.shortName}
                        </div>
                        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              ...getCategoryBadgeStyle(d.category)
                            }}
                          >
                            {d.category.split(' ')[0]}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {d.factorRange}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Right: Selected Case Study Card */}
                {activeCaseStudy && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div
                      style={{
                        background: '#ffffff',
                        borderRadius: '14px',
                        border: '1px solid var(--border)',
                        padding: '1.35rem',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <div>
                          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem' }}>
                            <span className="badge" style={getCategoryBadgeStyle(activeCaseStudy.category)}>
                              {activeCaseStudy.category}
                            </span>
                            <span className="badge badge-primary">{activeCaseStudy.resolution}</span>
                          </div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                            {activeCaseStudy.name}
                          </h3>
                        </div>

                        <button
                          className="btn btn-primary btn-sm"
                          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
                          onClick={() => onSelectDesign(activeCaseStudy.key, activeCaseStudy.category)}
                        >
                          <Check size={15} />
                          <span>Apply to Step 09</span>
                        </button>
                      </div>

                      <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: '0 0 1rem' }}>
                        {activeCaseStudy.experimentObjective}
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', background: '#f8fafc', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '1rem' }}>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Typical Run Count</div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--primary)' }}>{activeCaseStudy.typicalRunExamples}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Model Capability</div>
                          <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--accent)' }}>{activeCaseStudy.modelCapability}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Regulatory Scope</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{activeCaseStudy.ichGuidance}</div>
                        </div>
                      </div>

                      {/* Case Study Details */}
                      <div
                        style={{
                          background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
                          borderRadius: '12px',
                          border: '1.5px solid #cbd5e1',
                          padding: '1.15rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem' }}>
                          <FlaskConical size={16} color="var(--primary)" />
                          <h4 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                            Case Study: {activeCaseStudy.caseStudy.title}
                          </h4>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                          <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                            Unit Op: {activeCaseStudy.caseStudy.unitOperation}
                          </span>
                          <span className="badge badge-accent" style={{ fontSize: '0.72rem' }}>
                            Model: {activeCaseStudy.caseStudy.compoundExample}
                          </span>
                        </div>

                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '0.75rem' }}>
                          <strong style={{ color: 'var(--text-primary)' }}>Problem: </strong>
                          {activeCaseStudy.caseStudy.problemStatement}
                        </p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '0.75rem' }}>
                          <div style={{ background: '#f1f5f9', padding: '0.65rem', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                              Investigated Parameters (CPPs/CMAs):
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                              {activeCaseStudy.caseStudy.inputFactors.map((f, i) => (
                                <span key={i} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-primary)' }}>
                                  {f}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div style={{ background: '#f1f5f9', padding: '0.65rem', borderRadius: '6px' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                              Monitored Quality Responses (CQAs):
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                              {activeCaseStudy.caseStudy.monitoredCQAs.map((c, i) => (
                                <span key={i} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '1px 6px', borderRadius: '4px', fontSize: '0.7rem', color: 'var(--text-primary)' }}>
                                  {c}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div style={{ background: 'rgba(0, 174, 179, 0.08)', border: '1px solid rgba(0, 174, 179, 0.2)', padding: '0.7rem', borderRadius: '6px', fontSize: '0.78rem', color: '#00695c', lineHeight: 1.4 }}>
                          <strong>Scientific Outcome: </strong>
                          {activeCaseStudy.caseStudy.outcome}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            background: '#ffffff',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <ShieldCheck size={15} color="var(--primary)" />
            <span>Design recommendations align with ICH Q8(R2) Design Space & ICH Q9 Risk Principles.</span>
          </div>

          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '0.82rem', padding: '0.4rem 1rem' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
