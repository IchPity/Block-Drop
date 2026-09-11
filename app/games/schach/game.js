'use strict';

const PIECE = { PAWN:'P', ROOK:'R', KNIGHT:'N', BISHOP:'B', QUEEN:'Q', KING:'K' };
const SYM = {
  white: { K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙' },
  black: { K:'♚', Q:'♛', R:'♜', B:'♝', N:'♞', P:'♟' }
};

// ── Players ────────────────────────────────────────────────────────
let playerWhite  = 'Weiß';
let playerBlack  = 'Schwarz';

// ── Board state ───────────────────────────────────────────────────
let board          = [];
let turnWhite      = true;
let gameOver       = false;
let winner         = null;
let selCol = -1, selRow = -1;
let lastFrom = null, lastTo = null;
let promotionPending = null;
let capturedByWhite  = [];
let capturedByBlack  = [];

// ── Piece factory ─────────────────────────────────────────────────
function newPiece(type, white) {
  return { type, white, firstMove: true, moves: [] };
}

// ── Board init ────────────────────────────────────────────────────
function initBoard() {
  board = Array.from({ length: 8 }, () => Array(8).fill(null));
  turnWhite = true; gameOver = false; winner = null;
  selCol = -1; selRow = -1; lastFrom = null; lastTo = null;
  promotionPending = null; capturedByWhite = []; capturedByBlack = [];

  for (let c = 0; c < 8; c++) board[c][6] = newPiece(PIECE.PAWN, true);
  board[0][7] = newPiece(PIECE.ROOK,   true);
  board[1][7] = newPiece(PIECE.KNIGHT, true);
  board[2][7] = newPiece(PIECE.BISHOP, true);
  board[3][7] = newPiece(PIECE.QUEEN,  true);
  board[4][7] = newPiece(PIECE.KING,   true);
  board[5][7] = newPiece(PIECE.BISHOP, true);
  board[6][7] = newPiece(PIECE.KNIGHT, true);
  board[7][7] = newPiece(PIECE.ROOK,   true);

  for (let c = 0; c < 8; c++) board[c][1] = newPiece(PIECE.PAWN, false);
  board[0][0] = newPiece(PIECE.ROOK,   false);
  board[1][0] = newPiece(PIECE.KNIGHT, false);
  board[2][0] = newPiece(PIECE.BISHOP, false);
  board[3][0] = newPiece(PIECE.QUEEN,  false);
  board[4][0] = newPiece(PIECE.KING,   false);
  board[5][0] = newPiece(PIECE.BISHOP, false);
  board[6][0] = newPiece(PIECE.KNIGHT, false);
  board[7][0] = newPiece(PIECE.ROOK,   false);

  refreshAllMoves(); refreshAllMoves();
}

// ── Move Calculation ──────────────────────────────────────────────
function inBounds(c, r) { return c >= 0 && c < 8 && r >= 0 && r < 8; }
function hasMove(moves, c, r) { return moves.some(m => m[0] === c && m[1] === r); }

function refreshAllMoves() {
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++) {
      if (!board[i][j]) continue;
      const p = board[i][j]; p.moves = [];
      if      (p.type === PIECE.PAWN)   calcPawnMoves(p, i, j);
      else if (p.type === PIECE.ROOK)   calcSliding(p, i, j, [[1,0],[-1,0],[0,1],[0,-1]]);
      else if (p.type === PIECE.KNIGHT) calcKnightMoves(p, i, j);
      else if (p.type === PIECE.BISHOP) calcSliding(p, i, j, [[1,1],[-1,1],[-1,-1],[1,-1]]);
      else if (p.type === PIECE.QUEEN)  calcSliding(p, i, j, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]]);
      else if (p.type === PIECE.KING)   calcKingMoves(p, i, j);
    }
}

function calcPawnMoves(p, i, j) {
  const dir = p.white ? -1 : 1;
  const en  = !p.white;
  if (inBounds(i, j+dir) && !board[i][j+dir]) p.moves.push([i, j+dir]);
  if (p.firstMove && !board[i][j+dir] && inBounds(i, j+2*dir) && !board[i][j+2*dir])
    p.moves.push([i, j+2*dir]);
  for (const dc of [-1,1])
    if (inBounds(i+dc, j+dir) && board[i+dc][j+dir] && board[i+dc][j+dir].white === en)
      p.moves.push([i+dc, j+dir]);
}

function calcSliding(p, i, j, dirs) {
  for (const [dc,dr] of dirs) {
    let n = 1;
    while (true) {
      const nc = i+dc*n, nr = j+dr*n;
      if (!inBounds(nc,nr)) break;
      const t = board[nc][nr];
      if (t) { if (t.white !== p.white) p.moves.push([nc,nr]); break; }
      p.moves.push([nc,nr]); n++;
    }
  }
}

function calcKnightMoves(p, i, j) {
  for (const [dc,dr] of [[-2,-1],[-1,-2],[1,-2],[2,-1],[-2,1],[-1,2],[1,2],[2,1]]) {
    const nc = i+dc, nr = j+dr;
    if (inBounds(nc,nr) && (!board[nc][nr] || board[nc][nr].white !== p.white))
      p.moves.push([nc,nr]);
  }
}

function calcKingMoves(p, i, j) {
  for (const [dc,dr] of [[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]]) {
    const nc = i+dc, nr = j+dr;
    if (inBounds(nc,nr) && (!board[nc][nr] || board[nc][nr].white !== p.white))
      p.moves.push([nc,nr]);
  }
  if (!p.firstMove) return;
  const row = p.white ? 7 : 0;
  const kr = board[7][row];
  if (kr && kr.type === PIECE.ROOK && kr.firstMove && !board[5][row] && !board[6][row] &&
      !threatened(!p.white,5,row) && !threatened(!p.white,6,row))
    p.moves.push([i+2, row]);
  const qr = board[0][row];
  if (qr && qr.type === PIECE.ROOK && qr.firstMove && !board[1][row] && !board[2][row] && !board[3][row] &&
      !threatened(!p.white,1,row) && !threatened(!p.white,2,row) && !threatened(!p.white,3,row))
    p.moves.push([i-2, row]);
}

function threatened(byWhite, col, row) {
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++)
      if (board[i][j] && board[i][j].white === byWhite && hasMove(board[i][j].moves, col, row))
        return true;
  return false;
}

// ── Move Execution ────────────────────────────────────────────────
function movePiece(fc, fr, tc, tr, promoPiece) {
  const p = board[fc][fr];
  const cap = board[tc][tr];
  if (cap) {
    if (p.white) capturedByWhite.push(cap); else capturedByBlack.push(cap);
    if (cap.type === PIECE.KING) { gameOver = true; winner = p.white ? 'white' : 'black'; }
  }
  lastFrom = [fc,fr]; lastTo = [tc,tr];
  board[tc][tr] = p; board[fc][fr] = null;

  if (p.type === PIECE.PAWN) {
    if (p.firstMove) p.firstMove = false;
    if ((p.white && tr === 0) || (!p.white && tr === 7)) {
      if (promoPiece) {
        board[tc][tr] = { type: promoPiece, white: p.white, firstMove: false, moves: [] };
      } else {
        promotionPending = { col: tc, row: tr, white: p.white };
      }
    }
  }
  if (p.type === PIECE.KING) {
    const row = p.white ? 7 : 0;
    if (tc - fc ===  2) { board[5][row] = board[7][row]; board[7][row] = null; }
    if (fc - tc ===  2) { board[3][row] = board[0][row]; board[0][row] = null; }
    p.firstMove = false;
  }
  if (p.type === PIECE.ROOK) p.firstMove = false;

  turnWhite = !turnWhite;
  refreshAllMoves(); refreshAllMoves();
}

// ── Click Handler ─────────────────────────────────────────────────
function handleCellClick(col, row) {
  if (gameOver || promotionPending) return;

  if (selCol !== -1) {
    const sel = board[selCol][selRow];
    if (sel && hasMove(sel.moves, col, row)) {
      const fc = selCol, fr = selRow;
      selCol = -1; selRow = -1;
      movePiece(fc, fr, col, row);
      renderBoard(); updateTurnUI();
      if (promotionPending) {
        showPromotion();
      } else if (gameOver) {
        showGameOver();
      }
      return;
    }
  }

  const p = board[col][row];
  selCol = (p && p.white === turnWhite) ? col : -1;
  selRow = (p && p.white === turnWhite) ? row : -1;
  renderBoard();
}

// ── Promotion ─────────────────────────────────────────────────────
function promoteTo(type) {
  if (!promotionPending) return;
  const { col, row, white } = promotionPending;
  board[col][row] = { type, white, firstMove: false, moves: [] };
  promotionPending = null;
  refreshAllMoves(); refreshAllMoves();
  document.getElementById('promotion-overlay').style.display = 'none';
  renderBoard(); updateTurnUI();
  if (gameOver) showGameOver();
}

function showPromotion() {
  const isWhite = promotionPending.white;
  const choices = [
    { type:PIECE.QUEEN,  label:'Dame'     },
    { type:PIECE.ROOK,   label:'Turm'     },
    { type:PIECE.BISHOP, label:'Läufer'   },
    { type:PIECE.KNIGHT, label:'Springer' },
  ];
  const container = document.getElementById('promo-choices');
  container.innerHTML = '';
  for (const { type, label } of choices) {
    const btn = document.createElement('button');
    btn.className = 'promo-btn';
    btn.innerHTML = `<span class="promo-sym ${isWhite?'':'black-piece'}">${SYM[isWhite?'white':'black'][type]}</span><span class="promo-lbl">${label}</span>`;
    btn.addEventListener('click', () => promoteTo(type));
    container.appendChild(btn);
  }
  document.getElementById('promotion-overlay').style.display = 'flex';
}

// ── Rendering ─────────────────────────────────────────────────────
function renderBoard() {
  const container = document.getElementById('chess-board');
  container.innerHTML = '';
  const selMoves = (selCol !== -1 && board[selCol][selRow]) ? board[selCol][selRow].moves : [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = document.createElement('div');
      cell.className = 'cell ' + ((row+col)%2===0 ? 'light' : 'dark');
      if (lastFrom && lastFrom[0]===col && lastFrom[1]===row) cell.classList.add('last-from');
      if (lastTo   && lastTo[0]  ===col && lastTo[1]  ===row) cell.classList.add('last-to');
      if (selCol===col && selRow===row) cell.classList.add('selected');
      const isTarget = hasMove(selMoves, col, row);
      const p = board[col][row];
      if (isTarget && !p) {
        const dot = document.createElement('div'); dot.className = 'move-dot'; cell.appendChild(dot);
      }
      if (p) {
        if (isTarget) cell.classList.add('capturable-ring');
        const span = document.createElement('span');
        span.className = 'piece' + (p.white ? '' : ' black-piece');
        span.textContent = SYM[p.white ? 'white' : 'black'][p.type];
        cell.appendChild(span);
      }
      if (row === 7) {
        const l = document.createElement('div'); l.className = 'file-lbl'; l.textContent = 'abcdefgh'[col]; cell.appendChild(l);
      }
      if (col === 0) {
        const l = document.createElement('div'); l.className = 'rank-lbl'; l.textContent = 8-row; cell.appendChild(l);
      }
      cell.addEventListener('click', () => handleCellClick(col, row));
      container.appendChild(cell);
    }
  }

  const bwEl = document.getElementById('captured-by-white');
  const bbEl = document.getElementById('captured-by-black');
  if (bwEl) bwEl.textContent = capturedByWhite.map(p => SYM.black[p.type]).join('');
  if (bbEl) bbEl.textContent = capturedByBlack.map(p => SYM.white[p.type]).join('');
}

function updateTurnUI() {
  const el  = document.getElementById('turn-indicator');
  const dot = document.getElementById('turn-dot');
  const name = turnWhite ? playerWhite : playerBlack;
  if (gameOver) {
    const wName = winner === 'white' ? playerWhite : playerBlack;
    el.textContent = wName + ' gewinnt!';
    dot.className  = 'turn-dot ' + winner;
  } else {
    el.textContent = name + ' ist dran';
    dot.className  = 'turn-dot ' + (turnWhite ? 'white' : 'black');
  }
}

function showGameOver() {
  const wName = winner === 'white' ? playerWhite : playerBlack;
  document.getElementById('gameover-winner').textContent = wName + ' gewinnt!';
  document.getElementById('gameover-overlay').style.display = 'flex';
}

// ── Start Screen Logic ────────────────────────────────────────────
let startColor  = 'random';  // 'white' | 'black' | 'random'

function setStartColor(color) {
  startColor = color;
  ['white','black','random'].forEach(c =>
    document.getElementById('color-' + c).classList.toggle('selected', c === color)
  );
}

function handleStart() {
  const myName  = document.getElementById('p1-name').value.trim() || 'Spieler 1';
  const p2Input = document.getElementById('p2-name').value.trim() || 'Spieler 2';
  let assignedColor = startColor;
  if (assignedColor === 'random') assignedColor = Math.random() < 0.5 ? 'white' : 'black';
  playerWhite = assignedColor === 'white' ? myName : p2Input;
  playerBlack = assignedColor === 'white' ? p2Input : myName;
  document.getElementById('start-overlay').style.display = 'none';
  document.getElementById('gameover-overlay').style.display = 'none';
  initBoard();
  renderBoard(); updateTurnUI();
}

function handleNewGame() {
  document.getElementById('gameover-overlay').style.display = 'none';
  document.getElementById('start-overlay').style.display    = 'flex';
}

// ── Boot ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Color buttons
  ['white','black','random'].forEach(c =>
    document.getElementById('color-' + c).addEventListener('click', () => setStartColor(c))
  );

  // Start / New game
  document.getElementById('start-btn').addEventListener('click',      handleStart);
  document.getElementById('new-game-btn').addEventListener('click',   handleNewGame);
  document.getElementById('gameover-new-btn').addEventListener('click', handleNewGame);

  // Init UI state
  setStartColor('random');
  initBoard();
  renderBoard();
});
