// Tracker frontend — talks to the /api routes in routes/api.js.
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
let filter = 'all';
let items = [];

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
  return res.json();
}

function renderStats(s) {
  document.getElementById('stat-active').textContent = s.active;
  document.getElementById('stat-done').textContent = s.done;
  document.getElementById('stat-total').textContent = s.total;
  const amt = s.amountTotal;
  document.getElementById('stat-amount').textContent =
    Number.isInteger(amt) ? amt : amt.toFixed(2);
}

function render() {
  const shown = items.filter(i =>
    filter === 'all' ? true : filter === 'done' ? i.done : !i.done);
  listEl.innerHTML = '';
  emptyEl.hidden = shown.length > 0;
  for (const i of shown) {
    const li = document.createElement('li');
    li.className = 'item' + (i.done ? ' done' : '');
    li.innerHTML = `
      <button class="toggle" aria-label="Toggle done"></button>
      <div class="body">
        <div class="title"></div>
        ${i.note ? '<div class="note"></div>' : ''}
      </div>
      ${i.amount ? `<span class="amount">${Number.isInteger(i.amount) ? i.amount : i.amount.toFixed(2)}</span>` : ''}
      <button class="del" aria-label="Delete">×</button>`;
    li.querySelector('.title').textContent = i.title;
    if (i.note) li.querySelector('.note').textContent = i.note;
    li.querySelector('.toggle').addEventListener('click', () => toggle(i));
    li.querySelector('.del').addEventListener('click', () => remove(i));
    listEl.appendChild(li);
  }
}

async function load() {
  const data = await api('GET', '/api/items');
  items = data.items;
  renderStats(data.stats);
  render();
}

async function toggle(i) {
  const data = await api('PATCH', `/api/items/${i.id}`, { done: !i.done });
  i.done = data.item.done;
  renderStats(data.stats);
  render();
}

async function remove(i) {
  const data = await api('DELETE', `/api/items/${i.id}`);
  items = items.filter(x => x.id !== i.id);
  renderStats(data.stats);
  render();
}

document.getElementById('add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('title');
  const amount = document.getElementById('amount');
  if (!title.value.trim()) return;
  const data = await api('POST', '/api/items', {
    title: title.value.trim(),
    amount: amount.value ? Number(amount.value) : 0,
  });
  items.push(data.item);
  renderStats(data.stats);
  title.value = ''; amount.value = ''; title.focus();
  await load();
});

document.getElementById('filters').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-filter]');
  if (!btn) return;
  filter = btn.dataset.filter;
  document.querySelectorAll('#filters button').forEach(b => b.classList.toggle('active', b === btn));
  render();
});

load().catch(err => { emptyEl.hidden = false; emptyEl.textContent = 'Could not load items: ' + err.message; });
