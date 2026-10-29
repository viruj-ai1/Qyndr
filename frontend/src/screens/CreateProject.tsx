// src/screens/CreateProject.tsx – Step 01: Project Setup
import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Projects } from '../services/api'
import { extractTargetsFromDescription } from '../utils/targetParser'
import toast from 'react-hot-toast'

export default function CreateProject() {
  const { currentProject, setProject, setStep, setApiTargets } = useStore()
  const [form, setForm] = useState({
    name:        currentProject?.name        || '',
    compound:    currentProject?.compound    || '',
    objective:   currentProject?.objective   || '',
    description: currentProject?.description || '',
  })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setForm({
      name:        currentProject?.name        || '',
      compound:    currentProject?.compound    || '',
      objective:   currentProject?.objective   || '',
      description: currentProject?.description || '',
    })
  }, [currentProject?.id])

  function set(key: string, val: string) {
    setForm(f => {
      const next = { ...f, [key]: val }

      // Synchronize in-memory targets from description so other steps have real-time targets
      if (currentProject) {
        const parsedTargets = extractTargetsFromDescription(
          key === 'description' ? val : next.description,
          key === 'objective' ? val : next.objective,
          key === 'compound' ? val : next.compound
        )
        setProject({ ...currentProject, ...next, api_targets: parsedTargets })
        setApiTargets(parsedTargets)
      }
      return next
    })
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Project name is required'); return }
    setSaving(true)
    try {
      // Automatically extract structured process targets directly from Project Description
      const extractedTargets = extractTargetsFromDescription(form.description, form.objective, form.compound)

      const payload = {
        ...form,
        api_targets: extractedTargets,
        current_step: 'qtpp'
      }

      let proj
      if (currentProject?.id) {
        proj = await Projects.update(currentProject.id, payload)
      } else {
        proj = await Projects.create(payload)
      }

      setProject({ ...proj, api_targets: extractedTargets })
      setApiTargets(extractedTargets)
      toast.success(currentProject?.id ? 'Project updated!' : 'Project created!')
      setStep('qtpp')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Create Project</h1>
        <p className="page-desc">Create the project and enter the API, goal, and process details.</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input
              className="form-input"
              placeholder="e.g. LXP-Stage-1 Crystallization Optimization"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Compound / API</label>
              <input
                className="form-input"
                placeholder="e.g. Propofol or LXP-001"
                value={form.compound}
                onChange={e => set('compound', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Primary Objective</label>
              <input
                className="form-input"
                placeholder="e.g. Maximize yield, minimize impurities"
                value={form.objective}
                onChange={e => set('objective', e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Project Description</label>
            <textarea
              className="form-textarea"
              rows={6}
              style={{ minHeight: '140px', resize: 'vertical' }}
              placeholder="Describe the process, background, target quality criteria (e.g. assay/purity specifications, impurity limits, reaction yield), and known constraints…"
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </div>
        </div>

        <div className="step-nav" style={{ marginTop: '1.75rem' }}>
          <button className="btn btn-secondary" onClick={() => setStep('welcome')}>← Back</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" />Saving…</> : 'Save & Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
