// src/screens/Phase0/QTPPDefinition.tsx – Screen A1: QTPP Definition
import { useState } from 'react'
import { useStore, QTPPItem } from '../../store/useStore'
import { Projects } from '../../services/api'
import toast from 'react-hot-toast'

const JUSTIFICATION_OPTIONS = [
  'Pharmacopoeial',
  'Regulatory Guideline',
  'Patient-Critical',
  'Internal Spec'
]

const TYPE_OPTIONS = [
  'Identity',
  'Assay-Purity',
  'Impurity',
  'Physical Property',
  'Residual Solvent',
  'Microbial',
  'Stability',
  'Appearance & Color'
]

export default function QTPPDefinition() {
  const { currentProject, qtpp, setQtpp, setStep, addAuditLog } = useStore()

  // Initialize QTPPs: Start completely blank for new projects.
  // Only load existing items if the user already saved custom QTPPs for this project,
  // and discard any legacy hardcoded dummy template items (Purity by GC / Diacetyl Impurity)
  // unless the project is explicitly the Rocuronium Bromide preset.
  const [items, setItems] = useState<QTPPItem[]>(() => {
    const isOldHardcodedDummy =
      qtpp.length > 0 &&
      qtpp.some(q => q.attribute === 'Diacetyl Impurity' || q.attribute === 'Purity by GC') &&
      currentProject?.compound !== 'Rocuronium Bromide'

    if (qtpp.length > 0 && !isOldHardcodedDummy) {
      return qtpp.map(item => {
        if (item.operator) return item

        let op = '='
        let crit = item.criterion || ''

        if (crit.startsWith('>= ') || crit.startsWith('≥ ')) {
          op = '≥'
          crit = crit.replace(/^(>=|≥)\s*/, '')
        } else if (crit.startsWith('<= ') || crit.startsWith('≤ ')) {
          op = '≤'
          crit = crit.replace(/^(<=|≤)\s*/, '')
        } else if (crit.includes(' - ') || crit.includes(' to ')) {
          op = 'Range'
        } else if (crit.toLowerCase().startsWith('conforms')) {
          op = 'Conforms'
        }

        return { ...item, operator: op, criterion: crit }
      })
    }
    return []
  })
  const [saving, setSaving] = useState(false)

  const handleAddRow = () => {
    const newItem: QTPPItem = {
      id: `qtpp-${Date.now()}`,
      attribute: '',
      operator: '≥',
      criterion: '',
      justification: 'Pharmacopoeial',
      type: 'Assay-Purity'
    }
    setItems(prev => [...prev, newItem])
  }

  const handleRemoveRow = (id: string) => {
    setItems(items.filter(i => i.id !== id))
  }

  const handleChange = (id: string, field: keyof QTPPItem, value: string) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= items.length) return
    const updated = [...items]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp
    setItems(updated)
  }

  const handleSaveAndNext = async () => {
    const valid = items.filter(i => i.attribute.trim() !== '')
    if (valid.length === 0) {
      toast.error('Please add at least one Quality Target Product Profile attribute.')
      return
    }
    setSaving(true)
    setQtpp(valid)
    if (currentProject) {
      try {
        await Projects.savePhase0(currentProject.id, { qtpp: valid })
        addAuditLog('QTPP_SAVE', `Saved ${valid.length} QTPP attributes for final API`)
      } catch (e) {
        console.error('Failed to save QTPP to backend', e)
      }
    }
    setSaving(false)
    setStep('cqa')
  }

  return (
    <div className="screen-container">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="badge badge-accent">Step 02 · Phase 0</div>
          <h1 style={{ fontSize: '1.4rem', margin: 0 }}>QTPP Definition</h1>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          Define what quality the final API should have.
        </p>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>API Quality Attributes Table</h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Define attributes and criteria specific to {currentProject?.compound || 'this API'}.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {items.length > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setItems([])}
                title="Clear all rows to start with a blank table"
              >
                Clear All
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={handleAddRow}>
              + Add Quality Attribute
            </button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th style={{ width: '5%' }}>#</th>
                <th style={{ width: '25%' }}>Attribute Name</th>
                <th style={{ width: '25%' }}>Target / Acceptance Criterion</th>
                <th style={{ width: '20%' }}>Justification / Source</th>
                <th style={{ width: '18%' }}>Attribute Type</th>
                <th style={{ width: '7%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2.2rem', marginBottom: '0.6rem' }}>📋</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem', marginBottom: '0.35rem' }}>
                      No QTPP Attributes Defined
                    </div>
                    <div style={{ fontSize: '0.82rem', maxWidth: '440px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                      Quality Target Product Profiles vary from API to API. Click below to add quality specifications tailored to this project.
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={handleAddRow}>
                      + Add Quality Attribute
                    </button>
                  </td>
                </tr>
              ) : (
                items.map((row, idx) => (
                <tr key={row.id}>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                  <td>
                    <input
                      type="text"
                      className="input input-sm"
                      placeholder="e.g. Assay (Purity)"
                      value={row.attribute}
                      onChange={e => handleChange(row.id, 'attribute', e.target.value)}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select
                        className="input input-sm"
                        style={{ width: '80px', flexShrink: 0 }}
                        value={row.operator || '='}
                        onChange={e => handleChange(row.id, 'operator', e.target.value)}
                      >
                        <option value="=">=</option>
                        <option value="≤">≤</option>
                        <option value="≥">≥</option>
                        <option value="Range">Range</option>
                        <option value="Conforms">Conforms</option>
                      </select>
                      <input
                        type="text"
                        className="input input-sm"
                        style={{ flex: 1 }}
                        placeholder="e.g. 99.0% w/w"
                        value={row.criterion}
                        onChange={e => handleChange(row.id, 'criterion', e.target.value)}
                      />
                    </div>
                  </td>
                  <td>
                    <select
                      className="input input-sm"
                      value={row.justification}
                      onChange={e => handleChange(row.id, 'justification', e.target.value)}
                    >
                      {JUSTIFICATION_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="input input-sm"
                      value={row.type}
                      onChange={e => handleChange(row.id, 'type', e.target.value)}
                    >
                      {TYPE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button
                        className="btn btn-icon btn-xs"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, 'up')}
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        className="btn btn-icon btn-xs"
                        disabled={idx === items.length - 1}
                        onClick={() => handleMove(idx, 'down')}
                        title="Move Down"
                      >
                        ▼
                      </button>
                      <button
                        className="btn btn-icon btn-xs btn-danger"
                        onClick={() => handleRemoveRow(row.id)}
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
        <button className="btn btn-primary" onClick={handleSaveAndNext} disabled={saving}>
          {saving ? 'Saving...' : 'Confirm & Proceed to CQA Derivation →'}
        </button>
      </div>
    </div>
  )
}
