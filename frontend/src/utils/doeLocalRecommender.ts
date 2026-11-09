// src/utils/doeLocalRecommender.ts
// Offline algorithmic fallback recommender for DoE designs when backend is offline or unreachable

export interface LocalDoEOption {
  key: string
  label: string
  design_type: string
  resolution: string
  description: string
  n_runs: number
  n_factorial: number
  n_axial?: number
  n_center: number
  recommended: boolean
}

export function getLocalRecommendations(k: number, phase: 'screening' | 'optimization'): LocalDoEOption[] {
  const safeK = Math.max(2, k || 4)
  const options: LocalDoEOption[] = []

  if (phase === 'screening') {
    // 1. DSD (Definitive Screening Design)
    if (safeK >= 3) {
      const dsdRuns = 2 * safeK + (safeK % 2 === 0 ? 1 : 3)
      options.push({
        key: 'DSD',
        label: 'Definitive Screening Design (DSD)',
        design_type: 'Definitive Screening Design (DSD)',
        resolution: 'Unconfounded Main & Quadratic',
        description: `3-level Definitive Screening Design (${dsdRuns} runs for ${safeK} factors). Estimates main effects completely free of 2-factor interactions and identifies curvature.`,
        n_runs: dsdRuns,
        n_factorial: dsdRuns - 1,
        n_center: 1,
        recommended: safeK >= 4
      })
    }

    // 2. Fractional Factorial / Full Factorial
    if (safeK <= 3) {
      const ffRuns = Math.pow(2, safeK)
      options.push({
        key: 'FF',
        label: 'Full Factorial',
        design_type: `2^${safeK} Full Factorial`,
        resolution: 'Resolution Full',
        description: `Full factorial 2-level grid (${ffRuns} runs). All main effects and interactions cleanly estimable.`,
        n_runs: ffRuns,
        n_factorial: ffRuns,
        n_center: 0,
        recommended: safeK <= 3
      })
    } else {
      const fracRuns = safeK === 4 ? 16 : safeK <= 6 ? 16 : 32
      options.push({
        key: 'FF',
        label: 'Fractional Factorial',
        design_type: safeK === 4 ? '2^(4-1) Half Fraction' : `Fractional Factorial 2^(${safeK}-p)`,
        resolution: safeK <= 5 ? 'Resolution IV' : 'Resolution V',
        description: `${fracRuns} runs. Main effects clear of two-factor interactions. Standard classical screening.`,
        n_runs: fracRuns,
        n_factorial: fracRuns,
        n_center: 0,
        recommended: safeK >= 4 && safeK <= 7
      })
    }

    // 3. Plackett-Burman
    const pbRuns = Math.ceil((safeK + 1) / 4) * 4
    options.push({
      key: 'PB',
      label: 'Plackett-Burman',
      design_type: `Plackett-Burman (${pbRuns} runs)`,
      resolution: 'Resolution III (PB)',
      description: `Plackett-Burman design with ${pbRuns} runs for up to ${pbRuns - 1} factors. Highly efficient for rapid screening of vital few CPPs.`,
      n_runs: pbRuns,
      n_factorial: pbRuns,
      n_center: 0,
      recommended: safeK >= 8
    })

    // 4. Taguchi L-Array
    const taguchiRuns = safeK <= 4 ? 8 : safeK <= 7 ? 8 : 16
    options.push({
      key: 'TAGUCHI',
      label: 'Taguchi L-Array',
      design_type: `Taguchi L${taguchiRuns} (${safeK} factors)`,
      resolution: 'Resolution III',
      description: `Taguchi L${taguchiRuns} orthogonal array. Robust design methodology for balancing main effects and noise resistance.`,
      n_runs: taguchiRuns,
      n_factorial: taguchiRuns,
      n_center: 0,
      recommended: false
    })

    // 5. D-Optimal Custom
    const dOptRuns = Math.max(12, safeK * 2 + 4)
    options.push({
      key: 'D_OPTIMAL',
      label: 'D-Optimal / Custom Design',
      design_type: 'D-Optimal Custom Design',
      resolution: 'Custom Constrained',
      description: `D-Optimal algorithmic candidate design (${dOptRuns} runs) respecting boundary constraints and operating regions.`,
      n_runs: dOptRuns,
      n_factorial: dOptRuns,
      n_center: 0,
      recommended: false
    })

  } else {
    // Optimization / RSM phase
    // 1. Box-Behnken (BBD)
    if (safeK >= 3 && safeK <= 7) {
      const bbdRuns = safeK === 3 ? 15 : safeK === 4 ? 27 : safeK === 5 ? 46 : 54
      options.push({
        key: 'BBD',
        label: 'Box-Behnken',
        design_type: `Box-Behnken (${bbdRuns} runs)`,
        resolution: 'RSM – Full Quadratic Model',
        description: `Box-Behnken design for ${safeK} factors with center points. Spherical geometry avoids harsh corner extremes, protecting sensitive reaction conditions.`,
        n_runs: bbdRuns,
        n_factorial: bbdRuns - 3,
        n_center: 3,
        recommended: safeK >= 3 && safeK <= 5
      })
    }

    // 2. CCD Face-Centered
    const ccdK = Math.min(safeK, 6)
    const ccdFact = Math.pow(2, ccdK)
    const ccdAxial = 2 * ccdK
    const ccdTotal = ccdFact + ccdAxial + 3
    options.push({
      key: 'CCD_FC',
      label: 'CCD Face-Centered',
      design_type: 'CCD Face-Centered',
      resolution: 'RSM – Full Quadratic Model',
      description: `Central Composite Design with ${ccdFact} factorial, ${ccdAxial} axial (α=1.0), and 3 center runs. Fits full second-order response surface strictly inside factor limits.`,
      n_runs: ccdTotal,
      n_factorial: ccdFact,
      n_axial: ccdAxial,
      n_center: 3,
      recommended: true
    })

    // 3. CCD Rotatable
    options.push({
      key: 'CCD_ROT',
      label: 'CCD Rotatable',
      design_type: `CCD Rotatable (α=${Number(Math.pow(ccdFact, 0.25)).toFixed(2)})`,
      resolution: 'RSM – Full Quadratic Model',
      description: `Rotatable Central Composite Design with constant prediction variance at equal distances from center.`,
      n_runs: ccdTotal,
      n_factorial: ccdFact,
      n_axial: ccdAxial,
      n_center: 3,
      recommended: false
    })

    // 4. D-Optimal Custom
    const dOptRuns = Math.max(16, safeK * 3 + 4)
    options.push({
      key: 'D_OPTIMAL',
      label: 'D-Optimal / Custom Design',
      design_type: 'D-Optimal Custom Design',
      resolution: 'Custom Constrained',
      description: `Computer-generated quadratic RSM candidate design (${dOptRuns} runs) optimizing determinant |X^T X| under constrained run budgets.`,
      n_runs: dOptRuns,
      n_factorial: dOptRuns,
      n_center: 3,
      recommended: safeK >= 6
    })
  }

  return options
}
