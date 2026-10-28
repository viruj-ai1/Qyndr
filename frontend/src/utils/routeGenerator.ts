import { StageItem, RiskParameter, CQAMapping, Project, QTPPItem } from '../store/useStore'
import {
  parseLegacyCriterion,
  formatCriterionDisplay,
  getCriterionOperator
} from './criterionUtils'

/**
 * Dynamically derives synthetic route stages and unit operations based on project metadata.
 * Detects whether the project is scoped to a single stage or full multi-step route,
 * and tailors chemistry and unit operations to known APIs or user-provided descriptions.
/**
 * Attempts to parse explicit stages or unit operations directly from the user's project description text.
 * E.g.: "Stage 1: ...", "Step 1: ...", "1. Alkylation: ...", "Unit Op 1: ..."
 */
export function parseStagesFromDescription(description: string, compound: string): StageItem[] | null {
  if (!description || description.trim().length === 0) return null

  const lines = description.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const stageRegex = /^(?:stage|step|unit\s*op(?:eration)?)\s*[-_:]?\s*(\d+|[ivx]+|[a-z])\s*[-:.)]\s*(.+)/i
  const numberedRegex = /^(\d+)[.)]\s*(.+)/

  const parsedItems: { num: number; text: string }[] = []

  for (const line of lines) {
    const matchStage = line.match(stageRegex)
    if (matchStage) {
      const rawNum = matchStage[1]
      let num = parseInt(rawNum, 10)
      if (isNaN(num)) {
        const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6 }
        num = romanMap[rawNum.toLowerCase()] || parsedItems.length + 1
      }
      parsedItems.push({ num, text: matchStage[2].trim() })
      continue
    }

    const matchNumbered = line.match(numberedRegex)
    if (matchNumbered) {
      const content = matchNumbered[2].trim()
      const cLower = content.toLowerCase()
      const isChemistryOp =
        cLower.includes('reaction') || cLower.includes('coupling') || cLower.includes('alkylat') ||
        cLower.includes('workup') || cLower.includes('quench') || cLower.includes('extract') ||
        cLower.includes('wash') || cLower.includes('crystalliz') || cLower.includes('filtrat') ||
        cLower.includes('drying') || cLower.includes('distill') || cLower.includes('purif') ||
        cLower.includes('synthesis') || cLower.includes('isolation') || cLower.includes('dissolution')
      if (isChemistryOp || (lines.length >= 2 && lines.length <= 8)) {
        parsedItems.push({ num: parseInt(matchNumbered[1], 10), text: content })
      }
    }
  }

  if (parsedItems.length >= 2 || (parsedItems.length === 1 && parsedItems[0].text.length > 5)) {
    return parsedItems.map((item, idx) => {
      const fullText = item.text
      const parts = fullText.split(/[-:–—]\s*/, 2)
      let name = fullText
      let desc = ''
      if (parts.length > 1 && parts[0].length < 45 && parts[1].length > 5) {
        name = parts[0].trim()
        desc = parts[1].trim()
      }

      if (!name.toLowerCase().startsWith('stage') && !name.toLowerCase().startsWith('unit op') && !name.toLowerCase().startsWith('step')) {
        name = `Stage ${idx + 1}: ${name}`
      }

      const tLower = fullText.toLowerCase()
      let unitOpType: StageItem['unitOpType'] = 'Reaction'
      if (tLower.includes('workup') || tLower.includes('quench') || tLower.includes('extract') || tLower.includes('wash') || tLower.includes('phase')) {
        unitOpType = 'Workup'
      } else if (tLower.includes('crystalliz') || tLower.includes('precipitat') || tLower.includes('seeding')) {
        unitOpType = 'Crystallization'
      } else if (tLower.includes('filtrat') || tLower.includes('cake') || tLower.includes('sparkler')) {
        unitOpType = 'Filtration'
      } else if (tLower.includes('drying') || tLower.includes('dryer') || tLower.includes('desorption')) {
        unitOpType = 'Drying'
      } else if (tLower.includes('distill') || tLower.includes('fractionat') || tLower.includes('purif') || tLower.includes('chromatograph')) {
        unitOpType = 'Purification'
      } else if (tLower.includes('reaction') || tLower.includes('coupling') || tLower.includes('synthes') || tLower.includes('alkylat') || tLower.includes('hydrogenat') || tLower.includes('condensat') || tLower.includes('deprotect')) {
        unitOpType = 'Reaction'
      } else {
        unitOpType = 'Other'
      }

      let intermediateProduced = `${compound || 'API'} Stage ${idx + 1} Mass`
      if (unitOpType === 'Crystallization' || idx === parsedItems.length - 1) {
        intermediateProduced = `Pure ${compound || 'API'} (Isolated)`
      } else if (unitOpType === 'Reaction') {
        intermediateProduced = `Crude ${compound || 'API'} Stage ${idx + 1} Intermediate`
      } else if (unitOpType === 'Workup') {
        intermediateProduced = `Washed ${compound || 'API'} Solution`
      }

      return {
        id: `stage-${idx + 1}`,
        order: idx + 1,
        name,
        unitOpType,
        description: desc || fullText,
        intermediateProduced
      }
    })
  }

  return null
}

/**
 * Dynamically derives synthetic route stages and unit operations based on all data
 * accumulated until Route Mapping (Step 01 Project details, Step 02 QTPP, Step 03 CQAs).
 */
export function generateContextAwareStages(
  project: {
    name?: string
    compound?: string
    objective?: string
    description?: string
  } | null,
  qtpp?: QTPPItem[],
  cqas?: CQAMapping[]
): StageItem[] {
  const name = (project?.name || '').trim()
  const compound = (project?.compound || '').trim()
  const objective = (project?.objective || '').trim()
  const description = (project?.description || '').trim()

  const cqaNames = (cqas || []).map(c => c.name).join(' ')
  const qtppNames = (qtpp || []).map(q => `${q.attribute} ${q.type}`).join(' ')
  const combined = `${name} ${compound} ${objective} ${description} ${cqaNames} ${qtppNames}`.toLowerCase()

  // 1. Direct Description Parsing: Check if the chemist explicitly listed stages/steps in Step 01
  const parsedFromDesc = parseStagesFromDescription(description, compound)
  if (parsedFromDesc && parsedFromDesc.length > 0) {
    return parsedFromDesc
  }

  // 2. Intermediate CQAs: Check if Step 03 CQAs specifically mapped intermediate stage names
  if (cqas && cqas.length > 0) {
    const rawStageNames = Array.from(new Set(
      cqas
        .filter(c => c.stageName && c.stageName.trim() !== '')
        .map(c => c.stageName!.trim())
    ))
    if (rawStageNames.length >= 2) {
      return rawStageNames.map((stName, idx) => {
        const sLower = stName.toLowerCase()
        let unitOp: StageItem['unitOpType'] = 'Reaction'
        if (sLower.includes('workup') || sLower.includes('quench') || sLower.includes('extract')) unitOp = 'Workup'
        else if (sLower.includes('crystalliz') || sLower.includes('isolation')) unitOp = 'Crystallization'
        else if (sLower.includes('filtrat')) unitOp = 'Filtration'
        else if (sLower.includes('drying')) unitOp = 'Drying'
        else if (sLower.includes('distill') || sLower.includes('purif')) unitOp = 'Purification'

        return {
          id: `stage-${idx + 1}`,
          order: idx + 1,
          name: stName.toLowerCase().startsWith('stage') ? stName : `Stage ${idx + 1}: ${stName}`,
          unitOpType: unitOp,
          description: `Derived from CQA intermediate mapping for ${stName}`,
          intermediateProduced: `${compound || 'API'} Stage ${idx + 1} Intermediate`
        }
      })
    }
  }

  // 3. Check for specific well-known APIs
  // Rocuronium Bromide
  if (combined.includes('rocuronium')) {
    return [
      {
        id: 'stage-1',
        order: 1,
        name: 'Stage 1: Morpholine Condensation & Ring-Opening',
        unitOpType: 'Reaction',
        description: 'Reaction of 2β,3β-epoxy-5α-androstan-17-one with morpholine at 50-60°C.',
        intermediateProduced: '2β-Morpholino-16α,17α-epoxy-5α-androstan-3α-ol'
      },
      {
        id: 'stage-2',
        order: 2,
        name: 'Stage 2: Quenching & Aqueous Extraction',
        unitOpType: 'Workup',
        description: 'Aqueous wash and phase separation to remove excess morpholine.',
        intermediateProduced: 'Crude Stage-I Liquid Extract'
      },
      {
        id: 'stage-3',
        order: 3,
        name: 'Stage 3: Crystallization & Isolation',
        unitOpType: 'Crystallization',
        description: 'Controlled crystallization in Acetonitrile/water and vacuum drying at 45°C.',
        intermediateProduced: 'Pure Stage-I Intermediate'
      }
    ]
  }

  // Propofol (2,6-diisopropylphenol)
  if (combined.includes('propofol') || combined.includes('diisopropylphenol')) {
    return [
      {
        id: 'stage-1',
        order: 1,
        name: 'Unit Op 1: Friedel-Crafts Alkylation Reaction',
        unitOpType: 'Reaction',
        description: 'Catalytic alkylation of phenol with propylene / isopropanol over acidic catalyst at 200-240°C.',
        intermediateProduced: 'Crude 2,6-Diisopropylphenol Reaction Mass'
      },
      {
        id: 'stage-2',
        order: 2,
        name: 'Unit Op 2: Catalyst Separation & Neutral Wash',
        unitOpType: 'Workup',
        description: 'Catalyst separation followed by mild alkaline wash and aqueous scrubbing to remove acids.',
        intermediateProduced: 'Washed Crude Propofol Intermediate'
      },
      {
        id: 'stage-3',
        order: 3,
        name: 'Unit Op 3: Fractional Vacuum Distillation',
        unitOpType: 'Purification',
        description: 'Precision vacuum fractionation column separation to purge 2,4-isomer and mono-isopropyl byproducts.',
        intermediateProduced: 'Pure Propofol API (≥ 99.5%)'
      }
    ]
  }

  // Fosravuconazole / FRZ
  if (combined.includes('fosravuconazole') || combined.includes('ravuconazole') || compound.toLowerCase() === 'frz') {
    return [
      {
        id: 'stage-1',
        order: 1,
        name: 'Stage 1: Phosphonooxymethylation Reaction',
        unitOpType: 'Reaction',
        description: 'Coupling of Ravuconazole with di-tert-butyl chloromethyl phosphate.',
        intermediateProduced: 'Protected Phosphonooxymethyl Intermediate'
      },
      {
        id: 'stage-2',
        order: 2,
        name: 'Stage 2: Acidic Deprotection & Liquid Extraction',
        unitOpType: 'Workup',
        description: 'Cleavage of protective tert-butyl groups followed by organic-aqueous phase separation.',
        intermediateProduced: 'Crude Fosravuconazole Free Acid Mass'
      },
      {
        id: 'stage-3',
        order: 3,
        name: 'Stage 3: Choline Salt Formation & Crystallization',
        unitOpType: 'Crystallization',
        description: 'Salification with choline hydroxide and controlled cooling crystallization from isopropanol/water.',
        intermediateProduced: 'Fosravuconazole Choline API'
      }
    ]
  }

  // Loxoprofen / LXP
  if (combined.includes('loxoprofen') || combined.includes('lxp')) {
    return [
      {
        id: 'stage-1',
        order: 1,
        name: 'Stage 1: Bromination & Carbonylation Reaction',
        unitOpType: 'Reaction',
        description: 'Bromination of ethyl 2-phenylpropanoate followed by catalytic carbonylation/coupling.',
        intermediateProduced: '2-[4-(Bromomethyl)phenyl]propanoate Intermediate'
      },
      {
        id: 'stage-2',
        order: 2,
        name: 'Stage 2: Alkaline Hydrolysis & Acid Extraction',
        unitOpType: 'Workup',
        description: 'Ester saponification and aqueous-organic partitioning to purge side impurities.',
        intermediateProduced: 'Crude Loxoprofen Organic Layer'
      },
      {
        id: 'stage-3',
        order: 3,
        name: 'Stage 3: Controlled Recrystallization & Isolation',
        unitOpType: 'Crystallization',
        description: 'Controlled cooling crystallization from ethanol/water and vacuum drying.',
        intermediateProduced: 'Pure Loxoprofen Sodium Hydrate'
      }
    ]
  }

  // Brexpiprazole / BXP
  if (combined.includes('brexpiprazole') || combined.includes('bxp')) {
    return [
      {
        id: 'stage-1',
        order: 1,
        name: 'Stage 1: Piperazine-Quinolinone Coupling Reaction',
        unitOpType: 'Reaction',
        description: 'Condensation of 1-(benzo[b]thiophen-4-yl)piperazine with 4-(4-chlorobutoxy)quinolin-2(1H)-one.',
        intermediateProduced: 'Crude Brexpiprazole Free Base'
      },
      {
        id: 'stage-2',
        order: 2,
        name: 'Stage 2: Organic Extraction & Impurity Wash',
        unitOpType: 'Workup',
        description: 'Aqueous scrubbing to remove inorganic bases, polar solvents, and residual raw materials.',
        intermediateProduced: 'Washed Brexpiprazole Organic Extract'
      },
      {
        id: 'stage-3',
        order: 3,
        name: 'Stage 3: Form I Recrystallization & Micronization',
        unitOpType: 'Crystallization',
        description: 'Controlled anti-solvent crystallization in ethanol/water and vacuum drying.',
        intermediateProduced: 'Pure Brexpiprazole Form I API'
      }
    ]
  }

  // Paracetamol / APAP (Acetaminophen)
  if (combined.includes('paracetamol') || combined.includes('acetaminophen') || combined.includes('apap')) {
    return [
      {
        id: 'stage-1',
        order: 1,
        name: 'Unit Op 1: p-Aminophenol Acetylation Reaction',
        unitOpType: 'Reaction',
        description: 'Acetylation of 4-aminophenol with acetic anhydride under controlled temperature and inert atmosphere.',
        intermediateProduced: 'Crude Acetaminophen Reaction Broth'
      },
      {
        id: 'stage-2',
        order: 2,
        name: 'Unit Op 2: Decoloration & Polish Clarification',
        unitOpType: 'Workup',
        description: 'Treatment with activated carbon and hot polish filtration to remove colored quinone-imine degradation impurities.',
        intermediateProduced: 'Clarified Paracetamol Filtrate'
      },
      {
        id: 'stage-3',
        order: 3,
        name: 'Unit Op 3: Controlled Cooling Crystallization & Drying',
        unitOpType: 'Crystallization',
        description: 'Controlled cooling crystallization to form stable monoclinic Form I crystals followed by fluid bed drying.',
        intermediateProduced: 'Pure Paracetamol API (USP/Ph.Eur)'
      }
    ]
  }

  // Atorvastatin Calcium
  if (combined.includes('atorvastatin')) {
    return [
      {
        id: 'stage-1',
        order: 1,
        name: 'Stage 1: Paal-Knorr Pyrrole Ring Condensation',
        unitOpType: 'Reaction',
        description: 'Condensation of diketone with fluorophenyl amine intermediate to assemble the central pyrrole core.',
        intermediateProduced: 'Protected Pyrrole Intermediate'
      },
      {
        id: 'stage-2',
        order: 2,
        name: 'Stage 2: Acetonide Deprotection & Saponification',
        unitOpType: 'Workup',
        description: 'Acid-catalyzed diol deprotection followed by alkaline hydrolysis to form sodium atorvastatin solution.',
        intermediateProduced: 'Sodium Atorvastatin Aqueous Solution'
      },
      {
        id: 'stage-3',
        order: 3,
        name: 'Stage 3: Calcium Salt Metathesis & Amorphous Isolation',
        unitOpType: 'Crystallization',
        description: 'Aqueous metathesis with calcium acetate, controlled precipitation, washing, and vacuum drying.',
        intermediateProduced: 'Pure Atorvastatin Calcium Amorphous API'
      }
    ]
  }

  // 2. Check if the project is scoped to a specific Single Unit Operation or Single Stage
  const hasUnitOpScope =
    (/(crystalliz|precipitat|alkylat|distill|fractionat|hydrogenat|filtrat|drying|purif)/i.test(combined)) &&
    !combined.includes('multi-stage') &&
    !combined.includes('multi-step') &&
    !combined.includes('full synthesis')

  const isSingleStage =
    /\bstage[\s-_]*(?:\d+|i|ii|iii|iv|one|two|three|four)\b/i.test(combined) ||
    /\bstep[\s-_]*(?:\d+|i|ii|iii|iv|one|two|three|four)\b/i.test(combined) ||
    /\b(single[\s-_]*stage|stage[\s-_]*specific|single[\s-_]*step|unit[\s-_]*operation)\b/i.test(combined) ||
    hasUnitOpScope

  const compLabel = compound || 'API'

  if (isSingleStage) {
    // A. Alkylation specific unit operations breakdown
    if (combined.includes('alkylat')) {
      return [
        {
          id: 'stage-1',
          order: 1,
          name: 'Unit Op 1: Catalytic Alkylation Reaction',
          unitOpType: 'Reaction',
          description: `Catalytic alkylation of starting material under controlled feed dosing, acid/base catalyst loading, and temperature profile.`,
          intermediateProduced: `Crude Alkylated ${compLabel} Reaction Mixture`
        },
        {
          id: 'stage-2',
          order: 2,
          name: 'Unit Op 2: Quench, Catalyst Separation & Washing',
          unitOpType: 'Workup',
          description: `Reaction quenching, catalyst deactivation, and multi-stage aqueous scrubbing to remove acidic/basic catalyst residues and salts.`,
          intermediateProduced: `Washed Crude ${compLabel} Extract`
        },
        {
          id: 'stage-3',
          order: 3,
          name: 'Unit Op 3: Fractional Distillation / Isolation',
          unitOpType: 'Purification',
          description: `Precision vacuum fractionation or selective isolation to purge positional isomers and recover purified ${compLabel}.`,
          intermediateProduced: `Pure ${compLabel} Isolated Intermediate`
        }
      ]
    }

    // B. Crystallization specific unit operations breakdown
    if (combined.includes('crystalliz') || combined.includes('precipitat')) {
      return [
        {
          id: 'stage-1',
          order: 1,
          name: 'Unit Op 1: Controlled Dissolution & Polish Filtration',
          unitOpType: 'Workup',
          description: `Thermal dissolution of crude ${compLabel} in solvent system followed by 0.45µm polish filtration to eliminate particulate seeds.`,
          intermediateProduced: `Clarified Saturated ${compLabel} Solution`
        },
        {
          id: 'stage-2',
          order: 2,
          name: 'Unit Op 2: Metastable Seeding & Cooling Crystallization',
          unitOpType: 'Crystallization',
          description: `Controlled seed loading in the metastable zone followed by programmed linear cooling to build target polymorphic crystal habit.`,
          intermediateProduced: `${compLabel} Crystal Slurry`
        },
        {
          id: 'stage-3',
          order: 3,
          name: 'Unit Op 3: Slurry Filtration, Cake Wash & Vacuum Drying',
          unitOpType: 'Drying',
          description: `Pressure/vacuum solid-liquid separation, displacement cake wash with chilled liquor, and agitated vacuum drying.`,
          intermediateProduced: `Pure Crystalline ${compLabel}`
        }
      ]
    }

    // C. Catalytic Hydrogenation specific unit operations breakdown
    if (combined.includes('hydrogenat')) {
      return [
        {
          id: 'stage-1',
          order: 1,
          name: 'Unit Op 1: Catalytic Slurry Hydrogenation Reaction',
          unitOpType: 'Reaction',
          description: `Heterogeneous catalytic reduction under pressurized hydrogen atmosphere with temperature and agitation control.`,
          intermediateProduced: `Hydrogenated Crude ${compLabel} Mixture`
        },
        {
          id: 'stage-2',
          order: 2,
          name: 'Unit Op 2: Catalyst Sparkler Filtration & Decoloration',
          unitOpType: 'Filtration',
          description: `Inert gas-blanketed filtration through pre-coated sparkler filter to recover catalyst followed by carbon polishing.`,
          intermediateProduced: `Clarified Catalyst-Free ${compLabel} Filtrate`
        },
        {
          id: 'stage-3',
          order: 3,
          name: 'Unit Op 3: Anti-Solvent Crystallization & Isolation',
          unitOpType: 'Crystallization',
          description: `Controlled anti-solvent crystallization, deliquoring, and vacuum drying to target specification.`,
          intermediateProduced: `Isolated Reduced ${compLabel}`
        }
      ]
    }

    // D. Distillation / Fractionation specific unit operations breakdown
    if (combined.includes('distill') || combined.includes('fractionat')) {
      return [
        {
          id: 'stage-1',
          order: 1,
          name: 'Unit Op 1: Degassing & Light Ends Stripping',
          unitOpType: 'Purification',
          description: `Thermal degassing under vacuum to strip low-boiling solvents and volatile impurities from crude ${compLabel}.`,
          intermediateProduced: `Degassed Crude ${compLabel}`
        },
        {
          id: 'stage-2',
          order: 2,
          name: 'Unit Op 2: Precision Vacuum Fractionation',
          unitOpType: 'Purification',
          description: `High-vacuum fractional column distillation with regulated reflux ratio to isolate the pure heart-cut fraction.`,
          intermediateProduced: `Fractionated Pure ${compLabel} Distillate`
        },
        {
          id: 'stage-3',
          order: 3,
          name: 'Unit Op 3: Reboiler Cut & Inert Nitrogen Storage',
          unitOpType: 'Purification',
          description: `Bottom residue discharge, product cooling, and packaging under dry nitrogen blanketing.`,
          intermediateProduced: `Pure ${compLabel} API`
        }
      ]
    }

    // E. General single-stage breakdown into 3 sequential Unit Operations
    let rxnType = 'Coupling / Synthesis'
    if (combined.includes('brominat') || combined.includes('halogenat') || combined.includes('chlorinat')) rxnType = 'Halogenation'
    else if (combined.includes('condensat')) rxnType = 'Condensation'
    else if (combined.includes('deprotect')) rxnType = 'Deprotection'
    else if (combined.includes('hydrolys')) rxnType = 'Hydrolysis'
    else if (combined.includes('esterif') || combined.includes('acylation')) rxnType = 'Acylation / Esterification'
    else if (combined.includes('cycliz')) rxnType = 'Cyclization'
    else if (combined.includes('salt') || combined.includes('salifi')) rxnType = 'Salt Formation'

    return [
      {
        id: 'stage-1',
        order: 1,
        name: `Unit Op 1: ${rxnType} Reaction`,
        unitOpType: 'Reaction',
        description: `Chemical transformation of starting materials to form target intermediate under controlled conditions.`,
        intermediateProduced: `Crude ${compLabel} Reaction Mixture`
      },
      {
        id: 'stage-2',
        order: 2,
        name: 'Unit Op 2: Quench, Extraction & Washing',
        unitOpType: 'Workup',
        description: `Reaction quenching, aqueous-organic phase partitioning, and scrubbing to purge inorganic salts and excess reagents.`,
        intermediateProduced: `Washed Organic Extract (${compLabel})`
      },
      {
        id: 'stage-3',
        order: 3,
        name: 'Unit Op 3: Product Isolation & Drying',
        unitOpType: 'Crystallization',
        description: `Controlled cooling/anti-solvent crystallization, filtration, and vacuum drying to target specification.`,
        intermediateProduced: `Pure ${compLabel} Isolated Intermediate`
      }
    ]
  }

  // 4. Default Multi-Stage Backbone tailored with compound name
  return [
    {
      id: 'stage-1',
      order: 1,
      name: `Stage 1: Key Intermediate Synthesis`,
      unitOpType: 'Reaction',
      description: `Primary coupling/synthesis reaction to assemble the core chemical framework of ${compLabel}.`,
      intermediateProduced: `${compLabel} Intermediate-1`
    },
    {
      id: 'stage-2',
      order: 2,
      name: `Stage 2: Deprotection & Aqueous Workup`,
      unitOpType: 'Workup',
      description: `Deprotection or functional group conversion followed by liquid-liquid extraction and washing.`,
      intermediateProduced: `${compLabel} Intermediate-2`
    },
    {
      id: 'stage-3',
      order: 3,
      name: `Stage 3: ${compLabel} Final Crystallization & Isolation`,
      unitOpType: 'Crystallization',
      description: `Controlled crystallization to deliver final API with defined polymorphic form and particle size.`,
      intermediateProduced: `Final ${compLabel} API (Unmilled)`
    }
  ]
}

function makeQtppItem(
  id: string,
  attribute: string,
  operator: string,
  criterion: string,
  justification: string,
  type: string
): QTPPItem {
  const ac = parseLegacyCriterion(criterion, operator, type)
  const op = getCriterionOperator(ac.type) || operator
  const disp = ac.displayString || formatCriterionDisplay(ac) || criterion
  return {
    id,
    attribute,
    operator: op,
    criterion: disp,
    justification,
    type,
    acceptanceCriterion: ac
  }
}

/**
 * Attempts to parse explicit QTPP attributes directly from the user's project description or notes.
 * E.g.: "Assay: 98.0 - 102.0%", "- Purity: >= 99.0%", "Water: <= 0.5%"
 */
function parseQTPPFromDescription(description: string, compound: string): QTPPItem[] | null {
  if (!description || description.trim().length === 0) return null
  const lines = description.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const items: QTPPItem[] = []

  // Pattern: "[-*•] [Attribute Name] [:=-] [Criterion]"
  const lineRegex = /^(?:[-*•]|\d+[.)])?\s*([A-Za-z0-9\s/()–—-]+?)[:=]\s*(.+)$/

  for (const line of lines) {
    const match = line.match(lineRegex)
    if (!match) continue
    const rawAttr = match[1].trim()
    const rawCrit = match[2].trim()

    if (rawAttr.length > 45 || rawAttr.length < 3) continue
    const attrLower = rawAttr.toLowerCase()
    if (
      attrLower.includes('objective') ||
      attrLower.includes('project') ||
      attrLower.includes('background') ||
      attrLower.includes('scope') ||
      attrLower.includes('stage') ||
      attrLower.includes('step')
    ) {
      continue
    }

    let type = 'Impurity'
    let justification = 'Pharmacopoeial'
    if (attrLower.includes('assay') || attrLower.includes('purity') || attrLower.includes('potency') || attrLower.includes('yield')) {
      type = 'Assay-Purity'
    } else if (attrLower.includes('ident') || attrLower.includes('ir') || attrLower.includes('nmr')) {
      type = 'Identity'
    } else if (
      attrLower.includes('water') ||
      attrLower.includes('karl') ||
      attrLower.includes('moisture') ||
      attrLower.includes('melt') ||
      attrLower.includes('solid') ||
      attrLower.includes('ph') ||
      attrLower.includes('refract') ||
      attrLower.includes('sor') ||
      attrLower.includes('rotation')
    ) {
      type = 'Physical Property'
    } else if (attrLower.includes('solvent')) {
      type = 'Residual Solvent'
      justification = 'Regulatory Guideline'
    } else if (attrLower.includes('appear') || attrLower.includes('color') || attrLower.includes('clarity')) {
      type = 'Appearance & Color'
    } else if (attrLower.includes('micro') || attrLower.includes('endotoxin') || attrLower.includes('bioburden')) {
      type = 'Microbial'
      justification = 'Patient-Critical'
    }

    let op = '='
    if (
      rawCrit.includes('≤') ||
      rawCrit.includes('<=') ||
      rawCrit.toLowerCase().startsWith('max') ||
      rawCrit.toLowerCase().startsWith('not more than') ||
      rawCrit.toLowerCase().startsWith('nmt')
    ) {
      op = '≤'
    } else if (
      rawCrit.includes('≥') ||
      rawCrit.includes('>=') ||
      rawCrit.toLowerCase().startsWith('min') ||
      rawCrit.toLowerCase().startsWith('not less than') ||
      rawCrit.toLowerCase().startsWith('nlt')
    ) {
      op = '≥'
    } else if (rawCrit.includes('-') || rawCrit.includes('to')) {
      op = 'Range'
    } else if (rawCrit.toLowerCase().includes('conform') || rawCrit.toLowerCase().includes('pass') || rawCrit.toLowerCase().includes('complies')) {
      op = 'Conforms'
    }

    items.push(makeQtppItem(`qtpp-${items.length + 1}`, rawAttr, op, rawCrit, justification, type))
  }

  return items.length >= 2 ? items : null
}

/**
 * Context-aware QTPP generator providing standard pharmacopoeial compendial specifications
 * tailored to the API compound or parsed from the project description.
 */
export function generateContextAwareQTPP(
  project: {
    name?: string
    compound?: string
    objective?: string
    description?: string
  } | null
): QTPPItem[] {
  const name = (project?.name || '').trim()
  const compound = (project?.compound || '').trim()
  const objective = (project?.objective || '').trim()
  const description = (project?.description || '').trim()
  const comp = `${compound} ${name} ${objective} ${description}`.toLowerCase()

  // 1. Check if user described explicit specifications in the project description
  const parsedFromText = parseQTPPFromDescription(description, compound)
  if (parsedFromText && parsedFromText.length >= 3) {
    return parsedFromText
  }

  // 2. Specific API Compendial Monographs (USP / Ph. Eur. / IP)
  if (comp.includes('propofol') || comp.includes('diisopropylphenol')) {
    return [
      makeQtppItem('qtpp-1', 'Appearance / Physical State', 'Conforms', 'Clear, colorless to very pale yellow liquid', 'Pharmacopoeial', 'Appearance & Color'),
      makeQtppItem('qtpp-2', 'Assay (Purity)', 'Range', '98.0% - 102.0% w/w', 'Pharmacopoeial', 'Assay-Purity'),
      makeQtppItem('qtpp-3', 'Total Impurities', '≤', '≤ 0.50% w/w', 'Pharmacopoeial', 'Impurity'),
      makeQtppItem('qtpp-4', 'Specified Impurity A (Propofol Quinone)', '≤', '≤ 0.10% w/w', 'Pharmacopoeial', 'Impurity'),
      makeQtppItem('qtpp-5', 'Any Unspecified / Individual Impurity', '≤', '≤ 0.10% w/w', 'Pharmacopoeial', 'Impurity'),
      makeQtppItem('qtpp-6', 'Water Content (KF)', '≤', '≤ 0.10% w/w', 'Pharmacopoeial', 'Physical Property'),
      makeQtppItem('qtpp-7', 'Residual Solvents', 'Conforms', 'Complies with ICH Q3C limits', 'Pharmacopoeial', 'Residual Solvent'),
      makeQtppItem('qtpp-8', 'Refractive Index (nD20)', 'Range', '1.512 - 1.514', 'Pharmacopoeial', 'Physical Property')
    ]
  }

  if (comp.includes('rocuronium')) {
    return [
      makeQtppItem('qtpp-1', 'Appearance & Description', 'Conforms', 'White to almost white or faintly yellowish hygroscopic powder', 'Pharmacopoeial', 'Appearance & Color'),
      makeQtppItem('qtpp-2', 'Identification by IR', 'Conforms', 'Conforms to Rocuronium Bromide reference spectrum', 'Pharmacopoeial', 'Identity'),
      makeQtppItem('qtpp-3', 'Assay (HPLC Anhydrous Basis)', 'Range', '98.0% - 102.0% w/w', 'Pharmacopoeial', 'Assay-Purity'),
      makeQtppItem('qtpp-4', 'Impurity A (Di-morpholine adduct)', '≤', '≤ 0.50% w/w', 'Patient-Critical', 'Impurity'),
      makeQtppItem('qtpp-5', 'Impurity C (Desallyl rocuronium)', '≤', '≤ 0.20% w/w', 'Regulatory Guideline', 'Impurity'),
      makeQtppItem('qtpp-6', 'Total Impurities', '≤', '≤ 1.50% w/w', 'Pharmacopoeial', 'Impurity'),
      makeQtppItem('qtpp-7', 'Specific Optical Rotation (SOR)', 'Range', '+28.0° to +32.0°', 'Pharmacopoeial', 'Physical Property'),
      makeQtppItem('qtpp-8', 'Water Content (Karl Fischer)', '≤', '≤ 4.00% w/w', 'Pharmacopoeial', 'Physical Property'),
      makeQtppItem('qtpp-9', 'Residual Solvents (GC Headspace)', 'Conforms', 'Complies with ICH Limits', 'Regulatory Guideline', 'Residual Solvent')
    ]
  }

  if (comp.includes('brexpiprazole') || comp.includes('bxp')) {
    return [
      makeQtppItem('qtpp-1', 'Appearance & Description', 'Conforms', 'White to off-white crystalline powder', 'Pharmacopoeial', 'Appearance & Color'),
      makeQtppItem('qtpp-2', 'Identification by IR & HPLC', 'Conforms', 'Conforms to Brexpiprazole reference standard', 'Pharmacopoeial', 'Identity'),
      makeQtppItem('qtpp-3', 'Assay (HPLC Anhydrous)', 'Range', '98.0% - 102.0% w/w', 'Pharmacopoeial', 'Assay-Purity'),
      makeQtppItem('qtpp-4', 'Des-benzo Impurity', '≤', '≤ 0.15% w/w', 'Patient-Critical', 'Impurity'),
      makeQtppItem('qtpp-5', 'Single Maximum Unknown Impurity', '≤', '≤ 0.10% w/w', 'Regulatory Guideline', 'Impurity'),
      makeQtppItem('qtpp-6', 'Total Impurities', '≤', '≤ 0.50% w/w', 'Pharmacopoeial', 'Impurity'),
      makeQtppItem('qtpp-7', 'Water Content (Karl Fischer)', '≤', '≤ 0.50% w/w', 'Pharmacopoeial', 'Physical Property'),
      makeQtppItem('qtpp-8', 'Residual Solvents (ICH Q3C)', 'Conforms', 'Complies with ICH Limits', 'Regulatory Guideline', 'Residual Solvent')
    ]
  }

  if (comp.includes('fosravuconazole') || comp.includes('frz')) {
    return [
      makeQtppItem('qtpp-1', 'Appearance & Description', 'Conforms', 'White to off-white or pale yellow crystalline powder', 'Pharmacopoeial', 'Appearance & Color'),
      makeQtppItem('qtpp-2', 'Identification by IR', 'Conforms', 'Conforms to Reference Spectrum', 'Pharmacopoeial', 'Identity'),
      makeQtppItem('qtpp-3', 'Assay (HPLC Anhydrous)', 'Range', '98.0% - 102.0% w/w', 'Pharmacopoeial', 'Assay-Purity'),
      makeQtppItem('qtpp-4', 'Diacetyl Impurity', '≤', '≤ 0.15% w/w', 'Patient-Critical', 'Impurity'),
      makeQtppItem('qtpp-5', 'KSM-1 Residual', '≤', '≤ 0.50% w/w', 'Internal Spec', 'Impurity'),
      makeQtppItem('qtpp-6', 'Single maximum unknown impurity', '≤', '≤ 0.10% w/w', 'Regulatory Guideline', 'Impurity'),
      makeQtppItem('qtpp-7', 'Total Impurities', '≤', '≤ 1.00% w/w', 'Pharmacopoeial', 'Impurity'),
      makeQtppItem('qtpp-8', 'Water Content / Karl Fischer', '≤', '≤ 0.50% w/w', 'Pharmacopoeial', 'Physical Property'),
      makeQtppItem('qtpp-9', 'Melting point', 'Range', '152°C - 156°C', 'Pharmacopoeial', 'Physical Property')
    ]
  }

  if (comp.includes('loxoprofen') || comp.includes('lxp')) {
    return [
      makeQtppItem('qtpp-1', 'Appearance & Description', 'Conforms', 'White to yellowish-white crystal or powder', 'Pharmacopoeial', 'Appearance & Color'),
      makeQtppItem('qtpp-2', 'Identification by IR', 'Conforms', 'Conforms to Loxoprofen reference standard spectrum', 'Pharmacopoeial', 'Identity'),
      makeQtppItem('qtpp-3', 'Assay (HPLC Titration)', 'Range', '98.5% - 101.5% w/w', 'Pharmacopoeial', 'Assay-Purity'),
      makeQtppItem('qtpp-4', 'Related Substance A (2-(4-(bromomethyl)phenyl)propanoic acid)', '≤', '≤ 0.20% w/w', 'Patient-Critical', 'Impurity'),
      makeQtppItem('qtpp-5', 'Single Maximum Unknown Impurity', '≤', '≤ 0.10% w/w', 'Regulatory Guideline', 'Impurity'),
      makeQtppItem('qtpp-6', 'Total Impurities', '≤', '≤ 0.80% w/w', 'Pharmacopoeial', 'Impurity'),
      makeQtppItem('qtpp-7', 'Water Content (Dihydrate Form)', 'Range', '11.0% - 13.0% w/w', 'Pharmacopoeial', 'Physical Property'),
      makeQtppItem('qtpp-8', 'Residual Solvents', 'Conforms', 'Complies with ICH Class 2 & 3 Limits', 'Regulatory Guideline', 'Residual Solvent')
    ]
  }

  // 3. Harmonized USP / Ph. Eur. Chemical Drug Substance (API) Standard Specification
  const drugName = compound || 'API Drug Substance'
  return [
    makeQtppItem('qtpp-1', 'Appearance & Physical State', 'Conforms', `White to off-white crystalline solid or characteristic ${comp.includes('oil') || comp.includes('liquid') ? 'liquid' : 'powder'}`, 'Pharmacopoeial', 'Appearance & Color'),
    makeQtppItem('qtpp-2', 'Identification by IR / Spectrometry', 'Conforms', `Conforms to ${drugName} reference standard spectrum`, 'Pharmacopoeial', 'Identity'),
    makeQtppItem('qtpp-3', 'Assay / Potency (HPLC Anhydrous Basis)', 'Range', '98.0% - 102.0% w/w', 'Pharmacopoeial', 'Assay-Purity'),
    makeQtppItem('qtpp-4', 'Any Individual Unknown / Unspecified Impurity', '≤', '≤ 0.10% w/w', 'Regulatory Guideline', 'Impurity'),
    makeQtppItem('qtpp-5', 'Total Related Substances / Impurities', '≤', '≤ 1.00% w/w', 'Pharmacopoeial', 'Impurity'),
    makeQtppItem('qtpp-6', 'Water Content / Karl Fischer Titration', '≤', '≤ 0.50% w/w', 'Pharmacopoeial', 'Physical Property'),
    makeQtppItem('qtpp-7', 'Residue on Ignition / Sulfated Ash', '≤', '≤ 0.10% w/w', 'Pharmacopoeial', 'Impurity'),
    makeQtppItem('qtpp-8', 'Residual Solvents (ICH Q3C Headspace GC)', 'Conforms', 'Complies with ICH Class 2 & 3 Limits', 'Regulatory Guideline', 'Residual Solvent')
  ]
}

/**
 * Generates context-aware Critical Quality Attributes (CQAs) for a project based on compound chemistry and QTPPs.
 */
export function generateContextAwareCQAs(project: Project | null, qtpp: QTPPItem[] = []): CQAMapping[] {
  // If QTPPs exist, map directly from them
  if (qtpp && qtpp.length > 0) {
    return qtpp.map((q, idx) => {
      let method = 'HPLC-UV (254 nm)'
      const attrLower = (q.attribute || '').toLowerCase()
      const typeLower = (q.type || '').toLowerCase()

      if (attrLower.includes('gc') || typeLower.includes('gc')) method = 'GC-FID'
      else if (attrLower.includes('headspace') || attrLower.includes('solvent')) method = 'GC-Headspace'
      else if (attrLower.includes('ir') || attrLower.includes('spectrum')) method = 'FTIR Spectrometry'
      else if (attrLower.includes('karl fischer') || attrLower.includes('water')) method = 'Karl Fischer Titration'
      else if (attrLower.includes('rotation') || attrLower.includes('sor')) method = 'Polarimetry (589 nm)'
      else if (attrLower.includes('melting') || attrLower.includes('dsc')) method = 'Capillary Melting Point'
      else if (attrLower.includes('particle') || attrLower.includes('psd')) method = 'Laser Diffraction'
      else if (typeLower.includes('impurity') || attrLower.includes('impurity')) method = 'LC-MS/MS'
      else if (typeLower.includes('assay') || attrLower.includes('assay')) method = 'HPLC-UV (254 nm)'

      let range = q.criterion || ''
      if (q.operator && q.operator !== '=' && q.operator !== 'Conforms' && !range.startsWith(q.operator)) {
        range = `${q.operator} ${range}`
      }

      let justification = ''
      if (q.justification === 'Patient-Critical') {
        justification = 'Directly impacts clinical safety and therapeutic efficacy.'
      } else if (q.justification === 'Pharmacopoeial') {
        justification = 'Pharmacopoeial compendial specification for release.'
      } else if (q.justification === 'Regulatory Guideline') {
        justification = 'ICH guideline qualification threshold for quality.'
      } else {
        justification = 'Essential quality attribute to satisfy finished product QTPP.'
      }

      return {
        id: `cqa-${idx + 1}`,
        name: q.attribute,
        appliesTo: 'Final API',
        stageName: '',
        method,
        range,
        justification,
        linkedQtppIds: [q.id]
      }
    })
  }

  // Fallback domain-specific chemistry templates
  const comp = `${project?.compound || ''} ${project?.name || ''} ${project?.objective || ''}`.toLowerCase()
  if (comp.includes('propofol') || comp.includes('diisopropylphenol')) {
    return [
      {
        id: 'cqa-1',
        name: 'Stage-1 Intermediate Yield (%)',
        appliesTo: 'Intermediate',
        stageName: 'Unit Op 1: Friedel-Crafts Alkylation Reaction',
        method: 'HPLC-UV (254 nm)',
        range: '≥ 85.0%',
        justification: 'Critical intermediate reaction conversion benchmark to ensure commercial batch yield.',
        linkedQtppIds: []
      },
      {
        id: 'cqa-2',
        name: 'Mono-alkylated Impurity: 3-isopropyl-4-HBA (%)',
        appliesTo: 'Intermediate',
        stageName: 'Unit Op 1: Friedel-Crafts Alkylation Reaction',
        method: 'HPLC-UV (254 nm)',
        range: '≤ 0.50%',
        justification: 'Incomplete double-alkylation by-product that carries forward into final drug substance.',
        linkedQtppIds: []
      },
      {
        id: 'cqa-3',
        name: 'Unreacted 4-Hydroxybenzoic Acid (%)',
        appliesTo: 'Intermediate',
        stageName: 'Unit Op 1: Friedel-Crafts Alkylation Reaction',
        method: 'HPLC-UV (254 nm)',
        range: '≤ 0.50%',
        justification: 'Residual starting material indicating incomplete reaction progression.',
        linkedQtppIds: []
      },
      {
        id: 'cqa-4',
        name: 'HPLC Assay Purity (%)',
        appliesTo: 'Final API',
        stageName: '',
        method: 'HPLC-UV (275 nm)',
        range: '≥ 98.0%',
        justification: 'Core pharmacopoeial purity specification for Propofol API.',
        linkedQtppIds: []
      }
    ]
  }

  if (comp.includes('rocuronium')) {
    return [
      {
        id: 'cqa-1',
        name: 'Stage-I Intermediate Yield (%)',
        appliesTo: 'Intermediate',
        stageName: 'Stage 1: Morpholine Condensation',
        method: 'HPLC-UV (215 nm)',
        range: '≥ 92.0%',
        justification: 'Crucial for downstream crystallization recovery.',
        linkedQtppIds: []
      },
      {
        id: 'cqa-2',
        name: 'Impurity A (Di-morpholine adduct) (%)',
        appliesTo: 'Intermediate',
        stageName: 'Stage 1: Morpholine Condensation',
        method: 'HPLC-UV (215 nm)',
        range: '≤ 0.50%',
        justification: 'Critical process-related degradation impurity.',
        linkedQtppIds: []
      },
      {
        id: 'cqa-3',
        name: 'Residual Morpholine Content (%)',
        appliesTo: 'Intermediate',
        stageName: 'Stage 1: Morpholine Condensation',
        method: 'GC-FID',
        range: '≤ 0.10%',
        justification: 'Toxic reagent residual burden.',
        linkedQtppIds: []
      }
    ]
  }

  // Generic chemical process fallback
  return [
    {
      id: 'cqa-1',
      name: 'Reaction Conversion / Assay Yield (%)',
      appliesTo: 'Intermediate',
      stageName: '',
      method: 'HPLC-UV (254 nm)',
      range: '≥ 90.0%',
      justification: 'Primary conversion efficiency indicator.',
      linkedQtppIds: []
    },
    {
      id: 'cqa-2',
      name: 'Critical Process Impurity (%)',
      appliesTo: 'Intermediate',
      stageName: '',
      method: 'HPLC-UV (254 nm)',
      range: '≤ 0.50%',
      justification: 'Key process impurity required below ICH qualification limits.',
      linkedQtppIds: []
    },
    {
      id: 'cqa-3',
      name: 'API Chromatographic Purity (%)',
      appliesTo: 'Final API',
      stageName: '',
      method: 'HPLC-UV (254 nm)',
      range: '≥ 98.5%',
      justification: 'Finished active substance specification.',
      linkedQtppIds: []
    }
  ]
}

/**
 * Generates context-aware Critical Process Parameters (CPPs) and Critical Material Attributes (CMAs)
 * for a specific stage, taking into account its unit operation, stage description, and compound.
 */
export function generateContextAwareRiskParameters(
  stage: StageItem,
  idx: number,
  project: Project | null,
  cqas: CQAMapping[]
): RiskParameter[] {
  const stageId = stage?.id || `stage-${idx + 1}`
  const stageName = (stage?.name || '').trim()
  const unitOp = (stage?.unitOpType || 'Reaction').toLowerCase()
  const stageDesc = (stage?.description || '').toLowerCase()
  const compound = (project?.compound || project?.name || '').trim()
  const compLower = compound.toLowerCase()
  const linkedCqaIds = cqas.map(c => c.id)

  const pPrefix = `p-${stageId}`

  // Rocuronium Bromide stage-specific parameters
  if (compLower.includes('rocuronium')) {
    if (unitOp.includes('workup') || idx === 1) {
      return [
        { id: `${pPrefix}-1`, name: 'Extraction Aqueous Layer pH', type: 'CPP-candidate', linkedCqaIds, severity: 5, occurrence: 3, detectability: 2, rpn: 30, rationale: 'Controls API ionization state and partition coefficient into organic phase.', criticalFlag: true, overrideReason: '' },
        { id: `${pPrefix}-2`, name: 'Quench Water Temperature (°C)', type: 'CPP-candidate', linkedCqaIds, severity: 4, occurrence: 3, detectability: 2, rpn: 24, rationale: 'Elevated quench temp triggers hydrolytic decomposition.', criticalFlag: true, overrideReason: '' },
        { id: `${pPrefix}-3`, name: 'Aqueous Extraction Ratio (v/v)', type: 'CPP-candidate', linkedCqaIds, severity: 4, occurrence: 3, detectability: 2, rpn: 24, rationale: 'Determines residual morpholine & impurity removal efficiency.', criticalFlag: true, overrideReason: '' },
        { id: `${pPrefix}-4`, name: 'Phase Separation Settling Time (min)', type: 'CMA-candidate', linkedCqaIds, severity: 3, occurrence: 2, detectability: 2, rpn: 12, rationale: 'Incomplete settling leads to rag layer carryover.', criticalFlag: false, overrideReason: '' },
        { id: `${pPrefix}-5`, name: 'Extraction Agitation Speed (RPM)', type: 'CMA-candidate', linkedCqaIds, severity: 2, occurrence: 2, detectability: 2, rpn: 8, rationale: 'Ensures uniform phase mixing without forming emulsion.', criticalFlag: false, overrideReason: '' }
      ]
    }
    if (unitOp.includes('crystallization') || idx === 2) {
      return [
        { id: `${pPrefix}-1`, name: 'Crystallization Cooling Rate (°C/min)', type: 'CPP-candidate', linkedCqaIds, severity: 4, occurrence: 4, detectability: 2, rpn: 32, rationale: 'Fast cooling entraps mother liquor impurities; slow cooling improves crystal yield and morphology.', criticalFlag: true, overrideReason: '' },
        { id: `${pPrefix}-2`, name: 'Acetonitrile Seed Quantity (%)', type: 'CPP-candidate', linkedCqaIds, severity: 4, occurrence: 3, detectability: 2, rpn: 24, rationale: 'Controls crystal polymorphic form, nucleation rate, and supersaturation.', criticalFlag: true, overrideReason: '' },
        { id: `${pPrefix}-3`, name: 'Water Anti-solvent Addition Rate (mL/min)', type: 'CPP-candidate', linkedCqaIds, severity: 4, occurrence: 3, detectability: 2, rpn: 24, rationale: 'Rapid addition causes secondary nucleation and wide particle size distribution.', criticalFlag: true, overrideReason: '' },
        { id: `${pPrefix}-4`, name: 'Filtration Wash Volume (L/kg)', type: 'CPP-candidate', linkedCqaIds, severity: 3, occurrence: 3, detectability: 2, rpn: 18, rationale: 'Removes mother liquor impurities from wet cake.', criticalFlag: true, overrideReason: '' },
        { id: `${pPrefix}-5`, name: 'Vacuum Drying Temperature (°C)', type: 'CMA-candidate', linkedCqaIds, severity: 3, occurrence: 3, detectability: 2, rpn: 18, rationale: 'Removes residual solvent below ICH guideline limit.', criticalFlag: false, overrideReason: '' }
      ]
    }
    return [
      { id: `${pPrefix}-1`, name: 'Morpholine Condensation Reaction Temp (°C)', type: 'CPP-candidate', linkedCqaIds, severity: 5, occurrence: 4, detectability: 1, rpn: 40, rationale: 'Elevated temp accelerates Impurity A byproduct; low temp leads to incomplete epoxide conversion.', criticalFlag: true, overrideReason: '' },
      { id: `${pPrefix}-2`, name: 'Morpholine Molar Ratio (eq)', type: 'CPP-candidate', linkedCqaIds, severity: 4, occurrence: 3, detectability: 2, rpn: 24, rationale: 'Excess morpholine increases residual solvent burden; low ratio leaves unreacted starting epoxide.', criticalFlag: true, overrideReason: '' },
      { id: `${pPrefix}-3`, name: 'Reaction Hold Time (h)', type: 'CPP-candidate', linkedCqaIds, severity: 4, occurrence: 3, detectability: 2, rpn: 24, rationale: 'Extended reaction time causes secondary product degradation.', criticalFlag: true, overrideReason: '' },
      { id: `${pPrefix}-4`, name: 'Agitation Speed (RPM)', type: 'CMA-candidate', linkedCqaIds, severity: 3, occurrence: 3, detectability: 3, rpn: 27, rationale: 'Maintains mass transfer uniformity throughout the reaction mass.', criticalFlag: false, overrideReason: '' },
      { id: `${pPrefix}-5`, name: 'Solvent Moisture Content (ppm)', type: 'CMA-candidate', linkedCqaIds, severity: 4, occurrence: 2, detectability: 2, rpn: 16, rationale: 'Trace water causes ring-opened diol byproduct spikes.', criticalFlag: false, overrideReason: '' }
    ]
  }

  // 1. REACTION Unit Operation
  if (unitOp.includes('reaction') || stageName.toLowerCase().includes('reaction') || stageName.toLowerCase().includes('synthesis')) {
    let reagentTerm = 'Reagent Molar Ratio (eq)'
    if (compLower.includes('propofol')) reagentTerm = 'Propylene / Isopropanol Molar Ratio (eq)'
    else if (stageDesc.includes('alkylat') || stageName.toLowerCase().includes('alkylat')) reagentTerm = 'Alkylating Agent Molar Ratio (eq)'
    else if (stageDesc.includes('catalyst')) reagentTerm = 'Catalyst Loading (mol%)'

    return [
      {
        id: `${pPrefix}-1`,
        name: `${stageName.split(':')[0].trim()} Reaction Temperature (°C)`,
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 5,
        occurrence: 4,
        detectability: 2,
        rpn: 40,
        rationale: 'Directly controls reaction kinetics, conversion rate, and suppresses thermal byproduct formation.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-2`,
        name: reagentTerm,
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 3,
        detectability: 2,
        rpn: 24,
        rationale: 'Sub-optimal reagent ratio leaves unreacted starting material; excess burdens downstream purification and causes dimer impurities.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-3`,
        name: 'Catalyst / Base Equivalents',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 3,
        detectability: 2,
        rpn: 24,
        rationale: 'Governs catalytic turnover, reaction selectivity, and completion of the chemical transformation.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-4`,
        name: 'Reaction Hold Time (h)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 3,
        occurrence: 4,
        detectability: 2,
        rpn: 24,
        rationale: 'Under-reaction causes low assay yield; extended hold time accelerates secondary impurity generation.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-5`,
        name: 'Reagent Addition / Dosing Rate (mL/min)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 2,
        detectability: 2,
        rpn: 16,
        rationale: 'Controls reaction exotherm and instantaneous local concentration to avoid runaway or side degradation.',
        criticalFlag: false,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-6`,
        name: 'Agitation Speed & Tip Speed (RPM)',
        type: 'CMA-candidate',
        linkedCqaIds,
        severity: 3,
        occurrence: 3,
        detectability: 3,
        rpn: 27,
        rationale: 'Affects interfacial mass transfer and temperature homogeneity across the batch volume.',
        criticalFlag: false,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-7`,
        name: 'Solvent Water Content / Moisture (ppm)',
        type: 'CMA-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 2,
        detectability: 2,
        rpn: 16,
        rationale: 'Trace moisture can deactivate active catalytic complexes or hydrolyze reactive intermediates.',
        criticalFlag: false,
        overrideReason: ''
      }
    ]
  }

  // 2. WORKUP Unit Operation
  if (unitOp.includes('workup') || stageName.toLowerCase().includes('workup') || stageName.toLowerCase().includes('extraction') || stageName.toLowerCase().includes('quench')) {
    return [
      {
        id: `${pPrefix}-1`,
        name: 'Quench Mixture Temperature (°C)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 3,
        detectability: 2,
        rpn: 24,
        rationale: 'Elevated quench temperature triggers hydrolytic decomposition and uncontrollable exothermic boiling.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-2`,
        name: 'Extraction Aqueous Layer pH',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 5,
        occurrence: 3,
        detectability: 2,
        rpn: 30,
        rationale: 'Governs target compound ionization, maximizing partitioning into organic phase while purging polar impurities.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-3`,
        name: 'Extraction Solvent Ratio (v/v)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 3,
        detectability: 2,
        rpn: 24,
        rationale: 'Determines phase extraction partition coefficient and minimizes product loss in the aqueous raffinate.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-4`,
        name: 'Phase Separation Settling Time (min)',
        type: 'CMA-candidate',
        linkedCqaIds,
        severity: 3,
        occurrence: 3,
        detectability: 2,
        rpn: 18,
        rationale: 'Incomplete settling leads to rag layer emulsion carryover and salt contamination in the organic layer.',
        criticalFlag: false,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-5`,
        name: 'Extraction Agitation Intensity (RPM)',
        type: 'CMA-candidate',
        linkedCqaIds,
        severity: 2,
        occurrence: 3,
        detectability: 2,
        rpn: 12,
        rationale: 'Ensures thorough liquid-liquid interfacial contact without generating stable micro-emulsions.',
        criticalFlag: false,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-6`,
        name: 'Scrubbing Wash Volume (L/kg)',
        type: 'CMA-candidate',
        linkedCqaIds,
        severity: 3,
        occurrence: 2,
        detectability: 2,
        rpn: 12,
        rationale: 'Removes trace polar inorganic salts and residual soluble catalysts from the crude stream.',
        criticalFlag: false,
        overrideReason: ''
      }
    ]
  }

  // 3. CRYSTALLIZATION Unit Operation
  if (unitOp.includes('crystallization') || stageName.toLowerCase().includes('crystallization') || stageName.toLowerCase().includes('isolation')) {
    return [
      {
        id: `${pPrefix}-1`,
        name: 'Crystallization Cooling Rate (°C/min)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 5,
        occurrence: 4,
        detectability: 2,
        rpn: 40,
        rationale: 'Fast cooling creates uncontrollable supersaturation, liquid inclusion, and impurity entrapment; slow cooling optimizes crystal habit and yield.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-2`,
        name: 'Seed Loading & Temperature (°C)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 3,
        detectability: 2,
        rpn: 24,
        rationale: 'Controls polymorphic selectivity (Form I), surface area for growth, and prevents spontaneous secondary nucleation.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-3`,
        name: 'Anti-Solvent Addition Rate (mL/min)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 3,
        detectability: 2,
        rpn: 24,
        rationale: 'Rapid addition creates localized excessive supersaturation, oiling out, and wide bimodal particle size distributions.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-4`,
        name: 'Final Slurry Aging Temperature (°C)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 3,
        detectability: 1,
        rpn: 12,
        rationale: 'Dictates API equilibrium solubility in mother liquor and final recovery yield.',
        criticalFlag: false,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-5`,
        name: 'Crystallizer Agitation Speed (RPM)',
        type: 'CMA-candidate',
        linkedCqaIds,
        severity: 3,
        occurrence: 3,
        detectability: 3,
        rpn: 27,
        rationale: 'Maintains uniform crystal suspension without creating impeller shear attrition or crystal breakage.',
        criticalFlag: false,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-6`,
        name: 'Initial Solution Concentration (g/L)',
        type: 'CMA-candidate',
        linkedCqaIds,
        severity: 3,
        occurrence: 2,
        detectability: 2,
        rpn: 12,
        rationale: 'Establishes initial saturation level and defines the width of the metastable zone.',
        criticalFlag: false,
        overrideReason: ''
      }
    ]
  }

  // 4. PURIFICATION / DISTILLATION Unit Operation
  if (unitOp.includes('purification') || stageName.toLowerCase().includes('distillation') || stageName.toLowerCase().includes('fractionation')) {
    return [
      {
        id: `${pPrefix}-1`,
        name: 'Vapor Temperature / Column Head Temp (°C)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 5,
        occurrence: 4,
        detectability: 2,
        rpn: 40,
        rationale: 'Defines precise fraction cutoff boundaries to separate pure API from close-boiling positional isomers.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-2`,
        name: 'Column Operating Vacuum Pressure (mbar)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 3,
        detectability: 2,
        rpn: 24,
        rationale: 'Controls vaporization temperatures and prevents thermal degradation of the compound.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-3`,
        name: 'Distillation Reflux Ratio',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 3,
        detectability: 2,
        rpn: 24,
        rationale: 'Determines the theoretical plate separation efficiency between desired product and close-boiling impurities.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-4`,
        name: 'Reboiler Pot Temperature (°C)',
        type: 'CMA-candidate',
        linkedCqaIds,
        severity: 3,
        occurrence: 3,
        detectability: 2,
        rpn: 18,
        rationale: 'Prevents thermal cracking, heavy ends polymerization, and pot residue charring.',
        criticalFlag: false,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-5`,
        name: 'Heart-Cut Fraction Heart Window (%)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 2,
        detectability: 2,
        rpn: 16,
        rationale: 'Establishes balance between product purity assay (> 99.5%) and overall recovered yield.',
        criticalFlag: false,
        overrideReason: ''
      }
    ]
  }

  // 5. FILTRATION / DRYING Unit Operation
  if (unitOp.includes('filtration') || unitOp.includes('drying')) {
    return [
      {
        id: `${pPrefix}-1`,
        name: 'Vacuum Drying Temperature (°C)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 3,
        detectability: 2,
        rpn: 24,
        rationale: 'Removes residual solvents below ICH limits without triggering API thermal degradation or polymorph conversion.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-2`,
        name: 'Displacement Cake Wash Volume (L/kg)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 4,
        occurrence: 3,
        detectability: 2,
        rpn: 24,
        rationale: 'Purges mother liquor impurities trapped in wet cake pores while minimizing product dissolution loss.',
        criticalFlag: true,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-3`,
        name: 'Dryer Vacuum Level (mbar)',
        type: 'CPP-candidate',
        linkedCqaIds,
        severity: 3,
        occurrence: 3,
        detectability: 2,
        rpn: 18,
        rationale: 'Reduces solvent boiling point to accelerate mass transfer during the falling drying rate regime.',
        criticalFlag: false,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-4`,
        name: 'Differential Filtration Pressure (bar)',
        type: 'CMA-candidate',
        linkedCqaIds,
        severity: 3,
        occurrence: 2,
        detectability: 2,
        rpn: 12,
        rationale: 'Prevents cake compression and cloth blinding during mother liquor drainage.',
        criticalFlag: false,
        overrideReason: ''
      },
      {
        id: `${pPrefix}-5`,
        name: 'Agitated Dryer Agitation Interval (min)',
        type: 'CMA-candidate',
        linkedCqaIds,
        severity: 2,
        occurrence: 3,
        detectability: 2,
        rpn: 12,
        rationale: 'Breaks up crust formation and ensures uniform heating without grinding particles.',
        criticalFlag: false,
        overrideReason: ''
      }
    ]
  }

  // Generic fallback for any other unit operation
  return [
    {
      id: `${pPrefix}-1`,
      name: `${stageName.split(':')[0].trim()} Process Operating Temperature (°C)`,
      type: 'CPP-candidate',
      linkedCqaIds,
      severity: 4,
      occurrence: 3,
      detectability: 2,
      rpn: 24,
      rationale: 'Temperature influences process kinetics, physical stability, and product quality.',
      criticalFlag: true,
      overrideReason: ''
    },
    {
      id: `${pPrefix}-2`,
      name: 'Key Reagent / Feed Charge Ratio',
      type: 'CPP-candidate',
      linkedCqaIds,
      severity: 4,
      occurrence: 3,
      detectability: 2,
      rpn: 24,
      rationale: 'Controls reagent balance and limits unreacted residual components.',
      criticalFlag: true,
      overrideReason: ''
    },
    {
      id: `${pPrefix}-3`,
      name: 'Process Operation Duration / Hold Time (h)',
      type: 'CPP-candidate',
      linkedCqaIds,
      severity: 3,
      occurrence: 3,
      detectability: 2,
      rpn: 18,
      rationale: 'Hold time impacts product integrity, conversion, and degradation kinetics.',
      criticalFlag: false,
      overrideReason: ''
    },
    {
      id: `${pPrefix}-4`,
      name: 'Mixing & Agitation Intensity (RPM)',
      type: 'CMA-candidate',
      linkedCqaIds,
      severity: 3,
      occurrence: 2,
      detectability: 2,
      rpn: 12,
      rationale: 'Maintains homogeneity and uniform thermal distribution across the process volume.',
      criticalFlag: false,
      overrideReason: ''
    }
  ]
}

/**
 * Checks whether an array of stages matches the obsolete hardcoded 3-stage dummy placeholders.
 */
export function isDefaultDummyStages(
  stagesList: StageItem[] | undefined | null,
  project?: { name?: string; compound?: string } | null
): boolean {
  if (!stagesList || stagesList.length !== 3) return false
  const [s1, s2, s3] = stagesList
  const isDummy =
    (s1?.name?.includes('Coupling Reaction') || s1?.name === 'Stage 1: Coupling Reaction') &&
    (s1?.intermediateProduced === 'Intermediate Int-1' || s1?.intermediateProduced?.includes('Int-1')) &&
    (s2?.name?.includes('Deprotection & Workup') || s2?.name === 'Stage 2: Deprotection & Workup') &&
    (s3?.name?.includes('API Final Crystallization') || s3?.name === 'Stage 3: API Final Crystallization') &&
    (s3?.intermediateProduced === 'Final API (Unmilled)' || s3?.intermediateProduced?.includes('Unmilled'))

  if (!isDummy) return false
  const pStr = `${project?.name || ''} ${project?.compound || ''}`.toLowerCase()
  return !pStr.includes('coupling reaction') && !pStr.includes('int-1')
}

/**
 * Checks whether risk assessment parameters contain outdated morpholine/acetonitrile dummy placeholders
 * when the project compound is NOT Rocuronium Bromide.
 */
export function isDummyRiskParams(
  params: RiskParameter[] | undefined | null,
  project?: { name?: string; compound?: string } | null
): boolean {
  if (!params || params.length === 0) return true
  const pStr = `${project?.name || ''} ${project?.compound || ''}`.toLowerCase()
  if (pStr.includes('rocuronium')) return false
  return params.some(p =>
    p.name.toLowerCase().includes('morpholine') ||
    p.rationale.toLowerCase().includes('morpholine') ||
    p.name.toLowerCase().includes('acetonitrile seed')
  )
}

