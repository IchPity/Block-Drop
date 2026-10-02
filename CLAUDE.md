# Projektregeln für Claude

## Git-Workflow (siehe BRANCHING.md)

- **Nie auf `main` committen oder pushen** — `main` = Produktion, jeder Push
  dort deployed live.
- Neue Arbeit immer auf einem Branch von `develop`: `feature/<thema>` oder
  `fix/<thema>`. Vor Arbeitsbeginn Branch prüfen (`git branch --show-current`);
  steht man auf `main`, zuerst auf `develop` wechseln und Branch anlegen.
- Pushen nur Feature-/Fix-Branches und `develop`. Merge nach `develop`
  per PR oder lokalem Merge, wenn der Nutzer es möchte.
- **Merge `develop` → `main` nur auf ausdrücklichen Wunsch des Nutzers**
  („release", „live stellen") — das ist der Deploy.
- Kein Force-Push, keine Secrets (`.env*`) committen.
- Commit-Nachrichten: deutsch, kurz, Emoji-Präfix wie in der History.
