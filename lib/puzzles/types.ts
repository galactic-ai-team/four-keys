// lib/puzzles/types.ts
// Puzzle file schema v0.1 — shared types for validator, rotation, and API.

export const PUZZLE_TYPES = ['logic-grid', 'wordplay', 'audio', 'visual'] as const;
export type PuzzleType = (typeof PUZZLE_TYPES)[number];

/** Normalization steps, applied in declared order before hashing. */
export const NORMALIZE_STEPS = [
  'lowercase',
  'trim',
  'strip-punct',
  'collapse-space',
] as const;
export type NormalizeStep = (typeof NORMALIZE_STEPS)[number];

export interface PuzzleHint {
  /** 1-indexed, contiguous, ascending. */
  level: number;
  text: string;
  /** Unlock cost in "attempts" or "coins" — API decides semantics; >= 0. */
  cost: number;
}

export interface PuzzleAnswers {
  /** Human-readable answer format, e.g. "string" | "number" | "color-list". */
  format: string;
  /** Ordered normalization pipeline. */
  normalize: NormalizeStep[];
  /** HMAC-SHA256 digests, hex, prefixed "sha256:" for clarity. */
  hashes: string[];
}

export interface PuzzleSolution {
  /** Reveal only after N failed attempts. */
  reveal_after: number;
  text: string;
}

export interface Puzzle {
  /** Unique across repo. Must match /^<author>-<type>-\d{3}$/. */
  id: string;
  author: string;
  type: PuzzleType;
  title: string;
  /** ISO date (YYYY-MM-DD) this puzzle is intended for. */
  date: string;
  /** 1..5 */
  difficulty: number;
  prompt: string;
  /** Type-specific payload; opaque to the engine, validated per-type. */
  payload: Record<string, unknown>;
  answers: PuzzleAnswers;
  hints: PuzzleHint[];
  solution?: PuzzleSolution;
}

/** Generated at build time: scripts/build-index.ts */
export interface PuzzleIndex {
  /** schema version */
  version: '0.1';
  generatedAt: string;
  /** date -> puzzle ids scheduled that day */
  rotation: Record<string, string[]>;
  /** id -> lightweight metadata for client hydration */
  puzzles: Record<
    string,
    {
      id: string;
      author: string;
      type: PuzzleType;
      title: string;
      difficulty: number;
      hintCount: number;
    }
  >;
}

export interface ValidationIssue {
  file: string;
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  puzzles: Puzzle[];
  issues: ValidationIssue[];
}
