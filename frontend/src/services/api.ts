// src/services/api.ts  –  Axios API service layer
import axios from 'axios'

const api = axios.create({ baseURL: '/api', timeout: 60000 })

api.interceptors.response.use(
  r => r,
  e => {
    console.error('API Error:', e.response?.data || e.message)
    if (e.response?.data && e.response.data.detail) {
      const detail = e.response.data.detail
      if (Array.isArray(detail)) {
        e.response.data.detail = detail.map((d: any) => {
          const field = d.loc && d.loc.length > 1 ? d.loc.slice(1).join('.') : (d.loc ? d.loc.join('.') : 'field')
          return `${field}: ${d.msg}`
        }).join(', ')
      } else if (typeof detail === 'object') {
        e.response.data.detail = JSON.stringify(detail)
      }
    }
    return Promise.reject(e)
  }
)

/* ── Projects ─────────────────────────────────────────────── */
export const Projects = {
  list:    ()              => api.get('/projects').then(r => r.data),
  create:  (d: any)       => api.post('/projects', d).then(r => r.data),
  get:     (id: number)   => api.get(`/projects/${id}`).then(r => r.data),
  update:  (id: number, d: any) => api.put(`/projects/${id}`, d).then(r => r.data),
  delete:  (id: number)   => api.delete(`/projects/${id}`).then(r => r.data),

  getPhase0:    (id: number) => api.get(`/projects/${id}/phase0`).then(r => r.data),
  savePhase0:   (id: number, d: any) => api.put(`/projects/${id}/phase0`, d).then(r => r.data),
  addAuditLog:  (id: number, action: string, details: string) => api.post(`/projects/${id}/audit`, { action, details }).then(r => r.data),
  lockCampaign: (id: number, stage_id: string) => api.post(`/projects/${id}/lock-campaign`, { stage_id }).then(r => r.data),

  saveFactors:   (id: number, factors: any[])   => api.post(`/projects/${id}/factors`,   { factors }).then(r => r.data),
  saveResponses: (id: number, responses: any[]) => api.post(`/projects/${id}/responses`, { responses }).then(r => r.data),
  getExperiments:(id: number)                   => api.get(`/projects/${id}/experiments`).then(r => r.data),
  uploadResults: (id: number, results: any[])   => api.post(`/projects/${id}/results`, { results }).then(r => r.data),
  bayesResult:   (id: number, d: any)           => api.post(`/projects/${id}/bayes-result`, d).then(r => r.data),
  loadRocuroniumPreset: ()                     => api.post('/projects/preset/rocuronium-stage-1').then(r => r.data),
}

/* ── DOE ──────────────────────────────────────────────────── */
export const DOE = {
  recommend: (project_id: number, phase: string, has_htc_factors: boolean = false, constraints: any[] = []) =>
    api.post('/doe/recommend', { project_id, phase, has_htc_factors, constraints }).then(r => r.data),
  evaluate:  (project_id: number, design_key: string) =>
    api.post('/doe/evaluate',  { project_id, design_key }).then(r => r.data),
  generate:  (project_id: number, design_key: string, phase: string, constraints: any[] = []) =>
    api.post('/doe/generate',  { project_id, design_key, phase, constraints }).then(r => r.data),
}

/* ── Analysis ─────────────────────────────────────────────── */
export const Analysis = {
  get:        (project_id: number) =>
    api.get(`/analysis/${project_id}`).then(r => r.data),
  run:        (project_id: number, response_idx: number) =>
    api.post('/analysis/run',      { project_id, response_idx }).then(r => r.data),
  runAll:     (project_id: number) =>
    api.post('/analysis/run-all',  { project_id }).then(r => r.data),
  optimize:   (project_id: number) =>
    api.post('/analysis/optimize', { project_id }).then(r => r.data),
  contour:    (project_id: number, response_idx: number, factor_x: number, factor_y: number) =>
    api.post('/analysis/contour',  { project_id, response_idx, factor_x, factor_y }).then(r => r.data),
  overlay:    (project_id: number, factor_x: number = 0, factor_y: number = 1) =>
    api.post('/analysis/overlay',  { project_id, factor_x, factor_y }).then(r => r.data),
  monteCarlo: (project_id: number, factor_stds: number[], n_iterations: number = 5000, factor_x: number = 0, factor_y: number = 1) =>
    api.post('/analysis/monte-carlo', { project_id, factor_stds, n_iterations, factor_x, factor_y }).then(r => r.data),
}


/* ── Optimization ─────────────────────────────────────────── */
export const Optimization = {
  recommend: (project_id: number, response_idx: number) =>
    api.post('/optimization/gp/recommend', { project_id, response_idx }).then(r => r.data),
  final:     (project_id: number, response_idx: number) =>
    api.post('/optimization/gp/final',     { project_id, response_idx }).then(r => r.data),
  latest:    (project_id: number) =>
    api.get(`/optimization/gp/latest-recommendation/${project_id}`).then(r => r.data),
  llmSummary: (project_id: number, response_idx: number) =>
    api.post('/optimization/llm-summary', { project_id, response_idx }).then(r => r.data),
  llmChat: (project_id: number, message: string, chat_history: any[], response_idx: number = 0) =>
    api.post('/optimization/llm-chat', { project_id, response_idx, message, chat_history }).then(r => r.data),
}

/* ── Reports ──────────────────────────────────────────────── */
export const Reports = {
  summary: (id: number) => api.get(`/reports/${id}/summary`).then(r => r.data),
  pdf: (id: number) => {
    const link = document.createElement('a')
    link.href = `/api/reports/${id}/pdf`
    link.setAttribute('download', '')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  },
  excel: (id: number) => {
    const link = document.createElement('a')
    link.href = `/api/reports/${id}/excel`
    link.setAttribute('download', '')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  },
}

export default api

