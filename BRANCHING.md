# Branch- und Release-Regeln

Ziel: **Nicht jeder Push geht live.** `main` ist die Live-Version — dort landet
nur, was fertig und geprüft ist. Alles Neue wird vorher auf eigenen Branches
gesammelt.

## Die Branches

| Branch | Zweck | Deploy |
|---|---|---|
| `main` | Live-Stand der Seite. Immer lauffähig. | **Produktion** (nur hier!) |
| `develop` | Sammelbecken: alles Neue, das fertig ist, aber noch nicht live soll. | nie Produktion (höchstens Preview) |
| `feature/<thema>` | Eine neue Sache, z. B. `feature/casino-jackpot` | nie Produktion |
| `fix/<thema>` | Bugfix, z. B. `fix/wetter-timeout` | nie Produktion |
| `hotfix/<thema>` | Dringender Live-Fehler, direkt von `main` | über PR nach `main` |

## Regeln

1. **Nie direkt auf `main` pushen.** Auch nicht „nur kurz".
2. **Neue Arbeit** startet von `develop`:
   `git switch develop && git pull && git switch -c feature/<thema>`
3. Feature fertig → Pull Request **nach `develop`** (oder lokal mergen).
   Kleine Commits sind ok, viele Pushes auf Feature-Branches ebenfalls —
   die deployen nichts.
4. **Release:** Wenn `develop` komplett und getestet ist, ein Pull Request
   `develop` → `main`. Erst dieser Merge deployed live.
5. Vor dem Release-PR kurz prüfen: Seite lokal öffnen (`app/index.html`),
   Hauptseiten durchklicken, keine Konsolenfehler, keine Secrets im Diff
   (`.env*`, Keys).
6. **Hotfix:** Branch von `main`, PR nach `main`, danach `main` zurück in
   `develop` mergen, damit nichts auseinanderläuft.
7. Nach dem Merge Branch löschen (Feature/Fix/Hotfix).
8. Commit-Stil wie bisher: kurze deutsche Nachricht mit Emoji-Präfix.

## Einmalig einzurichten (auf GitHub / Cloudflare — nicht per Code möglich)

- **GitHub → Settings → Branches → Branch protection für `main`:**
  „Require a pull request before merging" an, „Do not allow bypassing" an,
  Force-Push verbieten.
- **GitHub → Settings → General → Default branch:** auf `develop` stellen
  (optional, dann zielen neue PRs automatisch dorthin).
- **Cloudflare (Workers & Pages → Projekt → Settings → Builds):**
  Production branch = `main`. „Non-production branch builds" **deaktivieren**
  (oder nur als Preview zulassen), damit Pushes auf `develop`/`feature/*`
  nichts Live-Geschaltetes verändern.
- Die alte Branch `cloudflare/workers-autoconfig` ist ein Überbleibsel der
  automatischen Cloudflare-Einrichtung und kann nach Klärung des Deploy-Wegs
  gelöscht werden.
