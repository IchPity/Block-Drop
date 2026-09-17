// Block Rush — Spell-System: Vergabe, Inventar, Aktions-Cursor, Effekt-Timer.
//
// Effekte leben als reine Zahlen je Spieler (`fx.glueT/growth/slowT/quakeT`),
// NIE in Closures — dadurch passen sie unverändert in den Online-Snapshot
// (main.js serialisiert `fx` direkt mit).
//
// Zielen ohne Maus: pro Spieler eine flache Aktions-Liste (Inventar × mögliche
// Ziele — bei sich selbst für Kleber/Wachstum, je einen lebenden Gegner für
// Erdbeben/Blitzsturz). Eine Taste blättert (`cycle`), eine feuert (`cast`).

'use strict';

export const SPELL_META = {
  glue:   { id: 'glue',   name: 'Kleber',    icon: '🧲', offensive: false, dur: 8 },
  growth: { id: 'growth', name: 'Wachstum',  icon: '📦', offensive: false, dur: 0 },
  quake:  { id: 'quake',  name: 'Erdbeben',  icon: '💥', offensive: true,  dur: 0 },
  speed:  { id: 'speed',  name: 'Blitzsturz', icon: '⚡', offensive: true,  dur: 5 },
};
export const SPELL_IDS = Object.keys(SPELL_META);

const GRANT_INTERVAL = 9;   // s, Basiswert bis zum nächsten Spell (mit Jitter)
const GRANT_EVERY_LOCK = 5; // zusätzlich: alle 5 gelegten Teile ein Spell
const MAX_INVENTORY = 2;

export class SpellSystem {
  constructor(playerIds) {
    this.state = new Map();
    for (const id of playerIds) {
      this.state.set(id, {
        grantT: 4 + Math.random() * 3, // erster Spell zeitlich gestaffelt
        sinceLock: 0,
        inventory: [],
        cursor: 0,
        fx: { glueT: 0, growth: 0, slowT: 0, quakeT: 0 },
      });
    }
  }

  stateOf(id) { return this.state.get(id); }

  // main.js ruft das bei jedem eingerasteten Teil des jeweiligen Spielers auf.
  onLock(id) {
    const s = this.state.get(id); if (!s) return;
    s.sinceLock += 1;
    if (s.sinceLock >= GRANT_EVERY_LOCK) {
      s.sinceLock = 0;
      this._grant(s);
    }
  }

  update(dt, aliveIds) {
    for (const id of aliveIds) {
      const s = this.state.get(id); if (!s) continue;
      if (s.fx.glueT > 0) s.fx.glueT = Math.max(0, s.fx.glueT - dt);
      if (s.fx.slowT > 0) s.fx.slowT = Math.max(0, s.fx.slowT - dt);
      if (s.fx.quakeT > 0) s.fx.quakeT = Math.max(0, s.fx.quakeT - dt);
      if (s.inventory.length < MAX_INVENTORY) {
        s.grantT -= dt;
        if (s.grantT <= 0) { this._grant(s); s.grantT = GRANT_INTERVAL * (0.85 + Math.random() * 0.3); }
      }
    }
  }

  _grant(s) {
    if (s.inventory.length >= MAX_INVENTORY) return;
    const fresh = SPELL_IDS.filter((id) => !s.inventory.includes(id));
    const pool = fresh.length ? fresh : SPELL_IDS;
    s.inventory.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  // Flache Aktionsliste für den Aktions-Cursor: Inventar × mögliche Ziele.
  actionsFor(id, aliveIds) {
    const s = this.state.get(id); if (!s) return [];
    const actions = [];
    for (const spellId of s.inventory) {
      const meta = SPELL_META[spellId];
      if (meta.offensive) {
        for (const opp of aliveIds) if (opp !== id) actions.push({ spellId, targetId: opp });
      } else {
        actions.push({ spellId, targetId: id });
      }
    }
    return actions;
  }

  currentAction(id, aliveIds) {
    const s = this.state.get(id); if (!s) return null;
    const actions = this.actionsFor(id, aliveIds);
    if (!actions.length) { s.cursor = 0; return null; }
    if (s.cursor >= actions.length) s.cursor = 0;
    return actions[s.cursor];
  }

  cycle(id, aliveIds) {
    const s = this.state.get(id); if (!s) return;
    const n = this.actionsFor(id, aliveIds).length;
    s.cursor = n ? (s.cursor + 1) % n : 0;
  }

  // Feuert die aktuell per Cursor gewählte Aktion, entfernt sie aus dem
  // Inventar und gibt { spellId, targetId } zurück (oder null). Setzt bei
  // Dauereffekten (Kleber/Blitzsturz) direkt den fx-Timer beim Ziel — Wachstum
  // und Erdbeben haben keine Dauer und werden von main.js an Playfield/
  // TowerSim gekoppelt (spells.js kennt diese Objekte nicht).
  cast(id, aliveIds) {
    const s = this.state.get(id); if (!s) return null;
    const action = this.currentAction(id, aliveIds);
    if (!action) return null;
    const invIdx = s.inventory.indexOf(action.spellId);
    if (invIdx === -1) return null;
    s.inventory.splice(invIdx, 1);
    s.cursor = 0;

    const meta = SPELL_META[action.spellId];
    const target = this.state.get(action.targetId);
    if (target && meta.dur > 0) {
      if (action.spellId === 'glue') target.fx.glueT = meta.dur;
      if (action.spellId === 'speed') target.fx.slowT = meta.dur;
    }
    return action;
  }
}
