// src/utils/targetParser.ts
// Intelligent parser to extract structured API Targets and Response Variables
// directly from Project Description, Primary Objective, and Compound name.

import { ApiTarget, Response } from '../store/useStore'

/**
 * Standard QbD reference presets for known pharmaceutical compounds
 */
export const COMPOUND_DEFAULTS: Record<string, {
  assayName: string
  assayVal: number
  assaySpec: string
  impName: string
  impVal: number
  impSpec: string
  yieldName: string
  yieldVal: number
  yieldSpec: string
}> = {
  propofol: {
    assayName: 'API Assay (2,6-diisopropylphenol)',
    assayVal: 97.0,
    assaySpec: '> 97.0%',
    impName: 'Critical Regioisomer Impurity J',
    impVal: 0.15,
    impSpec: '< 0.15%',
    yieldName: 'Chemical Reaction Yield',
    yieldVal: 85.0,
    yieldSpec: '> 85.0%'
  },
  rocuronium: {
    assayName: 'API Assay (Rocuronium Bromide)',
    assayVal: 98.5,
    assaySpec: '> 98.5%',
    impName: 'Related Impurity C (Deacetyl)',
    impVal: 0.20,
    impSpec: '< 0.20%',
    yieldName: 'Isolated Crystalline Yield',
    yieldVal: 80.0,
    yieldSpec: '> 80.0%'
  },
  generic: {
    assayName: 'Final API Chemical Assay',
    assayVal: 98.0,
    assaySpec: '> 98.0%',
    impName: 'Total Organic Impurities',
    impVal: 0.50,
    impSpec: '< 0.50%',
    yieldName: 'Overall Process Yield',
    yieldVal: 85.0,
    yieldSpec: '> 85.0%'
  }
}

/**
 * Parses free-form Project Description, Primary Objective, and Compound
 * to extract structured API Targets (Assay / Purity, Impurities, and Yield).
 */
export function extractTargetsFromDescription(
  description: string = '',
  objective: string = '',
  compound: string = ''
): ApiTarget[] {
  const fullText = `${description} ${objective}`.trim()
  const compLower = (compound || '').toLowerCase().trim()
  const textLower = fullText.toLowerCase()

  const isPropofol = compLower.includes('propofol') || compLower.includes('diisopropylphenol') || textLower.includes('propofol')
  const isRocuronium = compLower.includes('rocuronium') || textLower.includes('rocuronium')

  const baseConfig = isPropofol
    ? COMPOUND_DEFAULTS.propofol
    : isRocuronium
    ? COMPOUND_DEFAULTS.rocuronium
    : COMPOUND_DEFAULTS.generic

  const extracted: ApiTarget[] = []

  // 1. Check for Assay / Purity
  // Match patterns like: purity ≥ 99.0%, assay > 97%, purity >= 98.5%, assay of 98.0%, purity NLT 99%
  const assayRegex = /(?:api\s+assay|assay|purity|pure|titre|content)\s*(?:[≥>=]|>=|>|:|of|is|at least|not less than|nlt)?\s*([><≥≤=]?\s*\d+(?:\.\d+)?)\s*(%|ppm)?/i
  const assayMatch = fullText.match(assayRegex)

  let assayVal = baseConfig.assayVal
  let assaySpec = baseConfig.assaySpec
  let assayName = isPropofol
    ? baseConfig.assayName
    : isRocuronium
    ? baseConfig.assayName
    : (compound ? `API Assay (${compound})` : baseConfig.assayName)

  if (assayMatch) {
    const rawNum = assayMatch[1].replace(/[><≥≤=]/g, '').trim()
    const num = parseFloat(rawNum)
    if (!isNaN(num)) {
      assayVal = num
      const op = assayMatch[1].includes('>') || assayMatch[1].includes('≥') ? '>' : '>='
      assaySpec = `${op} ${num}%`
      if (assayMatch[0].toLowerCase().includes('purity') && !isPropofol && !isRocuronium) {
        assayName = compound ? `${compound} Purity` : 'Final API Purity'
      }
    }
  }

  extracted.push({
    id: 'target-1',
    name: assayName,
    goal: 'Maximize',
    specification: assaySpec,
    unit: '%',
    target_value: assayVal
  })

  // 2. Check for Impurities
  // Match specific impurity names like: Impurity J, Impurity C, Deacetyl Impurity, Regioisomer Impurity J, total impurities, etc.
  const specificImpurityRegex = /(critical\s+regioisomer\s+impurity\s+[a-z0-9]+|regioisomer\s+impurity\s+[a-z0-9]+|deacetyl\s+impurity(?:\s+[a-z0-9]+)?|related\s+impurity\s+[a-z0-9]+|impurity\s+[a-z0-9]+|total\s+(?:organic\s+)?impurities|dimer\s+impurity|unknown\s+impurities)\s*(?:[≤<=]|<=|<|:|of|is|under|below|not more than|nmt|\()?([><≥≤=]?\s*\d+(?:\.\d+)?)\s*(%|ppm)?\)?/i
  const impurityMatch = fullText.match(specificImpurityRegex)

  // Generic impurity match if specific name not captured
  const genericImpurityRegex = /(?:control|suppress|minimize|limit)\s+([a-zA-Z0-9\s-]+?(?:impurity|regioisomer|byproduct|degradant)[a-zA-Z0-9\s-]*?)\s*(?:[≤<=]|<=|<|:|to|\()?([><≥≤=]?\s*\d+(?:\.\d+)?)\s*(%|ppm)?\)?/i
  const genericImpMatch = fullText.match(genericImpurityRegex)

  let impVal = baseConfig.impVal
  let impSpec = baseConfig.impSpec
  let impName = baseConfig.impName

  if (impurityMatch) {
    const matchedName = impurityMatch[1].trim()
    const rawNum = impurityMatch[2].replace(/[><≥≤=]/g, '').trim()
    const num = parseFloat(rawNum)
    if (!isNaN(num)) {
      impVal = num
      impSpec = `< ${num}%`
      impName = matchedName.replace(/\b\w/g, l => l.toUpperCase())
    }
  } else if (genericImpMatch) {
    const matchedName = genericImpMatch[1].trim()
    const rawNum = genericImpMatch[2].replace(/[><≥≤=]/g, '').trim()
    const num = parseFloat(rawNum)
    if (!isNaN(num)) {
      impVal = num
      impSpec = `< ${num}%`
      impName = matchedName.replace(/\b\w/g, l => l.toUpperCase())
    }
  }

  extracted.push({
    id: 'target-2',
    name: impName,
    goal: 'Minimize',
    specification: impSpec,
    unit: '%',
    target_value: impVal
  })

  // 3. Check for Yield / Recovery / Conversion
  const yieldRegex = /(chemical\s+reaction\s+yield|isolated\s+crystalline\s+yield|chemical\s+yield|reaction\s+yield|isolated\s+yield|overall\s+process\s+yield|process\s+yield|recovery|conversion|yield)\s*(?:[≥>=]|>=|>|:|of|is|at least|not less than|nlt|\()?([><≥≤=]?\s*\d+(?:\.\d+)?)\s*(%|g|kg)?\)?/i
  const yieldMatch = fullText.match(yieldRegex)

  let yieldVal = baseConfig.yieldVal
  let yieldSpec = baseConfig.yieldSpec
  let yieldName = baseConfig.yieldName

  if (yieldMatch) {
    const rawNum = yieldMatch[2].replace(/[><≥≤=]/g, '').trim()
    const num = parseFloat(rawNum)
    if (!isNaN(num)) {
      yieldVal = num
      yieldSpec = `> ${num}%`
      const matchedYieldName = yieldMatch[1].trim()
      yieldName = matchedYieldName.replace(/\b\w/g, l => l.toUpperCase())
      if (yieldName.toLowerCase() === 'yield') {
        yieldName = isPropofol ? 'Chemical Reaction Yield' : 'Chemical Yield'
      }
    }
  }

  extracted.push({
    id: 'target-3',
    name: yieldName,
    goal: 'Maximize',
    specification: yieldSpec,
    unit: '%',
    target_value: yieldVal
  })

  return extracted
}

/**
 * Maps an ApiTarget to a DOE Response object for Step 07
 */
export function mapTargetToResponse(t: ApiTarget): Response {
  let goal = 'maximize'
  const g = (t.goal || '').toLowerCase()
  if (g.includes('min')) goal = 'minimize'
  else if (g.includes('match') || g.includes('target') || g.includes('range')) goal = 'target'
  else goal = 'maximize'

  let numericVal: number | undefined = undefined
  if (t.target_value != null && !isNaN(Number(t.target_value))) {
    numericVal = Number(t.target_value)
  } else if (t.specification) {
    const match = String(t.specification).match(/[-+]?\d*\.?\d+/)
    if (match) numericVal = parseFloat(match[0])
  }

  return {
    name: t.name,
    unit: t.unit || '%',
    goal,
    target: numericVal,
    inherited_from_target: true
  }
}

/**
 * Convenience function to extract Response variables directly from
 * Project Description, Objective, and Compound.
 */
export function extractResponsesFromDescription(
  description: string = '',
  objective: string = '',
  compound: string = ''
): Response[] {
  const targets = extractTargetsFromDescription(description, objective, compound)
  return targets.map(mapTargetToResponse)
}
