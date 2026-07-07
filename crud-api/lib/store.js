// JSON-file persistence on EFS. The container's workspace is bind-mounted,
// so writes here survive restarts. To migrate to managed Postgres later,
// swap this file's implementation — the route handlers only depend on
// the exported function signatures.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'tasks.json');

function ensure() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    const seeded = seedRows();
    fs.writeFileSync(FILE, JSON.stringify({ nextId: seeded.length + 1, tasks: seeded }, null, 2));
  }
}

function readDb() {
  ensure();
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (_) {
    const seeded = seedRows();
    return { nextId: seeded.length + 1, tasks: seeded };
  }
}

function writeDb(db) {
  ensure();
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

function seedRows() {
  const samples = [
    { title: 'Draft the launch announcement',  status: 'in_progress', priority: 'high' },
    { title: 'Review pull request #142',       status: 'todo',        priority: 'medium' },
    { title: 'Migrate analytics to PostHog',   status: 'todo',        priority: 'low' },
    { title: 'Write changelog for v1.4',       status: 'done',        priority: 'medium' },
    { title: 'Update API documentation',       status: 'in_progress', priority: 'medium' },
    { title: 'Fix dark-mode toggle on Safari', status: 'todo',        priority: 'high' },
    { title: 'Onboard new design contractor',  status: 'done',        priority: 'low' },
    { title: 'Plan Q3 roadmap with team',      status: 'in_progress', priority: 'high' },
    { title: 'Audit npm dependencies',         status: 'todo',        priority: 'low' },
    { title: 'Ship the public API beta',       status: 'todo',        priority: 'high' },
  ];
  return samples.map((s, i) => {
    const now = new Date(Date.now() - (samples.length - i) * 60_000).toISOString();
    return { id: String(i + 1), ...s, createdAt: now, updatedAt: now };
  });
}

function list({ limit = 20, offset = 0, status } = {}) {
  const db = readDb();
  let arr = db.tasks.slice();
  if (status) arr = arr.filter((t) => t.status === status);
  arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { total: arr.length, items: arr.slice(offset, offset + limit) };
}

function get(id) {
  const db = readDb();
  return db.tasks.find((t) => t.id === id) || null;
}

function create({ title, status = 'todo', priority = 'medium' }) {
  const db = readDb();
  const id = String(db.nextId++);
  const now = new Date().toISOString();
  const task = { id, title, status, priority, createdAt: now, updatedAt: now };
  db.tasks.push(task);
  writeDb(db);
  return task;
}

function update(id, patch) {
  const db = readDb();
  const idx = db.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  db.tasks[idx] = { ...db.tasks[idx], ...patch, id, updatedAt: new Date().toISOString() };
  writeDb(db);
  return db.tasks[idx];
}

function remove(id) {
  const db = readDb();
  const idx = db.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  db.tasks.splice(idx, 1);
  writeDb(db);
  return true;
}

module.exports = { list, get, create, update, remove };
