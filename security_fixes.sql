-- ─────────────────────────────────────────────────────────────────────────────
-- Block-Drop Arcade · Sicherheits- und Schema-Nachbesserungen
-- Im Supabase SQL-Editor ausführen (nach arcade_backend_setup.sql, friends_setup.sql,
-- blockpresser_scores_setup.sql und casino_ranking_setup.sql). Idempotent.
--
-- Behebt die Punkte S1, S2, S3, S5, A10, WE1 und W1/W4 aus FEHLER.md.
-- Schritte, die an vorhandenen Daten scheitern können, sind markiert (PRÜFEN).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Freunde ──────────────────────────────────────────────────────────────────
-- S1: Eine neue Zeile darf nur eine offene Anfrage sein (nie direkt 'accepted').
drop policy if exists "friends_insert_self" on public.friends;
create policy "friends_insert_self" on public.friends
  for insert with check (auth.uid() = requester_id and status = 'pending');

-- S2: Der Addressee darf nur annehmen; wer an der Zeile beteiligt ist, bleibt fest.
drop policy if exists "friends_update_addressee" on public.friends;
create policy "friends_update_addressee" on public.friends
  for update
  using      (auth.uid() = addressee_id)
  with check (auth.uid() = addressee_id and status = 'accepted');

create or replace function public.friends_keep_parties()
returns trigger
language plpgsql
as $$
begin
  if new.requester_id is distinct from old.requester_id
     or new.addressee_id is distinct from old.addressee_id then
    raise exception 'Beteiligte einer Freundschaft können nicht geändert werden';
  end if;
  return new;
end;
$$;

drop trigger if exists friends_keep_parties on public.friends;
create trigger friends_keep_parties
  before update on public.friends
  for each row execute function public.friends_keep_parties();

-- S5: Höchstens eine Zeile pro Paar, egal in welcher Richtung.
-- PRÜFEN: scheitert, wenn es schon A→B und B→A gleichzeitig gibt. Dann vorher eine der beiden löschen:
--   select least(requester_id, addressee_id) a, greatest(requester_id, addressee_id) b, count(*)
--   from public.friends group by 1, 2 having count(*) > 1;
create unique index if not exists friends_pair_unique
  on public.friends (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- ── Profile ──────────────────────────────────────────────────────────────────
-- S3: Username-Regeln auch in der Datenbank (bisher nur im Browser geprüft).
-- NOT VALID: bestehende Zeilen bleiben unangetastet, neue und geänderte werden geprüft.
alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[A-Za-z0-9_-]{3,20}$') not valid;

-- A10: Eindeutig ohne Rücksicht auf Groß-/Kleinschreibung.
-- PRÜFEN: scheitert, wenn es schon Namen gibt, die sich nur in der Schreibweise unterscheiden:
--   select lower(username), count(*) from public.profiles group by 1 having count(*) > 1;
create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username));

-- WE1: Wetter-Favoriten im Konto (die Wetterseite liest und schreibt diese Spalte).
alter table public.profiles
  add column if not exists weather_favorites jsonb;

-- S6: Profilbild nur aus dem eigenen Storage-Bucket (oder leer).
alter table public.profiles drop constraint if exists profiles_avatar_url_own_bucket;
alter table public.profiles
  add constraint profiles_avatar_url_own_bucket
  check (avatar_url is null
         or avatar_url like 'https://yjyvqidjqksvagyxrwyf.supabase.co/storage/v1/object/public/avatars/%') not valid;

-- ── F1 Wetten ────────────────────────────────────────────────────────────────
-- W1/W4: Wette platzieren und abrechnen jeweils in einer Transaktion.
-- Der Client ruft diese Funktionen auf; fehlen sie, fällt er auf den alten Weg zurück.

-- Wette platzieren: prüft das Guthaben, zieht den Einsatz ab und legt die Wette an.
create or replace function public.f1_place_bet(
  p_season integer, p_round integer, p_race_name text,
  p_p1 text, p_p2 text, p_p3 text, p_stake integer
)
returns public.f1_bets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_points integer;
  v_bet public.f1_bets;
begin
  if v_uid is null then raise exception 'Nicht angemeldet'; end if;
  if p_stake is null or p_stake <= 0 then raise exception 'Ungültiger Einsatz'; end if;
  if p_p1 = p_p2 or p_p1 = p_p3 or p_p2 = p_p3 then raise exception 'Drei verschiedene Fahrer wählen'; end if;

  select points into v_points from public.f1_points
    where user_id = v_uid and season = p_season for update;
  if v_points is null then raise exception 'Kein Punktekonto für diese Saison'; end if;
  if v_points < p_stake then raise exception 'Nicht genug Punkte'; end if;

  insert into public.f1_bets (user_id, season, round, race_name, p1_id, p2_id, p3_id, stake, status)
    values (v_uid, p_season, p_round, p_race_name, p_p1, p_p2, p_p3, p_stake, 'open')
    returning * into v_bet;

  update public.f1_points set points = points - p_stake, updated_at = now()
    where user_id = v_uid and season = p_season;

  return v_bet;
end;
$$;

-- Wette abrechnen: wirkt nur einmal (Status offen → abgerechnet), zahlt in derselben Transaktion aus.
-- Liefert true, wenn diese Abrechnung die Wette geschlossen hat, false, wenn sie schon abgerechnet war.
-- Die Quote rechnet der Server aus Einsatz und Ergebnisart, nicht der Client.
create or replace function public.f1_settle_bet(p_bet_id uuid, p_kind text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_bet public.f1_bets;
  v_payout integer;
begin
  if v_uid is null then raise exception 'Nicht angemeldet'; end if;
  if p_kind not in ('exact', 'drivers', 'miss') then raise exception 'Ungültiges Ergebnis'; end if;

  select * into v_bet from public.f1_bets
    where id = p_bet_id and user_id = v_uid for update;
  if not found then raise exception 'Wette nicht gefunden'; end if;
  if v_bet.status <> 'open' then return false; end if;

  v_payout := case p_kind
    when 'exact'   then v_bet.stake * 2
    when 'drivers' then floor(v_bet.stake * 1.5)::integer
    else 0 end;

  update public.f1_bets
    set status = 'settled', payout = v_payout, result_kind = p_kind, settled_at = now()
    where id = p_bet_id;

  if v_payout > 0 then
    update public.f1_points set points = points + v_payout, updated_at = now()
      where user_id = v_uid and season = v_bet.season;
  end if;

  return true;
end;
$$;

revoke all on function public.f1_place_bet(integer, integer, text, text, text, text, integer) from public, anon;
revoke all on function public.f1_settle_bet(uuid, text) from public, anon;
grant execute on function public.f1_place_bet(integer, integer, text, text, text, text, integer) to authenticated;
grant execute on function public.f1_settle_bet(uuid, text) to authenticated;

-- ── Login per Username ───────────────────────────────────────────────────────
-- Website und Block Games rufen resolve_login_email auf, wenn der Login mit dem Usernamen
-- nicht direkt klappt (Konto mit echter Auth-Mail). Die Funktion fehlte in der Datenbank
-- (der Aufruf endete mit 404). Sie gibt die Login-Mail zu einem Usernamen zurück.
-- ABWÄGUNG: Damit kann jeder, der einen Usernamen kennt, die zugehörige E-Mail-Adresse abfragen.
-- Wer das nicht will, lässt diesen Block weg; dann melden sich solche Konten mit ihrer E-Mail an.
create or replace function public.resolve_login_email(identifier text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(trim(identifier))
  limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;

-- ── Noch offen (bewusst nicht in diesem Skript) ──────────────────────────────
-- S4: scores, f1_points, f1_bets und profiles.achievements sind weiterhin direkt vom Client
--     schreibbar; die Funktionen oben schließen das nur, wenn danach auch die direkten
--     Update-Policies entfernt werden (erst, wenn der neue Client ausgerollt ist):
--       drop policy if exists f1_points_update_self on public.f1_points;
--       drop policy if exists f1_bets_update_self on public.f1_bets;
--       drop policy if exists f1_bets_insert_self on public.f1_bets;
-- S7: Die Casino-Funktionen (casino_wallet, casino_round, casino_deposit, casino_payout) und
--     resolve_login_email liegen nur in der Datenbank. Bitte dort exportieren und einchecken.
