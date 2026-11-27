const SOUND_PREF_KEY = 'naidioma_sound_enabled';
const CALM_PREF_KEY = 'naidioma_calm_mode';

let sharedAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctor();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  const raw = window.localStorage.getItem(SOUND_PREF_KEY);
  return raw !== 'false';
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SOUND_PREF_KEY, String(enabled));
}

export function isCalmModeEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(CALM_PREF_KEY) === 'true';
}

export function applyCalmMode(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CALM_PREF_KEY, String(enabled));
  document.documentElement.classList.toggle('calm-mode', enabled);
}

function playTone(
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  type: OscillatorType = 'sine',
  peakGain = 0.12,
): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioCtx();
  if (!ctx) return;

  try {
    const now = ctx.currentTime + startOffsetSec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  } catch {
    // ignore audio block before first gesture
  }
}

export function playTapSound(): void {
  playTone(540, 0, 0.06, 'triangle', 0.07);
}

export function playCorrectSound(combo = 1): void {
  const boost = Math.min(combo - 1, 5) * 35;
  playTone(523.25 + boost, 0, 0.14, 'triangle', 0.13);
  playTone(659.25 + boost, 0.08, 0.16, 'triangle', 0.13);
  playTone(783.99 + boost, 0.16, 0.24, 'sine', 0.15);
}

export function playGentleRetrySound(): void {
  // Soft, calm two-note tone (sensory-friendly for kids with Autism/ADHD)
  playTone(349.23, 0, 0.14, 'sine', 0.09);
  playTone(293.66, 0.12, 0.2, 'sine', 0.08);
}

export function playChestOpenSound(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((n, idx) => playTone(n, idx * 0.07, 0.22, 'triangle', 0.13));
}

export function playCharacterCheerSound(): void {
  playTone(620, 0, 0.09, 'sine', 0.1);
  playTone(840, 0.08, 0.14, 'triangle', 0.11);
}

export function playVictoryFanfare(): void {
  const melody: Array<[number, number, number]> = [
    [523.25, 0.0, 0.16],
    [659.25, 0.12, 0.16],
    [783.99, 0.24, 0.18],
    [1046.5, 0.38, 0.36],
  ];
  melody.forEach(([f, t, d]) => playTone(f, t, d, 'triangle', 0.15));
}

export function playFootstepsSound(steps = 4): void {
  for (let i = 0; i < steps; i++) {
    const pitch = i % 2 === 0 ? 290 : 340;
    playTone(pitch, i * 0.14, 0.06, 'triangle', 0.075);
  }
}

export function playPetSadSound(): void {
  // Som bem macio e fofo de "awwn" quando o bichinho fica tristinho
  playTone(392, 0, 0.16, 'sine', 0.09);
  playTone(330, 0.14, 0.2, 'sine', 0.085);
  playTone(277, 0.28, 0.26, 'sine', 0.07);
}

export function playPetHappySound(): void {
  playTone(587.33, 0, 0.09, 'triangle', 0.1);
  playTone(783.99, 0.08, 0.11, 'triangle', 0.11);
  playTone(1046.5, 0.16, 0.18, 'sine', 0.12);
}
