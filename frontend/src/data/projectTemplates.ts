// frontend/src/data/projectTemplates.ts
// Single source of truth for Project Input Templates in Qyndr

export type FieldKey = 'projectName' | 'compound' | 'objective' | 'description'

export interface FieldTemplate {
  label: string
  guidance: string
  template: string
  example: string
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
    example: 'Rocuronium Bromide Stage-I Process Optimization',
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
    example: 'Rocuronium Bromide',
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
    example: 'Maximize Stage-I Intermediate Yield (≥92.0%) and Purity (≥96.5%) while keeping Impurity A ≤0.50% and residual morpholine ≤0.10%.',
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
    example: `Process overview:
Nucleophilic ring-opening & condensation reaction of 2β,3β-epoxy-5α-androstan-17-one with morpholine at 50–60°C in an aqueous/solvent system, followed by quenching, phase partitioning, and controlled crystallization.

Goal / acceptance criteria:
≥ 92.0% molar yield, ≤ 0.20% Impurity A (epoxy-morpholine isomer), ≥ 97.5% HPLC purity, and residual morpholine ≤ 0.10%.

Critical Process Parameters (CPPs) to study:
Reaction Temperature – °C – 45 to 65 °C – setpoint 55 °C
Morpholine Molar Ratio – eq – 1.2 to 1.8 eq – setpoint 1.5 eq
Reaction Time – h – 6 to 12 h – setpoint 9 h
Solvent Volume – L/kg – 6 to 10 L/kg – setpoint 8 L/kg

Critical Quality Attributes (CQAs) / Responses:
Stage-I Intermediate Purity – HPLC-UV (210 nm) – target ≥ 96.5%
Impurity A Content – HPLC-UV (210 nm) – target ≤ 0.50%
Stage-I Reaction Yield – Gravimetric / HPLC Assay – target ≥ 92.0%
Residual Morpholine – GC-FID – target ≤ 0.10%

Known constraints / fixed parameters:
Reaction temperature must not exceed 65°C to avoid thermal degradation of the steroid core.
Morpholine molar ratio capped at 1.8 eq for cost and effluent burden.
Agitation speed fixed at 350 RPM (geometry-matched impeller).

Previous studies / history:
Risk assessment and preliminary screening identified reaction temperature and morpholine charge ratio as CPPs impacting conversion rate and Impurity A kinetics. Extended heating (>12 hours) leads to product degradation.

Analytical methods:
HPLC-UV (210 nm) for assay and organic impurities.
GC-FID with headspace injection for residual morpholine and process solvents.

Regulatory / QbD context:
ICH Q8(R2) Pharmaceutical Development and ICH Q11 Drug Substance Development. Stage-I intermediate quality critical to control downstream final API impurity profile.`,
    tips: [
      'Use the exact section headers shown; the platform parses them for intelligent seeding.',
      'Provide experimental ranges (min to max), not single operating points, for parameters to be studied.',
      'State the chemical or engineering justification for any fixed constraints.',
      'Document known degradation or failure modes from previous lab observations.'
    ]
  }
}

export const FULL_EXAMPLE = {
  name: PROJECT_TEMPLATES.projectName.example,
  compound: PROJECT_TEMPLATES.compound.example,
  objective: PROJECT_TEMPLATES.objective.example,
  description: PROJECT_TEMPLATES.description.example
}

