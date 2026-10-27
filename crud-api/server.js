const express = require('express');
const path = require('path');

const tasksRouter = require('./routes/tasks');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' })); // fits a base64 phone photo; shrink photos first with public/shrink-photo.js

// Request log: one line per request — id, method, path, status, duration.
// Plain console output keeps the dependency footprint minimal.
app.use((req, res, next) => {
  const rid = Math.random().toString(36).slice(2, 8);
  const started = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - started;
    console.log(`[${rid}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// Health check — used by the platform to detect when the app is ready.
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), version: '1.0.0' });
});

app.use('/api/tasks', tasksRouter);

// Static docs page lives in /public/index.html.
app.use(express.static(path.join(__dirname, 'public')));

// Centralized error handler — keeps unhandled exceptions from leaking
// stack traces. Logged but returned as a generic 500.
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => {
  console.log(`API listening on port ${PORT}`);
  console.log(`  GET    /api/tasks`);
  console.log(`  POST   /api/tasks`);
  console.log(`  GET    /api/tasks/:id`);
  console.log(`  PUT    /api/tasks/:id`);
  console.log(`  DELETE /api/tasks/:id`);
});
