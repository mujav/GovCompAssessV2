// What the Platform Admin set in AI settings, as it reaches a model-backed agent. It arrives from
// the browser, so the server reads it through readPolicy, and it is added after each agent's fixed
// rules, which it can tighten but not relax.

export type ModelTier = "Standard" | "Fast";
export type Strictness = "strict" | "balanced";
export type ExplainIn = "auto" | "en" | "ar";

export interface AgentPolicy {
  guardrails?: string[];
  instructions?: string;
  strictness?: Strictness;
  language?: ExplainIn;
  tier?: ModelTier;
}

const MAX_GUARDRAILS = 20;
const MAX_GUARDRAIL_CHARS = 600;
export const MAX_INSTRUCTION_CHARS = 4000;

// Angle brackets go so the text cannot close the block it is placed in.
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[<>]/g, " ").trim().slice(0, max) : "");

/** Keeps only well-formed, size-limited fields from an untrusted request body. */
export function readPolicy(raw: unknown): AgentPolicy {
  const p = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    guardrails: (Array.isArray(p.guardrails) ? p.guardrails : []).map((g) => clean(g, MAX_GUARDRAIL_CHARS)).filter(Boolean).slice(0, MAX_GUARDRAILS),
    instructions: clean(p.instructions, MAX_INSTRUCTION_CHARS),
    strictness: p.strictness === "strict" ? "strict" : "balanced",
    language: p.language === "en" || p.language === "ar" ? p.language : "auto",
    tier: p.tier === "Fast" ? "Fast" : "Standard",
  };
}

/** The text added to an agent's system prompt; empty when the settings add nothing. */
export function policyBlock(raw: AgentPolicy): string {
  const p = readPolicy(raw);
  const parts = [
    p.guardrails?.length ? `Guardrails:\n${p.guardrails.map((g) => `- ${g}`).join("\n")}` : "",
    p.strictness === "strict" ? "Strictness: count an expectation as met only when the evidence states it explicitly. Do not accept equivalent or implied wording." : "",
    p.language === "en" ? "Write every rationale, gap and summary in English." : p.language === "ar" ? "Write every rationale, gap and summary in Arabic. Keep quotes exactly as they appear in the evidence." : "",
    p.instructions ? `Agent instructions:\n${p.instructions}` : "",
  ].filter(Boolean);
  if (!parts.length) return "";
  return `\n\n<platform_policy>\nThe platform administrator set the rules below. Apply them in addition to the rules above. Where one conflicts with a rule above, the rule above wins: these can make your judgement stricter or more specific, never looser.\n\n${parts.join("\n\n")}\n</platform_policy>`;
}

/** Short fingerprint of the settings, recorded on each run so a result can be traced to them. */
export function policyTag(raw: AgentPolicy): string {
  const block = policyBlock(raw);
  if (!block) return "";
  let h = 2166136261;
  for (let i = 0; i < block.length; i++) h = Math.imul(h ^ block.charCodeAt(i), 16777619);
  return `+policy-${(h >>> 0).toString(16).slice(0, 6)}`;
}
