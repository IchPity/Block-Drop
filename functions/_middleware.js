// Cloudflare Pages Function – portiert die komplette server.ps1-Logik nach JS.
// Läuft als Middleware vor jeder Anfrage: blockt sensible Dateien, beantwortet
// /api/*-Routen über die D1-Datenbank und liefert sonst die statische Seite aus.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

// Wird in eine frische D1-Datenbank einmalig eingsetzt (admin + bisheriger Testuser).
const SEED_USERS = [
  { username: 'Peter', password: 'Admin111', role: 'admin', createdAt: '2026-05-21' },
  { username: 'Test0', password: 'Test111', role: 'user', createdAt: '2026-05-26' },
];

let dbReady = false;

async function ensureDb(db) {
  if (dbReady) return;
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY, password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user', createdAt TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, username TEXT NOT NULL,
      role TEXT NOT NULL, expires INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL DEFAULT 'anonymous',
      mode TEXT NOT NULL, score INTEGER NOT NULL, level INTEGER NOT NULL,
      lines INTEGER NOT NULL, date TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS achievements (
      id TEXT NOT NULL, username TEXT NOT NULL DEFAULT 'anonymous',
      unlockedAt TEXT NOT NULL, PRIMARY KEY (id, username))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS chess_rooms (
      code TEXT PRIMARY KEY, white TEXT, black TEXT,
      moves TEXT NOT NULL DEFAULT '[]', gameOver INTEGER NOT NULL DEFAULT 0,
      winner TEXT, created TEXT NOT NULL)`),
  ]);
  await db.batch(SEED_USERS.map(u =>
    db.prepare(`INSERT OR IGNORE INTO users (username,password,role,createdAt) VALUES (?,?,?,?)`)
      .bind(u.username, u.password, u.role, u.createdAt)
  ));
  dbReady = true;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  });
}

function getToken(request) {
  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) return auth.slice(7);
  return new URL(request.url).searchParams.get('token');
}

async function getSession(db, request) {
  const tok = getToken(request);
  if (!tok) return null;
  const row = await db.prepare(`SELECT username, role, expires FROM sessions WHERE token = ?`)
    .bind(tok).first();
  if (!row) return null;
  if (row.expires > Date.now()) return { username: row.username, role: row.role };
  await db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(tok).run();
  return null;
}

function newToken() {
  return crypto.randomUUID().replace(/-/g, '');
}

function newRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

// ── API ────────────────────────────────────────────────────────────────────────

async function handleApi(request, env) {
  const db = env.DB;
  await ensureDb(db);

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // ── Auth ──
  if (path === '/api/auth/login' && method === 'POST') {
    const creds = await readJson(request);
    const u = await db.prepare(`SELECT username, role FROM users WHERE username = ? AND password = ?`)
      .bind(String(creds.username ?? ''), String(creds.password ?? '')).first();
    if (!u) return json({ ok: false, error: 'Ungültige Zugangsdaten' }, 401);
    const tok = newToken();
    await db.prepare(`INSERT INTO sessions (token,username,role,expires) VALUES (?,?,?,?)`)
      .bind(tok, u.username, u.role, Date.now() + 24 * 3600 * 1000).run();
    return json({ ok: true, token: tok, username: u.username, role: u.role });
  }

  if (path === '/api/auth/register' && method === 'POST') {
    const creds = await readJson(request);
    const uname = creds.username ? String(creds.username) : '';
    const upass = creds.password ? String(creds.password) : '';
    if (!uname || !upass) return json({ ok: false, error: 'Benutzername und Passwort erforderlich' }, 400);
    const exists = await db.prepare(`SELECT 1 FROM users WHERE username = ?`).bind(uname).first();
    if (exists) return json({ ok: false, error: 'Benutzername bereits vergeben' }, 409);
    const createdAt = new Date().toISOString().slice(0, 10);
    await db.prepare(`INSERT INTO users (username,password,role,createdAt) VALUES (?,?,?,?)`)
      .bind(uname, upass, 'user', createdAt).run();
    const tok = newToken();
    await db.prepare(`INSERT INTO sessions (token,username,role,expires) VALUES (?,?,?,?)`)
      .bind(tok, uname, 'user', Date.now() + 24 * 3600 * 1000).run();
    return json({ ok: true, token: tok, username: uname, role: 'user' });
  }

  if (path === '/api/auth/verify' && method === 'GET') {
    const s = await getSession(db, request);
    return s ? json({ ok: true, username: s.username, role: s.role }) : json({ ok: false }, 401);
  }

  if (path === '/api/auth/logout' && method === 'POST') {
    const tok = getToken(request);
    if (tok) await db.prepare(`DELETE FROM sessions WHERE token = ?`).bind(tok).run();
    return json({ ok: true });
  }

  // ── Users (admin) ──
  if (path === '/api/users' && method === 'GET') {
    const s = await getSession(db, request);
    if (!s || s.role !== 'admin') return json({ ok: false, error: 'Zugriff verweigert' }, 403);
    const { results } = await db.prepare(
      `SELECT username, password, role, createdAt FROM users ORDER BY createdAt`).all();
    return json({ ok: true, users: results ?? [] });
  }

  // ── Scores ──
  if (path === '/api/scores' && method === 'GET') {
    const mode = url.searchParams.get('mode') || 'classic';
    const { results } = await db.prepare(
      `SELECT username, mode, score, level, lines, date FROM scores
       WHERE mode = ? ORDER BY score DESC LIMIT 10`).bind(mode).all();
    return json(results ?? []);
  }

  if (path === '/api/scores' && method === 'POST') {
    const s = await getSession(db, request);
    const uname = s ? s.username : 'anonymous';
    const e = await readJson(request);
    await db.prepare(`INSERT INTO scores (username,mode,score,level,lines,date) VALUES (?,?,?,?,?,?)`)
      .bind(uname, String(e.mode ?? ''), parseInt(e.score) || 0, parseInt(e.level) || 0,
            parseInt(e.lines) || 0, String(e.date ?? '')).run();
    return json({ ok: true });
  }

  // ── Achievements ──
  if (path === '/api/achievements' && method === 'GET') {
    const { results } = await db.prepare(
      `SELECT id, username, unlockedAt FROM achievements`).all();
    return json({ unlocked: results ?? [] });
  }

  if (path === '/api/achievements' && method === 'POST') {
    const s = await getSession(db, request);
    const uname = s ? s.username : 'anonymous';
    const e = await readJson(request);
    const id = String(e.id ?? '');
    const existing = await db.prepare(`SELECT 1 FROM achievements WHERE id = ? AND username = ?`)
      .bind(id, uname).first();
    if (existing) return json({ ok: true, new: false });
    await db.prepare(`INSERT OR IGNORE INTO achievements (id,username,unlockedAt) VALUES (?,?,?)`)
      .bind(id, uname, String(e.unlockedAt ?? '')).run();
    return json({ ok: true, new: true });
  }

  // ── Admin-Stats ──
  if (path === '/api/admin/stats' && method === 'GET') {
    const s = await getSession(db, request);
    if (!s || s.role !== 'admin') return json({ ok: false, error: 'Zugriff verweigert' }, 403);
    const sc = await db.prepare(
      `SELECT username, mode, score, level, lines, date FROM scores ORDER BY score DESC`).all();
    const ac = await db.prepare(`SELECT id, username, unlockedAt FROM achievements`).all();
    return json({ ok: true, scores: sc.results ?? [], achievements: ac.results ?? [] });
  }

  // ── Chess-Rooms ──
  if (path === '/api/chess/create' && method === 'POST') {
    const body = await readJson(request);
    const s = await getSession(db, request);
    const name = s ? s.username : (body.name ? String(body.name) : 'Anonym');
    const cpref = body.color ? String(body.color) : 'random';
    const isW = cpref === 'random' ? Math.random() < 0.5 : cpref === 'white';
    let code;
    do { code = newRoomCode(); }
    while (await db.prepare(`SELECT 1 FROM chess_rooms WHERE code = ?`).bind(code).first());
    await db.prepare(`INSERT INTO chess_rooms (code,white,black,moves,gameOver,winner,created)
                      VALUES (?,?,?,?,0,NULL,?)`)
      .bind(code, isW ? name : null, isW ? null : name, '[]', new Date().toISOString()).run();
    return json({ ok: true, code, color: isW ? 'white' : 'black' });
  }

  const joinMatch = path.match(/^\/api\/chess\/join\/([A-Z0-9]{6})$/);
  if (joinMatch && method === 'POST') {
    const code = joinMatch[1];
    const room = await db.prepare(`SELECT * FROM chess_rooms WHERE code = ?`).bind(code).first();
    if (!room) return json({ ok: false, error: 'Raum nicht gefunden' }, 404);
    const body = await readJson(request);
    const s = await getSession(db, request);
    const name = s ? s.username : (body.name ? String(body.name) : 'Anonym');
    let jcolor;
    if (room.white == null) {
      jcolor = 'white';
      await db.prepare(`UPDATE chess_rooms SET white = ? WHERE code = ?`).bind(name, code).run();
      room.white = name;
    } else if (room.black == null) {
      jcolor = 'black';
      await db.prepare(`UPDATE chess_rooms SET black = ? WHERE code = ?`).bind(name, code).run();
      room.black = name;
    } else {
      return json({ ok: false, error: 'Raum voll' }, 409);
    }
    return json({
      ok: true, color: jcolor,
      white: room.white ?? null, black: room.black ?? null,
      moves: JSON.parse(room.moves || '[]'),
    });
  }

  const roomMatch = path.match(/^\/api\/chess\/room\/([A-Z0-9]{6})$/);
  if (roomMatch && method === 'GET') {
    const code = roomMatch[1];
    const room = await db.prepare(`SELECT * FROM chess_rooms WHERE code = ?`).bind(code).first();
    if (!room) return json({ ok: false, error: 'Raum nicht gefunden' }, 404);
    return json({
      ok: true,
      white: room.white ?? null,
      black: room.black ?? null,
      moves: JSON.parse(room.moves || '[]'),
      gameOver: !!room.gameOver,
      winner: room.winner ?? null,
      bothJoined: room.white != null && room.black != null,
      code,
    });
  }

  const moveMatch = path.match(/^\/api\/chess\/move\/([A-Z0-9]{6})$/);
  if (moveMatch && method === 'POST') {
    const code = moveMatch[1];
    const room = await db.prepare(`SELECT * FROM chess_rooms WHERE code = ?`).bind(code).first();
    if (!room) return json({ ok: false, error: 'Raum nicht gefunden' }, 404);
    const body = await readJson(request);
    const moves = JSON.parse(room.moves || '[]');
    moves.push(String(body.move));
    let gameOver = !!room.gameOver, winner = room.winner ?? null;
    if (body.gameOver === true && body.winner) { gameOver = true; winner = String(body.winner); }
    await db.prepare(`UPDATE chess_rooms SET moves = ?, gameOver = ?, winner = ? WHERE code = ?`)
      .bind(JSON.stringify(moves), gameOver ? 1 : 0, winner, code).run();
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Not found' }, 404);
}

// ── Einstiegspunkt ───────────────────────────────────────────────────────────

export async function onRequest(context) {
  const { request, next, env } = context;
  const path = new URL(request.url).pathname;
  const method = request.method;

  // Sensible Dateien niemals öffentlich ausliefern (enthalten Passwörter / sind nur lokal nützlich).
  if (path.startsWith('/data/') || /\.(ps1|bat|iml|jar)$/i.test(path)) {
    return new Response('Not found', { status: 404 });
  }

  if (path.startsWith('/api/')) {
    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    try {
      return await handleApi(request, env);
    } catch (err) {
      return json({ ok: false, error: 'Interner Serverfehler' }, 500);
    }
  }

  return next();
}
