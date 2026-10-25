// lib/hints.ts — Nova, for Four Keys.
// Hint ladder rules: which levels unlock, and when.
// Design: hints are earned by effort (failed attempts) or patience (time
// since the puzzle started), and always in order — no skipping to level 3.
// The server persists `unlockedLevels` in a signed HTTP-only cookie via
// GPT-6's POST /api/v1/hints/unlock route; these pure functions decide
// what that route is allowed to grant. Framework-free on purpose, so the
// same rules run on server and client.

export interface HintState {
  /** Wrong answers submitted so far on this puzzle. */
  failedAttempts: number;
  /** Seconds since the player started this puzzle. */
  secondsSinceStart: number;
  /** Levels already unlocked, e.g. [1, 2]. */
  unlockedLevels: number[];
}

export interface HintLevelRule {
  level: number;
  /** Unlocks once the player has failed this many times... */
  minFailedAttempts: number;
  /** ...or has been thinking this long (seconds). Either condition is enough. */
  minSeconds: number;
}

export const HINT_LADDER: HintLevelRule[] = [
  { level: 1, minFailedAttempts: 1, minSeconds: 60 },
  { level: 2, minFailedAttempts: 3, minSeconds: 300 },
  { level: 3, minFailedAttempts: 5, minSeconds: 600 },
];

/** Has this level met its effort-or-time bar (ignoring order)? */
export function isLevelEligible(level: number, state: HintState): boolean {
  const rule = HINT_LADDER.find((r) => r.level === level);
  if (!rule) return false;
  return (
    state.failedAttempts >= rule.minFailedAttempts ||
    state.secondsSinceStart >= rule.minSeconds
  );
}

/**
 * The next level the player may unlock, or null.
 * Rules: levels unlock in order, one at a time, and never past the number
 * of hint texts the puzzle actually carries (maxLevel).
 */
export function nextUnlockableLevel(
  state: HintState,
  maxLevel: number = HINT_LADDER.length,
): number | null {
  const next = state.unlockedLevels.length + 1;
  if (next > maxLevel) return null;
  if (!isLevelEligible(next, state)) return null;
  return next;
}

/** May the unlock route grant exactly this level right now? */
export function canUnlock(level: number, state: HintState, maxLevel: number = HINT_LADDER.length): boolean {
  if (level < 1 || level > maxLevel) return false;
  if (state.unlockedLevels.includes(level)) return false;
  // Every lower level must already be unlocked — no skipping.
  for (let l = 1; l < level; l++) {
    if (!state.unlockedLevels.includes(l)) return false;
  }
  return isLevelEligible(level, state);
}

/**
 * Pure unlock transition for the route to persist: returns the new
 * unlocked list, or null when nothing is unlockable yet.
 */
export function unlockNextLevel(
  state: HintState,
  maxLevel: number = HINT_LADDER.length,
): number[] | null {
  const next = nextUnlockableLevel(state, maxLevel);
  if (next === null) return null;
  return [...state.unlockedLevels, next].sort((a, b) => a - b);
}

/** Hint text for a level (level 1 = hints[0]). Null when out of range. */
export function getHintText(hints: string[], level: number): string | null {
  if (level < 1 || level > hints.length) return null;
  return hints[level - 1];
}

/** Did the player use any hint? Used by streaks to mark a solve assisted. */
export function isAssisted(unlockedLevels: number[]): boolean {
  return unlockedLevels.length > 0;
}
