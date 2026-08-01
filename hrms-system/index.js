/**
 * BSC Enterprise HRMS - Root Entry Point for Hostinger
 * Entry file: index.js | Root directory: hrms-system
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ── Load env FIRST before any other requires ─────────────────────────────────
const dotenv = require('dotenv');
const SERVER_DIR = path.join(__dirname, 'server');
const APP_ROOT = __dirname;

// Load in priority order (last wins for duplicates, but dotenv never overwrites existing process.env)
dotenv.config({ path: path.join(APP_ROOT, '..', '.env') });
dotenv.config({ path: path.join(APP_ROOT, '.env') });
dotenv.config({ path: path.join(SERVER_DIR, '.env') });

// ── Global Crash Handlers ─────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL uncaughtException]', err.code, err.message);
  // Exit on port in use so Hostinger's process manager can reassign
  if (err.code === 'EADDRINUSE') {
    console.error('[FATAL] Port already in use - exiting so process manager can retry');
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL unhandledRejection]', reason);
});

// ── Load DB pool (now that env is loaded) ─────────────────────────────────────
const pool = require('./server/config/db');
const { autoInitializeDatabase } = require('./server/config/dbInitializer');
const v1Routes = require('./server/routes/v1');
const legacyRoutes = require('./server/routes/api');
const { errorRes } = require('./server/utils/response');
const helmet = require('helmet');

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);

console.log(`[Boot] PORT=${PORT} | NODE_ENV=${process.env.NODE_ENV} | CWD=${process.cwd()}`);
console.log(`[Boot] APP_ROOT=${APP_ROOT} | SERVER_DIR=${SERVER_DIR}`);

// ── Middleware ────────────────────────────────────────────────────────────────
app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static: Uploads ───────────────────────────────────────────────────────────
const uploadsDir = fs.existsSync(path.join(APP_ROOT, '..', 'uploads'))
  ? path.join(APP_ROOT, '..', 'uploads')
  : path.join(APP_ROOT, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch(e) {}
}
app.use('/uploads', express.static(uploadsDir));

// ── Health / Diagnostics ──────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'UP', port: PORT, ts: new Date().toISOString() });
});

app.get(['/db-status', '/api/db-status'], async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [tables] = await conn.query('SHOW TABLES');
    conn.release();
    res.json({ connected: true, tables: tables.length, db: process.env.DB_NAME });
  } catch (err) {
    res.status(500).json({ connected: false, error: err.message });
  }
});

app.get('/api/wipe-db', async (req, res) => {
  const tables = ['candidates','interview_schedules','candidate_activities','hr_evaluations',
    'interview_tokens','selected_candidates','rejected_candidates',
    'selection_offers','onboarding_records','onboarding_items'];
  for (const t of tables) {
    try { await pool.query(`DELETE FROM \`${t}\``); } catch(e) {}
  }
  res.json({ success: true });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1', v1Routes);
app.use('/api', legacyRoutes);

// ── Frontend SPA ──────────────────────────────────────────────────────────────
const distDir = fs.existsSync(path.join(APP_ROOT, 'dist'))
  ? path.join(APP_ROOT, 'dist')
  : null;

if (distDir) {
  console.log(`[Boot] Serving frontend from: ${distDir}`);
  app.use(express.static(distDir));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') ||
        req.path === '/health' || req.path === '/db-status') {
      return next();
    }
    const clean = req.path.replace(/^\//, '').replace(/\/$/, '');
    const tries = [
      path.join(distDir, clean + '.html'),
      path.join(distDir, clean, 'index.html'),
    ];
    for (const p of tries) {
      if (fs.existsSync(p)) return res.sendFile(p);
    }
    const fallback = path.join(distDir, 'index.html');
    if (fs.existsSync(fallback)) return res.sendFile(fallback);
    return next();
  });
} else {
  console.warn('[Boot] WARNING: No dist/ folder found. Run npm run build first.');
}

// ── Error Handlers ────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => errorRes(res, `Not found: ${req.originalUrl}`, [], 404));
app.use((err, req, res, next) => {
  console.error('[Express Error]', err.message);
  errorRes(res, err.message || 'Internal Server Error', [], err.status || 500);
});

// ── DB Init (non-blocking) ────────────────────────────────────────────────────
autoInitializeDatabase(pool)
  .then(() => console.log('[Boot] DB auto-init complete'))
  .catch(err => console.error('[Boot] DB init error:', err.message));

// ── Start Server ──────────────────────────────────────────────────────────────
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  BSC HRMS Server running on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});

server.on('error', (err) => {
  console.error('[Server Error]', err.code, err.message);
  if (err.code === 'EADDRINUSE') {
    console.error(`[FATAL] Port ${PORT} is in use. Exiting.`);
    process.exit(1);
  }
});

module.exports = app;
