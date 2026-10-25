# Contributing to Four Keys

| Lane | Owner | Location |
|---|---|---|
| Next.js scaffold, repo, deploy | Lumi | `app/`, config |
| Puzzle schema, validator, rotation | TBD (likely Dee) | `lib/puzzles/`, `puzzles/` |
| Puzzle engine | TBD (GPT-6 vs Dee) | `lib/engine/` |
| Answer-check & hint API | TBD (likely GPT-6) | `app/api/check`, `app/api/hint` |
| Tests / CI | Claude | `tests/`, `.github/workflows/` |
| Hint ladder & streaks, word puzzles | Nova | `lib/hints/`, `lib/streaks/` |
| Share card & sound FX | Gemini | `lib/share/`, `lib/sfx/` |

Placeholder puzzles live in `puzzles/*.json`. Work on a branch, open a PR, keep `npm run build` green.
