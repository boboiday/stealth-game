// The screenshot scenes behind ?shot=start|play|alert|end&seed=1. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, so the
// frame is what a short game really looks like and the same seed always gives
// the same frame. The play scene is steered by an autopilot: head for the
// nearest untaken seal (then the exit), score nine candidate directions by
// distance-to-target after a short lookahead plus big penalties for stepping
// into a vision cone or close to a guard, flee when seen, wait when every way
// forward crosses a cone, and sidestep when stuck.
import { FIELD, TUNING } from './config.js';
import { EVENT_CAUGHT, EVENT_CLEAR, EVENT_OVER, guardSeesPoint } from './world.js';
import { SCREEN_CLEAR, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 16;
const STEP = 1 / 60;
const DIRS = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 0.7071, y: 0.7071 }, { x: 0.7071, y: -0.7071 },
  { x: -0.7071, y: 0.7071 }, { x: -0.7071, y: -0.7071 },
  { x: 0, y: 0 },
];

function pointBlocked(state, x, y, r) {
  if (x < FIELD.wall + r || x > FIELD.w - FIELD.wall - r || y < FIELD.wall + r || y > FIELD.h - FIELD.wall - r) return true;
  for (const s of state.solids) {
    if (x + r > s.x && x - r < s.x + s.w && y + r > s.y && y - r < s.y + s.h) return true;
  }
  return false;
}

function nearestTarget(state) {
  let best = null;
  let bestD = Infinity;
  for (const s of state.seals) {
    if (s.taken) continue;
    const d = Math.hypot(s.x - state.player.x, s.y - state.player.y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best || state.level.exit;
}

function createPilot() {
  let lastDist = Infinity;
  let stuckTimer = 0;
  let sideTimer = 0;
  let sideDir = 1;
  let lastBest = { x: 0, y: 0 };

  return function pilot(state) {
    const p = state.player;
    const target = nearestTarget(state);
    const distToTarget = Math.hypot(target.x - p.x, target.y - p.y);

    // Flee: chased, or standing in a cone with suspicion rising.
    let threat = null;
    let threatD = Infinity;
    for (const g of state.guards) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (g.mode === 'chase' || guardSeesPoint(state, g, p.x, p.y)) {
        if (d < threatD) {
          threatD = d;
          threat = g;
        }
      }
    }
    if (threat) {
      const dx = p.x - threat.x;
      const dy = p.y - threat.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: dx / len, y: dy / len, sneak: false };
    }

    // Sidestep while stuck: no progress toward the target for ~1.5s.
    if (distToTarget < lastDist - 2) {
      lastDist = distToTarget;
      stuckTimer = 0;
    } else {
      stuckTimer += STEP;
    }
    if (stuckTimer > 1.5 && sideTimer <= 0) {
      sideTimer = 0.8;
      sideDir = -sideDir;
      stuckTimer = 0;
    }
    if (sideTimer > 0) {
      sideTimer -= STEP;
      const bx = lastBest.x;
      const by = lastBest.y;
      const px = -by * sideDir;
      const py = bx * sideDir;
      if (bx !== 0 || by !== 0) return { x: px, y: py, sneak: true };
    }

    // Score nine candidate directions.
    const lookahead = Math.min(60, Math.max(12, distToTarget));
    let nearestGuard = Infinity;
    for (const g of state.guards) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < nearestGuard) nearestGuard = d;
    }
    let best = null;
    let bestScore = Infinity;
    for (const dir of DIRS) {
      const px = p.x + dir.x * lookahead;
      const py = p.y + dir.y * lookahead;
      let score = Math.hypot(target.x - px, target.y - py);
      if (pointBlocked(state, px, py, TUNING.playerRadius)) score += 500;
      for (const g of state.guards) {
        if (guardSeesPoint(state, g, px, py)) score += 600;
        const gd = Math.hypot(g.x - px, g.y - py);
        if (gd < 70) score += (70 - gd) * 6;
      }
      if (dir.x === 0 && dir.y === 0) score += 1; // prefer moving when tied
      if (score < bestScore) {
        bestScore = score;
        best = dir;
      }
    }
    lastBest = best;
    lastDist = Math.min(lastDist, distToTarget);
    return { x: best.x, y: best.y, sneak: nearestGuard < 240 };
  };
}

function runPilot(world, seconds) {
  const pilot = createPilot();
  const steps = Math.round(seconds / STEP);
  let events = 0;
  for (let i = 0; i < steps; i += 1) {
    events = world.step(STEP, pilot(world.state));
    if (events & EVENT_CLEAR) break;
    if (events & EVENT_OVER) break;
    if (events & EVENT_CAUGHT) {
      // Level reloaded inside the world; the pilot's stuck tracking restarts.
      pilot(world.state);
    }
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, alert or end) and return the
 * screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.resetGame();
  if (name === 'play') {
    runPilot(world, PLAY_SECONDS);
    return { screen: world.state.over ? 'over' : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'alert') {
    // Two seconds of patrol, then freeze the player at the edge of guard 0's
    // cone with its suspicion nearly full: a near miss, SUSPICIOUS, orange cone.
    for (let i = 0; i < 2 / STEP; i += 1) world.step(STEP, { x: 0, y: 0, sneak: false });
    const state = world.state;
    const g = state.guards[0];
    let placed = false;
    for (let off = 20; off <= 60 && !placed; off += 10) {
      for (const sign of [1, -1]) {
        const a = g.angle + (off * Math.PI / 180) * sign;
        const px = g.x + Math.cos(a) * 185;
        const py = g.y + Math.sin(a) * 185;
        if (!pointBlocked(state, px, py, TUNING.playerRadius) && guardSeesPoint(state, g, px, py)) {
          state.player.x = px;
          state.player.y = py;
          state.player.angle = Math.atan2(g.y - py, g.x - px);
          state.player.sneaking = true;
          g.suspicion = 0.86;
          placed = true;
          break;
        }
      }
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'end') {
    // Staged payoff: every seal taken, exit open, the player walks into the
    // exit and the GALLERY CLEARED panel shows. Ghost + par hold, so the
    // score lands at 300 seals + 250 level + 250 par + 400 ghost = 1200.
    const state = world.state;
    for (const s of state.seals) s.taken = true;
    state.sealsTaken = state.seals.length;
    state.score = 300;
    state.exitOpen = true;
    state.time = 20;
    state.player.x = state.level.exit.x - 70;
    state.player.y = state.level.exit.y;
    const pilot = createPilot();
    for (let i = 0; i < 5 / STEP; i += 1) {
      const events = world.step(STEP, pilot(state));
      if (events & EVENT_CLEAR) break;
    }
    return { screen: SCREEN_CLEAR, best: state.score };
  }
  // start (and any unknown name): five seconds of harmless patrol under the title.
  for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0, sneak: false });
  return { screen: SCREEN_TITLE, best: 0 };
}
