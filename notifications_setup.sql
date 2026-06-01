-- ─────────────────────────────────────────────────────────────────────────────
-- Block-Drop Arcade · Benachrichtigungen
-- Optional. Im Supabase SQL-Editor ausführen (Projekt yjyvqidjqksvagyxrwyf).
--
-- Schaltet die `friends`-Tabelle für Realtime frei, damit Freundschaftsanfragen
-- SOFORT als Toast erscheinen. Ohne diesen Schritt funktionieren die Toasts
-- trotzdem — nur eben verzögert über den 30-Sekunden-Poll-Fallback in auth.js.
-- (Nachrichten-Toasts laufen bereits über messages_setup.sql.)
-- Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'friends'
  ) then
    alter publication supabase_realtime add table public.friends;
  end if;
end $$;
