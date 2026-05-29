-- ─────────────────────────────────────────────────────────────────────────────
-- Block-Drop Arcade · Login per Username ODER Email
-- Im Supabase SQL-Editor ausführen (Projekt yjyvqidjqksvagyxrwyf).
-- Idempotent (create or replace).
--
-- Hintergrund: Supabase Auth verlangt technisch eine Email. Neue Accounts ohne
-- echte Email bekommen in app/auth.js eine synthetische Adresse
-- <username>@blockdrop.local. Eine optional angegebene echte Email wird nur als
-- privates user_metadata (contact_email) gespeichert.
--
-- Diese Funktion löst einen Login-Identifier (Username ODER Kontakt-Mail) zur
-- passenden synthetischen Auth-Mail auf, damit signInWithPassword greifen kann.
-- Sie gibt AUSSCHLIESSLICH synthetische Adressen zurück (Filter auf
-- @blockdrop.local) — echte Mails von Accounts werden nie an den Client
-- preisgegeben.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.resolve_login_email(identifier text)
returns text
language sql
security definer
set search_path = public
as $$
  select u.email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.email like '%@blockdrop.local'
    and (
      lower(p.username) = lower(identifier)
      or lower(coalesce(u.raw_user_meta_data->>'contact_email', '')) = lower(identifier)
    )
  limit 1;
$$;

-- Auch für nicht eingeloggte Besucher aufrufbar (Login passiert vor der Auth).
revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
