// Server-side only: import from route handlers, never a Client Component.
import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { newSessionId, signSession, verifySessionSignature } from "./crypto";

const COOKIE = "fk_state_v1";
const MAX_ATTEMPTS = 8;
const MAX_PUZZLES = 4;
const MAX_REPLAYS = 3;
const WINDOW_MS = 60_000;

export type AttemptReplay = {
  id: string;
  fingerprint: string;
  correct: boolean;
  remaining: number;
};
export type PuzzleProgress = {
  attempts: number;
  solved: boolean;
  solvedAt?: string;
  hintLevel: number;
  replays: AttemptReplay[];
};
export type PlayerSession = {
  v: 1;
  day: string;
  sid: string;
  issuedAt: number;
  windowStart: number;
  windowCount: number;
  puzzles: Record<string, PuzzleProgress>;
};

export const maxAttempts = MAX_ATTEMPTS;
export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

function fresh(now: number): PlayerSession {
  return {
    v: 1, day: utcDay(now), sid: newSessionId(), issuedAt: now,
    windowStart: now, windowCount: 0, puzzles: Object.create(null),
  };
}

export function readSession(req: NextRequest, now = Date.now()): PlayerSession {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token || token.length > 3500) return fresh(now);
  const dot = token.lastIndexOf(".");
  if (dot < 1) return fresh(now);
  const encoded = token.slice(0, dot), signature = token.slice(dot + 1);
  try {
    if (!verifySessionSignature(encoded, signature)) return fresh(now);
    const s = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as PlayerSession;
    if (s?.v !== 1 || s.day !== utcDay(now) ||
        typeof s.sid !== "string" || !/^[A-Za-z0-9_-]{22}$/.test(s.sid) ||
        !Number.isSafeInteger(s.issuedAt) || s.issuedAt > now || now - s.issuedAt > 36 * 3600_000 ||
        !Number.isSafeInteger(s.windowStart) || !Number.isSafeInteger(s.windowCount) ||
        !s.puzzles || typeof s.puzzles !== "object" || Array.isArray(s.puzzles)) return fresh(now);
    const clean: PlayerSession = { ...s, puzzles: Object.create(null) };
    const entries = Object.entries(s.puzzles);
    if (entries.length > MAX_PUZZLES) return fresh(now);
    for (const [id, p] of entries) {
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,95}$/.test(id) ||
          !p || !Number.isInteger(p.attempts) || p.attempts < 0 || p.attempts > MAX_ATTEMPTS ||
          typeof p.solved !== "boolean" || !Number.isInteger(p.hintLevel) ||
          p.hintLevel < 0 || p.hintLevel > 10 || !Array.isArray(p.replays) ||
          p.replays.length > MAX_REPLAYS) return fresh(now);
      clean.puzzles[id] = {
        attempts: p.attempts, solved: p.solved, hintLevel: p.hintLevel,
        ...(typeof p.solvedAt === "string" ? { solvedAt: p.solvedAt } : {}),
        replays: p.replays.filter(r => r && typeof r.id === "string" &&
          /^[0-9a-f-]{36}$/i.test(r.id) && /^[A-Za-z0-9_-]{43}$/.test(r.fingerprint) &&
          typeof r.correct === "boolean" && Number.isInteger(r.remaining) &&
          r.remaining >= 0 && r.remaining <= MAX_ATTEMPTS).slice(-MAX_REPLAYS),
      };
    }
    return clean;
  } catch {
    return fresh(now);
  }
}

export function puzzleProgress(session: PlayerSession, puzzleId: string): PuzzleProgress | null {
  if (session.puzzles[puzzleId]) return session.puzzles[puzzleId];
  if (Object.keys(session.puzzles).length >= MAX_PUZZLES) return null;
  const p: PuzzleProgress = { attempts: 0, solved: false, hintLevel: 0, replays: [] };
  session.puzzles[puzzleId] = p;
  return p;
}

export function rememberAttempt(p: PuzzleProgress, entry: AttemptReplay): void {
  p.replays = [...p.replays, entry].slice(-MAX_REPLAYS);
}

/** Best-effort ONLY: module memory differs across serverless instances. */
const ipBuckets = new Map<string, { start: number; count: number }>();
export function checkRateLimit(req: NextRequest, session: PlayerSession, now = Date.now()): number {
  if (now - session.windowStart >= WINDOW_MS || session.windowStart > now) {
    session.windowStart = now;
    session.windowCount = 0;
  }
  session.windowCount++;
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = createHash("sha256").update(ip).digest("hex");
  if (ipBuckets.size > 2000) ipBuckets.clear();
  let b = ipBuckets.get(key);
  if (!b || now - b.start >= WINDOW_MS || b.start > now) {
    b = { start: now, count: 0 };
    ipBuckets.set(key, b);
  }
  b.count++;
  if (session.windowCount <= 30 && b.count <= 40) return 0;
  return Math.max(1, Math.ceil((WINDOW_MS - Math.min(now - session.windowStart, now - b.start)) / 1000));
}

export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // Accept CLI/server requests without Origin.
  try { return new URL(origin).host === req.nextUrl.host; }
  catch { return false; }
}

export function reply(session: PlayerSession, body: unknown, status = 200, retryAfter = 0) {
  const headers: Record<string, string> = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (retryAfter > 0) headers["Retry-After"] = String(retryAfter);
  const response = NextResponse.json(body, { status, headers });
  const encoded = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  response.cookies.set(COOKIE, `${encoded}.${signSession(encoded)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/", maxAge: 36 * 60 * 60,
  });
  return response;
}

export function apiError(code: string, message: string, extras: Record<string, unknown> = {}) {
  return { error: { code, message, ...extras } };
}
