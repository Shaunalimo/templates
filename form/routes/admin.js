const express = require('express');
const path = require('path');
const submissions = require('../lib/submissions');
const auth = require('../lib/admin-config');

const router = express.Router();

// Escape untrusted values before rendering them as HTML. Submissions are
// stored raw, so any admin page that builds an HTML table MUST run each cell
// through this to avoid stored XSS. (JSON responses are already safe.)
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Gate every admin API call. Password comes from the owner's first-run setup
// (stored on the app) or an ADMIN_PASSWORD env var if they'd rather pin it.
// The UI sends `Authorization: Basic base64("admin:<password>")` via fetch, so
// no native browser prompt appears. 409 = not set up yet (client shows setup).
function requirePassword(req, res, next) {
  if (!auth.isConfigured()) return res.status(409).json({ error: 'not_configured' });
  const header = req.headers.authorization || '';
  const m = header.match(/^Basic\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: 'unauthorized' });
  const decoded = Buffer.from(m[1], 'base64').toString('utf8');
  // Split on the FIRST colon only — passwords may legitimately contain colons.
  const password = decoded.slice(decoded.indexOf(':') + 1);
  if (!auth.verify(password)) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// Admin shell (setup + login + dashboard UI). Not itself sensitive — it holds
// no data and every API call it makes is gated by requirePassword.
router.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Unprotected: tells the client whether to show first-run setup or login.
router.get('/status', (req, res) => {
  res.json({ configured: auth.isConfigured(), envManaged: auth.envManaged() });
});

// First-run: claim the admin by creating a password. Only works while unset.
router.post('/setup', (req, res) => {
  try {
    auth.setup((req.body && req.body.password) || '');
    res.status(201).json({ ok: true });
  } catch (e) {
    const status = e.message === 'already_configured' ? 409 : 400;
    res.status(status).json({ error: e.message });
  }
});

// Cheap endpoint the login form hits to validate the password.
router.get('/verify', requirePassword, (req, res) => res.json({ ok: true }));

// Responses, newest first, plus a small summary the dashboard renders.
router.get('/submissions', requirePassword, (req, res) => {
  const rows = submissions.list();
  res.json({ submissions: rows, summary: summarize(rows) });
});

// CSV export of every response — one row per submission, stable column order.
router.get('/export.csv', requirePassword, (req, res) => {
  const rows = submissions.list();
  const cols = ['submittedAt', 'name', 'email', 'role', 'teamSize', 'features', 'rating', 'notes'];
  const cell = (v) => {
    const s = Array.isArray(v) ? v.join('; ') : (v == null ? '' : String(v));
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [cols.join(',')];
  for (const r of rows) {
    const d = r.data || {};
    lines.push([r.submittedAt, d.name, d.email, d.role, d.teamSize, d.features, d.rating, d.notes].map(cell).join(','));
  }
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="responses.csv"');
  res.send(lines.join('\n'));
});

// Roll up the numbers the dashboard shows at a glance.
function summarize(rows) {
  const total = rows.length;
  let ratingSum = 0, ratingCount = 0;
  const features = {};
  const roles = {};
  for (const r of rows) {
    const d = r.data || {};
    if (typeof d.rating === 'number') { ratingSum += d.rating; ratingCount += 1; }
    for (const f of d.features || []) features[f] = (features[f] || 0) + 1;
    if (d.role) roles[d.role] = (roles[d.role] || 0) + 1;
  }
  return {
    total,
    avgRating: ratingCount ? Math.round((ratingSum / ratingCount) * 10) / 10 : null,
    features: Object.entries(features).sort((a, b) => b[1] - a[1]),
    roles: Object.entries(roles).sort((a, b) => b[1] - a[1]),
  };
}

module.exports = router;
module.exports.escapeHtml = escapeHtml;
