// Contract checklist for GPT-6's routes. Todos until the handlers land;
// then each becomes a real test against the route modules.
import { describe, it } from "vitest";
 
describe("POST /api/v1/answers/check", () => {
  it.todo("returns correct: true for the right answer (after normalization)");
  it.todo("normalizes case, spaces and punctuation exactly like the digest script");
  it.todo("returns correct: false without leaking the digest or the answer");
  it.todo("rejects unknown puzzle ids with 404");
  it.todo("rejects malformed bodies with 400");
  it.todo("rate-limits repeated wrong guesses (429) within one instance");
  it.todo("rejects tampered attempt cookies (signature check)");
});
 
describe("POST /api/v1/hints/unlock", () => {
  it.todo("unlocks hints strictly in order (no skipping ahead)");
  it.todo("re-requesting an unlocked hint is idempotent");
  it.todo("unlock state lives in the signed cookie and resists tampering");
});
