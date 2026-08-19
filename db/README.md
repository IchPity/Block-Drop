# db/ — Supabase-Setup

SQL-Skripte, die das Datenbank-Schema (Tabellen + RLS-Policies) in Supabase anlegen.
Werden **nicht** deployed, sondern einmalig im Supabase SQL-Editor ausgeführt.

Reihenfolge beim Ersteinrichten: `ranks_whitelist_setup.sql` zuerst, danach
die übrigen Skripte (setzen alle die Tabellen aus dem ersten Skript voraus).

| Datei | Zweck |
|-------|-------|
| `ranks_whitelist_setup.sql` | Ränge, Whitelist, `members`-Tabelle, Whitelist-Gate-Trigger, RLS |
| `profile_setup.sql` | Anzeigename + Avatar (Selbst-Update-RPC, ohne Rang-Eskalation) |
| `admin_access_overview_setup.sql` | RPC für App "Passwords" (Zugangsstatus, nie Klartext-Passwörter) |
| `milestones_setup.sql` | Meilensteine (Startdaten aus dem DA-Plan) + Lagebericht für App "Meilensteine" |

Skripte aus der früheren Arcade-Seite (Freunde, Chat, Benachrichtigungen,
Username-Login) wurden entfernt — ihr Stand bleibt in der Git-History,
gehört aber nicht mehr zum aktiven Schema dieses Trackers.
