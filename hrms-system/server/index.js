const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load Environment Variables from multiple candidate locations
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config();

const pool = require('./config/db');
const { autoInitializeDatabase } = require('./config/dbInitializer');
const v1Routes = require('./routes/v1');
const legacyRoutes = require('./routes/api');
const { errorRes } = require('./utils/response');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: '*',
  credentials: true
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body Parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve Uploads Directory
const uploadsDir = fs.existsSync(path.join(__dirname, '../../uploads'))
  ? path.join(__dirname, '../../uploads')
  : path.join(__dirname, '../uploads');

app.use('/uploads', express.static(uploadsDir));
app.use('/public', express.static(path.join(__dirname, '../public')));

// Database Diagnostics Route Handler
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
        user: process.env.DB_USER || 'root',
        database: process.env.DB_NAME || 'hrms_db'
      },
      tablesCount: tables.length,
      tables: tables.map(t => Object.values(t)[0]),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[DB Diagnostics API Error]:', err.message);
    return res.status(500).json({
      connected: false,
      config: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        database: process.env.DB_NAME || 'hrms_db'
      },
      error: {
        code: err.code || 'UNKNOWN',
        message: err.message,
        sqlState: err.sqlState || null
      },
      timestamp: new Date().toISOString()
    });
  }
};

app.get('/db-status', dbStatusHandler);
app.get('/api/db-status', dbStatusHandler);
app.get('/api/v1/db-status', dbStatusHandler);

// Versioned API Routes (/api/v1/)
app.use('/api/v1', v1Routes);

// Legacy Dispatcher API Routes (/api/)
app.use('/api', legacyRoutes);

// Mock data seed endpoint
app.get('/api/seed-mock', async (req, res) => {
  try {
    const { seedMockData } = require('./scripts/seed_mock_data');
    const result = await seedMockData();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', app: 'BSC Enterprise HRMS Unified Server v2.0' });
});

// Serve Frontend (Client Build static files & SPA Fallback)
const rootDistPath = path.join(__dirname, '../../dist');
const rootOutPath = path.join(__dirname, '../../out');
const clientOutPath = path.join(__dirname, '../client/out');

let clientBuildPath = rootOutPath;
if (fs.existsSync(rootDistPath)) clientBuildPath = rootDistPath;
else if (fs.existsSync(rootOutPath)) clientBuildPath = rootOutPath;
else if (fs.existsSync(clientOutPath)) clientBuildPath = clientOutPath;

if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));

  app.get('*', (req, res, next) => {
    if (
      req.path === '/db-status' ||
      req.path.startsWith('/api') || 
      req.path.startsWith('/uploads') || 
      req.path.startsWith('/health')
    ) {
      return next();
    }

    const reqPath = req.path.replace(/^\//, '').replace(/\/$/, '');

    if (!reqPath) {
      return res.sendFile(path.join(clientBuildPath, 'index.html'));
    }

    const possiblePaths = [
      path.join(clientBuildPath, `${reqPath}.html`),
      path.join(clientBuildPath, reqPath, 'index.html'),
      path.join(clientBuildPath, reqPath)
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        return res.sendFile(p);
      }
    }

    // Single Page Application Fallback
    const fallbackIndex = path.join(clientBuildPath, 'index.html');
    if (fs.existsSync(fallbackIndex)) {
      return res.sendFile(fallbackIndex);
    }

    return next();
  });
}

// 404 Handler for API
app.use('/api/*', (req, res) => {
  return errorRes(res, `API Endpoint ${req.originalUrl} Not Found`, [], 404);
});

// Central Error Middleware
app.use((err, req, res, next) => {
  console.error('Central Error Middleware:', err);
  const status = err.status || 500;
  return errorRes(res, err.message || 'Internal Server Error', [err.message], status);
});

// Run Auto Database Initializer & Migration
// Running this outside of app.listen because Passenger environments (Hostinger/cPanel) 
// often intercept app.listen and ignore the callback.
autoInitializeDatabase(pool).then(() => {
  console.log(`[App] Database Auto-Initializer triggered.`);
}).catch(err => {
  console.error(`[App] Database Auto-Initializer error:`, err);
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  BSC Enterprise HRMS Unified Server running on port ${PORT}`);
  console.log(`  REST API v1: http://localhost:${PORT}/api/v1`);
  console.log(`  DB Diagnostics: http://localhost:${PORT}/api/db-status`);
  console.log(`  Frontend Served From: ${clientBuildPath}`);
  console.log(`  Health Check: http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});
