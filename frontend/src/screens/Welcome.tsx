// src/screens/Welcome.tsx  –  Project Dashboard
import { useState, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { Projects, Analysis } from '../services/api'
import toast from 'react-hot-toast'
import logo from '../assets/logo.png'

export default function Welcome() {
  const { setProject, setStep, setAnalysis, setOptimum } = useStore()
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    let retries = 3
    async function loadProjects() {
      try {
        const data = await Projects.list()
        setProjects(data)
      } catch (err) {
        if (retries > 0) {
          retries--
          setTimeout(loadProjects, 1000)
        } else {
          toast.error('Could not connect to backend')
        }
      } finally {
        setLoading(false)
      }
    }
    loadProjects()
  }, [])


  async function openProject(p: any) {
    try {
      const fullProj = await Projects.get(p.id)
      setProject(fullProj)
      setStep(fullProj.current_step || 'create-project')
    } catch {
      setProject(p)
      setStep(p.current_step || 'create-project')
    }
  }


  async function deleteProject(e: React.MouseEvent, id: number) {
    e.stopPropagation()
    if (!confirm('Delete this project?')) return
    await Projects.delete(id)
    setProjects(prev => prev.filter(p => p.id !== id))
    toast.success('Project deleted')
  }

  const stepLabel: Record<string, string> = {
    'create-project': 'Setup', 'define-factors': 'Factors',
    'generate-doe': 'DOE', 'upload-results': 'Results',
    'initial-optimization': 'Optimization',
    'bayesian-opt': 'Bayesian Loop', 'final-optimum': 'Complete', 'report': 'Done'
  }

  async function handleLoadPreset() {
    setLoading(true)
    try {
      const proj = await Projects.loadRocuroniumPreset()
      setProject(proj)
      setOptimum(null)
      try {
        const res = await Analysis.runAll(proj.id)
        if (res && typeof res === 'object') {
          Object.entries(res).forEach(([idx, a]) => setAnalysis(+idx, a))
        }
        const opt = await Analysis.optimize(proj.id)
        if (opt) setOptimum(opt)
      } catch (err) {
        console.warn('Preset analysis load:', err)
      }
      toast.success('Loaded ROCURONIUM BROMIDE STAGE-I process dataset!')
      setStep('initial-optimization')
    } catch (e: any) {
      toast.error('Failed to load preset dataset')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: '2rem' }}>
      {/* Hero */}
      <div className="welcome-hero" style={{ paddingBottom: '2rem' }}>
        <div style={{ height: '100px', marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
          <img src={logo} alt="Viruj Pharma Logo" style={{ height: '100%', objectFit: 'contain' }} />
        </div>
        <h1 className="hero-title">
          Viruj <span>Chematrix</span>
        </h1>
        <p className="hero-sub">
          End-to-end Design of Experiments platform. Screen factors, execute laboratory runs, 
          and discover optimal process conditions with Gaussian Process Bayesian optimization.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={() => { setProject(null); setStep('create-project'); }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Project
          </button>
        </div>

        {/* Feature chips */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '0.5rem' }}>
          {['Fractional Factorial', 'Plackett-Burman', 'CCD / Box-Behnken', 'Taguchi', 'RSM', 'Gaussian Process', 'Bayesian Optimization', 'PDF / Excel Reports'].map(f => (
            <span key={f} className="badge badge-primary">{f}</span>
          ))}
        </div>
      </div>

      {/* Project list */}
      <div style={{ width: '100%', margin: '0 auto' }}>
        <div className="flex-between mb-2">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
            Recent Projects
            {!loading && <span className="badge badge-accent" style={{ marginLeft: '0.5rem' }}>{projects.length}</span>}
          </h2>
        </div>

        {loading ? (
          <div className="loading-overlay"><div className="spinner" /> Loading projects…</div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔬</div>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>No projects yet</div>
            <div style={{ fontSize: '0.85rem' }}>Click "New Project" to start your first DOE</div>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map(p => (
              <div key={p.id} className="project-card" onClick={() => openProject(p)}>
                <div className="flex-between">
                  <div className="project-card-name">{p.name}</div>
                  <button className="btn btn-danger btn-sm" style={{ padding: '0.2rem 0.5rem' }}
                    onClick={e => deleteProject(e, p.id)} title="Delete project">✕</button>
                </div>
                {p.compound && <div className="project-card-compound">{p.compound}</div>}
                {p.objective && <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', lineHeight: 1.5 }}>{p.objective.slice(0,100)}{p.objective.length>100?'…':''}</div>}
                <div className="project-card-meta">
                  <span>📊 {p.experiment_count || 0} runs</span>
                  {p.doe_type && <span>🧪 {p.doe_type}</span>}
                  <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                    {stepLabel[p.current_step] || p.current_step}
                  </span>
                  {p.bayes_iter > 0 && <span className="badge badge-success">Bayes: {p.bayes_iter}</span>}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Updated: {new Date(p.updated_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workflow diagram */}
      <div style={{ maxWidth: '1100px', margin: '3rem auto 0', padding: '0 1rem' }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Workflow Overview</div>
            <div className="card-sub">Full end-to-end DOE + Bayesian optimization pipeline</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {['Create Project','Define Factors','DOE Generation','Lab Experiments','Initial Optimum','GP Model','Bayesian Loop','Final Optimum','Report'].map((s, i, arr) => (
              <span key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '8px', padding: '0.3rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary-light)', whiteSpace: 'nowrap' }}>{s}</span>
                {i < arr.length-1 && <span style={{ color: 'var(--text-muted)' }}>→</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
