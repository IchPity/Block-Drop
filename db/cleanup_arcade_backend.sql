-- ─────────────────────────────────────────────────────────────────────────────
-- Smashin' Kurt — Aufräumen: Arcade-Altlasten entfernen
-- Im Supabase SQL-Editor ausführen (Projekt yjyvqidjqksvagyxrwyf).
--
-- Entfernt das komplette DB-Backend der abgelösten Arcade-Seite (Code dazu
-- ist bereits aus dem Repo raus, Stand nur noch in der Git-History). Der
-- Tracker (app/, db/ranks_whitelist_setup.sql, profile_setup.sql,
-- milestones_setup.sql, admin_access_overview_setup.sql,
-- zuschauer_rank_setup.sql) nutzt NICHTS von dem hier.
--
-- WICHTIG: Bucket `avatars` NICHT anfassen — der wird vom neuen Tracker für
-- Profilbilder weiterverwendet (siehe db/profile_setup.sql, app/assets/auth.js).
--
-- Nach diesem Script: die 4 alten auth.users-Accounts separat per
-- Admin-API löschen (läuft über Service-Key, kein DDL, kein SQL-Editor
-- nötig) — siehe Chat.
-- ─────────────────────────────────────────────────────────────────────────────

-- Reihenfolge beachtet Abhängigkeiten (View vor Tabelle, referenzierende
-- Tabellen vor referenzierten).

drop view if exists public.leaderboard;

drop table if exists public.messages;
drop table if exists public.friends;
drop table if exists public.f1_bets;
drop table if exists public.f1_points;
drop table if exists public.scores;
drop table if exists public.profiles;

-- Von den Arcade-Tabellen genutzte Helper-Funktion (Chat-RLS).
drop function if exists public.are_friends(uuid, uuid);

-- Login-per-Username-Auflösung war ein Arcade-Feature (die neue Seite
-- loggt nur per Mail ein, siehe app/assets/ui.js). Nur droppen, falls
-- vorhanden.
drop function if exists public.resolve_login_email(text);
