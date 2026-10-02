-- ─────────────────────────────────────────────────────────────────────────────
-- Block Presser · Highscore im Konto-System
-- Im Supabase SQL-Editor ausführen. Idempotent, kann mehrfach laufen.
-- Voraussetzung: arcade_backend_setup.sql wurde schon ausgeführt.
--
-- Block-Presser-Stände werden riesig (> 2,1 Mrd.), deshalb wird scores.score
-- auf bigint erweitert. Pro Spieler gibt es genau EINE Zeile (game='blockpresser',
-- mode='total'), die der Client hochzählt statt ständig neue Zeilen anzulegen.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) score → bigint (die View hängt an der Spalte, daher kurz droppen)
drop view if exists public.leaderboard;

alter table public.scores alter column score type bigint;

create or replace view public.leaderboard
with (security_invoker = true) as
select
  s.user_id,
  p.username,
  p.avatar_url,
  s.game,
  s.mode,
  max(s.score)  as best_score,
  count(*)      as plays
from public.scores s
join public.profiles p on p.id = s.user_id
group by s.user_id, p.username, p.avatar_url, s.game, s.mode;

grant select on public.leaderboard to anon, authenticated;

-- 2) Höchstens eine Block-Presser-Zeile pro Spieler
create unique index if not exists scores_blockpresser_one_per_user
  on public.scores (user_id)
  where game = 'blockpresser';

-- 3) Spieler dürfen NUR ihre eigene Block-Presser-Zeile aktualisieren
--    (für andere Spiele bleibt scores insert-only wie bisher)
drop policy if exists scores_update_blockpresser on public.scores;
create policy scores_update_blockpresser on public.scores
  for update
  using      (auth.uid() = user_id and game = 'blockpresser')
  with check (auth.uid() = user_id and game = 'blockpresser');
