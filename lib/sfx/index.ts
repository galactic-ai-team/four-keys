/**
 * Four Keys — Web Audio API Synthesizer & Rhythm Cipher Engine
 * Owner: Gemini
 * Credits & Integration:
 *  - Triggers on state transitions from GPT-6's /api/v1/answers/check & /api/v1/hints/unlock
 *  - Pairs with Nova's lib/hints (playHintChime) and lib/streaks (playVaultFanfare)
 *  - Zero external audio assets required; 100% procedural Web Audio API.
 */

export type SfxPreset =
  | 'click'
  | 'hint'
  | 'wrong'
  | 'keyUnlock'
  | 'vaultFanfare';

export interface SfxOptions {
  muted?: boolean;
  volume?: number; // 0.0 to 1.0
}

const SFX_MUTE_STORAGE_KEY = 'fourkeys:sfx:muted';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {
      // Ignore autoplay restrictions until user gesture
    });
  }
  return sharedAudioCtx;
}

/**
 * Checks or toggles user mute preference in localStorage (aligned with Nova's localStorage pattern).
 */
export function isSfxMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SFX_MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSfxMuted(muted: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SFX_MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * 1. Crisp mechanical tumbler click (for keystrokes, button presses, and rhythm taps).
 */
export function playLockClick(opts?: SfxOptions): void {
  if (opts?.muted ?? isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const vol = Math.min(Math.max(opts?.volume ?? 0.25, 0), 1);

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1100, now);
  osc.frequency.exponentialRampToValueAtTime(180, now + 0.035);

  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.04);
}

/**
 * 2. Crystalline shimmer when unlocking a rung on Nova's Hint Ladder.
 */
export function playHintChime(rungIndex = 1, opts?: SfxOptions): void {
  if (opts?.muted ?? isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const vol = Math.min(Math.max(opts?.volume ?? 0.22, 0), 1);
  // Pitch rises slightly with each hint rung (1, 2, 3)
  const baseFreq = 587.33 * Math.pow(1.12246, Math.max(0, rungIndex - 1)); // D5 upward

  [baseFreq, baseFreq * 1.5].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.055);

    gain.gain.setValueAtTime(0.001, now + idx * 0.055);
    gain.gain.linearRampToValueAtTime(vol, now + idx * 0.055 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.055 + 0.28);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.055);
    osc.stop(now + idx * 0.055 + 0.3);
  });
}

/**
 * 3. Low damped tumbler rejection when GPT-6's /api/v1/answers/check returns incorrect.
 */
export function playWrongGuess(opts?: SfxOptions): void {
  if (opts?.muted ?? isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const vol = Math.min(Math.max(opts?.volume ?? 0.28, 0), 1);

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(155, now);
  osc.frequency.linearRampToValueAtTime(110, now + 0.16);

  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.19);
}

/**
 * 4. Satisfying heavy brass deadbolt + harmonic chime when a single Agent Key unlocks.
 */
export function playKeyUnlock(opts?: SfxOptions): void {
  if (opts?.muted ?? isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const vol = Math.min(Math.max(opts?.volume ?? 0.3, 0), 1);

  // Mechanical bolt slide
  playLockClick({ ...opts, volume: vol });

  // Two-note fifth interval (C5 -> G5)
  const notes = [523.25, 783.99];
  notes.forEach((freq, i) => {
    const start = now + 0.06 + i * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + 0.4);
  });
}

/**
 * 5. Full polyphonic Vault Fanfare when all Daily Keys are solved!
 */
export function playVaultFanfare(opts?: SfxOptions): void {
  if (opts?.muted ?? isSfxMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const vol = Math.min(Math.max(opts?.volume ?? 0.28, 0), 1);

  // Arpeggiated major 9th chord: C5, E5, G5, B5, D6
  const chord = [523.25, 659.25, 783.99, 987.77, 1174.66];

  chord.forEach((freq, idx) => {
    const start = now + idx * 0.075;
    const duration = idx === chord.length - 1 ? 0.75 : 0.4;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = idx === chord.length - 1 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0005, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + duration + 0.02);
  });
}

/**
 * 6. Interactive Rhythm / Morse / Rudiment Pattern Player for Audio Puzzles!
 * Accepts a pattern string where:
 *  - 'R' or '.' = crisp high snare/woodblock tap (880 Hz)
 *  - 'L' or '-' = warm low tom/pulse tone (440 Hz)
 *  - '_' or ' ' = rest (1 step)
 */
export function playRhythmPattern(
  pattern: string,
  bpm = 110,
  opts?: SfxOptions
): number {
  if (opts?.muted ?? isSfxMuted()) return 0;
  const ctx = getAudioContext();
  if (!ctx) return 0;

  const stepSeconds = 60 / bpm / 2; // Eighth-note grid
  const now = ctx.currentTime + 0.03;
  const vol = Math.min(Math.max(opts?.volume ?? 0.3, 0), 1);

  const tokens = pattern.trim().split(/\s+/);
  tokens.forEach((token, idx) => {
    if (token === '_' || token === '/') return;
    const start = now + idx * stepSeconds;
    const isHigh = token.toUpperCase() === 'R' || token === '.';
    const isLong = token === '-';
    const duration = isLong ? stepSeconds * 0.8 : 0.065;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = isHigh ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isHigh ? 880 : 440, start);
    if (!isLong) {
      osc.frequency.exponentialRampToValueAtTime(
        isHigh ? 320 : 160,
        start + duration
      );
    }

    gain.gain.setValueAtTime(vol, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(start + duration + 0.01);
  });

  return Math.round(tokens.length * stepSeconds * 1000);
}

/**
 * Unified dispatcher for UI components.
 */
export function playSfx(preset: SfxPreset, opts?: SfxOptions): void {
  switch (preset) {
    case 'click':
      return playLockClick(opts);
    case 'hint':
      return playHintChime(1, opts);
    case 'wrong':
      return playWrongGuess(opts);
    case 'keyUnlock':
      return playKeyUnlock(opts);
    case 'vaultFanfare':
      return playVaultFanfare(opts);
  }
}
