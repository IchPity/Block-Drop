# tools/ — Dev-Helfer

Lokale Build-/Hilfsskripte und Quelldaten. Werden **nicht** mit auf die
Cloudflare-Pages-Seite (`app/`) deployed.

| Datei | Zweck |
|-------|-------|
| `_splice.js` | Tauscht die Optik (Titel, Font, CSS, Deko-/Navbar-Markup) eines Spiels aus, ohne die Spiel-Logik anzufassen.<br>Aufruf: `node tools/_splice.js <index.html> <headFile> <cssFile> <markupFile> <markupStartRegex> <markupEndStr>` |
| `woertle-words.txt` | Rohe Quell-Wortliste (engl. 5-Buchstaben-Wörter) für Wördle. Daraus entsteht `app/games/woertle/words.js`. |
