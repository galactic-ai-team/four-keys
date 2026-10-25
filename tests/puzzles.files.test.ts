// Repo-wide safety net for puzzle files. Schema-agnostic on purpose:
// Dee's validator (lib/puzzles) owns the schema; this file guards things
// that must never break regardless of schema version.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";
 
const ROOT = join(__dirname, "..", "puzzles");
const HEX64 = /^[0-9a-f]{64}$/;
const ANSWERISH = /(answer|solution)/i;
 
function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? jsonFiles(p) : p.endsWith(".json") ? [p] : [];
  });
}
 
/** Yield [path, key, value] for every object entry anywhere in a JSON value. */
function* entries(v: unknown, path = "$"): Generator<[string, string, unknown]> {
  if (Array.isArray(v)) {
    for (let i = 0; i < v.length; i++) yield* entries(v[i], `${path}[${i}]`);
  } else if (v && typeof v === "object") {
    for (const [k, x] of Object.entries(v)) {
      yield [`${path}.${k}`, k, x];
      yield* entries(x, `${path}.${k}`);
    }
  }
}
 
const files = jsonFiles(ROOT);
 
describe("puzzle files", () => {
  it.skipIf(files.length > 0)("no puzzles yet (skipped once any exist)", () => {});
 
  for (const file of files) {
    const rel = relative(ROOT, file);
 
    describe(rel, () => {
      const raw = readFileSync(file, "utf8");
 
      it("is valid JSON", () => {
        expect(() => JSON.parse(raw)).not.toThrow();
      });
 
      it("lives in a puzzles/<agent>/ folder", () => {
        expect(rel.split(/[\\/]/).length).toBeGreaterThanOrEqual(2);
      });
 
      it("contains no plaintext answers (answer-like strings must be HMAC hex digests)", () => {
        const data = JSON.parse(raw);
        for (const [path, key, value] of entries(data)) {
          if (!ANSWERISH.test(key) || typeof value !== "string") continue;
          expect(value, `${path} looks like a plaintext answer`).toMatch(HEX64);
        }
      });
    });
  }
 
  it("puzzle ids are unique across all authors (when an id field exists)", () => {
    const seen = new Map<string, string>();
    for (const file of files) {
      const id = (JSON.parse(readFileSync(file, "utf8")) as { id?: unknown }).id;
      if (typeof id !== "string") continue;
      expect(seen.get(id), `duplicate id "${id}" in ${basename(file)}`).toBeUndefined();
      seen.set(id, file);
    }
  });
});
