// Generische Waypoint-Hilfsfunktionen für Bot-Navigation.
// Unabhängig von Three.js, arbeitet rein auf {x,z,tags}-Objekten.
// Keine Imports — nur reine Funktionen (gleicher Stil wie norm/rotate in botAI.js).

'use strict';

function distTo(self, point) {
  const dx = point.x - self.x, dz = point.z - self.z;
  return Math.hypot(dx, dz);
}

function vectorTo(self, point) {
  const dx = point.x - self.x, dz = point.z - self.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return { x: 0, z: 0 };
  return { x: dx / d, z: dz / d };
}

export function isAtWaypoint(self, wp, tolerance = 0.6) {
  if (!wp) return false;
  return distTo(self, wp) <= tolerance;
}

export function pickWaypoint(self, world, opts = {}) {
  if (!world?.map?.waypoints?.length) return null;

  const {
    excludeId,
    avoidTags,
    preferTags,
    avoidDirection,
    randomness = 0,
  } = opts;

  let candidates = world.map.waypoints;

  // Filter avoidTags
  if (avoidTags?.length) {
    candidates = candidates.filter(wp =>
      !avoidTags.some(tag => wp.tags?.includes(tag))
    );
  }
  if (!candidates.length) return null;

  // Exclude current waypoint
  if (excludeId) {
    candidates = candidates.filter(wp => wp.id !== excludeId);
  }
  if (!candidates.length) return null;

  // Distance-weighted picker: closer (but not tiny) weighted higher
  const scored = candidates.map(wp => {
    const d = distTo(self, wp);
    // Weight: closer = higher weight, but avoid zero distance
    // Formula: 1 / (1 + d_normalized), normalized by a typical roam distance ~4
    const normalized = Math.max(0.1, d / 4);
    const weight = 1 / (1 + normalized);

    // Bonus if preferTag matches (when randomness < 1)
    let bonus = 0;
    if (preferTags?.length && wp.tags) {
      if (preferTags.some(tag => wp.tags.includes(tag))) {
        bonus = 0.3; // Prefer but don't exclude non-preferred
      }
    }

    return { wp, d, weight: weight + bonus };
  });

  // Decide: prefer-bucket or all?
  let chosen;
  if (preferTags?.length && Math.random() > randomness) {
    // Try to pick from preferTag bucket
    const preferred = scored.filter(s =>
      s.wp.tags && preferTags.some(tag => s.wp.tags.includes(tag))
    );
    if (preferred.length) {
      chosen = weightedPick(preferred);
    } else {
      chosen = weightedPick(scored);
    }
  } else {
    chosen = weightedPick(scored);
  }

  // avoidDirection: filter by dot product if provided
  if (avoidDirection && chosen) {
    const candFiltered = scored.filter(s => {
      const vec = vectorTo(self, s.wp);
      const dot =
        vec.x * avoidDirection.x + vec.z * avoidDirection.z;
      return dot > -0.3; // Allow slight backward, but prefer away
    });
    if (candFiltered.length) {
      chosen = weightedPick(candFiltered);
    }
  }

  return chosen?.wp || null;
}

export function nearestWaypoint(self, world, opts = {}) {
  if (!world?.map?.waypoints?.length) return null;

  const { avoidTags, preferTags } = opts;

  let candidates = world.map.waypoints;

  if (avoidTags?.length) {
    candidates = candidates.filter(wp =>
      !avoidTags.some(tag => wp.tags?.includes(tag))
    );
  }
  if (!candidates.length) return null;

  // Prefer preferTags bucket if any
  let best;
  if (preferTags?.length) {
    const preferred = candidates.filter(wp =>
      wp.tags && preferTags.some(tag => wp.tags.includes(tag))
    );
    if (preferred.length) {
      best = preferred.reduce((a, b) =>
        distTo(self, a) < distTo(self, b) ? a : b
      );
    } else {
      best = candidates.reduce((a, b) =>
        distTo(self, a) < distTo(self, b) ? a : b
      );
    }
  } else {
    best = candidates.reduce((a, b) =>
      distTo(self, a) < distTo(self, b) ? a : b
    );
  }

  return best;
}

// ─── Internal helpers ────────────────────────────────────────────────

function weightedPick(scored) {
  if (!scored.length) return null;
  if (scored.length === 1) return scored[0];

  // Normalize weights to [0,1], then pick proportional to weight
  const totalWeight = scored.reduce((s, x) => s + x.weight, 0);
  if (totalWeight <= 0) return scored[Math.floor(Math.random() * scored.length)];

  let r = Math.random() * totalWeight;
  for (const s of scored) {
    r -= s.weight;
    if (r <= 0) return s;
  }
  return scored[scored.length - 1];
}
