const KEY = "race-sound";

let context = null;
let master = null;

export function soundEnabled() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* storage unavailable */
  }
}

function audio() {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!context) {
    context = new Ctor();
    // A gentle limiter so a volley of fireworks never clips or distorts.
    master = context.createDynamicsCompressor();
    master.threshold.value = -18;
    master.knee.value = 24;
    master.ratio.value = 6;
    master.attack.value = 0.003;
    master.release.value = 0.25;
    master.connect(context.destination);
  }
  if (context.state === "suspended") context.resume().catch(() => {});
  return context;
}

export function unlockAudio() {
  audio();
}

// Browsers keep audio muted until the visitor interacts with the page. After a reload the race page
// may show fireworks before any click, so the first click, tap or key press switches sound on.
if (typeof window !== "undefined") {
  const unlockOnce = () => {
    audio();
    for (const type of ["pointerdown", "keydown", "touchstart"]) window.removeEventListener(type, unlockOnce, true);
  };
  for (const type of ["pointerdown", "keydown", "touchstart"]) window.addEventListener(type, unlockOnce, { capture: true, passive: true });
}

// Where a sound enters the mix: straight into the limiter, or through a stereo panner (-1 left, 1 right).
function destination(ctx, pan) {
  if (!pan || typeof ctx.createStereoPanner !== "function") return master;
  const panner = ctx.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  panner.connect(master);
  return panner;
}

function tone(freq, duration, { type = "sine", gain = 0.12, delay = 0, slide = 0, attack = 0.015, pan = 0 } = {}) {
  const ctx = audio();
  if (!ctx || !soundEnabled()) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + attack);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(destination(ctx, pan));
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// Filtered noise. `endFrequency` sweeps the filter, `decay` shapes how fast the sound dies away.
function noise(duration, { gain = 0.08, delay = 0, frequency = 1800, endFrequency = 0, q = 0.7, type = "bandpass", decay = 1, pan = 0 } = {}) {
  const ctx = audio();
  if (!ctx || !soundEnabled()) return;
  const start = ctx.currentTime + delay;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, decay);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, start);
  if (endFrequency) filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), start + duration);
  filter.Q.value = q;
  const amp = ctx.createGain();
  amp.gain.value = gain;
  source.connect(filter).connect(amp).connect(destination(ctx, pan));
  source.start(start);
}

// A soft bell: a pure tone with two quiet, quickly fading overtones. Gentle attack, long smooth tail.
function bell(freq, duration, gain, delay = 0, pan = 0) {
  tone(freq, duration, { gain, delay, attack: 0.008, pan });
  tone(freq * 2, duration * 0.55, { gain: gain * 0.3, delay, attack: 0.008, pan });
  tone(freq * 3, duration * 0.3, { gain: gain * 0.1, delay, attack: 0.008, pan });
}

// A major pentatonic scale, so any notes that overlap during a big volley always sound consonant.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98];
const pickNote = (room = 0) => Math.floor(Math.random() * (SCALE.length - room));

// Tiny, quiet high sparkles that glitter after a burst, like the sparks themselves.
function twinkles(count, spread, gain, pan = 0) {
  for (let i = 0; i < count; i += 1) {
    const freq = SCALE[Math.floor(Math.random() * SCALE.length)] * (Math.random() < 0.5 ? 2 : 4);
    tone(freq, 0.14 + Math.random() * 0.14, { gain: gain * (0.5 + Math.random() * 0.5), delay: 0.08 + Math.random() * spread, attack: 0.006, pan: pan * 0.8 });
  }
}

// Lets a sound through at most `max` times per `gap` ms, so crowded moments stay clear while a
// deliberate group (like three shells going off together) is still heard in full.
const lastPlayed = {};
function gate(name, gap, max = 1) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const recent = (lastPlayed[name] || []).filter((time) => now - time < gap);
  if (recent.length >= max) {
    lastPlayed[name] = recent;
    return false;
  }
  recent.push(now);
  lastPlayed[name] = recent;
  return true;
}

// Fireworks are the celebration, so they sit a little above the other effects in the mix.
const FIREWORK_VOLUME = 1.7;

export const sfx = {
  tick() {
    tone(660, 0.12, { type: "square", gain: 0.06 });
  },
  go() {
    tone(990, 0.35, { type: "square", gain: 0.08 });
    tone(1320, 0.35, { type: "sine", gain: 0.05, delay: 0.02 });
  },
  lead() {
    tone(520, 0.1, { type: "triangle", gain: 0.06 });
    tone(780, 0.12, { type: "triangle", gain: 0.06, delay: 0.08 });
  },
  surge() {
    tone(300, 0.25, { type: "sawtooth", gain: 0.03, slide: 500 });
  },
  cheer() {
    noise(0.6, { gain: 0.12, frequency: 1400 });
    tone(880, 0.08, { type: "triangle", gain: 0.04, delay: 0.05 });
  },
  finish() {
    [523, 659, 784, 1046].forEach((freq, index) => tone(freq, 0.28, { type: "triangle", gain: 0.09, delay: index * 0.12 }));
    noise(1.4, { gain: 0.14, delay: 0.3, frequency: 1200 });
  },
  // A rocket leaving the ground: a very soft, airy breath that rises gently. `pan` is -1 (left) to 1 (right).
  rocket(pan = 0) {
    if (!gate("rocket", 120)) return;
    noise(0.7, { gain: 0.03, frequency: 420, endFrequency: 2200, q: 0.6, decay: 0.8, pan });
    tone(300, 0.7, { gain: 0.012, slide: 700, attack: 0.1, pan });
  },
  // The shell bursting, made to be easy on the ear: a soft low "puff", then a warm bell note that
  // fades slowly, and a few faint sparkles. Every kind of shell gets its own little melody.
  boom(power = 1, kind = 0, pan = 0) {
    // Up to three at once (the winner's name salvo), otherwise one every ~110 ms.
    if (!gate("boom", 110, 3)) return;
    const level = Math.min(1.2, Math.max(0.3, power)) * FIREWORK_VOLUME;
    tone(88 + Math.random() * 24, 0.5, { gain: 0.07 * level, slide: -26, attack: 0.03, pan });
    noise(0.3, { gain: 0.028 * level, frequency: 480, type: "lowpass", decay: 2.4, pan });
    const note = pickNote(3);
    const gain = 0.05 * level;
    if (kind === 0) {
      // Peony: a full, round chord.
      bell(SCALE[note], 1.7, gain, 0, pan);
      bell(SCALE[note + 2], 1.5, gain * 0.7, 0.02, pan);
      twinkles(6, 0.9, 0.018 * level, pan);
    } else if (kind === 1) {
      // Double ring: two notes climbing.
      bell(SCALE[note], 1.4, gain, 0, pan);
      bell(SCALE[note + 1], 1.4, gain * 0.8, 0.1, pan);
      twinkles(3, 0.5, 0.016 * level, pan);
    } else if (kind === 2) {
      // Willow: a slow, drooping run of notes, like the golden sparks falling.
      const low = Math.max(note, 2);
      [0, 1, 2].forEach((step) => bell(SCALE[low - step], 2.1 - step * 0.2, gain * (1 - step * 0.22), step * 0.2, pan));
      twinkles(8, 1.5, 0.013 * level, pan);
    } else if (kind === 3) {
      // Heart or star: a bright, tiny arpeggio.
      [0, 1, 2].forEach((step) => bell(SCALE[note + step], 1.2, gain * 0.85, step * 0.075, pan));
      twinkles(4, 0.6, 0.016 * level, pan);
    } else {
      // Crossette: one short, clear note and quick glitter.
      bell(SCALE[note], 0.9, gain, 0, pan);
      twinkles(5, 0.5, 0.02 * level, pan);
    }
  },
  // The crossette's streaks splitting into four: a tiny, soft chime.
  split(pan = 0) {
    if (!gate("split", 70)) return;
    tone(SCALE[pickNote()] * 4, 0.12, { gain: 0.018, attack: 0.004, pan });
  },
  // Sparks gathering into the winner's name: a rising, twinkling run of bells.
  shimmer() {
    [1046.5, 1318.51, 1567.98, 1975.53, 2349.32].forEach((freq, index) => bell(freq, 1.1, 0.04, index * 0.11));
  },
};
