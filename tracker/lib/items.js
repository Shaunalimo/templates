const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// JSON-file store on EFS (survives container restarts). This directory is
// gitignored — a deploy resets committed files, so never commit tracked items.
const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'items.json');

// An item is intentionally generic so this one scaffold covers todo / habit /
// budget / inventory: { id, title, note, amount, done, createdAt }.
//   - todo/checklist → title + done toggle
//   - budget/expense → title + amount (stats sum the amounts)
//   - inventory      → title + amount as quantity
//   - habit          → title + done, reset daily by the agent if asked
function seed() {
  const now = Date.now();
  return [
    { id: crypto.randomUUID(), title: 'Welcome. Tap the circle to complete an item', note: '', amount: 0, done: false, createdAt: new Date(now - 2000).toISOString() },
    { id: crypto.randomUUID(), title: 'Add your own with the field above', note: 'Items with an amount roll up into the total.', amount: 0, done: false, createdAt: new Date(now - 1000).toISOString() },
    { id: crypto.randomUUID(), title: 'Sample done item', note: '', amount: 0, done: true, createdAt: new Date(now).toISOString() },
  ];
}

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify(seed(), null, 2), 'utf8');
}

function readAll() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (err) {
    // Corrupt/unparseable file — preserve it for inspection instead of
    // silently clobbering on the next write, then start fresh.
    const backup = FILE + '.corrupt.' + Date.now();
    try { fs.renameSync(FILE, backup); } catch (_) {}
    console.error(`items.json unreadable (${err.message}); moved to ${backup}`);
    return [];
  }
}

function writeAll(rows) {
  ensure();
  // Atomic write: fully write a temp file then rename over the target, so a
  // crash mid-write can never leave a truncated items.json.
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), 'utf8');
  fs.renameSync(tmp, FILE);
}

function list() {
  // Newest first, but keep active items above completed ones.
  return readAll().sort((a, b) => (a.done === b.done)
    ? new Date(b.createdAt) - new Date(a.createdAt)
    : (a.done ? 1 : -1));
}

function add({ title, note = '', amount = 0 }) {
  const rows = readAll();
  const item = {
    id: crypto.randomUUID(),
    title: String(title).slice(0, 500),
    note: String(note).slice(0, 2000),
    amount: Number.isFinite(+amount) ? +amount : 0,
    done: false,
    createdAt: new Date().toISOString(),
  };
  rows.push(item);
  writeAll(rows);
  return item;
}

function update(id, patch) {
  const rows = readAll();
  const item = rows.find(r => r.id === id);
  if (!item) return null;
  if (typeof patch.title === 'string') item.title = patch.title.slice(0, 500);
  if (typeof patch.note === 'string') item.note = patch.note.slice(0, 2000);
  if (patch.amount !== undefined && Number.isFinite(+patch.amount)) item.amount = +patch.amount;
  if (typeof patch.done === 'boolean') item.done = patch.done;
  writeAll(rows);
  return item;
}

function remove(id) {
  const rows = readAll();
  const next = rows.filter(r => r.id !== id);
  if (next.length === rows.length) return false;
  writeAll(next);
  return true;
}

function stats() {
  const rows = readAll();
  return {
    total: rows.length,
    active: rows.filter(r => !r.done).length,
    done: rows.filter(r => r.done).length,
    amountTotal: rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
  };
}

module.exports = { list, add, update, remove, stats };
