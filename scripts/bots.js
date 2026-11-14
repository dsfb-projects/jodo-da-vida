// Jogadores-robô para testar sem 40 celulares.
// Uso: node scripts/bots.js [quantidade] [url] [--drop]
//   --drop  derruba e reconecta alguns robôs no meio do jogo (teste de reconexão)
'use strict';
const { io } = require('socket.io-client');

const N = Number(process.argv[2]) || 30;
const URL = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'http://localhost:3000';
const DROP = process.argv.includes('--drop');

const NICKS = ['Ana', 'Bia', 'Caio', 'Duda', 'Enzo', 'Fefe', 'Gabi', 'Hugo', 'Iza', 'João', 'Kaká', 'Lulu', 'Malu', 'Nina', 'Otto',
  'Pepê', 'Quel', 'Rafa', 'Sofi', 'Tati', 'Uli', 'Vivi', 'Wes', 'Xan', 'Yuri', 'Zezé', 'Bruno', 'Carol', 'Dani', 'Lari', 'Mel', 'Theo'];
const LIM = { c: 16, s: 4, e: 10, m: 10, t: 24, g: 8, v: 10, vc: 10, k: 6 };
const rand = n => Math.floor(Math.random() * n);

function makeBot(i) {
  const profile = {
    nick: NICKS[i % NICKS.length] + (i >= NICKS.length ? i : ''),
    course: Math.random() < 0.6 ? 'Ciência de Dados' : 'Publicidade e Propaganda',
    avatar: Object.fromEntries(Object.entries(LIM).map(([k, n]) => [k, rand(n)])),
  };
  let id = null;
  let voted = {};
  const sock = io(URL, { reconnectionDelay: 300 });
  sock.on('connect', () => {
    if (id) sock.emit('player:hello', { id, profile }, () => {});
    else sock.emit('player:join', profile, res => { if (res.ok) id = res.id; });
  });
  sock.on('state', s => {
    if (s.phase === 'question' && s.myVote == null && !voted[s.d]) {
      voted[s.d] = true;
      if (Math.random() < 0.08) return; // alguns não respondem
      setTimeout(() => {
        const n = s.decision.opcoes.length;
        // leve viés pra primeira opção, só pra ter distribuição desigual
        const opt = Math.random() < 0.35 ? 0 : rand(n);
        sock.emit('player:vote', { d: s.d, opt }, () => {});
      }, 1000 + Math.random() * 7000);
    }
  });
  if (DROP && i % 5 === 0) {
    setInterval(() => { sock.disconnect(); setTimeout(() => sock.connect(), 1500 + Math.random() * 2000); }, 9000 + Math.random() * 5000);
  }
  return sock;
}

const bots = [];
for (let i = 0; i < N; i++) setTimeout(() => bots.push(makeBot(i)), i * 120);
console.log(`${N} robôs entrando em ${URL}${DROP ? ' (com quedas de conexão)' : ''}. Ctrl+C para sair.`);
