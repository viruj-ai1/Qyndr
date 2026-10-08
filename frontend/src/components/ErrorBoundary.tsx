// src/components/ErrorBoundary.tsx
// Catches any runtime render errors and shows a friendly recovery UI
import React from 'react'
import { useStore } from '../store/useStore'

interface Props { children: React.ReactNode }
interface State { error: Error | null }

class ErrorBoundaryClass extends React.Component<Props & { onReset: () => void }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Screen render error:', error, info)
  }

  handleReset = () => {
    this.setState({ error: null })
    this.props.onReset()
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '60vh', padding: '2rem', textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: 'var(--warning)', marginBottom: '0.75rem', fontSize: '1.3rem' }}>
            Something went wrong on this page
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: '480px', fontSize: '0.88rem', lineHeight: 1.6 }}>
            A rendering error occurred. Your data is safe. Try going back to a previous step or
            refreshing the page.
          </p>
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '8px', padding: '0.75rem 1.25rem', marginBottom: '1.5rem', maxWidth: '520px', textAlign: 'left' }}>
            <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-word' }}>
              {this.state.error.message}
            </code>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={() => window.location.reload()}>
              🔄 Refresh Page
            </button>
            <button className="btn btn-primary" onClick={this.handleReset}>
              ← Go Back
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// Wrapper that provides the store's setStep as onReset
export default function ErrorBoundary({ children }: Props) {
  const { setStep, currentStep } = useStore()
  const steps = [
    'welcome','create-project','understand-process','define-factors',
    'recommend-doe','generate-doe','lab-experiments','upload-results',
    'initial-optimization','enough-data',
    'gp-model','bayesian-opt','new-experiment','final-optimum','report'
  ] as const
  const idx = steps.indexOf(currentStep as any)
  const prevStep = idx > 0 ? steps[idx - 1] : 'welcome'

  return (
    <ErrorBoundaryClass onReset={() => setStep(prevStep as any)}>
      {children}
    </ErrorBoundaryClass>
  )
}
