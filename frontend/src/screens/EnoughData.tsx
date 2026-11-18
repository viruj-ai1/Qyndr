// src/screens/EnoughData.tsx  –  Decision gate (also used for "More Improvement?")
import { useStore } from '../store/useStore'

export default function EnoughData() {
  const { currentStep, optimumResult, setStep, enableBayesianOpt } = useStore()
  const isMoreImprovement = currentStep === 'more-improvement'

  const handleStartBayesian = () => {
    enableBayesianOpt(true)
    setStep('gp-model')
  }

  const handleProceedToFinal = () => {
    if (!isMoreImprovement) {
      enableBayesianOpt(false)
    }
    setStep('final-optimum')
  }

  const handleBack = () => {
    if (!isMoreImprovement) {
      enableBayesianOpt(false)
    }
    setStep(isMoreImprovement ? 'new-experiment' : 'initial-optimization')
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Enough Data?</h1>
        <p className="page-desc">Check if we have enough results to choose the best settings.</p>
      </div>

      {optimumResult && (
        <div className="card mb-2" style={{ padding: '1.25rem 1.75rem', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border)' }}>
          <div className="flex-between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
              <div
                style={{
                  fontSize: '3rem',
                  fontWeight: 900,
                  background: 'linear-gradient(135deg, var(--success), var(--accent))',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1
                }}
              >
                {(optimumResult.composite_desirability * 100).toFixed(1)}%
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Composite Desirability Score (D)
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {optimumResult.composite_desirability > 0.85
                    ? '🟢 High Desirability — Criteria Met'
                    : optimumResult.composite_desirability > 0.65
                    ? '🟡 Moderate Desirability — Trade-offs Present'
                    : '🔴 Low Desirability (Critical CQAs Off-Target)'}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', marginTop: '3px' }}>
                  {optimumResult.composite_desirability > 0.85
                    ? 'All Critical Quality Attributes (CQAs) meet acceptance specifications within the explored conditions.'
                    : optimumResult.composite_desirability > 0.65
                    ? 'The process reaches acceptable bounds, but higher purity, yield, or narrower impurity levels can likely be achieved.'
                    : 'One or more quality targets (e.g. impurities or yield) fail acceptance limits at the current operating point.'}
                </div>
              </div>
            </div>

            {/* Quick recommendation pill */}
            <div
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                background: optimumResult.composite_desirability > 0.8 ? 'rgba(5, 150, 105, 0.08)' : 'rgba(0, 91, 170, 0.08)',
                border: `1px solid ${optimumResult.composite_desirability > 0.8 ? 'rgba(5, 150, 105, 0.25)' : 'rgba(0, 91, 170, 0.25)'}`,
                fontSize: '0.8rem'
              }}
            >
              <div style={{ fontWeight: 700, color: optimumResult.composite_desirability > 0.8 ? '#059669' : '#005baa' }}>
                💡 Recommendation:
              </div>
              <div style={{ color: '#475569', marginTop: '2px' }}>
                {optimumResult.composite_desirability > 0.8
                  ? 'Reaction data is solid and targets are met. Proceed to Final Optimum to freeze Proven Acceptable Ranges (PAR).'
                  : 'Low/Moderate score. Run targeted follow-up experiments to improve purity and yield.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Decision Cards with Explicit Scientific Criteria */}
      <div className="grid-2 mb-2" style={{ gap: '1.25rem' }}>
        {/* OPTION 1: Proceed to Final Optimum */}
        <div
          className="card"
          style={{
            cursor: 'pointer',
            padding: '1.5rem',
            border: '2px solid rgba(5, 150, 105, 0.3)',
            background: 'linear-gradient(180deg, #ffffff 0%, rgba(240, 253, 244, 0.35) 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease'
          }}
          onClick={handleProceedToFinal}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '1.75rem' }}>✅</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 700 }}>
                    {isMoreImprovement ? 'Stop & Finalize Process' : 'Proceed Directly to Final Optimum'}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Option A: Sufficient Data & High Certainty
                  </div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, marginBottom: '1rem' }}>
              {isMoreImprovement
                ? 'Experimental results are consistent, targets are met, and no further confirmatory runs are needed.'
                : 'Your process modeling clearly explains reaction trends and all Critical Quality Attributes (CQAs) meet specifications.'}
            </p>

            {/* Scenario Checklist */}
            <div style={{ background: '#ffffff', borderRadius: '8px', padding: '0.85rem 1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                🎯 When should you choose this?
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.4rem', lineHeight: 1.45 }}>
                <li><strong>Desirability is High (&gt; 80–85%):</strong> All targets (Yield, Purity, Impurity thresholds) are comfortably satisfied simultaneously.</li>
                <li><strong>Process Fit is Strong:</strong> High prediction accuracy ($R^2 &gt; 0.75$) with excellent experimental repeatability.</li>
                <li><strong>Optimum is Within Safe Bounds:</strong> The best operating point lies safely inside parameter ranges, not forced against an equipment limit.</li>
                <li><strong>Time &amp; Material Limits:</strong> Process requirements are fulfilled and no additional bench trials are needed.</li>
              </ul>
            </div>
          </div>

          <button
            className="btn btn-success"
            style={{ marginTop: '1.25rem', width: '100%', padding: '0.7rem', fontSize: '0.9rem', fontWeight: 700 }}
            onClick={(e) => { e.stopPropagation(); handleProceedToFinal(); }}
          >
            {isMoreImprovement ? 'Finalize Optimum & Generate Report →' : 'Lock Operating Conditions & Proceed to Final Optimum →'}
          </button>
        </div>

        {/* OPTION 2: Bayesian Optimization */}
        <div
          className="card"
          style={{
            cursor: 'pointer',
            padding: '1.5rem',
            border: '2px solid rgba(0, 91, 170, 0.3)',
            background: 'linear-gradient(180deg, #ffffff 0%, rgba(240, 247, 255, 0.45) 100%)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease'
          }}
          onClick={handleStartBayesian}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '1.75rem' }}>🔬</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a', fontWeight: 700 }}>
                    {isMoreImprovement ? 'Run Another Targeted Experiment' : 'Refine with Targeted Experiments (Bayesian)'}
                  </h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Option B: Smart Targeted Experiments
                  </div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, marginBottom: '1rem' }}>
              {isMoreImprovement
                ? 'Targeted tests suggest further yield or purity gains. Execute 1–3 focused bench runs to reach the best reaction conditions.'
                : 'Explore complex reaction behavior (such as steep impurity spikes or narrow yield sweet spots) with focused sequential runs.'}
            </p>

            {/* Scenario Checklist */}
            <div style={{ background: '#ffffff', borderRadius: '8px', padding: '0.85rem 1rem', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                🎯 When should you choose this?
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.4rem', lineHeight: 1.45 }}>
                <li><strong>Desirability is Low/Moderate (&lt; 75–80%):</strong> Crucial quality targets (e.g. an unacceptably high impurity or low assay) still need improvement.</li>
                <li><strong>Complex Reaction Behavior:</strong> Sharp degradation cliffs, catalyst deactivation, or multi-peak yield trends that simple curves miss.</li>
                <li><strong>Uncertainty in Key Operating Zones:</strong> Unexplored parameter regions where higher purity or yield may exist.</li>
                <li><strong>Bench Capacity Available:</strong> Materials and instrument time are available to run 1–3 focused confirmatory trials.</li>
              </ul>
            </div>
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: '1.25rem', width: '100%', padding: '0.7rem', fontSize: '0.9rem', fontWeight: 700 }}
            onClick={(e) => { e.stopPropagation(); handleStartBayesian(); }}
          >
            {isMoreImprovement ? 'Continue Targeted Experiments →' : 'Start Targeted Experimental Refinement →'}
          </button>
        </div>
      </div>

      {/* Decision Guide Comparison Table */}
      <div className="card mb-2" style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span>📋</span> Chemist's Decision Matrix: Final Optimum vs. Targeted Refinement
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ background: '#ffffff', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ background: '#f1f5f9' }}>
                <th style={{ width: '22%' }}>Decision Metric</th>
                <th style={{ width: '39%', color: '#059669' }}>Proceed Directly to Final Optimum</th>
                <th style={{ width: '39%', color: 'var(--primary)' }}>Refine with Targeted Experiments</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Desirability ($D$)</strong></td>
                <td><span style={{ color: '#059669', fontWeight: 600 }}>&ge; 0.80 (80%+)</span> — All CQAs met</td>
                <td><span style={{ color: '#dc2626', fontWeight: 600 }}>&lt; 0.75 (&lt; 75%)</span> — CQAs need improvement</td>
              </tr>
              <tr>
                <td><strong>Model Fit / Accuracy</strong></td>
                <td>Strong correlation ($R^2 &gt; 0.80$), reliable predictions</td>
                <td>Process shows complex behavior requiring focused follow-ups</td>
              </tr>
              <tr>
                <td><strong>Optimum Location</strong></td>
                <td>Centered safely inside Factor Ranges</td>
                <td>Stuck on boundary or in high-uncertainty zone</td>
              </tr>
              <tr>
                <td><strong>Laboratory Capacity</strong></td>
                <td>Experimental budget exhausted; ready to validate</td>
                <td>Resources available for 1 to 4 sequential runs</td>
              </tr>
              <tr>
                <td><strong>Next Workflow Step</strong></td>
                <td>Freeze Normal &amp; Proven Acceptable Ranges (NOR/PAR)</td>
                <td>Evaluate Reaction Profiles &amp; Next Run Conditions</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="step-nav">
        <button className="btn btn-secondary" onClick={handleBack}>
          ← Back
        </button>
      </div>
    </div>
  )
}
