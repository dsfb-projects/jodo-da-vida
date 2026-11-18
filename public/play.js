import { avatarSVG, swatchSVG, TABS, ACCENT_COLORS, VEHICLE_COLORS, randomAvatar } from '/shared/avatar.js';

const KEY_ID = 'jdv:id';
const KEY_PROFILE = 'jdv:profile';
const app = document.getElementById('app');
const netEl = document.getElementById('net');

const socket = io({ reconnectionDelay: 400, reconnectionDelayMax: 2000, timeout: 8000 });

// Abas do editor. As cores de acessório e de veículo ficam dentro da aba do item.
const GROUPS = [
  { key: 'c', label: 'Cor', icon: '🎨' },
  { key: 's', label: 'Formato', icon: '🔷' },
  { key: 'e', label: 'Olhos', icon: '👀' },
  { key: 'm', label: 'Boca', icon: '👄' },
  { key: 't', label: 'Cabeça', icon: '🎩', color: { key: 'k', label: 'Cor do acessório', list: ACCENT_COLORS } },
  { key: 'g', label: 'Óculos', icon: '👓' },
  { key: 'v', label: 'Veículo', icon: '🛹', color: { key: 'vc', label: 'Cor do veículo', list: VEHICLE_COLORS } },
];

let meta = null;      // config + cursos (chega antes de entrar)
let state = null;     // estado pessoal
let roster = [];      // quem está na sala (só no lobby)
let offset = 0;       // relógio do servidor - relógio local
let editing = false;  // editor aberto depois de entrar
let step = 'info';    // 'info' (apelido e curso) ou 'avatar'
let message = null;   // tela de aviso (removido etc.)
let tab = 'c';
let draft = loadProfile() || { nick: '', course: '', avatar: randomAvatar() };
let lastRenderKey = '';

// ---------- armazenamento ----------
function loadProfile() {
  try { return JSON.parse(localStorage.getItem(KEY_PROFILE)) || null; } catch { return null; }
}
function myId() {
  try { return localStorage.getItem(KEY_ID); } catch { return null; }
}
function saveMe(id, profile) {
  try { localStorage.setItem(KEY_ID, id); localStorage.setItem(KEY_PROFILE, JSON.stringify(profile)); } catch { /* modo anônimo */ }
}
function forgetMe() {
  try { localStorage.removeItem(KEY_ID); } catch { /* ignore */ }
}

// ---------- tela sempre acesa ----------
let wakeLock = null;
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible' && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch { wakeLock = null; }
}

// ---------- conexão ----------
let netTimer = null;
function setOffline(off) {
  clearTimeout(netTimer);
  if (off) netTimer = setTimeout(() => netEl.classList.remove('hidden'), 700);
  else netEl.classList.add('hidden');
}

function hello() {
  const id = myId();
  if (!id) { state = null; render(true); return; }
  socket.emit('player:hello', { id, profile: loadProfile() }, res => {
    if (res && res.ok) { state = res.state; offset = state.serverNow - Date.now(); render(true); keepAwake(); }
    else if (res && res.kicked) { forgetMe(); state = null; message = 'Você foi removido do jogo por um admin.'; render(true); }
    else { state = null; render(true); }
  });
}

socket.on('connect', () => { setOffline(false); hello(); });
socket.on('disconnect', () => setOffline(true));
socket.on('meta', m => {
  meta = m;
  offset = m.serverNow - Date.now();
  if ((!state || editing) && step === 'info') updateCourseChips();
});
socket.on('roster', list => {
  roster = Array.isArray(list) ? list : [];
  updateRoster();
});
socket.on('state', s => {
  state = s;
  offset = s.serverNow - Date.now();
  if (editing && s.phase !== 'lobby') editing = false;
  if (!editing) render();
});
socket.on('kicked', m => {
  forgetMe();
  state = null;
  editing = false;
  step = 'info';
  message = m && m.reset ? null : 'Você foi removido do jogo por um admin.';
  render(true);
});

// celular que bloqueou a tela: a conexão pode ter morrido sem avisar. Ao voltar, abre uma conexão nova.
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
  keepAwake();
  if (!socket.connected) socket.connect();
  else if (Date.now() - hiddenAt > 2000) { socket.disconnect(); socket.connect(); }
  else if (myId()) hello();
});
window.addEventListener('pageshow', () => { if (!socket.connected) socket.connect(); });
window.addEventListener('online', () => { if (!socket.connected) socket.connect(); });

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfg = () => (state && state.config) || (meta && meta.config) || { pilares: [], pontosIniciais: 10 };

function barsHTML(scores) {
  const c = cfg();
  const max = c.pontosIniciais * 2;
  return `<div class="bars">${c.pilares.map(p => {
    const v = scores[p.id];
    const pct = Math.max(3, Math.min(100, (v / max) * 100));
    return `<div class="bar"><div class="lbl"><span>${p.icone} ${esc(p.nome)}</span><span>${v}</span></div>
      <div class="track"><div class="fill" data-to="${pct}" style="width:3%;background:${p.cor}"></div></div></div>`;
  }).join('')}</div>`;
}
function animateBars() {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    app.querySelectorAll('.fill[data-to]').forEach(el => { el.style.width = el.dataset.to + '%'; });
  }));
}

function previewHTML(avatar, nick, size = 130) {
  return `<div class="preview"><div class="stagebox" style="width:${size + 20}px;height:${size + 20}px"><div class="hop" style="width:${size}px;height:${size}px">${avatarSVG(avatar)}</div></div>
    <div class="shadow"></div>${nick != null ? `<div class="nickbubble">${esc(nick)}</div>` : ''}</div>`;
}

// ---------- passo 1: apelido e curso ----------
function mountInfo(isJoin) {
  app.className = 'play';
  app.innerHTML = `
    <div class="brand"><h1>Jogo da <span>Vida</span></h1><small>Passo 1 de 2</small></div>
    ${previewHTML(draft.avatar, null, 110)}
    <div class="field"><label for="nick">Seu apelido</label><input id="nick" type="text" maxlength="16" placeholder="Seu apelido" autocomplete="off" autocapitalize="off" value="${esc(draft.nick)}"></div>
    <div class="field"><label>Seu curso</label><div class="chips" id="courses"></div></div>
    <div style="margin-top:22px"><button class="btn big coral" id="next">Montar personagem ▶</button></div>
    <p id="err" class="err"></p>
    ${isJoin ? '' : '<div style="margin-top:6px"><button class="btn ghost big" id="cancel">Cancelar</button></div>'}`;
  updateCourseChips();
  const nick = document.getElementById('nick');
  nick.addEventListener('input', () => { draft.nick = nick.value; });
  nick.addEventListener('keydown', e => { if (e.key === 'Enter') nick.blur(); });
  document.getElementById('courses').addEventListener('click', e => {
    const b = e.target.closest('[data-course]');
    if (!b) return;
    draft.course = b.dataset.course;
    updateCourseChips();
    document.getElementById('err').textContent = '';
  });
  document.getElementById('next').onclick = () => {
    const err = document.getElementById('err');
    if (!draft.nick.trim()) { err.textContent = 'Escolha um apelido 🙂'; nick.focus(); return; }
    if (!draft.course) { err.textContent = 'Escolha o seu curso 🙂'; return; }
    step = 'avatar';
    render(true);
  };
  const cancel = document.getElementById('cancel');
  if (cancel) cancel.onclick = () => { editing = false; step = 'info'; render(true); };
}

function updateCourseChips() {
  const box = document.getElementById('courses');
  if (!box) return;
  const list = (meta && meta.courses) || (state && state.courses) || [];
  if (draft.course && list.length && !list.includes(draft.course)) draft.course = '';
  box.innerHTML = list.map(c => `<button class="chip ${c === draft.course ? 'on' : ''}" data-course="${esc(c)}">${esc(c)}</button>`).join('');
}

// ---------- passo 2: personagem ----------
function mountAvatar(isJoin) {
  app.className = 'play';
  app.innerHTML = `
    <div class="bs">
      <div class="bs-top">
        <div class="bs-preview"><div class="hop" id="pv"></div></div>
        <div class="bs-info"><small>Passo 2 de 2</small><b>${esc(draft.nick.trim())}</b><span>${esc(draft.course)}</span></div>
      </div>
      <div class="bs-tabs" id="tabs">
        ${GROUPS.map(g => `<button class="tab ${g.key === tab ? 'on' : ''}" data-tab="${g.key}"><span>${g.icon}</span>${g.label}</button>`).join('')}
        <button class="tab dice" id="dice"><span>🎲</span>Sortear</button>
      </div>
      <div class="bs-grid" id="grid"></div>
      <div class="bs-bottom">
        <button class="btn ghost" id="back">◀ Voltar</button>
        <button class="btn coral" id="go">${isJoin ? 'Entrar no jogo' : 'Salvar'}</button>
      </div>
      <p id="err" class="err"></p>
    </div>`;
  updatePreview();
  updateGrid();
  document.getElementById('tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    tab = b.dataset.tab;
    document.querySelectorAll('.tab[data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === tab));
    updateGrid();
    document.getElementById('grid').scrollTop = 0;
  });
  document.getElementById('grid').addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    draft.avatar[b.dataset.k] = Number(b.dataset.i);
    updatePreview();
    updateGrid();
  });
  document.getElementById('dice').onclick = () => { draft.avatar = randomAvatar(); updatePreview(); updateGrid(); };
  document.getElementById('back').onclick = () => { step = 'info'; render(true); };
  document.getElementById('go').onclick = submit;
}

function updatePreview() {
  const pv = document.getElementById('pv');
  if (pv) pv.innerHTML = avatarSVG(draft.avatar);
}

function updateGrid() {
  const grid = document.getElementById('grid');
  if (!grid) return;
  const g = GROUPS.find(x => x.key === tab);
  const t = TABS.find(x => x.key === tab);
  let html = '';
  if (g.color) {
    html += `<div class="colorrow"><div class="cr-label">${g.color.label}</div><div class="cr-list">${g.color.list.map((c, i) =>
      `<button class="opt sw ${draft.avatar[g.color.key] === i ? 'on' : ''}" data-k="${g.color.key}" data-i="${i}">${swatchSVG(c)}</button>`).join('')}</div></div>`;
  }
  html += '<div class="optgrid">';
  for (let i = 0; i < t.count; i++) {
    const on = draft.avatar[t.key] === i ? 'on' : '';
    html += `<button class="opt ${on}" data-k="${t.key}" data-i="${i}">${avatarSVG({ ...draft.avatar, [t.key]: i })}<span>${t.names ? t.names[i] : '&nbsp;'}</span></button>`;
  }
  grid.innerHTML = html + '</div>';
}

function submit() {
  const err = document.getElementById('err');
  const go = document.getElementById('go');
  go.disabled = true;
  keepAwake();
  socket.emit('player:join', { id: myId() || undefined, nick: draft.nick.trim(), course: draft.course, avatar: draft.avatar }, res => {
    go.disabled = false;
    if (!res || !res.ok) { err.textContent = (res && res.error) || 'Não deu pra entrar, tenta de novo.'; return; }
    state = res.state;
    offset = state.serverNow - Date.now();
    draft = { nick: state.me.nick, course: state.me.course, avatar: { ...state.me.avatar } };
    saveMe(res.id, draft);
    editing = false;
    step = 'info';
    message = null;
    render(true);
  });
}

// ---------- lista da sala (lobby) ----------
function rosterHTML() {
  const me = state && state.me;
  const list = [...roster].sort((a, b) => (me && b.id === me.id) - (me && a.id === me.id));
  return list.map(p => {
    const mine = me && p.id === me.id;
    return `<div class="rp ${mine ? 'me' : ''}">${avatarSVG(p.avatar)}<span>${mine ? 'Você' : esc(p.nick)}</span></div>`;
  }).join('');
}
function updateRoster() {
  const box = document.getElementById('roster');
  if (box) box.innerHTML = rosterHTML();
  const n = document.getElementById('roster-n');
  if (n) n.textContent = roster.length;
}

// ---------- telas do jogo ----------
function screenHTML(s) {
  const me = s.me;
  const dec = s.decision;
  const kicker = dec ? `<span class="kicker">Decisão ${dec.index + 1} de ${dec.total}</span>` : '';
  switch (s.phase) {
    case 'lobby':
      return `${previewHTML(me.avatar, me.nick)}
        <div class="card panel"><span class="kicker">${esc(me.course)}</span>
          <h2>Você está no jogo!</h2><p class="lookup">👀 Confira se você apareceu no telão</p><p>Aguarde a gente dar o play 🎬</p>
          <div style="margin-top:14px"><button class="btn ghost" id="edit">✏️ Editar personagem</button></div></div>
        <div class="card panel roster-card"><div class="roster-title">Na sala agora: <b id="roster-n">${roster.length}</b></div><div class="roster" id="roster">${rosterHTML()}</div></div>`;
    case 'intro':
      return `<div class="card panel">${kicker}<h2>${esc(dec.titulo)}</h2><p>${esc(dec.cenario)}</p><div class="lookup">👀 Olhe para o telão</div></div>
        ${previewHTML(me.avatar, null, 100)}`;
    case 'question': {
      if (s.myVote != null) {
        const o = dec.opcoes[s.myVote];
        return `${previewHTML(me.avatar, null, 110)}
          <div class="card panel"><h2>Escolha registrada! ✅</h2><p class="lookup">${o.icone} ${esc(o.texto)}</p>
          <p>Esperando o resto da turma…</p><div class="timerbar"><div id="tb"></div></div></div>`;
      }
      return `<div class="card panel">${kicker}<h2>${esc(dec.titulo)}</h2><p>${esc(dec.cenario)}</p><div class="timerbar"><div id="tb"></div></div></div>
        <div class="options">${dec.opcoes.map((o, i) => `<button class="optbtn c${i % 4}" data-opt="${i}"><span class="ico">${o.icone}</span>${esc(o.texto)}</button>`).join('')}</div>`;
    }
    case 'reveal': {
      // sem pontos aqui: ver quanto perdeu em cada decisão enviesaria as próximas escolhas
      if (s.myVote == null) {
        return `<div class="card panel">${kicker}<div class="big-emoji">😶</div><h2>Você não respondeu a tempo</h2><p class="lookup">👀 Olhe para o telão</p></div>`;
      }
      const o = dec.opcoes[s.myVote];
      return `<div class="card panel">${kicker}<div class="big-emoji">${o.icone}</div><h2>Você foi de ${esc(o.texto)}</h2>
        <p class="lookup">👀 Veja no telão o caminho da turma</p></div>${previewHTML(me.avatar, null, 110)}`;
    }
    case 'final': {
      const f = s.final;
      if (!f) return `<div class="card panel"><h2>Fim de jogo!</h2></div>`;
      const perfil = cfg().perfis[f.profile] || { nome: f.profile, descricao: '' };
      let rank = '';
      if (s.finalStep === 2) rank = `<div class="rank">#${f.rank}</div><p>de ${f.of} jogadores no ranking de equilíbrio</p>`;
      else if (s.finalStep === 1) rank = `<p class="lookup">🎉 Ache você no grupo ${esc(perfil.nome.replace(/^Perfil\s+/i, ''))} no telão</p>`;
      return `${previewHTML(me.avatar, me.nick, 110)}
        <div class="card panel"><span class="kicker">Seu resultado</span><div class="profile-name">${esc(perfil.nome)}</div><p>${esc(perfil.descricao)}</p>
        ${barsHTML(f.scores)}<p><b>Nota de equilíbrio: ${f.equilibrio}</b> (seu pilar mais baixo)</p>${rank}</div>`;
    }
    default:
      return `<div class="card panel"><h2>Carregando…</h2></div>`;
  }
}

function render(force) {
  if (message && !state) {
    app.className = 'play';
    app.innerHTML = `<div class="brand"><h1>Jogo da <span>Vida</span></h1></div><div class="card panel"><h2>Ops</h2><p>${esc(message)}</p>
      <div style="margin-top:14px"><button class="btn coral" id="again">Entrar de novo</button></div></div>`;
    document.getElementById('again').onclick = () => { message = null; render(true); };
    lastRenderKey = 'msg';
    return;
  }
  if (!state || !state.me || editing) {
    const isJoin = !state || !state.me;
    const key = `builder:${step}:${isJoin}`;
    if (lastRenderKey !== key || force) {
      if (step === 'avatar') mountAvatar(isJoin); else mountInfo(isJoin);
      lastRenderKey = key;
    }
    return;
  }
  const s = state;
  // evita redesenhar (e reiniciar animações) quando nada visível mudou
  const key = JSON.stringify([s.phase, s.d, s.finalStep, s.myVote, s.me, s.final && s.final.rank, s.final && s.final.of]);
  if (key === lastRenderKey && !force) return;
  lastRenderKey = key;
  app.className = 'play';
  app.innerHTML = screenHTML(s);
  animateBars();
  const edit = document.getElementById('edit');
  if (edit) edit.onclick = () => { draft = { nick: s.me.nick, course: s.me.course, avatar: { ...s.me.avatar } }; editing = true; step = 'info'; render(true); };
  app.querySelectorAll('[data-opt]').forEach(b => {
    b.onclick = () => {
      app.querySelectorAll('[data-opt]').forEach(x => { x.disabled = true; });
      if (navigator.vibrate) navigator.vibrate(30);
      socket.emit('player:vote', { d: s.d, opt: Number(b.dataset.opt) }, res => {
        if (!res || !res.ok) {
          app.querySelectorAll('[data-opt]').forEach(x => { x.disabled = false; });
          if (res && res.error) alert(res.error);
        }
      });
    };
  });
  tick();
}

function tick() {
  const tb = document.getElementById('tb');
  if (!tb || !state || !state.deadline) return;
  const total = (state.config && state.config.segundos) || 40;
  const left = Math.max(0, state.deadline - (Date.now() + offset));
  tb.style.width = Math.min(100, (left / 1000 / total) * 100) + '%';
}
setInterval(tick, 250);

render(true);
