// Tiny HTML-escaping helper. Use this on any user-supplied value (e.g. contact
// message name/email/body) before interpolating it into HTML — otherwise a
// stored value can execute as script (stored XSS) in an admin viewer page.
function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { escapeHtml };
