-- ─────────────────────────────────────────────────────────────────────────────
-- Block-Drop Arcade · Chat / Direktnachrichten
-- Im Supabase SQL-Editor ausführen (Projekt yjyvqidjqksvagyxrwyf).
-- Legt die Tabelle `public.messages` mit RLS + Realtime an. Idempotent.
-- Chatten dürfen nur bestätigte Freunde (siehe friends_setup.sql).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references auth.users(id) on delete cascade,
  recipient_id  uuid not null references auth.users(id) on delete cascade,
  body          text not null check (char_length(body) between 1 and 2000),
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

-- Schnellzugriff auf einen Verlauf zwischen zwei Usern bzw. die eigene Inbox
create index if not exists messages_pair_idx
  on public.messages (sender_id, recipient_id, created_at);
create index if not exists messages_recipient_idx
  on public.messages (recipient_id, created_at);

alter table public.messages enable row level security;

-- Helper: sind zwei User bestätigte Freunde? SECURITY DEFINER, damit die
-- Insert-Policy nicht selbst gegen die friends-RLS läuft.
create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friends f
    where f.status = 'accepted'
      and (
        (f.requester_id = a and f.addressee_id = b) or
        (f.requester_id = b and f.addressee_id = a)
      )
  );
$$;

-- Lesen: nur die beiden Beteiligten
drop policy if exists "messages_select_involved" on public.messages;
create policy "messages_select_involved" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- Senden: man selbst ist der Sender UND die beiden sind Freunde
drop policy if exists "messages_insert_friends" on public.messages;
create policy "messages_insert_friends" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and public.are_friends(sender_id, recipient_id)
  );

-- Update: nur der Empfänger darf seine empfangenen Nachrichten als gelesen
-- markieren (read_at setzen). Inhalt bleibt unveränderbar.
drop policy if exists "messages_update_recipient" on public.messages;
create policy "messages_update_recipient" on public.messages
  for update using (auth.uid() = recipient_id)
             with check (auth.uid() = recipient_id);

-- Löschen: der Sender darf eigene Nachrichten zurücknehmen
drop policy if exists "messages_delete_sender" on public.messages;
create policy "messages_delete_sender" on public.messages
  for delete using (auth.uid() = sender_id);

-- Realtime aktivieren (postgres_changes liefert neue Nachrichten live aus,
-- RLS-gefiltert auf den eingeloggten User). Idempotent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
