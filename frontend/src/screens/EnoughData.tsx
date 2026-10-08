// src/screens/EnoughData.tsx  –  Decision gate (also used for "More Improvement?")
import { useStore } from '../store/useStore'

export default function EnoughData() {
  const { currentStep, optimumResult, setStep } = useStore()
  const isMoreImprovement = currentStep === 'more-improvement'

  return (
    <div>
      <div className="page-header">
        <div className="page-header-tag">Step 16</div>
        <h1 className="page-title">Enough Data?</h1>
        <p className="page-desc">Check if we have enough results to choose the best settings.</p>
      </div>

      {optimumResult && (
        <div className="card mb-2">
          <div className="card-title mb-1">Current Best Result</div>
          <div style={{ display:'flex', gap:'1rem', alignItems:'center' }}>
            <div style={{ fontSize:'2.5rem', fontWeight:900, background:'linear-gradient(135deg, var(--success), var(--accent))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
              {(optimumResult.composite_desirability * 100).toFixed(1)}%
            </div>
            <div style={{ color:'var(--text-secondary)', fontSize:'0.85rem', lineHeight:1.6 }}>
              Composite Desirability Score<br/>
              {optimumResult.composite_desirability > 0.85
                ? '🟢 Model is well optimized'
                : optimumResult.composite_desirability > 0.65
                ? '🟡 Moderate — Bayesian refinement may help'
                : '🔴 Low — strongly recommend Bayesian iterations'}
            </div>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gap:'1rem' }}>
        {/* YES – proceed to final */}
        <div className="design-option" onClick={() => setStep('final-optimum')}
          style={{ cursor:'pointer', padding:'1.5rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>✅</div>
          <div className="design-option-title" style={{ fontSize:'1.1rem', marginBottom:'0.5rem' }}>
            {isMoreImprovement ? 'No – Converged' : 'Yes – Good Enough'}
          </div>
          <div style={{ fontSize:'0.82rem', color:'var(--text-secondary)', lineHeight:1.6 }}>
            {isMoreImprovement
              ? 'The Bayesian optimization has converged. Proceed to the final optimum.'
              : 'The RSM model is sufficient. Proceed directly to the final optimum without Bayesian optimization.'}
          </div>
          <button className="btn btn-success" style={{ marginTop:'1rem', width:'100%' }}
            onClick={() => setStep('final-optimum')}>
            Proceed to Final Optimum →
          </button>
        </div>

        {/* NO – go to Bayesian */}
        <div className="design-option" onClick={() => setStep('gp-model')}
          style={{ cursor:'pointer', padding:'1.5rem' }}>
          <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>🔬</div>
          <div className="design-option-title" style={{ fontSize:'1.1rem', marginBottom:'0.5rem' }}>
            {isMoreImprovement ? 'Yes – Run Another Iter.' : 'No – Refine Further'}
          </div>
          <div style={{ fontSize:'0.82rem', color:'var(--text-secondary)', lineHeight:1.6 }}>
            {isMoreImprovement
              ? 'Expected improvement is still high. Run another Bayesian experiment to refine the optimum.'
              : 'Use Gaussian Process + Bayesian Optimization to intelligently explore the response surface with targeted experiments.'}
          </div>
          <button className="btn btn-primary" style={{ marginTop:'1rem', width:'100%' }}
            onClick={() => setStep('gp-model')}>
            Start Bayesian Optimization →
          </button>
        </div>
      </div>

      <div className="step-nav">
        <button className="btn btn-secondary"
          onClick={() => setStep(isMoreImprovement ? 'new-experiment' : 'initial-optimization')}>
          ← Back
        </button>
      </div>
    </div>
  )
}
