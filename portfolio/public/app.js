document.getElementById('year').textContent = new Date().getFullYear();

// Mobile nav toggle
const siteNav = document.getElementById('site-nav');
const navToggle = document.getElementById('nav-toggle');
if (siteNav && navToggle) {
  navToggle.addEventListener('click', () => {
    const open = siteNav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });
  siteNav.querySelectorAll('nav a').forEach((link) => {
    link.addEventListener('click', () => {
      siteNav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const form = document.getElementById('contact-form');
const status = document.getElementById('contact-status');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.hidden = false;
  status.className = 'status';
  status.textContent = 'Sending…';
  const data = {
    name: form.elements.name.value.trim(),
    email: form.elements.email.value.trim(),
    message: form.elements.message.value.trim(),
  };
  const res = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.ok) {
    form.reset();
    status.className = 'status success';
    status.textContent = 'Thanks — I\'ll get back to you.';
    return;
  }
  let body = null;
  try { body = await res.json(); } catch (_) {}
  status.className = 'status error';
  status.textContent = body && body.fields
    ? Object.values(body.fields).join(' • ')
    : 'Something went wrong. Please try again.';
});
