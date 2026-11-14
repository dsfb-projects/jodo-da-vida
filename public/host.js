import { avatarSVG, shade } from '/shared/avatar.js';
import { mountAdmin, updateAdmin, connectHost, nextLabel, phaseLabel } from '/shared/controls.js';

const W = 1600, H = 900;
const stage = document.getElementById('stage');
const sceneEl = document.getElementById('scene');
const signsEl = document.getElementById('signs');
const pawnsEl = document.getElementById('pawns');
const hudEl = document.getElementById('hud');
const overlayEl = document.getElementById('overlay');
const underEl = document.getElementById('under');

const OPT_COLORS = ['#FF7A6B', '#5BB8FF', '#5FD4A0', '#A98BFF'];
const START = { x: 470, y: 560 };
const PLAZA = { x: 40, y: 250, w: 430, h: 615 };
const END_X = 1290;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let S = null;        // último estado
let offset = 0;      // relógio do servidor
let joinUrl = location.origin + '/';
fetch('/join-url').then(r => r.json()).then(j => { joinUrl = j.url; const el = document.getElementById('joinurl'); if (el) el.textContent = prettyUrl(joinUrl); }).catch(() => {});
const prettyUrl = u => u.replace(/^https?:\/\//, '').replace(/\/$/, '');

// ---------- escala do palco ----------
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  const x = (innerWidth - W * s) / 2, y = (innerHeight - H * s) / 2;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
}
addEventListener('resize', fit);
fit();

// ---------- aleatório com semente (cenário estável) ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hashStr(s) { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }

// ---------- cenário ----------
const THEMES = {
  dia: { sky: ['#BFE7FF', '#EAF7FF'], ground: '#BFEBC8', ground2: '#A9E0B6', plaza: '#FFF4DC', plazaLine: '#F0D9A8' },
  noite: { sky: ['#2E3A6E', '#565C9E'], ground: '#7FB996', ground2: '#6EA986', plaza: '#F4E9D3', plazaLine: '#D9C59C' },
  chuva: { sky: ['#9FB3C8', '#D2DDE7'], ground: '#B3DDBF', ground2: '#9ECFAD', plaza: '#F7F0E2', plazaLine: '#DCCDAF' },
  cidade: { sky: ['#FFB38A', '#FFE0A8'], ground: '#C9EBC3', ground2: '#B5E0AE', plaza: '#FFF1DC', plazaLine: '#F2D3A3' },
};

function destYs(n) {
  if (n <= 1) return [560];
  if (n === 2) return [345, 770];
  if (n === 3) return [285, 560, 815];
  return [255, 445, 635, 825];
}
function branchD(y) {
  return `M ${START.x} ${START.y} C 760 ${START.y}, 880 ${y}, 1130 ${y} L ${END_X} ${y}`;
}

function tree(x, y, s, c) {
  return `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-6" y="-8" width="12" height="34" rx="5" fill="#A0703F"/>
    <circle cx="0" cy="-30" r="30" fill="${c}"/><circle cx="-20" cy="-14" r="20" fill="${c}"/><circle cx="20" cy="-14" r="20" fill="${c}"/>
    <circle cx="-8" cy="-40" r="9" fill="rgba(255,255,255,.25)"/><ellipse cx="0" cy="28" rx="30" ry="7" fill="rgba(0,0,0,.08)"/></g>`;
}
function bush(x, y, c) {
  return `<g transform="translate(${x} ${y})"><circle cx="-16" cy="0" r="16" fill="${c}"/><circle cx="4" cy="-8" r="20" fill="${c}"/><circle cx="22" cy="2" r="14" fill="${c}"/><ellipse cx="2" cy="16" rx="34" ry="6" fill="rgba(0,0,0,.07)"/></g>`;
}
function flowers(x, y, r) {
  const cols = ['#FF8FC7', '#FFD449', '#FFFFFF', '#A98BFF'];
  let g = '';
  for (let i = 0; i < 5; i++) {
    const fx = x + (r() - 0.5) * 60, fy = y + (r() - 0.5) * 30, c = cols[Math.floor(r() * cols.length)];
    g += `<circle cx="${fx}" cy="${fy}" r="5" fill="${c}"/><circle cx="${fx}" cy="${fy}" r="2" fill="#E0A100"/>`;
  }
  return g;
}
function house(x, y, c) {
  return `<g transform="translate(${x} ${y})"><ellipse cx="0" cy="44" rx="62" ry="9" fill="rgba(0,0,0,.08)"/>
    <rect x="-48" y="-10" width="96" height="54" rx="8" fill="#FFF8EC" stroke="#E6D3B3" stroke-width="3"/>
    <path d="M-60 -6 L0 -52 L60 -6 Z" fill="${c}" stroke="${shade(c, -0.25)}" stroke-width="3" stroke-linejoin="round"/>
    <rect x="-12" y="14" width="24" height="30" rx="5" fill="${shade(c, -0.2)}"/><rect x="-38" y="4" width="18" height="16" rx="4" fill="#BDE7FF"/><rect x="20" y="4" width="18" height="16" rx="4" fill="#BDE7FF"/></g>`;
}
function cloud(x, y, s, c = '#fff') {
  return `<g transform="translate(${x} ${y}) scale(${s})" opacity=".95"><circle cx="0" cy="0" r="26" fill="${c}"/><circle cx="30" cy="-10" r="32" fill="${c}"/><circle cx="62" cy="2" r="24" fill="${c}"/><rect x="0" y="0" width="62" height="24" fill="${c}"/></g>`;
}

function buildScene(dec, d) {
  const th = THEMES[dec.tema] || THEMES.dia;
  const n = dec.opcoes.length;
  const ys = destYs(n);
  const r = rng(1234 + d * 97);
  let defs = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${th.sky[0]}"/><stop offset="1" stop-color="${th.sky[1]}"/></linearGradient></defs>`;
  let sky = `<rect width="1600" height="900" fill="url(#sky)"/>`;
  if (dec.tema === 'noite') {
    for (let i = 0; i < 60; i++) sky += `<circle cx="${r() * 1600}" cy="${r() * 240}" r="${1 + r() * 2}" fill="#fff" opacity="${0.4 + r() * 0.6}"/>`;
    sky += `<circle cx="1230" cy="185" r="38" fill="#FFF3C4"/><circle cx="1246" cy="175" r="34" fill="${th.sky[0]}"/>`;
  } else if (dec.tema === 'cidade') {
    sky += `<circle cx="1200" cy="200" r="60" fill="#FFF0B8" opacity=".9"/>`;
    let x = 0;
    while (x < 1600) {
      const w = 60 + r() * 70, h = 60 + r() * 120;
      sky += `<rect x="${x}" y="${232 - h}" width="${w}" height="${h + 20}" rx="6" fill="${r() > 0.5 ? '#E59A7E' : '#D9876E'}"/>`;
      for (let wy = 232 - h + 14; wy < 222; wy += 22) for (let wx = x + 10; wx < x + w - 14; wx += 20) if (r() > 0.45) sky += `<rect x="${wx}" y="${wy}" width="9" height="11" rx="2" fill="#FFE7A3" opacity=".9"/>`;
      x += w + 6;
    }
  } else if (dec.tema === 'chuva') {
    sky += cloud(980, 175, 1.2, '#E9EEF3') + cloud(1300, 205, 1, '#E3E9EF') + cloud(700, 205, 0.9, '#EEF2F6');
  } else {
    sky += `<circle cx="1210" cy="190" r="44" fill="#FFE27A"/>` + cloud(820, 200, 1, '#fff') + cloud(1360, 215, 0.8, '#fff');
  }
  // chão com ondinha
  const ground = `<path d="M0 230 Q200 205 400 228 T800 226 T1200 228 T1600 222 L1600 900 L0 900 Z" fill="${th.ground}"/>
    <path d="M0 520 Q300 500 600 530 T1200 520 T1600 540 L1600 900 L0 900 Z" fill="${th.ground2}" opacity=".55"/>`;

  // praça de largada
  const plaza = `<rect x="${PLAZA.x}" y="${PLAZA.y}" width="${PLAZA.w}" height="${PLAZA.h}" rx="52" fill="${th.plaza}" stroke="${th.plazaLine}" stroke-width="5" stroke-dasharray="14 12"/>
    <g transform="translate(${PLAZA.x + PLAZA.w / 2} ${PLAZA.y + 2})"><rect x="-90" y="-22" width="180" height="44" rx="22" fill="#2B2140"/><text x="0" y="9" text-anchor="middle" font-size="24" font-weight="700" fill="#fff" font-family="Fredoka, sans-serif">LARGADA</text></g>`;

  // estradas
  const paths = ys.map(y => branchD(y));
  const side = paths.map(p => `<path d="${p}" fill="none" stroke="#F3E7D1" stroke-width="88" stroke-linecap="round"/>`).join('');
  const road = paths.map(p => `<path d="${p}" fill="none" stroke="#6D6585" stroke-width="66" stroke-linecap="round"/>`).join('');
  const dash = paths.map((p, i) => `<path class="branch" data-k="${i}" d="${p}" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-dasharray="22 18" stroke-linecap="round" opacity=".85"/>`).join('');

  // decoração longe das estradas
  sceneEl.innerHTML = defs + sky + ground + plaza + side + road + dash;
  const branchEls = [...sceneEl.querySelectorAll('.branch')];
  const samples = [];
  for (const el of branchEls) {
    const L = el.getTotalLength();
    for (let l = 0; l <= L; l += 18) { const p = el.getPointAtLength(l); samples.push([p.x, p.y]); }
  }
  const far = (x, y, m) => samples.every(([sx, sy]) => (sx - x) ** 2 + (sy - y) ** 2 > m * m);
  let decor = '';
  let houses = 0;
  const greens = ['#5FBF7F', '#4DAE70', '#79C98E', '#3F9E63'];
  const spots = [];
  for (let x = 540; x <= 1250; x += 85) for (let y = 250; y <= 860; y += 75) spots.push([x + (r() - 0.5) * 40, y + (r() - 0.5) * 30]);
  spots.sort(() => r() - 0.5);
  let placed = 0;
  const used = [];
  for (const [x, y] of spots) {
    if (placed > 18) break;
    if (!far(x, y, 78)) continue;
    if (used.some(([ux, uy]) => (ux - x) ** 2 + (uy - y) ** 2 < 85 * 85)) continue;
    const k = r();
    if (k < 0.12 && houses < 2 && y < 790 && far(x, y, 105)) { decor += house(x, y + 10, ['#FF7A6B', '#5BB8FF', '#A98BFF', '#FFB238'][houses + d % 3]); houses++; }
    else if (k < 0.55) decor += tree(x, y, 0.75 + r() * 0.35, greens[Math.floor(r() * greens.length)]);
    else if (k < 0.8) decor += bush(x, y, greens[Math.floor(r() * greens.length)]);
    else decor += flowers(x, y, r);
    used.push([x, y]);
    placed++;
  }
  // margem de baixo e topo direito
  decor += tree(1560, 880, 0.9, '#4DAE70') + bush(560, 880, '#5FBF7F') + flowers(1040, 880, r);
  const rain = dec.tema === 'chuva'
    ? `<g class="rain" opacity=".45">${Array.from({ length: 90 }, () => { const x = r() * 1700, y = r() * 900; return `<line x1="${x}" y1="${y}" x2="${x - 8}" y2="${y + 22}" stroke="#6E8BA8" stroke-width="2.4" stroke-linecap="round"/>`; }).join('')}</g>` : '';
  sceneEl.insertAdjacentHTML('beforeend', decor + rain);
  return branchEls;
}

// estilo da chuva (animação)
const st = document.createElement('style');
st.textContent = `.rain{animation:rain 0.7s linear infinite}@keyframes rain{from{transform:translate(0,-60px)}to{transform:translate(-20px,0)}}`;
document.head.appendChild(st);

let sceneKey = '';
let branches = [];

function renderSigns(s) {
  const dec = s.decision;
  if (!dec || !['intro', 'question', 'reveal'].includes(s.phase)) { signsEl.innerHTML = ''; return; }
  const ys = destYs(dec.opcoes.length);
  const counts = s.counts;
  const total = counts ? counts.reduce((a, b) => a + b, 0) : 0;
  const max = counts ? Math.max(...counts) : -1;
  const manual = s.manual && s.manual[s.d] != null ? Number(s.manual[s.d]) : null;
  signsEl.innerHTML = dec.opcoes.map((o, i) => {
    const c = OPT_COLORS[i % 4];
    const cnt = counts ? `<div style="margin-top:6px;font-size:24px;font-weight:700;background:${c};color:#fff;border-radius:99px;padding:2px 14px">${counts[i]} · ${total ? Math.round(counts[i] / total * 100) : 0}%</div>` : '';
    const star = counts && total && counts[i] === max ? `<div style="position:absolute;top:-18px;right:-10px;background:#FFD449;border-radius:99px;padding:2px 10px;font-size:16px;font-weight:700;box-shadow:0 3px 0 rgba(0,0,0,.15)">⭐ mais escolhida</div>` : '';
    const man = manual === i ? `<div style="position:absolute;top:-18px;left:-10px;background:#2B2140;color:#fff;border-radius:99px;padding:2px 10px;font-size:15px;font-weight:700">turma (manual)</div>` : '';
    const h = counts ? 200 : 160;
    const top = Math.max(178, Math.min(900 - h - 14, ys[i] - h / 2));
    return `<div style="position:absolute;left:1302px;top:${top}px;width:270px;height:${h}px;background:#FFFDF8;border:5px solid ${c};border-radius:30px;box-shadow:0 8px 0 ${shade(c, -0.25)};display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:8px 12px">
      ${star}${man}<div style="font-size:58px;line-height:1">${o.icone}</div><div style="font-size:25px;font-weight:700;line-height:1.1;margin-top:6px">${esc(o.texto)}</div>${cnt}</div>`;
  }).join('');
}

// ---------- peões (avatares) ----------
const pawns = new Map();
let animating = false;

function pawnSize(n, phase) {
  if (phase === 'lobby') return n <= 20 ? 84 : n <= 36 ? 70 : n <= 56 ? 58 : 48;
  return n <= 16 ? 66 : n <= 32 ? 56 : n <= 50 ? 48 : 42;
}

function ensurePawn(p, sz) {
  let pw = pawns.get(p.id);
  if (!pw) {
    const el = document.createElement('div');
    el.className = 'pawn pop';
    el.innerHTML = `<div class="av"><div class="hop" style="width:100%;height:100%"></div><div class="check">✓</div></div><div class="nick"></div>`;
    el.querySelector('.hop').style.animationDelay = `${-(hashStr(p.id) % 700)}ms`;
    pawnsEl.appendChild(el);
    pw = { el, x: START.x, y: START.y, anim: null, avKey: '', nick: '', target: null, mode: '' };
    pawns.set(p.id, pw);
    pw.fresh = true;
  }
  const avKey = JSON.stringify(p.avatar);
  if (avKey !== pw.avKey) { pw.el.querySelector('.hop').innerHTML = avatarSVG(p.avatar); pw.avKey = avKey; }
  if (p.nick !== pw.nick) { pw.el.querySelector('.nick').textContent = p.nick; pw.nick = p.nick; }
  pw.el.style.setProperty('--sz', sz + 'px');
  pw.sz = sz;
  pw.el.classList.toggle('offline', !p.connected);
  return pw;
}

function place(pw) {
  pw.el.style.transform = `translate(${pw.x - pw.sz / 2}px, ${pw.y - pw.sz}px)`;
}

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOut = t => 1 - Math.pow(1 - t, 3);

function tweenTo(pw, x, y, ms = 500, delay = 0) {
  if (pw.target && pw.target.x === x && pw.target.y === y && pw.mode === 'tween') return;
  pw.mode = 'tween';
  pw.target = { x, y };
  if (pw.fresh) { pw.x = x; pw.y = y; pw.fresh = false; pw.anim = null; place(pw); return; }
  pw.anim = { type: 'tween', fx: pw.x, fy: pw.y, tx: x, ty: y, start: performance.now() + delay, dur: ms };
  kick();
}

function travel(pw, pathEl, tSlot, lateral, delay, key) {
  if (pw.mode === 'path' && pw.travelKey === key) return;
  pw.mode = 'path';
  pw.travelKey = key;
  pw.target = null;
  const L = pathEl.getTotalLength();
  pw.fresh = false;
  pw.anim = { type: 'path', path: pathEl, L, tSlot, lateral, fx: pw.x, fy: pw.y, start: performance.now() + delay, d1: 450, d2: 1100 + 1700 * tSlot };
  kick();
}

function pathPoint(a, t) {
  const l = a.L * t;
  const p = a.path.getPointAtLength(l);
  const q = a.path.getPointAtLength(Math.min(a.L, l + 2));
  let dx = q.x - p.x, dy = q.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len; dy /= len;
  const lat = a.lateral * Math.min(1, t / 0.25);
  return { x: p.x - dy * lat, y: p.y + dx * lat };
}

function frame(now) {
  let any = false;
  for (const pw of pawns.values()) {
    const a = pw.anim;
    if (!a) continue;
    any = true;
    if (now < a.start) continue;
    if (a.type === 'tween') {
      const t = Math.min(1, (now - a.start) / a.dur);
      const e = easeOut(t);
      pw.x = a.fx + (a.tx - a.fx) * e;
      pw.y = a.fy + (a.ty - a.fy) * e;
      if (t >= 1) pw.anim = null;
    } else {
      pw.el.classList.add('moving');
      const el = now - a.start;
      if (el < a.d1) {
        const e = easeOut(el / a.d1);
        pw.x = a.fx + (START.x - a.fx) * e;
        pw.y = a.fy + (START.y - a.fy) * e;
      } else {
        const t = Math.min(1, (el - a.d1) / a.d2);
        const pt = pathPoint(a, a.tSlot * ease(t));
        pw.x = pt.x; pw.y = pt.y;
        if (t >= 1) { pw.anim = null; pw.el.classList.remove('moving'); }
      }
    }
    place(pw);
  }
  if (any) requestAnimationFrame(frame);
  else animating = false;
}
function kick() { if (!animating) { animating = true; requestAnimationFrame(frame); } }

function gridSpots(n, rect, sz, seedBase = 0) {
  if (!n) return [];
  const cellH = sz + 26;
  let cell = Math.sqrt((rect.w * rect.h) / n);
  cell = Math.min(cell, sz * 1.9);
  let cols = Math.max(1, Math.floor(rect.w / cell));
  let rows = Math.ceil(n / cols);
  while (rows * Math.min(cell, cellH) > rect.h && cols < n) { cols++; rows = Math.ceil(n / cols); }
  const cw = rect.w / cols;
  const ch = Math.min(rect.h / rows, cellH * 1.4);
  const offY = rect.y + (rect.h - ch * rows) / 2;
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    const inRow = r === rows - 1 ? n - r * cols : cols;
    const offX = rect.x + (rect.w - cw * inRow) / 2;
    const jr = rng(seedBase + i * 31);
    out.push({ x: offX + cw * (c + 0.5) + (jr() - 0.5) * cw * 0.25, y: offY + ch * (r + 0.5) + sz / 2 + (jr() - 0.5) * 8 });
  }
  return out;
}

function layoutPawns(s) {
  const players = s.players || [];
  const ids = new Set(players.map(p => p.id));
  for (const [id, pw] of pawns) if (!ids.has(id)) { pw.el.remove(); pawns.delete(id); }
  const showPawns = ['lobby', 'intro', 'question', 'reveal'].includes(s.phase);
  pawnsEl.style.display = showPawns ? '' : 'none';
  if (!showPawns) return;
  const sz = pawnSize(players.length, s.phase);

  if (s.phase === 'lobby') {
    const spots = gridSpots(players.length, { x: 690, y: 150, w: 840, h: 690 }, sz, 7);
    players.forEach((p, i) => {
      const pw = ensurePawn(p, sz);
      pw.el.classList.remove('voted');
      pw.el.querySelector('.nick').style.display = '';
      tweenTo(pw, spots[i].x, spots[i].y, 500);
    });
    return;
  }

  const waiting = s.phase === 'reveal' ? players.filter(p => p.vote == null) : players;
  const spots = gridSpots(waiting.length, { x: PLAZA.x + 22, y: PLAZA.y + 40, w: PLAZA.w - 44, h: PLAZA.h - 60 }, sz, 11);
  waiting.forEach((p, i) => {
    const pw = ensurePawn(p, sz);
    pw.el.classList.toggle('voted', s.phase === 'question' && p.voted);
    pw.el.querySelector('.nick').style.display = '';
    tweenTo(pw, spots[i].x, spots[i].y, 500);
  });

  if (s.phase === 'reveal' && branches.length) {
    const byOpt = branches.map(() => []);
    players.forEach(p => { if (p.vote != null && byOpt[p.vote]) byOpt[p.vote].push(p); });
    let order = 0;
    byOpt.forEach((list, k) => {
      const rowsNeeded = Math.ceil(list.length / 3);
      const tEnd = 0.95, tStart = 0.3;
      const dt = rowsNeeded > 1 ? Math.min(0.085, (tEnd - tStart) / (rowsNeeded - 1)) : 0;
      list.forEach((p, i) => {
        const pw = ensurePawn(p, sz);
        pw.el.classList.remove('voted');
        pw.el.querySelector('.nick').style.display = list.length > 14 ? 'none' : '';
        const lane = [0, -30, 30][i % 3];
        const t = tEnd - Math.floor(i / 3) * dt;
        const delay = Math.min(2200, order * 55) + (hashStr(p.id) % 250);
        travel(pw, branches[k], t, lane, delay, `${s.d}:${k}:${i}`);
        order++;
      });
    });
  }
}

// ---------- HUD ----------
function secondsLeft() {
  if (!S || !S.deadline) return null;
  return Math.max(0, Math.ceil((S.deadline - (Date.now() + offset)) / 1000));
}

function renderHud(s) {
  const dec = s.decision;
  if (!dec || !['intro', 'question', 'reveal'].includes(s.phase)) { hudEl.innerHTML = ''; return; }
  const players = s.players || [];
  const voted = players.filter(p => p.voted).length;
  const pill = `<span class="pill">Decisão ${dec.index + 1} de ${dec.total} · ${esc(dec.apresentador)}</span>`;
  let status = '';
  if (s.phase === 'question') {
    status = `<div class="status"><div class="timer" id="timer">${secondsLeft() ?? ''}</div>
      <div class="count">${voted}/${players.length}<small>responderam · faltam ${players.length - voted}</small></div></div>`;
  } else if (s.phase === 'reveal') {
    const cs = s.classScores || {};
    status = `<div class="status" style="text-align:left"><div style="font-weight:700;font-size:20px;margin-bottom:6px">Média da turma</div>
      ${s.config.pilares.map(p => `<div style="font-size:22px;font-weight:600">${p.icone} ${cs[p.id] ?? ''}</div>`).join('')}</div>`;
  } else {
    status = `<div class="status"><div class="count">${players.length}<small>jogadores</small></div></div>`;
  }
  const sub = s.phase === 'reveal' ? 'Cada um seguiu o seu caminho…' : esc(dec.cenario);
  hudEl.innerHTML = `<div class="titlebox">${pill}<h1>${esc(dec.titulo)}</h1><div class="cenario">${sub}</div></div>${status}`;
}

// ---------- overlays ----------
let overlayKey = '';

function lobbyHTML(s) {
  return `<div class="lobby">
    <div class="field-area"></div>
    <div class="left">
      <h1>Jogo da <span>Vida</span></h1>
      <div class="sub">${esc(s.config.subtitulo || '')}</div>
      <div class="qrbox"><img src="/qr.svg" alt="QR code"></div>
      <div class="joinurl" id="joinurl">${esc(prettyUrl(joinUrl))}</div>
      <div class="sub" style="margin-top:14px">Escaneie, escolha seu nick e monte seu personagem</div>
    </div>
    <div class="courses" id="lobby-courses"></div>
    <div class="counter" id="lobby-count"></div>
    <div class="empty" id="lobby-empty">Esperando a galera entrar… 👀</div>
  </div>`;
}
function updateLobby(s) {
  const players = s.players || [];
  const c = document.getElementById('lobby-count');
  if (!c) return;
  c.textContent = `${players.length} ${players.length === 1 ? 'jogador' : 'jogadores'}`;
  const counts = {};
  players.forEach(p => { counts[p.course] = (counts[p.course] || 0) + 1; });
  document.getElementById('lobby-courses').innerHTML = (s.courses || []).map(k => `<span>${esc(k)} · ${counts[k] || 0}</span>`).join('');
  document.getElementById('lobby-empty').style.display = players.length ? 'none' : '';
}

function matrixHTML(s) {
  const dec = s.decision;
  const counts = s.counts || dec.opcoes.map(() => 0);
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(...counts);
  const manual = s.manual && s.manual[s.d] != null ? Number(s.manual[s.d]) : null;
  const pil = s.config.pilares;
  const rows = dec.opcoes.map((o, i) => {
    const top = (manual != null ? manual === i : (total && counts[i] === max)) ? 'top' : '';
    const cells = pil.map(p => {
      const v = o.efeito[p.id];
      return `<td class="${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${v > 0 ? '+' : ''}${v}</td>`;
    }).join('');
    return `<tr class="${top}"><td class="opt">${o.icone} ${esc(o.texto)}<small>${counts[i]} pessoas · ${total ? Math.round(counts[i] / total * 100) : 0}% da turma</small></td>${cells}</tr>`;
  }).join('');
  return `<div class="modal-wrap"><div class="matrix">
    <h2>A matriz que estava escondida</h2>
    <div class="hint">${esc(dec.titulo)} · quanto cada escolha mexeu em cada pilar</div>
    <table><tr><th></th>${pil.map(p => `<th>${p.icone} ${esc(p.curto || p.nome)}</th>`).join('')}</tr>${rows}</table>
    ${manual != null ? `<div class="manual">Modo manual: a turma escolheu ${dec.opcoes[manual].icone} ${esc(dec.opcoes[manual].texto)}</div>` : ''}
  </div></div>`;
}

const PROFILE_ORDER = ['academica', 'pessoal', 'profissional', 'equilibrado'];
function profileColor(s, id) {
  const p = s.config.pilares.find(x => x.id === id);
  return p ? p.cor : '#2B2140';
}

function ternarySVG(s) {
  const pil = s.config.pilares;
  const A = { x: 260, y: 42 }, B = { x: 34, y: 430 }, C = { x: 486, y: 430 };
  const V = [A, B, C];
  // estica o triângulo: mede cada pilar a partir do menor valor observado na sala
  const all = [...(s.ranking || []).flatMap(r => pil.map(p => r.scores[p.id])), ...pil.map(p => s.classScores[p.id])];
  const lo = Math.min(...all) - 1;
  const toXY = (sc, id) => {
    const vals = pil.map(p => Math.max(0, sc[p.id] - lo));
    const sum = vals.reduce((a, b) => a + b, 0) || 1;
    const w = vals.map(v => v / sum);
    let x = 0, y = 0;
    w.forEach((wi, i) => { x += wi * V[i].x; y += wi * V[i].y; });
    if (id) { const r = rng(hashStr(id)); x += (r() - 0.5) * 14; y += (r() - 0.5) * 14; }
    return { x, y };
  };
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const cen = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };
  let g = `<polygon points="${A.x},${A.y} ${B.x},${B.y} ${C.x},${C.y}" fill="#FFF8EA" stroke="#2B2140" stroke-width="3" stroke-linejoin="round"/>`;
  const mAB = mid(A, B), mBC = mid(B, C), mCA = mid(C, A);
  g += `<polyline points="${mAB.x},${mAB.y} ${mBC.x},${mBC.y} ${mCA.x},${mCA.y} ${mAB.x},${mAB.y}" fill="none" stroke="#E5D7BD" stroke-width="2" stroke-dasharray="6 6"/>`;
  g += `<circle cx="${cen.x}" cy="${cen.y}" r="34" fill="none" stroke="#B9AED0" stroke-width="2" stroke-dasharray="4 5"/>`;
  const labels = [[A, 0, -18, 'middle'], [B, -4, 34, 'start'], [C, 4, 34, 'end']];
  labels.forEach(([v, dx, dy, anchor], i) => {
    g += `<text x="${v.x + dx}" y="${v.y + dy}" text-anchor="${anchor}" font-size="20" font-weight="700" fill="${pil[i].cor}" font-family="Fredoka, Nunito, system-ui, sans-serif">${pil[i].icone} ${esc(pil[i].curto || pil[i].nome)}</text>`;
  });
  for (const r of s.ranking || []) {
    const pt = toXY(r.scores, r.id);
    g += `<circle cx="${pt.x}" cy="${pt.y}" r="8" fill="${profileColor(s, r.profile)}" stroke="#fff" stroke-width="2" opacity=".9"/>`;
  }
  const cp = toXY(s.classScores);
  g += `<g transform="translate(${cp.x} ${cp.y})"><path d="M0 -18 L5 -6 L18 -6 L8 2 L12 15 L0 7 L-12 15 L-8 2 L-18 -6 L-5 -6 Z" fill="#FFD449" stroke="#2B2140" stroke-width="2.5" stroke-linejoin="round"/>
    <text x="0" y="36" text-anchor="middle" font-size="16" font-weight="700" fill="#2B2140" font-family="Fredoka, Nunito, system-ui, sans-serif">turma</text></g>`;
  return `<svg viewBox="0 0 520 470" width="520" height="470">${g}</svg>
    <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:17px;color:var(--ink-soft);margin-top:10px;padding:0 6px">
      <span>● cada ponto = 1 pessoa (cor do perfil)</span><span>⭐ média da turma</span><span>◌ centro = equilíbrio</span></div>
    <div style="font-size:16px;color:var(--ink-soft);margin-top:8px;padding:0 6px">Quanto mais perto de um canto, mais aquele pilar pesou nas escolhas.</div>`;
}

function finalTurmaHTML(s) {
  const rk = s.ranking || [];
  const n = rk.length;
  const verdict = (s.verdict || []).map(v => {
    const p = s.config.pilares.find(x => x.id === v.id);
    return `<div class="card verdict ${v.ok ? 'good' : 'bad'}"><div class="ic">${v.ok ? '🎉' : '💀'}</div><div><div class="tx">${esc(v.texto)}</div>
      <div class="sc">${p.icone} média ${v.score} · começou em ${s.config.pontosIniciais}</div></div></div>`;
  }).join('');
  const prof = {};
  rk.forEach(r => { prof[r.profile] = (prof[r.profile] || 0) + 1; });
  const profRows = PROFILE_ORDER.map(id => {
    const c = prof[id] || 0;
    const pct = n ? Math.round(c / n * 100) : 0;
    return `<div class="row"><span>${esc((s.config.perfis[id] || {}).nome || id)}</span><div class="track"><div class="fill" style="width:${pct}%;background:${profileColor(s, id)}"></div></div><span>${c}</span></div>`;
  }).join('');
  const byCourse = {};
  const playersById = Object.fromEntries((s.players || []).map(p => [p.id, p]));
  rk.forEach(r => {
    const c = (playersById[r.id] || {}).course || '—';
    (byCourse[c] = byCourse[c] || []).push(r.scores);
  });
  const courseRows = Object.entries(byCourse).map(([c, list]) => {
    const avg = id => (list.reduce((a, sc) => a + sc[id], 0) / list.length).toFixed(1);
    return `<div class="crow"><div class="cname">${esc(c)} <span style="color:var(--ink-soft);font-weight:500">(${list.length})</span></div>
      <div class="mini-bars">${s.config.pilares.map(p => `<div style="background:${p.cor}">${p.icone} ${avg(p.id)}</div>`).join('')}</div></div>`;
  }).join('') || '<p style="color:var(--ink-soft)">Sem jogadores</p>';
  return `<div class="final" style="background:var(--cream)">
    <h1>Resultado da turma<small>${n ? `média de ${n} jogadores` : 'modo manual'}</small></h1>
    <div class="cols">
      <div>${verdict}</div>
      <div class="card ternary"><div class="boxtitle">Onde cada um terminou</div>${ternarySVG(s)}</div>
      <div>
        <div class="card profiles" style="padding:16px 18px"><div class="boxtitle">Perfis</div>${profRows}</div>
        <div class="card courses-cmp" style="padding:16px 18px;margin-top:16px"><div class="boxtitle">Por curso</div>${courseRows}</div>
      </div>
    </div></div>`;
}

function finalRankHTML(s) {
  const rk = (s.ranking || []).slice();
  const byId = Object.fromEntries((s.players || []).map(p => [p.id, p]));
  const spots = [
    { i: 1, left: 0, h: 250, c: '#5BB8FF' },
    { i: 0, left: 300, h: 340, c: '#FFB238' },
    { i: 2, left: 600, h: 190, c: '#FF7A6B' },
  ];
  const podium = spots.map(sp => {
    const r = rk[sp.i];
    if (!r) return '';
    const p = byId[r.id] || {};
    return `<div class="spot" style="left:${sp.left}px"><div class="av hop">${avatarSVG(p.avatar || {})}</div><div class="who">${esc(p.nick || '?')}</div>
      <div class="block" style="height:${sp.h}px;background:${sp.c}"><div class="pos">${r.rank}º</div><div class="eq">nota ${r.equilibrio}</div></div></div>`;
  }).join('');
  const list = rk.slice(3, 10).map(r => {
    const p = byId[r.id] || {};
    const vals = s.config.pilares.map(pl => `${pl.icone}${r.scores[pl.id]}`).join('  ');
    return `<div class="card r"><span style="color:var(--coral)">${r.rank}º</span>${avatarSVG(p.avatar || {})}<div>${esc(p.nick || '?')}<div class="vals">${vals}</div></div><span>nota ${r.equilibrio}</span></div>`;
  }).join('');
  const conf = Array.from({ length: 90 }, (_, k) => {
    const cols = ['#FF7A6B', '#FFD449', '#5FD4A0', '#5BB8FF', '#A98BFF', '#FF8FC7'];
    return `<div class="confetti" style="left:${Math.random() * 1600}px;background:${cols[k % cols.length]};animation-duration:${2.5 + Math.random() * 2.5}s;animation-delay:${Math.random() * 1.5}s"></div>`;
  }).join('');
  return `<div class="final" style="background:var(--cream)"><h1>Quem equilibrou melhor a vida<small>nota = o pilar mais baixo · desempate: soma, depois rapidez</small></h1>
    <div class="podium">${podium || '<p style="font-size:28px">Sem jogadores no ranking.</p>'}</div><div class="ranklist">${list}</div>${conf}</div>`;
}

function renderOverlay(s) {
  let key, html;
  if (s.phase === 'lobby') { key = 'lobby'; }
  else if (s.phase === 'reveal' && s.showMatrix) { key = 'matrix:' + s.d + JSON.stringify(s.counts) + JSON.stringify(s.manual); html = () => matrixHTML(s); }
  else if (s.phase === 'final' && s.finalStep === 0) { key = 'fin0' + JSON.stringify([s.ranking, s.verdict]); html = () => finalTurmaHTML(s); }
  else if (s.phase === 'final') { key = 'fin1' + JSON.stringify(s.ranking); html = () => finalRankHTML(s); }
  else key = 'none';
  if (key !== overlayKey) {
    overlayKey = key;
    underEl.innerHTML = key === 'lobby' ? lobbyHTML(s) : '';
    overlayEl.innerHTML = html ? html() : '';
  }
  if (key === 'lobby') updateLobby(s);
}

// ---------- render principal ----------
function render(s) {
  S = s;
  // cenário
  const sk = s.decision && ['intro', 'question', 'reveal'].includes(s.phase) ? `scene:${s.d}` : s.phase === 'lobby' ? 'lobby' : 'none';
  if (sk !== sceneKey) {
    sceneKey = sk;
    branches = [];
    if (sk.startsWith('scene')) branches = buildScene(s.decision, s.d);
    else sceneEl.innerHTML = '';
  }
  renderSigns(s);
  renderHud(s);
  renderOverlay(s);
  layoutPawns(s);
  // controles
  document.getElementById('c-phase').textContent = phaseLabel(s);
  document.getElementById('c-next').textContent = nextLabel(s);
  document.getElementById('c-extend').classList.toggle('hidden', s.phase !== 'question');
  document.getElementById('c-matrix').classList.toggle('hidden', s.phase !== 'reveal');
  document.getElementById('c-matrix').textContent = s.showMatrix ? 'Esconder matriz' : 'Matriz';
  if (drawerMounted) updateAdmin(drawerAdmin, s);
}

setInterval(() => {
  const t = document.getElementById('timer');
  if (t) { const v = secondsLeft(); t.textContent = v ?? ''; t.style.color = v != null && v <= 5 ? '#E63946' : ''; }
}, 200);

// ---------- conexão e controles ----------
const keygate = document.getElementById('keygate');
const conn = connectHost((s, off) => { offset = off; keygate.classList.add('hidden'); render(s); }, err => {
  keygate.classList.remove('hidden');
  document.getElementById('kerr').textContent = err || '';
});
document.getElementById('enter').onclick = () => conn.setKey(document.getElementById('key').value.trim());
document.getElementById('key').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('enter').click(); });

const send = (ev, p) => conn.send(ev, p);
document.getElementById('c-next').onclick = () => send('host:next');
document.getElementById('c-prev').onclick = () => send('host:prev');
document.getElementById('c-extend').onclick = () => send('host:extend', { seconds: 15 });
document.getElementById('c-matrix').onclick = () => send('host:matrix', {});
document.getElementById('c-full').onclick = () => toggleFull();

const drawer = document.getElementById('drawer');
const drawerAdmin = document.getElementById('drawer-admin');
let drawerMounted = false;
function toggleDrawer() {
  if (!drawerMounted) { mountAdmin(drawerAdmin, send); drawerMounted = true; if (S) updateAdmin(drawerAdmin, S); }
  drawer.classList.toggle('hidden');
}
document.getElementById('c-admin').onclick = toggleDrawer;

function toggleFull() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter' || e.key === 'PageDown') { e.preventDefault(); send('host:next'); }
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') send('host:prev');
  else if (e.key === 'm' || e.key === 'M') send('host:matrix', {});
  else if (e.key === 'f' || e.key === 'F') toggleFull();
  else if (e.key === 'a' || e.key === 'A') toggleDrawer();
  else if (e.key === 'h' || e.key === 'H') document.getElementById('controls').classList.toggle('hidden');
});

// controles somem quando o mouse fica parado
const controls = document.getElementById('controls');
let idle;
function wake() { controls.classList.remove('dim'); clearTimeout(idle); idle = setTimeout(() => controls.classList.add('dim'), 3500); }
addEventListener('mousemove', wake);
wake();
