// src/screens/CreateProject.tsx
import { useState } from 'react'
import { useStore } from '../store/useStore'
import { Projects } from '../services/api'
import toast from 'react-hot-toast'

export default function CreateProject() {
  const { currentProject, setProject, setStep } = useStore()
  const [form, setForm] = useState({
    name:        currentProject?.name        || '',
    compound:    currentProject?.compound    || '',
    objective:   currentProject?.objective   || '',
    description: currentProject?.description || '',
  })
  const [saving, setSaving] = useState(false)

  function set(key: string, val: string) { setForm(f => ({ ...f, [key]: val })) }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Project name is required'); return }
    setSaving(true)
    try {
      let proj
      if (currentProject?.id) {
        proj = await Projects.update(currentProject.id, form)
      } else {
        proj = await Projects.create(form)
      }
      setProject(proj)
      toast.success(currentProject?.id ? 'Project updated!' : 'Project created!')
      setStep('understand-process')
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-tag">Step 01</div>
        <h1 className="page-title">Create Project</h1>
        <p className="page-desc">Create the project and enter the API, goal, and process details.</p>
      </div>

      <div className="card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group">
            <label className="form-label">Project Name *</label>
            <input className="form-input" placeholder="e.g. LXP-Stage-1 Crystallization Optimization"
              value={form.name} onChange={e => set('name', e.target.value)} />
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Compound / API</label>
              <input className="form-input" placeholder="e.g. LXP-001"
                value={form.compound} onChange={e => set('compound', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Primary Objective</label>
              <input className="form-input" placeholder="e.g. Maximize yield, minimize impurities"
                value={form.objective} onChange={e => set('objective', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Project Description</label>
            <textarea className="form-textarea" rows={10}
              style={{ minHeight: '220px', resize: 'vertical', overflow: 'hidden' }}
              placeholder="Describe the process, background, known constraints, and goals…"
              value={form.description}
              onChange={e => {
                set('description', e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = `${Math.max(220, e.target.scrollHeight)}px`
              }}
              ref={el => {
                if (el) {
                  el.style.height = 'auto'
                  el.style.height = `${Math.max(220, el.scrollHeight)}px`
                }
              }} />
          </div>
        </div>

        <div className="step-nav">
          <button className="btn btn-secondary" onClick={() => setStep('welcome')}>← Back</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <><div className="spinner" />Saving…</> : 'Save & Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
