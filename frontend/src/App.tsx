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
import { useEffect }       from 'react'

const SCREEN_MAP: Record<string, React.FC> = {
  'welcome':               Welcome,
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

  // URL route handling & redirect from /campaign-dashboard to /stage-campaign-matrix
  useEffect(() => {
    if (typeof window === 'undefined') return
    const pathname = window.location.pathname.toLowerCase().replace(/\/$/, '')
    if (pathname === '/campaign-dashboard' || pathname === '/phase0-summary') {
      window.history.replaceState(null, '', '/stage-campaign-matrix')
      setStep('stage-campaign-matrix')
    } else if (pathname === '/stage-campaign-matrix' || pathname === '/stage-overview') {
      setStep('stage-campaign-matrix')
    }
  }, [setStep])

  const normalized = normalizeStep(currentStep)
  const Screen = SCREEN_MAP[normalized] || SCREEN_MAP[currentStep] || Welcome

  if (currentStep === 'welcome') {
    return (
      <div id="root">
        <div className="bg-canvas">
          <div className="bg-orb orb-1" /><div className="bg-orb orb-2" /><div className="bg-orb orb-3" />
          <div className="grid-overlay" />
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
        <div className="grid-overlay" />
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
