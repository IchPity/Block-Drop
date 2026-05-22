'use strict';

const PIECE = { PAWN:'P', ROOK:'R', KNIGHT:'N', BISHOP:'B', QUEEN:'Q', KING:'K' };
const SYM = {
  white: { K:'♔', Q:'♕', R:'♖', B:'♗', N:'♘', P:'♙' },
  black: { K:'♚', Q:'♛', R:'♜', B:'♝', N:'♞', P:'♟' }
};

// board[col][row]  col=0 left, row=0 top
let board = [];
let turnWhite = true;
let gameOver = false;
let winner = null;
let selCol = -1, selRow = -1;
let lastFrom = null, lastTo = null;
let promotionPending = null; // {col, row, white}
let capturedByWhite = []; // pieces white captured
let capturedByBlack = []; // pieces black captured

function newPiece(type, white) {
  return { type, white, firstMove: true, moves: [] };
}

// ── Init ─────────────────────────────────────────────────────────

function initGame() {
  board = Array.from({ length: 8 }, () => Array(8).fill(null));
  turnWhite = true;
  gameOver = false;
  winner = null;
  selCol = -1; selRow = -1;
  lastFrom = null; lastTo = null;
  promotionPending = null;
  capturedByWhite = [];
  capturedByBlack = [];

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

  refreshAllMoves();
  refreshAllMoves();
  renderBoard();
  updateTurnUI();
  document.getElementById('gameover-overlay').style.display = 'none';
  document.getElementById('promotion-overlay').style.display = 'none';
}

// ── Move Calculation ──────────────────────────────────────────────

function inBounds(c, r) { return c >= 0 && c < 8 && r >= 0 && r < 8; }
function hasMove(moves, c, r) { return moves.some(m => m[0] === c && m[1] === r); }

function refreshAllMoves() {
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      if (!board[i][j]) continue;
      const p = board[i][j];
      p.moves = [];
      if      (p.type === PIECE.PAWN)   calcPawnMoves(p, i, j);
      else if (p.type === PIECE.ROOK)   calcSlidingMoves(p, i, j, [[1,0],[-1,0],[0,1],[0,-1]]);
      else if (p.type === PIECE.KNIGHT) calcKnightMoves(p, i, j);
      else if (p.type === PIECE.BISHOP) calcSlidingMoves(p, i, j, [[1,1],[-1,1],[-1,-1],[1,-1]]);
      else if (p.type === PIECE.QUEEN)  calcSlidingMoves(p, i, j, [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]]);
      else if (p.type === PIECE.KING)   calcKingMoves(p, i, j);
    }
  }
}

function calcPawnMoves(p, i, j) {
  const dir = p.white ? -1 : 1;
  const enemy = !p.white;
  if (inBounds(i, j + dir) && !board[i][j + dir])
    p.moves.push([i, j + dir]);
  if (p.firstMove && !board[i][j + dir] && inBounds(i, j + 2 * dir) && !board[i][j + 2 * dir])
    p.moves.push([i, j + 2 * dir]);
  for (const dc of [-1, 1])
    if (inBounds(i + dc, j + dir) && board[i + dc][j + dir] && board[i + dc][j + dir].white === enemy)
      p.moves.push([i + dc, j + dir]);
}

function calcSlidingMoves(p, i, j, dirs) {
  for (const [dc, dr] of dirs) {
    let count = 1;
    while (true) {
      const nc = i + dc * count, nr = j + dr * count;
      if (!inBounds(nc, nr)) break;
      const t = board[nc][nr];
      if (t) { if (t.white !== p.white) p.moves.push([nc, nr]); break; }
      p.moves.push([nc, nr]);
      count++;
    }
  }
}

function calcKnightMoves(p, i, j) {
  for (const [dc, dr] of [[-2,-1],[-1,-2],[1,-2],[2,-1],[-2,1],[-1,2],[1,2],[2,1]]) {
    const nc = i + dc, nr = j + dr;
    if (inBounds(nc, nr) && (!board[nc][nr] || board[nc][nr].white !== p.white))
      p.moves.push([nc, nr]);
  }
}

function calcKingMoves(p, i, j) {
  for (const [dc, dr] of [[-1,-1],[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0]]) {
    const nc = i + dc, nr = j + dr;
    if (inBounds(nc, nr) && (!board[nc][nr] || board[nc][nr].white !== p.white))
      p.moves.push([nc, nr]);
  }
  if (!p.firstMove) return;
  const row = p.white ? 7 : 0;

  // King-side castling (kleine Rochade)
  const krook = board[7][row];
  if (krook && krook.type === PIECE.ROOK && krook.firstMove &&
      !board[5][row] && !board[6][row] &&
      !isThreatened(!p.white, 5, row) && !isThreatened(!p.white, 6, row))
    p.moves.push([i + 2, row]);

  // Queen-side castling (große Rochade)
  const qrook = board[0][row];
  if (qrook && qrook.type === PIECE.ROOK && qrook.firstMove &&
      !board[1][row] && !board[2][row] && !board[3][row] &&
      !isThreatened(!p.white, 1, row) && !isThreatened(!p.white, 2, row) && !isThreatened(!p.white, 3, row))
    p.moves.push([i - 2, row]);
}

function isThreatened(byWhite, col, row) {
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++)
      if (board[i][j] && board[i][j].white === byWhite && hasMove(board[i][j].moves, col, row))
        return true;
  return false;
}

// ── Move Execution ────────────────────────────────────────────────

function movePiece(fromCol, fromRow, toCol, toRow) {
  const p = board[fromCol][fromRow];

  const captured = board[toCol][toRow];
  if (captured) {
    if (p.white) capturedByWhite.push(captured);
    else capturedByBlack.push(captured);
    if (captured.type === PIECE.KING) {
      gameOver = true;
      winner = p.white ? 'white' : 'black';
    }
  }

  lastFrom = [fromCol, fromRow];
  lastTo = [toCol, toRow];
  board[toCol][toRow] = p;
  board[fromCol][fromRow] = null;

  if (p.type === PIECE.PAWN) {
    if (p.firstMove) p.firstMove = false;
    if ((p.white && toRow === 0) || (!p.white && toRow === 7))
      promotionPending = { col: toCol, row: toRow, white: p.white };
  }

  if (p.type === PIECE.KING) {
    const row = p.white ? 7 : 0;
    if (toCol - fromCol === 2) {     // king-side
      board[5][row] = board[7][row];
      board[7][row] = null;
    } else if (fromCol - toCol === 2) { // queen-side
      board[3][row] = board[0][row];
      board[0][row] = null;
    }
    p.firstMove = false;
  }

  if (p.type === PIECE.ROOK) p.firstMove = false;

  turnWhite = !turnWhite;
  refreshAllMoves();
  refreshAllMoves();
}

function promoteTo(type) {
  if (!promotionPending) return;
  const { col, row, white } = promotionPending;
  board[col][row] = { type, white, firstMove: false, moves: [] };
  promotionPending = null;
  refreshAllMoves();
  refreshAllMoves();
  document.getElementById('promotion-overlay').style.display = 'none';
  renderBoard();
  updateTurnUI();
  if (gameOver) showGameOver();
}

// ── Click Handler ─────────────────────────────────────────────────

function handleCellClick(col, row) {
  if (gameOver || promotionPending) return;

  if (selCol !== -1) {
    const sel = board[selCol][selRow];
    if (sel && hasMove(sel.moves, col, row)) {
      movePiece(selCol, selRow, col, row);
      selCol = -1; selRow = -1;
      renderBoard();
      updateTurnUI();
      if (promotionPending) showPromotion();
      else if (gameOver) showGameOver();
      return;
    }
  }

  const p = board[col][row];
  selCol = (p && p.white === turnWhite) ? col : -1;
  selRow = (p && p.white === turnWhite) ? row : -1;
  renderBoard();
}

// ── Rendering ─────────────────────────────────────────────────────

function renderBoard() {
  const container = document.getElementById('chess-board');
  container.innerHTML = '';

  const selMoves = (selCol !== -1 && board[selCol][selRow]) ? board[selCol][selRow].moves : [];

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const cell = document.createElement('div');
      cell.className = 'cell ' + ((row + col) % 2 === 0 ? 'light' : 'dark');

      if (lastFrom && lastFrom[0] === col && lastFrom[1] === row) cell.classList.add('last-from');
      if (lastTo   && lastTo[0]   === col && lastTo[1]   === row) cell.classList.add('last-to');
      if (selCol === col && selRow === row) cell.classList.add('selected');

      const isTarget = hasMove(selMoves, col, row);
      if (isTarget && !board[col][row]) {
        const dot = document.createElement('div');
        dot.className = 'move-dot';
        cell.appendChild(dot);
      }

      const p = board[col][row];
      if (p) {
        if (isTarget) cell.classList.add('capturable-ring');
        const span = document.createElement('span');
        span.className = 'piece';
        span.textContent = SYM[p.white ? 'white' : 'black'][p.type];
        cell.appendChild(span);
      }

      // File label (bottom row) and rank label (left col)
      if (row === 7) {
        const lbl = document.createElement('div');
        lbl.className = 'file-lbl';
        lbl.textContent = 'abcdefgh'[col];
        cell.appendChild(lbl);
      }
      if (col === 0) {
        const lbl = document.createElement('div');
        lbl.className = 'rank-lbl';
        lbl.textContent = 8 - row;
        cell.appendChild(lbl);
      }

      cell.addEventListener('click', () => handleCellClick(col, row));
      container.appendChild(cell);
    }
  }

  // Update captured panels
  const bwEl = document.getElementById('captured-by-white');
  const bbEl = document.getElementById('captured-by-black');
  if (bwEl) bwEl.textContent = capturedByWhite.map(p => SYM.black[p.type]).join('');
  if (bbEl) bbEl.textContent = capturedByBlack.map(p => SYM.white[p.type]).join('');
}

function updateTurnUI() {
  const el = document.getElementById('turn-indicator');
  const dot = document.getElementById('turn-dot');
  if (gameOver) {
    el.textContent = (winner === 'white' ? 'Weiß' : 'Schwarz') + ' gewinnt!';
    dot.className = 'turn-dot ' + winner;
  } else {
    el.textContent = (turnWhite ? 'Weiß' : 'Schwarz') + ' ist dran';
    dot.className = 'turn-dot ' + (turnWhite ? 'white' : 'black');
  }
}

function showPromotion() {
  const { white } = promotionPending;
  const choices = [
    { type: PIECE.QUEEN,  label: 'Dame' },
    { type: PIECE.ROOK,   label: 'Turm' },
    { type: PIECE.BISHOP, label: 'Läufer' },
    { type: PIECE.KNIGHT, label: 'Springer' },
  ];
  const container = document.getElementById('promo-choices');
  container.innerHTML = '';
  for (const { type, label } of choices) {
    const btn = document.createElement('button');
    btn.className = 'promo-btn';
    btn.innerHTML = `<span class="promo-sym">${SYM[white ? 'white' : 'black'][type]}</span><span class="promo-lbl">${label}</span>`;
    btn.addEventListener('click', () => promoteTo(type));
    container.appendChild(btn);
  }
  document.getElementById('promotion-overlay').style.display = 'flex';
}

function showGameOver() {
  document.getElementById('gameover-winner').textContent =
    (winner === 'white' ? 'Weiß' : 'Schwarz') + ' gewinnt!';
  document.getElementById('gameover-overlay').style.display = 'flex';
}

// ── Boot ──────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('new-game-btn').addEventListener('click', initGame);
  document.getElementById('gameover-new-btn').addEventListener('click', initGame);
  initGame();
});
