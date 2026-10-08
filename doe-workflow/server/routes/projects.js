/* ── routes/projects.js ─────────────────────────────────── */
const express = require('express');
const router  = express.Router();
const { db, touch } = require('../db');

// GET /api/projects
router.get('/', (req, res) => {
  try {
    const projects = db.prepare(`SELECT * FROM projects ORDER BY updated_at DESC`).all();
    projects.forEach(p => {
      p.factors   = db.prepare(`SELECT * FROM factors WHERE project_id = ? ORDER BY factor_order`).all(p.id);
      p.responses = db.prepare(`SELECT * FROM responses WHERE project_id = ?`).all(p.id);
      const exps  = db.prepare(`SELECT COUNT(*) as cnt FROM experiments WHERE project_id = ?`).get(p.id);
      p.experimentCount = exps.cnt;
    });
    res.json(projects);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projects
router.post('/', (req, res) => {
  try {
    const { name, compound, objective, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const result = db.prepare(
      `INSERT INTO projects (name, compound, objective, description) VALUES (?, ?, ?, ?)`
    ).run(name, compound || '', objective || '', description || '');
    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json(project);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/projects/:id  (full project with all related data)
router.get('/:id', (req, res) => {
  try {
    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(req.params.id);
    if (!project) return res.status(404).json({ error: 'not found' });
    project.factors     = db.prepare(`SELECT * FROM factors WHERE project_id = ? ORDER BY factor_order`).all(project.id);
    project.responses   = db.prepare(`SELECT * FROM responses WHERE project_id = ?`).all(project.id);
    project.experiments = db.prepare(`SELECT * FROM experiments WHERE project_id = ? ORDER BY run_number`).all(project.id);
    project.gpIterations = db.prepare(`SELECT * FROM gp_iterations WHERE project_id = ? ORDER BY iteration`).all(project.id);
    res.json(project);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/projects/:id  (update fields including step, description, doe_type)
router.put('/:id', (req, res) => {
  try {
    const id = req.params.id;
    const { name, compound, objective, description, current_step, doe_type, bayes_iteration } = req.body;
    const fields = [];
    const vals   = [];
    if (name !== undefined)             { fields.push('name = ?');             vals.push(name); }
    if (compound !== undefined)         { fields.push('compound = ?');         vals.push(compound); }
    if (objective !== undefined)        { fields.push('objective = ?');        vals.push(objective); }
    if (description !== undefined)      { fields.push('description = ?');      vals.push(description); }
    if (current_step !== undefined)     { fields.push('current_step = ?');     vals.push(current_step); }
    if (doe_type !== undefined)         { fields.push('doe_type = ?');         vals.push(doe_type); }
    if (bayes_iteration !== undefined)  { fields.push('bayes_iteration = ?');  vals.push(bayes_iteration); }
    if (!fields.length) return res.status(400).json({ error: 'no fields to update' });
    fields.push("updated_at = datetime('now')");
    vals.push(id);
    db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...vals);
    res.json(db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/projects/:id
router.delete('/:id', (req, res) => {
  try {
    db.prepare(`DELETE FROM projects WHERE id = ?`).run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Factors sub-resource ───────────────────────────────── */
// POST /api/projects/:id/factors  (replace all)
router.post('/:id/factors', (req, res) => {
  try {
    const id = req.params.id;
    const { factors } = req.body;
    db.prepare(`DELETE FROM factors WHERE project_id = ?`).run(id);
    const insert = db.prepare(
      `INSERT INTO factors (project_id, name, unit, low, high, baseline, factor_order) VALUES (?,?,?,?,?,?,?)`
    );
    factors.forEach((f, i) => insert.run(id, f.name, f.unit || '', f.low, f.high, f.baseline ?? ((f.low+f.high)/2), i));
    touch(id);
    res.json(db.prepare(`SELECT * FROM factors WHERE project_id = ? ORDER BY factor_order`).all(id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/projects/:id/responses  (replace all)
router.post('/:id/responses', (req, res) => {
  try {
    const id = req.params.id;
    const { responses } = req.body;
    db.prepare(`DELETE FROM responses WHERE project_id = ?`).run(id);
    const insert = db.prepare(
      `INSERT INTO responses (project_id, name, goal, target) VALUES (?,?,?,?)`
    );
    responses.forEach(r => insert.run(id, r.name, r.goal || 'maximize', r.target || ''));
    touch(id);
    res.json(db.prepare(`SELECT * FROM responses WHERE project_id = ?`).all(id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Results upload ─────────────────────────────────────── */
// POST /api/projects/:id/results  (save result_values for experiments)
router.post('/:id/results', (req, res) => {
  try {
    const id = req.params.id;
    const { results } = req.body; // [{ experiment_id, result_values: [...] }]
    const update = db.prepare(`UPDATE experiments SET result_values = ? WHERE id = ? AND project_id = ?`);
    results.forEach(r => update.run(JSON.stringify(r.result_values), r.experiment_id, id));
    touch(id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ── Add single Bayesian experiment result ───────────────── */
// POST /api/projects/:id/bayes-result
router.post('/:id/bayes-result', (req, res) => {
  try {
    const id = req.params.id;
    const { iteration, result_values, recommended } = req.body;
    db.prepare(`UPDATE gp_iterations SET new_result = ? WHERE project_id = ? AND iteration = ?`)
      .run(JSON.stringify(result_values), id, iteration);
    // Also add as an experiment row
    const proj = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id);
    const factors = db.prepare(`SELECT * FROM factors WHERE project_id = ? ORDER BY factor_order`).all(id);
    const actualVals = recommended.actualValues;
    const expCount = db.prepare(`SELECT MAX(run_number) as m FROM experiments WHERE project_id = ?`).get(id);
    db.prepare(
      `INSERT INTO experiments (project_id, run_number, run_type, coded_values, actual_values, result_values, iteration) VALUES (?,?,?,?,?,?,?)`
    ).run(id, (expCount.m || 0) + 1, 'Bayesian', '[]', JSON.stringify(actualVals), JSON.stringify(result_values), iteration);
    touch(id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
