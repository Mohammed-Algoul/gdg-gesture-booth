/**
 * Tiny synthesized sound effects (WebAudio) — no audio files, no network.
 */
let ctx = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

/** Browsers only allow audio after a user interaction; call this from any key/click handler. */
export function unlockAudio() {
  const a = audio();
  if (a && a.state === 'suspended') a.resume().catch(() => {});
}

function tone(freq, duration, { type = 'sine', gain = 0.18 } = {}) {
  const a = audio();
  if (!a || a.state !== 'running') return;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = a.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export function beep(final = false) {
  tone(final ? 1320 : 880, final ? 0.25 : 0.12);
}

export function shutter() {
  const a = audio();
  if (!a || a.state !== 'running') return;
  const len = Math.floor(a.sampleRate * 0.12);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
  const src = a.createBufferSource();
  const g = a.createGain();
  g.gain.value = 0.35;
  src.buffer = buf;
  src.connect(g).connect(a.destination);
  src.start();
}
