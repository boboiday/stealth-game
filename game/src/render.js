// Drawing only: the world's state and the current screen in, pixels out.
// The 1280x720 playfield is scaled to fit the window and centred, the margin
// filled with the backdrop colour. Canvas shapes and text only — no images.
import { COLORS, FIELD, TUNING } from './config.js';
import { conePoints } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const PANEL = { width: 640, top: 120, line: 32, bottom: 64 };

function formatTime(seconds) {
  // A hair of epsilon: 120 steps of 1/60 accumulate to 1.9999999999999998, not 2.
  const total = Math.max(0, Math.floor(seconds + 0.000001));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.w, height / FIELD.h);
    view.x = (width - FIELD.w * view.scale) / 2;
    view.y = (height - FIELD.h * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight || ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function rect(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function drawFloor() {
    rect(0, 0, FIELD.w, FIELD.h, COLORS.floor);
    // Subtle checker of floor tiles.
    ctx.fillStyle = COLORS.floorAlt;
    for (let y = 0; y < FIELD.h; y += 80) {
      for (let x = ((y / 80) % 2) * 80; x < FIELD.w; x += 160) {
        ctx.fillRect(x, y, 80, 80);
      }
    }
    // Tile grid lines.
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 80; x < FIELD.w; x += 80) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.h);
    }
    for (let y = 80; y < FIELD.h; y += 80) {
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.w, y);
    }
    ctx.stroke();
    // Brass trim along the border wall.
    ctx.strokeStyle = COLORS.trim;
    ctx.lineWidth = 3;
    ctx.strokeRect(FIELD.wall - 1.5, FIELD.wall - 1.5, FIELD.w - 2 * FIELD.wall + 3, FIELD.h - 2 * FIELD.wall + 3);
  }

  function drawWalls(level) {
    for (const w of level.walls) {
      rect(w.x, w.y, w.w, w.h, COLORS.wall);
      rect(w.x, w.y, w.w, 4, COLORS.wallTop);
    }
    // Border wall: dark stone with a lighter top edge.
    rect(0, 0, FIELD.w, FIELD.wall, COLORS.wall);
    rect(0, FIELD.h - FIELD.wall, FIELD.w, FIELD.wall, COLORS.wall);
    rect(0, 0, FIELD.wall, FIELD.h, COLORS.wall);
    rect(FIELD.w - FIELD.wall, 0, FIELD.wall, FIELD.h, COLORS.wall);
    rect(0, FIELD.wall - 4, FIELD.w, 4, COLORS.wallTop);
  }

  function drawCases(level) {
    for (const c of level.cases) {
      rect(c.x, c.y, c.w, c.h, COLORS.caseFrame);
      rect(c.x + 4, c.y + 4, c.w - 8, c.h - 8, COLORS.caseGlass);
      ctx.strokeStyle = COLORS.caseGlint;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c.x + 10, c.y + c.h - 10);
      ctx.lineTo(c.x + c.w - 10, c.y + 10);
      ctx.stroke();
    }
  }

  function drawStatues(level) {
    for (const s of level.statues) {
      rect(s.x, s.y + s.h - 14, s.w, 14, COLORS.statueBase);
      ctx.fillStyle = COLORS.statue;
      ctx.beginPath();
      ctx.arc(s.x + s.w / 2, s.y + s.h / 2 - 4, 15, 0, Math.PI * 2);
      ctx.fill();
      rect(s.x + s.w / 2 - 9, s.y + s.h / 2 + 6, 18, 10, COLORS.statue);
    }
  }

  function drawCrates(level) {
    for (const c of level.crates) {
      rect(c.x, c.y, c.w, c.h, COLORS.crate);
      ctx.strokeStyle = COLORS.crateDark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(c.x + 3, c.y + 3);
      ctx.lineTo(c.x + c.w - 3, c.y + c.h - 3);
      ctx.moveTo(c.x + c.w - 3, c.y + 3);
      ctx.lineTo(c.x + 3, c.y + c.h - 3);
      ctx.stroke();
      ctx.strokeRect(c.x + 1.5, c.y + 1.5, c.w - 3, c.h - 3);
    }
  }

  function drawShadows(level) {
    ctx.fillStyle = COLORS.shadow;
    for (const s of level.shadows) ctx.fillRect(s.x, s.y, s.w, s.h);
  }

  function drawExit(state) {
    const e = state.level.exit;
    const open = state.exitOpen;
    const w = 40;
    const h = 52;
    const x = e.x - w / 2;
    const y = e.y - h / 2;
    if (open) {
      ctx.save();
      ctx.shadowColor = COLORS.exitOpen;
      ctx.shadowBlur = 24;
      rect(x, y, w, h, COLORS.exitOpen);
      ctx.restore();
      text('EXIT', e.x, e.y + 5, 13, '#0d2b14', 'center', 'bold');
    } else {
      rect(x, y, w, h, COLORS.exitLocked);
      rect(x + 4, y + 4, w - 8, h - 8, '#4b5563');
      // Padlock.
      ctx.strokeStyle = '#d7dae0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y - 2, 7, Math.PI, 0);
      ctx.stroke();
      rect(e.x - 8, e.y - 2, 16, 12, '#d7dae0');
    }
  }

  function drawSeals(state) {
    const t = state.time;
    for (const s of state.seals) {
      if (s.taken) continue;
      const pulse = 1 + 0.15 * Math.sin(t * 4 + s.x);
      const r = 11 * pulse;
      ctx.save();
      ctx.shadowColor = COLORS.seal;
      ctx.shadowBlur = 16;
      ctx.fillStyle = COLORS.sealGlow;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = COLORS.seal;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r);
      ctx.lineTo(s.x + r, s.y);
      ctx.lineTo(s.x, s.y + r);
      ctx.lineTo(s.x - r, s.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - r * 0.45);
      ctx.lineTo(s.x + r * 0.45, s.y);
      ctx.lineTo(s.x, s.y + r * 0.45);
      ctx.lineTo(s.x - r * 0.45, s.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawCones(state) {
    for (const g of state.guards) {
      const pts = conePoints(state, g);
      ctx.fillStyle = g.mode === 'chase' ? COLORS.coneHot : g.suspicion > 0.25 ? COLORS.coneWary : COLORS.coneCalm;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawGuards(state) {
    for (const g of state.guards) {
      // Body: navy circle with a brass helmet dot and a facing tick.
      ctx.fillStyle = COLORS.guard;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#0f1830';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = COLORS.guardHelm;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = COLORS.guardHelm;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(g.x + Math.cos(g.angle) * 12, g.y + Math.sin(g.angle) * 12);
      ctx.lineTo(g.x + Math.cos(g.angle) * 19, g.y + Math.sin(g.angle) * 19);
      ctx.stroke();
      // Suspicion arc over the head.
      if (g.suspicion > 0.03 && g.mode !== 'chase') {
        ctx.strokeStyle = g.suspicion > 0.6 ? '#e88228' : '#d4af37';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 19, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.suspicion);
        ctx.stroke();
      }
      if (g.mode === 'chase') {
        text('!', g.x, g.y - 24, 24, '#ff5a5a', 'center', 'bold');
      } else if (g.suspicion > 0.25) {
        text('?', g.x, g.y - 24, 24, '#f0a13a', 'center', 'bold');
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (p.moving) {
      // Fading noise ripple while moving: the louder the step, the wider the ring.
      const radius = p.sneaking ? TUNING.noiseSneak : TUNING.noiseWalk;
      const frac = 1 - p.stepAcc / 30;
      ctx.strokeStyle = `rgba(46, 196, 182, ${0.28 * frac + 0.06})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 16 + radius * (1 - frac), 0, Math.PI * 2);
      ctx.stroke();
    }
    if (p.sneaking) {
      ctx.strokeStyle = 'rgba(46, 196, 182, 0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 19, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Teal hooded dot with a facing tick.
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(p.x, p.y, TUNING.playerRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.playerDark;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = COLORS.playerDark;
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(
      FIELD.w / 2, FIELD.h / 2, FIELD.h * 0.42,
      FIELD.w / 2, FIELD.h / 2, FIELD.h * 0.78,
    );
    g.addColorStop(0, 'rgba(0, 0, 0, 0)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.w, FIELD.h);
  }

  function heatOf(state) {
    let heat = 0;
    let chasing = false;
    for (const g of state.guards) {
      if (g.suspicion > heat) heat = g.suspicion;
      if (g.mode === 'chase') chasing = true;
    }
    return { heat, chasing };
  }

  function drawHud(state) {
    const level = state.level;
    text(level.name, 28, 42, 26, COLORS.hudText, 'left', 'bold');
    text(level.hint, 28, 68, 16, COLORS.hudDim, 'left');
    // Seal diamonds + count.
    let sx = 28;
    for (let i = 0; i < state.seals.length; i += 1) {
      const taken = state.seals[i].taken;
      ctx.fillStyle = taken ? COLORS.seal : '#4a4458';
      ctx.beginPath();
      ctx.moveTo(sx + 8, 84);
      ctx.lineTo(sx + 16, 92);
      ctx.lineTo(sx + 8, 100);
      ctx.lineTo(sx, 92);
      ctx.closePath();
      ctx.fill();
      sx += 24;
    }
    text(`Seals ${state.sealsTaken}/${state.seals.length}`, sx + 8, 98, 18, COLORS.hudText, 'left');
    // Heat bar, top centre.
    const { heat, chasing } = heatOf(state);
    const label = chasing ? 'SPOTTED!' : heat > 0.25 ? 'SUSPICIOUS' : 'UNSEEN';
    const color = chasing ? '#ff5a5a' : heat > 0.25 ? '#f0a13a' : COLORS.player;
    text(label, FIELD.w / 2, 42, 22, color, 'center', 'bold');
    const barW = 220;
    const barX = FIELD.w / 2 - barW / 2;
    rect(barX, 52, barW, 8, '#1c1826');
    rect(barX, 52, barW * heat, 8, color);
    // Score, timer, lives — top right, kept clear of the level exits.
    text(`Score ${state.score}`, FIELD.w - 28, 42, 24, COLORS.hudText, 'right', 'bold');
    text(formatTime(state.time), FIELD.w - 28, 68, 18, COLORS.hudDim, 'right');
    text('Lives', FIELD.w - 28 - 3 * 22, 98, 18, COLORS.hudText, 'right');
    for (let i = 0; i < TUNING.lives; i += 1) {
      ctx.fillStyle = i < state.lives ? COLORS.player : '#3a3448';
      ctx.beginPath();
      ctx.arc(FIELD.w - 28 - i * 22 - 8, 92, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.w - PANEL.width) / 2;
    const y = (FIELD.h - height) / 2;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, FIELD.w, FIELD.h);
    ctx.fillStyle = COLORS.panel;
    ctx.fillRect(x, y, PANEL.width, height);
    ctx.strokeStyle = COLORS.panelBorder;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, PANEL.width - 2, height - 2);
    text(title, FIELD.w / 2, y + 72, 44, COLORS.hudText, 'center', 'bold');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.w / 2, y + PANEL.top + i * PANEL.line, 20, COLORS.hudDim, 'center');
    }
    text(prompt, FIELD.w / 2, y + height - 34, 22, COLORS.seal, 'center');
  }

  function drawField(state) {
    drawFloor();
    drawShadows(state.level);
    // Cones first, on the floor: cover and walls drawn after them occlude the
    // light, the way a real shadow would.
    drawCones(state);
    drawExit(state);
    drawSeals(state);
    drawCases(state.level);
    drawStatues(state.level);
    drawCrates(state.level);
    drawWalls(state.level);
    drawGuards(state);
    drawPlayer(state);
    drawVignette();
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, opts) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0b0912';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawField(state);
    if (screen === SCREEN_TITLE) {
      drawPanel(
        'THE QUIET GALLERY',
        [
          'Wren, night archivist of the Emberwick Museum,',
          'must recover the three relic seals in each gallery',
          'and slip out the service exit — unseen.',
          '',
          'Move: WASD / arrows, or click the floor. Hold SHIFT to sneak.',
          'Guards hear footsteps. Shadows hide you. The exit opens',
          'only once every seal is taken. M mutes the sound.',
          '',
          opts.best > 0 ? `Best score: ${opts.best}` : 'No best score yet — the museum is waiting.',
        ],
        'Press Space or click to begin',
      );
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The guards will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_CLEAR) {
      drawPanel(
        'GALLERY CLEARED',
        [
          `Score ${state.score} — seals, level, par and ghost bonuses.`,
          opts.clearNote || 'The next gallery is darker still.',
        ],
        'Press Space for the next gallery',
      );
    } else if (screen === SCREEN_WIN) {
      drawPanel(
        'NEVER SEEN',
        [
          'Every seal recovered. Every gallery crossed. No guard',
          'ever raised the alarm. The Emberwick Museum keeps',
          'its secrets — and so do you.',
          '',
          `Final score: ${state.score}`,
          opts.best > 0 ? `Best score: ${opts.best}` : '',
        ],
        'Press Space to play again',
      );
    } else if (screen === SCREEN_OVER) {
      drawPanel(
        'CAUGHT',
        [
          'The museum keeps its seals tonight.',
          `Score ${state.score} · Best ${opts.best}`,
        ],
        'Press Space or click to try again',
      );
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toField(clientX, clientY) {
    const rectBox = canvas.getBoundingClientRect();
    return {
      x: (clientX - rectBox.left - view.x / (window.devicePixelRatio || 1)) / (view.scale / (window.devicePixelRatio || 1)),
      y: (clientY - rectBox.top - view.y / (window.devicePixelRatio || 1)) / (view.scale / (window.devicePixelRatio || 1)),
    };
  } };
}
