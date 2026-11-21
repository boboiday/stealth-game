// Synthesised sound only (WebAudio oscillators, no audio files): footsteps,
// pickup chime, spotted sting, caught thud, level-clear jingle, win arpeggio
// and the exit-opening click. The context is created lazily on the first
// gesture; M toggles mute. Every call is a no-op until then, so headless
// screenshot runs (no gesture, no audio) never throw.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let master = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when, slideTo) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime + (when || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Audio must never break the game.
    }
  }

  return {
    /** Call from any user gesture so the context is allowed to start. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** A soft tick; louder when a guard is close. */
    step(near) {
      if (!ensure()) return;
      tone(near ? 240 : 180, 0.05, 'triangle', near ? 0.16 : 0.07);
    },
    pickup() {
      if (!ensure()) return;
      tone(660, 0.14, 'sine', 0.2);
      tone(990, 0.2, 'sine', 0.18, 0.07);
    },
    exitOpen() {
      if (!ensure()) return;
      tone(520, 0.1, 'square', 0.08);
      tone(780, 0.16, 'square', 0.08, 0.09);
    },
    spotted() {
      if (!ensure()) return;
      tone(220, 0.35, 'sawtooth', 0.22, 0, 110);
      tone(233, 0.35, 'sawtooth', 0.16, 0.02, 116);
    },
    caught() {
      if (!ensure()) return;
      tone(160, 0.5, 'sawtooth', 0.25, 0, 55);
      tone(90, 0.5, 'triangle', 0.2, 0.05, 45);
    },
    clear() {
      if (!ensure()) return;
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'sine', 0.18, i * 0.09));
    },
    win() {
      if (!ensure()) return;
      [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'sine', 0.18, i * 0.11));
    },
  };
}
