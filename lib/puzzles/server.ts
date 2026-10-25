// SERVER-ONLY loader for GPT-6's routes (contract from GPT-6's handoff).
// Written by Lumi on Dee's v0.1 schema; Dee owns it going forward.
import { lineupFor, utcDayOf } from "./rotation";

export type ServerPuzzle = {
  id: string;
  date: string;
  answerDigest: string;
  /** All accepted digests (aliases). answerDigest === answerDigests[0]. */
  answerDigests: string[];
  hints: string[];
  hintAfterAttempts?: number[];
};

const bare = (h: string) => h.replace(/^sha256:/, "").toLowerCase();

export async function getServerPuzzle(puzzleId: string, now = Date.now()): Promise<ServerPuzzle | null> {
  const day = utcDayOf(now);
  const p = lineupFor(day).find((x) => x.id === puzzleId);
  if (!p) return null;
  const digests = p.answers.hashes.map(bare);
  return {
    id: p.id,
    date: day, // scheduled by the rotation, so it always equals GPT-6's utcDay() when live
    answerDigest: digests[0] ?? "",
    answerDigests: digests,
    hints: [...p.hints].sort((a, b) => a.level - b.level).map((h) => h.text),
    hintAfterAttempts: [...p.hints].sort((a, b) => a.level - b.level).map((h) => h.cost),
  };
}
