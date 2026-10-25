import { NextRequest, NextResponse } from "next/server";
import { getServerPuzzle } from "@/lib/puzzles/server"; // Dee's SERVER-ONLY loader (contract below)
import {
  apiError, checkRateLimit, puzzleProgress, readSession, reply, sameOrigin, utcDay,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PUZZLE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/;

export async function POST(req: NextRequest) {
  try {
    const s = readSession(req);
    if (!sameOrigin(req)) return reply(s, apiError("FORBIDDEN_ORIGIN", "Use this site's origin"), 403);
    const wait = checkRateLimit(req, s);
    if (wait) return reply(s, apiError("RATE_LIMITED", "Too many requests"), 429, wait);
    if (Number(req.headers.get("content-length") || 0) > 2048) {
      return reply(s, apiError("INVALID_REQUEST", "Body too large"), 400);
    }
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return reply(s, apiError("INVALID_REQUEST", "Expected JSON object"), 400);
    }
    const { puzzleId, level } = body as Record<string, unknown>;
    if (typeof puzzleId !== "string" || !PUZZLE_ID.test(puzzleId) ||
        !Number.isInteger(level) || (level as number) < 1 || (level as number) > 10) {
      return reply(s, apiError("INVALID_REQUEST", "Use puzzleId and a positive integer hint level"), 400);
    }
    const puzzle = await getServerPuzzle(puzzleId);
    if (!puzzle || puzzle.date !== utcDay()) {
      return reply(s, apiError("PUZZLE_NOT_FOUND", "Puzzle is unavailable"), 404);
    }
    if (!Array.isArray(puzzle.hints) || puzzle.hints.length === 0 ||
        puzzle.hints.length > 10 || puzzle.hints.some(h => typeof h !== "string" || h.length > 400)) {
      return reply(s, apiError("PUZZLE_NOT_READY", "Hints unavailable"), 503);
    }
    const requested = level as number;
    if (requested > puzzle.hints.length) {
      return reply(s, apiError("HINT_NOT_FOUND", "Hint level unavailable"), 404);
    }
    const progress = puzzleProgress(s, puzzleId);
    if (!progress) return reply(s, apiError("DAILY_LIMIT", "Daily puzzle limit reached"), 429, 60);

    if (requested <= progress.hintLevel) {
      return reply(s, { unlocked: true, level: requested, hint: puzzle.hints[requested - 1],
        nextUnlockAt: null, alreadyUnlocked: true });
    }
    if (requested !== progress.hintLevel + 1) {
      return reply(s, apiError("HINT_ORDER", "Unlock hints one at a time", { nextLevel: progress.hintLevel + 1 }), 409);
    }
    // Nova/Dee supply attempt thresholds in puzzle metadata; fallback is 0, 2, 4 ...
    const threshold = puzzle.hintAfterAttempts?.[requested - 1] ?? (requested - 1) * 2;
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 8) {
      return reply(s, apiError("PUZZLE_NOT_READY", "Invalid hint policy"), 503);
    }
    if (progress.attempts < threshold && !progress.solved) {
      return reply(s, apiError("HINT_LOCKED", "More attempts needed before this hint", {
        attemptsNeeded: threshold - progress.attempts,
      }), 409);
    }
    progress.hintLevel = requested;
    return reply(s, { unlocked: true, level: requested,
      hint: puzzle.hints[requested - 1], nextUnlockAt: null, alreadyUnlocked: false });
  } catch {
    return NextResponse.json(apiError("SERVER_UNAVAILABLE", "Hints temporarily unavailable"),
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
