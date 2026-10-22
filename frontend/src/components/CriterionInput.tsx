// src/components/CriterionInput.tsx
// Modular, context-aware input component for QTPP Target / Acceptance Criterion

import React, { useMemo } from 'react';
import {
  AcceptanceCriterion,
  CriterionType,
  CRITERION_TYPES,
  COMMON_UNITS,
  getSuggestedUnits,
  getDefaultCriterionForAttribute,
  convertCriterionType,
  formatCriterionDisplay,
  getCriterionOperator
} from '../utils/criterionUtils';

export interface CriterionInputProps {
  value?: AcceptanceCriterion;
  onChange: (criterion: AcceptanceCriterion) => void;
  attributeType?: string;
  attributeName?: string;
  disabled?: boolean;
}

export const CriterionInput: React.FC<CriterionInputProps> = ({
  value,
  onChange,
  attributeType = 'Assay-Purity',
  attributeName = '',
  disabled = false
}) => {
  // Normalize value with safe fallback
  const criterion: AcceptanceCriterion = useMemo(() => {
    if (value && value.type) return value;
    return getDefaultCriterionForAttribute(attributeType, attributeName);
  }, [value, attributeType, attributeName]);

  // Context-aware unit suggestions
  const suggestedUnits = useMemo(() => {
    return getSuggestedUnits(attributeType, attributeName);
  }, [attributeType, attributeName]);


  // Handle Type Change (preserves numbers, units, and text)
  const handleTypeChange = (newType: CriterionType) => {
    const updated = convertCriterionType(criterion, newType);
    onChange(updated);
  };

  // Helper to trigger updates with recomputed displayString
  const updateCriterion = (updates: Partial<AcceptanceCriterion>) => {
    const next: AcceptanceCriterion = {
      ...criterion,
      ...updates
    };
    next.displayString = formatCriterionDisplay(next);
    onChange(next);
  };

  // Safe number parsing
  const handleNumberChange = (
    field: 'minValue' | 'maxValue' | 'targetValue',
    valStr: string
  ) => {
    if (valStr.trim() === '') {
      updateCriterion({ [field]: null });
    } else {
      const parsed = parseFloat(valStr);
      updateCriterion({ [field]: isNaN(parsed) ? null : parsed });
    }
  };

  // Range validation check
  const isRangeInverted =
    criterion.type === 'range' &&
    criterion.minValue !== null &&
    criterion.minValue !== undefined &&
    criterion.maxValue !== null &&
    criterion.maxValue !== undefined &&
    criterion.minValue > criterion.maxValue;

  const displayString = formatCriterionDisplay(criterion);

  // Datalist ID unique to this row or generic
  const datalistId = `units-list-${attributeType.replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <div className="criterion-input-wrap">
      {/* ── Top Bar: Type Selector & Live Spec Badge ── */}
      <div className="criterion-top-bar">
        <select
          className="criterion-type-select"
          value={criterion.type}
          disabled={disabled}
          onChange={e => handleTypeChange(e.target.value as CriterionType)}
          title="Select Criterion Type"
        >
          {CRITERION_TYPES.map(opt => (
            <option key={opt.type} value={opt.type}>
              {opt.label}
            </option>
          ))}
        </select>

        <div
          className={`criterion-spec-badge ${isRangeInverted ? 'is-warning' : displayString ? 'is-active' : 'is-empty'}`}
          title={displayString ? `Computed Criterion: ${displayString}` : 'No criterion specified'}
        >
          <span className="criterion-spec-tag">Spec</span>
          <span className="criterion-spec-value">
            {displayString || <span style={{ opacity: 0.6 }}>Not set</span>}
          </span>
        </div>
      </div>

      {/* ── Dynamic Input Controls Based on Criterion Type ── */}
      <div className="criterion-fields-row">
        {/* 1. RANGE TYPE */}
        {criterion.type === 'range' && (
          <div className="criterion-field-group">
            <div className="criterion-range-inputs">
              <input
                type="number"
                step="any"
                className={`criterion-input-field ${isRangeInverted ? 'has-error' : ''}`}
                style={{ width: '70px', flex: '1 1 65px' }}
                placeholder="Min"
                value={criterion.minValue ?? ''}
                disabled={disabled}
                onChange={e => handleNumberChange('minValue', e.target.value)}
                title="Minimum acceptable limit"
              />
              <span className="criterion-separator">–</span>
              <input
                type="number"
                step="any"
                className={`criterion-input-field ${isRangeInverted ? 'has-error' : ''}`}
                style={{ width: '70px', flex: '1 1 65px' }}
                placeholder="Max"
                value={criterion.maxValue ?? ''}
                disabled={disabled}
                onChange={e => handleNumberChange('maxValue', e.target.value)}
                title="Maximum acceptable limit"
              />
            </div>

            {/* Unit Selector */}
            <div className="criterion-unit-wrap">
              <input
                type="text"
                list={datalistId}
                className="criterion-unit-field"
                placeholder="Unit"
                value={criterion.unit ?? ''}
                disabled={disabled}
                onChange={e => updateCriterion({ unit: e.target.value })}
                title="Criterion Unit (e.g. % w/w, °C)"
              />
            </div>
          </div>
        )}

        {/* 2. UPPER BOUND (≤) */}
        {criterion.type === 'upper_bound' && (
          <div className="criterion-field-group">
            <span className="criterion-op-badge" title="Upper limit: Less than or equal to">
              ≤
            </span>
            <input
              type="number"
              step="any"
              className="criterion-input-field"
              style={{ flex: '1 1 100px' }}
              placeholder="Max limit (e.g. 0.15)"
              value={criterion.maxValue ?? ''}
              disabled={disabled}
              onChange={e => handleNumberChange('maxValue', e.target.value)}
              title="Maximum allowable limit (≤)"
            />
            <div className="criterion-unit-wrap">
              <input
                type="text"
                list={datalistId}
                className="criterion-unit-field"
                placeholder="Unit"
                value={criterion.unit ?? ''}
                disabled={disabled}
                onChange={e => updateCriterion({ unit: e.target.value })}
                title="Criterion Unit"
              />
            </div>
          </div>
        )}

        {/* 3. LOWER BOUND (≥) */}
        {criterion.type === 'lower_bound' && (
          <div className="criterion-field-group">
            <span className="criterion-op-badge" title="Lower limit: Greater than or equal to">
              ≥
            </span>
            <input
              type="number"
              step="any"
              className="criterion-input-field"
              style={{ flex: '1 1 100px' }}
              placeholder="Min limit (e.g. 98.0)"
              value={criterion.minValue ?? ''}
              disabled={disabled}
              onChange={e => handleNumberChange('minValue', e.target.value)}
              title="Minimum acceptable limit (≥)"
            />
            <div className="criterion-unit-wrap">
              <input
                type="text"
                list={datalistId}
                className="criterion-unit-field"
                placeholder="Unit"
                value={criterion.unit ?? ''}
                disabled={disabled}
                onChange={e => updateCriterion({ unit: e.target.value })}
                title="Criterion Unit"
              />
            </div>
          </div>
        )}

        {/* 4. EXACT (=) */}
        {criterion.type === 'exact' && (
          <div className="criterion-field-group">
            <span className="criterion-op-badge" title="Exact target: Equal to">
              =
            </span>
            <input
              type="number"
              step="any"
              className="criterion-input-field"
              style={{ flex: '1 1 100px' }}
              placeholder="Target value (e.g. 100.0)"
              value={criterion.targetValue ?? ''}
              disabled={disabled}
              onChange={e => handleNumberChange('targetValue', e.target.value)}
              title="Target specification value"
            />
            <div className="criterion-unit-wrap">
              <input
                type="text"
                list={datalistId}
                className="criterion-unit-field"
                placeholder="Unit"
                value={criterion.unit ?? ''}
                disabled={disabled}
                onChange={e => updateCriterion({ unit: e.target.value })}
                title="Criterion Unit"
              />
            </div>
          </div>
        )}

        {/* 5. QUALITATIVE */}
        {criterion.type === 'qualitative' && (
          <div style={{ width: '100%' }}>
            <input
              type="text"
              className="criterion-input-field"
              style={{ width: '100%' }}
              placeholder="e.g. Conforms to Reference Spectrum / White powder..."
              value={criterion.textDescription ?? ''}
              disabled={disabled}
              onChange={e => updateCriterion({ textDescription: e.target.value })}
              title="Qualitative specification description"
            />
          </div>
        )}
      </div>

      {/* ── Context-Aware Quick Presets ── */}
      {criterion.type !== 'qualitative' && suggestedUnits.length > 0 && (
        <div className="criterion-quick-chips">
          <span className="criterion-chips-label">Quick Units:</span>
          {suggestedUnits.slice(0, 4).map(u => (
            <button
              key={u}
              type="button"
              className={`criterion-chip ${criterion.unit === u ? 'is-selected' : ''}`}
              onClick={() => updateCriterion({ unit: u })}
              disabled={disabled}
              title={`Set unit to ${u}`}
            >
              {u}
            </button>
          ))}
        </div>
      )}


      {/* ── Inverted Range Validation Warning ── */}
      {isRangeInverted && (
        <div className="criterion-warning">
          <span>⚠️ Min ({criterion.minValue}) cannot be greater than Max ({criterion.maxValue})</span>
        </div>
      )}

      {/* Shared Units Datalist */}
      <datalist id={datalistId}>
        {COMMON_UNITS.map(u => (
          <option key={u} value={u} />
        ))}
      </datalist>
    </div>
  );
};

export default CriterionInput;
