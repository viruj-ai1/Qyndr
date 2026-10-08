/* =========================================================
   Gaussian Process Regression – RBF Kernel
   lib/gaussian-process.js
   ========================================================= */

const math = require('mathjs');

/* ── RBF (Squared Exponential) Kernel ───────────────────── */
// k(x1, x2) = sigmaf² * exp(-0.5 * ||x1-x2||² / l²)
function rbfKernel(x1, x2, lengthScale, sigmaF) {
  const k = x1.length;
  let sqDist = 0;
  for (let i = 0; i < k; i++) {
    sqDist += (x1[i] - x2[i]) ** 2 / (lengthScale[i] ** 2);
  }
  return sigmaF * sigmaF * Math.exp(-0.5 * sqDist);
}

/* ── Kernel matrix ───────────────────────────────────────── */
function kernelMatrix(X1, X2, lengthScale, sigmaF) {
  const K = [];
  for (const x1 of X1) {
    const row = [];
    for (const x2 of X2) {
      row.push(rbfKernel(x1, x2, lengthScale, sigmaF));
    }
    K.push(row);
  }
  return K;
}

/* ── Add jitter/noise to diagonal ────────────────────────── */
function addNoise(K, sigmaN) {
  const n = K.length;
  return K.map((row, i) =>
    row.map((v, j) => (i === j ? v + sigmaN * sigmaN : v))
  );
}

/* ── Fit GP: store training data and compute K⁻¹ · y ─────── */
function fitGP(X, y, params = {}) {
  const n = X.length;
  const k = X[0].length;
  const {
    sigmaF   = 1.0,
    sigmaN   = 0.1,
    lengthScale = new Array(k).fill(1.0)
  } = params;

  const Kraw = kernelMatrix(X, X, lengthScale, sigmaF);
  const K    = addNoise(Kraw, sigmaN);

  let KInv;
  try {
    KInv = math.inv(math.matrix(K)).toArray();
  } catch (e) {
    // Add extra jitter if singular
    const Kjit = K.map((row, i) => row.map((v, j) => (i === j ? v + 1e-4 : v)));
    KInv = math.inv(math.matrix(Kjit)).toArray();
  }

  const alpha = math.multiply(math.matrix(KInv), math.matrix(y)).toArray();
  const yMean = y.reduce((a, b) => a + b, 0) / n;

  return {
    X,
    y,
    alpha,
    KInv,
    sigmaF,
    sigmaN,
    lengthScale,
    yMean,
    yBest: Math.max(...y)
  };
}

/* ── GP Prediction at new points ─────────────────────────── */
function predictGP(model, Xstar) {
  const { X, alpha, KInv, sigmaF, sigmaN, lengthScale } = model;

  const kStar = kernelMatrix(Xstar, X, lengthScale, sigmaF); // [n_star × n_train]
  const kStarStar = kernelMatrix(Xstar, Xstar, lengthScale, sigmaF); // [n_star × n_star]

  const mean = math.multiply(math.matrix(kStar), math.matrix(alpha)).toArray();

  // Variance: diag(k** - k* K⁻¹ k*ᵀ)
  const KInvKStar = math.multiply(math.matrix(KInv), math.transpose(math.matrix(kStar))).toArray();
  const variance  = Xstar.map((_, i) => {
    const kStarStarDiag = kStarStar[i][i] + sigmaN ** 2;
    const v = kStar[i].reduce((sum, k, j) => sum + k * KInvKStar[j][i], 0);
    return Math.max(0, kStarStarDiag - v);
  });

  return {
    mean,
    variance,
    stddev: variance.map(v => Math.sqrt(v))
  };
}

/* ── Log marginal likelihood (for hyperparameter tuning) ── */
function logMarginalLikelihood(X, y, params) {
  const { sigmaF, sigmaN, lengthScale } = params;
  const n = X.length;
  try {
    const Kraw = kernelMatrix(X, X, lengthScale, sigmaF);
    const K    = addNoise(Kraw, sigmaN);
    const Km   = math.matrix(K);
    const KInv = math.inv(Km).toArray();
    const alpha = math.multiply(math.matrix(KInv), math.matrix(y)).toArray();
    const dataFit = -0.5 * y.reduce((sum, yi, i) => sum + yi * alpha[i], 0);
    const logDet = Math.log(Math.abs(math.det(Km)));
    return dataFit - 0.5 * logDet - (n / 2) * Math.log(2 * Math.PI);
  } catch {
    return -Infinity;
  }
}

/* ── Simple auto-tuning: grid search over sigmaF, sigmaN, l ─ */
function autotuneGP(X, y) {
  const k = X[0].length;
  const sigmaFRange   = [0.5, 1.0, 2.0];
  const sigmaNRange   = [0.01, 0.05, 0.1];
  const lRange        = [0.5, 1.0, 1.5];

  let best = -Infinity, bestParams = null;

  for (const sigmaF of sigmaFRange) {
    for (const sigmaN of sigmaNRange) {
      for (const l of lRange) {
        const params = { sigmaF, sigmaN, lengthScale: new Array(k).fill(l) };
        const ll = logMarginalLikelihood(X, y, params);
        if (ll > best) { best = ll; bestParams = params; }
      }
    }
  }

  return bestParams || { sigmaF: 1.0, sigmaN: 0.1, lengthScale: new Array(k).fill(1.0) };
}

/* ── Normalize training data to [0,1] and GP ─────────────── */
function normalizeX(X, factors) {
  return X.map(row =>
    row.map((v, i) => {
      const f = factors[i];
      return (f.high - f.low) > 0 ? (v - f.low) / (f.high - f.low) : 0;
    })
  );
}

/* ── Build and return a fitted + auto-tuned GP model ─────── */
function buildGPModel(experiments, responseIdx, factors) {
  const validRuns = experiments.filter(e => e.result_values);
  if (validRuns.length < 3) return null;

  const X = validRuns.map(e => JSON.parse(e.actual_values));
  const yRaw = validRuns.map(e => {
    const rv = JSON.parse(e.result_values);
    return Array.isArray(rv) ? rv[responseIdx] : rv;
  }).filter(v => v !== null && !isNaN(v));

  if (yRaw.length < 3) return null;

  const Xnorm = normalizeX(X.slice(0, yRaw.length), factors);
  const params = autotuneGP(Xnorm, yRaw);
  const model  = fitGP(Xnorm, yRaw, params);

  return {
    model,
    factors,
    yBest: Math.max(...yRaw),
    nObs: yRaw.length,
    params
  };
}

module.exports = {
  rbfKernel,
  kernelMatrix,
  fitGP,
  predictGP,
  autotuneGP,
  normalizeX,
  buildGPModel
};
