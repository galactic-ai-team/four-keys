// scripts/build-index.ts
// Build-time generator for lib/puzzles/index.json.
// Run: npx tsx scripts/build-index.ts   (add to `prebuild` in package.json)
// Exits non-zero on any validation error, so bad puzzles never reach prod.

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import '../lib/puzzles/register-all'; // Lumi: register payload validators
import { validateAll } from '../lib/puzzles/validator';
import type { Puzzle, PuzzleIndex } from '../lib/puzzles/types';

const ROOT = process.cwd();
const PUZZLES_DIR = join(ROOT, 'puzzles');
const OUT_FILE = join(ROOT, 'lib', 'puzzles', 'index.json');
const AUTHORS = ['claude', 'gemini', 'nova', 'gpt-6', 'dee', 'lumi'];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.json')) out.push(full);
  }
  return out;
}

/** Deterministic per-day rotation: one puzzle per author, stable across builds. */
function assignRotation(puzzles: Puzzle[]): Record<string, string[]> {
  const byAuthor = new Map<string, Puzzle[]>();
  for (const p of puzzles) {
    const list = byAuthor.get(p.author) ?? [];
    list.push(p);
    byAuthor.set(p.author, list);
  }
  for (const list of byAuthor.values()) list.sort((x, y) => x.id.localeCompare(y.id));

  const dates = [...new Set(puzzles.map((p) => p.date))].sort();
  const rotation: Record<string, string[]> = {};

  for (const date of dates) {
    const day: string[] = [];
    for (const author of AUTHORS) {
      const list = byAuthor.get(author);
      if (!list?.length) continue;
      // Hash(date + author) -> stable index for this day.
      const h = createHash('sha256').update(`${date}:${author}`).digest();
      const idx = h.readUInt32BE(0) % list.length;
      day.push(list[idx].id);
    }
    rotation[date] = day;
  }
  return rotation;
}

function main(): void {
  let files: string[];
  try {
    files = walk(PUZZLES_DIR);
  } catch {
    console.error(`[build-index] no puzzles directory at ${PUZZLES_DIR}`);
    process.exit(1);
  }

  const entries = files.map((file) => ({
    file: relative(ROOT, file),
    raw: JSON.parse(readFileSync(file, 'utf8')) as unknown,
  }));

  const { puzzles, issues } = validateAll(entries);
  if (issues.length > 0) {
    for (const i of issues) console.error(`[build-index] ${i.file} ${i.path}: ${i.message}`);
    console.error(`[build-index] ${issues.length} issue(s) — aborting.`);
    process.exit(1);
  }

  const index: PuzzleIndex = {
    version: '0.1',
    generatedAt: new Date().toISOString(),
    rotation: assignRotation(puzzles),
    puzzles: Object.fromEntries(
      puzzles.map((p) => [
        p.id,
        {
          id: p.id,
          author: p.author,
          type: p.type,
          title: p.title,
          difficulty: p.difficulty,
          hintCount: p.hints.length,
        },
      ]),
    ),
  };

  writeFileSync(OUT_FILE, JSON.stringify(index, null, 2) + '\n');
  console.log(`[build-index] wrote ${Object.keys(index.puzzles).length} puzzles -> ${relative(ROOT, OUT_FILE)}`);
}

main();
