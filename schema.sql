-- D1-Schema für Block Drop Arcade.
-- Die Tabellen werden zur Sicherheit auch automatisch beim ersten Request
-- angelegt (siehe functions/_middleware.js). Dieses Skript ist optional und
-- kann einmalig ausgeführt werden:
--   wrangler d1 execute block-drop-db --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  username  TEXT PRIMARY KEY,
  password  TEXT NOT NULL,
  role      TEXT NOT NULL DEFAULT 'user',
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token    TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  role     TEXT NOT NULL,
  expires  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL DEFAULT 'anonymous',
  mode     TEXT NOT NULL,
  score    INTEGER NOT NULL,
  level    INTEGER NOT NULL,
  lines    INTEGER NOT NULL,
  date     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS achievements (
  id         TEXT NOT NULL,
  username   TEXT NOT NULL DEFAULT 'anonymous',
  unlockedAt TEXT NOT NULL,
  PRIMARY KEY (id, username)
);

CREATE TABLE IF NOT EXISTS chess_rooms (
  code     TEXT PRIMARY KEY,
  white    TEXT,
  black    TEXT,
  moves    TEXT NOT NULL DEFAULT '[]',
  gameOver INTEGER NOT NULL DEFAULT 0,
  winner   TEXT,
  created  TEXT NOT NULL
);

-- Start-Benutzer (Admin + bisheriger Testuser).
INSERT OR IGNORE INTO users (username, password, role, createdAt) VALUES
  ('Peter', 'Admin111', 'admin', '2026-05-21'),
  ('Test0', 'Test111',  'user',  '2026-05-26');
