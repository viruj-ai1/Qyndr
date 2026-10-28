import { useState, useEffect, useRef } from 'react'
import { useStore, QTPPItem, AcceptanceCriterion } from '../../store/useStore'
import { Projects } from '../../services/api'
import { CriterionInput } from '../../components/CriterionInput'
import {
  parseLegacyCriterion,
  formatCriterionDisplay,
  getCriterionOperator,
  getDefaultCriterionForAttribute
} from '../../utils/criterionUtils'
import { generateContextAwareQTPP } from '../../utils/routeGenerator'
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

function formatItems(list: QTPPItem[]): QTPPItem[] {
  return list.map(item => {
    let ac = item.acceptanceCriterion
    if (!ac) {
      ac = parseLegacyCriterion(item.criterion, item.operator, item.type)
    }
    const op = getCriterionOperator(ac.type)
    const crit = ac.displayString || formatCriterionDisplay(ac) || item.criterion || ''

    return {
      ...item,
      operator: op,
      criterion: crit,
      acceptanceCriterion: ac
    }
  })
}

export default function QTPPDefinition() {
  const { currentProject, qtpp, setQtpp, setStep, addAuditLog } = useStore()

  // For EXISTING projects: load their saved QTPPs directly from project data or store.
  // For NEW projects: auto-suggest standards from pharmacopoeial compendia / compound metadata.
  const getInitialItems = (): QTPPItem[] => {
    const saved = (currentProject?.qtpp_data && currentProject.qtpp_data.length > 0)
      ? currentProject.qtpp_data
      : (qtpp && qtpp.length > 0 ? qtpp : [])

    if (saved.length > 0) {
      return formatItems(saved)
    }

    if (currentProject) {
      const suggested = generateContextAwareQTPP(currentProject)
      if (suggested.length > 0) {
        return formatItems(suggested)
      }
    }

    return []
  }

  const [items, setItems] = useState<QTPPItem[]>(getInitialItems)
  const [saving, setSaving] = useState(false)
  const isFirstMount = useRef(true)

  // Synchronize items whenever the active project changes
  useEffect(() => {
    setItems(getInitialItems())
  }, [currentProject?.id])

  // Synchronize to store and auto-save so going front and back NEVER loses data
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false
      if (items.length > 0 && (!qtpp || qtpp.length === 0)) {
        setQtpp(items)
        if (currentProject?.id) {
          Projects.savePhase0(currentProject.id, { qtpp: items }).catch(() => {})
        }
      }
      return
    }
    setQtpp(items)

    if (!currentProject?.id || items.length === 0) return
    const valid = items.filter(i => i.attribute.trim() !== '')
    if (valid.length === 0) return

    const timer = setTimeout(() => {
      Projects.savePhase0(currentProject.id, { qtpp: valid }).catch(() => {})
    }, 1000)

    return () => clearTimeout(timer)
  }, [items, currentProject?.id, setQtpp])

  // Save to backend on unmount if valid items exist
  useEffect(() => {
    return () => {
      const valid = items.filter(i => i.attribute.trim() !== '')
      if (valid.length > 0 && currentProject?.id) {
        Projects.savePhase0(currentProject.id, { qtpp: valid }).catch(() => {})
      }
    }
  }, [items, currentProject?.id])

  const handleAddRow = () => {
    const defaultType = 'Assay-Purity'
    const defaultCriterion = getDefaultCriterionForAttribute(defaultType)
    const newItem: QTPPItem = {
      id: `qtpp-${Date.now()}`,
      attribute: '',
      operator: getCriterionOperator(defaultCriterion.type),
      criterion: defaultCriterion.displayString || formatCriterionDisplay(defaultCriterion),
      justification: 'Pharmacopoeial',
      type: defaultType,
      acceptanceCriterion: defaultCriterion
    }
    setItems(prev => [...prev, newItem])
  }

  const handleRemoveRow = (id: string) => {
    setItems(items.filter(i => i.id !== id))
  }

  const handleCriterionChange = (id: string, newCriterion: AcceptanceCriterion) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== id) return item
        const op = getCriterionOperator(newCriterion.type)
        const display = newCriterion.displayString || formatCriterionDisplay(newCriterion)
        return {
          ...item,
          operator: op,
          criterion: display,
          acceptanceCriterion: newCriterion
        }
      })
    )
  }

  const handleChange = (id: string, field: keyof QTPPItem, value: string) => {
    setItems(prev =>
      prev.map(i => {
        if (i.id !== id) return i
        if (field === 'type') {
          // If the criterion is currently empty, adapt default to new attribute type
          const isEmpty =
            !i.acceptanceCriterion ||
            (i.acceptanceCriterion.type === 'qualitative' && !i.acceptanceCriterion.textDescription) ||
            (i.acceptanceCriterion.type !== 'qualitative' &&
              i.acceptanceCriterion.minValue == null &&
              i.acceptanceCriterion.maxValue == null &&
              i.acceptanceCriterion.targetValue == null)

          if (isEmpty) {
            const defCriterion = getDefaultCriterionForAttribute(value, i.attribute)
            return {
              ...i,
              type: value,
              operator: getCriterionOperator(defCriterion.type),
              criterion: defCriterion.displayString || formatCriterionDisplay(defCriterion),
              acceptanceCriterion: defCriterion
            }
          }
        }
        return { ...i, [field]: value }
      })
    )
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


  const handleClearAll = () => {
    setItems([])
    setQtpp([])
    if (currentProject?.id) {
      Projects.savePhase0(currentProject.id, { qtpp: [] }).catch(() => {})
    }
    toast('Cleared all QTPP specifications.')
  }

  const handleBack = () => {
    setQtpp(items)
    const valid = items.filter(i => i.attribute.trim() !== '')
    if (valid.length > 0 && currentProject?.id) {
      Projects.savePhase0(currentProject.id, { qtpp: valid }).catch(() => {})
    }
    setStep('create-project')
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
        toast.success('QTPP specifications saved!')
      } catch (e) {
        console.error('Failed to save QTPP to backend', e)
        toast.error('Failed to save to server, saved locally.')
      }
    }
    setSaving(false)
    setStep('cqa')
  }

  return (
    <div className="screen-container">
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.4rem', margin: 0 }}>QTPP Definition</h1>
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
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {items.length > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleClearAll}
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
                <th style={{ width: '4%' }}>#</th>
                <th style={{ width: '22%' }}>Attribute Name</th>
                <th style={{ width: '36%' }}>Target / Acceptance Criterion</th>
                <th style={{ width: '18%' }}>Justification / Source</th>
                <th style={{ width: '14%' }}>Attribute Type</th>
                <th style={{ width: '6%', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2.2rem', marginBottom: '0.6rem' }}>📋</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem', marginBottom: '0.35rem' }}>
                      No QTPP Attributes Defined Yet
                    </div>
                    <div style={{ fontSize: '0.82rem', maxWidth: '480px', margin: '0 auto 1.25rem', lineHeight: 1.5 }}>
                      Target specifications establish the foundation of Quality by Design (QbD). Add custom attributes manually to define the target quality profile for <strong>{currentProject?.compound || 'this API'}</strong>.
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                      <button className="btn btn-primary btn-sm" onClick={handleAddRow}>
                        + Add Quality Attribute
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((row, idx) => (
                <tr key={row.id}>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600, verticalAlign: 'top', paddingTop: '1rem' }}>
                    {idx + 1}
                  </td>
                  <td style={{ verticalAlign: 'top', paddingTop: '0.85rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                      placeholder="e.g. Assay (Purity)"
                      value={row.attribute}
                      onChange={e => handleChange(row.id, 'attribute', e.target.value)}
                    />
                  </td>
                  <td style={{ verticalAlign: 'top', padding: '0.75rem 0.5rem' }}>
                    <CriterionInput
                      value={row.acceptanceCriterion}
                      onChange={newCrit => handleCriterionChange(row.id, newCrit)}
                      attributeType={row.type}
                      attributeName={row.attribute}
                    />
                  </td>
                  <td style={{ verticalAlign: 'top', paddingTop: '0.85rem' }}>
                    <select
                      className="form-select"
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.82rem' }}
                      value={row.justification}
                      onChange={e => handleChange(row.id, 'justification', e.target.value)}
                    >
                      {JUSTIFICATION_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ verticalAlign: 'top', paddingTop: '0.85rem' }}>
                    <select
                      className="form-select"
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.82rem' }}
                      value={row.type}
                      onChange={e => handleChange(row.id, 'type', e.target.value)}
                    >
                      {TYPE_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'center', verticalAlign: 'top', paddingTop: '0.9rem' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.45rem', fontSize: '0.75rem', lineHeight: 1 }}
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, 'up')}
                        title="Move Up"
                      >
                        ▲
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.45rem', fontSize: '0.75rem', lineHeight: 1 }}
                        disabled={idx === items.length - 1}
                        onClick={() => handleMove(idx, 'down')}
                        title="Move Down"
                      >
                        ▼
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ padding: '0.25rem 0.45rem', fontSize: '0.75rem', lineHeight: 1 }}
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

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
        <button className="btn btn-secondary" onClick={handleBack}>
          ← Back to Create Project
        </button>
        <button className="btn btn-primary" onClick={handleSaveAndNext} disabled={saving}>
          {saving ? 'Saving...' : 'Confirm & Proceed to CQA Derivation →'}
        </button>
      </div>
    </div>
  )
}
