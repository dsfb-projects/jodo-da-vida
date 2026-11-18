// Motor do jogo: estado, transições e pontuação. Sem nada de rede aqui.
'use strict';

const crypto = require('crypto');

const AVATAR_LIMITS = { c: 16, s: 4, e: 10, m: 10, t: 24, g: 8, v: 10, vc: 10, k: 6 };

function clampInt(v, max) {
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n >= max ? max - 1 : n;
}

function cleanAvatar(a) {
  const out = {};
  for (const [k, max] of Object.entries(AVATAR_LIMITS)) out[k] = clampInt(a && a[k], max);
  return out;
}

function cleanText(s, max) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
}

class Game {
  constructor(content) {
    this.content = content;
    this.players = new Map(); // id -> player
    this.courses = [...content.cursos];
    this.resetRound();
  }

  resetRound() {
    this.phase = 'lobby'; // lobby | intro | question | reveal | final
    this.d = -1;
    this.finalStep = 0;
    this.deadline = null;
    this.showMatrix = false;
    this.manual = {}; // decisão -> índice da opção escolhida pela turma (modo manual)
    this.questionOpenedAt = null;
    for (const p of this.players.values()) { p.votes = {}; p.voteMs = {}; }
  }

  get decisions() { return this.content.decisoes; }
  get pillarIds() { return this.content.pilares.map(p => p.id); }

  // ---------- jogadores ----------
  activePlayers() {
    return [...this.players.values()].filter(p => !p.kicked);
  }

  uniqueNick(nick, selfId) {
    const taken = new Set(this.activePlayers().filter(p => p.id !== selfId).map(p => p.nick.toLowerCase()));
    if (!taken.has(nick.toLowerCase())) return nick;
    for (let i = 2; i < 100; i++) {
      const n = `${nick.slice(0, 13)}${i}`;
      if (!taken.has(n.toLowerCase())) return n;
    }
    return nick;
  }

  upsertPlayer({ id, nick, course, avatar }) {
    const cleanNick = cleanText(nick, 16);
    if (!cleanNick) return { error: 'Escolha um nick.' };
    let pid = cleanText(id, 40);
    if (!/^[a-zA-Z0-9_-]{6,40}$/.test(pid)) pid = crypto.randomUUID();
    let p = this.players.get(pid);
    if (p && p.kicked) return { error: 'Você foi removido do jogo.' };
    const c = cleanText(course, 40);
    const fields = {
      nick: this.uniqueNick(cleanNick, pid),
      course: this.courses.includes(c) ? c : (this.courses[0] || ''),
      avatar: cleanAvatar(avatar),
    };
    if (!p) {
      p = { id: pid, votes: {}, voteMs: {}, joinedAt: Date.now(), connected: true, kicked: false, ...fields };
      this.players.set(pid, p);
    } else {
      Object.assign(p, fields);
    }
    return { player: p };
  }

  kick(id) {
    const p = this.players.get(id);
    if (p) p.kicked = true;
    return p;
  }

  addCourse(name) {
    const n = cleanText(name, 40);
    if (n && !this.courses.includes(n)) this.courses.push(n);
  }

  removeCourse(name) {
    this.courses = this.courses.filter(c => c !== name);
  }

  vote(id, d, opt) {
    const p = this.players.get(id);
    if (!p || p.kicked) return 'Jogador não encontrado.';
    if (this.phase !== 'question' || d !== this.d) return 'A votação não está aberta.';
    const n = this.decisions[d].opcoes.length;
    if (!Number.isInteger(opt) || opt < 0 || opt >= n) return 'Opção inválida.';
    if (p.votes[d] != null) return null; // já votou, ignora sem erro
    p.votes[d] = opt;
    p.voteMs[d] = Date.now() - (this.questionOpenedAt || Date.now());
    return null;
  }

  // ---------- fluxo ----------
  openQuestion() {
    this.phase = 'question';
    this.questionOpenedAt = Date.now();
    this.deadline = Date.now() + this.content.segundosPorDecisao * 1000;
  }

  next() {
    const last = this.decisions.length - 1;
    this.showMatrix = false;
    switch (this.phase) {
      case 'lobby': this.phase = 'intro'; this.d = 0; break;
      case 'intro': this.openQuestion(); break;
      case 'question': this.close(); break;
      case 'reveal':
        if (this.d < last) { this.phase = 'intro'; this.d += 1; }
        else { this.phase = 'final'; this.finalStep = 0; }
        break;
      case 'final':
        if (this.finalStep < this.lastFinalStep()) this.finalStep += 1;
        else this.resetRound(); // "voltar ao início": mantém os jogadores e zera os votos
        break;
    }
  }

  lastFinalStep() { return this.content.mostrarRanking === false ? 0 : 1; }

  prev() {
    this.showMatrix = false;
    switch (this.phase) {
      case 'intro':
        if (this.d === 0) { this.phase = 'lobby'; this.d = -1; }
        else { this.phase = 'reveal'; this.d -= 1; }
        break;
      case 'question': this.phase = 'intro'; this.deadline = null; break;
      case 'reveal': this.openQuestion(); break; // reabre a votação, votos ficam
      case 'final':
        if (this.finalStep > 0) this.finalStep -= 1;
        else { this.phase = 'reveal'; this.d = this.decisions.length - 1; }
        break;
    }
  }

  close() {
    if (this.phase !== 'question') return;
    this.phase = 'reveal';
    this.deadline = null;
  }

  extend(seconds) {
    if (this.phase === 'question' && this.deadline) this.deadline += seconds * 1000;
  }

  // decisões cujo resultado já pode ser contado
  revealedCount() {
    if (this.phase === 'final') return this.decisions.length;
    if (this.phase === 'reveal') return this.d + 1;
    if (this.phase === 'intro' || this.phase === 'question') return Math.max(this.d, 0);
    return 0;
  }

  // ---------- pontuação ----------
  baseScores() {
    const s = {};
    for (const id of this.pillarIds) s[id] = this.content.pontosIniciais;
    return s;
  }

  effectOf(d, opt) {
    const e = this.decisions[d].opcoes[opt].efeito || {};
    const out = {};
    for (const id of this.pillarIds) out[id] = Number(e[id]) || 0;
    return out;
  }

  scoresOf(p, upTo = this.revealedCount()) {
    const s = this.baseScores();
    for (let d = 0; d < upTo; d++) {
      if (p.votes[d] == null) continue;
      const e = this.effectOf(d, p.votes[d]);
      for (const id of this.pillarIds) s[id] += e[id];
    }
    return s;
  }

  summarize(scores) {
    const ids = this.pillarIds;
    const vals = ids.map(id => scores[id]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const total = vals.reduce((a, b) => a + b, 0);
    let profile = 'equilibrado';
    if (max - min > this.content.limiarEquilibrio) profile = ids[vals.indexOf(max)];
    return { scores, equilibrio: min, total, profile };
  }

  // tempo total de resposta (desempate: quem respondeu mais rápido). Não respondeu = tempo cheio.
  speedOf(p, upTo = this.revealedCount()) {
    const full = this.content.segundosPorDecisao * 1000;
    let ms = 0;
    for (let d = 0; d < upTo; d++) ms += p.votes[d] != null ? (p.voteMs[d] ?? full) : full;
    return ms;
  }

  ranking() {
    const rows = this.activePlayers().map(p => ({ id: p.id, ...this.summarize(this.scoresOf(p)), ms: this.speedOf(p) }));
    rows.sort((a, b) => b.equilibrio - a.equilibrio || b.total - a.total || a.ms - b.ms);
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }

  // média da turma: média dos jogadores, com a escolha manual substituindo a decisão quando existir
  classScores(upTo = this.revealedCount()) {
    const ids = this.pillarIds;
    const players = this.activePlayers();
    const s = this.baseScores();
    for (let d = 0; d < upTo; d++) {
      if (this.manual[d] != null) {
        const e = this.effectOf(d, this.manual[d]);
        for (const id of ids) s[id] += e[id];
      } else if (players.length) {
        for (const p of players) {
          if (p.votes[d] == null) continue;
          const e = this.effectOf(d, p.votes[d]);
          for (const id of ids) s[id] += e[id] / players.length;
        }
      }
    }
    for (const id of ids) s[id] = Math.round(s[id] * 10) / 10;
    return s;
  }

  voteCounts(d) {
    const n = this.decisions[d].opcoes.length;
    const counts = Array(n).fill(0);
    for (const p of this.activePlayers()) if (p.votes[d] != null) counts[p.votes[d]] += 1;
    return counts;
  }

  // quem está na sala, para a lista no celular durante o lobby
  roster() {
    return this.activePlayers().map(p => ({ id: p.id, nick: p.nick, avatar: p.avatar }));
  }

  // ---------- visões ----------
  decisionView(d, withEffects) {
    if (d < 0 || d >= this.decisions.length) return null;
    const dec = this.decisions[d];
    return {
      index: d,
      total: this.decisions.length,
      titulo: dec.titulo,
      cenario: dec.cenario,
      apresentador: dec.apresentador,
      tema: dec.tema,
      opcoes: dec.opcoes.map((o, i) => ({
        texto: o.texto,
        icone: o.icone,
        efeito: withEffects ? this.effectOf(d, i) : undefined,
      })),
    };
  }

  common() {
    return {
      phase: this.phase,
      d: this.d,
      finalStep: this.finalStep,
      deadline: this.deadline,
      serverNow: Date.now(),
      courses: this.courses,
      config: {
        titulo: this.content.titulo,
        subtitulo: this.content.subtitulo,
        nomePilares: this.content.nomePilares,
        pilares: this.content.pilares,
        pontosIniciais: this.content.pontosIniciais,
        perfis: this.content.perfis,
        totalDecisoes: this.decisions.length,
        segundos: this.content.segundosPorDecisao,
        mostrarRanking: this.content.mostrarRanking !== false,
      },
    };
  }

  playerView(id) {
    const p = this.players.get(id);
    const base = this.common();
    if (!p) return { ...base, me: null };
    const revealing = this.phase === 'reveal' || this.phase === 'final';
    const view = {
      ...base,
      me: { id: p.id, nick: p.nick, course: p.course, avatar: p.avatar },
      decision: this.decisionView(this.d, revealing),
      myVote: this.d >= 0 ? (p.votes[this.d] ?? null) : null,
    };
    if (this.phase === 'final') {
      const rows = this.ranking();
      const mine = rows.find(r => r.id === id);
      view.final = { ...mine, of: rows.length, classScores: this.classScores() };
    }
    return view;
  }

  hostView() {
    const base = this.common();
    const revealing = this.phase === 'reveal' || this.phase === 'final';
    const players = this.activePlayers().map(p => ({
      id: p.id,
      nick: p.nick,
      course: p.course,
      avatar: p.avatar,
      connected: p.connected,
      voted: this.d >= 0 && p.votes[this.d] != null,
      vote: revealing && this.d >= 0 ? (p.votes[this.d] ?? null) : null,
    }));
    const view = {
      ...base,
      players,
      decision: this.decisionView(this.d, revealing),
      allDecisions: this.decisions.map((_, i) => this.decisionView(i, true)),
      showMatrix: this.showMatrix,
      manual: this.manual,
      counts: revealing && this.d >= 0 ? this.voteCounts(this.d) : null,
      classScores: this.classScores(),
    };
    if (this.phase === 'final') {
      view.ranking = this.ranking();
    }
    return view;
  }
}

module.exports = { Game, cleanAvatar, AVATAR_LIMITS };
