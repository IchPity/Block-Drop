-- ─────────────────────────────────────────────────────────────────────────────
-- Block-Drop Arcade · Backend-Grundgerüst
-- Im Supabase SQL-Editor ausführen (Projekt yjyvqidjqksvagyxrwyf).
--
-- Legt wieder an, was `db/cleanup_arcade_backend.sql` beim Umstieg auf den
-- Diplomarbeits-Tracker (2026-08-18) gedroppt hat: profiles, scores,
-- leaderboard-View, f1_points, f1_bets — jeweils mit RLS. Idempotent
-- (IF NOT EXISTS / DROP POLICY IF EXISTS), kann gefahrlos mehrfach laufen.
--
-- NICHT Teil davon: `friends` (siehe friends_setup.sql, Repo-Root) und der
-- `avatars`-Storage-Bucket (wurde nie gedroppt, existiert noch).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  username     text not null unique,
  achievements jsonb not null default '[]'::jsonb,
  avatar_url   text,
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all on public.profiles
  for select using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id);

-- ── scores ──────────────────────────────────────────────────────────────────
create table if not exists public.scores (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  game       text not null,
  mode       text,
  score      integer not null,
  level      integer,
  lines      integer,
  created_at timestamptz not null default now()
);

create index if not exists scores_game_mode_idx on public.scores (game, mode);
create index if not exists scores_user_idx on public.scores (user_id);

alter table public.scores enable row level security;

drop policy if exists scores_select_all on public.scores;
create policy scores_select_all on public.scores
  for select using (true);

drop policy if exists scores_insert_self on public.scores;
create policy scores_insert_self on public.scores
  for insert with check (auth.uid() = user_id);

-- ── leaderboard (View über scores + profiles) ─────────────────────────────────
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

-- ── f1_points ───────────────────────────────────────────────────────────────
create table if not exists public.f1_points (
  user_id    uuid not null references auth.users(id) on delete cascade,
  season     integer not null,
  points     integer not null default 1000,
  updated_at timestamptz not null default now(),
  primary key (user_id, season)
);

alter table public.f1_points enable row level security;

drop policy if exists f1_points_select_all on public.f1_points;
create policy f1_points_select_all on public.f1_points
  for select using (true);

drop policy if exists f1_points_insert_self on public.f1_points;
create policy f1_points_insert_self on public.f1_points
  for insert with check (auth.uid() = user_id);

drop policy if exists f1_points_update_self on public.f1_points;
create policy f1_points_update_self on public.f1_points
  for update using (auth.uid() = user_id);

-- ── f1_bets ─────────────────────────────────────────────────────────────────
create table if not exists public.f1_bets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  season      integer not null,
  round       integer not null,
  race_name   text not null,
  p1_id       text not null,
  p2_id       text not null,
  p3_id       text not null,
  stake       integer not null check (stake > 0),
  status      text not null default 'open' check (status in ('open', 'settled')),
  payout      integer,
  result_kind text check (result_kind in ('exact', 'drivers', 'miss')),
  created_at  timestamptz not null default now(),
  settled_at  timestamptz,
  unique (user_id, season, round)
);

create index if not exists f1_bets_season_status_idx on public.f1_bets (season, status);

alter table public.f1_bets enable row level security;

drop policy if exists f1_bets_select_all on public.f1_bets;
create policy f1_bets_select_all on public.f1_bets
  for select using (true);

drop policy if exists f1_bets_insert_self on public.f1_bets;
create policy f1_bets_insert_self on public.f1_bets
  for insert with check (auth.uid() = user_id);

drop policy if exists f1_bets_update_self on public.f1_bets;
create policy f1_bets_update_self on public.f1_bets
  for update using (auth.uid() = user_id);
