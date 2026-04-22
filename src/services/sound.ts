// Lightweight sound effects via Web Audio API — no asset files needed.
// AudioContext is created lazily and unlocked on the first user gesture
// anywhere in the document, so the first cart-add reliably plays sound.

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
  }
  return ctx;
}

// Run a tiny silent buffer on first user gesture to unlock audio in
// browsers / webviews that require it.
function installUnlock() {
  if (typeof window === 'undefined') return;
  const unlock = () => {
    const ac = ensureCtx();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    try {
      const buffer = ac.createBuffer(1, 1, 22050);
      const src = ac.createBufferSource();
      src.buffer = buffer;
      src.connect(ac.destination);
      src.start(0);
    } catch {}
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: false });
  window.addEventListener('keydown', unlock, { once: false });
  window.addEventListener('touchstart', unlock, { once: false });
}

if (typeof window !== 'undefined') installUnlock();

// =====================================================================
// Sound style catalog
// =====================================================================

export type SoundStyle = 'scanner' | 'pop' | 'ding' | 'click' | 'chime' | 'none';

export interface SoundStyleInfo {
  id: SoundStyle;
  label: string;
  description: string;
}

export const SOUND_STYLES: SoundStyleInfo[] = [
  { id: 'scanner', label: 'Scanner Beep',     description: 'Bip tajam khas barcode scanner toko (default)' },
  { id: 'pop',     label: 'Soft Pop',         description: 'Pop lembut bernada tinggi' },
  { id: 'ding',    label: 'Cash Register Ding', description: 'Lonceng pendek seperti mesin kasir' },
  { id: 'click',   label: 'Modern Click',     description: 'Klik pendek bernada rendah' },
  { id: 'chime',   label: 'Two-Tone Chime',   description: 'Dua nada berurutan (rendah → tinggi)' },
  { id: 'none',    label: 'Tanpa Suara',      description: 'Nonaktifkan efek suara' },
];

export const DEFAULT_SOUND_STYLE: SoundStyle = 'scanner';
const STORAGE_KEY = 'pos:cartSound';

/** Persist the chosen sound style so any module can read it instantly. */
export function setActiveSound(style: SoundStyle) {
  try { localStorage.setItem(STORAGE_KEY, style); } catch {}
}

/** Read the currently active sound style. Falls back to default. */
export function getActiveSound(): SoundStyle {
  try {
    const v = localStorage.getItem(STORAGE_KEY) as SoundStyle | null;
    if (v && SOUND_STYLES.some((s) => s.id === v)) return v;
  } catch {}
  return DEFAULT_SOUND_STYLE;
}

// =====================================================================
// Public API
// =====================================================================

/** Play the active sound effect (or override with a specific style). */
export function playAddToCart(style?: SoundStyle) {
  const chosen: SoundStyle = style ?? getActiveSound();
  if (chosen === 'none') return;
  if (style === 'none') return;
  const ac = ensureCtx();
  if (!ac) return;

  const ac2 = ac;
  const emit = () => {
    const now = ac2.currentTime;
    switch (chosen) {
      case 'scanner': return scannerBeep(ac2, now);
      case 'pop':     return popSound(ac2, now);
      case 'ding':    return dingSound(ac2, now);
      case 'click':   return clickSound(ac2, now);
      case 'chime':   return chimeSound(ac2, now);
    }
  };

  if (ac.state === 'suspended') {
    ac.resume().then(emit).catch(() => {});
  } else {
    emit();
  }
}

// =====================================================================
// Individual sound generators
// =====================================================================

function scannerBeep(ac: AudioContext, t0: number) {
  const dur = 0.11, vol = 0.35;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 5500;
  filter.Q.value = 1;
  osc.type = 'square';
  osc.frequency.setValueAtTime(2700, t0);
  osc.frequency.linearRampToValueAtTime(2900, t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
  gain.gain.setValueAtTime(vol, t0 + dur - 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filter).connect(gain).connect(ac.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function popSound(ac: AudioContext, t0: number) {
  const blip = (start: number, freq: number, dur: number, vol: number) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(start); osc.stop(start + dur + 0.02);
  };
  blip(t0,        880,  0.07, 0.45);
  blip(t0 + 0.07, 1320, 0.06, 0.4);
}

function dingSound(ac: AudioContext, t0: number) {
  // Bell-like: a bright sine with long-ish exponential decay + a 5th harmonic
  const tone = (freq: number, vol: number, dur: number) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  };
  tone(1760, 0.35, 0.55); // A6
  tone(2640, 0.18, 0.45); // perfect fifth above
}

function clickSound(ac: AudioContext, t0: number) {
  // Short filtered noise burst → mechanical/keyboard click feel
  const dur = 0.05;
  const bufferSize = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  filter.Q.value = 4;
  const gain = ac.createGain();
  gain.gain.value = 0.6;
  src.connect(filter).connect(gain).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.01);
}

function chimeSound(ac: AudioContext, t0: number) {
  // Pleasant ascending two-note chime (C6 → E6 → G6 quick arpeggio)
  const note = (start: number, freq: number) => {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.4, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    osc.connect(gain).connect(ac.destination);
    osc.start(start); osc.stop(start + 0.2);
  };
  note(t0,        1046.5); // C6
  note(t0 + 0.06, 1318.5); // E6
  note(t0 + 0.12, 1568.0); // G6
}
