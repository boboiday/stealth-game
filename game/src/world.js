// The game's rules and state, with no drawing and no browser in it: the player,
// the guards and their suspicion / chase / investigate AI, seals, the exit, noise,
// shadows, lives and score. step() advances one fixed 1/60s step and returns what
// happened as bit flags, so the caller can react without the world knowing about
// screens or sound. Nothing here allocates after createWorld returns.
import { FIELD, LEVELS, TUNING } from './config.js';

export const EVENT_SEAL = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_CLEAR = 8;
export const EVENT_STEP = 16;
export const EVENT_EXIT_OPEN = 32;
export const EVENT_OVER = 64;

const CONE_HALF = (TUNING.coneHalfDeg * Math.PI) / 180;
const CONE_RAYS = 9;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** Every solid rectangle of a level: walls, cases, statues, crates. */
export function obstacles(level) {
  return level.walls.concat(level.cases, level.statues, level.crates);
}

function pointInRects(x, y, rects) {
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}

/** Line of sight between two points, sampled every ~8px; walls and cover block it. */
export function losClear(state, x1, y1, x2, y2) {
  const rects = state.solids;
  const d = dist(x1, y1, x2, y2);
  const steps = Math.max(1, Math.ceil(d / 8));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (pointInRects(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, rects)) return false;
  }
  return true;
}

export function inShadow(state, x, y) {
  const shadows = state.level.shadows;
  for (let i = 0; i < shadows.length; i += 1) {
    const s = shadows[i];
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
  }
  return false;
}

/**
 * Does this guard see the point (px, py)? A point inside the vision cone with a
 * clear line of sight, or a point the guard bumps into (within bumpDist, any angle).
 */
export function guardSeesPoint(state, guard, px, py) {
  const d = dist(guard.x, guard.y, px, py);
  if (d > TUNING.coneRange) return false;
  if (d < TUNING.bumpDist) return losClear(state, guard.x, guard.y, px, py);
  const ang = Math.atan2(py - guard.y, px - guard.x);
  if (angleDiff(ang, guard.angle) > CONE_HALF) return false;
  return losClear(state, guard.x, guard.y, px, py);
}

/** The vision cone as a polygon, each ray clipped at the first wall it meets. */
export function conePoints(state, guard) {
  const pts = [{ x: guard.x, y: guard.y }];
  for (let i = 0; i < CONE_RAYS; i += 1) {
    const a = guard.angle - CONE_HALF + (2 * CONE_HALF * i) / (CONE_RAYS - 1);
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let reach = TUNING.coneRange;
    for (let d = 8; d <= TUNING.coneRange; d += 8) {
      const x = guard.x + dx * d;
      const y = guard.y + dy * d;
      if (x < FIELD.wall || x > FIELD.w - FIELD.wall || y < FIELD.wall || y > FIELD.h - FIELD.wall) {
        reach = d;
        break;
      }
      if (pointInRects(x, y, state.solids)) {
        reach = d;
        break;
      }
    }
    pts.push({ x: guard.x + dx * reach, y: guard.y + dy * reach });
  }
  return pts;
}

// Move a circle (radius r) by (dx, dy), sliding along solid rects and the border wall.
function moveCircle(state, obj, dx, dy, r) {
  const solids = state.solids;
  const minX = FIELD.wall + r;
  const maxX = FIELD.w - FIELD.wall - r;
  const minY = FIELD.wall + r;
  const maxY = FIELD.h - FIELD.wall - r;
  let nx = Math.min(maxX, Math.max(minX, obj.x + dx));
  for (let i = 0; i < solids.length; i += 1) {
    const s = solids[i];
    if (nx + r > s.x && nx - r < s.x + s.w && obj.y + r > s.y && obj.y - r < s.y + s.h) {
      nx = dx > 0 ? s.x - r : s.x + s.w + r;
    }
  }
  obj.x = nx;
  let ny = Math.min(maxY, Math.max(minY, obj.y + dy));
  for (let i = 0; i < solids.length; i += 1) {
    const s = solids[i];
    if (obj.x + r > s.x && obj.x - r < s.x + s.w && ny + r > s.y && ny - r < s.y + s.h) {
      ny = dy > 0 ? s.y - r : s.y + s.h + r;
    }
  }
  obj.y = ny;
}

function makeGuard(spec) {
  return {
    x: spec.a.x,
    y: spec.a.y,
    ax: spec.a.x,
    ay: spec.a.y,
    bx: spec.b.x,
    by: spec.b.y,
    speed: spec.speed,
    toB: true,
    pause: 0,
    angle: Math.atan2(spec.b.y - spec.a.y, spec.b.x - spec.a.x),
    suspicion: 0,
    mode: 'patrol',
    lastX: spec.a.x,
    lastY: spec.a.y,
    loseTimer: 0,
    lookTimer: 0,
    investX: 0,
    investY: 0,
    noiseCooldown: 0,
  };
}

export function createWorld(levelIndex) {
  const state = {
    levelIndex: 0,
    level: LEVELS[0],
    solids: [],
    time: 0,
    score: 0,
    scoreAtLevelStart: 0,
    lives: TUNING.lives,
    spotted: false,
    seals: [],
    sealsTaken: 0,
    exitOpen: false,
    player: { x: 0, y: 0, angle: 0, moving: false, sneaking: false, stepAcc: 0, ripple: 0 },
    guards: [],
    nearestGuard: 9999,
    over: false,
  };

  function loadLevel(index) {
    state.levelIndex = index;
    state.level = LEVELS[index];
    state.solids = obstacles(state.level);
    state.time = 0;
    state.scoreAtLevelStart = state.score;
    state.spotted = false;
    state.seals = state.level.seals.map((s) => ({ x: s.x, y: s.y, taken: false }));
    state.sealsTaken = 0;
    state.exitOpen = false;
    state.player.x = state.level.start.x;
    state.player.y = state.level.start.y;
    state.player.angle = 0;
    state.player.moving = false;
    state.player.sneaking = false;
    state.player.stepAcc = 0;
    state.player.ripple = 0;
    state.guards = state.level.guards.map(makeGuard);
    state.nearestGuard = 9999;
  }

  function resetGame() {
    state.score = 0;
    state.lives = TUNING.lives;
    state.over = false;
    loadLevel(0);
  }

  function moveGuardToward(guard, tx, ty, speed, dt) {
    const d = dist(guard.x, guard.y, tx, ty);
    if (d < 2) return true;
    const stepLen = Math.min(d, speed * dt);
    const ox = guard.x;
    const oy = guard.y;
    moveCircle(state, guard, ((tx - guard.x) / d) * stepLen, ((ty - guard.y) / d) * stepLen, 12);
    const moved = dist(ox, oy, guard.x, guard.y);
    if (moved > 0.01) guard.angle = Math.atan2(guard.y - oy, guard.x - ox);
    return moved < stepLen * 0.5;
  }

  /**
   * One fixed step. `input` is {x, y, sneak}: a steering vector of length 0..1.
   * Returns bit flags of what happened this step.
   */
  function step(dt, input) {
    let events = 0;
    if (state.over) return events;
    state.time += dt;
    const p = state.player;

    // --- player ---
    const speed = input.sneak ? TUNING.sneakSpeed : TUNING.walkSpeed;
    const mx = input.x * speed * dt;
    const my = input.y * speed * dt;
    const ox = p.x;
    const oy = p.y;
    moveCircle(state, p, mx, my, TUNING.playerRadius);
    const moved = dist(ox, oy, p.x, p.y);
    p.moving = moved > 0.01;
    p.sneaking = !!input.sneak;
    if (p.moving) {
      p.angle = Math.atan2(p.y - oy, p.x - ox);
      p.stepAcc += moved;
      p.ripple = Math.min(1, p.ripple + dt * 2);
      if (p.stepAcc >= 30) {
        p.stepAcc = 0;
        events |= EVENT_STEP;
      }
    } else {
      p.ripple = Math.max(0, p.ripple - dt * 2);
    }

    // --- noise: a moving player draws patrolling guards in to look ---
    const noiseRadius = p.sneaking ? TUNING.noiseSneak : TUNING.noiseWalk;
    if (p.moving) {
      for (const g of state.guards) {
        if (g.mode !== 'patrol' || g.noiseCooldown > 0) continue;
        if (dist(g.x, g.y, p.x, p.y) < noiseRadius) {
          g.mode = 'investigate';
          g.investX = p.x;
          g.investY = p.y;
          g.lookTimer = 0;
          g.noiseCooldown = 2.5;
        }
      }
    }

    // --- guards ---
    state.nearestGuard = 9999;
    for (const g of state.guards) {
      if (g.noiseCooldown > 0) g.noiseCooldown -= dt;
      const dPlayer = dist(g.x, g.y, p.x, p.y);
      if (dPlayer < state.nearestGuard) state.nearestGuard = dPlayer;
      const sees = guardSeesPoint(state, g, p.x, p.y);

      if (g.mode === 'patrol' || g.mode === 'investigate' || g.mode === 'search') {
        if (sees) {
          g.lastX = p.x;
          g.lastY = p.y;
          let rate = TUNING.suspicionBase + TUNING.suspicionClose * (1 - dPlayer / TUNING.coneRange);
          if (p.sneaking) rate *= TUNING.sneakFactor;
          if (inShadow(state, p.x, p.y)) rate *= TUNING.shadowFactor;
          g.suspicion = Math.min(1, g.suspicion + rate * dt);
          if (g.suspicion >= 1) {
            g.mode = 'chase';
            g.loseTimer = 0;
            state.spotted = true;
            events |= EVENT_SPOTTED;
          }
        } else {
          g.suspicion = Math.max(0, g.suspicion - TUNING.suspicionDecay * dt);
        }
      }

      if (g.mode === 'patrol') {
        if (g.pause > 0) {
          g.pause -= dt;
        } else {
          const tx = g.toB ? g.bx : g.ax;
          const ty = g.toB ? g.by : g.ay;
          const blocked = moveGuardToward(g, tx, ty, g.speed, dt);
          if (dist(g.x, g.y, tx, ty) < 3 || blocked) {
            g.toB = !g.toB;
            g.pause = TUNING.guardPause;
          }
        }
      } else if (g.mode === 'investigate') {
        if (dist(g.x, g.y, g.investX, g.investY) < 6) {
          g.lookTimer += dt;
          g.angle += dt * 1.4; // scan the room
          if (g.lookTimer >= TUNING.investigateTime) g.mode = 'patrol';
        } else {
          const blocked = moveGuardToward(g, g.investX, g.investY, g.speed * 1.25, dt);
          if (blocked) {
            g.lookTimer += dt;
            if (g.lookTimer >= TUNING.investigateTime) g.mode = 'patrol';
          }
        }
      } else if (g.mode === 'chase') {
        if (sees) {
          g.lastX = p.x;
          g.lastY = p.y;
          g.loseTimer = 0;
        } else {
          g.loseTimer += dt;
          if (g.loseTimer >= TUNING.loseSightTime) {
            g.mode = 'search';
            g.lookTimer = 0;
            g.suspicion = 0.6;
          }
        }
        moveGuardToward(g, p.x, p.y, TUNING.chaseSpeed, dt);
        if (dist(g.x, g.y, p.x, p.y) < TUNING.catchDist) {
          state.lives -= 1;
          events |= EVENT_CAUGHT;
          if (state.lives <= 0) {
            state.over = true;
            events |= EVENT_OVER;
          } else {
            state.score = state.scoreAtLevelStart;
            loadLevel(state.levelIndex);
          }
          return events;
        }
      } else if (g.mode === 'search') {
        if (sees) {
          g.mode = 'chase';
          g.loseTimer = 0;
          state.spotted = true;
          events |= EVENT_SPOTTED;
        } else if (dist(g.x, g.y, g.lastX, g.lastY) < 6) {
          g.lookTimer += dt;
          g.angle += dt * 1.6;
          if (g.lookTimer >= TUNING.searchTime) {
            g.mode = 'patrol';
            g.suspicion = 0;
          }
        } else {
          const blocked = moveGuardToward(g, g.lastX, g.lastY, g.speed * 1.25, dt);
          if (blocked) {
            g.lookTimer += dt;
            if (g.lookTimer >= TUNING.searchTime) {
              g.mode = 'patrol';
              g.suspicion = 0;
            }
          }
        }
      }
    }

    // --- seals ---
    for (const s of state.seals) {
      if (!s.taken && dist(p.x, p.y, s.x, s.y) < TUNING.sealPickupDist) {
        s.taken = true;
        state.sealsTaken += 1;
        state.score += TUNING.sealScore;
        events |= EVENT_SEAL;
        if (state.sealsTaken === state.seals.length) {
          state.exitOpen = true;
          events |= EVENT_EXIT_OPEN;
        }
      }
    }

    // --- exit ---
    if (state.exitOpen && dist(p.x, p.y, state.level.exit.x, state.level.exit.y) < TUNING.exitReachDist) {
      state.score += TUNING.levelScore;
      if (state.time < TUNING.parSeconds) state.score += TUNING.parBonus;
      if (!state.spotted) state.score += TUNING.ghostBonus;
      events |= EVENT_CLEAR;
    }
    return events;
  }

  resetGame();
  return { state, loadLevel, resetGame, step };
}
