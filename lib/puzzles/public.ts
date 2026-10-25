// Client-safe view of today's keys: no digests, no hint text.
import { lineupFor, utcDayOf } from "./rotation";
import type { PuzzleType } from "./types";

export type PublicKey = {
  id: string; author: string; type: PuzzleType; title: string; difficulty: number;
  prompt: string; payload: Record<string, unknown>; hintCount: number; answerFormat: string;
};

export function todaysPublicKeys(day = utcDayOf()): { day: string; keys: PublicKey[] } {
  return {
    day,
    keys: lineupFor(day).map((p) => ({
      id: p.id, author: p.author, type: p.type, title: p.title, difficulty: p.difficulty,
      prompt: p.prompt, payload: p.payload, hintCount: p.hints.length, answerFormat: p.answers.format,
    })),
  };
}
