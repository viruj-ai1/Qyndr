/* ── routes/doe.js ───────────────────────────────────────── */
const express = require('express');
const router  = express.Router();
const { db, touch } = require('../db');
const { recommendDesign, buildExperiments, centralComposite, fractionalFactorial, plackettBurman } = require('../lib/doe-generator');

// POST /api/doe/recommend
// Body: { project_id, phase }  phase: 'screening'|'optimization'
router.post('/recommend', (req, res) => {
  try {
    const { project_id, phase = 'screening' } = req.body;
    const factors = db.prepare(`SELECT * FROM factors WHERE project_id = ? ORDER BY factor_order`).all(project_id);
    if (!factors.length) return res.status(400).json({ error: 'no factors defined' });

    const k = factors.length;

    // Build all options to show
    const options = [];

    if (phase === 'screening') {
      if (k <= 8) {
        const ff = fractionalFactorial(k, false);
        options.push({ key: 'FF', label: 'Fractional Factorial', recommended: k <= 7, ...ff });
        if (k >= 5) {
          const ffSmall = fractionalFactorial(k, true);
          if (ffSmall.factorialRuns < ff.factorialRuns) {
            options.push({ key: 'FF_small', label: 'Fractional Factorial (Smaller)', recommended: false, ...ffSmall });
          }
        }
      }
      const pb = plackettBurman(k);
      options.push({ key: 'PB', label: 'Plackett-Burman', recommended: k >= 8, ...pb });
    } else {
      const ccd_fc = centralComposite(Math.min(k, 5), true);
      options.push({ key: 'CCD_FC', label: 'CCD Face-Centered', recommended: true, ...ccd_fc });
      const ccd_rot = centralComposite(Math.min(k, 5), false);
      if (Math.abs(ccd_rot.alpha - ccd_fc.alpha) > 0.01) {
        options.push({ key: 'CCD_ROT', label: 'CCD Rotatable', recommended: false, ...ccd_rot });
      }
    }

    options.forEach(o => {
      if (!o.totalRuns) o.totalRuns = (o.factorialRuns || 0) + (o.centerPoints || 0);
    });

    res.json({ options, nFactors: k, phase });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/doe/generate
// Body: { project_id, design_key, phase }
router.post('/generate', (req, res) => {
  try {
    const { project_id, design_key, phase = 'screening' } = req.body;
    const factors = db.prepare(`SELECT * FROM factors WHERE project_id = ? ORDER BY factor_order`).all(project_id);
    if (!factors.length) return res.status(400).json({ error: 'no factors defined' });

    const k = factors.length;
    let designResult;

    switch (design_key) {
      case 'FF':       designResult = fractionalFactorial(k, false); break;
      case 'FF_small': designResult = fractionalFactorial(k, true);  break;
      case 'PB':       designResult = plackettBurman(k);             break;
      case 'CCD_FC':   designResult = centralComposite(Math.min(k,5), true);  break;
      case 'CCD_ROT':  designResult = centralComposite(Math.min(k,5), false); break;
      default:
        designResult = phase === 'screening'
          ? fractionalFactorial(k, false)
          : centralComposite(Math.min(k,5), true);
    }

    // Build and store experiments (clear old ones for this iteration)
    const experiments = buildExperiments(designResult, factors);

    // Determine iteration number
    const maxIter = db.prepare(`SELECT MAX(iteration) as m FROM experiments WHERE project_id = ?`).get(project_id);
    const iteration = (maxIter.m ?? -1) + 1;

    // Only clear if starting fresh (iteration 0)
    if (iteration === 0) {
      db.prepare(`DELETE FROM experiments WHERE project_id = ?`).run(project_id);
    }

    const insert = db.prepare(
      `INSERT INTO experiments (project_id, run_number, run_type, coded_values, actual_values, result_values, iteration) VALUES (?,?,?,?,?,?,?)`
    );
    const runs = [];
    experiments.forEach(e => {
      const r = insert.run(project_id, e.run_number, e.run_type, e.coded_values, e.actual_values, null, iteration);
      runs.push({ id: r.lastInsertRowid, ...e });
    });

    // Update project's doe_type
    db.prepare(`UPDATE projects SET doe_type = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(designResult.designType, project_id);

    res.json({
      designInfo: {
        designType: designResult.designType,
        resolution: designResult.resolution,
        description: designResult.description,
        factorialRuns: designResult.factorialRuns,
        axialRuns: designResult.axialRuns || 0,
        centerPoints: designResult.centerPoints,
        totalRuns: runs.length
      },
      experiments: runs.map(e => ({
        id: e.id,
        run_number: e.run_number,
        run_type: e.run_type,
        coded_values: JSON.parse(e.coded_values),
        actual_values: JSON.parse(e.actual_values)
      })),
      factors
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
