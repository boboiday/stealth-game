// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. Six screens: title, play, paused, gallery cleared,
// never seen (win) and caught (game over).
//
// ?seed=N fixes the shot scenes' guard offsets. ?shot=start|play|alert|end
// (with &seed=N) stages that scene instead of running the loop, paints it and
// sets window.__shotReady for a screenshot.
import { LEVELS, TUNING } from './config.js';
import { mulberry32 } from './random.js';
import {
  createWorld,
  EVENT_CAUGHT,
  EVENT_CLEAR,
  EVENT_EXIT_OPEN,
  EVENT_OVER,
  EVENT_SEAL,
  EVENT_SPOTTED,
  EVENT_STEP,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_CLEAR,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;
const STEP = 1 / 60;
const BEST_KEY = 'quiet-gallery.best';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(0);
const renderer = createRenderer(canvas);
const audio = createAudio();
void mulberry32(seed); // the seed is reserved for shot staging; the rules need no RNG.

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  renderer.draw(world.state, scene.screen, { best: scene.best });
  window.__shotReady = true;
}

function runGame() {
  const input = createInput(canvas, (x, y) => renderer.toField(x, y));
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let clearNote = '';

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.resetGame();
    input.clearClickTarget();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${TUNING.lives} lives. Recover three seals, then reach the exit unseen.`);
  }

  function nextLevel() {
    world.loadLevel(world.state.levelIndex + 1);
    input.clearClickTarget();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing ${world.state.level.name}.`);
  }

  function finishLevel() {
    const lastLevel = world.state.levelIndex >= LEVELS.length - 1;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (lastLevel) {
      audio.win();
      screen = SCREEN_WIN;
      announce(`Never seen. Final score ${world.state.score}. Best ${best}.`);
    } else {
      audio.clear();
      clearNote = world.state.spotted
        ? 'Spotted once — the ghost bonus slipped away.'
        : 'Ghost bonus: never spotted. The next gallery is darker still.';
      screen = SCREEN_CLEAR;
      announce(`Gallery cleared. Score ${world.state.score}. Press Space for the next gallery.`);
    }
  }

  function endGame() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    screen = SCREEN_OVER;
    announce(`Caught. Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) {
      audio.unlock();
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_CLEAR) nextLevel();
      else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    }
  }

  function handleEvents(events) {
    if (events & EVENT_STEP) audio.step(world.state.nearestGuard < 120);
    if (events & EVENT_SEAL) {
      audio.pickup();
      announce(`Seal ${world.state.sealsTaken} of ${world.state.seals.length} taken.`);
    }
    if (events & EVENT_EXIT_OPEN) {
      audio.exitOpen();
      announce('All seals taken. The exit is open.');
    }
    if (events & EVENT_SPOTTED) {
      audio.spotted();
      announce('Spotted! Break line of sight!');
    }
    if (events & EVENT_CAUGHT) {
      audio.caught();
      if (world.state.lives > 0) announce(`Caught! ${world.state.lives} ${world.state.lives === 1 ? 'life' : 'lives'} left. The gallery resets.`);
    }
    if (events & EVENT_CLEAR) finishLevel();
    if (events & EVENT_OVER) endGame();
  }

  function step() {
    const events = world.step(STEP, input.steering(world.state.player));
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE) {
      // The title screen's backdrop: guards patrol, nothing scores.
      while (accumulator >= STEP) {
        world.step(STEP, { x: 0, y: 0, sneak: false });
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, { best, clearNote });
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // For headless playtests: the CDP drivers read the state and the screen.
  window.__game = {
    state: world.state,
    screen() {
      return screen;
    },
  };
  announce('The Quiet Gallery. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
