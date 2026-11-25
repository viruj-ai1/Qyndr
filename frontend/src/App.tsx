// src/App.tsx  –  Root application component with step-based routing
import { useStore, Step, normalizeStep } from './store/useStore'
import Header  from './components/Layout/Header'
import WorkflowStepper from './components/WorkflowStepper/WorkflowStepper'
import RouteGuard from './components/WorkflowStepper/RouteGuard'
import ErrorBoundary from './components/ErrorBoundary'

// Phase 0 Screens
import CQARiskAssessment   from './screens/Phase0/CQARiskAssessment'
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
  'qtpp':                  CreateProject,
  'cqa-risk':              CQARiskAssessment,
  'cqa':                   CQARiskAssessment,
  'route-mapping':         CQARiskAssessment,
  'risk-assessment':       CQARiskAssessment,
  'stage-campaign-matrix': DefineFactors,
  'stage-overview':        DefineFactors,
  'phase0-summary':        DefineFactors,
  'campaign-dashboard':    DefineFactors,
  'understand-process':    DefineFactors,
  'define-factors':        DefineFactors,
  'recommend-doe':         RecommendDOE,
  'generate-doe':          GenerateDOE,
  'lab-experiments':       GenerateDOE,
  'upload-results':        GenerateDOE,
  'statistical-analysis':  InitialOptimization,
  'initial-optimization':  InitialOptimization,
  'initial-optimum':       InitialOptimization,
  'enough-data':           EnoughData,
  'gp-model':              GPModel,
  'bayesian-opt':          BayesianOpt,
  'new-experiment':        NewExperiment,
  'final-optimum':         FinalOptimum,
  'report':                Report,
}

export default function App() {
  const { currentStep, currentProject } = useStore()
  const { user, loading } = useAuth()

  // Dynamic Page Title
  useEffect(() => {
    const rawStep = normalizeStep(currentStep)
    const stepName = rawStep
      .split('-')
      .map(s => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ')
    const projName = currentProject?.name ? ` | ${currentProject.name}` : ''
    document.title = `DoE and QbD Platform – ${stepName}${projName}`
  }, [currentStep, currentProject?.name])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
      </div>
    )
  }

  // Not logged in -> Show Login Screen
  if (!user) {
    return <Login />
  }

  const rawKey = normalizeStep(currentStep)
  const Screen = SCREEN_MAP[rawKey] || Welcome

  // Welcome page has its own standalone full-screen layout
  if (rawKey === 'welcome') {
    return (
      <div style={{ position: 'relative', minHeight: '100vh' }}>
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
      <WorkflowStepper />
      <div className="app-body">
        <main className="main-content">
          <RouteGuard>
            <ErrorBoundary><Screen /></ErrorBoundary>
          </RouteGuard>
        </main>
      </div>
    </div>
  )
}
