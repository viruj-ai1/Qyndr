/* =========================================================
   DOE Workflow – Express Backend Server
   server.js
   ========================================================= */

const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const path       = require('path');

const projectsRouter     = require('./routes/projects');
const doeRouter          = require('./routes/doe');
const analysisRouter     = require('./routes/analysis');
const optimizationRouter = require('./routes/optimization');

const app  = express();
const PORT = process.env.PORT || 3001;

/* ── Middleware ─────────────────────────────────────────── */
app.use(cors({ origin: '*' }));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// Serve frontend static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

/* ── API Routes ─────────────────────────────────────────── */
app.use('/api/projects',     projectsRouter);
app.use('/api/doe',          doeRouter);
app.use('/api/analysis',     analysisRouter);
app.use('/api/optimization', optimizationRouter);

/* ── Health check ───────────────────────────────────────── */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
});

/* ── Catch-all → serve index.html ───────────────────────── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

/* ── Start ──────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║   DOE Workflow Server  – v1.0.0      ║`);
  console.log(`  ║   Viruj Pharma                       ║`);
  console.log(`  ╠══════════════════════════════════════╣`);
  console.log(`  ║   http://localhost:${PORT}              ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});

module.exports = app;
