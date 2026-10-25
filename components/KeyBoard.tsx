"use client";
// Lumi: client UI wiring everyone's lanes together.
import { useEffect, useState } from "react";
import type { PublicKey } from "@/lib/puzzles/public";
import { playRhythmPattern, playSfx, playHintChime, isSfxMuted, setSfxMuted } from "@/lib/sfx";
import { copyShareCardToClipboard } from "@/lib/share";
import { loadStreak, recordSolvePersisted, type StreakState } from "@/lib/streaks";

type KeyState = { solved: boolean; wrong: number; hints: string[]; msg: string; remaining: number | null };
const fresh = (): KeyState => ({ solved: false, wrong: 0, hints: [], msg: "", remaining: null });
const storeKey = (day: string) => `four-keys:progress:${day}`;

export default function KeyBoard({ day, keys }: { day: string; keys: PublicKey[] }) {
  const [state, setState] = useState<Record<string, KeyState>>({});
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [muted, setMuted] = useState(false);
  const [shareMsg, setShareMsg] = useState("");

  useEffect(() => {
    try { setState(JSON.parse(localStorage.getItem(storeKey(day)) || "{}")); } catch { /* fresh */ }
    setStreak(loadStreak());
    setMuted(isSfxMuted());
  }, [day]);

  const get = (id: string) => state[id] ?? fresh();
  const update = (id: string, patch: Partial<KeyState>) =>
    setState((prev) => {
      const next = { ...prev, [id]: { ...(prev[id] ?? fresh()), ...patch } };
      try { localStorage.setItem(storeKey(day), JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });

  const allSolved = keys.length > 0 && keys.every((k) => get(k.id).solved);

  async function submit(k: PublicKey, answer: string) {
    if (!answer.trim()) return;
    const res = await fetch("/api/v1/answers/check", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ puzzleId: k.id, answer, attemptId: crypto.randomUUID() }),
    });
    const data = await res.json().catch(() => ({}));
    const s = get(k.id);
    if (!res.ok) { update(k.id, { msg: data?.error?.message ?? "Something went wrong" }); return; }
    if (data.correct) {
      update(k.id, { solved: true, msg: "Unlocked!", remaining: data.attemptsRemaining });
      const willAll = keys.every((x) => x.id === k.id || get(x.id).solved);
      playSfx(willAll ? "vaultFanfare" : "keyUnlock");
      const flag = `four-keys:streak-recorded:${day}`;
      if (!localStorage.getItem(flag)) {
        setStreak(recordSolvePersisted({ assisted: s.hints.length > 0 }));
        localStorage.setItem(flag, "1");
      }
    } else {
      playSfx("wrong");
      update(k.id, { wrong: s.wrong + 1, msg: "Not quite.", remaining: data.attemptsRemaining });
    }
  }

  async function hint(k: PublicKey) {
    const s = get(k.id);
    const level = s.hints.length + 1;
    const res = await fetch("/api/v1/hints/unlock", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ puzzleId: k.id, level }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.hint) {
      playHintChime(level);
      update(k.id, { hints: [...s.hints, data.hint], msg: "" });
    } else if (data?.error?.code === "HINT_LOCKED") {
      update(k.id, { msg: `Try ${data.error.attemptsNeeded} more guess(es) to earn the next hint.` });
    } else update(k.id, { msg: data?.error?.message ?? "No hint available" });
  }

  async function share() {
    const r = await copyShareCardToClipboard({
      edition: day, streakDays: streak?.current,
      shareUrl: typeof window !== "undefined" ? window.location.origin : undefined,
      keys: keys.map((k) => ({ agentId: k.author, solved: get(k.id).solved, wrongAttempts: get(k.id).wrong, hintsUsed: get(k.id).hints.length })),
    });
    setShareMsg(r.copied ? "Copied! Paste it anywhere." : r.text);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-slate-400">
        <span>{day} (UTC)</span>
        <span>· {keys.filter((k) => get(k.id).solved).length}/{keys.length} keys</span>
        {streak && <span>· 🔥 streak {streak.current} (best {streak.longest})</span>}
        <button className="ml-auto rounded border border-slate-700 px-2 py-1 hover:bg-slate-800"
          onClick={() => { setSfxMuted(!muted); setMuted(!muted); }}>{muted ? "🔇 sound off" : "🔊 sound on"}</button>
      </div>

      <div className="grid gap-5">
        {keys.map((k, i) => <KeyCard key={k.id} k={k} index={i} s={get(k.id)} onSubmit={submit} onHint={hint} />)}
      </div>

      {allSolved && (
        <div className="mt-8 rounded-xl border border-amber-500/50 bg-amber-500/10 p-5 text-center">
          <p className="text-lg font-semibold">🔓 All keys unlocked!</p>
          <button onClick={share} className="mt-3 rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-300">Copy share card</button>
          {shareMsg && <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{shareMsg}</pre>}
        </div>
      )}
    </div>
  );
}

function KeyCard({ k, index, s, onSubmit, onHint }: {
  k: PublicKey; index: number; s: KeyState;
  onSubmit: (k: PublicKey, a: string) => Promise<void>; onHint: (k: PublicKey) => Promise<void>;
}) {
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const p = k.payload as Record<string, any>;
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  return (
    <section className={`rounded-xl border p-4 sm:p-5 ${s.solved ? "border-emerald-500/60 bg-emerald-500/5" : "border-slate-800 bg-slate-900/60"}`}>
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-amber-400">
        <span>Key {index + 1} · {k.author} · {k.type}</span>
        <span>{s.solved ? "🔑 unlocked" : "🔒"}</span>
      </div>
      <h2 className="mt-1 text-xl font-semibold">{k.title}</h2>

      {k.type === "logic-grid" && (
        <div className="mt-3 space-y-3 text-sm">
          {p.intro && <p className="text-slate-300">{p.intro}</p>}
          <div className="overflow-x-auto">
            <table className="text-left">
              <tbody>
                {Object.entries(p.grid as Record<string, string[]>).map(([cat, vals]) => (
                  <tr key={cat}><th className="pr-3 text-slate-400">{cat}</th>
                    {vals.map((v) => <td key={v} className="px-2 py-0.5">{v}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <ol className="list-decimal space-y-1 pl-5 text-slate-300">{(p.clues as string[]).map((c) => <li key={c}>{c}</li>)}</ol>
        </div>
      )}
      {k.type === "audio" && (
        <div className="mt-3 space-y-2 text-sm text-slate-300">
          {(p.lines as string[] | undefined)?.map((l) => <p key={l}>{l}</p>)}
          <button className="rounded-lg border border-slate-600 px-3 py-1.5 hover:bg-slate-800"
            onClick={() => playRhythmPattern(String(p.sequence), Number(p.bpm) || 110, { muted: false })}>▶ Play rhythm ({p.bpm} BPM)</button>
        </div>
      )}
      {k.type === "visual" && p.kind === "letter-square" && (
        <pre className="mt-3 inline-block rounded bg-slate-950 px-4 py-2 font-mono text-lg tracking-[0.5em]">{(p.rows as string[]).join("\n")}</pre>
      )}
      {k.type === "wordplay" && p.letters && (
        <p className="mt-3 font-mono text-lg tracking-widest text-sky-300">{p.letters}</p>
      )}

      <p className="mt-3">{k.prompt}</p>
      <p className="mt-1 text-xs text-slate-500">Answer format: {k.answerFormat}</p>

      {s.hints.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-sky-200">{s.hints.map((h, i) => <li key={i}>💡 {h}</li>)}</ul>
      )}

      {!s.solved && (
        <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); run(() => onSubmit(k, answer)); }}>
          <input value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={128} placeholder="Your answer"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-amber-400" />
          <div className="flex gap-2">
            <button disabled={busy} className="flex-1 rounded-lg bg-amber-400 px-4 py-2 font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-50">Unlock</button>
            <button type="button" disabled={busy || s.hints.length >= k.hintCount} onClick={() => run(() => onHint(k))}
              className="rounded-lg border border-slate-600 px-3 py-2 hover:bg-slate-800 disabled:opacity-40">Hint ({s.hints.length}/{k.hintCount})</button>
          </div>
        </form>
      )}
      {s.msg && <p className={`mt-2 text-sm ${s.solved ? "text-emerald-400" : "text-rose-300"}`}>{s.msg}{s.remaining != null && !s.solved ? ` ${s.remaining} tries left today.` : ""}</p>}
    </section>
  );
}
