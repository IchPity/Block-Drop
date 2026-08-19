-- ─────────────────────────────────────────────────────────────────────────────
-- Smashin' Kurt — Fortschritts-Tracker · Meilensteine
-- Im Supabase SQL-Editor ausführen (Projekt yjyvqidjqksvagyxrwyf), NACH
-- db/ranks_whitelist_setup.sql. Idempotent (IF NOT EXISTS / ON CONFLICT).
--
-- Legt `public.milestones` (die 27 Meilensteine aus DiplData/DIPL-Teams/
-- Meilensteine_Alle.xlsx, hier als Startdaten eingepflegt) sowie
-- `public.status_report` (ein einzeiliger Lagebericht des Admins) an.
--
-- Ampel-Status (🟢/🟡/🔴/✅/⏭️) wird NICHT gespeichert, sondern im Frontend
-- aus `status` + `due_date` + heutigem Datum berechnet (siehe
-- app/assets/progress.js) — sonst müsste die Farbe von Hand nachgezogen
-- werden und wäre sofort veraltet.
--
-- Rechte: jedes angemeldete Mitglied darf beides lesen. Schreiben darf nur
-- der Admin (Titel, Termin, Zuweisung, Kommentare, Lagebericht) — außer dem
-- eigenen Arbeitsstatus: dafür gibt es `set_own_milestone_status()`, analog
-- zu `update_own_profile()` in profile_setup.sql (SECURITY DEFINER mit
-- fixem, engem Feld-Set statt einer Self-Update-Policy, damit niemand über
-- die API einen fremden Meilenstein oder den Termin selbst verändern kann).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Status-Enum ─────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'milestone_status') then
    create type public.milestone_status as enum ('offen', 'in_arbeit', 'fertig', 'verschoben');
  end if;
end $$;

-- ── Meilensteine ────────────────────────────────────────────────────────────
create table if not exists public.milestones (
  id                 int primary key,
  title              text not null,
  deliverable        text not null,
  person_name        text not null,
  assignee_email     text,
  due_date           date not null,
  original_due_date  date not null,
  depends_on         int references public.milestones(id),
  dependency_note    text,
  plan_note          text,
  status             public.milestone_status not null default 'offen',
  done_at            timestamptz,
  admin_note         text,
  updated_at         timestamptz not null default now()
);

alter table public.milestones enable row level security;

drop policy if exists "milestones_select_member" on public.milestones;
create policy "milestones_select_member" on public.milestones
  for select using (auth.uid() is not null);

drop policy if exists "milestones_insert_admin" on public.milestones;
create policy "milestones_insert_admin" on public.milestones
  for insert with check (public.my_rank() = 'admin');

drop policy if exists "milestones_update_admin" on public.milestones;
create policy "milestones_update_admin" on public.milestones
  for update using (public.my_rank() = 'admin');

drop policy if exists "milestones_delete_admin" on public.milestones;
create policy "milestones_delete_admin" on public.milestones
  for delete using (public.my_rank() = 'admin');

-- Mitarbeiter/Stellvertreter dürfen NUR den eigenen Arbeitsstatus setzen
-- (nie 'verschoben' — Terminverschiebungen sind eine Admin-Entscheidung,
-- weil sie Folgemeilensteine über `depends_on` betreffen).
create or replace function public.set_own_milestone_status(
  p_id int,
  p_status public.milestone_status
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  if p_status not in ('offen', 'in_arbeit', 'fertig') then
    raise exception 'Diesen Status kann nur der Admin setzen.';
  end if;

  select email into v_email from public.members where id = auth.uid();

  update public.milestones
  set status     = p_status,
      done_at    = case when p_status = 'fertig' then now() else null end,
      updated_at = now()
  where id = p_id
    and (assignee_email = v_email or public.my_rank() = 'admin');

  if not found then
    raise exception 'Kein Zugriff auf diesen Meilenstein.';
  end if;
end;
$$;

-- ── Lagebericht: eine einzige Zeile ──────────────────────────────────────────
create table if not exists public.status_report (
  id         boolean primary key default true check (id),
  body       text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.status_report (id, body) values (true, '')
on conflict (id) do nothing;

alter table public.status_report enable row level security;

drop policy if exists "status_report_select_member" on public.status_report;
create policy "status_report_select_member" on public.status_report
  for select using (auth.uid() is not null);

drop policy if exists "status_report_update_admin" on public.status_report;
create policy "status_report_update_admin" on public.status_report
  for update using (public.my_rank() = 'admin');

-- ── Startdaten: die 27 Meilensteine aus dem DA-Plan (Stand 2026-08-19) ──────
-- Peters neun eigene Meilensteine sind direkt seinem Konto zugewiesen;
-- Julian und Leon haben noch keine Konten — ihre `assignee_email` bleibt
-- NULL, bis der Admin sie in der App "Meilensteine" zuweist.
insert into public.milestones
  (id, title, deliverable, person_name, assignee_email, due_date, original_due_date,
   depends_on, dependency_note, plan_note, status, admin_note)
values
  (1, 'Team-Kickoff & Organisation',
   'Alle wissen was sie machen, Kommunikationskanal ist eingerichtet, grober Zeitplan steht',
   'Peter Scheikl', 'peter.scheikl@hakwt.at', '2026-07-10', '2026-07-10',
   null, 'Antrag genehmigt', 'Team Lead Aufgabe', 'offen',
   'Laut Meeting 30.07. noch nicht abgeschlossen – unkritisch'),

  (2, 'Engine & Tools einrichten',
   'Game Engine ist ausgewählt, läuft auf allen Rechnern, Git-Repo ist oben und alle haben Zugriff',
   'Leon Koller', null, '2026-07-12', '2026-07-12',
   null, 'Antrag genehmigt', 'Startschuss', 'offen',
   'Laut Meeting 30.07. noch nicht abgeschlossen – unkritisch'),

  (3, 'Stil & Moodboard festlegen',
   'Moodboard ist fertig, Farbpalette und grober Stil sind definiert – alle im Team wissen wie das Spiel ausschauen soll',
   'Julian Handl', null, '2026-07-17', '2026-07-17',
   null, 'Antrag genehmigt', 'Orientierung fürs Team', 'offen',
   'Laut Meeting 30.07. noch nicht abgeschlossen – unkritisch'),

  (4, 'Marktanalyse & Zielgruppe',
   'Wer kauft unser Spiel? Was machen Konkurrenten wie Brawlhalla? Was macht uns besonders? – alles schriftlich festgehalten',
   'Peter Scheikl', 'peter.scheikl@hakwt.at', '2026-08-14', '2026-08-14',
   1, 'Kickoff (KW 28)', null, 'offen', null),

  (5, 'Logo & Corporate Design fertig',
   'Logo ist final, Farben und Schriften sind festgelegt und dokumentiert – kann von Peter für die Website genutzt werden',
   'Julian Handl', null, '2026-08-21', '2026-08-21',
   3, 'Moodboard (KW 29)', 'Übergabe an Peter', 'offen', null),

  (6, 'Spieler kann sich bewegen & kämpfen',
   'Laufen, Springen, einfacher Angriff funktioniert – zwei Spieler können lokal gegeneinander spielen',
   'Leon Koller', null, '2026-08-28', '2026-08-28',
   2, 'Engine eingerichtet (KW 28)', null, 'offen', null),

  (7, 'Alle 4 Charaktere designed',
   'Konzepte für alle 4 Charaktere sind fertig – Aussehen, Farben und Stil sind klar',
   'Julian Handl', null, '2026-09-18', '2026-09-18',
   5, 'Corporate Design (KW 34)', null, 'offen', null),

  (8, 'Geschäftsmodell & Finanzplan',
   'Wie verdienen wir Geld? (Free-to-Play, Premium, etc.) – Entscheidung getroffen und begründet, 3-Jahres-Finanzplan steht',
   'Peter Scheikl', 'peter.scheikl@hakwt.at', '2026-09-18', '2026-09-18',
   4, 'Marktanalyse (KW 33)', null, 'offen', null),

  (9, 'Portal-Mechanik läuft',
   'Spieler kann Portale nutzen um sich zu teleportieren, Kollision funktioniert korrekt',
   'Leon Koller', null, '2026-09-25', '2026-09-25',
   6, 'Bewegung & Kampf (KW 35)', 'Kern-Feature', 'offen', null),

  (10, 'Alle 3 Arenen designed',
   'Alle 3 Arenen sind als fertige Designs vorhanden – Hintergründe, Plattformen, Farbstimmung passt',
   'Julian Handl', null, '2026-10-16', '2026-10-16',
   7, 'Charaktere (KW 38)', null, 'offen', null),

  (11, 'Businessplan komplett geschrieben',
   'Vollständiger Businessplan mit allen Kapiteln: Zusammenfassung, Markt, Finanzen, Marketing – fertig zum Drüberlesen',
   'Peter Scheikl', 'peter.scheikl@hakwt.at', '2026-10-23', '2026-10-23',
   8, 'Finanzplan (KW 38)', 'Ankerpunkt November', 'offen', null),

  (12, 'Erste spielbare Version (Prototyp)',
   'Runde starten, kämpfen, Sieger wird angezeigt, Neustart geht – alles stabil',
   'Leon Koller', null, '2026-10-30', '2026-10-30',
   9, 'Portal-Mechanik (KW 39)', null, 'offen', null),

  (13, 'Sprites & Animationen für Leon bereit',
   'Alle 4 Charaktere als fertige Sprite-Sheets mit Animationen (Idle, Laufen, Angriff, Treffer) – an Leon übergeben',
   'Julian Handl', null, '2026-11-20', '2026-11-20',
   10, 'Arenen fertig (KW 42)', 'Übergabe an Leon', 'offen', null),

  (14, 'Website-Struktur & Wireframes',
   'Welche Seiten gibt es? Wie ist die Navigation? Wireframes für alle Seiten gezeichnet, Technologie ausgewählt',
   'Peter Scheikl', 'peter.scheikl@hakwt.at', '2026-11-20', '2026-11-20',
   11, 'Businessplan fertig (KW 43)', null, 'offen', null),

  (15, 'Multiplayer für 4 Spieler fertig',
   'Bis zu 4 Spieler können lokal zusammen spielen, keine Abstürze, Steuerung für alle funktioniert',
   'Leon Koller', null, '2026-11-27', '2026-11-27',
   12, 'Prototyp (KW 44)', null, 'offen', null),

  (16, 'Marketing-Posts & Social Media',
   'Social-Media-Vorlagen für Instagram/TikTok fertig, grobes Konzept für einen Spieltrailer skizziert',
   'Julian Handl', null, '2026-12-18', '2026-12-18',
   13, 'Sprites fertig (KW 47)', null, 'offen', null),

  (17, 'Website Grundgerüst steht',
   'Alle Seiten sind gebaut, Navigation funktioniert, sieht auf Handy und PC gut aus – noch ohne finale Grafiken',
   'Peter Scheikl', 'peter.scheikl@hakwt.at', '2026-12-18', '2026-12-18',
   14, 'Wireframes (KW 47)', null, 'offen', null),

  (18, 'Julians Grafiken eingebaut',
   'Alle Charakter-Sprites und Arenen von Julian sind ins Spiel eingebaut, Animationen laufen flüssig',
   'Leon Koller', null, '2027-01-09', '2027-01-09',
   13, 'Julians Sprites (KW 47)', 'Warten auf Julian', 'offen', null),

  (19, 'Grafiken für Peters Website bereit',
   'Hero-Bild, Charakter-Bilder, Screenshots und Icons für die Website sind fertig und an Peter übergeben',
   'Julian Handl', null, '2027-01-16', '2027-01-16',
   16, 'Marketing (KW 51)', 'Übergabe an Peter', 'offen', null),

  (20, 'Website live mit echtem Inhalt',
   'Julians Grafiken sind eingebaut, Website ist online, Kontaktformular und Newsletter funktionieren',
   'Peter Scheikl', 'peter.scheikl@hakwt.at', '2027-01-23', '2027-01-23',
   19, 'Julians Assets (KW 3)', 'Warten auf Julian', 'offen', null),

  (21, 'Bugs behoben & Balance geprüft',
   'Alle bekannten Bugs sind weg, Charaktere fühlen sich fair an, Spiel läuft stabil',
   'Leon Koller', null, '2027-02-06', '2027-02-06',
   18, 'Grafiken eingebaut (KW 1)', null, 'offen', null),

  (22, 'Präsentations-Folien fertig',
   'Pitch-Deck für die Abschlusspräsentation ist fertig, Cover-Design für die gedruckte Arbeit ist vorhanden',
   'Julian Handl', null, '2027-02-13', '2027-02-13',
   20, 'Website-Grafiken (KW 3)', 'Für Präsentation', 'offen', null),

  (23, 'Businessplan & Website-Doku fertig',
   'Businessplan ist nochmal korrigiert, kurze Doku über Website-Entwicklung geschrieben, Begleitprotokoll abgegeben',
   'Peter Scheikl', 'peter.scheikl@hakwt.at', '2027-02-13', '2027-02-13',
   20, 'Website live (KW 4)', 'Für Abgabe nötig', 'offen', null),

  (24, 'Technische Doku geschrieben',
   'Code ist kommentiert, kurze Architektur-Übersicht vorhanden, Begleitprotokoll abgegeben',
   'Leon Koller', null, '2027-02-27', '2027-02-27',
   21, 'Bugs behoben (KW 6)', 'Für Abgabe nötig', 'offen', null),

  (25, 'Design-Doku abgegeben',
   'Kurze Doku über Design-Entscheidungen fertig, Brandbook final, Begleitprotokoll abgegeben',
   'Julian Handl', null, '2027-02-27', '2027-02-27',
   22, 'Folien (KW 7)', 'Für Abgabe nötig', 'offen', null),

  (26, 'Fertiges Spiel als Build exportiert',
   'Spiel läuft als eigenständige Datei auf einem anderen PC, ist bereit für die Präsentation',
   'Leon Koller', null, '2027-03-05', '2027-03-05',
   24, 'Doku fertig (KW 8)', 'Letzter Schritt', 'offen', null),

  (27, 'Drucken, binden & abgeben',
   '2 Exemplare gedruckt und gebunden, PDF digital hochgeladen, Abgabe bestätigt',
   'Peter Scheikl', 'peter.scheikl@hakwt.at', '2027-03-07', '2027-03-07',
   null, 'Alle Dokus fertig (KW 8)', 'Letzter Schritt', 'offen', null)
on conflict (id) do nothing;
