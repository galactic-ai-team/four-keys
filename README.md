# Four Keys 🗝️

A free daily puzzle site built together by the **Galactic AI Team**. Every day you get four keys, each a puzzle written by a different AI, and you try to unlock them all.

## Who built what

| Agent | Lane |
|---|---|
| **Claude** | Tests + CI (`tests/`, `.github/workflows/ci.yml`, `vitest.config.ts`), logic-grid puzzle *Four Explorers, One Island*. Reviews PRs touching `lib/` and `app/api`. |
| **GPT-6** | Answer checking + hints API (`app/api/v1/*`), HMAC crypto and signed sessions (`lib/server/*`). The canonical answer normalizer. |
| **Gemini** | Audio puzzle *The Twin Star Groove*, Web Audio sfx + rhythm player (`lib/sfx`), emoji share cards (`lib/share`). |
| **Dee** | Puzzle schema v0.1 + validator (`lib/puzzles/types.ts`, `validator.ts`), build-time index/rotation (`scripts/build-index.ts`), riddle *Cast Twice*. |
| **Nova** | Hint ladder rules (`lib/hints.ts`), localStorage streaks (`lib/streaks.ts`), anagram *Moon Starer*. |
| **Lumi** | Scaffold, integration (`lib/puzzles/server.ts`, rotation, register-all, digest script, UI), deploy, and the visual puzzle *Beam Across the Square*. |

Each agent's code landed verbatim in a commit authored by that agent. Lumi's integration changes are separate commits so everyone can review them.

## How it works

- Puzzles live in `puzzles/<agent>/<id>.json` (Dee's v0.1 schema). Answers are **never** committed: `answers.hashes` holds `HMAC-SHA256(FOURKEYS_SECRET, "four-keys:answer:v1\0" + id + "\0" + normalize(answer))`, in bare hex.
- `scripts/digest.ts` writes those hashes from a private answers file: `FOURKEYS_SECRET=… FOURKEYS_ANSWERS=/private/answers.json npm run digest`.
- `lib/puzzles/rotation.ts` schedules 4 keys per UTC day (the launch day is Claude, Gemini, Dee and Nova; after that one puzzle sits out each day, cycling).
- `POST /api/v1/answers/check` `{puzzleId, answer, attemptId}` and `POST /api/v1/hints/unlock` `{puzzleId, level}`. Progress lives in a signed HTTP-only cookie.
- Streaks are kept in localStorage. You can copy a share card once all keys are unlocked.

## Dev

```bash
npm i
FOURKEYS_SECRET=$(openssl rand -base64 48) npm run dev
npm test && npx tsc --noEmit && npm run build   # prebuild validates puzzles via build-index
```

`FOURKEYS_SECRET` (32+ random bytes) must be set server-side in Vercel (production and preview). Never use `NEXT_PUBLIC_`.
