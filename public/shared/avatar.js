// Avatares: catálogo + desenho SVG. Usado pelo celular, pelo projetor e pelo admin.
// Coordenadas: viewBox 0 0 100 100, personagem centrado em (50,52), pode vazar (overflow visível).

export const INK = '#2B2140';

export const BODY_COLORS = ['#FF7A6B', '#FFA552', '#FFD449', '#B5E655', '#5FD4A0', '#3CC8C8', '#5BB8FF', '#6C8CFF',
  '#A98BFF', '#C66BE0', '#FF8FC7', '#FF5FA2', '#C98B5E', '#8D6E63', '#F2E8DC', '#7C8494'];
export const ACCENT_COLORS = ['#FF5A5F', '#3A86FF', '#FFD23F', '#3BB273', '#8338EC', '#2B2140'];
export const VEHICLE_COLORS = ['#FF5A5F', '#FF9F1C', '#FFD23F', '#3BB273', '#2EC4B6', '#3A86FF', '#8338EC', '#FF70A6', '#2B2140', '#F4F1EA'];

export const SHAPE_NAMES = ['Bolinha', 'Feijão', 'Gotinha', 'Quadradinho'];
export const EYE_NAMES = ['Pontinhos', 'Brilhantes', 'Felizes', 'Piscadinha', 'Sono', 'Estrela', 'Coração', 'Surpresa', 'Determinado', 'Anime'];
export const MOUTH_NAMES = ['Sorriso', 'Sorrisão', 'Língua', 'Ó', 'Gatinho', 'Sério', 'De lado', 'Dentinho', 'Assobio', 'Ondinha'];
export const TOP_NAMES = ['Nada', 'Broto', 'Boné', 'Gorro', 'Laço', 'Coroa', 'Festa', 'Cartola', 'Cowboy', 'Capelo', 'Fone',
  'Gatinho', 'Coelho', 'Auréola', 'Antena', 'Topete', 'Coque', 'Flor', 'Chef', 'Chifrinhos', 'Bruxa', 'Boina', 'Cachinhos', 'Capacete'];
export const GLASSES_NAMES = ['Nenhum', 'Redondo', 'Quadrado', 'Escuro', 'Estrela', 'Coração', 'Monóculo', 'Visor'];
export const VEHICLE_NAMES = ['A pé', 'Bike', 'Skate', 'Carrinho', 'Patinete', 'Lambreta', 'Patins', 'Monociclo', 'Balão', 'Foguete'];

export const TABS = [
  { key: 'c', label: 'Cor', count: BODY_COLORS.length },
  { key: 's', label: 'Formato', count: SHAPE_NAMES.length, names: SHAPE_NAMES },
  { key: 'e', label: 'Olhos', count: EYE_NAMES.length, names: EYE_NAMES },
  { key: 'm', label: 'Boca', count: MOUTH_NAMES.length, names: MOUTH_NAMES },
  { key: 't', label: 'Cabeça', count: TOP_NAMES.length, names: TOP_NAMES },
  { key: 'k', label: 'Cor do acessório', count: ACCENT_COLORS.length },
  { key: 'g', label: 'Óculos', count: GLASSES_NAMES.length, names: GLASSES_NAMES },
  { key: 'v', label: 'Veículo', count: VEHICLE_NAMES.length, names: VEHICLE_NAMES },
  { key: 'vc', label: 'Cor do veículo', count: VEHICLE_COLORS.length },
];

export function randomAvatar() {
  const r = n => Math.floor(Math.random() * n);
  const a = {};
  for (const t of TABS) a[t.key] = r(t.count);
  return a;
}

// ---------- utilitários ----------
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const f = c => Math.round((t - c) * p + c);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
const S = (d, stroke, w = 2.4, extra = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const P = (d, fill, stroke = 'none', w = 0, extra = '') => `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" stroke-linejoin="round" ${extra}/>`;
const C = (cx, cy, r, fill, stroke = 'none', w = 0) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${w}"/>`;
const E = (cx, cy, rx, ry, fill, stroke = 'none', w = 0, extra = '') => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${w}" ${extra}/>`;

function starPath(cx, cy, r) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    d += `${i ? 'L' : 'M'}${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)} `;
  }
  return d + 'Z';
}
function heartPath(x, y, s = 1) {
  return `M${x} ${y + 3.2 * s} C${x - 6.5 * s} ${y - 1.5 * s} ${x - 3.5 * s} ${y - 7.5 * s} ${x} ${y - 3 * s} C${x + 3.5 * s} ${y - 7.5 * s} ${x + 6.5 * s} ${y - 1.5 * s} ${x} ${y + 3.2 * s} Z`;
}

// ---------- corpo ----------
const HEAD_TOP = [29, 27, 25, 30];
function bodyShape(s, fill, stroke) {
  const a = `fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"`;
  switch (s) {
    case 1: return `<rect x="29" y="27" width="42" height="50" rx="21" ${a}/>`;
    case 2: return `<path d="M50 25 C59 35 73 42 73 56 C73 69 63 76 50 76 C37 76 27 69 27 56 C27 42 41 35 50 25 Z" ${a}/>`;
    case 3: return `<rect x="27" y="30" width="46" height="44" rx="15" ${a}/>`;
    default: return `<circle cx="50" cy="52" r="23" ${a}/>`;
  }
}

function eyes(e) {
  const both = f => f(42) + f(58);
  switch (e) {
    case 1: return both(x => C(x, 49, 6, '#fff', INK, 1.5) + C(x + 0.8, 50, 3.4, INK) + C(x + 2, 48.4, 1.2, '#fff'));
    case 2: return S('M37.5 50.5 Q42 44.5 46.5 50.5', INK, 2.6) + S('M53.5 50.5 Q58 44.5 62.5 50.5', INK, 2.6);
    case 3: return C(42, 49, 3.4, INK) + C(43, 48, 1, '#fff') + S('M53.5 50.5 Q58 44.5 62.5 50.5', INK, 2.6);
    case 4: return S('M37.5 48.5 Q42 53 46.5 48.5', INK, 2.4) + S('M53.5 48.5 Q58 53 62.5 48.5', INK, 2.4);
    case 5: return both(x => P(starPath(x, 49, 5.2), INK) + C(x + 1, 48, 0.9, '#fff'));
    case 6: return both(x => P(heartPath(x, 49.5, 1), '#FF4D6D', shade('#FF4D6D', -0.3), 1));
    case 7: return both(x => C(x, 49, 6.2, '#fff', INK, 1.6) + C(x, 49, 2.2, INK));
    case 8: return both(x => C(x, 50, 3.2, INK)) + S('M36.5 43 L46 45.5', INK, 2.4) + S('M63.5 43 L54 45.5', INK, 2.4);
    case 9: return both(x => E(x, 49, 3.6, 5, INK) + C(x + 1.2, 47.2, 1.6, '#fff') + C(x - 1, 51.5, 0.8, '#fff'));
    default: return both(x => C(x, 49, 3.4, INK) + C(x + 1, 48, 1, '#fff'));
  }
}

function mouth(m) {
  switch (m) {
    case 1: return P('M43.5 56.5 Q50 67 56.5 56.5 Z', INK) + P('M46.5 61.6 Q50 59.6 53.5 61.6 Q50 64.6 46.5 61.6 Z', '#FF7A9C');
    case 2: return S('M44.5 57.5 Q50 62.5 55.5 57.5', INK) + P('M49 59.9 q1.8 5 3.8 0', '#FF7A9C', INK, 1.3);
    case 3: return E(50, 59, 2.8, 3.4, INK);
    case 4: return S('M44 57.5 q3 3.2 6 0 q3 3.2 6 0', INK, 2.2);
    case 5: return S('M45.5 59 h9', INK);
    case 6: return S('M45 59.5 Q51.5 62 56 56.5', INK);
    case 7: return P('M43.5 57 Q50 64.5 56.5 57 Z', INK) + `<rect x="48.2" y="57" width="3.6" height="2.8" rx="0.6" fill="#fff"/>`;
    case 8: return C(52, 59, 2.2, 'none', INK, 2);
    case 9: return S('M43.5 59.5 q1.6 -2.2 3.25 0 q1.6 2.2 3.25 0 q1.6 -2.2 3.25 0 q1.6 2.2 3.25 0', INK, 2.1);
    default: return S('M44.5 57.5 Q50 63 55.5 57.5', INK);
  }
}

function glasses(g) {
  const temples = S('M34.5 47.5 L29 46', INK, 1.8) + S('M65.5 47.5 L71 46', INK, 1.8);
  switch (g) {
    case 1: return C(42, 49, 7.2, 'rgba(255,255,255,.25)', INK, 2.2) + C(58, 49, 7.2, 'rgba(255,255,255,.25)', INK, 2.2) + S('M49 48 Q50 46.6 51 48', INK, 2) + temples;
    case 2: return `<rect x="34" y="43.5" width="15" height="11.5" rx="3" fill="rgba(255,255,255,.25)" stroke="${INK}" stroke-width="2.2"/><rect x="51" y="43.5" width="15" height="11.5" rx="3" fill="rgba(255,255,255,.25)" stroke="${INK}" stroke-width="2.2"/>` + S('M49 48 h2', INK, 2) + temples;
    case 3: return `<rect x="33.5" y="44" width="16" height="10" rx="4.5" fill="${INK}"/><rect x="50.5" y="44" width="16" height="10" rx="4.5" fill="${INK}"/>` + S('M37 46.5 l4 0', 'rgba(255,255,255,.6)', 1.4) + S('M54 46.5 l4 0', 'rgba(255,255,255,.6)', 1.4) + S('M49 47 h2', INK, 2) + temples;
    case 4: return P(starPath(42, 49, 9), 'rgba(255,210,63,.6)', INK, 1.6) + P(starPath(58, 49, 9), 'rgba(255,210,63,.6)', INK, 1.6);
    case 5: return P(heartPath(42, 50.5, 1.65), 'rgba(255,77,109,.5)', '#C9184A', 1.8) + P(heartPath(58, 50.5, 1.65), 'rgba(255,77,109,.5)', '#C9184A', 1.8) + S('M49.5 47.5 h1', '#C9184A', 1.8);
    case 6: return C(58, 49, 7.5, 'rgba(255,255,255,.2)', '#D99A00', 2.4) + S('M63 55 Q66 66 59 72', '#D99A00', 1.2);
    case 7: return `<rect x="31" y="43.5" width="38" height="11" rx="5.5" fill="rgba(46,196,182,.72)" stroke="${INK}" stroke-width="2"/>` + S('M36 46.5 h9', 'rgba(255,255,255,.75)', 1.6);
    default: return '';
  }
}

function top(t, body, k) {
  const kd = shade(k, -0.3);
  switch (t) {
    case 1: return S('M50 30 Q50 22 51 17', '#3BB273', 2.6) + P('M51 19 Q43 11 37 16 Q43 22 51 19Z', '#5FD4A0', '#2E8B57', 1.3) + P('M51 18 Q58 8 65 13 Q59 20 51 18Z', '#5FD4A0', '#2E8B57', 1.3);
    case 2: return P('M30 37 Q30 16 50 16 Q70 16 70 37 Z', k, kd, 2) + P('M60 34 Q78 32 86 37 Q77 41 60 39Z', kd, kd, 1) + C(50, 16, 2.2, kd);
    case 3: return P('M28.5 39 Q28.5 14 50 14 Q71.5 14 71.5 39 Z', k, kd, 2) + `<rect x="26.5" y="33" width="47" height="8" rx="4" fill="${kd}"/>` + C(50, 12, 5.2, '#F4F1EA', '#D9D2C5', 1.4);
    case 4: return P('M64 27 L53 19 Q49.5 27 53 35 Z', k, kd, 1.6) + P('M64 27 L75 19 Q78.5 27 75 35 Z', k, kd, 1.6) + C(64, 27, 3.4, kd);
    case 5: return P('M33 34 L35 15 L42.5 24 L50 11 L57.5 24 L65 15 L67 34 Z', '#FFD23F', '#C99A00', 1.6) + C(42, 29, 2, '#FF5A5F') + C(50, 28, 2.4, '#3A86FF') + C(58, 29, 2, '#3BB273');
    case 6: return P('M38 32 L50 2 L62 32 Z', k, kd, 1.6) + C(47, 23, 1.8, '#fff') + C(53.5, 16, 1.6, '#fff') + C(50, 9, 1.4, '#fff') + C(55, 26, 1.6, '#FFD23F') + C(50, 2, 3.6, '#FFD23F', '#C99A00', 1);
    case 7: return E(50, 30, 19, 3.8, INK) + `<rect x="37.5" y="7" width="25" height="23" rx="2" fill="${INK}"/><rect x="37.5" y="22" width="25" height="4.5" fill="${k}"/>`;
    case 8: return P('M35 29 Q34 11 43 11 Q50 15 57 11 Q66 11 65 29 Z', '#C98B5E', '#6B4226', 1.6) + `<rect x="34.5" y="24" width="31" height="4" fill="#6B4226"/>` + P('M20 30 Q50 39 80 30 Q74 24 66 27.5 L34 27.5 Q26 24 20 30 Z', '#A86B3C', '#6B4226', 1.6);
    case 9: return P('M35.5 21 L35.5 31 Q50 36 64.5 31 L64.5 21 Z', '#3A2F55') + P('M50 8 L79 18 L50 28 L21 18 Z', INK, INK, 1) + S('M50 18 L73 21 L73 33', '#FFD23F', 1.6) + `<rect x="71" y="32" width="4" height="5" rx="1" fill="#FFD23F"/>`;
    case 10: return S('M27 47 Q27 17 50 17 Q73 17 73 47', k, 4.6) + `<rect x="21" y="40" width="10" height="16" rx="4.5" fill="${k}" stroke="${kd}" stroke-width="1.6"/><rect x="69" y="40" width="10" height="16" rx="4.5" fill="${k}" stroke="${kd}" stroke-width="1.6"/>`;
    case 11: return P('M30 37 L32 15 L46 29 Z', body, shade(body, -0.28), 2.2) + P('M33.6 31 L34.6 21 L41.5 27.5 Z', '#FF8FA3') + P('M70 37 L68 15 L54 29 Z', body, shade(body, -0.28), 2.2) + P('M66.4 31 L65.4 21 L58.5 27.5 Z', '#FF8FA3');
    case 12: return E(41, 14, 5.6, 14, body, shade(body, -0.28), 2.2, 'transform="rotate(-12 41 14)"') + E(41, 15, 2.6, 9, '#FF8FA3', 'none', 0, 'transform="rotate(-12 41 15)"') + E(59, 14, 5.6, 14, body, shade(body, -0.28), 2.2, 'transform="rotate(12 59 14)"') + E(59, 15, 2.6, 9, '#FF8FA3', 'none', 0, 'transform="rotate(12 59 15)"');
    case 13: return E(50, 14, 14, 4, 'none', '#FFD23F', 3.6) + E(50, 14, 14, 4, 'none', 'rgba(255,240,170,.8)', 1.2);
    case 14: return S('M50 30 L50 13', INK, 2) + C(50, 10, 4.2, k, kd, 1.4) + C(48.8, 8.8, 1.2, '#fff');
    case 15: return P('M32 35 L35 17 L41.5 27 L46.5 10 L52 26 L58 13 L62 27 L69 19 L68 35 Z', k, kd, 1.8);
    case 16: return C(50, 18, 8.5, k, kd, 1.8) + P('M29 40 Q29 26 50 26 Q71 26 71 40 Q61 31 50 31 Q39 31 29 40 Z', k, kd, 1.6);
    case 17: return [0, 1, 2, 3, 4].map(i => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return C((66 + 5.2 * Math.cos(a)).toFixed(2), (27 + 5.2 * Math.sin(a)).toFixed(2), 4.4, '#FF8FC7', '#E0609A', 1); }).join('') + C(66, 27, 3.4, '#FFD23F', '#D9A400', 1);
    case 18: return P('M36 31 L36 22 Q29 22 29 15 Q29 7.5 37.5 8.5 Q40.5 2.5 50 3.5 Q59.5 2.5 62.5 8.5 Q71 7.5 71 15 Q71 22 64 22 L64 31 Z', '#fff', '#D9D2C5', 1.6) + S('M36 26 h28', '#E8E1D4', 1.6);
    case 19: return P('M36.5 33 Q30.5 23 35.5 13 Q38.5 24 44 29.5 Z', '#E63946', '#A4161A', 1.4) + P('M63.5 33 Q69.5 23 64.5 13 Q61.5 24 56 29.5 Z', '#E63946', '#A4161A', 1.4);
    case 20: return E(50, 30, 23, 4.8, '#5B3A8C', '#3E2563', 1.4) + P('M36 29.5 Q46 22 47 3 L63 13 Q57 18 64 29.5 Z', '#7B4FBF', '#3E2563', 1.6) + `<rect x="38" y="24.5" width="24" height="4" fill="#FFD23F"/>`;
    case 21: return P('M29 33 Q27 19 46 17 Q69 15 73 28 Q71 34 29 33 Z', k, kd, 1.8) + C(52, 15.5, 2.4, kd);
    case 22: return [[33, 33], [41, 25.5], [50, 23], [59, 25.5], [67, 33]].map(([x, y]) => C(x, y, 6.8, k, kd, 1.6)).join('');
    case 23: return P('M27.5 41 Q27.5 16 50 16 Q72.5 16 72.5 41 Z', k, kd, 2) + S('M43 18 L41 32', 'rgba(255,255,255,.85)', 2.6) + S('M50 17 L50 32', 'rgba(255,255,255,.85)', 2.6) + S('M57 18 L59 32', 'rgba(255,255,255,.85)', 2.6) + `<rect x="27" y="37" width="46" height="4.5" rx="2.2" fill="${kd}"/>`;
    default: return '';
  }
}

function character(a, opts) {
  const body = BODY_COLORS[a.c] || BODY_COLORS[0];
  const k = ACCENT_COLORS[a.k] || ACCENT_COLORS[0];
  const line = shade(body, -0.28);
  const dy = (HEAD_TOP[a.s] ?? 29) - 29;
  const feet = opts.feet ? E(42, 76.5, 6.2, 3.6, shade(body, -0.32)) + E(58, 76.5, 6.2, 3.6, shade(body, -0.32)) : '';
  const arms = E(26.5, 59, 4, 6, body, line, 2, 'transform="rotate(20 26.5 59)"') + E(73.5, 59, 4, 6, body, line, 2, 'transform="rotate(-20 73.5 59)"');
  return feet + arms + bodyShape(a.s, body, line)
    + E(40, 37, 6, 3.6, 'rgba(255,255,255,.4)', 'none', 0, 'transform="rotate(-25 40 37)"')
    + E(35.5, 56, 4.2, 2.8, '#FF8FA3', 'none', 0, 'opacity=".55"') + E(64.5, 56, 4.2, 2.8, '#FF8FA3', 'none', 0, 'opacity=".55"')
    + eyes(a.e) + mouth(a.m) + glasses(a.g)
    + `<g transform="translate(0 ${dy})">${top(a.t, body, k)}</g>`;
}

// ---------- veículos ----------
function wheel(cx, cy, r, kind = 'solid') {
  if (kind === 'ring') {
    return `<g class="wheel">${C(cx, cy, r, 'rgba(255,255,255,.35)', INK, 3)}${S(`M${cx - r * 0.8} ${cy} L${cx + r * 0.8} ${cy} M${cx} ${cy - r * 0.8} L${cx} ${cy + r * 0.8}`, INK, 1.2)}${C(cx, cy, 1.8, INK)}</g>`;
  }
  return `<g class="wheel">${C(cx, cy, r, INK)}${C(cx, cy, r * 0.45, '#E9E4DA')}${S(`M${cx} ${cy - r * 0.45} L${cx} ${cy - r * 0.85}`, '#E9E4DA', 1.6)}</g>`;
}

function vehicle(v, vc) {
  const d = shade(vc, -0.3);
  switch (v) {
    case 1: return { // bike
      char: { cy: 43, k: 0.78 }, feet: false,
      back: '',
      front: wheel(24, 84, 12, 'ring') + wheel(76, 84, 12, 'ring')
        + S('M24 84 L44 84 L59 66 L76 84 M44 84 L38 64 M59 66 L62 57 L70 57', vc, 3.4)
        + `<rect x="31" y="61.5" width="14" height="4.5" rx="2.2" fill="${INK}"/>`,
    };
    case 2: return { // skate
      char: { cy: 46, k: 0.82 }, feet: true,
      back: '',
      front: P('M20 72 Q22 77 27 77 L73 77 Q78 77 80 72 Q76 74 73 73.5 L27 73.5 Q24 74 20 72 Z', vc, d, 1.6) + wheel(32, 82, 4.6) + wheel(68, 82, 4.6),
    };
    case 3: return { // carrinho
      char: { cy: 41, k: 0.8 }, feet: false,
      back: P('M24 63 Q26 50 38 50 L62 50 Q74 50 76 63 Z', 'rgba(255,255,255,.55)', d, 1.6),
      front: P('M12 72 Q12 62 24 62 L76 62 Q88 62 88 72 L89 82 Q89 88 82 88 L18 88 Q11 88 11 82 Z', vc, d, 2)
        + S('M20 69 L80 69', 'rgba(255,255,255,.45)', 2.4) + C(84, 74, 3, '#FFE08A', '#D9A400', 1) + `<rect x="10" y="73" width="5" height="4" rx="1.5" fill="#FF5A5F"/>`
        + wheel(28, 88, 8.5) + wheel(72, 88, 8.5),
    };
    case 4: return { // patinete
      char: { cy: 45, k: 0.8 }, feet: true,
      back: '',
      front: `<rect x="24" y="70" width="48" height="5" rx="2.5" fill="${vc}" stroke="${d}" stroke-width="1.4"/>` + S('M69 72 L76 38', '#9AA0AE', 3.2) + S('M70 38 L82 38', INK, 3.6) + wheel(29, 80, 5) + wheel(72, 80, 5),
    };
    case 5: return { // lambreta
      char: { cy: 41, k: 0.78 }, feet: false,
      back: '',
      front: E(33, 74, 19, 12, vc, d, 2) + `<rect x="38" y="78" width="26" height="5" rx="2.5" fill="${d}"/>`
        + P('M60 83 L66 52 Q68 46 74 46 L78 47 L71 83 Z', vc, d, 2) + S('M70 48 L83 45', INK, 3.2) + C(78, 51, 3.2, '#FFE08A', '#D9A400', 1)
        + `<rect x="18" y="62" width="22" height="5" rx="2.5" fill="${INK}"/>` + wheel(25, 88, 8) + wheel(70, 88, 8),
    };
    case 6: return { // patins
      char: { cy: 45, k: 0.88 }, feet: false,
      back: '',
      front: [36, 56].map(x => `<rect x="${x}" y="64" width="11" height="9" rx="3.5" fill="${vc}" stroke="${d}" stroke-width="1.4"/><rect x="${x - 0.5}" y="71" width="12" height="2.6" rx="1.2" fill="${d}"/>` + wheel(x + 2.5, 76.5, 2.6) + wheel(x + 8.5, 76.5, 2.6)).join(''),
    };
    case 7: return { // monociclo
      char: { cy: 42, k: 0.78 }, feet: false,
      back: '',
      front: S('M50 66 L50 84', '#9AA0AE', 3) + E(50, 64, 9, 3.4, INK) + S('M44 84 L56 84', vc, 3) + wheel(50, 84, 12, 'ring')
        + `<rect x="40" y="82" width="5" height="3" rx="1" fill="${vc}"/><rect x="55" y="82" width="5" height="3" rx="1" fill="${vc}"/>`,
    };
    case 8: return { // balão
      char: { cy: 56, k: 0.82 }, feet: false, floating: true,
      back: S('M68 58 Q74 40 80 26', '#9AA0AE', 1.2) + S('M68 58 Q80 48 91 38', '#9AA0AE', 1.2)
        + E(80, 16, 9.5, 11, vc, d, 1.6) + P('M78.5 27 L81.5 27 L80 29.5 Z', d) + E(77, 12, 2.4, 3.6, 'rgba(255,255,255,.55)')
        + E(91, 30, 8, 9.5, '#FF70A6', shade('#FF70A6', -0.3), 1.6) + E(88.5, 26.5, 2, 3, 'rgba(255,255,255,.55)'),
      front: '',
    };
    case 9: return { // foguete
      char: { cy: 42, k: 0.78 }, feet: false,
      back: '',
      front: P('M4 79 L18 73 L18 85 Z', '#FF9F1C') + P('M9 79 L18 76 L18 82 Z', '#FFD23F')
        + P('M18 70 L76 70 Q94 70 96 79 Q94 88 76 88 L18 88 Z', vc, d, 2)
        + C(58, 79, 4.2, '#BDE7FF', d, 1.6) + P('M24 70 L16 62 L32 70 Z', d) + P('M24 88 L16 96 L32 88 Z', d),
    };
    default: return { char: { cy: 46, k: 0.92 }, feet: true, back: '', front: '' }; // a pé
  }
}

export function avatarInner(a) {
  a = a || {};
  const vc = VEHICLE_COLORS[a.vc] || VEHICLE_COLORS[0];
  const veh = vehicle(a.v || 0, vc);
  const { cy, k } = veh.char;
  const ch = `<g transform="translate(50 ${cy}) scale(${k}) translate(-50 -52)">${character(a, { feet: veh.feet })}</g>`;
  return veh.back + ch + veh.front;
}

export function avatarSVG(a, cls = '') {
  return `<svg class="avatar ${cls}" viewBox="0 0 100 100" overflow="visible" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${avatarInner(a)}</svg>`;
}

// miniatura de cor (para as abas de cor)
export function swatchSVG(color) {
  return `<svg class="swatch" viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" fill="${color}" stroke="${shade(color, -0.25)}" stroke-width="3"/></svg>`;
}
