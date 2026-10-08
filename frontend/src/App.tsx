// src/App.tsx  –  Root application component with step-based routing
import { useStore, Step } from './store/useStore'
import Sidebar from './components/Layout/Sidebar'
import Header  from './components/Layout/Header'
import ErrorBoundary from './components/ErrorBoundary'

// Phase 0 Screens
import QTPPDefinition       from './screens/Phase0/QTPPDefinition'
import CQADerivation        from './screens/Phase0/CQADerivation'
import RouteMapping         from './screens/Phase0/RouteMapping'
import ReverseRiskAssessment from './screens/Phase0/ReverseRiskAssessment'
import Phase0Summary        from './screens/Phase0/Phase0Summary'
import CampaignDashboard    from './screens/CampaignDashboard'

// Existing Screens
import Welcome             from './screens/Welcome'
import CreateProject       from './screens/CreateProject'
import UnderstandProcess   from './screens/UnderstandProcess'
import DefineFactors       from './screens/DefineFactors'
import RecommendDOE        from './screens/RecommendDOE'
import GenerateDOE         from './screens/GenerateDOE'
import LabExperiments      from './screens/LabExperiments'
import UploadResults       from './screens/UploadResults'
import InitialOptimization from './screens/InitialOptimization'
import EnoughData          from './screens/EnoughData'
import GPModel             from './screens/GPModel'
import BayesianOpt         from './screens/BayesianOpt'
import NewExperiment       from './screens/NewExperiment'
import FinalOptimum        from './screens/FinalOptimum'
import Report              from './screens/Report'

const SCREEN_MAP: Record<Step, React.FC> = {
  'welcome':               Welcome,
  'create-project':        CreateProject,
  'qtpp':                  QTPPDefinition,
  'cqa':                   CQADerivation,
  'route-mapping':         RouteMapping,
  'risk-assessment':       ReverseRiskAssessment,
  'phase0-summary':        Phase0Summary,
  'campaign-dashboard':    CampaignDashboard,
  'understand-process':    UnderstandProcess,
  'define-factors':        DefineFactors,
  'recommend-doe':         RecommendDOE,
  'generate-doe':          GenerateDOE,
  'lab-experiments':       LabExperiments,
  'upload-results':        UploadResults,
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
  const { currentStep } = useStore()
  const Screen = SCREEN_MAP[currentStep] || Welcome

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
