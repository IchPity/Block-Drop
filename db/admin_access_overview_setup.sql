-- ─────────────────────────────────────────────────────────────────────────────
-- Smashin' Kurt — Fortschritts-Tracker · Admin-Zugangsübersicht
-- Im Supabase SQL-Editor ausführen (Projekt yjyvqidjqksvagyxrwyf), NACH
-- db/ranks_whitelist_setup.sql.
-- RPC-Funktion für die App "Passwords": kombiniert `public.members` mit
-- Anmelde-Metadaten aus `auth.users` (last_sign_in_at, email_confirmed_at)
-- — NIE Klartext-Passwörter, die gibt es bei Supabase Auth ohnehin nicht.
-- Nur für Admin aufrufbar (serverseitig per public.my_rank() erzwungen,
-- nicht nur im Frontend).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_access_overview()
returns table (
  id                  uuid,
  email               text,
  rank                public.member_rank,
  created_at          timestamptz,
  last_sign_in_at     timestamptz,
  email_confirmed_at  timestamptz
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if public.my_rank() <> 'admin' then
    raise exception 'Nur für Admin.';
  end if;

  return query
    select m.id, m.email, m.rank, m.created_at, u.last_sign_in_at, u.email_confirmed_at
    from public.members m
    join auth.users u on u.id = m.id
    order by m.created_at;
end;
$$;
