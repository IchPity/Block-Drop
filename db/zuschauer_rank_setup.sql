-- ─────────────────────────────────────────────────────────────────────────────
-- Smashin' Kurt — Fortschritts-Tracker · Rang "Zuschauer"
-- Im Supabase SQL-Editor ausführen, NACH db/ranks_whitelist_setup.sql.
--
-- Fügt dem Enum public.member_rank den Wert 'zuschauer' hinzu. Mehr braucht
-- es nicht: alle bestehenden RLS-Policies sind schon so geschrieben, dass
-- ein neuer, nicht explizit genannter Rang automatisch NUR Lesezugriff auf
-- milestones/status_report bekommt (Policies dort prüfen bloß "angemeldet",
-- nicht den Rang) und überall sonst (Whitelist, Rang-Vergabe, Passwords,
-- Meilenstein bearbeiten) draußen bleibt, weil diese Policies explizit
-- 'admin'/'stellvertreter' verlangen. Kein Zuschauer wird je einem
-- Meilenstein zugewiesen, darum bleibt für sie auch das Abhaken aus.
--
-- WICHTIG: Postgres verlangt, dass ein neuer Enum-Wert committet ist, bevor
-- er in derselben Sitzung verwendet wird. Da dieses Skript den Wert nur
-- ANLEGT (nirgends sofort danach benutzt), ist ein separater zweiter Schritt
-- hier nicht nötig — normal als Ganzes ausführen.
-- ─────────────────────────────────────────────────────────────────────────────

alter type public.member_rank add value if not exists 'zuschauer';
