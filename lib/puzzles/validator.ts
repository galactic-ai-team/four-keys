// lib/puzzles/validator.ts
// Schema validator for puzzle JSON v0.1. No external deps.
// Per-type payload sub-schemas are registered by their owners
// (Claude: logic-grid, Gemini: audio) via registerPayloadValidator.

import {
  NORMALIZE_STEPS,
  PUZZLE_TYPES,
  type NormalizeStep,
  type Puzzle,
  type PuzzleType,
  type ValidationIssue,
} from './types';

export type PayloadValidator = (payload: unknown) => string[] | null;

const payloadValidators = new Map<PuzzleType, PayloadValidator>();

export function registerPayloadValidator(
  type: PuzzleType,
  fn: PayloadValidator,
): void {
  payloadValidators.set(type, fn);
}

const ID_RE = /^([a-z0-9]+)-(logic-grid|wordplay|audio|visual)-(\d{3})$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const HASH_RE = /^sha256:[0-9a-f]{64}$/;

function isString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

function isNonNegInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

export function validatePuzzle(
  raw: unknown,
  file: string,
): { puzzle: Puzzle | null; issues: ValidationIssue[] } {
  const issues: ValidationIssue[] = [];
  const err = (path: string, message: string) =>
    issues.push({ file, path, message });

  if (typeof raw !== 'object' || raw === null) {
    err('$', 'puzzle must be a JSON object');
    return { puzzle: null, issues };
  }
  const p = raw as Record<string, unknown>;

  // Required string fields
  for (const key of ['id', 'author', 'title', 'date', 'prompt'] as const) {
    if (!isString(p[key])) err(key, `"${key}" must be a non-empty string`);
  }

  // id format
  if (isString(p.id)) {
    const m = ID_RE.exec(p.id);
    if (!m) {
      err('id', 'must match <author>-<type>-<nnn>, e.g. claude-logic-grid-001');
    } else if (isString(p.author) && m[1] !== p.author) {
      err('id', `author segment "${m[1]}" does not match author "${p.author}"`);
    } else if (isString(p.type) && m[2] !== p.type) {
      err('id', `type segment "${m[2]}" does not match type "${p.type}"`);
    }
  }

  // type
  if (!isString(p.type) || !PUZZLE_TYPES.includes(p.type as PuzzleType)) {
    err('type', `must be one of: ${PUZZLE_TYPES.join(', ')}`);
  }

  // date
  if (isString(p.date) && !DATE_RE.test(p.date)) {
    err('date', 'must be YYYY-MM-DD');
  }

  // difficulty
  if (
    typeof p.difficulty !== 'number' ||
    !Number.isInteger(p.difficulty) ||
    p.difficulty < 1 ||
    p.difficulty > 5
  ) {
    err('difficulty', 'must be an integer 1..5');
  }

  // payload
  if (typeof p.payload !== 'object' || p.payload === null) {
    err('payload', 'must be an object');
  } else if (isString(p.type) && PUZZLE_TYPES.includes(p.type as PuzzleType)) {
    const fn = payloadValidators.get(p.type as PuzzleType);
    if (!fn) {
      err('payload', `no payload validator registered for type "${p.type}"`);
    } else {
      const payloadIssues = fn(p.payload);
      if (payloadIssues) {
        for (const msg of payloadIssues) err('payload', msg);
      }
    }
  }

  // answers
  const a = p.answers as Record<string, unknown> | undefined;
  if (typeof a !== 'object' || a === null) {
    err('answers', 'must be an object');
  } else {
    if (!isString(a.format)) err('answers.format', 'must be a string');
    if (!Array.isArray(a.normalize) || a.normalize.length === 0) {
      err('answers.normalize', 'must be a non-empty array');
    } else {
      a.normalize.forEach((step, i) => {
        if (!NORMALIZE_STEPS.includes(step as NormalizeStep)) {
          err(
            `answers.normalize[${i}]`,
            `unknown step "${String(step)}"; allowed: ${NORMALIZE_STEPS.join(', ')}`,
          );
        }
      });
    }
    if (!Array.isArray(a.hashes) || a.hashes.length === 0) {
      err('answers.hashes', 'must be a non-empty array');
    } else {
      a.hashes.forEach((h, i) => {
        if (typeof h !== 'string' || !HASH_RE.test(h)) {
          err(`answers.hashes[${i}]`, 'must be "sha256:<64 hex chars>"');
        }
      });
    }
  }

  // hints
  if (!Array.isArray(p.hints) || p.hints.length === 0) {
    err('hints', 'must be a non-empty array');
  } else {
    let prev = 0;
    p.hints.forEach((h, i) => {
      if (typeof h !== 'object' || h === null) {
        err(`hints[${i}]`, 'must be an object');
        return;
      }
      const hint = h as Record<string, unknown>;
      if (!isNonNegInt(hint.level) || hint.level === 0) {
        err(`hints[${i}].level`, 'must be an integer >= 1');
      } else {
        if (hint.level !== prev + 1) {
          err(`hints[${i}].level`, `expected ${prev + 1}, got ${hint.level} (no gaps)`);
        }
        prev = hint.level as number;
      }
      if (!isString(hint.text)) err(`hints[${i}].text`, 'must be a non-empty string');
      if (!isNonNegInt(hint.cost)) err(`hints[${i}].cost`, 'must be an integer >= 0');
    });
  }

  // solution (optional)
  if (p.solution !== undefined) {
    const s = p.solution as Record<string, unknown>;
    if (typeof s !== 'object' || s === null) {
      err('solution', 'must be an object');
    } else {
      if (!isNonNegInt(s.reveal_after)) {
        err('solution.reveal_after', 'must be an integer >= 0');
      }
      if (!isString(s.text)) err('solution.text', 'must be a non-empty string');
    }
  }

  if (issues.length > 0) return { puzzle: null, issues };
  return { puzzle: p as unknown as Puzzle, issues };
}

/** Validates a batch, also enforcing global id uniqueness. */
export function validateAll(
  entries: { file: string; raw: unknown }[],
): { puzzles: Puzzle[]; issues: ValidationIssue[] } {
  const puzzles: Puzzle[] = [];
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, string>();

  for (const { file, raw } of entries) {
    const { puzzle, issues: local } = validatePuzzle(raw, file);
    issues.push(...local);
    if (!puzzle) continue;
    const prior = seen.get(puzzle.id);
    if (prior) {
      issues.push({
        file,
        path: 'id',
        message: `duplicate id "${puzzle.id}" (also in ${prior})`,
      });
      continue;
    }
    seen.set(puzzle.id, file);
    puzzles.push(puzzle);
  }
  return { puzzles, issues };
}
