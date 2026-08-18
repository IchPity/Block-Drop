-- ─────────────────────────────────────────────────────────────────────────────
-- Smashin' Kurt — Fortschritts-Tracker · Ränge + Whitelist
-- Im Supabase SQL-Editor ausführen (Projekt yjyvqidjqksvagyxrwyf).
-- Legt `public.member_rank`, `public.whitelist`, `public.members` an, inkl.
-- Trigger auf `auth.users` (Whitelist-Gate + Rang-Zuweisung) und RLS.
-- Idempotent (IF NOT EXISTS / DROP ... IF EXISTS). Rührt die alten
-- Arcade-Tabellen (profiles, scores, friends, messages, f1_*) nicht an.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Rang-Enum ───────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_rank') then
    create type public.member_rank as enum ('mitarbeiter', 'stellvertreter', 'admin');
  end if;
end $$;

-- ── Whitelist: E-Mails, die sich registrieren dürfen ────────────────────────
create table if not exists public.whitelist (
  email       text primary key check (email = lower(email)),
  invited_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  claimed_at  timestamptz
);

-- Initialer Admin-Eintrag — ohne den würde die eigene Registrierung
-- am Whitelist-Gate scheitern.
insert into public.whitelist (email)
values ('peter.scheikl@hakwt.at')
on conflict (email) do nothing;

alter table public.whitelist enable row level security;

-- ── Members: ein Datensatz pro registriertem Konto, trägt den Rang ─────────
create table if not exists public.members (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  rank        public.member_rank not null default 'mitarbeiter',
  created_at  timestamptz not null default now()
);

alter table public.members enable row level security;

-- ── Rang des eingeloggten Kontos ohne RLS-Rekursion ermitteln ───────────────
-- SECURITY DEFINER + Owner mit BYPASSRLS (Standard bei "postgres" im
-- SQL-Editor) → Policies dürfen diese Funktion gefahrlos aufrufen.
create or replace function public.my_rank()
returns public.member_rank
language sql
security definer
set search_path = public
stable
as $$
  select rank from public.members where id = auth.uid();
$$;

-- ── Whitelist-Gate + Auto-Provisioning bei Registrierung ────────────────────
-- Blockiert auth.users-Inserts für nicht freigeschaltete E-Mails direkt auf
-- DB-Ebene (nicht nur im Frontend umgehbar) und legt bei Erfolg die
-- passende members-Zeile an — Admin-Mail bekommt sofort Rang 'admin'.
create or replace function public.handle_new_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(new.email);
begin
  if not exists (select 1 from public.whitelist where email = v_email) then
    raise exception 'E-Mail % ist nicht freigeschaltet. Bitte einen Admin oder Stellvertreter um Whitelist-Eintrag bitten.', v_email;
  end if;

  update public.whitelist set claimed_at = now() where email = v_email;

  insert into public.members (id, email, rank)
  values (
    new.id,
    v_email,
    case when v_email = 'peter.scheikl@hakwt.at' then 'admin'::public.member_rank
         else 'mitarbeiter'::public.member_rank end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- AFTER INSERT (nicht BEFORE!): `members.id` referenziert `auth.users(id)`
-- per Fremdschlüssel — die Zeile muss beim Insert in `members` schon
-- existieren. Ein Exception-Raise hier rollt den gesamten INSERT auf
-- auth.users trotzdem sauber zurück, das Whitelist-Gate bleibt wirksam.
drop trigger if exists on_auth_user_created_check_whitelist on auth.users;
create trigger on_auth_user_created_check_whitelist
  after insert on auth.users
  for each row execute function public.handle_new_member();

-- ── RLS: whitelist ───────────────────────────────────────────────────────────
-- Sichtbar/verwaltbar für Admin + Stellvertreter (App "Whitelist").
drop policy if exists "whitelist_select_admin_deputy" on public.whitelist;
create policy "whitelist_select_admin_deputy" on public.whitelist
  for select using (public.my_rank() in ('admin', 'stellvertreter'));

drop policy if exists "whitelist_insert_admin_deputy" on public.whitelist;
create policy "whitelist_insert_admin_deputy" on public.whitelist
  for insert with check (public.my_rank() in ('admin', 'stellvertreter'));

drop policy if exists "whitelist_delete_admin_deputy" on public.whitelist;
create policy "whitelist_delete_admin_deputy" on public.whitelist
  for delete using (public.my_rank() in ('admin', 'stellvertreter'));

-- ── RLS: members ─────────────────────────────────────────────────────────────
-- Jede:r sieht die eigene Zeile; Admin sieht + verwaltet alle (App "Rang"
-- + App "Passwords" laufen über diese Tabelle). Insert läuft ausschließlich
-- über den Trigger oben (SECURITY DEFINER) — keine Insert-Policy für Clients.
drop policy if exists "members_select_self_or_admin" on public.members;
create policy "members_select_self_or_admin" on public.members
  for select using (auth.uid() = id or public.my_rank() = 'admin');

drop policy if exists "members_update_admin" on public.members;
create policy "members_update_admin" on public.members
  for update using (public.my_rank() = 'admin');

drop policy if exists "members_delete_admin" on public.members;
create policy "members_delete_admin" on public.members
  for delete using (public.my_rank() = 'admin');
