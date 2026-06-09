-- ─────────────────────────────────────────────────────────────────────────────
-- Block-Drop Arcade · Serverseitige Username-Härtung
-- Im Supabase SQL-Editor ausführen (Projekt yjyvqidjqksvagyxrwyf). Idempotent.
--
-- Warum: Bisher prüft nur der Client (app/auth.js) den Username-Zeichensatz.
-- Wer die Supabase-API direkt anspricht, könnte einen Usernamen mit HTML/JS
-- setzen, der dann auf FREMDEN Bildschirmen (Freundesliste, Chat, öffentliches
-- Profil /u/) gerendert wird → gespeicherter XSS. Diese CHECK-Constraint
-- erzwingt den Zeichensatz direkt in der Datenbank — unabhängig vom Client.
--
-- Regel (deckungsgleich mit auth.js): 3–20 Zeichen, nur A–Z a–z 0–9 _ -
-- ─────────────────────────────────────────────────────────────────────────────

-- Vorhandene Verstöße zuerst sichtbar machen (rein informativ; blockiert nichts):
--   select id, username from public.profiles
--   where username !~ '^[A-Za-z0-9_-]{3,20}$';

-- NOT VALID: gilt sofort für alle INSERT/UPDATE, prüft Altbestand aber nicht
-- (kein Migrations-Abbruch, falls eine Alt-Zeile die Regel verletzt).
alter table public.profiles
  drop constraint if exists profiles_username_charset;

alter table public.profiles
  add constraint profiles_username_charset
  check (username ~ '^[A-Za-z0-9_-]{3,20}$')
  not valid;

-- Optional, wenn der Altbestand sauber ist: nachträglich auch Altzeilen prüfen.
--   alter table public.profiles validate constraint profiles_username_charset;
