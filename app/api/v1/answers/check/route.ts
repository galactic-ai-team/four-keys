import { NextRequest, NextResponse } from "next/server";
import { getServerPuzzle } from "@/lib/puzzles/server"; // Dee's SERVER-ONLY loader (contract below)
import { guessFingerprint, normalizeAnswer, verifyAnswer } from "@/lib/server/crypto";
import {
  apiError, checkRateLimit, maxAttempts, puzzleProgress, readSession,
  rememberAttempt, reply, sameOrigin, utcDay,
} from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUZZLE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/;

export async function POST(req: NextRequest) {
  try {
    const s = readSession(req);
    if (!sameOrigin(req)) return reply(s, apiError("FORBIDDEN_ORIGIN", "Use this site's origin"), 403);
    const wait = checkRateLimit(req, s);
    if (wait) return reply(s, apiError("RATE_LIMITED", "Too many requests"), 429, wait);
    if (Number(req.headers.get("content-length") || 0) > 4096) {
      return reply(s, apiError("INVALID_REQUEST", "Body too large"), 400);
    }
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return reply(s, apiError("INVALID_REQUEST", "Expected JSON object"), 400);
    }
    const { puzzleId, answer, attemptId } = body as Record<string, unknown>;
    if (typeof puzzleId !== "string" || !PUZZLE_ID.test(puzzleId) ||
        typeof answer !== "string" || answer.length > 128 ||
        normalizeAnswer(answer).length === 0 || normalizeAnswer(answer).length > 128 ||
        typeof attemptId !== "string" || !UUID.test(attemptId)) {
      return reply(s, apiError("INVALID_REQUEST", "Use puzzleId, answer (1–128 chars), and a UUID attemptId"), 400);
    }

    // The date and answer digest come from Dee's private server loader, NEVER a public JSON response.
    const puzzle = await getServerPuzzle(puzzleId);
    if (!puzzle || puzzle.date !== utcDay()) {
      return reply(s, apiError("PUZZLE_NOT_FOUND", "Puzzle is unavailable"), 404);
    }
    if (!/^[0-9a-f]{64}$/i.test(puzzle.answerDigest)) {
      return reply(s, apiError("PUZZLE_NOT_READY", "Puzzle cannot accept answers yet"), 503);
    }
    const progress = puzzleProgress(s, puzzleId);
    if (!progress) return reply(s, apiError("DAILY_LIMIT", "Daily puzzle limit reached"), 429, 60);

    const fingerprint = guessFingerprint(puzzleId, answer);
    const earlier = progress.replays.find(r => r.id === attemptId);
    if (earlier) {
      if (earlier.fingerprint !== fingerprint) {
        return reply(s, apiError("ATTEMPT_ID_CONFLICT", "Attempt ID already used with a different answer"), 409);
      }
      return reply(s, {
        correct: earlier.correct, solved: progress.solved,
        attemptsRemaining: earlier.remaining, solvedAt: progress.solvedAt ?? null, replayed: true,
      });
    }
    if (progress.solved) {
      return reply(s, { correct: verifyAnswer(puzzleId, answer, puzzle.answerDigest), solved: true,
        attemptsRemaining: Math.max(0, maxAttempts - progress.attempts), solvedAt: progress.solvedAt, alreadySolved: true });
    }
    if (progress.attempts >= maxAttempts) {
      const retry = Math.max(1, Math.ceil((Date.parse(utcDay() + "T00:00:00Z") + 86_400_000 - Date.now()) / 1000));
      return reply(s, apiError("ATTEMPTS_EXHAUSTED", "Try the next daily puzzle"), 429, retry);
    }

    const correct = verifyAnswer(puzzleId, answer, puzzle.answerDigest);
    progress.attempts++;
    if (correct) { progress.solved = true; progress.solvedAt = new Date().toISOString(); }
    const remaining = maxAttempts - progress.attempts;
    rememberAttempt(progress, { id: attemptId, fingerprint, correct, remaining });
    return reply(s, { correct, solved: progress.solved, attemptsRemaining: remaining,
      solvedAt: progress.solvedAt ?? null, replayed: false });
  } catch {
    // Do not leak secret configuration, answer material or loader internals.
    return NextResponse.json(apiError("SERVER_UNAVAILABLE", "Answer checking temporarily unavailable"),
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
