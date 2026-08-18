-- ─────────────────────────────────────────────────────────────────────────────
-- Smashin' Kurt — Fortschritts-Tracker · Profil (Anzeigename + Avatar)
-- Im Supabase SQL-Editor ausführen (Projekt yjyvqidjqksvagyxrwyf), NACH
-- db/ranks_whitelist_setup.sql.
-- Fügt display_name/avatar_url zu members hinzu + eine RPC, über die
-- Mitglieder NUR diese zwei Felder an sich selbst ändern dürfen — nie den
-- eigenen Rang (Privilegien-Eskalation wäre sonst über eine simple
-- Self-Update-RLS-Policy auf `members` möglich, deshalb bewusst keine
-- Policy dafür, sondern eine SECURITY DEFINER-Funktion mit fixem Feld-Set).
-- Avatar-Bilder liegen im bereits vorhandenen Storage-Bucket `avatars`
-- (public, RLS: eigener Ordner = eigene user_id) — hier nicht neu angelegt.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.members
  add column if not exists display_name text,
  add column if not exists avatar_url   text;

-- Beide Parameter optional/unabhängig: NULL = unverändert lassen. Ein
-- Leerstring bei p_display_name löscht den Anzeigenamen bewusst (Fallback
-- auf E-Mail im Frontend).
create or replace function public.update_own_profile(
  p_display_name text default null,
  p_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_display_name is not null and length(trim(p_display_name)) > 40 then
    raise exception 'Anzeigename darf höchstens 40 Zeichen haben.';
  end if;

  update public.members
  set display_name = case when p_display_name is not null
                           then nullif(trim(p_display_name), '')
                           else display_name end,
      avatar_url   = coalesce(p_avatar_url, avatar_url)
  where id = auth.uid();
end;
$$;
