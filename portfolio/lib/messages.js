const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'messages.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]', 'utf8');
}

function readAll() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (err) {
    // Never silently clobber: preserve the corrupt file for recovery, then start clean.
    try {
      const corrupt = FILE + '.corrupt.' + Date.now();
      fs.renameSync(FILE, corrupt);
      console.error(`[messages] corrupt store, moved to ${corrupt}:`, err.message);
    } catch (renameErr) {
      console.error('[messages] corrupt store, could not preserve it:', renameErr.message);
    }
    return [];
  }
}

function writeAll(rows) {
  ensure();
  // Atomic write: fully write a temp file, then rename over the target so a
  // crash mid-write can never leave a truncated messages.json.
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
  fs.renameSync(tmp, FILE);
}

function add({ name, email, message }) {
  const rows = readAll();
  const row = {
    id: crypto.randomUUID(),
    name,
    email,
    message,
    submittedAt: new Date().toISOString(),
  };
  rows.unshift(row);
  writeAll(rows);
  return row;
}

function list() {
  return readAll();
}

module.exports = { add, list };
