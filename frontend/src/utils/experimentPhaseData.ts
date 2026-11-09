// src/utils/experimentPhaseData.ts
// Pharmaceutical & QbD Reference descriptions for Experiment Phases (Screening vs Optimization/RSM)

export interface PhaseInfo {
  key: 'screening' | 'optimization'
  title: string
  subtitle: string
  purpose: string
  useWhen: string
  youGet: string
  notFor: string
  designs: string
}

export const EXPERIMENT_PHASES: Record<'screening' | 'optimization', PhaseInfo> = {
  screening: {
    key: 'screening',
    title: 'Screening',
    subtitle: 'Identify key factors (Definitive Screening, Fractional, PB)',
    purpose: 'Find the few factors that really matter out of many candidates, using as few runs as possible.',
    useWhen: 'Early in development, with many possible factors (about 4–12) and little prior knowledge.',
    youGet: 'Which factors (and sometimes interactions) have a significant effect on your responses.',
    notFor: 'Finding the exact optimum. Follow up with Optimization on the important factors.',
    designs: 'Definitive Screening, Fractional Factorial, Plackett-Burman.'
  },
  optimization: {
    key: 'optimization',
    title: 'Optimization / RSM',
    subtitle: 'Model response surfaces (CCD, BBD, D-Optimal)',
    purpose: 'Build a mathematical model of how factors affect responses (a response surface) to locate the best operating conditions.',
    useWhen: 'You already know the key factors (typically 2–5) and want to find the optimum or define a design space.',
    youGet: 'A model with curvature and interactions, contour/surface plots, and a design space supporting ICH Q8(R2).',
    notFor: 'Sorting through a large list of unknown factors. Screen first.',
    designs: 'Central Composite (CCD), Box-Behnken (BBD), D-Optimal.'
  }
}
