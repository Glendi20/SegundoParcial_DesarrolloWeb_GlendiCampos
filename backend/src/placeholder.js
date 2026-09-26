/** Imagen SVG ilustrativa para vehículos de ejemplo que no tienen foto real. */
const VISTAS = ['Vista frontal', 'Vista lateral', 'Vista trasera', 'Interior', 'Motor'];

const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));

function svg(titulo, n, color = '#2563eb') {
  const c = /^#[0-9a-f]{3,6}$/i.test(color) ? color : '#2563eb';
  const vista = VISTAS[(n - 1) % VISTAS.length];
  const carro = `
    <g transform="translate(160 150)">
      <ellipse cx="240" cy="228" rx="250" ry="18" fill="#000" opacity=".12"/>
      <path d="M20 170 C20 130 50 118 95 112 L160 60 C180 44 205 38 235 38 L330 38 C360 38 380 48 400 66 L450 112 C500 118 520 135 520 170 L520 195 L20 195 Z" fill="${c}" stroke="#0f172a" stroke-width="4"/>
      <path d="M175 70 L230 50 L325 50 L330 110 L150 110 Z" fill="#dbeafe" stroke="#0f172a" stroke-width="3"/>
      <path d="M345 50 C370 52 385 62 400 78 L425 110 L345 110 Z" fill="#dbeafe" stroke="#0f172a" stroke-width="3"/>
      <rect x="480" y="140" width="34" height="14" rx="4" fill="#fde68a"/>
      <rect x="26" y="140" width="26" height="14" rx="4" fill="#fca5a5"/>
      <circle cx="130" cy="195" r="42" fill="#1e293b"/><circle cx="130" cy="195" r="18" fill="#cbd5e1"/>
      <circle cx="410" cy="195" r="42" fill="#1e293b"/><circle cx="410" cy="195" r="18" fill="#cbd5e1"/>
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#e2e8f0"/></linearGradient></defs>
  <rect width="900" height="600" fill="url(#g)"/>
  <rect x="0" y="470" width="900" height="130" fill="#cbd5e1"/>
  ${carro}
  <text x="40" y="70" font-family="Segoe UI, Arial" font-size="34" font-weight="700" fill="#0f172a">${esc(titulo)}</text>
  <text x="40" y="110" font-family="Segoe UI, Arial" font-size="24" fill="#475569">${vista} · foto ${n}</text>
  <text x="860" y="570" text-anchor="end" font-family="Segoe UI, Arial" font-size="18" fill="#64748b">Imagen ilustrativa</text>
</svg>`;
}

module.exports = { svg };
