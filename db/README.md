# db/ — Supabase-Setup

SQL-Skripte, die das Datenbank-Schema (Tabellen + RLS-Policies) in Supabase anlegen.
Werden **nicht** deployed, sondern einmalig im Supabase SQL-Editor ausgeführt.

| Datei | Zweck |
|-------|-------|
| `username_login_setup.sql` | Login per Benutzername statt E-Mail |
| `friends_setup.sql` | Freundschaften / -anfragen |
| `messages_setup.sql` | Direktnachrichten (Chat) |
| `notifications_setup.sql` | Benachrichtigungen |
