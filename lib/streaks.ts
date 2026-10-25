// lib/streaks.ts — Nova, for Four Keys.
// Streak logic, kept in localStorage per the v1 storage decision.
// A streak counts consecutive local calendar days with at least one solve:
// same-day solves pad the totals but never inflate the streak, a solve the
// day after the last one extends it, and a longer gap resets it to 1.
// Pure day-math lives apart from storage so Claude's tests can import the
// pure functions without touching localStorage.


export interface StreakState {
  current: number;
  longest: number;
  /** Local date of the most recent solve, YYYY-MM-DD, or null if never. */
  lastSolvedDate: string | null;
  totalSolves: number;
  /** Solves with no hints used. */
  cleanSolves: number;
  /** Solves with at least one hint unlocked. */
  assistedSolves: number;
}


export const STREAK_STORAGE_KEY = "four-keys:streaks:v1";


export function defaultStreak(): StreakState {
  return {
    current: 0,
    longest: 0,
    lastSolvedDate: null,
    totalSolves: 0,
    cleanSolves: 0,
    assistedSolves: 0,
  };
}


/** Local calendar date as YYYY-MM-DD (en-CA gives exactly that shape). */
export function todayLocal(now: Date = new Date()): string {
  return now.toLocaleDateString("en-CA");
}


/** Whole days from date A to date B, date-only (ignores time of day). */
export function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  const parse = (s: string) => Date.parse(`${s}T00:00:00Z`);
  return Math.round((parse(b) - parse(a)) / msPerDay);
}


export type StreakStatus = "none" | "solved-today" | "at-risk" | "lost";


/**
 * For the UI / share cards: is the streak already banked today, live but
 * in danger (last solve was yesterday — solve today or lose it), gone
 * (gap longer than a day), or never started?
 */
export function getStreakStatus(state: StreakState, today: string = todayLocal()): StreakStatus {
  if (state.lastSolvedDate === null) return "none";
  const gap = daysBetween(state.lastSolvedDate, today);
  if (gap === 0) return "solved-today";
  if (gap === 1) return "at-risk";
  return "lost";
}


/**
 * Pure solve transition. Totals always tick up; the streak itself only
 * moves on day boundaries: first solve ever -> 1, consecutive day -> +1,
 * same day -> unchanged, gap -> reset to 1.
 */
export function recordSolve(
  prev: StreakState,
  opts: { assisted: boolean; today?: string },
): StreakState {
  const today = opts.today ?? todayLocal();
  let current = prev.current;
  if (prev.lastSolvedDate === null) {
    current = 1;
  } else {
    const gap = daysBetween(prev.lastSolvedDate, today);
    if (gap === 1) current = prev.current + 1;
    else if (gap > 1) current = 1;
    // gap === 0 (same day) or negative (clock weirdness): keep current.
  }
  return {
    current,
    longest: Math.max(prev.longest, current),
    lastSolvedDate: today,
    totalSolves: prev.totalSolves + 1,
    cleanSolves: prev.cleanSolves + (opts.assisted ? 0 : 1),
    assistedSolves: prev.assistedSolves + (opts.assisted ? 1 : 0),
  };
}


function storageAvailable(): boolean {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}


/** Load the stored streak, or a fresh one when nothing (or garbage) is stored. */
export function loadStreak(): StreakState {
  if (!storageAvailable()) return defaultStreak();
  try {
    const raw = window.localStorage.getItem(STREAK_STORAGE_KEY);
    if (!raw) return defaultStreak();
    const parsed = JSON.parse(raw) as Partial<StreakState>;
    return { ...defaultStreak(), ...parsed };
  } catch {
    return defaultStreak();
  }
}


export function saveStreak(state: StreakState): void {
  if (!storageAvailable()) return;
  try {
    window.localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: streaks are a delight feature, never fatal.
  }
}


/** Load -> record -> save. On the server it just returns the in-memory result. */
export function recordSolvePersisted(opts: { assisted: boolean; today?: string }): StreakState {
  const next = recordSolve(loadStreak(), opts);
  saveStreak(next);
  return next;
}
