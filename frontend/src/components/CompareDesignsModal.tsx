// frontend/src/components/CompareDesignsModal.tsx
// Comparison Table for all 10 DoE Designs
import React, { useState, useMemo } from 'react'
import { DOE_MANUAL_DESIGNS, DoEDesignManualEntry, DoECategory } from '../utils/doeManualData'
import { Check, X, ArrowUpDown, Filter } from 'lucide-react'

interface CompareDesignsModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectDesign: (designId: string) => void
}

type SortField = 'name' | 'category' | 'factorCountMin' | 'runEfficiency' | 'resolution'
type FilterCategory = 'All' | 'Screening' | 'Optimization / RSM' | 'Formulation / Mixture' | 'Sequential / Adaptive'

export default function CompareDesignsModal({
  isOpen,
  onClose,
  onSelectDesign
}: CompareDesignsModalProps) {
  const [sortField, setSortField] = useState<SortField>('category')
  const [sortAsc, setSortAsc] = useState<boolean>(true)
  const [categoryFilter, setCategoryFilter] = useState<FilterCategory>('All')
  const [searchTerm, setSearchTerm] = useState('')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(true)
    }
  }

  const filteredAndSorted = useMemo(() => {
    return DOE_MANUAL_DESIGNS.filter(d => {
      const matchCat = categoryFilter === 'All' || d.category === categoryFilter
      const q = searchTerm.toLowerCase().trim()
      const matchSearch =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.shortName.toLowerCase().includes(q) ||
        d.resolution.toLowerCase().includes(q) ||
        d.experimentObjective.toLowerCase().includes(q) ||
        (d.guide && d.guide.whyChoose.some(w => w.toLowerCase().includes(q)))
      return matchCat && matchSearch
    }).sort((a, b) => {
      let comp = 0
      if (sortField === 'name') comp = a.name.localeCompare(b.name)
      else if (sortField === 'category') comp = a.category.localeCompare(b.category)
      else if (sortField === 'factorCountMin') comp = a.factorCountMin - b.factorCountMin
      else if (sortField === 'resolution') comp = a.resolution.localeCompare(b.resolution)
      else comp = a.id.localeCompare(b.id)
      return sortAsc ? comp : -comp
    })
  }, [categoryFilter, searchTerm, sortField, sortAsc])

  if (!isOpen) return null

  const getCategoryBadgeStyle = (category: DoECategory) => {
    switch (category) {
      case 'Screening':
        return { background: 'rgba(0, 91, 170, 0.1)', color: '#005baa', border: '1px solid rgba(0, 91, 170, 0.25)' }
      case 'Optimization / RSM':
        return { background: 'rgba(5, 150, 105, 0.1)', color: '#059669', border: '1px solid rgba(5, 150, 105, 0.25)' }
      case 'Formulation / Mixture':
        return { background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', border: '1px solid rgba(124, 58, 237, 0.25)' }
      case 'Sequential / Adaptive':
        return { background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', border: '1px solid rgba(217, 119, 6, 0.25)' }
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(8px)',
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.35)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
          padding: 0
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.2rem 1.75rem',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#ffffff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span
                style={{
                  background: 'rgba(0, 174, 179, 0.2)',
                  color: '#2dd4bf',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '10px',
                  textTransform: 'uppercase'
                }}
              >
                Side-by-Side Comparison Matrix
              </span>
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>All 10 DoE Designs</span>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: '#ffffff' }}>
              Compare All 10 Experimental Architectures
            </h3>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: 'none',
              color: '#ffffff',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1.1rem'
            }}
          >
            ✕
          </button>
        </div>

        {/* Toolbar: Filter & Search */}
        <div
          style={{
            padding: '0.85rem 1.5rem',
            background: '#f8fafc',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
            flexWrap: 'wrap'
          }}
        >
          {/* Category filter pills */}
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginRight: '0.25rem' }}>
              <Filter size={12} />
              <span>Category:</span>
            </span>
            {(['All', 'Screening', 'Optimization / RSM', 'Formulation / Mixture', 'Sequential / Adaptive'] as FilterCategory[]).map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: '6px',
                  border: '1px solid',
                  borderColor: categoryFilter === cat ? 'var(--primary)' : 'var(--border)',
                  background: categoryFilter === cat ? 'var(--primary)' : '#ffffff',
                  color: categoryFilter === cat ? '#ffffff' : 'var(--text-primary)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {cat === 'Optimization / RSM' ? 'Optimization' : cat === 'Formulation / Mixture' ? 'Mixture' : cat === 'Sequential / Adaptive' ? 'Sequential' : cat}
              </button>
            ))}
          </div>

          {/* Search box */}
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search table..."
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              fontSize: '0.78rem',
              width: '180px',
              outline: 'none'
            }}
          />
        </div>

        {/* Scrollable Table Area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 0.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, zIndex: 10 }}>
                <th
                  onClick={() => handleSort('name')}
                  style={{ padding: '0.75rem 0.6rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>Design Name</span>
                    <ArrowUpDown size={11} color="var(--text-muted)" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  style={{ padding: '0.75rem 0.6rem', fontWeight: 700, cursor: 'pointer', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <span>Stage</span>
                    <ArrowUpDown size={11} color="var(--text-muted)" />
                  </div>
                </th>
                <th style={{ padding: '0.75rem 0.6rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  Factor Range
                </th>
                <th style={{ padding: '0.75rem 0.6rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  Run Count
                </th>
                <th style={{ padding: '0.75rem 0.6rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  Interactions (2FIs)
                </th>
                <th style={{ padding: '0.75rem 0.6rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  Curvature
                </th>
                <th style={{ padding: '0.75rem 0.6rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  Aliasing / Confounding
                </th>
                <th style={{ padding: '0.75rem 0.6rem', fontWeight: 700, color: 'var(--text-primary)', minWidth: '180px' }}>
                  Best Use Case
                </th>
                <th style={{ padding: '0.75rem 0.6rem', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSorted.map((d, idx) => {
                const isEven = idx % 2 === 0
                const has2FIs = d.modelCapability === 'Linear + 2FIs' || d.modelCapability === 'Full Quadratic (Curvature / Surface)' || d.modelCapability === 'Scheffé Polynomials'
                const hasCurvature = d.modelCapability === 'Full Quadratic (Curvature / Surface)' || d.id === 'dsd' || d.id === 'bayesian_gp'

                return (
                  <tr
                    key={d.id}
                    style={{
                      background: isEven ? '#ffffff' : '#f8fafc',
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 91, 170, 0.04)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isEven ? '#ffffff' : '#f8fafc')}
                  >
                    {/* Design Name */}
                    <td style={{ padding: '0.75rem 0.6rem', fontWeight: 700, color: 'var(--primary)' }}>
                      <div>{d.shortName}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 400 }}>{d.key}</div>
                    </td>

                    {/* Stage Badge */}
                    <td style={{ padding: '0.75rem 0.6rem' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                          ...getCategoryBadgeStyle(d.category)
                        }}
                      >
                        {d.category.split(' ')[0]}
                      </span>
                    </td>

                    {/* Factor Range */}
                    <td style={{ padding: '0.75rem 0.6rem', color: 'var(--text-secondary)' }}>
                      {d.factorCountMin} to {d.factorCountMax}
                    </td>

                    {/* Run Count */}
                    <td style={{ padding: '0.75rem 0.6rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                      <div style={{ fontSize: '0.75rem' }}>{d.typicalRunExamples.split('|')[0]?.trim()}</div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)', fontWeight: 400 }}>{d.runCountFormula.split('(')[0]?.trim()}</div>
                    </td>

                    {/* 2FIs */}
                    <td style={{ padding: '0.75rem 0.6rem' }}>
                      {has2FIs ? (
                        <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600 }}>
                          <Check size={13} />
                          <span>{d.id === 'dsd' ? 'Sparse' : 'Yes'}</span>
                        </span>
                      ) : (
                        <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <X size={13} />
                          <span>Aliased / No</span>
                        </span>
                      )}
                    </td>

                    {/* Curvature */}
                    <td style={{ padding: '0.75rem 0.6rem' }}>
                      {hasCurvature ? (
                        <span style={{ color: '#059669', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 600 }}>
                          <Check size={13} />
                          <span>{d.id === 'dsd' ? 'Detects' : 'Full'}</span>
                        </span>
                      ) : (
                        <span style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <span>Center only</span>
                        </span>
                      )}
                    </td>

                    {/* Aliasing / Confounding */}
                    <td style={{ padding: '0.75rem 0.6rem', color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
                      {d.resolution.split('(')[0]?.trim()}
                    </td>

                    {/* Best Use Case */}
                    <td style={{ padding: '0.75rem 0.6rem', color: 'var(--text-secondary)', fontSize: '0.72rem', lineHeight: 1.35 }}>
                      {d.guide ? d.guide.whyChoose[0] : d.experimentObjective}
                    </td>

                    {/* Action */}
                    <td style={{ padding: '0.75rem 0.6rem', textAlign: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectDesign(d.id)
                          onClose()
                        }}
                        style={{
                          background: 'rgba(0, 91, 170, 0.08)',
                          border: '1px solid rgba(0, 91, 170, 0.25)',
                          color: 'var(--primary)',
                          borderRadius: '6px',
                          padding: '0.25rem 0.55rem',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '0.75rem 1.5rem',
            background: '#ffffff',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.74rem',
            color: 'var(--text-muted)'
          }}
        >
          <span>Showing {filteredAndSorted.length} of {DOE_MANUAL_DESIGNS.length} designs</span>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ fontSize: '0.78rem' }}>
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  )
}

