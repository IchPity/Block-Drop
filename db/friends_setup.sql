-- ─────────────────────────────────────────────────────────────────────────────
-- Block-Drop Arcade · Freunde-Feature
-- Im Supabase SQL-Editor ausführen (Projekt yjyvqidjqksvagyxrwyf).
-- Legt die Tabelle `public.friends` mit RLS an. Idempotent (IF NOT EXISTS).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.friends (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users(id) on delete cascade,
  addressee_id  uuid not null references auth.users(id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- Schnellsuche nach den Beziehungen eines Users
create index if not exists friends_requester_idx on public.friends (requester_id);
create index if not exists friends_addressee_idx on public.friends (addressee_id);

alter table public.friends enable row level security;

-- Lesen: nur Zeilen, an denen man beteiligt ist
drop policy if exists "friends_select_involved" on public.friends;
create policy "friends_select_involved" on public.friends
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- Anfrage senden: man selbst ist der Requester
drop policy if exists "friends_insert_self" on public.friends;
create policy "friends_insert_self" on public.friends
  for insert with check (auth.uid() = requester_id);

-- Annehmen: nur der Addressee darf die Zeile updaten (pending -> accepted)
drop policy if exists "friends_update_addressee" on public.friends;
create policy "friends_update_addressee" on public.friends
  for update using (auth.uid() = addressee_id);

-- Löschen: beide Seiten dürfen (Freund entfernen / Anfrage zurückziehen / ablehnen)
drop policy if exists "friends_delete_involved" on public.friends;
create policy "friends_delete_involved" on public.friends
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);
