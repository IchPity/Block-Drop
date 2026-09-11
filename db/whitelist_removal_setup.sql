-- ─────────────────────────────────────────────────────────────────────────────
-- Smashin' Kurt — Fortschritts-Tracker · Whitelist-Eintrag vollständig entfernen
-- Im Supabase SQL-Editor ausführen (Projekt yjyvqidjqksvagyxrwyf), NACH
-- db/ranks_whitelist_setup.sql.
--
-- Ersetzt das bisherige direkte DELETE auf public.whitelist in der App
-- "Whitelist": dabei blieb bei einer schon angenommenen Einladung das Konto
-- (public.members + auth.users) unangetastet — die Person konnte sich weiter
-- anmelden, tauchte in Rang/Passwords weiter auf und bekam auf Wunsch sogar
-- noch ein Reset-Mail. Diese RPC räumt beides in einem Schritt weg.
--
-- - Noch offene Einladung (kein Konto vorhanden): Admin + Stellvertreter
--   dürfen entfernen, wie bisher über die RLS-Policy — es verschwindet nur
--   der Whitelist-Eintrag.
-- - Schon angenommene Einladung (Konto existiert): nur Admin darf entfernen.
--   Löscht zusätzlich auth.users — kaskadiert per Fremdschlüssel automatisch
--   auf public.members (siehe db/ranks_whitelist_setup.sql) — danach: kein
--   Login mehr, kein Reset-Mail mehr möglich, weg aus Rang und Passwords.
-- - Niemand kann sich selbst auf diesem Weg das eigene Konto löschen.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.admin_remove_access(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(p_email);
  v_uid   uuid;
  v_rank  public.member_rank := public.my_rank();
begin
  if v_rank not in ('admin', 'stellvertreter') then
    raise exception 'Nicht erlaubt.';
  end if;

  select id into v_uid from auth.users where email = v_email;

  if v_uid is not null then
    if v_rank <> 'admin' then
      raise exception 'Nur Admin kann ein bestehendes Konto entfernen.';
    end if;
    if v_uid = auth.uid() then
      raise exception 'Das eigene Konto kann nicht auf diesem Weg entfernt werden.';
    end if;
  end if;

  delete from public.whitelist where email = v_email;

  if v_uid is not null then
    delete from auth.users where id = v_uid;
  end if;
end;
$$;
