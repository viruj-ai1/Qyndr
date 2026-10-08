// src/screens/Phase0/QTPPDefinition.tsx – Screen A1: QTPP Definition
import { useState } from 'react'
import { useStore, QTPPItem } from '../../store/useStore'
import { Projects } from '../../services/api'

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

  const DEFAULT_QTPP: QTPPItem[] = [
    { id: 'qtpp-1', attribute: 'Purity by GC', operator: '≥', criterion: '98.0% w/w', justification: 'Pharmacopoeial', type: 'Assay-Purity' },
    { id: 'qtpp-2', attribute: 'Diacetyl Impurity', operator: '≤', criterion: '0.15% w/w', justification: 'Patient-Critical', type: 'Impurity' },
    { id: 'qtpp-3', attribute: 'KSM-1', operator: '≤', criterion: '0.50% w/w', justification: 'Internal Spec', type: 'Impurity' },
    { id: 'qtpp-4', attribute: 'Single maximum unknown impurity', operator: '≤', criterion: '0.10% w/w', justification: 'Regulatory Guideline', type: 'Impurity' },
    { id: 'qtpp-5', attribute: 'Total Impurities', operator: '≤', criterion: '1.00% w/w', justification: 'Pharmacopoeial', type: 'Impurity' },
    { id: 'qtpp-6', attribute: 'Identification by IR', operator: 'Conforms', criterion: 'to Reference Spectrum', justification: 'Pharmacopoeial', type: 'Identity' },
    { id: 'qtpp-7', attribute: 'Residue on ignition', operator: '≤', criterion: '0.10% w/w', justification: 'Pharmacopoeial', type: 'Impurity' },
    { id: 'qtpp-8', attribute: 'Specific Optical Rotation (SOR)', operator: 'Range', criterion: '+28.0° to +32.0°', justification: 'Pharmacopoeial', type: 'Physical Property' },
    { id: 'qtpp-9', attribute: 'Melting point', operator: 'Range', criterion: '152°C - 156°C', justification: 'Pharmacopoeial', type: 'Physical Property' },
    { id: 'qtpp-10', attribute: 'Assay (HPLC Anhydrous)', operator: 'Range', criterion: '98.0% - 102.0% w/w', justification: 'Pharmacopoeial', type: 'Assay-Purity' },
    { id: 'qtpp-17', attribute: 'Water Content / Karl Fischer', operator: '≤', criterion: '0.50% w/w', justification: 'Pharmacopoeial', type: 'Physical Property' },
    { id: 'qtpp-24', attribute: 'Appearance, Powder Color & Description', operator: '=', criterion: 'White to off-white or pale yellow crystalline powder', justification: 'Pharmacopoeial', type: 'Appearance & Color' }
  ]

  const [items, setItems] = useState<QTPPItem[]>(() => {
    const initial = qtpp.length > 0 ? qtpp : DEFAULT_QTPP
    return initial.map(item => {
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
  })
  const [saving, setSaving] = useState(false)

  const handleAddRow = () => {
    const newItem: QTPPItem = {
      id: `qtpp-${Date.now()}`,
      attribute: '',
      operator: '=',
      criterion: '',
      justification: 'Pharmacopoeial',
      type: 'Assay-Purity'
    }
    setItems([...items, newItem])
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
      alert('Please add at least one valid Quality Target Product Profile attribute.')
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: 0 }}>API Quality Attributes Table</h3>
          <button className="btn btn-secondary btn-sm" onClick={handleAddRow}>
            + Add Quality Attribute
          </button>
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
              {items.map((row, idx) => (
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
              ))}
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
