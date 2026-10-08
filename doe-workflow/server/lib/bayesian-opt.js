/* =========================================================
   Bayesian Optimization – Expected Improvement Acquisition
   lib/bayesian-opt.js
   ========================================================= */

const { predictGP, normalizeX } = require('./gaussian-process');
const { normcdf } = require('./statistics');

/* ── Standard Normal PDF ─────────────────────────────────── */
function normpdf(z) {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/* ── Expected Improvement ─────────────────────────────────── */
// EI(x) = (μ(x) - f_best - ξ) · Φ(Z) + σ(x) · φ(Z)
// Z = (μ(x) - f_best - ξ) / σ(x)
function expectedImprovement(mu, sigma, fBest, xi = 0.01) {
  if (sigma < 1e-8) return 0;
  const Z = (mu - fBest - xi) / sigma;
  return (mu - fBest - xi) * normcdf(Z) + sigma * normpdf(Z);
}

/* ── Grid search for next experiment ─────────────────────── */
function findNextExperiment(gpBundle, factors, nGrid = 15) {
  const { model, yBest } = gpBundle;
  const k = factors.length;

  // Create grid in normalized space
  const levels = Array.from({ length: nGrid }, (_, i) => i / (nGrid - 1));

  let bestEI = -Infinity;
  let bestNorm = null;

  // Iterate over grid (recursive for arbitrary k)
  function gridSearch(current, dim) {
    if (dim === k) {
      const pred = predictGP(model, [current]);
      const mu   = pred.mean[0];
      const sig  = pred.stddev[0];
      const ei   = expectedImprovement(mu, sig, yBest);
      if (ei > bestEI) {
        bestEI   = ei;
        bestNorm = [...current];
      }
      return;
    }
    for (const lv of levels) {
      current[dim] = lv;
      gridSearch(current, dim + 1);
    }
  }

  gridSearch(new Array(k).fill(0), 0);

  if (!bestNorm) return null;

  // Decode back to actual values
  const actualValues = bestNorm.map((norm, i) => {
    const f = factors[i];
    return parseFloat((f.low + norm * (f.high - f.low)).toFixed(4));
  });

  // Get GP prediction at best point
  const pred = predictGP(model, [bestNorm]);

  return {
    normalizedPoint: bestNorm,
    actualValues,
    expectedImprovement: bestEI,
    predictedMean:   pred.mean[0],
    predictedStddev: pred.stddev[0],
    confidence95:    [
      pred.mean[0] - 1.96 * pred.stddev[0],
      pred.mean[0] + 1.96 * pred.stddev[0]
    ]
  };
}

/* ── EI surface for a 2D slice (visualization) ───────────── */
function eiSurface(gpBundle, factors, factorIdxX, factorIdxY, fixedNorm, nGrid = 20) {
  const { model, yBest } = gpBundle;
  const k = factors.length;
  const levels = Array.from({ length: nGrid }, (_, i) => i / (nGrid - 1));

  const eiGrid = [];
  const muGrid = [];
  const sigGrid = [];

  for (const xi of levels) {
    const eiRow = [], muRow = [], sigRow = [];
    for (const yi of levels) {
      const pt = [...fixedNorm];
      pt[factorIdxX] = xi;
      pt[factorIdxY] = yi;
      const pred = predictGP(model, [pt]);
      const mu   = pred.mean[0];
      const sig  = pred.stddev[0];
      eiRow.push(expectedImprovement(mu, sig, yBest));
      muRow.push(mu);
      sigRow.push(sig);
    }
    eiGrid.push(eiRow);
    muGrid.push(muRow);
    sigGrid.push(sigRow);
  }

  // Convert factor axes to actual values
  const xActual = levels.map(l => parseFloat((factors[factorIdxX].low + l * (factors[factorIdxX].high - factors[factorIdxX].low)).toFixed(3)));
  const yActual = levels.map(l => parseFloat((factors[factorIdxY].low + l * (factors[factorIdxY].high - factors[factorIdxY].low)).toFixed(3)));

  return { levels, xActual, yActual, eiGrid, muGrid, sigGrid };
}

/* ── GP posterior along 1D slice through best point ─────── */
// Used to visualize the fitted GP for a single factor
function gp1DSlice(gpBundle, factors, factorIdx, nGrid = 40) {
  const { model, yBest } = gpBundle;
  const k = factors.length;
  const midpoint = new Array(k).fill(0.5); // center of normalized space

  const levels = Array.from({ length: nGrid }, (_, i) => i / (nGrid - 1));
  const points = levels.map(l => {
    const pt = [...midpoint];
    pt[factorIdx] = l;
    return pt;
  });

  const pred = predictGP(model, points);
  const xActual = levels.map(l =>
    parseFloat((factors[factorIdx].low + l * (factors[factorIdx].high - factors[factorIdx].low)).toFixed(3))
  );

  return {
    x: xActual,
    mean: pred.mean,
    upper: pred.mean.map((m, i) => m + 1.96 * pred.stddev[i]),
    lower: pred.mean.map((m, i) => m - 1.96 * pred.stddev[i]),
    yBest
  };
}

module.exports = {
  expectedImprovement,
  findNextExperiment,
  eiSurface,
  gp1DSlice
};
