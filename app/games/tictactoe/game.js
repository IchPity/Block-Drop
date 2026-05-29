// ─────────────────────────────────────────────────────────────────────────────
// Tic Tac Toe — Arcade
// Modi: lokaler Multiplayer, Online (Supabase Realtime), KI leicht, KI schwer.
// X beginnt immer. Gegen die KI ist der Mensch X, die KI O.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  const WIN_LINES = [
    [0,1,2],[3,4,5],[6,7,8],   // Reihen
    [0,3,6],[1,4,7],[2,5,8],   // Spalten
    [0,4,8],[2,4,6]            // Diagonalen
  ];

  // ─── DOM ───────────────────────────────────────────────────────────────────
  const boardEl   = document.getElementById('board');
  const statusEl  = document.getElementById('status-text');
  const sbX = document.getElementById('sb-x');
  const sbO = document.getElementById('sb-o');
  const scoreXEl = document.getElementById('score-x');
  const scoreOEl = document.getElementById('score-o');
  const scoreDEl = document.getElementById('score-draw');
  const nameXEl = document.getElementById('name-x');
  const nameOEl = document.getElementById('name-o');

  const modeOverlay = document.getElementById('mode-overlay');
  const onlineOverlay = document.getElementById('online-overlay');
  const goOverlay = document.getElementById('gameover-overlay');

  // ─── State ───────────────────────────────────────────────────────────────────
  const state = {
    mode: null,            // 'local' | 'online' | 'ai-easy' | 'ai-hard'
    board: Array(9).fill(''),
    turn: 'X',
    active: false,
    aiSymbol: 'O',
    humanSymbol: 'X',
    scores: { X: 0, O: 0, draw: 0 },
    // online
    channel: null,
    role: null,            // 'X' (Host) | 'O' (Gast)
    code: null,
    opponentPresent: false,
    aiTimer: null,
  };

  // ─── Board-Aufbau ────────────────────────────────────────────────────────────
  const cells = [];
  for (let i = 0; i < 9; i++) {
    const c = document.createElement('div');
    c.className = 'cell empty';
    c.dataset.i = i;
    c.addEventListener('click', () => onCellClick(i));
    boardEl.appendChild(c);
    cells.push(c);
  }

  function markSvg(sym) {
    if (sym === 'X') {
      return '<svg class="mark mark-x" viewBox="0 0 100 100">' +
             '<line x1="24" y1="24" x2="76" y2="76"/><line x1="76" y1="24" x2="24" y2="76"/></svg>';
    }
    return '<svg class="mark mark-o" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30"/></svg>';
  }

  function renderCell(i) {
    const sym = state.board[i];
    const c = cells[i];
    if (sym) {
      if (c.dataset.sym !== sym) {
        c.innerHTML = markSvg(sym);
        c.dataset.sym = sym;
      }
      c.classList.remove('empty');
    } else {
      c.innerHTML = '';
      delete c.dataset.sym;
      c.classList.add('empty');
    }
    c.classList.remove('win', 'x', 'o');
  }

  function renderAll() {
    for (let i = 0; i < 9; i++) renderCell(i);
    updatePlayable();
  }

  // Markiert, welche Felder gerade klickbar sind (rein kosmetisch fürs Hover).
  function updatePlayable() {
    let canPlay = state.active;
    if (state.mode === 'online') canPlay = canPlay && state.turn === state.role;
    else if (state.mode !== 'local') canPlay = canPlay && state.turn === state.humanSymbol;
    cells.forEach(c => c.classList.toggle('playable', canPlay));
    document.body.classList.toggle('locked', !canPlay);
  }

  // ─── Spiel-Bewertung ─────────────────────────────────────────────────────────
  function evaluate(board) {
    for (const [a, b, c] of WIN_LINES) {
      if (board[a] && board[a] === board[b] && board[b] === board[c]) {
        return { winner: board[a], line: [a, b, c] };
      }
    }
    if (board.every(v => v)) return { winner: null, draw: true };
    return null;
  }

  // ─── Status / Anzeige ──────────────────────────────────────────────────────
  function symSpan(sym) {
    const label = sym === 'X' ? '✕' : '◯';
    return '<b class="' + sym.toLowerCase() + '">' + label + '</b>';
  }

  function updateStatus() {
    sbX.classList.toggle('active-x', state.active && state.turn === 'X');
    sbO.classList.toggle('active-o', state.active && state.turn === 'O');
    if (!state.active) { statusEl.innerHTML = ''; return; }

    if (state.mode === 'online') {
      if (!state.opponentPresent) { statusEl.innerHTML = 'Warte auf Gegner…'; return; }
      statusEl.innerHTML = (state.turn === state.role)
        ? 'Du bist dran ' + symSpan(state.role)
        : 'Gegner ist dran ' + symSpan(state.turn);
    } else if (state.mode === 'ai-easy' || state.mode === 'ai-hard') {
      statusEl.innerHTML = (state.turn === state.humanSymbol)
        ? 'Du bist dran ' + symSpan(state.humanSymbol)
        : 'KI denkt nach… ' + symSpan(state.aiSymbol);
    } else {
      statusEl.innerHTML = symSpan(state.turn) + ' ist dran';
    }
  }

  function updateScores() {
    scoreXEl.textContent = state.scores.X;
    scoreOEl.textContent = state.scores.O;
    scoreDEl.textContent = state.scores.draw;
  }

  function setNames() {
    if (state.mode === 'local') { nameXEl.textContent = 'Spieler X'; nameOEl.textContent = 'Spieler O'; }
    else if (state.mode === 'online') {
      nameXEl.textContent = state.role === 'X' ? 'Du' : 'Gegner';
      nameOEl.textContent = state.role === 'O' ? 'Du' : 'Gegner';
    } else { nameXEl.textContent = 'Du'; nameOEl.textContent = 'KI'; }
  }

  // ─── Zug-Logik ───────────────────────────────────────────────────────────────
  function onCellClick(i) {
    if (!state.active || state.board[i]) return;
    if (state.mode === 'online') {
      if (!state.opponentPresent || state.turn !== state.role) return;
    } else if (state.mode === 'ai-easy' || state.mode === 'ai-hard') {
      if (state.turn !== state.humanSymbol) return;
    }
    applyTurn(i);
    if (state.mode === 'online') broadcastState(i);
    afterTurn();
  }

  // Setzt den Zug für den aktuell Dranseienden, prüft auf Ende, wechselt sonst.
  function applyTurn(i) {
    const sym = state.turn;
    state.board[i] = sym;
    renderCell(i);
    const res = evaluate(state.board);
    if (res) { endGame(res); return; }
    state.turn = sym === 'X' ? 'O' : 'X';
    updateStatus();
    updatePlayable();
  }

  // Nach einem lokalen/menschlichen Zug ggf. die KI ziehen lassen.
  function afterTurn() {
    if (!state.active) return;
    if ((state.mode === 'ai-easy' || state.mode === 'ai-hard') && state.turn === state.aiSymbol) {
      scheduleAi();
    }
  }

  function scheduleAi() {
    clearTimeout(state.aiTimer);
    updateStatus();
    state.aiTimer = setTimeout(() => {
      if (!state.active || state.turn !== state.aiSymbol) return;
      const i = (state.mode === 'ai-hard') ? bestMove(state.board, state.aiSymbol)
                                           : easyMove(state.board, state.aiSymbol);
      applyTurn(i);
    }, 420);
  }

  // ─── Spielende ─────────────────────────────────────────────────────────────
  function endGame(res) {
    state.active = false;
    updatePlayable();
    if (res.draw) {
      state.scores.draw++;
    } else {
      state.scores[res.winner]++;
      res.line.forEach(idx => cells[idx].classList.add('win', res.winner.toLowerCase()));
    }
    updateScores();
    sbX.classList.remove('active-x'); sbO.classList.remove('active-o');
    setTimeout(() => showGameOver(res), res.draw ? 350 : 650);
  }

  function showGameOver(res) {
    const icon = document.getElementById('go-icon');
    const title = document.getElementById('go-title');
    const sub = document.getElementById('go-sub');

    if (res.draw) {
      icon.textContent = '🤝';
      title.textContent = 'Unentschieden';
      sub.textContent = 'Niemand gewinnt — nochmal?';
    } else {
      const w = res.winner;
      if (state.mode === 'online') {
        const won = w === state.role;
        icon.textContent = won ? '🏆' : '😤';
        title.innerHTML = (won ? 'Du gewinnst! ' : 'Gegner gewinnt ') + symSpan(w);
        sub.textContent = won ? 'Stark gespielt.' : 'Revanche?';
      } else if (state.mode === 'ai-easy' || state.mode === 'ai-hard') {
        const won = w === state.humanSymbol;
        icon.textContent = won ? '🏆' : '🤖';
        title.innerHTML = won ? 'Du gewinnst! ' + symSpan(w) : 'KI gewinnt ' + symSpan(w);
        sub.textContent = won ? 'Mensch schlägt Maschine!' : 'Versuch es nochmal.';
      } else {
        icon.textContent = '🏆';
        title.innerHTML = symSpan(w) + ' gewinnt!';
        sub.textContent = 'Glückwunsch!';
      }
    }
    goOverlay.classList.add('open');
  }

  // ─── Neues Spiel ───────────────────────────────────────────────────────────
  function resetBoard() {
    clearTimeout(state.aiTimer);
    state.board = Array(9).fill('');
    state.turn = 'X';
    state.active = true;
    goOverlay.classList.remove('open');
    renderAll();
    updateStatus();
    updatePlayable();
    // KI ist O und kommt nie zuerst dran (X beginnt) — also kein Auto-Zug nötig.
  }

  // ─── KI: leicht ──────────────────────────────────────────────────────────────
  // Mischung aus Zufall und Heuristik → schlagbar, aber nicht völlig planlos.
  function emptyCells(board) {
    const e = [];
    for (let i = 0; i < 9; i++) if (!board[i]) e.push(i);
    return e;
  }

  function findLine(board, sym) {
    // Index, der für sym sofort gewinnt (oder blockt, wenn sym = Gegner).
    for (const [a, b, c] of WIN_LINES) {
      const line = [a, b, c];
      const marks = line.map(i => board[i]);
      const own = marks.filter(m => m === sym).length;
      const empt = marks.filter(m => !m).length;
      if (own === 2 && empt === 1) return line[marks.indexOf('')];
    }
    return -1;
  }

  function smartMove(board, sym) {
    const opp = sym === 'X' ? 'O' : 'X';
    let m = findLine(board, sym);            // selbst gewinnen
    if (m >= 0) return m;
    m = findLine(board, opp);                // Gegner blocken
    if (m >= 0) return m;
    if (!board[4]) return 4;                 // Zentrum
    const corners = [0, 2, 6, 8].filter(i => !board[i]);
    if (corners.length) return corners[(Math.random() * corners.length) | 0];
    const e = emptyCells(board);
    return e[(Math.random() * e.length) | 0];
  }

  function easyMove(board, sym) {
    const e = emptyCells(board);
    if (Math.random() < 0.62) return e[(Math.random() * e.length) | 0]; // oft einfach zufällig
    return smartMove(board, sym);
  }

  // ─── KI: schwer (Minimax, unbesiegbar) ───────────────────────────────────────
  function bestMove(board, sym) {
    const opp = sym === 'X' ? 'O' : 'X';
    let best = -Infinity, move = -1;
    for (let i = 0; i < 9; i++) {
      if (board[i]) continue;
      board[i] = sym;
      const score = minimax(board, 0, false, sym, opp);
      board[i] = '';
      if (score > best) { best = score; move = i; }
    }
    return move;
  }

  function minimax(board, depth, isMax, sym, opp) {
    const res = evaluate(board);
    if (res) {
      if (res.draw) return 0;
      return res.winner === sym ? 10 - depth : depth - 10;
    }
    if (isMax) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i]) continue;
        board[i] = sym;
        best = Math.max(best, minimax(board, depth + 1, false, sym, opp));
        board[i] = '';
      }
      return best;
    } else {
      let best = Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i]) continue;
        board[i] = opp;
        best = Math.min(best, minimax(board, depth + 1, true, sym, opp));
        board[i] = '';
      }
      return best;
    }
  }

  // ─── Modus starten ────────────────────────────────────────────────────────────
  function startMode(mode) {
    teardownOnline();
    state.mode = mode;
    state.scores = { X: 0, O: 0, draw: 0 };
    updateScores();
    modeOverlay.classList.remove('open');
    onlineOverlay.classList.remove('open');
    goOverlay.classList.remove('open');

    if (mode === 'online') { openOnlineSetup(); return; }

    state.humanSymbol = 'X';
    state.aiSymbol = 'O';
    setNames();
    resetBoard();
  }

  // ─── Online (Supabase Realtime Broadcast) ─────────────────────────────────────
  const onlineChoose = document.getElementById('online-choose');
  const onlineHost = document.getElementById('online-host');
  const onlineJoin = document.getElementById('online-join');

  function showOnlineScreen(which) {
    onlineChoose.style.display = which === 'choose' ? 'flex' : 'none';
    onlineHost.style.display   = which === 'host'   ? 'flex' : 'none';
    onlineJoin.style.display   = which === 'join'   ? 'flex' : 'none';
  }

  function openOnlineSetup() {
    setNames();
    showOnlineScreen('choose');
    onlineOverlay.classList.add('open');
  }

  function randomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne verwechselbare 0/O/1/I
    let s = '';
    for (let i = 0; i < 4; i++) s += chars[(Math.random() * chars.length) | 0];
    return s;
  }

  function getClient() {
    return (window.Auth && window.Auth.client) || null;
  }

  function teardownOnline() {
    if (state.channel) {
      try { state.channel.unsubscribe(); } catch (e) {}
      try { getClient() && getClient().removeChannel(state.channel); } catch (e) {}
    }
    state.channel = null;
    state.role = null;
    state.code = null;
    state.opponentPresent = false;
  }

  function connectChannel(code, role) {
    const client = getClient();
    if (!client) return false;
    teardownOnline();
    state.code = code;
    state.role = role;

    const channel = client.channel('ttt-' + code, {
      config: { broadcast: { self: false }, presence: { key: role } }
    });
    state.channel = channel;

    channel.on('broadcast', { event: 'state' }, ({ payload }) => applyRemoteState(payload));
    channel.on('broadcast', { event: 'reset' }, () => remoteReset());
    channel.on('broadcast', { event: 'hello' }, () => {
      // Neuer Spieler beigetreten → Host schickt aktuellen Stand zur Sync.
      if (state.role === 'X') broadcastState(null);
    });
    channel.on('presence', { event: 'sync' }, () => {
      const present = Object.keys(channel.presenceState()).length;
      const wasPresent = state.opponentPresent;
      state.opponentPresent = present >= 2;
      if (state.opponentPresent && !wasPresent) onOpponentJoined();
      updateStatus();
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ role, t: Date.now() });
        if (role === 'O') channel.send({ type: 'broadcast', event: 'hello', payload: {} });
      }
    });
    return true;
  }

  function onOpponentJoined() {
    // Beide verbunden → Spiel sichtbar machen. Host hält den Startzustand.
    onlineOverlay.classList.remove('open');
    setNames();
    if (state.role === 'X') {
      resetBoard();
      broadcastState(null);
    }
  }

  function broadcastState(lastIndex) {
    if (!state.channel) return;
    state.channel.send({
      type: 'broadcast', event: 'state',
      payload: { board: state.board, turn: state.turn, active: state.active, last: lastIndex }
    });
  }

  function applyRemoteState(p) {
    if (!p || !p.board) return;
    onlineOverlay.classList.remove('open');
    state.board = p.board.slice();
    state.turn = p.turn;
    renderAll();
    const res = evaluate(state.board);
    if (res && state.active) {
      // Gegner hat den Schlusszug gemacht → Ende auch bei uns auswerten.
      state.active = true; // sicherstellen, dass endGame zählt
      endGame(res);
    } else if (!res) {
      state.active = p.active !== false;
      updateStatus();
      updatePlayable();
    }
  }

  function remoteReset() {
    resetBoard();
  }

  // ─── Online UI-Verdrahtung ─────────────────────────────────────────────────
  document.getElementById('online-create-btn').addEventListener('click', () => {
    if (!getClient()) { showOnlineMsg(null, 'Verbindung nicht verfügbar.', 'err'); return; }
    const code = randomCode();
    document.getElementById('host-code').textContent = code;
    if (connectChannel(code, 'X')) {
      state.active = false;
      showOnlineScreen('host');
    }
  });

  document.getElementById('online-join-show').addEventListener('click', () => {
    document.getElementById('join-code-input').value = '';
    document.getElementById('join-msg').textContent = '';
    showOnlineScreen('join');
    setTimeout(() => document.getElementById('join-code-input').focus(), 100);
  });

  document.getElementById('copy-code-btn').addEventListener('click', () => {
    const code = document.getElementById('host-code').textContent;
    const done = () => {
      const b = document.getElementById('copy-code-btn');
      const orig = b.textContent; b.textContent = 'Kopiert ✓';
      setTimeout(() => (b.textContent = orig), 1400);
    };
    if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, done);
    else done();
  });

  const joinInput = document.getElementById('join-code-input');
  joinInput.addEventListener('input', () => {
    joinInput.value = joinInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  });
  joinInput.addEventListener('keydown', e => { if (e.key === 'Enter') doJoin(); });
  document.getElementById('join-connect-btn').addEventListener('click', doJoin);

  function doJoin() {
    const code = joinInput.value.trim().toUpperCase();
    const msg = document.getElementById('join-msg');
    if (code.length !== 4) { msg.className = 'ov-msg err'; msg.textContent = 'Bitte 4-stelligen Code eingeben.'; return; }
    if (!getClient()) { msg.className = 'ov-msg err'; msg.textContent = 'Verbindung nicht verfügbar.'; return; }
    msg.className = 'ov-msg wait'; msg.textContent = 'Verbinde…';
    state.active = false;
    connectChannel(code, 'O');
    // Falls nach ein paar Sekunden niemand da ist, Hinweis geben.
    setTimeout(() => {
      if (state.mode === 'online' && !state.opponentPresent && onlineJoin.style.display !== 'none') {
        msg.className = 'ov-msg err';
        msg.textContent = 'Kein Host gefunden. Code prüfen?';
      }
    }, 4000);
  }

  function showOnlineMsg(_id, text, cls) {
    const msg = document.getElementById('join-msg');
    msg.className = 'ov-msg ' + (cls || '');
    msg.textContent = text;
  }

  document.querySelectorAll('[data-back-menu]').forEach(el =>
    el.addEventListener('click', () => { teardownOnline(); openModeMenu(); }));
  document.querySelectorAll('[data-back-online]').forEach(el =>
    el.addEventListener('click', () => { teardownOnline(); showOnlineScreen('choose'); }));

  // ─── Menü / Buttons ─────────────────────────────────────────────────────────
  function openModeMenu() {
    teardownOnline();
    state.active = false;
    clearTimeout(state.aiTimer);
    goOverlay.classList.remove('open');
    onlineOverlay.classList.remove('open');
    updatePlayable();
    modeOverlay.classList.add('open');
  }

  document.querySelectorAll('.mode-btn').forEach(btn =>
    btn.addEventListener('click', () => startMode(btn.dataset.mode)));

  document.getElementById('menu-btn').addEventListener('click', openModeMenu);

  document.getElementById('new-game-btn').addEventListener('click', () => {
    if (!state.mode) { openModeMenu(); return; }
    if (state.mode === 'online') {
      if (!state.opponentPresent) { openOnlineSetup(); return; }
      resetBoard();
      if (state.channel) state.channel.send({ type: 'broadcast', event: 'reset', payload: {} });
    } else {
      resetBoard();
    }
  });

  document.getElementById('go-rematch').addEventListener('click', () => {
    if (state.mode === 'online') {
      if (!state.opponentPresent) { goOverlay.classList.remove('open'); openOnlineSetup(); return; }
      resetBoard();
      if (state.channel) state.channel.send({ type: 'broadcast', event: 'reset', payload: {} });
    } else {
      resetBoard();
    }
  });
  document.getElementById('go-menu').addEventListener('click', openModeMenu);

  // ─── Start ─────────────────────────────────────────────────────────────────
  renderAll();
  updateScores();
  openModeMenu();
})();
