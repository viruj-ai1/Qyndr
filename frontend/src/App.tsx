// src/App.tsx  –  Root application component with step-based routing
import { useStore, Step, normalizeStep } from './store/useStore'
import Sidebar from './components/Layout/Sidebar'
import Header  from './components/Layout/Header'
import ErrorBoundary from './components/ErrorBoundary'

// Phase 0 Screens
import QTPPDefinition       from './screens/Phase0/QTPPDefinition'
import CQADerivation        from './screens/Phase0/CQADerivation'
import RouteMapping         from './screens/Phase0/RouteMapping'
import ReverseRiskAssessment from './screens/Phase0/ReverseRiskAssessment'
import StageCampaignMatrix  from './screens/StageCampaignMatrix'

// Existing Screens
import Welcome             from './screens/Welcome'
import CreateProject       from './screens/CreateProject'
import UnderstandProcess   from './screens/UnderstandProcess'
import DefineFactors       from './screens/DefineFactors'
import RecommendDOE        from './screens/RecommendDOE'
import GenerateDOE         from './screens/GenerateDOE'
import InitialOptimization from './screens/InitialOptimization'
import EnoughData          from './screens/EnoughData'
import GPModel             from './screens/GPModel'
import BayesianOpt         from './screens/BayesianOpt'
import NewExperiment       from './screens/NewExperiment'
import FinalOptimum        from './screens/FinalOptimum'
import Report              from './screens/Report'
import Login               from './screens/Login'
import { useEffect }       from 'react'
import { useAuth }         from './context/AuthContext'

const SCREEN_MAP: Record<string, React.FC> = {
  'welcome':               Welcome,
  'login':                 Login,
  'create-project':        CreateProject,
  'qtpp':                  QTPPDefinition,
  'cqa':                   CQADerivation,
  'route-mapping':         RouteMapping,
  'risk-assessment':       ReverseRiskAssessment,
  'stage-campaign-matrix': StageCampaignMatrix,
  'stage-overview':        StageCampaignMatrix,
  'phase0-summary':        StageCampaignMatrix,
  'campaign-dashboard':    StageCampaignMatrix,
  'understand-process':    UnderstandProcess,
  'define-factors':        DefineFactors,
  'recommend-doe':         RecommendDOE,
  'generate-doe':          GenerateDOE,
  'lab-experiments':       GenerateDOE,
  'upload-results':        GenerateDOE,
  'statistical-analysis':  InitialOptimization,
  'initial-optimization':  InitialOptimization,
  'enough-data':           EnoughData,
  'gp-model':              GPModel,
  'bayesian-opt':          BayesianOpt,
  'new-experiment':        NewExperiment,
  'lab-new':               NewExperiment,
  'update-model':          BayesianOpt,
  'more-improvement':      EnoughData,
  'final-optimum':         FinalOptimum,
  'report':                Report,
}


export default function App() {
  const { currentStep, setStep } = useStore()
  const { user, loading } = useAuth()

  // URL route handling & redirect from /campaign-dashboard to /stage-campaign-matrix
  useEffect(() => {
    if (typeof window === 'undefined') return
    const pathname = window.location.pathname.toLowerCase().replace(/\/$/, '')
    if (pathname === '/campaign-dashboard' || pathname === '/phase0-summary') {
      window.history.replaceState(null, '', '/stage-campaign-matrix')
      setStep('stage-campaign-matrix')
    } else if (pathname === '/stage-campaign-matrix' || pathname === '/stage-overview') {
      setStep('stage-campaign-matrix')
    } else if (pathname === '/login') {
      // If user navigated directly to /login
      if (user) {
        window.history.replaceState(null, '', '/')
        setStep('welcome')
      }
    }
  }, [setStep, user])

  // 1. Loading session state check
  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base)',
          color: 'var(--text-muted)',
          gap: '1rem'
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            border: '3px solid rgba(0, 91, 170, 0.15)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite'
          }}
        />
        <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>
          Authenticating DOE session...
        </div>
      </div>
    )
  }

  // 2. Unauthenticated Gate: Redirect to /login
  const isLoginPage = typeof window !== 'undefined' && window.location.pathname.toLowerCase().startsWith('/login')
  if (!user) {
    if (!isLoginPage && typeof window !== 'undefined') {
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search)
      window.history.replaceState(null, '', `/login?returnUrl=${returnUrl}`)
    }
    return <Login />
  }

  // 3. Authenticated: if user is on /login URL, push back to application root
  if (isLoginPage && typeof window !== 'undefined') {
    window.history.replaceState(null, '', '/')
  }

  const normalized = normalizeStep(currentStep)
  const Screen = SCREEN_MAP[normalized] || SCREEN_MAP[currentStep] || Welcome

  if (currentStep === 'welcome') {
    return (
      <div id="root">
        <div className="bg-canvas">
          <div className="bg-orb orb-1" /><div className="bg-orb orb-2" /><div className="bg-orb orb-3" />
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <ErrorBoundary><Screen /></ErrorBoundary>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative', zIndex: 1 }}>
      <div className="bg-canvas">
        <div className="bg-orb orb-1" /><div className="bg-orb orb-2" /><div className="bg-orb orb-3" />
      </div>
      <Header />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          <ErrorBoundary><Screen /></ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
