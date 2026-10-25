// Minimal per-type payload validators (Lumi, integration). Owners may tighten:
// Claude -> logic-grid, Gemini -> audio, Nova/Dee -> wordplay, Lumi -> visual.
import { registerPayloadValidator } from "./validator";

const obj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const strArr = (v: unknown) => Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === "string" && s.length > 0);

registerPayloadValidator("logic-grid", (p) => {
  if (!obj(p)) return ["payload must be an object"];
  const out: string[] = [];
  if (!obj(p.grid) || Object.values(p.grid).length < 2 || !Object.values(p.grid).every(strArr)) out.push("grid must map >=2 categories to string arrays");
  else {
    const sizes = new Set(Object.values(p.grid).map((a) => (a as string[]).length));
    if (sizes.size !== 1) out.push("grid categories must all be the same size");
  }
  if (!strArr(p.clues)) out.push("clues must be a non-empty string array");
  return out.length ? out : null;
});

registerPayloadValidator("audio", (p) => {
  if (!obj(p)) return ["payload must be an object"];
  const out: string[] = [];
  if (typeof p.bpm !== "number" || p.bpm < 30 || p.bpm > 300) out.push("bpm must be a number 30..300");
  if (typeof p.sequence !== "string" || !/^[RL._\-/ ]+$/i.test(p.sequence)) out.push("sequence must use R/L/./-/_ tokens");
  if (p.lines !== undefined && !strArr(p.lines)) out.push("lines must be a string array");
  return out.length ? out : null;
});

registerPayloadValidator("wordplay", (p) => {
  if (!obj(p)) return ["payload must be an object"];
  if (typeof p.kind !== "string" || !p.kind) return ["kind must be a non-empty string"];
  if (p.letters !== undefined && typeof p.letters !== "string") return ["letters must be a string"];
  return null;
});

registerPayloadValidator("visual", (p) => {
  if (!obj(p)) return ["payload must be an object"];
  if (typeof p.kind !== "string") return ["kind must be a string"];
  if (p.kind === "letter-square") {
    const rows = p.rows;
    if (!strArr(rows) || !(rows as string[]).every((r) => r.length === (rows as string[]).length)) return ["rows must form an NxN square"];
  }
  return null;
});
