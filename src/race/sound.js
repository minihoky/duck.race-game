const KEY = "race-sound";

let context = null;

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
  if (!context) context = new Ctor();
  if (context.state === "suspended") context.resume().catch(() => {});
  return context;
}

export function unlockAudio() {
  audio();
}

function tone(freq, duration, { type = "sine", gain = 0.12, delay = 0, slide = 0 } = {}) {
  const ctx = audio();
  if (!ctx || !soundEnabled()) return;
  const start = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), start + duration);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function noise(duration, { gain = 0.08, delay = 0, frequency = 1800 } = {}) {
  const ctx = audio();
  if (!ctx || !soundEnabled()) return;
  const start = ctx.currentTime + delay;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = 0.7;
  const amp = ctx.createGain();
  amp.gain.value = gain;
  source.connect(filter).connect(amp).connect(ctx.destination);
  source.start(start);
}

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
};
