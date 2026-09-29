-- ─────────────────────────────────────────────────────────────────────────────
-- Casino-Rangliste nach Auszahlungen
-- Im Supabase SQL-Editor ausführen. Idempotent.
--
-- Jede Auszahlung wird in casino_payouts protokolliert (Beträge in Cent).
-- casino_ranking() liefert pro Spieler die Summe, absteigend sortiert.
-- Frühere Auszahlungen (vor diesem Skript) sind nicht enthalten.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.casino_payouts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     integer not null check (amount > 0),
  created_at timestamptz not null default now()
);

create index if not exists casino_payouts_user_idx on public.casino_payouts (user_id);

-- Direkter Zugriff gesperrt; nur über die Funktionen unten.
alter table public.casino_payouts enable row level security;

-- Wird vom Client nach erfolgreichem casino_payout aufgerufen.
create or replace function public.casino_log_payout(p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  if p_amount is null or p_amount < 100 then raise exception 'Ungültiger Betrag'; end if;
  insert into public.casino_payouts (user_id, amount) values (auth.uid(), p_amount);
end;
$$;

-- Rückgabetyp ändert sich -> alte Version entfernen
drop function if exists public.casino_ranking();

create function public.casino_ranking()
returns table (username text, paid bigint, is_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.username, sum(c.amount)::bigint as paid, (c.user_id = auth.uid()) as is_me
  from public.casino_payouts c
  join public.profiles p on p.id = c.user_id
  group by c.user_id, p.username
  order by paid desc, p.username
  limit 20;
$$;

revoke all on function public.casino_log_payout(integer) from public, anon;
revoke all on function public.casino_ranking() from public, anon;
grant execute on function public.casino_log_payout(integer) to authenticated;
grant execute on function public.casino_ranking() to authenticated;
