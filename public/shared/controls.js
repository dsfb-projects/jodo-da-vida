// Painel de controle do admin: usado na página /admin (celular) e na gaveta do /host.
import { avatarSVG } from '/shared/avatar.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const lastFinal = s => (s.config && s.config.mostrarRanking === false ? 0 : 1);
export const isResetStep = s => !!s && s.phase === 'final' && s.finalStep >= lastFinal(s);

// "Voltar ao início" apaga os votos: pede um segundo toque em até 3 s
export function armOrRun(btn, run) {
  if (btn.dataset.armed) {
    delete btn.dataset.armed;
    clearTimeout(btn._armTimer);
    run();
    return;
  }
  btn.dataset.armed = '1';
  btn.textContent = 'Toque de novo pra voltar ao início';
  btn._armTimer = setTimeout(() => { delete btn.dataset.armed; btn.textContent = '🔄 Voltar ao início'; }, 3000);
}

export function nextLabel(s) {
  const last = s.config.totalDecisoes - 1;
  switch (s.phase) {
    case 'lobby': return '▶ Começar';
    case 'intro': return '▶ Abrir votação';
    case 'question': return '⏹ Encerrar votação';
    case 'reveal': return s.d < last ? '▶ Próxima decisão' : '🏁 Ver resultado';
    case 'final': return s.finalStep < lastFinal(s) ? '🏆 Mostrar ranking' : '🔄 Voltar ao início';
    default: return 'Próximo';
  }
}

export function phaseLabel(s) {
  const n = s.d + 1;
  switch (s.phase) {
    case 'lobby': return 'Lobby (entrando)';
    case 'intro': return `Decisão ${n} · contando a história`;
    case 'question': return `Decisão ${n} · votação aberta`;
    case 'reveal': return `Decisão ${n} · revelação`;
    case 'final': return s.finalStep < 1 ? 'Resultado da turma' : 'Ranking';
    default: return s.phase;
  }
}

let lastState = null;

export function mountAdmin(root, send) {
  root.innerHTML = `
    <div class="card status" id="a-status"></div>
    <div class="mainbtns"><button class="btn ghost" data-act="prev">◀ Voltar</button><button class="btn coral" data-act="next" id="a-next">Próximo</button></div>
    <div class="row2"><button class="btn ghost" data-act="extend">+15 s</button><button class="btn ghost" data-act="matrix" id="a-matrix">Matriz</button></div>
    <h2>Modo manual (escolha da turma)</h2>
    <p style="margin:0 0 8px;color:var(--ink-soft);font-size:14px">Se o celular do pessoal falhar, marque aqui o que a turma escolheu. Vale para a média da turma (a estrela no gráfico final).</p>
    <div id="a-manual"></div>
    <h2>Cursos</h2>
    <div class="chips" id="a-courses"></div>
    <div class="addcourse"><input id="a-newcourse" placeholder="Adicionar curso"><button class="btn small" data-act="addcourse">+</button></div>
    <h2>Jogadores <span id="a-pcount"></span></h2>
    <div class="plist" id="a-players"></div>
    <h2>Partida</h2>
    <div class="row2"><button class="btn ghost small" data-act="reset" data-confirm="1">Reiniciar (mantém jogadores)</button><button class="btn ghost small" data-act="resetall" data-confirm="1">Zerar tudo</button></div>
    <p style="margin-top:14px;font-size:14px"><a href="/qr" target="_blank">Abrir QR code</a></p>`;

  root.addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.confirm && !b.dataset.armed) {
      b.dataset.armed = '1';
      b.dataset.label = b.textContent;
      b.textContent = 'Toque de novo pra confirmar';
      setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = b.dataset.label; } }, 3000);
      return;
    }
    const act = b.dataset.act;
    if (act === 'next') {
      if (isResetStep(lastState)) armOrRun(b, () => send('host:next'));
      else send('host:next');
    }
    else if (act === 'prev') send('host:prev');
    else if (act === 'extend') send('host:extend', { seconds: 15 });
    else if (act === 'matrix') send('host:matrix', {});
    else if (act === 'manual') send('host:manual', { d: Number(b.dataset.d), opt: b.dataset.opt === '' ? null : Number(b.dataset.opt) });
    else if (act === 'kick') send('host:kick', { id: b.dataset.id });
    else if (act === 'rmcourse') send('host:course:remove', { name: b.dataset.name });
    else if (act === 'addcourse') {
      const inp = root.querySelector('#a-newcourse');
      if (inp.value.trim()) send('host:course:add', { name: inp.value.trim() });
      inp.value = '';
    } else if (act === 'reset') send('host:reset', { players: false });
    else if (act === 'resetall') send('host:reset', { players: true });
  });
  root.querySelector('#a-newcourse').addEventListener('keydown', e => {
    if (e.key === 'Enter') root.querySelector('[data-act=addcourse]').click();
  });
}

export function updateAdmin(root, s) {
  lastState = s;
  const players = s.players || [];
  const online = players.filter(p => p.connected).length;
  const voted = players.filter(p => p.voted).length;
  const vote = s.phase === 'question' ? `<div style="margin-top:6px">✅ ${voted} de ${players.length} responderam · faltam <b>${players.length - voted}</b></div>` : '';
  root.querySelector('#a-status').innerHTML = `<b>${esc(phaseLabel(s))}</b><div style="margin-top:4px;color:var(--ink-soft)">${players.length} jogadores · ${online} online</div>${vote}`;
  const nb = root.querySelector('#a-next');
  if (!nb.dataset.armed) nb.textContent = nextLabel(s);
  const mx = root.querySelector('#a-matrix');
  mx.disabled = s.phase !== 'reveal';
  mx.textContent = s.showMatrix ? 'Esconder matriz' : 'Mostrar matriz';

  root.querySelector('#a-manual').innerHTML = (s.allDecisions || []).map((d, i) => {
    const cur = s.manual && s.manual[i] != null ? Number(s.manual[i]) : null;
    return `<div class="manualrow" style="${i === s.d ? 'border-color:var(--ink)' : ''}"><div class="t">${i + 1}. ${esc(d.titulo)}</div><div class="chips">
      ${d.opcoes.map((o, j) => `<button class="chip ${cur === j ? 'on' : ''}" data-act="manual" data-d="${i}" data-opt="${j}">${o.icone} ${esc(o.texto)}</button>`).join('')}
      ${cur != null ? `<button class="chip" data-act="manual" data-d="${i}" data-opt="">limpar</button>` : ''}</div></div>`;
  }).join('');

  root.querySelector('#a-courses').innerHTML = (s.courses || []).map(c =>
    `<span class="chip">${esc(c)} <button class="btn ghost small" style="padding:0 6px;box-shadow:none;border:0" data-act="rmcourse" data-name="${esc(c)}" data-confirm="1">✕</button></span>`).join('');

  root.querySelector('#a-pcount').textContent = `(${players.length})`;
  root.querySelector('#a-players').innerHTML = players.map(p => `
    <div class="p">${avatarSVG(p.avatar)}<div><div><span class="dot" style="background:${p.connected ? '#3BB273' : '#C9C2B6'}"></span><b>${esc(p.nick)}</b> ${p.voted ? '✅' : ''}</div><div class="meta">${esc(p.course)}</div></div>
      <span></span><button class="btn ghost small" data-act="kick" data-id="${esc(p.id)}" data-confirm="1">Remover</button></div>`).join('') || '<p style="color:var(--ink-soft)">Ninguém entrou ainda.</p>';
}

export function connectHost(onState, onAuthFail) {
  const params = new URLSearchParams(location.search);
  let key = params.get('key') || sessionStorage.getItem('jdv:key') || '';
  const socket = io({ reconnectionDelay: 400, reconnectionDelayMax: 2000 });
  let offset = 0;
  const hello = () => {
    if (!key) { onAuthFail(); return; }
    socket.emit('host:hello', { key }, res => {
      if (res && res.ok) { sessionStorage.setItem('jdv:key', key); offset = res.state.serverNow - Date.now(); onState(res.state, offset); }
      else { sessionStorage.removeItem('jdv:key'); onAuthFail(res && res.error); }
    });
  };
  socket.on('connect', hello);
  socket.on('host:state', s => { offset = s.serverNow - Date.now(); onState(s, offset); });
  const send = (ev, payload = {}) => new Promise(resolve => socket.emit(ev, payload, r => resolve(r)));
  return {
    socket, send,
    setKey(k) { key = k; hello(); },
  };
}
