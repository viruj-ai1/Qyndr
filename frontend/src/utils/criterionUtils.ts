// src/utils/criterionUtils.ts
// Utilities for context-aware QTPP Acceptance Criterion data model

export type CriterionType = 'range' | 'upper_bound' | 'lower_bound' | 'exact' | 'qualitative';

export interface AcceptanceCriterion {
  type: CriterionType;
  minValue?: number | null;
  maxValue?: number | null;
  targetValue?: number | null;
  unit?: string;
  textDescription?: string;
  // Optional: serialized string for backward compatibility with existing backend/APIs
  displayString?: string;
}

export interface CriterionTypeMeta {
  type: CriterionType;
  label: string;
  symbol: string;
  badge: string;
  description: string;
  legacyOperator: string;
}

export const CRITERION_TYPES: CriterionTypeMeta[] = [
  {
    type: 'lower_bound',
    label: 'Lower Bound (≥)',
    symbol: '≥',
    badge: '≥ Min',
    description: 'Requires value to be at or above a minimum threshold (e.g. Assay / Purity)',
    legacyOperator: '≥'
  },
  {
    type: 'upper_bound',
    label: 'Upper Bound (≤)',
    symbol: '≤',
    badge: '≤ Max',
    description: 'Requires value to be at or below a maximum threshold (e.g. Impurities / Residuals)',
    legacyOperator: '≤'
  },
  {
    type: 'range',
    label: 'Range (Min – Max)',
    symbol: '⇥',
    badge: 'Min – Max',
    description: 'Requires value to lie strictly within an acceptable interval (e.g. pH, Melting Point)',
    legacyOperator: 'Range'
  },
  {
    type: 'exact',
    label: 'Exact (=)',
    symbol: '=',
    badge: '= Target',
    description: 'Requires specific discrete target value (e.g. Target potency or ratio)',
    legacyOperator: '='
  },
  {
    type: 'qualitative',
    label: 'Qualitative / Conforms',
    symbol: '✍',
    badge: 'Conforms',
    description: 'Descriptive or compendial standard (e.g. Identity by IR, Appearance, Color)',
    legacyOperator: 'Conforms'
  }
];

export const COMMON_UNITS = [
  '% w/w',
  '% area',
  '%',
  'ppm',
  'mg/g',
  'mg/mL',
  'g/L',
  '°C',
  '°',
  'pH',
  'CFU/g',
  'mbar'
] as const;

/**
 * Extracts a recognizable pharmaceutical unit from a legacy criterion string.
 */
export function extractUnit(str: string): string {
  if (!str) return '';
  if (str.includes('°C')) return '°C';
  if (str.includes('°')) return '°';
  if (str.includes('% w/w')) return '% w/w';
  if (str.includes('% area')) return '% area';
  if (str.includes('ppm')) return 'ppm';
  if (str.includes('mg/g')) return 'mg/g';
  if (str.includes('mg/mL')) return 'mg/mL';
  if (str.includes('g/L')) return 'g/L';
  if (str.includes('CFU/g')) return 'CFU/g';
  if (str.includes('CFU/mL')) return 'CFU/mL';
  if (str.includes('pH')) return 'pH';
  if (str.includes('mbar')) return 'mbar';
  if (str.includes('%')) return '%';
  return '';
}

/**
 * Maps a structured AcceptanceCriterion to the legacy operator string
 * ('≥', '≤', 'Range', '=', 'Conforms').
 */
export function getCriterionOperator(type: CriterionType): string {
  switch (type) {
    case 'lower_bound': return '≥';
    case 'upper_bound': return '≤';
    case 'range':       return 'Range';
    case 'exact':       return '=';
    case 'qualitative': return 'Conforms';
    default:            return '=';
  }
}

/**
 * Serializes an AcceptanceCriterion object into a clean, human-readable display string
 * and backward-compatible criterion string.
 */
export function formatCriterionDisplay(criterion?: AcceptanceCriterion | null): string {
  if (!criterion) return '';
  const unit = criterion.unit ? criterion.unit.trim() : '';
  const unitSuffix = unit ? ` ${unit}` : '';

  switch (criterion.type) {
    case 'range': {
      const hasMin = criterion.minValue !== null && criterion.minValue !== undefined && !isNaN(criterion.minValue);
      const hasMax = criterion.maxValue !== null && criterion.maxValue !== undefined && !isNaN(criterion.maxValue);
      if (hasMin && hasMax) return `${criterion.minValue} - ${criterion.maxValue}${unitSuffix}`;
      if (hasMin) return `≥ ${criterion.minValue}${unitSuffix}`;
      if (hasMax) return `≤ ${criterion.maxValue}${unitSuffix}`;
      return unit ? `Range (${unit})` : '';
    }
    case 'upper_bound': {
      const hasMax = criterion.maxValue !== null && criterion.maxValue !== undefined && !isNaN(criterion.maxValue);
      return hasMax ? `≤ ${criterion.maxValue}${unitSuffix}` : (unit ? `≤ [max] ${unit}` : '');
    }
    case 'lower_bound': {
      const hasMin = criterion.minValue !== null && criterion.minValue !== undefined && !isNaN(criterion.minValue);
      return hasMin ? `≥ ${criterion.minValue}${unitSuffix}` : (unit ? `≥ [min] ${unit}` : '');
    }
    case 'exact': {
      const hasTarget = criterion.targetValue !== null && criterion.targetValue !== undefined && !isNaN(criterion.targetValue);
      return hasTarget ? `= ${criterion.targetValue}${unitSuffix}` : (unit ? `= [target] ${unit}` : '');
    }
    case 'qualitative':
      return (criterion.textDescription || '').trim();
    default:
      return '';
  }
}

/**
 * Converts a legacy criterion string + operator into a structured AcceptanceCriterion.
 */
export function parseLegacyCriterion(
  criterion?: string | null,
  operator?: string,
  attributeType?: string
): AcceptanceCriterion {
  const rawCrit = (criterion || '').trim();
  const op = (operator || '').trim();

  // 1. Qualitative check
  if (
    op === 'Conforms' ||
    rawCrit.toLowerCase().startsWith('conforms') ||
    ((attributeType === 'Identity' || attributeType === 'Appearance & Color') && !/\d/.test(rawCrit)) ||
    (rawCrit && !/\d/.test(rawCrit) && !rawCrit.startsWith('<') && !rawCrit.startsWith('>'))
  ) {
    return {
      type: 'qualitative',
      textDescription: rawCrit,
      displayString: rawCrit
    };
  }

  // 2. Range check
  if (op === 'Range' || rawCrit.includes(' - ') || rawCrit.includes(' to ') || /^\d+.*(?:-|to).*\d+/.test(rawCrit)) {
    const rangeMatch = rawCrit.match(/([+-]?\d+(?:\.\d+)?)\s*(?:°C|°|%)?\s*(?:-|to)\s*([+-]?\d+(?:\.\d+)?)(.*)/i);
    let min: number | null = null;
    let max: number | null = null;
    let unit = extractUnit(rawCrit);

    if (rangeMatch) {
      min = parseFloat(rangeMatch[1]);
      max = parseFloat(rangeMatch[2]);
      if (!unit && rangeMatch[3]) unit = rangeMatch[3].trim();
    } else {
      const nums = rawCrit.match(/[+-]?\d+(?:\.\d+)?/g);
      if (nums && nums.length >= 2) {
        min = parseFloat(nums[0]);
        max = parseFloat(nums[1]);
      }
    }

    const res: AcceptanceCriterion = {
      type: 'range',
      minValue: min,
      maxValue: max,
      unit: unit || '% w/w'
    };
    res.displayString = formatCriterionDisplay(res) || rawCrit;
    return res;
  }

  // 3. Upper bound (<= or ≤)
  if (op === '≤' || op === '<=' || rawCrit.startsWith('<=') || rawCrit.startsWith('≤')) {
    const clean = rawCrit.replace(/^(<=|≤)\s*/, '');
    const numMatch = clean.match(/([+-]?\d+(?:\.\d+)?)/);
    const max = numMatch ? parseFloat(numMatch[1]) : null;
    const unit = extractUnit(clean) || '% w/w';
    const res: AcceptanceCriterion = {
      type: 'upper_bound',
      maxValue: max,
      unit
    };
    res.displayString = formatCriterionDisplay(res) || rawCrit;
    return res;
  }

  // 4. Lower bound (>= or ≥)
  if (op === '≥' || op === '>=' || rawCrit.startsWith('>=') || rawCrit.startsWith('≥')) {
    const clean = rawCrit.replace(/^(>=|≥)\s*/, '');
    const numMatch = clean.match(/([+-]?\d+(?:\.\d+)?)/);
    const min = numMatch ? parseFloat(numMatch[1]) : null;
    const unit = extractUnit(clean) || '% w/w';
    const res: AcceptanceCriterion = {
      type: 'lower_bound',
      minValue: min,
      unit
    };
    res.displayString = formatCriterionDisplay(res) || rawCrit;
    return res;
  }

  // 5. Exact (=)
  if (op === '=' || rawCrit.startsWith('=')) {
    const clean = rawCrit.replace(/^=\s*/, '');
    const numMatch = clean.match(/([+-]?\d+(?:\.\d+)?)/);
    const target = numMatch ? parseFloat(numMatch[1]) : null;
    const unit = extractUnit(clean) || '% w/w';
    const res: AcceptanceCriterion = {
      type: 'exact',
      targetValue: target,
      unit
    };
    res.displayString = formatCriterionDisplay(res) || rawCrit;
    return res;
  }

  // 6. Number found without explicit operator
  const fallbackNum = rawCrit.match(/([+-]?\d+(?:\.\d+)?)/);
  if (fallbackNum) {
    const val = parseFloat(fallbackNum[1]);
    const unit = extractUnit(rawCrit) || '% w/w';
    const defType: CriterionType = attributeType === 'Assay-Purity' ? 'lower_bound' : 'upper_bound';
    const res: AcceptanceCriterion = {
      type: defType,
      minValue: defType === 'lower_bound' ? val : null,
      maxValue: defType === 'upper_bound' ? val : null,
      unit
    };
    res.displayString = formatCriterionDisplay(res) || rawCrit;
    return res;
  }

  // 7. Empty or fallback based on attributeType
  return getDefaultCriterionForAttribute(attributeType);
}

/**
 * Returns tailored unit suggestions based on attribute type and name.
 */
export function getSuggestedUnits(attributeType?: string, attributeName?: string): string[] {
  const t = (attributeType || '').toLowerCase();
  const name = (attributeName || '').toLowerCase();

  if (t.includes('impurity')) {
    return ['% w/w', 'ppm', '% area', '%'];
  }
  if (t.includes('assay') || t.includes('purity')) {
    return ['% w/w', '% area', '%'];
  }
  if (t.includes('residual') || t.includes('solvent')) {
    return ['ppm', '% w/w', 'mg/g'];
  }
  if (t.includes('microbial')) {
    return ['CFU/g', 'CFU/mL'];
  }
  if (t.includes('physical') || name.includes('melting') || name.includes('temp') || name.includes('sor')) {
    if (name.includes('rotation') || name.includes('sor')) return ['°', '°C'];
    if (name.includes('water') || name.includes('moisture') || name.includes('karl')) return ['% w/w', '%'];
    return ['°C', '°', '% w/w', 'pH', 'g/mL'];
  }
  return ['% w/w', '% area', '%', 'ppm', '°C', 'mg/g'];
}

/**
 * Returns tailored qualitative preset phrases for compendial attributes.
 */
export function getSuggestedQualitative(attributeType?: string, attributeName?: string): string[] {
  const t = (attributeType || '').toLowerCase();
  const name = (attributeName || '').toLowerCase();

  if (t.includes('identity') || name.includes('ir') || name.includes('nmr') || name.includes('identif')) {
    return [
      'Conforms to Reference Spectrum',
      'Conforms to USP Reference Standard',
      'Matches chemical reference standard',
      'Conforms to HPLC retention time'
    ];
  }
  if (t.includes('appearance') || name.includes('color') || name.includes('appearance')) {
    return [
      'White to off-white crystalline powder',
      'Clear, colorless solution',
      'Pale yellow crystalline powder',
      'White crystalline powder, free from visible particulates',
      'Conforms to visual color standard'
    ];
  }
  if (t.includes('microbial')) {
    return [
      'Absent in 1 g',
      'Absent in 10 g',
      'Conforms to USP <61>/<62>',
      'Meets Ph. Eur. 5.1.4'
    ];
  }
  return [
    'Conforms to Reference Spectrum',
    'Conforms to USP monograph specification',
    'Conforms to Internal Spec',
    'Passes test'
  ];
}

/**
 * Returns a smart default AcceptanceCriterion when creating a new attribute row.
 */
export function getDefaultCriterionForAttribute(attributeType?: string, attributeName?: string): AcceptanceCriterion {
  const t = (attributeType || '').toLowerCase();

  if (t.includes('identity') || t.includes('appearance')) {
    const suggestions = getSuggestedQualitative(attributeType, attributeName);
    const text = suggestions[0] || 'Conforms to Reference Spectrum';
    return {
      type: 'qualitative',
      textDescription: text,
      displayString: text
    };
  }
  if (t.includes('impurity') || t.includes('residual') || t.includes('solvent')) {
    const unit = t.includes('residual') || t.includes('solvent') ? 'ppm' : '% w/w';
    return {
      type: 'upper_bound',
      maxValue: null,
      unit,
      displayString: ''
    };
  }
  if (t.includes('physical')) {
    return {
      type: 'range',
      minValue: null,
      maxValue: null,
      unit: '°C',
      displayString: ''
    };
  }
  if (t.includes('assay') || t.includes('purity')) {
    return {
      type: 'lower_bound',
      minValue: null,
      unit: '% w/w',
      displayString: ''
    };
  }
  if (t.includes('microbial')) {
    return {
      type: 'upper_bound',
      maxValue: null,
      unit: 'CFU/g',
      displayString: ''
    };
  }

  return {
    type: 'upper_bound',
    maxValue: null,
    unit: '% w/w',
    displayString: ''
  };
}

/**
 * Handles switching CriterionType while seamlessly preserving existing numbers, units, and text.
 */
export function convertCriterionType(current: AcceptanceCriterion, nextType: CriterionType): AcceptanceCriterion {
  if (current.type === nextType) return current;

  // Extract existing numerical value (if any)
  const existingNum = current.targetValue ?? current.maxValue ?? current.minValue ?? null;
  const unit = current.unit || '% w/w';

  let nextCrit: AcceptanceCriterion;

  switch (nextType) {
    case 'range':
      nextCrit = {
        type: 'range',
        minValue: current.minValue ?? existingNum,
        maxValue: current.maxValue ?? (current.minValue ? null : existingNum),
        unit,
        textDescription: current.textDescription
      };
      break;
    case 'upper_bound':
      nextCrit = {
        type: 'upper_bound',
        maxValue: current.maxValue ?? existingNum,
        unit,
        textDescription: current.textDescription
      };
      break;
    case 'lower_bound':
      nextCrit = {
        type: 'lower_bound',
        minValue: current.minValue ?? existingNum,
        unit,
        textDescription: current.textDescription
      };
      break;
    case 'exact':
      nextCrit = {
        type: 'exact',
        targetValue: current.targetValue ?? existingNum,
        unit,
        textDescription: current.textDescription
      };
      break;
    case 'qualitative':
      nextCrit = {
        type: 'qualitative',
        textDescription: current.textDescription || current.displayString || (existingNum !== null ? `${existingNum} ${unit}`.trim() : ''),
        unit
      };
      break;
    default:
      nextCrit = { ...current, type: nextType };
  }

  nextCrit.displayString = formatCriterionDisplay(nextCrit);
  return nextCrit;
}
