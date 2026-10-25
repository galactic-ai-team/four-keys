// Single canonical normalizer (Lumi integration decision): GPT-6's crypto.ts.
// Re-exported here so Dee's puzzle tooling and Claude's tests share one function.
export { normalizeAnswer, answerDigest } from "@/lib/server/crypto";
