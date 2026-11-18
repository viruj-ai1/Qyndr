// frontend/src/data/projectTemplates.ts
// Single source of truth for Project Input Templates in Qyndr

export type FieldKey = 'projectName' | 'compound' | 'objective' | 'description'

export interface FieldTemplate {
  label: string
  guidance: string
  template: string
  tips: string[]
}

export const DESCRIPTION_SECTIONS = [
  'Process overview:',
  'Goal / acceptance criteria:',
  'Critical Process Parameters (CPPs) to study:',
  'Critical Quality Attributes (CQAs) / Responses:',
  'Known constraints / fixed parameters:',
  'Previous studies / history:',
  'Analytical methods:',
  'Regulatory / QbD context:'
] as const

export const PROJECT_TEMPLATES: Record<FieldKey, FieldTemplate> = {
  projectName: {
    label: 'Project Name',
    guidance: 'Format: <Compound> <Stage/Step> <Purpose>. Keep it short, descriptive, and unique.',
    template: '[Compound Name] [Stage/Step] [Process Optimization / Robustness Study / Scale-up]',
    tips: [
      'Include both the compound name and stage/step identifier.',
      'Specify the operational purpose (Optimization, Robustness, Scale-up, or Screening).',
      'Avoid operator initials or internal dates to maintain clean audit records.',
      'Keep it concise (under 80 characters).'
    ]
  },
  compound: {
    label: 'Compound / API',
    guidance: 'Enter the API or intermediate name exactly as recorded in your batch records or regulatory filing.',
    template: '[API / Intermediate name] ([salt form if any])',
    tips: [
      'Use the official INN, USAN, or compendial monograph name.',
      'Include the exact counter-ion or salt form where relevant (e.g., Bromide, Hydrochloride).',
      'Do not include the stage number or process step name here (put those in Project Name).'
    ]
  },
  objective: {
    label: 'Primary Objective',
    guidance: 'State measurable targets with numerical values, direction (maximize/minimize), units, and constraint limits.',
    template: '[Maximize/Minimize] [response 1] (target [≥/≤ value] [unit]) and [response 2] (target [≥/≤ value]) while keeping [critical impurity/quality attribute] [≤ limit] and [residual/other] [≤ limit].',
    tips: [
      'Every target response needs an explicit number and engineering unit.',
      'List primary goals first (e.g. Yield, Assay) and constraints after "while keeping".',
      'Avoid vague or unquantified terms like "high purity" or "good conversion".'
    ]
  },
  description: {
    label: 'Project Description',
    guidance: 'Fill each section below. Short, factual sentences are best. Include numbers with units to guide automatic CQA/CPP seeding.',
    template: `Process overview:
[Reaction/unit operation, starting materials, reagents, solvent, key transformation, scale, equipment]

Goal / acceptance criteria:
[Target yield, purity, impurity limits, residual limits, any specification]

Critical Process Parameters (CPPs) to study:
[Parameter – unit – min to max range – current setpoint], one per line

Critical Quality Attributes (CQAs) / Responses:
[Attribute – analytical method – target/limit], one per line

Known constraints / fixed parameters:
[Parameters that cannot change, with reason, e.g. temperature cap, reagent ratio cap, fixed agitation speed]

Previous studies / history:
[Risk assessment, screening results, OFAT or DoE done so far, known failure modes, degradation or stability observations]

Analytical methods:
[HPLC/GC/KF/etc., what each measures, detection limits if known]

Regulatory / QbD context:
[QTPP link, ICH Q8/Q9/Q11 considerations, filing stage, if applicable]`,
    tips: [
      'Use the exact section headers shown; the platform parses them for intelligent seeding.',
      'Provide experimental ranges (min to max), not single operating points, for parameters to be studied.',
      'State the chemical or engineering justification for any fixed constraints.',
      'Document known degradation or failure modes from previous lab observations.'
    ]
  }
}

/**
 * Ensures that no section header (standard or legacy) is duplicated in the description text.
 * Merges contents cleanly if a header appears multiple times and eliminates redundant empty headers.
 */
export function deduplicateDescriptionSections(text: string): string {
  if (!text) return text

  const knownHeaders = [
    ...DESCRIPTION_SECTIONS,
    '--- Process Understanding ---',
    'What is the product / API?:',
    'Describe the process step:',
    'Current performance / baseline:',
    'Target performance:'
  ]

  let result = text

  // 1. First, catch direct consecutive repeated headers (e.g. "Header:\n\nHeader:")
  for (const header of knownHeaders) {
    const escaped = header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const consecutiveRegex = new RegExp(`(${escaped})\\s*\\n+\\s*${escaped}`, 'gi')
    while (consecutiveRegex.test(result)) {
      result = result.replace(consecutiveRegex, '$1')
    }
  }

  // 2. Identify all header positions in text
  const headerPositions: { header: string; index: number; length: number }[] = []
  const textLower = result.toLowerCase()

  for (const header of knownHeaders) {
    const headerLower = header.toLowerCase()
    let pos = 0
    while ((pos = textLower.indexOf(headerLower, pos)) !== -1) {
      headerPositions.push({ header, index: pos, length: header.length })
      pos += headerLower.length
    }
  }

  headerPositions.sort((a, b) => a.index - b.index)
  const headerCount: Record<string, number> = {}
  headerPositions.forEach(p => {
    const key = p.header.toLowerCase()
    headerCount[key] = (headerCount[key] || 0) + 1
  })

  const hasDuplicates = Object.values(headerCount).some(c => c > 1)
  if (!hasDuplicates) {
    return result
  }

  // 3. Slice into sections by header
  const sections: { header: string; content: string }[] = []
  for (let i = 0; i < headerPositions.length; i++) {
    const curr = headerPositions[i]
    const nextIndex = i + 1 < headerPositions.length ? headerPositions[i + 1].index : result.length
    const content = result.slice(curr.index + curr.length, nextIndex).trim()
    sections.push({ header: curr.header, content })
  }

  const preamble = headerPositions.length > 0 ? result.slice(0, headerPositions[0].index).trim() : ''

  // 4. Merge duplicate sections under the first occurrence of each header
  const mergedSections = new Map<string, { displayHeader: string; contents: string[] }>()
  for (const sec of sections) {
    const key = sec.header.toLowerCase()
    if (!mergedSections.has(key)) {
      mergedSections.set(key, { displayHeader: sec.header, contents: [] })
    }
    if (sec.content) {
      mergedSections.get(key)!.contents.push(sec.content)
    }
  }

  // 5. Recombine cleanly
  const parts: string[] = []
  if (preamble) parts.push(preamble)

  for (const [, val] of mergedSections.entries()) {
    const joinedContent = val.contents.join('\n\n')
    if (joinedContent) {
      parts.push(`${val.displayHeader}\n${joinedContent}`)
    } else {
      parts.push(`${val.displayHeader}`)
    }
  }

  return parts.join('\n\n')
}


