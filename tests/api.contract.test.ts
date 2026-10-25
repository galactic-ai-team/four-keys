// Contract checklist for GPT-6's routes. Claude's todos; Lumi converted the first
// batch into real tests against the route modules (loader mocked with a test puzzle).
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { answerDigest } from "@/lib/puzzles/normalize";
import { utcDay } from "@/lib/server/session";

const TEST_ID = "test-wordplay-001";
vi.mock("@/lib/puzzles/server", () => ({
  getServerPuzzle: async (id: string) =>
    id === "test-wordplay-001"
      ? {
          id, date: utcDay(),
          answerDigest: answerDigest(id, "Test Answer"),
          answerDigests: [answerDigest(id, "Test Answer"), answerDigest(id, "alias")],
          hints: ["first hint", "second hint", "third hint"],
          hintAfterAttempts: [0, 1, 2],
        }
      : null,
}));

import { POST as check } from "@/app/api/v1/answers/check/route";
import { POST as unlock } from "@/app/api/v1/hints/unlock/route";

let cookie = "";
function req(path: string, body: unknown, withCookie = true) {
  const headers: Record<string, string> = { "content-type": "application/json", origin: "http://localhost" };
  if (withCookie && cookie) headers.cookie = cookie;
  return new NextRequest(`http://localhost${path}`, {
    method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
async function call(fn: typeof check, path: string, body: unknown) {
  const res = await fn(req(path, body));
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  return { status: res.status, json: (await res.json()) as Record<string, any>, text: "" };
}
const guess = (answer: string) =>
  call(check, "/api/v1/answers/check", { puzzleId: TEST_ID, answer, attemptId: crypto.randomUUID() });
const hint = (level: number) => call(unlock, "/api/v1/hints/unlock", { puzzleId: TEST_ID, level });

beforeEach(() => { cookie = ""; });

describe("POST /api/v1/answers/check", () => {
  it("returns correct: true for the right answer (after normalization)", async () => {
    const r = await guess("Test Answer");
    expect(r.status).toBe(200);
    expect(r.json.correct).toBe(true);
    expect(r.json.solved).toBe(true);
  });
  it("normalizes case, spaces and punctuation exactly like the digest script", async () => {
    expect((await guess("  tEST    answer ")).json.correct).toBe(true);
    cookie = "";
    expect((await guess("ALIAS")).json.correct).toBe(true);
  });
  it("returns correct: false without leaking the digest or the answer", async () => {
    const r = await guess("nope");
    expect(r.json.correct).toBe(false);
    const raw = JSON.stringify(r.json);
    expect(raw).not.toMatch(/[0-9a-f]{64}/);
    expect(raw.toLowerCase()).not.toContain("test answer");
  });
  it("rejects unknown puzzle ids with 404", async () => {
    const r = await call(check, "/api/v1/answers/check", { puzzleId: "nope-wordplay-999", answer: "x", attemptId: crypto.randomUUID() });
    expect(r.status).toBe(404);
  });
  it("rejects malformed bodies with 400", async () => {
    expect((await call(check, "/api/v1/answers/check", "{not json")).status).toBe(400);
    expect((await call(check, "/api/v1/answers/check", { puzzleId: TEST_ID, answer: "x", attemptId: "nope" })).status).toBe(400);
  });
  it.todo("rate-limits repeated wrong guesses (429) within one instance");
  it("rejects tampered attempt cookies (signature check)", async () => {
    await guess("wrong");
    const [name, value] = cookie.split("=");
    const [payload] = value.split(".");
    const forged = JSON.parse(Buffer.from(payload, "base64url").toString());
    forged.puzzles[TEST_ID].solved = true;
    cookie = `${name}=${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${"A".repeat(43)}`;
    const r = await guess("wrong again");
    expect(r.json.solved).toBe(false);
    expect(r.json.attemptsRemaining).toBe(7); // fresh session, not 6
  });
});

describe("POST /api/v1/hints/unlock", () => {
  it("unlocks hints strictly in order (no skipping ahead)", async () => {
    expect((await hint(2)).status).toBe(409);
    const r = await hint(1);
    expect(r.status).toBe(200);
    expect(r.json.hint).toBe("first hint");
  });
  it("re-requesting an unlocked hint is idempotent", async () => {
    await hint(1);
    const r = await hint(1);
    expect(r.json.alreadyUnlocked).toBe(true);
    expect(r.json.hint).toBe("first hint");
  });
  it.todo("unlock state lives in the signed cookie and resists tampering");
});
