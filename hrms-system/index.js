/**
 * BSC Enterprise HRMS - Entry Point
 * Hostinger/Passenger: PassengerStartupFile=index.js, PassengerAppType=node
 *
 * Passenger SETS the PORT env var via its preload-timestamp.js script.
 * The app MUST call app.listen(PORT) on Passenger's assigned port.
 * Do NOT hardcode PORT=5000 - Passenger assigns a dynamic port each time.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const helmet = require('helmet');
const http = require('http');
const { Server } = require('socket.io');
// ── Directory References ──────────────────────────────────────────────────────
const APP_ROOT = __dirname;
const SERVER_DIR = path.join(APP_ROOT, 'server');

// ── Load .env as FALLBACK only ────────────────────────────────────────────────
// Passenger injects PORT before this script runs. dotenv NEVER overrides
// already-set process.env values, so Passenger's PORT is always preserved.
// Do NOT add PORT to server/.env or hPanel dashboard!
dotenv.config({ path: path.join(APP_ROOT, '..', '.env') });
dotenv.config({ path: path.join(APP_ROOT, '.env') });
dotenv.config({ path: path.join(SERVER_DIR, '.env') });

// ── Global Crash Handlers ─────────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL uncaughtException]', err.code, err.message, err.stack);
  process.exit(1); // Always exit on uncaught exception so Passenger can restart cleanly
});
process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL unhandledRejection]', reason);
});

// ── Load modules ──────────────────────────────────────────────────────────────
const pool = require('./server/config/db');
const { autoInitializeDatabase } = require('./server/config/dbInitializer');
const v1Routes = require('./server/routes/v1');
const legacyRoutes = require('./server/routes/api');
const { errorRes } = require('./server/utils/response');

// ── Express App ───────────────────────────────────────────────────────────────
const app = express();

// Passenger's preload-timestamp.js sets PORT dynamically.
// Use that PORT. For local dev, fallback to 3000.
const PORT = parseInt(process.env.PORT || '3000', 10);

console.log(`[Boot] PORT=${PORT} | DB=${process.env.DB_NAME} | ENV=${process.env.NODE_ENV}`);

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static Uploads ────────────────────────────────────────────────────────────
const primaryUploadsDir = process.env.UPLOAD_DIR || path.join(APP_ROOT, 'uploads');
const parentUploadsDir = path.join(APP_ROOT, '..', 'uploads');
const grandParentUploadsDir = path.join(APP_ROOT, '..', '..', 'uploads');

if (process.env.UPLOAD_DIR) {
  console.log(`[Uploads] Using UPLOAD_DIR from environment: ${primaryUploadsDir}`);
} else {
  console.warn(`[Uploads] WARNING: UPLOAD_DIR not set. Falling back to: ${primaryUploadsDir}`);
  console.warn(`[Uploads] WARNING: Files in this directory may be lost during deployments!`);
  console.warn(`[Uploads] Set UPLOAD_DIR to a persistent path outside the app folder.`);
}


const subdirs = [
  'applicants',
  'candidate-resumes',
  'candidate-photos',
  'employee-documents',
  'offer-letters',
  'relieving-letters',
  'experience-certificates',
  'misc'
];

[primaryUploadsDir, parentUploadsDir, grandParentUploadsDir].forEach((baseDir) => {
  try {
    if (fs.existsSync(baseDir)) {
      subdirs.forEach((sub) => {
        const subPath = path.join(baseDir, sub);
        if (!fs.existsSync(subPath)) fs.mkdirSync(subPath, { recursive: true });
      });
    }
  } catch (e) {}
});

app.use('/uploads', express.static(primaryUploadsDir));
if (fs.existsSync(parentUploadsDir)) {
  app.use('/uploads', express.static(parentUploadsDir));
}

// Smart Uploads Fallback Handler (prevents 404 for photos & documents across subfolders)
app.get(['/uploads/*', '/candidate-resumes/*', '/candidate-photos/*', '/employee-documents/*', '/:file(*.pdf)', '/:file(*.jpg)', '/:file(*.jpeg)', '/:file(*.png)', '/:file(*.doc)', '/:file(*.docx)'], (req, res, next) => {
  const reqPath = req.params[0] || req.params.file || req.path.replace(/^\//, '');
  const fileName = path.basename(reqPath);
  const candidateAppNo = req.query.appNo || '';

  const possiblePaths = [
    path.join(primaryUploadsDir, 'applicants', candidateAppNo, fileName),
    path.join(primaryUploadsDir, fileName),
    path.join(primaryUploadsDir, 'candidate-resumes', fileName),
    path.join(primaryUploadsDir, 'candidate-photos', fileName),
    path.join(primaryUploadsDir, 'employee-documents', fileName),
    path.join(primaryUploadsDir, 'misc', fileName),

    path.join(parentUploadsDir, 'applicants', candidateAppNo, fileName),
    path.join(parentUploadsDir, fileName),
    path.join(parentUploadsDir, 'candidate-resumes', fileName),
    path.join(parentUploadsDir, 'candidate-photos', fileName),
    path.join(parentUploadsDir, 'employee-documents', fileName),
    path.join(parentUploadsDir, 'misc', fileName),
    
    path.join(grandParentUploadsDir, 'applicants', candidateAppNo, fileName),
    path.join(grandParentUploadsDir, fileName),
    path.join(grandParentUploadsDir, 'candidate-resumes', fileName),
    path.join(grandParentUploadsDir, 'candidate-photos', fileName),
    path.join(grandParentUploadsDir, 'employee-documents', fileName),
    path.join(grandParentUploadsDir, 'misc', fileName)
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      return res.sendFile(p);
    }
  }

  next();
});

// ── Health / Diagnostics ──────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'UP', port: PORT, ts: new Date().toISOString() });
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

  // Assets Fallback: Never return index.html (text/html) for CSS / JS asset requests!
  app.get('/assets/*', (req, res, next) => {
    const assetPath = path.join(distDir, req.path);
    if (fs.existsSync(assetPath) && fs.statSync(assetPath).isFile()) {
      return res.sendFile(assetPath);
    }
    const ext = path.extname(req.path).toLowerCase();
    const assetsFolder = path.join(distDir, 'assets');
    if (fs.existsSync(assetsFolder)) {
      const files = fs.readdirSync(assetsFolder);
      const match = files.find(f => path.extname(f).toLowerCase() === ext);
      if (match) {
        return res.sendFile(path.join(assetsFolder, match));
      }
    }
    return res.status(404).send('Asset file not found');
  });

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/assets') ||
        req.path.endsWith('.css') || req.path.endsWith('.js') ||
        req.path === '/health' || req.path === '/db-status') return next();
    
    const fallback = path.join(distDir, 'index.html');
    if (fs.existsSync(fallback)) return res.sendFile(fallback);
    return next();
  });
} else {
  console.warn('[Boot] No dist/ folder found.');
}

// ── Error Handlers ────────────────────────────────────────────────────────────
app.use('/api/*', (req, res) => errorRes(res, `Not found: ${req.originalUrl}`, [], 404));
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return errorRes(res, 'File exceeds the maximum allowed size of 500 KB.', [], 400);
  }
  errorRes(res, err.message || 'Internal Server Error', [], err.status || 500);
});

// ── DB Init ───────────────────────────────────────────────────────────────────
autoInitializeDatabase(pool)
  .then(() => console.log('[Boot] DB init complete'))
  .catch(err => console.error('[Boot] DB init error:', err.message));

// ── START SERVER ──────────────────────────────────────────────────────────────
// Passenger (PassengerAppType=node) REQUIRES app.listen(PORT) to be called.
// Passenger sets PORT via its preload-timestamp.js script before this file runs.
// The listen() call is what signals to Passenger that the app is ready.
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  BSC HRMS running on port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});

server.on('error', (err) => {
  console.error('[Server listen error]', err.code, err.message);
  process.exit(1);
});

module.exports = app;
