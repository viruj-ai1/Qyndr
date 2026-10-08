/* ── routes/optimization.js ──────────────────────────────── */
const express = require('express');
const router  = express.Router();
const { db, touch } = require('../db');
const { buildGPModel } = require('../lib/gaussian-process');
const { findNextExperiment, eiSurface, gp1DSlice } = require('../lib/bayesian-opt');

// POST /api/optimization/gp/fit
// Body: { project_id, response_idx }
router.post('/gp/fit', (req, res) => {
  try {
    const { project_id, response_idx = 0 } = req.body;

    const factors = db.prepare(`SELECT * FROM factors WHERE project_id = ? ORDER BY factor_order`).all(project_id);
    const experiments = db.prepare(
      `SELECT * FROM experiments WHERE project_id = ? ORDER BY run_number`
    ).all(project_id);

    const gpBundle = buildGPModel(experiments, response_idx, factors);
    if (!gpBundle) return res.status(400).json({ error: 'Not enough data to fit GP (need ≥3 runs with results)' });

    res.json({
      nObs:    gpBundle.nObs,
      yBest:   gpBundle.yBest,
      params:  gpBundle.params,
      summary: {
        sigmaF:      gpBundle.params.sigmaF,
        sigmaN:      gpBundle.params.sigmaN,
        lengthScale: gpBundle.params.lengthScale
      }
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/optimization/bayesian/recommend
// Body: { project_id, response_idx }
router.post('/bayesian/recommend', (req, res) => {
  try {
    const { project_id, response_idx = 0 } = req.body;

    const factors = db.prepare(`SELECT * FROM factors WHERE project_id = ? ORDER BY factor_order`).all(project_id);
    const experiments = db.prepare(
      `SELECT * FROM experiments WHERE project_id = ?  ORDER BY run_number`
    ).all(project_id);

    const gpBundle = buildGPModel(experiments, response_idx, factors);
    if (!gpBundle) return res.status(400).json({ error: 'GP model could not be built' });

    const recommendation = findNextExperiment(gpBundle, factors, 12);
    if (!recommendation) return res.status(500).json({ error: 'Optimization search failed' });

    // Store in gp_iterations table
    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(project_id);
    const iteration = (project.bayes_iteration || 0);
    db.prepare(`
      INSERT OR REPLACE INTO gp_iterations (project_id, iteration, gp_model, recommended, ei_score)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      project_id,
      iteration,
      JSON.stringify({ nObs: gpBundle.nObs, params: gpBundle.params }),
      JSON.stringify(recommendation),
      recommendation.expectedImprovement
    );

    // Get 1D slice for primary factor (factor with highest marginal EI range)
    const slices = factors.map((_, idx) =>
      gp1DSlice(gpBundle, factors, idx, 30)
    );

    // EI surface for first two factors
    const fixedNorm = new Array(factors.length).fill(0.5);
    const surface = factors.length >= 2
      ? eiSurface(gpBundle, factors, 0, 1, fixedNorm, 15)
      : null;

    res.json({
      recommendation,
      iteration,
      gpSummary: { nObs: gpBundle.nObs, yBest: gpBundle.yBest, params: gpBundle.params },
      slices,
      surface,
      factors
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/optimization/final
// Body: { project_id, response_idx }
router.post('/final', (req, res) => {
  try {
    const { project_id, response_idx = 0 } = req.body;

    const factors = db.prepare(`SELECT * FROM factors WHERE project_id = ? ORDER BY factor_order`).all(project_id);
    const experiments = db.prepare(
      `SELECT * FROM experiments WHERE project_id = ? ORDER BY run_number`
    ).all(project_id);
    const responses = db.prepare(`SELECT * FROM responses WHERE project_id = ?`).all(project_id);

    const gpBundle = buildGPModel(experiments, response_idx, factors);
    if (!gpBundle) return res.status(400).json({ error: 'not enough data' });

    // Find global maximum of GP posterior mean
    const recommendation = findNextExperiment(gpBundle, factors, 15);

    // Find actual best observed experiment
    const validExps = experiments.filter(e => e.result_values);
    let bestObs = null, bestVal = -Infinity;
    for (const e of validExps) {
      const rv = JSON.parse(e.result_values);
      const val = Array.isArray(rv) ? rv[response_idx] : rv;
      if (val !== null && !isNaN(val) && val > bestVal) {
        bestVal = val;
        bestObs = { ...e, val };
      }
    }

    const resp = responses[response_idx];
    const improvement = gpBundle.nObs >= 2 ? ((gpBundle.yBest / (gpBundle.model.y[0] || gpBundle.yBest)) - 1) * 100 : 0;

    res.json({
      factors,
      response: resp,
      finalOptimum: {
        actualValues: recommendation ? recommendation.actualValues : (bestObs ? JSON.parse(bestObs.actual_values) : null),
        predictedMean: recommendation ? recommendation.predictedMean : bestVal,
        confidence95: recommendation ? recommendation.confidence95 : null
      },
      bestObserved: bestObs ? {
        runNumber: bestObs.run_number,
        actualValues: JSON.parse(bestObs.actual_values),
        resultValue: bestObs.val
      } : null,
      nObs: gpBundle.nObs,
      improvement: parseFloat(improvement.toFixed(1))
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
