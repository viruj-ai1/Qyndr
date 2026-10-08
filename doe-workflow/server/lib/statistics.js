/* =========================================================
   Statistical Analysis – Effects, ANOVA, Regression, RSM
   lib/statistics.js
   ========================================================= */

const math = require('mathjs');

/* ── Normal CDF approximation (Abramowitz & Stegun) ─────── */
function normcdf(z) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

/* ── F-distribution p-value (upper tail) approximation ──── */
function fpval(F, df1, df2) {
  if (!isFinite(F) || F <= 0) return 1;
  // Wilson-Hilferty cube root transformation → standard normal approximation
  const d1 = df1, d2 = df2;
  const h = 2 / 9;
  const h1 = h / d1, h2 = h / d2;
  const z = (Math.pow(F, 1 / 3) * (1 - h2) - (1 - h1)) /
    Math.sqrt(h1 * Math.pow(F, 2 / 3) + h2);
  return 1 - normcdf(z);
}

/* ── Main effects (2-level factorial) ───────────────────── */
// coded: matrix rows of coded values (+1/-1), y: vector of responses
function mainEffects(coded, y) {
  const n = coded.length;
  const k = coded[0].length;
  const effects = {};

  for (let j = 0; j < k; j++) {
    const high = [], low = [];
    for (let i = 0; i < n; i++) {
      if (coded[i][j] === 1)  high.push(y[i]);
      else                    low.push(y[i]);
    }
    const avgHigh = high.reduce((a, b) => a + b, 0) / (high.length || 1);
    const avgLow  = low.reduce((a, b) => a + b, 0)  / (low.length  || 1);
    effects[`X${j + 1}`] = avgHigh - avgLow;
  }
  return effects;
}

/* ── Two-factor interaction effects ─────────────────────── */
function interactionEffects(coded, y, k) {
  const n = coded.length;
  const effects = {};
  for (let j1 = 0; j1 < k - 1; j1++) {
    for (let j2 = j1 + 1; j2 < k; j2++) {
      let sumPlus = 0, nPlus = 0, sumMinus = 0, nMinus = 0;
      for (let i = 0; i < n; i++) {
        const prod = coded[i][j1] * coded[i][j2];
        if (prod > 0) { sumPlus += y[i]; nPlus++; }
        else          { sumMinus += y[i]; nMinus++; }
      }
      effects[`X${j1 + 1}:X${j2 + 1}`] = (sumPlus / (nPlus || 1)) - (sumMinus / (nMinus || 1));
    }
  }
  return effects;
}

/* ── ANOVA for 2-level factorial ────────────────────────── */
function anova2Level(coded, y) {
  const n = coded.length;
  const k = coded[0].length;
  const yMean = y.reduce((a, b) => a + b, 0) / n;

  const ssTotal = y.reduce((a, v) => a + (v - yMean) ** 2, 0);
  const effects  = mainEffects(coded, y);
  const inter    = interactionEffects(coded, y, k);
  const allEffects = { ...effects, ...inter };

  const rows = [];
  let ssModel = 0;

  // For pure error, use center points if available
  const centerIdxs = coded.reduce((arr, row, i) => {
    if (row.every(v => v === 0)) arr.push(i);
    return arr;
  }, []);
  let ssPureError = 0, dfPureError = 0;
  if (centerIdxs.length >= 2) {
    const cy = centerIdxs.map(i => y[i]);
    const cMean = cy.reduce((a, b) => a + b, 0) / cy.length;
    ssPureError = cy.reduce((a, v) => a + (v - cMean) ** 2, 0);
    dfPureError = cy.length - 1;
  }

  for (const [term, eff] of Object.entries(allEffects)) {
    const factRuns = coded.filter(r => !r.every(v => v === 0)).length;
    const SS = factRuns > 0 ? (factRuns * eff * eff) / 4 : 0;
    ssModel += SS;
    rows.push({ term, effect: eff, SS, df: 1, MS: SS });
  }

  const ssResidual = ssTotal - ssModel;
  const dfModel    = rows.length;
  const dfResidual = Math.max(n - dfModel - 1, 1);
  const dfResEff   = dfPureError > 0 ? dfPureError : dfResidual;
  const msPureError = dfResEff > 0 ? (ssPureError || ssResidual) / dfResEff : 1;

  rows.forEach(r => {
    r.F = r.MS / (msPureError || 1);
    r.pValue = fpval(r.F, 1, dfResEff);
    r.significant = r.pValue < 0.05;
  });

  rows.sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect));

  const R2 = ssTotal > 0 ? ssModel / ssTotal : 0;
  return {
    rows,
    ssTotal,
    ssModel,
    ssResidual,
    dfModel,
    dfResidual,
    R2,
    yMean,
    msPureError
  };
}

/* ── Build RSM design matrix ─────────────────────────────── */
// Includes: 1, x1..xk, x1²..xk², x1x2..x(k-1)xk
function buildRSMMatrix(coded, k) {
  return coded.map(row => {
    const terms = [1];                                          // intercept
    for (let j = 0; j < k; j++) terms.push(row[j]);           // linear
    for (let j = 0; j < k; j++) terms.push(row[j] * row[j]); // quadratic
    for (let j1 = 0; j1 < k - 1; j1++) {                      // interactions
      for (let j2 = j1 + 1; j2 < k; j2++) {
        terms.push(row[j1] * row[j2]);
      }
    }
    return terms;
  });
}

/* ── Ordinary Least Squares ─────────────────────────────── */
function OLS(X, y) {
  try {
    const Xm = math.matrix(X);
    const ym = math.matrix(y);
    const Xt = math.transpose(Xm);
    const XtX = math.multiply(Xt, Xm);
    const XtXinv = math.inv(XtX);
    const XtY = math.multiply(Xt, ym);
    const beta = math.multiply(XtXinv, XtY);
    const yPred = math.multiply(Xm, beta).toArray();
    const yMean = y.reduce((a, b) => a + b, 0) / y.length;
    const ssRes = y.reduce((a, v, i) => a + (v - yPred[i]) ** 2, 0);
    const ssTot = y.reduce((a, v) => a + (v - yMean) ** 2, 0);
    const R2 = 1 - ssRes / ssTot;
    return {
      beta: beta.toArray(),
      yPred,
      R2: Math.max(0, R2),
      ssRes,
      converged: true
    };
  } catch (e) {
    return { beta: [], yPred: y, R2: 0, ssRes: 0, converged: false, error: e.message };
  }
}

/* ── RSM Regression ──────────────────────────────────────── */
function rsmRegression(coded, y, k) {
  const X = buildRSMMatrix(coded, k);
  const result = OLS(X, y);

  // Build term names
  const termNames = ['intercept'];
  for (let j = 0; j < k; j++) termNames.push(`X${j + 1}`);
  for (let j = 0; j < k; j++) termNames.push(`X${j + 1}²`);
  for (let j1 = 0; j1 < k - 1; j1++) {
    for (let j2 = j1 + 1; j2 < k; j2++) {
      termNames.push(`X${j1 + 1}·X${j2 + 1}`);
    }
  }

  const n = y.length;
  const p = result.beta.length;
  const mse = result.ssRes / Math.max(n - p, 1);
  const XtX = math.multiply(
    math.transpose(math.matrix(X)),
    math.matrix(X)
  );
  const XtXinv = math.inv(XtX);

  const se = result.beta.map((_, i) => Math.sqrt(mse * (XtXinv.get([i, i]) || 0)));
  const tVals = result.beta.map((b, i) => b / (se[i] || 1));
  const pVals = tVals.map(t => 2 * (1 - normcdf(Math.abs(t))));

  const coefficients = result.beta.map((b, i) => ({
    term: termNames[i] || `term${i}`,
    coeff: b,
    se: se[i],
    tValue: tVals[i],
    pValue: pVals[i],
    significant: pVals[i] < 0.05
  }));

  return {
    coefficients,
    R2: result.R2,
    yPred: result.yPred,
    converged: result.converged
  };
}

/* ── Predict from RSM model at a point ──────────────────── */
function predictRSM(beta, xPoint, k) {
  const terms = [1];
  for (let j = 0; j < k; j++) terms.push(xPoint[j]);
  for (let j = 0; j < k; j++) terms.push(xPoint[j] * xPoint[j]);
  for (let j1 = 0; j1 < k - 1; j1++) {
    for (let j2 = j1 + 1; j2 < k; j2++) {
      terms.push(xPoint[j1] * xPoint[j2]);
    }
  }
  return terms.reduce((sum, t, i) => sum + (beta[i] || 0) * t, 0);
}

/* ── Desirability-based optimization ─────────────────────── */
// responses: [{ name, goal, target, beta, k }]
// goal: 'maximize'|'minimize'|'target'
function optimizeDesirability(regressionModels, factors, nGrid = 11) {
  const k = factors.length;
  const levels = Array.from({ length: nGrid }, (_, i) => -1 + (2 * i) / (nGrid - 1));

  // Grid search in coded space
  let bestDesirability = -Infinity;
  let bestPoint = null;
  let bestPredicted = [];

  function gridSearch(current, dim) {
    if (dim === k) {
      const preds = regressionModels.map(m => predictRSM(m.beta, current, k));
      const desirs = regressionModels.map((m, i) => {
        const pred = preds[i];
        const yMin = m.yMin, yMax = m.yMax;
        if (m.goal === 'maximize') return yMax > yMin ? (pred - yMin) / (yMax - yMin) : 0;
        if (m.goal === 'minimize') return yMax > yMin ? (yMax - pred) / (yMax - yMin) : 0;
        // target
        const tgt = m.targetVal;
        return tgt ? Math.max(0, 1 - Math.abs(pred - tgt) / (yMax - yMin || 1)) : 0;
      });
      const composite = Math.pow(
        desirs.reduce((p, d) => p * Math.max(0, d), 1),
        1 / regressionModels.length
      );
      if (composite > bestDesirability) {
        bestDesirability = composite;
        bestPoint = [...current];
        bestPredicted = [...preds];
      }
      return;
    }
    for (const lv of levels) {
      current[dim] = lv;
      gridSearch(current, dim + 1);
    }
  }

  gridSearch(new Array(k).fill(0), 0);

  // Decode bestPoint to actual values
  const actualOptimum = bestPoint.map((coded, i) => {
    const f = factors[i];
    const center = (f.high + f.low) / 2;
    const halfRange = (f.high - f.low) / 2;
    return parseFloat((center + coded * halfRange).toFixed(4));
  });

  return {
    codedOptimum: bestPoint,
    actualOptimum,
    predictedResponses: bestPredicted,
    compositeDesirability: bestDesirability
  };
}

/* ── Generate contour grid for RSM surface ───────────────── */
function contourGrid(beta, k, factorIdxX, factorIdxY, fixedCoded, nGrid = 20) {
  const levels = Array.from({ length: nGrid }, (_, i) => -1 + (2 * i) / (nGrid - 1));
  const grid = [];
  for (const xi of levels) {
    const row = [];
    for (const yi of levels) {
      const pt = [...fixedCoded];
      pt[factorIdxX] = xi;
      pt[factorIdxY] = yi;
      row.push(predictRSM(beta, pt, k));
    }
    grid.push(row);
  }
  return { levels, grid };
}

module.exports = {
  mainEffects,
  interactionEffects,
  anova2Level,
  rsmRegression,
  predictRSM,
  optimizeDesirability,
  contourGrid,
  normcdf
};
