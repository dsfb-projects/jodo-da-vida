'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { Game } = require('./game');

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'neuro';
const CONTENT_FILE = path.join(__dirname, '..', 'content', 'decisoes.json');

const content = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
const game = new Game(content);

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);
const io = new Server(server, {
  pingInterval: 5000,
  pingTimeout: 8000,
  cors: { origin: false },
});

const PUB = path.join(__dirname, '..', 'public');
app.get('/healthz', (_req, res) => res.send('ok'));
app.get('/', (_req, res) => res.sendFile(path.join(PUB, 'play.html')));
app.get('/host', (_req, res) => res.sendFile(path.join(PUB, 'host.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(PUB, 'admin.html')));
app.get('/qr', (_req, res) => res.sendFile(path.join(PUB, 'qr.html')));

function publicUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '') + '/';
  return `${req.protocol}://${req.get('host')}/`;
}

app.get('/qr.svg', async (req, res) => {
  try {
    const svg = await QRCode.toString(publicUrl(req), {
      type: 'svg', margin: 1, errorCorrectionLevel: 'M',
      color: { dark: '#2B2140', light: '#00000000' },
    });
    res.type('image/svg+xml').set('Cache-Control', 'no-store').send(svg);
  } catch (e) {
    res.status(500).send(String(e));
  }
});
app.get('/join-url', (req, res) => res.json({ url: publicUrl(req) }));

app.use(express.static(PUB, { extensions: ['html'] }));

// ---------- broadcast ----------
const socketsOf = new Map(); // playerId -> Set(socketId)

function sendPlayer(id) {
  const set = socketsOf.get(id);
  if (!set) return;
  const view = game.playerView(id);
  for (const sid of set) io.to(sid).emit('state', view);
}

// lista da sala para os celulares (só no lobby), no máximo 1 envio por segundo
let rosterTimer = null;
let rosterDirty = false;
function sendRoster() {
  rosterDirty = true;
  if (rosterTimer) return;
  const flush = () => {
    rosterTimer = null;
    if (!rosterDirty) return;
    rosterDirty = false;
    if (game.phase === 'lobby') io.emit('roster', game.roster());
    rosterTimer = setTimeout(flush, 1000);
  };
  flush();
}

let hostTimer = null;
function sendHosts() {
  // agrupa rajadas (ex.: 40 votos em 2 segundos) num envio só
  if (hostTimer) return;
  hostTimer = setTimeout(() => {
    hostTimer = null;
    io.to('hosts').emit('host:state', game.hostView());
  }, 60);
}

function broadcastAll() {
  io.emit('meta', game.common());
  if (game.phase === 'lobby') sendRoster();
  for (const id of socketsOf.keys()) sendPlayer(id);
  sendHosts();
  scheduleAutoClose();
}

let closeTimer = null;
function scheduleAutoClose() {
  clearTimeout(closeTimer);
  if (game.phase !== 'question' || !game.deadline || !content.encerrarAoZerar) return;
  const ms = Math.max(0, game.deadline - Date.now()) + 300;
  closeTimer = setTimeout(() => {
    if (game.phase === 'question' && game.deadline && Date.now() >= game.deadline) {
      game.close();
      broadcastAll();
    } else {
      scheduleAutoClose();
    }
  }, ms);
}

function bind(socket, id) {
  socket.data.playerId = id;
  if (!socketsOf.has(id)) socketsOf.set(id, new Set());
  socketsOf.get(id).add(socket.id);
  const p = game.players.get(id);
  if (p) p.connected = true;
}

function unbind(socket) {
  const id = socket.data.playerId;
  if (!id) return;
  const set = socketsOf.get(id);
  if (set) {
    set.delete(socket.id);
    if (!set.size) {
      socketsOf.delete(id);
      const p = game.players.get(id);
      if (p) p.connected = false;
    }
  }
}

function ack(fn, payload) { if (typeof fn === 'function') fn(payload); }

io.on('connection', socket => {
  socket.emit('meta', game.common());
  if (game.phase === 'lobby') socket.emit('roster', game.roster());

  // ----- jogador -----
  // hello: reconexão. Se o servidor não conhece o id (reiniciou), recria com o perfil guardado no celular.
  socket.on('player:hello', (msg, fn) => {
    const id = msg && msg.id;
    let p = id && game.players.get(id);
    if (p && p.kicked) return ack(fn, { ok: false, kicked: true });
    if (!p) {
      if (!msg || !msg.profile) return ack(fn, { ok: false, unknown: true });
      const r = game.upsertPlayer({ id, ...msg.profile });
      if (r.error) return ack(fn, { ok: false, error: r.error });
      p = r.player;
    }
    bind(socket, p.id);
    ack(fn, { ok: true, id: p.id, state: game.playerView(p.id) });
    sendHosts();
    sendRoster();
  });

  socket.on('player:join', (msg, fn) => {
    const r = game.upsertPlayer(msg || {});
    if (r.error) return ack(fn, { ok: false, error: r.error });
    bind(socket, r.player.id);
    ack(fn, { ok: true, id: r.player.id, state: game.playerView(r.player.id) });
    sendHosts();
    sendRoster();
  });

  socket.on('player:vote', (msg, fn) => {
    const id = socket.data.playerId;
    const err = game.vote(id, msg && msg.d, msg && msg.opt);
    if (err) return ack(fn, { ok: false, error: err });
    ack(fn, { ok: true });
    sendPlayer(id);
    sendHosts();
  });

  socket.on('player:sync', (_msg, fn) => {
    const id = socket.data.playerId;
    ack(fn, id ? { ok: true, state: game.playerView(id) } : { ok: false });
  });

  // ----- host / admin -----
  socket.on('host:hello', (msg, fn) => {
    if (!msg || msg.key !== ADMIN_KEY) return ack(fn, { ok: false, error: 'Chave inválida.' });
    socket.data.isHost = true;
    socket.join('hosts');
    ack(fn, { ok: true, state: game.hostView() });
  });

  function hostCmd(name, handler) {
    socket.on(name, (msg, fn) => {
      if (!socket.data.isHost) return ack(fn, { ok: false, error: 'Sem permissão.' });
      try {
        handler(msg || {});
        broadcastAll();
        ack(fn, { ok: true });
      } catch (e) {
        ack(fn, { ok: false, error: String(e && e.message || e) });
      }
    });
  }

  hostCmd('host:next', () => game.next());
  hostCmd('host:prev', () => game.prev());
  hostCmd('host:close', () => game.close());
  hostCmd('host:extend', m => game.extend(Number(m.seconds) || 15));
  hostCmd('host:matrix', m => { game.showMatrix = m.show == null ? !game.showMatrix : !!m.show; });
  hostCmd('host:manual', m => {
    const d = Number(m.d);
    if (!Number.isInteger(d) || d < 0 || d >= game.decisions.length) throw new Error('Decisão inválida.');
    if (m.opt == null || m.opt === '') delete game.manual[d];
    else game.manual[d] = Number(m.opt);
  });
  hostCmd('host:course:add', m => game.addCourse(m.name));
  hostCmd('host:course:remove', m => game.removeCourse(m.name));
  hostCmd('host:kick', m => {
    const p = game.kick(m.id);
    if (p) {
      for (const sid of socketsOf.get(p.id) || []) io.to(sid).emit('kicked');
    }
  });
  hostCmd('host:reset', m => {
    if (m.players) {
      for (const p of game.players.values()) {
        for (const sid of socketsOf.get(p.id) || []) io.to(sid).emit('kicked', { reset: true });
      }
      game.players.clear();
      socketsOf.clear();
    }
    game.resetRound();
  });

  socket.on('disconnect', () => {
    unbind(socket);
    sendHosts();
  });
});

server.listen(PORT, () => {
  console.log(`Jogo da Vida no ar: http://localhost:${PORT}  (host: /host?key=${ADMIN_KEY === 'neuro' ? 'neuro' : '***'})`);
});
