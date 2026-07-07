const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Persisted on EFS so signups survive container restarts. This directory is
// gitignored — a deploy resets committed files, so never commit captured data.
const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'subscribers.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]', 'utf8');
}

function readAll() {
  ensure();
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (_) { return []; }
}

function writeAll(rows) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(rows, null, 2), 'utf8');
}

// Returns { row, duplicate }. Idempotent on email so a double-tap doesn't
// store the same address twice.
function add(email) {
  const rows = readAll();
  const existing = rows.find(r => r.email.toLowerCase() === email.toLowerCase());
  if (existing) return { row: existing, duplicate: true };
  const row = { id: crypto.randomUUID(), email, subscribedAt: new Date().toISOString() };
  rows.unshift(row);
  writeAll(rows);
  return { row, duplicate: false };
}

function list() {
  return readAll();
}

module.exports = { add, list };
