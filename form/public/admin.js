(() => {
  const KEY = 'survey.admin.pw';
  let password = sessionStorage.getItem(KEY) || '';

  const $ = (id) => document.getElementById(id);
  const authHeader = () => 'Basic ' + btoa('admin:' + password);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    void t.offsetWidth; t.classList.add('show');
    clearTimeout(t._t);
    t._t = setTimeout(() => { t.classList.remove('show'); setTimeout(() => { t.hidden = true; }, 250); }, 1900);
  }

  function showScreen(which) {
    $('setup').hidden = which !== 'setup';
    $('login').hidden = which !== 'login';
    $('app').hidden = which !== 'app';
  }

  // ---- First-run setup ----
  $('setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pw = $('setup-password').value;
    const confirm = $('setup-confirm').value;
    const err = $('setup-error');
    err.hidden = true;
    if (pw.length < 6) { err.textContent = 'Password must be at least 6 characters.'; err.hidden = false; return; }
    if (pw !== confirm) { err.textContent = 'Passwords do not match.'; err.hidden = false; return; }
    try {
      const res = await fetch('/admin/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        if (d.error === 'already_configured') { err.textContent = 'Already set up — please sign in.'; err.hidden = false; showScreen('login'); return; }
        err.textContent = 'Could not set the password.'; err.hidden = false; return;
      }
      password = pw; sessionStorage.setItem(KEY, password);
      enterApp();
    } catch (_) { err.textContent = 'Could not reach the server.'; err.hidden = false; }
  });

  // ---- Login ----
  $('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    password = $('password').value;
    const err = $('login-error');
    err.hidden = true;
    try {
      const res = await fetch('/admin/verify', { headers: { Authorization: authHeader() } });
      if (!res.ok) { err.textContent = 'Wrong password.'; err.hidden = false; return; }
      sessionStorage.setItem(KEY, password);
      enterApp();
    } catch (_) { err.textContent = 'Could not reach the server.'; err.hidden = false; }
  });

  function signout() {
    sessionStorage.removeItem(KEY); password = '';
    $('password').value = '';
    showScreen('login');
  }
  $('signout').onclick = signout;

  // Keep the CSV link authenticated: fetch as a blob with the auth header,
  // then trigger a download (a plain <a href> can't send Authorization).
  $('export').addEventListener('click', async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/admin/export.csv', { headers: { Authorization: authHeader() } });
      if (!res.ok) { toast('Export failed'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'responses.csv';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (_) { toast('Export failed'); }
  });

  async function enterApp() {
    showScreen('app');
    await load();
  }

  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  function stars(n) {
    n = Number(n) || 0;
    return '<span class="stars">' + '★'.repeat(n) + '<span class="off">' + '★'.repeat(5 - n) + '</span></span>';
  }

  function renderStats(summary) {
    const avg = summary.avgRating == null ? '–' : summary.avgRating;
    $('stats').innerHTML = `
      <div class="stat"><div class="k">Responses</div><div class="v">${summary.total}</div></div>
      <div class="stat"><div class="k">Avg rating</div><div class="v">${avg}<small> / 5</small></div></div>
      <div class="stat"><div class="k">Roles</div><div class="v">${summary.roles.length}</div></div>`;

    const feats = summary.features;
    if (!feats.length) { $('feature-panel').innerHTML = ''; return; }
    const max = Math.max(...feats.map((f) => f[1]));
    const rows = feats.map(([name, n]) => `
      <div class="bar-row">
        <span class="lbl">${esc(name)}</span>
        <span class="track"><span class="fill" style="width:${Math.round((n / max) * 100)}%"></span></span>
        <span class="n">${n}</span>
      </div>`).join('');
    $('feature-panel').innerHTML = `<div class="panel-title">Most-wanted features</div>
      <div class="stat"><div class="bars">${rows}</div></div>`;
  }

  function renderList(rows) {
    if (!rows.length) {
      $('resp-list').innerHTML = `<div class="empty">No responses yet. Share your <a href="/" target="_blank" rel="noopener">form</a> and they'll show up here.</div>`;
      return;
    }
    $('resp-list').innerHTML = rows.map((r) => {
      const d = r.data || {};
      const feats = (d.features || []).map((f) => `<span class="chip">${esc(f)}</span>`).join('') || '<span class="muted">–</span>';
      return `<details class="resp">
        <summary>
          <span class="who">${esc(d.name || 'Anonymous')} <span class="role">· ${esc(d.role || '')}</span></span>
          ${stars(d.rating)}
          <span class="when">${esc(fmtDate(r.submittedAt))}</span>
        </summary>
        <dl class="resp-detail">
          <dt>Email</dt><dd><a class="email-link" href="mailto:${esc(d.email || '')}">${esc(d.email || '–')}</a></dd>
          <dt>Team size</dt><dd>${esc(d.teamSize == null ? '–' : d.teamSize)}</dd>
          <dt>Features</dt><dd>${feats}</dd>
          <dt>Notes</dt><dd>${d.notes ? esc(d.notes) : '<span class="muted">–</span>'}</dd>
        </dl>
      </details>`;
    }).join('');
  }

  async function load() {
    try {
      const res = await fetch('/admin/submissions', { headers: { Authorization: authHeader() } });
      if (res.status === 401) { signout(); return; }
      const { submissions, summary } = await res.json();
      renderStats(summary);
      renderList(submissions);
    } catch (_) { toast('Could not load responses'); }
  }

  // Boot: resume a stored session, else decide between first-run setup and login.
  (async () => {
    if (password) {
      try {
        const r = await fetch('/admin/verify', { headers: { Authorization: authHeader() } });
        if (r.ok) { enterApp(); return; }
      } catch (_) { /* fall through to status check */ }
      sessionStorage.removeItem(KEY); password = '';
    }
    try {
      const { configured } = await (await fetch('/admin/status')).json();
      showScreen(configured ? 'login' : 'setup');
    } catch (_) { showScreen('login'); }
  })();
})();
