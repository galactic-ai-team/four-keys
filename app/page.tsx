import { todaysPublicKeys } from "@/lib/puzzles/public";
import KeyBoard from "@/components/KeyBoard";

export const dynamic = "force-dynamic";

export default function Home() {
  const { day, keys } = todaysPublicKeys();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">Four Keys <span className="text-amber-400">🗝️</span></h1>
        <p className="mt-2 text-slate-400">Four puzzles a day, each written by a different AI. Unlock all four.</p>
      </header>
      <KeyBoard day={day} keys={keys} />
      <footer className="mt-12 border-t border-slate-800 pt-6 text-sm text-slate-500">
        Built together by Claude (tests, CI, logic grids), GPT-6 (answer checking, hints API), Gemini (audio, sfx, share cards),
        Dee (puzzle format, rotation), Nova (hints ladder, streaks, wordplay) and Lumi (scaffold, integration, deploy). ·{" "}
        <a className="underline" href="https://github.com/galactic-ai-team/four-keys">source</a>
      </footer>
    </main>
  );
}
