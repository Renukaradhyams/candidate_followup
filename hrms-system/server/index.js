const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// ── Resolve the server root directory reliably ──────────────────────────────
// __dirname is always the directory of THIS file (server/), regardless of cwd
const SERVER_DIR = __dirname;
const APP_ROOT = path.join(SERVER_DIR, '..'); // hrms-system/

// ── Load .env ONLY as fallback — Hostinger dashboard env vars always win ────
// dotenv.config() never overwrites already-set process.env values.
// We load in reverse-priority order so more specific files can override less specific ones,
// but NOTHING overrides env vars already set by Hostinger's deployment system.
dotenv.config({ path: path.join(APP_ROOT, '..', '.env') });  // repo root (lowest priority)
dotenv.config({ path: path.join(APP_ROOT, '.env') });         // hrms-system/.env
dotenv.config({ path: path.join(SERVER_DIR, '.env') });       // server/.env (highest priority for local dev)

// ── Global Crash Handlers ────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err.stack || err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL] Unhandled Rejection:', reason);
});

// ── Load Core Modules ────────────────────────────────────────────────────────
const pool = require('./config/db');
const { autoInitializeDatabase } = require('./config/dbInitializer');
const v1Routes = require('./routes/v1');
const legacyRoutes = require('./routes/api');
const { errorRes } = require('./utils/response');

const app = express();
const PORT = process.env.PORT || 5000;

console.log(`[Startup] SERVER_DIR = ${SERVER_DIR}`);
console.log(`[Startup] APP_ROOT   = ${APP_ROOT}`);
console.log(`[Startup] PORT       = ${PORT}`);
if (process.env.PASSENGER_APP_ENV) {
  console.log(`[Startup] Passenger detected. ENV = ${process.env.PASSENGER_APP_ENV}`);
}

// ── Security Middlewares ─────────────────────────────────────────────────────
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Disable CSP to avoid blocking Next.js assets
}));

app.use(cors({
  origin: '*',
  credentials: true
}));

// ── Rate Limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  validate: { xForwardedForHeader: false },
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// ── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static File Serving ──────────────────────────────────────────────────────
// Uploads
const uploadsDir = path.join(APP_ROOT, '..', 'uploads');
const uploadsDir2 = path.join(APP_ROOT, 'uploads');
const activeUploadsDir = fs.existsSync(uploadsDir) ? uploadsDir : uploadsDir2;
if (!fs.existsSync(activeUploadsDir)) {
  try { fs.mkdirSync(activeUploadsDir, { recursive: true }); } catch(e) {}
}
app.use('/uploads', express.static(activeUploadsDir));
app.use('/public', express.static(path.join(SERVER_DIR, 'public')));

// ── Database Diagnostics Endpoint ────────────────────────────────────────────
const dbStatusHandler = async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const [tables] = await conn.query('SHOW TABLES');
    conn.release();
    return res.json({
      connected: true,
      config: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        database: process.env.DB_NAME
      },
      tablesCount: tables.length,
      tables: tables.map(t => Object.values(t)[0]),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(500).json({
      connected: false,
      error: { code: err.code, message: err.message },
      timestamp: new Date().toISOString()
    });
  }
};

app.get('/db-status', dbStatusHandler);
app.get('/api/db-status', dbStatusHandler);
app.get('/api/v1/db-status', dbStatusHandler);

// ── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'UP', app: 'BSC Enterprise HRMS v2.0', port: PORT, ts: new Date().toISOString() });
});

// ── Wipe DB Endpoint ─────────────────────────────────────────────────────────
app.get('/api/wipe-db', async (req, res) => {
  try {
    const tables = ['candidates', 'interview_schedules', 'candidate_activities', 'hr_evaluations',
      'interview_tokens', 'selected_candidates', 'rejected_candidates',
      'selection_offers', 'onboarding_records', 'onboarding_items'];
    for (const t of tables) {
      try { await pool.query(`DELETE FROM \`${t}\``); } catch(e) { /* table may not exist */ }
    }
    res.json({ success: true, message: 'Sample data wiped.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', v1Routes);
app.use('/api', legacyRoutes);

// ── Frontend SPA Serving ─────────────────────────────────────────────────────
// Search for the built Next.js output in priority order
const candidateDistPaths = [
  path.join(APP_ROOT, 'dist'),
  path.join(APP_ROOT, '..', 'dist'),
  path.join(APP_ROOT, 'client', 'out'),
  path.join(APP_ROOT, 'client', '.next'),
];

let clientBuildPath = null;
for (const p of candidateDistPaths) {
  if (fs.existsSync(p)) {
    clientBuildPath = p;
    console.log(`[Startup] Frontend found at: ${p}`);
    break;
  }
}

if (clientBuildPath) {
  app.use(express.static(clientBuildPath));

  app.get('*', (req, res, next) => {
    // Skip API / upload paths
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/uploads') ||
      req.path === '/health' ||
      req.path === '/db-status'
    ) {
      return next();
    }

    // Try Next.js static export paths
    const reqPath = req.path.replace(/^\//, '').replace(/\/$/, '');
    const tries = [
      path.join(clientBuildPath, `${reqPath}.html`),
      path.join(clientBuildPath, reqPath, 'index.html'),
    ];

    for (const p of tries) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return res.sendFile(p);
      }
    }

    // SPA fallback
    const fallback = path.join(clientBuildPath, 'index.html');
    if (fs.existsSync(fallback)) {
      return res.sendFile(fallback);
    }

    return next();
  });
} else {
  console.warn('[Startup] WARNING: No frontend build found. Only API will be served.');
}

// ── 404 / Error Handlers ─────────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
  return errorRes(res, `API Endpoint ${req.originalUrl} not found`, [], 404);
});

app.use((err, req, res, next) => {
  console.error('[Error Handler]:', err.stack || err.message);
  const status = err.status || 500;
  return errorRes(res, err.message || 'Internal Server Error', [], status);
});

// ── DB Init ──────────────────────────────────────────────────────────────────
autoInitializeDatabase(pool)
  .then(() => console.log('[App] Database initialized successfully.'))
  .catch(err => console.error('[App] DB init error:', err.message));

// ── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  BSC Enterprise HRMS running on port ${PORT}`);
  console.log(`  API: http://localhost:${PORT}/api/v1`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Frontend: ${clientBuildPath || 'NOT FOUND'}`);
  console.log(`====================================================`);
});

module.exports = app;
