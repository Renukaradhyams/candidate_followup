/**
 * BSC Enterprise HRMS - Entry Point
 * PassengerStartupFile: index.js | PassengerAppRoot: hrms-system/
 *
 * IMPORTANT: With Phusion Passenger (Hostinger), do NOT call app.listen().
 * Passenger calls listen() internally via its own socket.
 * Just export `module.exports = app` and Passenger handles everything.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const helmet = require('helmet');

// ── Directory References ──────────────────────────────────────────────────────
const APP_ROOT = __dirname;               // hrms-system/
const SERVER_DIR = path.join(APP_ROOT, 'server');

// ── Load .env as fallback only — Passenger/Hostinger env vars take priority ──
// dotenv.config() NEVER overwrites already-set process.env values
dotenv.config({ path: path.join(APP_ROOT, '..', '.env') });
dotenv.config({ path: path.join(APP_ROOT, '.env') });
dotenv.config({ path: path.join(SERVER_DIR, '.env') });

// ── Global Crash Handlers ─────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err.code, err.message);
  if (err.code === 'EADDRINUSE') {
    console.error('[FATAL] Port in use - exiting');
    process.exit(1);
  }
});
process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL] Unhandled Rejection:', reason);
});

// ── Load modules (env must be loaded first) ───────────────────────────────────
const pool = require('./server/config/db');
const { autoInitializeDatabase } = require('./server/config/dbInitializer');
const v1Routes = require('./server/routes/v1');
const legacyRoutes = require('./server/routes/api');
const { errorRes } = require('./server/utils/response');

// ── Express App Setup ─────────────────────────────────────────────────────────
const app = express();

console.log(`[Boot] NODE_ENV=${process.env.NODE_ENV} | DB=${process.env.DB_NAME} | PORT=${process.env.PORT || '(Passenger-managed)'}`);

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static: Uploads ───────────────────────────────────────────────────────────
const uploadsDir = fs.existsSync(path.join(APP_ROOT, '..', 'uploads'))
  ? path.join(APP_ROOT, '..', 'uploads')
  : path.join(APP_ROOT, 'uploads');
try { if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true }); } catch(e) {}
app.use('/uploads', express.static(uploadsDir));

// ── Health / Diagnostics ──────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'UP', ts: new Date().toISOString(), db: process.env.DB_NAME });
});

app.get(['/db-status', '/api/db-status'], async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [rows] = await conn.query('SHOW TABLES');
    conn.release();
    res.json({ connected: true, tables: rows.length });
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
const distDir = path.join(APP_ROOT, 'dist');
if (fs.existsSync(distDir)) {
  console.log(`[Boot] Serving frontend from: ${distDir}`);
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') ||
        req.path === '/health' || req.path === '/db-status') return next();
    const clean = req.path.replace(/^\//, '').replace(/\/$/, '');
    for (const p of [path.join(distDir, clean + '.html'), path.join(distDir, clean, 'index.html')]) {
      if (fs.existsSync(p)) return res.sendFile(p);
    }
    const fallback = path.join(distDir, 'index.html');
    if (fs.existsSync(fallback)) return res.sendFile(fallback);
    return next();
  });
} else {
  console.warn('[Boot] No dist/ folder - run npm run build');
}

// ── Error Handlers ────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => errorRes(res, `Not found: ${req.originalUrl}`, [], 404));
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  errorRes(res, err.message || 'Internal Server Error', [], err.status || 500);
});

// ── DB Init (async, non-blocking) ─────────────────────────────────────────────
autoInitializeDatabase(pool)
  .then(() => console.log('[Boot] DB init complete'))
  .catch(err => console.error('[Boot] DB init error:', err.message));

// ── PASSENGER COMPATIBILITY ───────────────────────────────────────────────────
// With Phusion Passenger (Hostinger), exporting module.exports = app
// signals to Passenger to call listen() via its own managed socket.
// DO NOT call app.listen() here — it conflicts with Passenger's socket.
//
// For LOCAL development only: run with `node server/index.js` directly.
module.exports = app;
