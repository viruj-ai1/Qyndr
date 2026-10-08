// src/store/useStore.ts  –  Zustand global store
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Step =
  | 'welcome' | 'create-project' | 'qtpp' | 'cqa' | 'route-mapping'
  | 'risk-assessment' | 'phase0-summary' | 'campaign-dashboard'
  | 'understand-process' | 'define-factors'
  | 'recommend-doe' | 'generate-doe' | 'lab-experiments' | 'upload-results'
  | 'initial-optimization' | 'enough-data'
  | 'gp-model' | 'bayesian-opt' | 'new-experiment' | 'lab-new'
  | 'update-model' | 'more-improvement' | 'final-optimum' | 'report'

export interface QTPPItem {
  id: string
  attribute: string
  operator?: string
  criterion: string
  justification: string
  type: string
}

export interface CQAMapping {
  id: string
  name: string
  appliesTo: 'Final API' | 'Intermediate'
  stageName?: string
  method?: string
  range?: string
  justification?: string
  linkedQtppIds: string[]
}

export interface StageItem {
  id: string
  order: number
  name: string
  unitOpType: 'Reaction' | 'Workup' | 'Crystallization' | 'Filtration' | 'Drying' | 'Purification' | 'Other'
  description?: string
  intermediateProduced?: string
}

export interface RiskParameter {
  id: string
  name: string
  type: 'CPP-candidate' | 'CMA-candidate'
  linkedCqaIds: string[]
  severity: number
  occurrence: number
  detectability: number
  rpn: number
  rationale: string
  criticalFlag: boolean
  overrideReason?: string
}

export interface Factor {
  id?: number; name: string; symbol?: string; unit: string
  low: number; high: number; baseline: number; factor_order?: number
  is_categorical?: boolean; is_hard_to_change?: boolean
  stage_id?: string; linked_cqa_ids?: string[]
}

export interface Response {
  id?: number; name: string; unit: string; goal: string
  target?: number; lower_limit?: number; upper_limit?: number; weight?: number
  stage_id?: string; linked_cqa_ids?: string[]
}

export interface Project {
  id: number; name: string; compound: string; objective: string
  description: string; current_step: Step; doe_type: string; bayes_iter: number
  qtpp_data?: QTPPItem[]; cqas_data?: CQAMapping[]; stages_data?: StageItem[]
  risk_assessment_data?: Record<string, { parameters: RiskParameter[] }>
  audit_logs?: any[]; locked_campaigns?: string[]
  factors: Factor[]; responses: Response[]; experiments?: Experiment[]
  created_at?: string; updated_at?: string
}

export interface Experiment {
  id: number; run_number: number; run_type: string
  coded_values: number[]; actual_values: number[]
  result_values: (number|null)[] | null; iteration: number; is_completed: boolean
}

interface Store {
  // State
  currentProject: Project | null
  currentStep:    Step
  activeStageId:  string | null
  rpnThreshold:   number
  qtpp:           QTPPItem[]
  cqas:           CQAMapping[]
  stages:         StageItem[]
  riskAssessments: Record<string, { parameters: RiskParameter[] }>
  auditLogs:      any[]
  lockedCampaigns: string[]
  experiments:    Experiment[]
  analysisResults: Record<number, any>
  optimumResult:   any
  bayesResult:     any
  finalResult:     any
  loading:         boolean

  // Actions
  setProject:      (p: Project | null) => void
  setStep:         (s: Step) => void
  setActiveStageId: (stageId: string | null) => void
  setRpnThreshold: (val: number) => void
  setQtpp:         (items: QTPPItem[]) => void
  setCqas:         (items: CQAMapping[]) => void
  setStages:       (items: StageItem[]) => void
  setRiskAssessments: (data: Record<string, { parameters: RiskParameter[] }>) => void
  addAuditLog:     (action: string, details: string) => void
  setExperiments:  (e: Experiment[]) => void
  setAnalysis:     (idx: number, data: any) => void
  setOptimum:      (d: any) => void
  setBayes:        (d: any) => void
  setFinal:        (d: any) => void
  setLoading:      (v: boolean) => void
  reset:           () => void
}

const INITIAL: Omit<Store, keyof { setProject: any; setStep: any; setActiveStageId: any; setRpnThreshold: any; setQtpp: any; setCqas: any; setStages: any; setRiskAssessments: any; addAuditLog: any; setExperiments: any; setAnalysis: any; setOptimum: any; setBayes: any; setFinal: any; setLoading: any; reset: any }> = {
  currentProject:  null,
  currentStep:     'welcome',
  activeStageId:   null,
  rpnThreshold:    100,
  qtpp:            [],
  cqas:            [],
  stages:          [],
  riskAssessments: {},
  auditLogs:       [],
  lockedCampaigns: [],
  experiments:     [],
  analysisResults: {},
  optimumResult:   null,
  bayesResult:     null,
  finalResult:     null,
  loading:         false,
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      setProject:     p  => set(state => ({
        currentProject: p,
        currentStep: (p?.current_step as Step) || (p ? 'qtpp' : 'create-project'),
        qtpp: p?.qtpp_data || state.qtpp,
        cqas: p?.cqas_data || state.cqas,
        stages: p?.stages_data || state.stages,
        riskAssessments: p?.risk_assessment_data || state.riskAssessments,
        auditLogs: p?.audit_logs || state.auditLogs,
        lockedCampaigns: p?.locked_campaigns || state.lockedCampaigns,
        experiments: p?.experiments ?? (p ? state.experiments : [])
      })),
      setStep:         s  => set({ currentStep: s }),
      setActiveStageId: stId => set({ activeStageId: stId }),
      setRpnThreshold: v => set({ rpnThreshold: v }),
      setQtpp:         items => set({ qtpp: items }),
      setCqas:         items => set({ cqas: items }),
      setStages:       items => set({ stages: items }),
      setRiskAssessments: data => set({ riskAssessments: data }),
      addAuditLog:     (action, details) => set(st => ({
        auditLogs: [
          ...st.auditLogs,
          { id: `log-${st.auditLogs.length + 1}`, user: 'R&D Scientist', timestamp: new Date().toISOString(), action, details }
        ]
      })),
      setExperiments:  e  => set({ experiments: e }),
      setAnalysis:    (idx, d) => set(st => ({ analysisResults: { ...st.analysisResults, [idx]: d } })),
      setOptimum:     d  => set({ optimumResult: d }),
      setBayes:        d  => set({ bayesResult: d }),
      setFinal:        d  => set({ finalResult: d }),
      setLoading:      v  => set({ loading: v }),
      reset:          () => set({ ...INITIAL }),
    }),
    {
      name: 'doe-workflow-store',
      partialize: s => ({
        currentProject: s.currentProject,
        currentStep: s.currentStep,
        activeStageId: s.activeStageId,
        rpnThreshold: s.rpnThreshold,
        qtpp: s.qtpp,
        cqas: s.cqas,
        stages: s.stages,
        riskAssessments: s.riskAssessments,
        auditLogs: s.auditLogs,
        lockedCampaigns: s.lockedCampaigns,
        experiments: s.experiments,
        analysisResults: s.analysisResults,
        optimumResult: s.optimumResult,
        bayesResult: s.bayesResult,
        finalResult: s.finalResult
      })
    }
  )
)


