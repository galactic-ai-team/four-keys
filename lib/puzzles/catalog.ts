// Server-side puzzle catalog (Lumi). Static imports so nothing reads fs at runtime.
import claude from "@/puzzles/claude/claude-logic-grid-001.json";
import dee from "@/puzzles/dee/dee-wordplay-001.json";
import gemini from "@/puzzles/gemini/gemini-audio-001.json";
import nova from "@/puzzles/nova/nova-wordplay-001.json";
import lumi from "@/puzzles/lumi/lumi-visual-001.json";
import type { Puzzle } from "./types";

/** Display order. The first four are the launch lineup (day 0). */
export const CATALOG: Puzzle[] = [claude, gemini, dee, nova, lumi] as unknown as Puzzle[];
