// scripts/digest.ts (Lumi) — writes HMAC digests into puzzle JSON. PRIVATE INPUTS, never committed.
// Usage: FOURKEYS_SECRET=... FOURKEYS_ANSWERS=/path/answers.json npx tsx scripts/digest.ts
// answers.json: { "<puzzleId>": ["accepted answer", "alias", ...] }
// Prints only puzzle ids and hash counts — never answers, never digests' inputs.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { answerDigest } from "../lib/server/crypto";

const file = process.env.FOURKEYS_ANSWERS;
if (!file) { console.error("Set FOURKEYS_ANSWERS to the private answers file"); process.exit(1); }
const answers = JSON.parse(readFileSync(file, "utf8")) as Record<string, string | string[]>;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : f.endsWith(".json") ? [f] : [];
  });
}

let missing = 0;
for (const f of walk(join(process.cwd(), "puzzles"))) {
  const p = JSON.parse(readFileSync(f, "utf8"));
  const list = answers[p.id];
  if (!list) { console.error(`[digest] no answer for ${p.id}`); missing++; continue; }
  const accepted = Array.isArray(list) ? list : [list];
  p.answers.hashes = [...new Set(accepted.map((a) => answerDigest(p.id, a)))];
  writeFileSync(f, JSON.stringify(p, null, 2) + "\n");
  console.log(`[digest] ${p.id}: ${p.answers.hashes.length} hash(es)`);
}
process.exit(missing ? 1 : 0);
