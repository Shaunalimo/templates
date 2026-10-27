const express = require('express');
const messages = require('../lib/messages');

const router = express.Router();

// Simple dependency-free per-IP throttle so the JSON store can't be flooded.
// Allows a short burst, then a minimum interval between submissions per IP.
const MIN_INTERVAL_MS = 5000; // one submission per IP per 5s
const BURST = 3;              // ...but allow a small initial burst
const WINDOW_MS = 60 * 1000; // over which the burst count resets
const hits = new Map();       // ip -> { count, first, last }

function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    hits.set(ip, { count: 1, first: now, last: now });
    return false;
  }
  if (rec.count < BURST) {
    rec.count += 1;
    rec.last = now;
    return false;
  }
  if (now - rec.last < MIN_INTERVAL_MS) return true;
  rec.last = now;
  return false;
}

// Opportunistically drop stale entries so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of hits) {
    if (now - rec.last > WINDOW_MS) hits.delete(ip);
  }
}, WINDOW_MS).unref();

router.post('/contact', (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'rate_limited', message: 'Too many submissions — please wait a moment and try again.' });
  }
  const { name, email, message } = req.body || {};
  const errors = {};
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim();
  const cleanMessage = String(message || '').trim();
  if (!cleanName || cleanName.length > 120) errors.name = 'Name is required (max 120 chars)';
  if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) errors.email = 'Valid email required';
  if (!cleanMessage || cleanMessage.length > 4000) errors.message = 'Message is required (max 4000 chars)';
  if (Object.keys(errors).length) {
    return res.status(400).json({ error: 'validation_failed', fields: errors });
  }
  const row = messages.add({ name: cleanName, email: cleanEmail, message: cleanMessage });
  res.json({ ok: true, id: row.id });
});

module.exports = router;
