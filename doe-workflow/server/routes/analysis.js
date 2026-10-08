/* ── routes/analysis.js ──────────────────────────────────── */
const express = require('express');
const router  = express.Router();
const { db }  = require('../db');
const { anova2Level, rsmRegression, optimizeDesirability, contourGrid } = require('../lib/statistics');

// POST /api/analysis/run
// Body: { project_id, response_idx }  (analyse a single response at a time; -1 = all)
router.post('/run', (req, res) => {
  try {
    const { project_id, response_idx = 0 } = req.body;

    const factors   = db.prepare(`SELECT * FROM factors WHERE project_id = ? ORDER BY factor_order`).all(project_id);
    const responses = db.prepare(`SELECT * FROM responses WHERE project_id = ?`).all(project_id);
    const experiments = db.prepare(
      `SELECT * FROM experiments WHERE project_id = ? AND result_values IS NOT NULL ORDER BY run_number`
    ).all(project_id);

    if (!experiments.length) return res.status(400).json({ error: 'no results uploaded yet' });

    const coded  = experiments.map(e => JSON.parse(e.coded_values));
    const k      = factors.length;

    const respIdxs = response_idx === -1
      ? responses.map((_, i) => i)
      : [response_idx];

    const analysisResults = {};

    for (const ri of respIdxs) {
      const resp = responses[ri];
      if (!resp) continue;

      const y = experiments.map(e => {
        const rv = JSON.parse(e.result_values);
        return Array.isArray(rv) ? rv[ri] : rv;
      }).filter(v => v !== null && v !== undefined && !isNaN(v));

      if (y.length < 3) {
        analysisResults[ri] = { error: 'not enough data' };
        continue;
      }

      const codedValid = coded.slice(0, y.length);

      // ANOVA (for 2-level factorial)
      let anovaResult = null;
      const runTypes = experiments.slice(0, y.length).map(e => e.run_type);
      const hasNonCenterOnly = runTypes.some(t => t === 'Factorial' || t === 'Axial');
      if (hasNonCenterOnly) {
        try { anovaResult = anova2Level(codedValid, y); } catch (ex) { anovaResult = { error: ex.message }; }
      }

      // RSM Regression (full quadratic)
      let rsmResult = null;
      if (y.length >= 2 * k + 1) {
        try { rsmResult = rsmRegression(codedValid, y, k); } catch (ex) { rsmResult = { error: ex.message }; }
      }

      analysisResults[ri] = {
        response: resp,
        n: y.length,
        yMean: y.reduce((a, b) => a + b, 0) / y.length,
        yMin: Math.min(...y),
        yMax: Math.max(...y),
        yStd: Math.sqrt(y.reduce((a, v, _, arr) => {
          const m = arr.reduce((s,x)=>s+x,0)/arr.length;
          return a + (v-m)**2;
        }, 0) / (y.length - 1 || 1)),
        anova: anovaResult,
        rsm: rsmResult
      };

      // Store in DB
      db.prepare(`
        INSERT OR REPLACE INTO analysis_results (project_id, response_idx, effects, anova, regression)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        project_id, ri,
        JSON.stringify(anovaResult?.rows || []),
        JSON.stringify(anovaResult || {}),
        JSON.stringify(rsmResult   || {})
      );
    }

    res.json({ analysisResults, factors });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/analysis/optimize
// Body: { project_id }  – multi-response desirability optimization
router.post('/optimize', (req, res) => {
  try {
    const { project_id } = req.body;

    const factors   = db.prepare(`SELECT * FROM factors WHERE project_id = ? ORDER BY factor_order`).all(project_id);
    const responses = db.prepare(`SELECT * FROM responses WHERE project_id = ?`).all(project_id);
    const stored    = db.prepare(`SELECT * FROM analysis_results WHERE project_id = ?`).all(project_id);
    const experiments = db.prepare(
      `SELECT * FROM experiments WHERE project_id = ? AND result_values IS NOT NULL ORDER BY run_number`
    ).all(project_id);

    if (!stored.length) return res.status(400).json({ error: 'run analysis first' });

    const k = factors.length;

    // Build regression models for each response
    const regressionModels = stored.map((s, i) => {
      const reg = JSON.parse(s.regression || '{}');
      const resp = responses[s.response_idx] || responses[i] || {};
      const y = experiments.map(e => {
        const rv = JSON.parse(e.result_values || 'null');
        return Array.isArray(rv) ? rv[s.response_idx] : rv;
      }).filter(v => v !== null && !isNaN(v));

      return {
        beta: reg.coefficients ? reg.coefficients.map(c => c.coeff) : [],
        goal: resp.goal || 'maximize',
        targetVal: parseFloat(resp.target) || null,
        yMin: y.length ? Math.min(...y) : 0,
        yMax: y.length ? Math.max(...y) : 1,
        name: resp.name
      };
    }).filter(m => m.beta.length > 0);

    if (!regressionModels.length) return res.status(400).json({ error: 'no valid regression models' });

    const optimumResult = optimizeDesirability(regressionModels, factors);

    // Store in DB
    db.prepare(`UPDATE analysis_results SET optimum = ? WHERE project_id = ?`)
      .run(JSON.stringify(optimumResult), project_id);

    res.json({ optimum: optimumResult, factors, responses });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/analysis/contour
// Body: { project_id, response_idx, factorX, factorY }
router.post('/contour', (req, res) => {
  try {
    const { project_id, response_idx = 0, factorX = 0, factorY = 1 } = req.body;
    const stored = db.prepare(
      `SELECT * FROM analysis_results WHERE project_id = ? AND response_idx = ?`
    ).get(project_id, response_idx);
    if (!stored) return res.status(400).json({ error: 'no analysis result found' });

    const factors = db.prepare(`SELECT * FROM factors WHERE project_id = ? ORDER BY factor_order`).all(project_id);
    const k = factors.length;
    const reg = JSON.parse(stored.regression || '{}');
    if (!reg.coefficients) return res.status(400).json({ error: 'no regression model' });

    const beta = reg.coefficients.map(c => c.coeff);
    const fixedCoded = new Array(k).fill(0);
    const grid = contourGrid(beta, k, factorX, factorY, fixedCoded, 20);

    // Convert coded levels to actual
    const xActual = grid.levels.map(l => {
      const f = factors[factorX];
      return parseFloat(((f.high + f.low) / 2 + l * (f.high - f.low) / 2).toFixed(3));
    });
    const yActual = grid.levels.map(l => {
      const f = factors[factorY];
      return parseFloat(((f.high + f.low) / 2 + l * (f.high - f.low) / 2).toFixed(3));
    });

    res.json({ xActual, yActual, grid: grid.grid, factorXName: factors[factorX]?.name, factorYName: factors[factorY]?.name });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
