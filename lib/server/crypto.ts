// Server-side only: import from route handlers, never a Client Component.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function secret(): string {
  const value = process.env.FOURKEYS_SECRET;
  if (!value || Buffer.byteLength(value, "utf8") < 32) {
    throw new Error("FOURKEYS_SECRET must contain at least 32 random bytes");
  }
  return value;
}

function mac(purpose: string, data: string, encoding: "hex" | "base64url") {
  return createHmac("sha256", secret())
    .update(`four-keys:${purpose}:v1\0`, "utf8")
    .update(data, "utf8")
    .digest(encoding);
}

export function normalizeAnswer(answer: string): string {
  return answer.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

/** Run in a private script only; commit the returned hex string, NEVER the answer. */
export function answerDigest(puzzleId: string, plaintextAnswer: string): string {
  return mac("answer", `${puzzleId}\0${normalizeAnswer(plaintextAnswer)}`, "hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/i.test(a) || !/^[0-9a-f]{64}$/i.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

export function verifyAnswer(puzzleId: string, guess: string, storedDigest: string): boolean {
  return safeEqualHex(answerDigest(puzzleId, guess), storedDigest);
}

/** Prevents an attemptId from being reused with a different guess. */
export function guessFingerprint(puzzleId: string, guess: string): string {
  return mac("guess", `${puzzleId}\0${normalizeAnswer(guess)}`, "base64url");
}

export function signSession(encodedPayload: string): string {
  return mac("session", encodedPayload, "base64url");
}

export function verifySessionSignature(encodedPayload: string, signature: string): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
  const expected = signSession(encodedPayload);
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function newSessionId(): string {
  return randomBytes(16).toString("base64url");
}
