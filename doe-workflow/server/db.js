/* =========================================================
   DOE Workflow – Database Layer (SQLite via better-sqlite3)
   db.js
   ========================================================= */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'doe_workflow.db');
const db = new Database(DB_PATH);

// Enable WAL for performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ── Schema ─────────────────────────────────────────────── */
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    compound    TEXT,
    objective   TEXT,
    description TEXT,
    current_step TEXT DEFAULT 'create-project',
    doe_type    TEXT,
    bayes_iteration INTEGER DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS factors (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    unit         TEXT,
    low          REAL NOT NULL,
    high         REAL NOT NULL,
    baseline     REAL,
    factor_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS responses (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    goal         TEXT DEFAULT 'maximize',
    target       TEXT
  );

  CREATE TABLE IF NOT EXISTS experiments (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    run_number     INTEGER NOT NULL,
    run_type       TEXT NOT NULL,
    coded_values   TEXT NOT NULL,
    actual_values  TEXT NOT NULL,
    result_values  TEXT,
    iteration      INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS analysis_results (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    response_idx INTEGER NOT NULL,
    effects      TEXT,
    anova        TEXT,
    regression   TEXT,
    optimum      TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS gp_iterations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    iteration       INTEGER NOT NULL,
    gp_model        TEXT,
    recommended     TEXT,
    ei_score        REAL,
    new_result      TEXT,
    created_at      TEXT DEFAULT (datetime('now'))
  );
`);

/* ── Helpers ────────────────────────────────────────────── */
function touch(projectId) {
  db.prepare(`UPDATE projects SET updated_at = datetime('now') WHERE id = ?`).run(projectId);
}

module.exports = { db, touch };
