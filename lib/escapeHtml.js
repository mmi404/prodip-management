// Escape user-controlled text before interpolating it into an HTML string
// (used by the audit print view, which document.write()s into a same-origin iframe).
export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
