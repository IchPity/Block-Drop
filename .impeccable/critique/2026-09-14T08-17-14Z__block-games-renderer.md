---
target: block-games/renderer
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:C:\\Users\\User\\Desktop\\Block Drop\\block-games\\renderer"
timestamp: 2026-09-14T08-17-14Z
slug: block-games-renderer
closed: true
---
Method: dual-agent (A: design-review subagent · B: detector-scan subagent)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Toasts are the only channel for several state changes and vanish in 3.2s with no persistent trace (also confirmed missing `aria-live`). |
| 2 | Match System / Real World | 4 | Consistent German voice, arcade/party metaphors throughout. |
| 3 | User Control and Freedom | 4 | Layered Esc handling, explicit "Lobby zurücksetzen" undo, genuine cancel path on quit. |
| 4 | Consistency and Standards | 3 | Header toolbar mixes icon-only, icon+text, and text-only buttons with no consistent rule. |
| 5 | Error Prevention | 3 | Quit confirmation, auto-resolved color conflicts, input length limits — but prevented actions only surface via transient toast. |
| 6 | Recognition Rather Than Recall | 4 | Recent-login chips, always-visible lobby/slot state, yellow focus highlighting. |
| 7 | Flexibility and Efficiency | 2 | Keyboard-first nav is decent (column-jump in lobby), but no way to skip the "Bald" cards or move faster through the menu. |
| 8 | Aesthetic and Minimalist Design | 3 | Coherent arcade identity, but main menu runs 3 decorative animation layers + shine-sweep + banner + 7 click targets at once — busy for a single "go play" moment. |
| 9 | Error Recovery | 2 | Several error paths fall back to raw, untranslated Supabase `error.message` inside an all-German UI. |
| 10 | Help and Documentation | 2 | Only control-scheme legend lives buried in Settings; no key-binding hint reachable from auth/menu/lobby. |
| **Total** | | **30/40** | **Acceptable-to-Good band (75%)** |

All 10 heuristics scored (none `n/a` — this is a keyboard-only Operate surface where efficiency and documentation genuinely apply).

## Design Specificity Verdict

**LLM assessment**: Not a reskinned template. German-language copy, the Impact-font arcade-poster wordmark, a bespoke `navId`-graph keyboard-navigation engine built specifically for the "no mouse anywhere" hard requirement, and 300 hand-written pun bot names are all grounded in this exact product — a solo dev's Mario-Party-style couch game for a small friend group. The deliberate choice to avoid a literal Mario "?"-block in the brand mark while keeping the gameplay homage (per PRODUCT.md) is a specific, considered decision, not a default.

**Deterministic scan**: `impeccable detect --json block-games/renderer` returned **43 findings** (30 warning / 13 advisory; 34 "slop" / 9 "quality") across `index.html` (30) and `style.css` (13, with real line numbers). Breakdown: `side-tab` accent borders (7), `border-accent-on-rounded` (6), `low-contrast` text (5), `dark-glow` text-shadow (4), `bounce-easing` (4), `wide-tracking` (2), `skipped-heading` (2), `gpt-thin-border-wide-shadow` (12, advisory), `repeating-stripes-gradient` (1, advisory).

Judged against this specific product (a Windows fullscreen party-arcade, not a SaaS dashboard the detector is calibrated on): the glow, bounce-easing, wide shadows, and decorative stripes read as **genre-appropriate arcade-cabinet styling**, not generic AI slop — no action recommended there. Two categories don't get that pass: the 5 **contrast failures** are real WCAG breaks regardless of genre, and `border-accent-on-rounded` (a `border-bottom` fighting a `border-radius` on the same element, 6 sites) reads as an execution defect rather than a style choice — the border visibly doesn't follow the corner curve.

**Visual overlays**: Not available. No browser-automation tool is exposed in this session, so no live render, injection, or console evidence exists — this is corroborating source-only analysis from both assessments, not a substitute for eyeballing the running app. Fallback signal only.

## Overall Impression

The keyboard-navigation engineering is the standout: a fixed `navId` graph with throttled auto-repeat and voice-consistent German copy that never feels like AI-generated filler. The gap between "well-built" and "polished" is mostly in feedback durability (toast-only, transient, English leaking through on errors) and in the main menu asking a first-timer to parse 6 equal-weight choices when only 2 do anything. Both assessments independently flagged real contrast problems in different specific spots, which corroborates rather than duplicates the finding.

## What's Working

1. **The keyboard-nav architecture** (`NAV_MENU`/`buildLobbyNav`/`handleSettingsKey`) is unusually disciplined for a hobby project — an explicit fixed graph instead of DOM-order tabbing, deliberate-press vs. held-key throttling, focus never jumps into the void.
2. **Copy voice is specific, not generic** — tagline, quit-dialog phrasing ("Möchtest du uns denn etwa wirklich verlassen?"), and 300 pun bot names all read as authored for this exact friend group.
3. **Edge cases are handled in logic, not just visuals** — long usernames ellipsis-truncate everywhere, color conflicts between slots auto-resolve instead of silently colliding.

## Priority Issues

**[P1] Four of six minigame cards are dead-end choices at equal visual weight**
- **Why it matters**: `#minigameGrid` renders 6 full-size, fully keyboard-focusable cards; 4 are `available:false` placeholders differing only by `opacity:.62` and a "Bald" badge — triggering one just shows a toast. This is a first-screen chunking violation (>4 choices where 2 are real) and front-loads disappointment for a first-timer.
- **Fix**: Collapse the 4 placeholders into a single de-emphasized "4 weitere in Arbeit" teaser, separate from the 2 playable cards and out of the primary keyboard-nav row.
- **Suggested command**: `/impeccable distill` or `/impeccable layout`

**[P1] Real WCAG contrast failures, confirmed independently by both assessments**
- **Why it matters**: The detector found white text on `#4db5ff` (2.2:1, needs 4.5:1), white on `#b06dff` (3.2:1), and `#3d0606` on `#e04444` (4.1:1) in `index.html`. The design review separately found `.auth-form .hint`/`.account-form .hint` at `opacity:0.7` on `--text-dim` computing to ~3.5:1 against the card backgrounds — exactly the text carrying registration constraints ("3–20 Zeichen", "min. 6 Zeichen"). Two independent methods surfacing contrast failures in different UI areas is a strong signal this isn't a one-off.
- **Fix**: Raise all flagged pairs to 4.5:1 (3:1 minimum for large/heading text); drop the 0.7 opacity dimming on hint text or introduce a verified replacement token.
- **Suggested command**: `/impeccable harden` or `/impeccable colorize`

**[P2] `border-bottom` accents fight `border-radius` on 6 rounded elements**
- **Why it matters**: `style.css:287,1009,1221,1370,1589,1884` — a 4-5px solid `border-bottom` on rounded cards visibly doesn't follow the corner curve. Assessment B's own genre-aware read still flagged this as an execution defect, not a stylistic choice, unlike the glow/bounce/shadow findings it waved through.
- **Fix**: Either drop the border-radius on these elements or replace the hard bottom border with an accent that respects the curve (inset shadow, gradient mask).
- **Suggested command**: `/impeccable polish`

**[P2] Untranslated Supabase error strings leak English into an all-German UI**
- **Why it matters**: `showAuthError(error.message || '...')` and several `showToast(error.message || '...')` calls (`app.js` ~255, 1663, 1672, 1676, 1736-1749) surface raw backend text like "Invalid login credentials" at exactly the highest-friction moments — failed login, failed friend request — for the least-equipped user (a confused first-timer) to parse English jargon.
- **Fix**: Map known Supabase error codes to German strings; keep raw `error.message` only as a last-resort fallback.
- **Suggested command**: `/impeccable clarify`

**[P2] Lobby-conflict feedback is toast-only, transient, and not announced to assistive tech**
- **Why it matters**: "Diese Farbe ist schon vergeben.", "Keine freie Farbe verfügbar.", "Mindestens 2 Spieler — füge Bots hinzu." only ever appear as a 3.2s toast with no inline cue on the offending control — an impatient player can trigger and miss it in the same beat. The toast element (`#toast`, `index.html:490`) also has no `aria-live`/`role="status"`, so a screen-reader user gets zero announcement for the only feedback channel several actions have.
- **Fix**: Add `aria-live="polite"` to the toast container, and pair it with a brief inline cue (flash/shake) on the actual control so the cause stays visible after the toast fades.
- **Suggested command**: `/impeccable harden`

## Persona Red Flags

**Jordan (confused first-timer)**: Lands on a menu where 4 of 6 apparent choices are dead ends, discoverable only by clicking each and reading a toast. The one control-scheme explanation lives inside Settings, unreachable from the first screens. A failed login can show raw English text instead of German feedback, compounding first-session confusion.

**Sam (accessibility-dependent — screen reader, keyboard-only, 4.5:1-dependent)**: The hint-text contrast failure (~3.5:1) directly blocks reading required form constraints. The toast has no `aria-live`, so the only feedback for several actions is silent to assistive tech. Icon-only header buttons (⚙️, ⏻, ✕) rely solely on `title`, not `aria-label` — a weaker accessible name. A closed lobby playercard communicates its chosen color only via a hue ring, not as persisted text.

**Riley (stress tester)**: Long usernames, 0-friends, and slot/color conflicts are all handled gracefully in code (verified — ellipsis truncation, empty-state copy, auto color reassignment). One real gap: `Escape` in `setupKeyboard()` has no `e.repeat` guard, unlike the throttled directional-nav path — holding Escape (OS key-repeat) could cascade through several screen transitions (popup → overlay → menu) within one held keypress.

**Casey (mobile)**: Not applicable — always-fullscreen Windows desktop app, no touch/mobile target.

## Minor Observations

- Scrollbars are globally hidden (mouse/touch scroll still works) but there's no visual affordance that `.credits-grid`, `.settings-panels`, or `.account-body` are scrollable.
- Global `user-select: none` also blocks copying an unfamiliar (English) error string to search it.
- The 5-color accent rotation on `.minigame-card` repeats at card 6 — a small identity collision once the roster grows past 5 games.
- `showSingleResult()` only ever celebrates the winner (`${winner.name} gewinnt!`); losers get no placement acknowledgment — worth a look later (`/impeccable delight`), not urgent.
- Motion-sensitivity is handled properly: `body.reduced-fx` disables all ambient animation, with a dedicated Settings toggle — a genuine strength worth preserving through any of the fixes above.
- Detector findings judged as genre-appropriate and given no action: `dark-glow` text-shadow on arcade headings, `bounce-easing` on dice/playful transitions, `gpt-thin-border-wide-shadow` on elevated cards, `repeating-stripes-gradient` decorative texture, and most of the `side-tab` accent-border cards (differentiating minigame/lobby cards is plausible genre signaling, not templated slop).

## Questions to Consider

- What if the 4 "Bald" cards became one single teaser tile — would that fix the >4-choice violation *and* remove the first-timer's early disappointment in one change?
- What if losing a round got as much authored attention as winning — would the loser, not just the winner, be the one reaching for "Nochmal"?
- Is there any legitimate reason Escape's repeat behavior should differ from every other key in an app built to be entirely keyboard-driven?
