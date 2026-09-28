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
const path = require('path');

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

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serves uploaded resident photos, e.g. GET /uploads/residents/res-abc123.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'ok', database: 'disconnected', error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/residents', residentsRoutes);
app.use('/api/complaints', complaintsRoutes);
app.use('/api/meetings', meetingsRoutes);
app.use('/api/escalations', escalationsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Resident (citizen-facing) portal
app.use('/api/resident-auth', residentAuthRoutes);
app.use('/api/resident/complaints', residentComplaintsRoutes);
app.use('/api/announcements', announcementsRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// Global safety net to prevent unhandled runtime exceptions from crashing the server
process.on('uncaughtException', (err) => {
  console.error('[CRASH PREVENTED] Uncaught Exception:', err.message || err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[CRASH PREVENTED] Unhandled Rejection:', reason);
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
