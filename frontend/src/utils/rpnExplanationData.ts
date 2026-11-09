// src/utils/rpnExplanationData.ts
// Pharmaceutical FMEA / ICH Q9 Risk Priority Number (RPN) Explanations and Scale Definitions

export interface ScoreLevel {
  score: number
  label: string
  color: string
}

export interface FactorScale {
  dimension: 'Severity (S)' | 'Occurrence (O)' | 'Detectability (D)'
  code: 'S' | 'O' | 'D'
  question: string
  description: string
  levels: ScoreLevel[]
}

export const RPN_DIMENSIONS: FactorScale[] = [
  {
    dimension: 'Severity (S)',
    code: 'S',
    question: 'How badly would a parameter deviation hurt a CQA or the patient?',
    description: '1 = negligible impact, 3 = moderate (CQA near its limit), 5 = critical (fails spec or affects safety).',
    levels: [
      { score: 1, label: 'Negligible', color: '#10b981' },
      { score: 2, label: 'Minor', color: '#34d399' },
      { score: 3, label: 'Moderate', color: '#f59e0b' },
      { score: 4, label: 'Major', color: '#f97316' },
      { score: 5, label: 'Critical', color: '#ef4444' }
    ]
  },
  {
    dimension: 'Occurrence (O)',
    code: 'O',
    question: 'How likely is the deviation to happen in routine operations?',
    description: '1 = rare / well-controlled, 3 = occasional, 5 = frequent or intrinsically difficult to control.',
    levels: [
      { score: 1, label: 'Rare', color: '#10b981' },
      { score: 2, label: 'Low', color: '#34d399' },
      { score: 3, label: 'Occasional', color: '#f59e0b' },
      { score: 4, label: 'Frequent', color: '#f97316' },
      { score: 5, label: 'Persistent', color: '#ef4444' }
    ]
  },
  {
    dimension: 'Detectability (D)',
    code: 'D',
    question: 'How likely are we to catch the deviation BEFORE it affects the batch?',
    description: '1 = almost certain (automated inline IPC), 5 = very unlikely (offline or end-product test only). High D is bad.',
    levels: [
      { score: 1, label: 'Certain', color: '#10b981' },
      { score: 2, label: 'High', color: '#34d399' },
      { score: 3, label: 'Moderate', color: '#f59e0b' },
      { score: 4, label: 'Low', color: '#f97316' },
      { score: 5, label: 'Undetected', color: '#ef4444' }
    ]
  }
]

export const RPN_GUIDE_CONTENT = {
  title: 'How RPN decides criticality',
  whatIsRpn: 'Risk Priority Number from FMEA (Failure Mode and Effects Analysis), a standard risk assessment methodology recognized under ICH Q9. It quantifies and ranks which process parameters deserve prioritized investigation in experimental design.',
  formula: 'RPN = Severity (S) × Occurrence (O) × Detectability (D). Range: 1 to 125.',
  cutoffExplanation: (cutoff: number) =>
    `In this app, parameter criticality is governed by the preset risk matrix and the live RPN cutoff (${cutoff}). Parameters flagged CRITICAL are prioritized as Critical Process Parameter (CPP) candidates for DoE experiments, while Non-Critical variables are held constant at validated setpoints. You can also manually toggle any row's status badge.`,
  goodToKnow: [
    'A high severity (S ≥ 4 or 5) alone often justifies treating a parameter as critical in pharma QbD, even if O and D are low.',
    'Scores should be derived from prior chemical knowledge, platform experience, and cross-functional team consensus, and should be revisited after DoE results.',
    'CPP/CMA flags here represent candidates; definitive criticality is confirmed after experimental verification (ICH Q8(R2), Q9).'
  ]
}
