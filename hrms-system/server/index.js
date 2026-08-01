const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

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

// Versioned API Routes (/api/v1/)
app.use('/api/v1', v1Routes);

// Legacy Dispatcher API Routes (/api/)
app.use('/api', legacyRoutes);

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'UP', app: 'BSC Enterprise HRMS Unified Server v2.0' });
});

// Serve Frontend (Client Build static files)
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
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/health')) {
      return next();
    }
    const cleanPath = req.path === '/' ? 'index.html' : `${req.path.replace(/^\//, '')}.html`;
    const fullPath = path.join(clientBuildPath, cleanPath);

    if (fs.existsSync(fullPath)) {
      res.sendFile(fullPath);
    } else {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
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

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  BSC Enterprise HRMS Unified Server running on port ${PORT}`);
  console.log(`  REST API v1: http://localhost:${PORT}/api/v1`);
  console.log(`  Frontend Served From: ${clientBuildPath}`);
  console.log(`  Health Check: http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});
