import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { simplifyResponseName } from '../utils/targetParser'

export type Step =
  | 'welcome' | 'create-project' | 'qtpp' | 'cqa' | 'route-mapping'
  | 'risk-assessment' | 'stage-campaign-matrix' | 'stage-overview' | 'phase0-summary' | 'campaign-dashboard'
  | 'understand-process' | 'define-factors'
  | 'recommend-doe' | 'generate-doe' | 'lab-experiments' | 'upload-results'
  | 'initial-optimization' | 'enough-data'
  | 'gp-model' | 'bayesian-opt' | 'new-experiment' | 'lab-new'
  | 'update-model' | 'more-improvement' | 'final-optimum' | 'report'

export type CriterionType = 'range' | 'upper_bound' | 'lower_bound' | 'exact' | 'qualitative'

export interface AcceptanceCriterion {
  type: CriterionType
  minValue?: number | null
  maxValue?: number | null
  targetValue?: number | null
  unit?: string
  textDescription?: string
  // Optional: serialized string for backward compatibility with existing backend/APIs
  displayString?: string
}

export interface QTPPItem {
  id: string
  attribute: string
  operator?: string
  criterion: string
  justification: string
  type: string
  acceptanceCriterion?: AcceptanceCriterion
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

export interface ApiTarget {
  id: string
  name: string
  goal: 'Maximize' | 'Minimize' | 'Match Target / Range' | string
  specification: string
  unit: string
  target_value?: number | null
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
  inherited_from_target?: boolean
}

export function isPercentageResponse(r?: Partial<Response> | null): boolean {
  if (!r) return false
  const unit = (r.unit || '').trim().toLowerCase()
  const name = (r.name || '').trim().toLowerCase()
  return (
    unit.includes('%') ||
    unit === 'percent' ||
    unit === 'percentage' ||
    name.includes('%') ||
    name.includes('yield') ||
    name.includes('purity') ||
    name.includes('conversion') ||
    r.upper_limit === 100
  )
}


export interface Project {
  id: number; name: string; compound: string; objective: string
  description: string; current_step: Step; doe_type: string; bayes_iter: number
  qtpp_data?: QTPPItem[]; cqas_data?: CQAMapping[]; stages_data?: StageItem[]
  risk_assessment_data?: Record<string, { parameters: RiskParameter[] }>
  audit_logs?: any[]; locked_campaigns?: string[]
  api_targets?: ApiTarget[]
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
  apiTargets:      ApiTarget[]
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
  setApiTargets:   (items: ApiTarget[]) => void
  addAuditLog:     (action: string, details: string) => void
  setExperiments:  (e: Experiment[]) => void
  setAnalysis:     (idx: number, data: any) => void
  setOptimum:      (d: any) => void
  setBayes:        (d: any) => void
  setFinal:        (d: any) => void
  setLoading:      (v: boolean) => void
  reset:           () => void
}

const INITIAL: Omit<Store, keyof { setProject: any; setStep: any; setActiveStageId: any; setRpnThreshold: any; setQtpp: any; setCqas: any; setStages: any; setRiskAssessments: any; setApiTargets: any; addAuditLog: any; setExperiments: any; setAnalysis: any; setOptimum: any; setBayes: any; setFinal: any; setLoading: any; reset: any }> = {
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
  apiTargets:      [],
  experiments:     [],
  analysisResults: {},
  optimumResult:   null,
  bayesResult:     null,
  finalResult:     null,
  loading:         false,
}

export function normalizeStep(s?: string | null): Step {
  if (!s) return 'qtpp'
  if (s === 'phase0-summary' || s === 'campaign-dashboard' || s === 'stage-overview') return 'stage-campaign-matrix'
  if (s === 'statistical-analysis') return 'initial-optimization'
  if (s === 'lab-experiments' || s === 'upload-results') return 'generate-doe'
  if (s === 'lab-new') return 'new-experiment'
  if (s === 'update-model') return 'bayesian-opt'
  if (s === 'more-improvement') return 'enough-data'
  return s as Step
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...INITIAL,
      setProject: p => set(state => {
        const step = p ? normalizeStep(p.current_step) : 'create-project'

        // Sanitize existing project responses and targets to simple terms
        const sanitizedResponses = p?.responses?.map(r => ({
          ...r,
          name: simplifyResponseName(r.name, r.goal)
        })) ?? [];

        const sanitizedTargets = p?.api_targets?.map(t => ({
          ...t,
          name: simplifyResponseName(t.name, t.goal)
        })) ?? [];

        const sanitizedProject = p ? {
          ...p,
          current_step: step,
          responses: sanitizedResponses,
          api_targets: sanitizedTargets
        } : null;

        return {
          currentProject: sanitizedProject,
          currentStep: step,
          activeStageId: null,
          qtpp: p ? (p.qtpp_data || []) : [],
          cqas: p ? (p.cqas_data || []) : [],
          stages: p ? (p.stages_data || []) : [],
          riskAssessments: p ? (p.risk_assessment_data || {}) : {},
          auditLogs: p ? (p.audit_logs || []) : [],
          lockedCampaigns: p ? (p.locked_campaigns || []) : [],
          apiTargets: sanitizedTargets,
          experiments: p?.experiments ?? [],
          // CRITICAL: Always wipe model results from previous projects
          analysisResults: {},
          optimumResult: null,
          bayesResult: null,
          finalResult: null,
        }
      }),
      setStep:         s  => set(st => ({
        currentStep: s,
        currentProject: st.currentProject ? { ...st.currentProject, current_step: s } : null
      })),
      setActiveStageId: stId => set({ activeStageId: stId }),
      setRpnThreshold: v => set({ rpnThreshold: v }),
      setQtpp:         items => set(st => ({
        qtpp: items,
        currentProject: st.currentProject ? { ...st.currentProject, qtpp_data: items } : null
      })),
      setCqas:         items => set(st => ({
        cqas: items,
        currentProject: st.currentProject ? { ...st.currentProject, cqas_data: items } : null
      })),
      setStages:       items => set(st => ({
        stages: items,
        currentProject: st.currentProject ? { ...st.currentProject, stages_data: items } : null
      })),
      setRiskAssessments: data => set(st => ({
        riskAssessments: data,
        currentProject: st.currentProject ? { ...st.currentProject, risk_assessment_data: data } : null
      })),
      setApiTargets:   items => {
        const sanitized = items.map(t => ({ ...t, name: simplifyResponseName(t.name, t.goal) }))
        return set(st => ({
          apiTargets: sanitized,
          currentProject: st.currentProject ? { ...st.currentProject, api_targets: sanitized } : null
        }))
      },
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
        apiTargets: s.apiTargets,
        experiments: s.experiments,
        analysisResults: s.analysisResults,
        optimumResult: s.optimumResult,
        bayesResult: s.bayesResult,
        finalResult: s.finalResult
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.currentProject) {
          if (state.currentProject.responses) {
            state.currentProject.responses = state.currentProject.responses.map(r => ({
              ...r,
              name: simplifyResponseName(r.name, r.goal)
            }))
          }
          if (state.currentProject.api_targets) {
            state.currentProject.api_targets = state.currentProject.api_targets.map(t => ({
              ...t,
              name: simplifyResponseName(t.name, t.goal)
            }))
          }
        }
        if (state?.apiTargets) {
          state.apiTargets = state.apiTargets.map(t => ({
            ...t,
            name: simplifyResponseName(t.name, t.goal)
          }))
        }
      }
    }
  )
)


