const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'submissions.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, '[]', 'utf8');
}

function readAll() {
  ensure();
  const raw = fs.readFileSync(FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    // Never silently clobber: preserve the corrupt file before returning empty.
    const corruptPath = `${FILE}.corrupt.${Date.now()}`;
    try { fs.renameSync(FILE, corruptPath); } catch (_) {}
    console.error(`submissions: failed to parse ${FILE}, preserved as ${corruptPath}`, err);
    return [];
  }
}

function writeAll(rows) {
  ensure();
  // Atomic write: write to a temp file then rename, so a crash mid-write
  // (or a concurrent blue/green writer) can't truncate the live file.
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
  fs.renameSync(tmp, FILE);
}

function add(data) {
  const rows = readAll();
  const row = {
    id: crypto.randomUUID(),
    submittedAt: new Date().toISOString(),
    data,
  };
  rows.unshift(row);
  writeAll(rows);
  return row;
}

function list() {
  return readAll();
}

module.exports = { add, list };
