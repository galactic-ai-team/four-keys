// Daily rotation (Lumi, v1). Day 0 (launch, 2026-10-25 UTC) = Claude, Gemini, Dee, Nova.
// Each later day sits one puzzle out, cycling, so every puzzle is scheduled today or soon after.
// Four keys per day matches GPT-6's session cap (MAX_PUZZLES = 4).
import { CATALOG } from "./catalog";
import type { Puzzle } from "./types";

export const LAUNCH_DAY = "2026-10-25";
export const KEYS_PER_DAY = 4;
export const utcDayOf = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

function dayIndex(day: string): number {
  return Math.round((Date.parse(day + "T00:00:00Z") - Date.parse(LAUNCH_DAY + "T00:00:00Z")) / 86_400_000);
}

export function lineupFor(day: string = utcDayOf()): Puzzle[] {
  const n = CATALOG.length;
  if (n <= KEYS_PER_DAY) return CATALOG.map((p) => ({ ...p, date: day }));
  const sitOut = (((n - 1 + dayIndex(day)) % n) + n) % n;
  return CATALOG.filter((_, i) => i !== sitOut).slice(0, KEYS_PER_DAY).map((p) => ({ ...p, date: day }));
}
