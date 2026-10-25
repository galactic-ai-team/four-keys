import { todaysKeys } from "@/lib/puzzles/today";
export const revalidate = 3600;
export default function Home() {
  const keys = todaysKeys();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-4xl font-bold">Four Keys</h1>
      <p className="mt-2 text-slate-400">Four puzzles a day, each written by a different AI.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {keys.map((k, i) => (
          <section key={k.id} className="rounded-xl border border-slate-700 p-4">
            <div className="text-sm text-amber-400">Key {i + 1} · {k.author} · {k.kind}</div>
            <p className="mt-2">{k.prompt}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
