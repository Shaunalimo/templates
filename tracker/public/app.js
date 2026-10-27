// Tracker frontend — talks to the /api routes in routes/api.js.
//
// Local-first: `items` is the source of truth the UI renders from. Every
// mutation updates it and repaints immediately, then syncs to the server in the
// background and reverts on failure — so add / toggle / edit feel instant on a
// phone instead of waiting a round-trip. Deletes are deferred with an Undo.
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const toastEl = document.getElementById('toast');
let filter = 'all';
let items = [];
const pendingDeletes = new Map(); // id -> { item, timer }

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
  return res.json();
}

// A temp item exists only until its POST resolves; block mutations on it until
// the server hands back a real id.
const isTemp = (i) => String(i.id).startsWith('tmp_');
const ensureSaved = (i) => (i._save ? i._save : Promise.resolve());

function fmtAmount(a) {
  return Number.isInteger(a) ? a.toLocaleString() : a.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Stats are derived from `items` so the tiles update instantly with every
// optimistic change, no extra request. Deferred-delete items are already out of
// `items`, so they don't count.
function computeStats() {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  return { total, active: total - done, done, amountTotal: items.reduce((s, i) => s + (Number(i.amount) || 0), 0) };
}

function renderStats(s = computeStats()) {
  document.getElementById('stat-active').textContent = s.active;
  document.getElementById('stat-done').textContent = s.done;
  document.getElementById('stat-total').textContent = s.total;
  document.getElementById('stat-amount').textContent = fmtAmount(s.amountTotal);
}

// Mirror the server order (active first, then done; newest first within a group)
// so a toggled item jumps to its group without waiting for a reload.
function sorted(arr) {
  return arr.slice().sort((a, b) => (a.done === b.done)
    ? new Date(b.createdAt) - new Date(a.createdAt)
    : (a.done ? 1 : -1));
}

const EMPTY_MSG = {
  all: 'Nothing here yet. Add your first item above.',
  active: 'No active items. Nice work.',
  done: 'No completed items yet.',
};

const PENCIL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

function render() {
  const shown = sorted(items).filter((i) =>
    filter === 'all' ? true : filter === 'done' ? i.done : !i.done);
  listEl.innerHTML = '';
  emptyEl.hidden = shown.length > 0;
  emptyEl.textContent = EMPTY_MSG[filter];
  for (const i of shown) {
    const li = document.createElement('li');
    li.className = 'item' + (i.done ? ' done' : '') + (isTemp(i) ? ' saving' : '');
    li.innerHTML = `
      <button class="toggle" aria-label="${i.done ? 'Mark as not done' : 'Mark as done'}" aria-pressed="${i.done}"></button>
      <div class="body">
        <div class="title"></div>
        ${i.note ? '<div class="note"></div>' : ''}
      </div>
      ${i.amount ? `<span class="amount" title="Edit amount">${fmtAmount(i.amount)}</span>` : ''}
      <button class="edit-btn" aria-label="Edit item">${PENCIL}</button>
      <button class="del" aria-label="Delete">×</button>`;
    li.querySelector('.title').textContent = i.title;
    if (i.note) li.querySelector('.note').textContent = i.note;
    li.querySelector('.toggle').addEventListener('click', () => toggle(i));
    li.querySelector('.del').addEventListener('click', () => remove(i));
    li.querySelector('.edit-btn').addEventListener('click', () => startEdit(li, i));
    // Tap the title (or the amount badge) to edit inline.
    li.querySelector('.title').addEventListener('click', () => startEdit(li, i));
    const amtEl = li.querySelector('.amount');
    if (amtEl) amtEl.addEventListener('click', () => startEdit(li, i, { focus: 'amount' }));
    listEl.appendChild(li);
  }
}

// Swap an item's body for title/note/amount inputs; save on Enter or blur,
// Esc cancels. Saving is optimistic — the row updates before the PATCH lands.
function startEdit(li, i, opts = {}) {
  if (li.querySelector('.edit')) return; // already editing
  const body = li.querySelector('.body');
  body.innerHTML = '';
  const titleInput = document.createElement('input');
  titleInput.className = 'edit';
  titleInput.value = i.title;
  titleInput.setAttribute('aria-label', 'Edit title');

  const row = document.createElement('div');
  row.className = 'edit-row';
  const noteInput = document.createElement('input');
  noteInput.className = 'edit note';
  noteInput.value = i.note || '';
  noteInput.placeholder = 'Note (optional)';
  noteInput.setAttribute('aria-label', 'Edit note');
  const amountInput = document.createElement('input');
  amountInput.className = 'edit amount-edit';
  amountInput.type = 'number';
  amountInput.step = 'any';
  amountInput.inputMode = 'decimal';
  amountInput.value = i.amount ? i.amount : '';
  amountInput.placeholder = 'Amount';
  amountInput.setAttribute('aria-label', 'Edit amount');
  row.append(noteInput, amountInput);
  body.append(titleInput, row);

  const focusEl = opts.focus === 'amount' ? amountInput : titleInput;
  focusEl.focus();
  focusEl.select();

  const editEls = [titleInput, noteInput, amountInput];
  let closed = false;
  const cancel = () => { if (closed) return; closed = true; render(); };
  const save = async () => {
    if (closed) return;
    const title = titleInput.value.trim();
    if (!title) return cancel(); // don't allow an empty title
    closed = true;
    i.title = title;
    i.note = noteInput.value.trim();
    i.amount = amountInput.value ? Number(amountInput.value) : 0;
    render();
    renderStats();
    try {
      await ensureSaved(i);
      await api('PATCH', `/api/items/${i.id}`, { title: i.title, note: i.note, amount: i.amount });
    } catch (err) {
      toast('Could not save changes');
      load();
    }
  };
  const onKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); save(); }
    else if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  };
  // Blur only saves once focus has actually left every edit field.
  const onBlur = () => setTimeout(() => {
    if (!editEls.includes(document.activeElement)) save();
  }, 0);
  for (const el of editEls) {
    el.addEventListener('keydown', onKey);
    el.addEventListener('blur', onBlur);
  }
}

async function load() {
  const data = await api('GET', '/api/items');
  items = data.items;
  renderStats(data.stats);
  render();
}

async function add(fields) {
  const temp = {
    id: 'tmp_' + Math.random().toString(36).slice(2),
    title: fields.title,
    note: fields.note || '',
    amount: fields.amount || 0,
    done: false,
    createdAt: new Date().toISOString(),
  };
  items.push(temp);
  render();
  renderStats();
  temp._save = api('POST', '/api/items', fields)
    .then(({ item }) => { Object.assign(temp, item); delete temp._save; render(); })
    .catch(() => {
      items = items.filter((x) => x !== temp);
      render();
      renderStats();
      toast('Could not add item');
    });
}

async function toggle(i) {
  i.done = !i.done;
  render();
  renderStats();
  try {
    await ensureSaved(i);
    await api('PATCH', `/api/items/${i.id}`, { done: i.done });
  } catch (err) {
    i.done = !i.done; // revert
    render();
    renderStats();
    toast('Could not update');
  }
}

// Deferred delete: pull the item from the UI immediately and offer Undo. The
// server DELETE only fires once the toast expires, so an accidental tap is
// recoverable and the row keeps its id/position on undo.
function remove(i) {
  if (isTemp(i)) { items = items.filter((x) => x !== i); render(); renderStats(); return; }
  items = items.filter((x) => x !== i);
  render();
  renderStats();
  const timer = setTimeout(async () => {
    pendingDeletes.delete(i.id);
    try { await api('DELETE', `/api/items/${i.id}`); } catch (_) {}
  }, 5000);
  pendingDeletes.set(i.id, { item: i, timer });
  toast('Item deleted', { action: 'Undo', onAction: () => undoDelete(i.id) });
}

function undoDelete(id) {
  const p = pendingDeletes.get(id);
  if (!p) return;
  clearTimeout(p.timer);
  pendingDeletes.delete(id);
  items.push(p.item);
  render();
  renderStats();
}

// If the page is closing with deletes still pending, flush them so they aren't
// silently resurrected on next load.
window.addEventListener('pagehide', () => {
  for (const { item, timer } of pendingDeletes.values()) {
    clearTimeout(timer);
    fetch(`/api/items/${item.id}`, { method: 'DELETE', keepalive: true }).catch(() => {});
  }
  pendingDeletes.clear();
});

let toastTimer = null;
function toast(msg, opts = {}) {
  toastEl.innerHTML = '';
  const span = document.createElement('span');
  span.textContent = msg;
  toastEl.appendChild(span);
  if (opts.action) {
    const btn = document.createElement('button');
    btn.textContent = opts.action;
    btn.addEventListener('click', () => { hideToast(); opts.onAction && opts.onAction(); });
    toastEl.appendChild(btn);
  }
  toastEl.hidden = false;
  void toastEl.offsetWidth;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, opts.action ? 5000 : 2400);
}
function hideToast() {
  toastEl.classList.remove('show');
  clearTimeout(toastTimer);
  setTimeout(() => { toastEl.hidden = true; }, 220);
}

document.getElementById('add-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = document.getElementById('title');
  const note = document.getElementById('note');
  const amount = document.getElementById('amount');
  if (!title.value.trim()) return;
  add({
    title: title.value.trim(),
    note: note.value.trim(),
    amount: amount.value ? Number(amount.value) : 0,
  });
  title.value = ''; note.value = ''; amount.value = ''; title.focus();
});

document.getElementById('filters').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-filter]');
  if (!btn) return;
  filter = btn.dataset.filter;
  document.querySelectorAll('#filters button').forEach((b) => {
    const on = b === btn;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  render();
});

load().catch((err) => { emptyEl.hidden = false; emptyEl.textContent = 'Could not load items: ' + err.message; });
