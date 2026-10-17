const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config();

// Global safety net to prevent unhandled runtime exceptions from crashing the server
process.on('uncaughtException', (err) => {
  console.error('[CRASH PREVENTED] Uncaught Exception:', err.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[CRASH PREVENTED] Unhandled Rejection:', reason);
});

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const pool = require('./db/pool');

// Resilient Route Loader: If a file contains a syntax or runtime error while editing,
// it logs the error without terminating the entire Node/nodemon process.
function safeRoute(routePath, name) {
  try {
    return require(routePath);
  } catch (err) {
    console.error(`\x1b[31m[CRASH PREVENTED] Error loading route "${name}" (${routePath}):\x1b[0m`, err.message);
    const fallback = express.Router();
    fallback.use((req, res) => {
      res.status(503).json({
        message: `The ${name} module encountered a syntax or load error: ${err.message}. Server is recovering...`,
        error: err.message,
      });
    });
    return fallback;
  }
}

const authRoutes = safeRoute('./routes/auth', 'auth');
const residentsRoutes = safeRoute('./routes/residents', 'residents');
const complaintsRoutes = safeRoute('./routes/complaints', 'complaints');
const meetingsRoutes = safeRoute('./routes/meetings', 'meetings');
const escalationsRoutes = safeRoute('./routes/escalations', 'escalations');
const dashboardRoutes = safeRoute('./routes/dashboard', 'dashboard');
const residentAuthRoutes = safeRoute('./routes/residentAuth', 'residentAuth');
const residentComplaintsRoutes = safeRoute('./routes/residentComplaints', 'residentComplaints');
const announcementsRoutes = safeRoute('./routes/announcements', 'announcements');
const householdsRoutes = safeRoute('./routes/households', 'households');
const puroksRoutes = safeRoute('./routes/puroks', 'puroks');
const chatbotRoutes = safeRoute('./routes/chatbot', 'chatbot');

const app = express();
const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

function normalizeOrigin(value) {
  const origin = String(value || '').trim();
  if (!origin || origin === '*') return origin;
  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/+$/, '');
  }
}

const allowedOrigins = new Set([
  'https://brgy-poblacion.site',
  process.env.FRONTEND_URL,
  process.env.RESIDENT_FRONTEND_URL,
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : []),
].map(normalizeOrigin).filter(Boolean));

const {
  securityHeaders,
  generalRateLimiter,
  authRateLimiter,
  sanitizeInput,
} = require('./middleware/security');

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has('*')) {
        return callback(null, true);
      }
      const normOrigin = normalizeOrigin(origin);
      if (allowedOrigins.has(normOrigin)) {
        return callback(null, true);
      }
      // Allow localhost with any dev port in non-production environments
      if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS error: Origin ${origin} not allowed`));
    },
    credentials: true,
  })
);

// Apply defensive HTTP security headers (nosniff, anti-clickjacking, strict referrer)
app.use(securityHeaders);

// Limit JSON request body size to prevent memory exhaustion / payload flooding
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Deep inspection to intercept SQL Injection, XSS, and Path Traversal attacks
app.use(sanitizeInput);

// Protect sensitive login endpoints against brute-force & credential stuffing
app.use('/api/auth/login', authRateLimiter);
app.use('/api/resident-auth/login', authRateLimiter);

// General rate limiting to protect the backend from volumetric DDoS
app.use('/api', generalRateLimiter);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Serves uploaded resident photos, e.g. GET /uploads/residents/res-abc123.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', (req, res) => {
  res.status(404).json({ message: 'The requested evidence or uploaded file was not found on the server.' });
});

// Lightweight liveness probe for cloud orchestrators (Render, AWS, Railway, Docker)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Deep readiness probe including database connectivity
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/residents', residentsRoutes);
app.use('/api/households', householdsRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/escalations', escalationsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Resident (citizen-facing) portal
app.use('/api/resident-auth', residentAuthRoutes);
app.use('/api/resident/complaints', residentComplaintsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/puroks', puroksRoutes);
app.use('/api/chatbot', chatbotRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});


// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[EXPRESS ERROR]', err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error.' });
});

const server = app.listen(PORT, () => {
  console.log(`Barangay Poblacion API running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[PORT WARNING] Port ${PORT} is currently busy. Another server instance might still be releasing the port.`);
  } else {
    console.error('[SERVER ERROR]', err);
  }
});

function gracefulShutdown() {
  server.close(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
