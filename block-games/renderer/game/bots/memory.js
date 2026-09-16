// Räumliches Match-Gedächtnis für Bots.
//
// Anders als die statischen 'corner'-Waypoint-Tags (fest auf der Map
// hinterlegt) merkt sich dieses Modul Dinge, die ein Bot WÄHREND eines
// Matches selbst erlebt hat (z.B. eine Stelle, an der er wiederholt
// feststeckte und teleportiert werden musste). Rein additiv zu den
// Karten-Tags — beide fließen als Malus in die Zielwahl ein.
//
// Kein Import, keine Three.js-Abhängigkeit — reine Funktionen wie
// waypoints.js. Eine Instanz lebt so lange wie der Bot-Mover, der sie
// erzeugt (createBotMover → ein Mover pro Bot pro Match), ist also
// automatisch pro Match frisch.

'use strict';

function nowMs() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

export function createZoneMemory() {
  const zones = new Map(); // id -> { x, z, type, weight, expiresAt }

  function purge(t) {
    for (const [id, z] of zones) {
      if (z.expiresAt <= t) zones.delete(id);
    }
  }

  return {
    // Merkt sich eine Zone (überschreibt bei gleicher id, damit wiederholte
    // Vorkommnisse an derselben Stelle die TTL auffrischen statt zu stapeln).
    markZone(id, x, z, type, ttlMs = 30000, weight = 1) {
      zones.set(id, { x, z, type, weight, expiresAt: nowMs() + ttlMs });
    },
    // Malus an einem Punkt: Summe der Zonen-Gewichte in der Nähe, linear
    // abfallend mit dem Abstand. 0 = keine bekannte Gefahr hier.
    penaltyAt(x, z, radius = 2.5) {
      const t = nowMs();
      purge(t);
      let malus = 0;
      for (const zone of zones.values()) {
        const d = Math.hypot(x - zone.x, z - zone.z);
        if (d < radius) malus += zone.weight * (1 - d / radius);
      }
      return malus;
    },
    size() {
      purge(nowMs());
      return zones.size;
    },
    reset() {
      zones.clear();
    },
  };
}
