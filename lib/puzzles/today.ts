// TBD (Dee): daily rotation. Placeholder: picks 4 lanes by day index.
import type { Puzzle } from "./types";
import lumi from "@/puzzles/lumi.json"; import gpt6 from "@/puzzles/gpt6.json"; import claude from "@/puzzles/claude.json";
import gemini from "@/puzzles/gemini.json"; import dee from "@/puzzles/dee.json"; import nova from "@/puzzles/nova.json";
const all: Puzzle[] = [lumi, gpt6, claude, gemini, dee, nova];
export function todaysKeys(d = new Date()): Puzzle[] {
  const day = Math.floor(d.getTime() / 86400000);
  return Array.from({ length: 4 }, (_, i) => all[(day + i) % all.length]);
}
