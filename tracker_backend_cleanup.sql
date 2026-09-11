-- ─────────────────────────────────────────────────────────────────────────────
-- Block-Drop Arcade · Tracker-Reste aufräumen
-- Im Supabase SQL-Editor ausführen (Projekt yjyvqidjqksvagyxrwyf).
--
-- Entfernt das komplette DB-Backend des abgelösten Diplomarbeits-Trackers
-- (Code dazu ist schon aus dem Repo raus, Stand nur noch in der Git-History,
-- siehe db/ranks_whitelist_setup.sql etc. bei Commit ae68516). Das aktuelle
-- Arcade-Schema (profiles, scores, leaderboard, f1_points, f1_bets, friends)
-- nutzt NICHTS von dem hier.
--
-- WICHTIG, geht dabei verloren (falls das noch irgendwo gebraucht wird,
-- vorher sichern):
--   - members: peter.scheikl@hakwt.at (admin), peterscheikl10@gmail.com (zuschauer)
--   - whitelist: eine offene, nicht angenommene Einladung für leon.koller@hakwt.at
--   - milestones: Meilenstein 1 "Team-Kickoff & Organisation" war auf
--     "fertig" gesetzt — der Rest ist unverändert der Startzustand aus dem
--     DA-Plan (Quelle bleibt DiplData/DIPL-Teams/Meilensteine_Alle.xlsx)
--   - status_report: leer, nie befüllt
--
-- NICHT angefasst: Bucket `avatars` (wird vom Arcade-Profil weiterverwendet),
-- die eigentlichen auth.users-Konten (nur die Tracker-Zusatztabellen fliegen
-- raus, niemand wird ausgeloggt oder kann sich nicht mehr einloggen).
-- ─────────────────────────────────────────────────────────────────────────────

-- Reihenfolge beachtet Abhängigkeiten (Trigger → Funktionen → Tabellen
-- → my_rank() zuletzt, weil RLS-Policies bis zu ihrem Tabellen-Drop davon
-- abhängen → Enum-Typen ganz am Ende).

drop trigger if exists on_auth_user_created_check_whitelist on auth.users;

drop function if exists public.handle_new_member() cascade;
drop function if exists public.admin_access_overview() cascade;
drop function if exists public.update_own_profile(text, text) cascade;
drop function if exists public.admin_remove_access(text) cascade;
drop function if exists public.set_own_milestone_status(int, public.milestone_status) cascade;

drop table if exists public.milestones cascade;
drop table if exists public.status_report cascade;
drop table if exists public.members cascade;
drop table if exists public.whitelist cascade;

drop function if exists public.my_rank() cascade;

drop type if exists public.milestone_status;
drop type if exists public.member_rank;
