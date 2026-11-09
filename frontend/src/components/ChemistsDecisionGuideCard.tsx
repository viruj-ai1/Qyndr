// frontend/src/components/ChemistsDecisionGuideCard.tsx
import React, { useState } from 'react'
import { DoEDesignManualEntry } from '../utils/doeManualData'
import {
  Lightbulb,
  CheckCircle2,
  Check,
  AlertTriangle,
  ArrowRight,
  Info,
  HelpCircle,
  BookOpen
} from 'lucide-react'

interface ChemistsDecisionGuideCardProps {
  design: DoEDesignManualEntry
  onNavigateToDesign: (designId: string) => void
  showMiniHelper: boolean
  onToggleMiniHelper: () => void
  miniFactors: '2-3' | '4-7' | '8+'
  onChangeMiniFactors: (v: '2-3' | '4-7' | '8+') => void
  miniStage: 'screening' | 'optimization'
  onChangeMiniStage: (v: 'screening' | 'optimization') => void
  miniCurvature: 'yes' | 'no' | 'unsure'
  onChangeMiniCurvature: (v: 'yes' | 'no' | 'unsure') => void
  helperRecommendedIds: string[]
  allDesigns: DoEDesignManualEntry[]
}

export default function ChemistsDecisionGuideCard({
  design,
  onNavigateToDesign,
  showMiniHelper,
  onToggleMiniHelper,
  miniFactors,
  onChangeMiniFactors,
  miniStage,
  onChangeMiniStage,
  miniCurvature,
  onChangeMiniCurvature,
  helperRecommendedIds,
  allDesigns
}: ChemistsDecisionGuideCardProps) {
  const [activeGuideTab, setActiveGuideTab] = useState<number>(1)
  const guide = design.guide

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
      {/* Mini Decision Helper Widget */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)',
          borderRadius: '12px',
          border: '1.5px solid rgba(0, 174, 179, 0.3)',
          padding: '0.85rem 1rem'
        }}
      >
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
          onClick={onToggleMiniHelper}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <HelpCircle size={16} color="var(--accent)" />
            <span style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-primary)' }}>
              Not sure which one? 3-Question Decision Helper
            </span>
          </div>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {showMiniHelper ? 'Hide Helper ▲' : 'Open Helper ▼'}
          </button>
        </div>

        {showMiniHelper && (
          <div
            style={{
              marginTop: '0.75rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid rgba(0, 174, 179, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.65rem'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
              {/* Q1: Factors */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  1. How many factors?
                </label>
                <select
                  value={miniFactors}
                  onChange={(e) => onChangeMiniFactors(e.target.value as any)}
                  style={{ width: '100%', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.75rem' }}
                >
                  <option value="2-3">2 to 3 factors</option>
                  <option value="4-7">4 to 7 factors</option>
                  <option value="8+">8+ factors</option>
                </select>
              </div>

              {/* Q2: Stage */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  2. Campaign Stage?
                </label>
                <select
                  value={miniStage}
                  onChange={(e) => onChangeMiniStage(e.target.value as any)}
                  style={{ width: '100%', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.75rem' }}
                >
                  <option value="screening">Screening (Find vital few)</option>
                  <option value="optimization">Optimization (Sweet spot / RSM)</option>
                </select>
              </div>

              {/* Q3: Curvature */}
              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>
                  3. Expect curvature?
                </label>
                <select
                  value={miniCurvature}
                  onChange={(e) => onChangeMiniCurvature(e.target.value as any)}
                  style={{ width: '100%', padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.75rem' }}
                >
                  <option value="no">No (Linear assumption)</option>
                  <option value="yes">Yes (Non-linear peak)</option>
                  <option value="unsure">Unsure (Test curvature)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border)', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                🎯 Best-matching architecture(s):
                <strong style={{ color: 'var(--primary)', marginLeft: '0.35rem' }}>
                  {helperRecommendedIds.map(id => allDesigns.find(d => d.id === id)?.shortName).join(' or ')}
                </strong>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToDesign(helperRecommendedIds[0])}
                style={{
                  background: 'var(--primary)',
                  color: '#fff',
                  border: 'none',
                  padding: '3px 9px',
                  borderRadius: '5px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Jump to Best Match →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chemist's Decision Guide Container */}
      {guide && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            border: '1.5px solid #cbd5e1',
            overflow: 'hidden'
          }}
        >
          {/* Guide Header Banner */}
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Lightbulb size={16} color="#38bdf8" />
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#ffffff' }}>
                Chemist's Decision Guide: {design.shortName}
              </h4>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              Bench Practical Reference
            </span>
          </div>

          {/* 7 Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border)',
              background: '#f8fafc',
              overflowX: 'auto',
              padding: '0 0.5rem'
            }}
          >
            {[
              { id: 1, label: '1. Why Choose This' },
              { id: 2, label: '2. When to Use / Avoid' },
              { id: 3, label: '3. How It Works & Model' },
              { id: 4, label: '4. Strengths & Limits' },
              { id: 5, label: '5. QbD / ICH Fit' },
              { id: 6, label: '6. Pitfalls & Tips' },
              { id: 7, label: '7. Next Step' }
            ].map(tab => {
              const isActive = activeGuideTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveGuideTab(tab.id)}
                  style={{
                    padding: '0.6rem 0.85rem',
                    border: 'none',
                    borderBottom: isActive ? '3px solid var(--primary)' : '3px solid transparent',
                    background: 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.76rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s'
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Tab Content Panel */}
          <div style={{ padding: '1.15rem', fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
            {/* TAB 1: Why Choose */}
            {activeGuideTab === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.86rem', marginBottom: '0.2rem' }}>
                  Why choose {design.shortName} for your experiment:
                </div>
                {guide.whyChoose.map((point, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <CheckCircle2 size={15} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{point}</span>
                  </div>
                ))}

                <div style={{ marginTop: '0.65rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>
                    Typical Chemistry & Pharmaceutical Unit Operations:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {guide.chemistryExamples.map((ex, i) => (
                      <li key={i} style={{ marginBottom: '0.2rem' }}>{ex}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 2: When to Use / When to Avoid */}
            {activeGuideTab === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Choose When Checklist (Green-tinted) */}
                <div
                  style={{
                    background: 'rgba(5, 150, 105, 0.05)',
                    border: '1.5px solid rgba(5, 150, 105, 0.25)',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#059669', fontSize: '0.84rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Check size={16} />
                    <span>Choose this design when (Checklist):</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                    {guide.chooseWhen.map((c, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <span style={{ color: '#059669', fontWeight: 700 }}>✓</span>
                        <span>{c.condition}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Avoid When List (Amber/Red-tinted with Clickable Chips) */}
                <div
                  style={{
                    background: 'rgba(220, 38, 38, 0.04)',
                    border: '1.5px solid rgba(220, 38, 38, 0.25)',
                    borderRadius: '10px',
                    padding: '0.85rem 1rem'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.84rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={16} />
                    <span>Avoid this design when (Alternatives):</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                    {guide.avoidWhen.map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.8rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', flex: 1 }}>
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>✗</span>
                          <span>{a.condition}</span>
                        </div>
                        {a.recommendedAlternativeId && (
                          <button
                            type="button"
                            onClick={() => onNavigateToDesign(a.recommendedAlternativeId!)}
                            style={{
                              background: '#ffffff',
                              border: '1px solid rgba(220, 38, 38, 0.35)',
                              color: '#dc2626',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              boxShadow: 'var(--shadow-sm)'
                            }}
                          >
                            <span>Switch to: {a.alternativeLabel || a.recommendedAlternativeId}</span>
                            <ArrowRight size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: How It Works & What It Estimates */}
            {activeGuideTab === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                    How It Works (Plain Language):
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {guide.howItWorks}
                  </p>
                </div>

                {/* Model Equation Box */}
                <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                    Mathematical Model Equation:
                  </div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary)', fontSize: '0.86rem', marginBottom: '0.35rem' }}>
                    {guide.modelAndEffects.modelEquation}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {guide.modelAndEffects.modelEquationExplanation}
                  </div>
                </div>

                {/* Can vs Cannot Estimate Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                  <div style={{ background: 'rgba(5, 150, 105, 0.05)', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(5, 150, 105, 0.2)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', marginBottom: '0.35rem' }}>
                      What it CAN estimate:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      {guide.modelAndEffects.canEstimate.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ background: 'rgba(220, 38, 38, 0.05)', padding: '0.65rem 0.85rem', borderRadius: '8px', border: '1px solid rgba(220, 38, 38, 0.2)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#dc2626', marginBottom: '0.35rem' }}>
                      What it CANNOT estimate:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      {guide.modelAndEffects.cannotEstimate.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Aliasing & Resolution */}
                <div style={{ background: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.3rem' }}>
                    <span className="badge badge-primary">{guide.aliasingAndResolution.resolutionLevel}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-primary)' }}>Confounding Structure</span>
                  </div>
                  <p style={{ margin: '0 0 0.35rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    <strong>Confounding: </strong>{guide.aliasingAndResolution.confoundingExplanation}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--primary)' }}>
                    <strong>Practical Meaning: </strong>{guide.aliasingAndResolution.practicalMeaning}
                  </p>
                </div>

                {/* Run count logic & center points */}
                <div style={{ background: '#ffffff', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-primary)', marginBottom: '0.3rem' }}>
                    Run Count & Center Points Guidance:
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    <strong>Formula: </strong>{guide.runCountLogic.formula}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    <strong>Center Points: </strong>{guide.runCountLogic.centerPointsGuidance}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    <strong>Replicates: </strong>{guide.runCountLogic.replicatesGuidance}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Strengths & Limitations */}
            {activeGuideTab === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, color: '#059669', fontSize: '0.82rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Check size={15} />
                      <span>Strengths:</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {guide.strengths.map((s, i) => (
                        <li key={i} style={{ marginBottom: '0.35rem' }}>{s}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, color: '#d97706', fontSize: '0.82rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <AlertTriangle size={15} />
                      <span>Limitations:</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      {guide.limitations.map((l, i) => (
                        <li key={i} style={{ marginBottom: '0.35rem' }}>{l}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Underlying Statistical Assumptions */}
                <div style={{ background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    Underlying Statistical Assumptions:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    {guide.assumptions.map((a, i) => (
                      <li key={i} style={{ marginBottom: '0.2rem' }}>{a}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 5: QbD / ICH Linkage */}
            {activeGuideTab === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '10px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.35rem' }}>
                    QbD Workflow Position:
                  </div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
                    {guide.qbdLink.qbdWorkflowStage}
                  </div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {guide.qbdLink.designSpaceRole}
                  </p>
                  <div style={{ fontSize: '0.74rem', color: '#005baa', background: 'rgba(0, 91, 170, 0.08)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                    <strong>ICH Guidance Reference: </strong>{guide.qbdLink.ichGuidanceDetails}
                  </div>
                </div>

                <div style={{ background: 'rgba(0, 174, 179, 0.06)', border: '1px solid rgba(0, 174, 179, 0.25)', padding: '0.85rem 1rem', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#00838f', marginBottom: '0.3rem' }}>
                    QbD Progression Path:
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                    Risk Assessment (FMEA/RPN) ➔ <strong>{design.shortName}</strong> ➔ Design Space / Normal Operating Ranges (NOR) ➔ Control Strategy
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: Pitfalls & Analysis Tips */}
            {activeGuideTab === 6 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Common Mistakes */}
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.82rem', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <AlertTriangle size={15} />
                    <span>Common Bench Chemist Pitfalls:</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {guide.commonMistakes.map((m, i) => (
                      <li key={i} style={{ marginBottom: '0.3rem' }}>{m}</li>
                    ))}
                  </ul>
                </div>

                {/* Analysis Tips */}
                <div style={{ background: 'rgba(0, 91, 170, 0.05)', padding: '0.85rem', borderRadius: '10px', border: '1px solid rgba(0, 91, 170, 0.2)' }}>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.82rem', marginBottom: '0.45rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Info size={15} />
                    <span>Recommended Analysis Workflow:</span>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {guide.analysisTips.map((t, i) => (
                      <li key={i} style={{ marginBottom: '0.3rem' }}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* TAB 7: Next Step */}
            {activeGuideTab === 7 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)', border: '1.5px solid #86efac', padding: '1rem', borderRadius: '10px' }}>
                  <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.86rem', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <ArrowRight size={16} />
                    <span>Recommended Next Step:</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                    {guide.nextStep}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

