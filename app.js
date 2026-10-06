/* Блиц — быстрые шахматы в браузере. Без зависимостей. */
(() => {
'use strict';

/* =====================================================================
   1. Правила: позиция, генерация ходов, шах/мат/пат
   ===================================================================== */
const FILES = 'abcdefgh';
const sqName = (i) => FILES[i & 7] + (8 - (i >> 3));
const other = (c) => (c === 'w' ? 'b' : 'w');
const KNIGHT = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const ROOK = [[-1,0],[1,0],[0,-1],[0,1]];
const BISHOP = [[-1,-1],[-1,1],[1,-1],[1,1]];
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const PIECE_RU = { k: 'король', q: 'ферзь', r: 'ладья', b: 'слон', n: 'конь', p: 'пешка' };

function fromFen(fen) {
  const [placement, turn, rights, ep, half, full] = fen.split(' ');
  const board = new Array(64).fill(null);
  let i = 0;
  for (const ch of placement) {
    if (ch === '/') continue;
    if (/\d/.test(ch)) { i += Number(ch); continue; }
    board[i++] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toLowerCase();
  }
  return {
    board, turn,
    castle: { wK: rights.includes('K'), wQ: rights.includes('Q'), bK: rights.includes('k'), bQ: rights.includes('q') },
    ep: ep === '-' ? -1 : (8 - Number(ep[1])) * 8 + FILES.indexOf(ep[0]),
    half: Number(half), full: Number(full),
  };
}
const startState = () => fromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');

function attacked(board, s, by) {
  const r = s >> 3, c = s & 7;
  const pr = by === 'w' ? r + 1 : r - 1;
  if (pr >= 0 && pr < 8) {
    for (const dc of [-1, 1]) {
      if (c + dc >= 0 && c + dc < 8 && board[pr * 8 + c + dc] === by + 'p') return true;
    }
  }
  for (const [dr, dc] of KNIGHT) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && board[rr * 8 + cc] === by + 'n') return true;
  }
  for (const [dr, dc] of KING) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < 8 && cc >= 0 && cc < 8 && board[rr * 8 + cc] === by + 'k') return true;
  }
  const slide = (dirs, a, b) => {
    for (const [dr, dc] of dirs) {
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
        const p = board[rr * 8 + cc];
        if (p) { if (p[0] === by && (p[1] === a || p[1] === b)) return true; break; }
        rr += dr; cc += dc;
      }
    }
    return false;
  };
  return slide(ROOK, 'r', 'q') || slide(BISHOP, 'b', 'q');
}

const kingSq = (board, color) => board.indexOf(color + 'k');
const inCheck = (board, color) => attacked(board, kingSq(board, color), other(color));

function pseudoMoves(st, color) {
  const { board } = st;
  const out = [];
  const enemy = other(color);
  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (!piece || piece[0] !== color) continue;
    const type = piece[1], r = from >> 3, c = from & 7;
    if (type === 'p') {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      const promoRow = color === 'w' ? 0 : 7;
      const push = (to, flag) => {
        if ((to >> 3) === promoRow) for (const promo of ['q', 'r', 'b', 'n']) out.push({ from, to, promo });
        else out.push({ from, to, flag });
      };
      const one = from + dir * 8;
      if (!board[one]) {
        push(one);
        if (r === startRow && !board[one + dir * 8]) out.push({ from, to: one + dir * 8, flag: 'double' });
      }
      for (const dc of [-1, 1]) {
        if (c + dc < 0 || c + dc > 7) continue;
        const to = one + dc;
        if (board[to] && board[to][0] === enemy) push(to);
        else if (to === st.ep) out.push({ from, to, flag: 'ep' });
      }
    } else if (type === 'n' || type === 'k') {
      for (const [dr, dc] of (type === 'n' ? KNIGHT : KING)) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || rr > 7 || cc < 0 || cc > 7) continue;
        const t = board[rr * 8 + cc];
        if (!t || t[0] === enemy) out.push({ from, to: rr * 8 + cc });
      }
      if (type === 'k') {
        const base = color === 'w' ? 60 : 4;
        if (from === base && !attacked(board, base, enemy)) {
          if (st.castle[color + 'K'] && board[base + 3] === color + 'r' && !board[base + 1] && !board[base + 2]
              && !attacked(board, base + 1, enemy) && !attacked(board, base + 2, enemy)) {
            out.push({ from, to: base + 2, flag: 'castle' });
          }
          if (st.castle[color + 'Q'] && board[base - 4] === color + 'r' && !board[base - 1] && !board[base - 2] && !board[base - 3]
              && !attacked(board, base - 1, enemy) && !attacked(board, base - 2, enemy)) {
            out.push({ from, to: base - 2, flag: 'castle' });
          }
        }
      }
    } else {
      const dirs = type === 'r' ? ROOK : type === 'b' ? BISHOP : ROOK.concat(BISHOP);
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
          const t = board[rr * 8 + cc];
          if (!t) out.push({ from, to: rr * 8 + cc });
          else { if (t[0] === enemy) out.push({ from, to: rr * 8 + cc }); break; }
          rr += dr; cc += dc;
        }
      }
    }
  }
  return out;
}

function makeMove(st, m) {
  const board = st.board.slice();
  const piece = board[m.from];
  const color = piece[0];
  const captured = board[m.to];
  board[m.to] = m.promo ? color + m.promo : piece;
  board[m.from] = null;
  if (m.flag === 'ep') board[m.to + (color === 'w' ? 8 : -8)] = null;
  if (m.flag === 'castle') {
    if (m.to > m.from) { board[m.from + 1] = board[m.from + 3]; board[m.from + 3] = null; }
    else { board[m.from - 1] = board[m.from - 4]; board[m.from - 4] = null; }
  }
  const castle = { ...st.castle };
  if (piece[1] === 'k') { castle[color + 'K'] = false; castle[color + 'Q'] = false; }
  for (const s of [m.from, m.to]) {
    if (s === 63) castle.wK = false;
    if (s === 56) castle.wQ = false;
    if (s === 7) castle.bK = false;
    if (s === 0) castle.bQ = false;
  }
  return {
    board, castle,
    turn: other(st.turn),
    ep: m.flag === 'double' ? (m.from + m.to) / 2 : -1,
    half: piece[1] === 'p' || captured ? 0 : st.half + 1,
    full: st.full + (color === 'b' ? 1 : 0),
  };
}

function legalMoves(st) {
  const color = st.turn;
  return pseudoMoves(st, color).filter((m) => !inCheck(makeMove(st, m).board, color));
}

function insufficient(board) {
  const rest = board.filter((p) => p && p[1] !== 'k');
  if (rest.length === 0) return true;
  if (rest.length === 1 && (rest[0][1] === 'n' || rest[0][1] === 'b')) return true;
  return false;
}

const posKey = (st) =>
  st.board.map((p) => p || '-').join('') + st.turn +
  (st.castle.wK ? 'K' : '') + (st.castle.wQ ? 'Q' : '') + (st.castle.bK ? 'k' : '') + (st.castle.bQ ? 'q' : '') + st.ep;

/* Запись хода в алгебраической нотации (SAN) */
function toSan(st, m, legal) {
  const piece = st.board[m.from];
  const type = piece[1];
  let s = '';
  if (m.flag === 'castle') {
    s = m.to > m.from ? 'O-O' : 'O-O-O';
  } else {
    const capture = !!st.board[m.to] || m.flag === 'ep';
    if (type === 'p') {
      if (capture) s += FILES[m.from & 7] + 'x';
      s += sqName(m.to);
      if (m.promo) s += '=' + m.promo.toUpperCase();
    } else {
      s += type.toUpperCase();
      const rivals = legal.filter((o) => o.from !== m.from && st.board[o.from] === piece && o.to === m.to);
      if (rivals.length) {
        const sameFile = rivals.some((o) => (o.from & 7) === (m.from & 7));
        const sameRank = rivals.some((o) => (o.from >> 3) === (m.from >> 3));
        if (!sameFile) s += FILES[m.from & 7];
        else if (!sameRank) s += 8 - (m.from >> 3);
        else s += sqName(m.from);
      }
      if (capture) s += 'x';
      s += sqName(m.to);
    }
  }
  const next = makeMove(st, m);
  if (inCheck(next.board, next.turn)) s += legalMoves(next).length ? '+' : '#';
  return s;
}

/* =====================================================================
   2. Соперник: поиск с альфа-бета отсечением
   ===================================================================== */
const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100000;

function pieceSquareBonus(type, color, r, c, endgame) {
  const progress = color === 'w' ? 7 - r : r;
  const center = 3.5 - Math.max(Math.abs(c - 3.5), Math.abs(r - 3.5));
  switch (type) {
    case 'p': return progress * 8 + center * 3;
    case 'n': return center * 12 - (progress === 0 ? 10 : 0);
    case 'b': return center * 6 - (progress === 0 ? 8 : 0);
    case 'r': return progress === 6 ? 15 : 0;
    case 'q': return center * 2;
    case 'k':
      if (endgame) return center * 10;
      return (progress === 0 ? 8 : -progress * 12) + (progress === 0 && (c <= 2 || c >= 6) ? 18 : 0);
  }
  return 0;
}

function evaluate(st) {
  let material = 0;
  for (const p of st.board) if (p && p[1] !== 'k' && p[1] !== 'p') material += VALUE[p[1]];
  const endgame = material < 2400;
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = st.board[i];
    if (!p) continue;
    const v = VALUE[p[1]] + pieceSquareBonus(p[1], p[0], i >> 3, i & 7, endgame);
    score += p[0] === 'w' ? v : -v;
  }
  return st.turn === 'w' ? score : -score;
}

function orderMoves(st, moves) {
  const score = (m) => {
    const victim = st.board[m.to];
    let s = 0;
    if (victim) s += 10 * VALUE[victim[1]] - VALUE[st.board[m.from][1]] + 1000;
    if (m.promo) s += VALUE[m.promo] + 800;
    return s;
  };
  return moves.sort((a, b) => score(b) - score(a));
}

function quiesce(st, alpha, beta, depth) {
  const stand = evaluate(st);
  if (depth === 0) return stand;
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const caps = orderMoves(st, legalMoves(st).filter((m) => st.board[m.to] || m.flag === 'ep' || m.promo));
  for (const m of caps) {
    const score = -quiesce(makeMove(st, m), -beta, -alpha, depth - 1);
    if (score >= beta) return score;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(st, depth, alpha, beta, ply) {
  const moves = legalMoves(st);
  if (!moves.length) return inCheck(st.board, st.turn) ? -MATE + ply : 0;
  if (depth === 0) return quiesce(st, alpha, beta, 3);
  let best = -Infinity;
  for (const m of orderMoves(st, moves)) {
    const score = -negamax(makeMove(st, m), depth - 1, -beta, -alpha, ply + 1);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

const LEVELS = {
  easy:   { depth: 1, blunder: 0.3, label: 'Новичок' },
  medium: { depth: 2, blunder: 0,   label: 'Любитель' },
  hard:   { depth: 3, blunder: 0,   label: 'Сильный' },
};

function chooseMove(st, levelKey) {
  const level = LEVELS[levelKey];
  const moves = legalMoves(st);
  if (Math.random() < level.blunder) return moves[Math.floor(Math.random() * moves.length)];
  let scored = orderMoves(st, moves).map((m) => ({
    m, score: -negamax(makeMove(st, m), level.depth - 1, -Infinity, Infinity, 1),
  }));
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((x) => x.score >= scored[0].score - 8);
  return top[Math.floor(Math.random() * top.length)].m;
}

/* =====================================================================
   3. Интерфейс
   ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function pieceHtml(p) {
  return `<span class="piece ${p[0]}" aria-hidden="true">${GLYPH[p[1]]}&#xFE0E;</span>`;
}

/* Статичная доска для hero */
function renderPreview() {
  const el = $('#heroBoard');
  if (!el) return;
  const st = fromFen('r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7');
  el.innerHTML = st.board.map((p, i) => {
    const dark = ((i >> 3) + (i & 7)) % 2 === 1;
    return `<div class="sq ${dark ? 'dark' : 'light'}">${p ? pieceHtml(p) : ''}</div>`;
  }).join('');
}

const game = { token: 0 };
const els = {
  board: $('#board'), moves: $('#moves'), status: $('#status'),
  clockTop: $('#clockTop'), clockBottom: $('#clockBottom'),
  nameTop: $('#nameTop'), nameBottom: $('#nameBottom'),
  overlay: $('#overlay'), overlayTitle: $('#overlayTitle'), overlayText: $('#overlayText'),
  promo: $('#promo'), promoChoices: $('#promoChoices'),
  tc: $('#tc'), color: $('#color'), level: $('#level'),
};

function newGame() {
  const [min, inc] = els.tc.value.split('+').map(Number);
  let player = els.color.value;
  if (player === 'r') player = Math.random() < 0.5 ? 'w' : 'b';
  const state = startState();
  Object.assign(game, {
    token: game.token + 1,
    state, hist: [], keys: [posKey(state)],
    over: null, player, level: els.level.value,
    base: min * 60000, inc: inc * 1000,
    clocks: { w: min * 60000, b: min * 60000 },
    running: false, last: performance.now(),
    sel: -1, targets: [], flipped: player === 'b',
    thinking: false, pending: null,
  });
  els.overlay.hidden = true;
  els.promo.hidden = true;
  render();
  if (state.turn !== player) scheduleAi();
}

function tick() {
  if (!game.running || game.over) return;
  const now = performance.now();
  const turn = game.state.turn;
  game.clocks[turn] -= now - game.last;
  game.last = now;
  if (game.clocks[turn] <= 0) {
    game.clocks[turn] = 0;
    finish({ winner: other(turn), text: `Время вышло — победа ${other(turn) === 'w' ? 'белых' : 'чёрных'}` });
  }
  renderClocks();
}

function fmt(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (ms < 10000) return `0:0${(Math.max(0, ms) / 1000).toFixed(1).replace('.', ',')}`;
  const m = Math.floor(total / 60), s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function renderClocks() {
  const bottom = game.flipped ? 'b' : 'w';
  const top = other(bottom);
  for (const [el, color] of [[els.clockTop, top], [els.clockBottom, bottom]]) {
    el.textContent = fmt(game.clocks[color]);
    el.classList.toggle('active', !game.over && game.state.turn === color && game.running);
    el.classList.toggle('low', game.clocks[color] < 20000);
  }
}

function render() {
  renderBoard();
  renderClocks();
  renderMoves();
  const bottom = game.flipped ? 'b' : 'w';
  const nameOf = (c) => (c === game.player ? 'Вы' : `Компьютер · ${LEVELS[game.level].label}`);
  els.nameBottom.textContent = `${nameOf(bottom)} (${bottom === 'w' ? 'белые' : 'чёрные'})`;
  els.nameTop.textContent = `${nameOf(other(bottom))} (${bottom === 'w' ? 'чёрные' : 'белые'})`;
  renderStatus();
}

function renderStatus() {
  const st = game.state;
  let text;
  if (game.over) text = game.over.text;
  else if (game.thinking) text = 'Соперник думает…';
  else if (st.turn === game.player) text = inCheck(st.board, st.turn) ? 'Вам шах! Ваш ход' : 'Ваш ход';
  else text = 'Ход соперника';
  els.status.textContent = text;
}

function renderBoard() {
  const st = game.state;
  const order = [...Array(64).keys()];
  if (game.flipped) order.reverse();
  const last = game.hist.length ? game.hist[game.hist.length - 1].m : null;
  const checkSq = !game.over && inCheck(st.board, st.turn) ? kingSq(st.board, st.turn) : -1;
  const checkmated = game.over && /Мат/.test(game.over.text) ? kingSq(st.board, st.turn) : -1;
  els.board.innerHTML = order.map((i, k) => {
    const p = st.board[i];
    const dark = ((i >> 3) + (i & 7)) % 2 === 1;
    const cls = ['sq', dark ? 'dark' : 'light'];
    if (last && (i === last.from || i === last.to)) cls.push('last');
    if (i === game.sel) cls.push('selected');
    if (i === checkSq || i === checkmated) cls.push('check');
    const target = game.targets.some((m) => m.to === i);
    if (target) cls.push(p || game.targets.some((m) => m.to === i && m.flag === 'ep') ? 'capture' : 'target');
    const rank = k % 8 === 0 ? `<i class="coord rank">${8 - (i >> 3)}</i>` : '';
    const file = k >> 3 === 7 ? `<i class="coord file">${FILES[i & 7]}</i>` : '';
    const label = `${sqName(i)}${p ? ', ' + (p[0] === 'w' ? 'белая ' : 'чёрная ') + PIECE_RU[p[1]] : ''}`;
    return `<button type="button" class="${cls.join(' ')}" data-sq="${i}" aria-label="${label}">${rank}${file}${p ? pieceHtml(p) : ''}</button>`;
  }).join('');
}

function renderMoves() {
  const rows = [];
  for (let i = 0; i < game.hist.length; i += 2) {
    const w = game.hist[i], b = game.hist[i + 1];
    rows.push(`<li><span class="num">${i / 2 + 1}.</span><span class="mv">${w.san}</span><span class="mv">${b ? b.san : ''}</span></li>`);
  }
  els.moves.innerHTML = rows.length ? rows.join('') : '<li class="empty">Здесь появится запись партии</li>';
  els.moves.scrollTop = els.moves.scrollHeight;
}

function playerTurn() {
  return !game.over && !game.thinking && game.state.turn === game.player;
}

function onBoardClick(e) {
  const btn = e.target.closest('.sq');
  if (!btn || !playerTurn()) return;
  const i = Number(btn.dataset.sq);
  const moves = legalMoves(game.state);
  const chosen = game.targets.filter((m) => m.to === i);
  if (game.sel >= 0 && chosen.length) {
    if (chosen.length > 1) { askPromotion(chosen); return; }
    commit(chosen[0]);
    return;
  }
  const p = game.state.board[i];
  if (p && p[0] === game.player && i !== game.sel) {
    game.sel = i;
    game.targets = moves.filter((m) => m.from === i);
  } else {
    game.sel = -1;
    game.targets = [];
  }
  renderBoard();
}

function askPromotion(options) {
  els.promoChoices.innerHTML = options.map((m) =>
    `<button type="button" class="promo-btn" data-promo="${m.promo}" aria-label="${PIECE_RU[m.promo]}">${pieceHtml(game.player + m.promo)}</button>`).join('');
  game.pending = options;
  els.promo.hidden = false;
}

function onPromo(e) {
  const btn = e.target.closest('.promo-btn');
  if (!btn || !game.pending) return;
  const m = game.pending.find((o) => o.promo === btn.dataset.promo);
  game.pending = null;
  els.promo.hidden = true;
  commit(m);
}

function commit(m) {
  tick();
  if (game.over) return;
  const before = game.state;
  const legal = legalMoves(before);
  const san = toSan(before, m, legal);
  const mover = before.turn;
  if (game.running) game.clocks[mover] += game.inc;
  game.hist.push({ before, m, san });
  game.state = makeMove(before, m);
  game.keys.push(posKey(game.state));
  game.sel = -1;
  game.targets = [];
  game.running = true;
  game.last = performance.now();
  const end = detectEnd();
  if (end) { finish(end); return; }
  render();
  if (game.state.turn !== game.player) scheduleAi();
}

function detectEnd() {
  const st = game.state;
  if (!legalMoves(st).length) {
    if (inCheck(st.board, st.turn)) {
      return { winner: other(st.turn), text: `Мат — победа ${other(st.turn) === 'w' ? 'белых' : 'чёрных'}` };
    }
    return { winner: null, text: 'Пат — ничья' };
  }
  if (insufficient(st.board)) return { winner: null, text: 'Ничья: недостаточно материала' };
  if (st.half >= 100) return { winner: null, text: 'Ничья по правилу 50 ходов' };
  const key = game.keys[game.keys.length - 1];
  if (game.keys.filter((k) => k === key).length >= 3) return { winner: null, text: 'Ничья: троекратное повторение' };
  return null;
}

function finish(result) {
  game.over = result;
  game.thinking = false;
  game.sel = -1;
  game.targets = [];
  render();
  const title = result.winner === null ? 'Ничья' : result.winner === game.player ? 'Вы победили!' : 'Вы проиграли';
  els.overlayTitle.textContent = title;
  els.overlayText.textContent = result.text;
  els.overlay.hidden = false;
}

function scheduleAi() {
  const token = game.token;
  game.thinking = true;
  renderStatus();
  const delay = 350 + Math.random() * 450;
  setTimeout(() => {
    if (token !== game.token || game.over) return;
    const m = chooseMove(game.state, game.level);
    if (token !== game.token || game.over) return;
    game.thinking = false;
    commit(m);
  }, delay);
}

function undo() {
  if (game.over || game.thinking || !game.hist.length) return;
  let steps = game.state.turn === game.player ? 2 : 1;
  steps = Math.min(steps, game.hist.length);
  for (let i = 0; i < steps; i++) {
    const entry = game.hist.pop();
    game.state = entry.before;
    game.keys.pop();
  }
  game.sel = -1;
  game.targets = [];
  game.token++;
  if (!game.hist.length) { game.running = false; }
  game.last = performance.now();
  els.promo.hidden = true;
  render();
  if (game.state.turn !== game.player) scheduleAi();
}

function resign() {
  if (game.over || !game.hist.length) return;
  finish({ winner: other(game.player), text: 'Вы сдались' });
}

/* ===== События ===== */
els.board.addEventListener('click', onBoardClick);
els.promoChoices.addEventListener('click', onPromo);
$('#newGame').addEventListener('click', newGame);
$('#overlayNew').addEventListener('click', newGame);
$('#undo').addEventListener('click', undo);
$('#resign').addEventListener('click', resign);
$('#flip').addEventListener('click', () => { game.flipped = !game.flipped; render(); });
$('#promoCancel').addEventListener('click', () => { game.pending = null; els.promo.hidden = true; });
[els.tc, els.color, els.level].forEach((el) => el.addEventListener('change', newGame));

$$('[data-mode]').forEach((card) => {
  card.addEventListener('click', () => {
    els.tc.value = card.dataset.mode;
    $$('[data-mode]').forEach((c) => c.setAttribute('aria-pressed', String(c === card)));
    newGame();
    $('#play').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

$$('[data-go-play]').forEach((el) => el.addEventListener('click', (e) => {
  e.preventDefault();
  $('#play').scrollIntoView({ behavior: 'smooth', block: 'start' });
}));

const nav = $('#nav');
const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

const io = new IntersectionObserver((entries) => {
  entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
}, { threshold: 0.12 });
$$('.reveal').forEach((el) => io.observe(el));

setInterval(tick, 100);
renderPreview();
newGame();
})();
