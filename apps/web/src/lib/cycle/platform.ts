// Platform-wide settings the Platform Admin keeps: entity sector and annex list, and the AI
// settings every workspace follows. Stored in the journey store under PLATFORM_KEY.

import { DEFAULT_THRESHOLDS, type Thresholds } from "./model";

export type Sector = "Ministry" | "Authority" | "Agency" | "Municipality";
export type AnnexList = "A" | "B" | "C";

export interface EntityMeta {
  nameAr?: string;
  sector?: Sector;
  annex?: AnnexList;
  contact?: string;
  /** Logo as a data URL. */
  logo?: string;
  status?: "Active" | "Inactive";
}

export type AgentKey = "review" | "selfCheck" | "advisor" | "remediation" | "monitor" | "parser";

export const AGENTS: { key: AgentKey; name: string; does: string; who: string; model: "Standard" | "Fast"; when: string }[] = [
  { key: "review", name: "Evidence Review", does: "Checks each file against its requirement: date, approval, samples, page reference", who: "Index Owner", model: "Standard", when: "On submit, on re-assess" },
  { key: "selfCheck", name: "Evidence Self-check", does: "Pass / needs attention hint per file, no criticality", who: "Control Owner", model: "Fast", when: "When the owner asks" },
  { key: "advisor", name: "Response Advisor", does: "Suggests missing coverage and page references in the response", who: "Index Owner", model: "Standard", when: "In the review console" },
  { key: "remediation", name: "Remediation Planner", does: "Ranked correction actions by criticality", who: "Index Owner", model: "Standard", when: "After review" },
  { key: "monitor", name: "Delay and Attention Monitor", does: "Overdue, at-risk and stale items with drafted follow-ups", who: "Index Owner", model: "Fast", when: "Daily 07:00" },
  { key: "parser", name: "Standard Parser", does: "Drafts a standard tree from a PDF for human review", who: "Platform Admin", model: "Standard", when: "On upload" },
];

export const GUARDRAILS: [string, string][] = [
  ["Follow the standard strictly", "Judge only against the requirement text and the Index Owner instructions"],
  ["Never edit documents", "Agents read files; they never change or re-save them"],
  ["No decisions", "Accept, return and scores are always human decisions"],
  ["Findings for the Index Owner", "Control Owners see only the self-check hint"],
  ["Ranked by criticality", "Every finding carries a criticality and a page reference"],
];

export interface AiSettings {
  provider: "Anthropic" | "OpenAI" | "Azure OpenAI";
  /** Last four characters of the key, never the key itself. */
  keyHint?: string;
  testedAt?: string;
  cap: number;
  spend: number;
  runs: number;
  agents: Record<AgentKey, boolean>;
  models: Record<AgentKey, "Standard" | "Fast">;
  thresholds: Thresholds;
  criticality: string[];
  data: { noTraining: boolean; mask: boolean; web: boolean; keepDays: number };
}

export const DEFAULT_AI: AiSettings = {
  provider: "Anthropic",
  cap: 1500,
  spend: 412,
  runs: 3482,
  agents: { review: true, selfCheck: true, advisor: true, remediation: true, monitor: true, parser: false },
  models: Object.fromEntries(AGENTS.map((a) => [a.key, a.model])) as AiSettings["models"],
  thresholds: DEFAULT_THRESHOLDS,
  criticality: ["Missing approval or signature", "Wrong period or outdated", "Evidence missing", "Page reference missing"],
  data: { noTraining: true, mask: true, web: false, keepDays: 180 },
};

export interface PlatformState {
  entities: Record<string, EntityMeta>;
  ai: AiSettings;
  /** "Forgot password?" requests waiting for the Platform Admin. */
  resets: { email: string; at: string }[];
}

export const PLATFORM_KEY = "platform";

/** Seeded sector and annex list for the demo entities. */
export const DEFAULT_PLATFORM: PlatformState = {
  entities: {
    "demo-entity": { sector: "Authority", annex: "A", contact: "pmo@demo-entity.sa" },
    "demo-ministry": { sector: "Ministry", annex: "A", contact: "dt@demo-ministry.sa" },
    "demo-commission": { sector: "Authority", annex: "B", contact: "office@demo-commission.sa" },
    "demo-health": { sector: "Agency", annex: "B" },
    "demo-university": { sector: "Agency", annex: "C" },
    "demo-ports": { sector: "Authority", annex: "B" },
    "demo-water": { sector: "Agency", annex: "C" },
    "demo-skills": { sector: "Agency", annex: "C" },
  },
  ai: DEFAULT_AI,
  resets: [],
};

/** Sector from the entity's own description when the admin has not set one. */
export function sectorFrom(sub: string): Sector {
  if (/ministry/i.test(sub)) return "Ministry";
  if (/municipal/i.test(sub)) return "Municipality";
  if (/authority|commission/i.test(sub)) return "Authority";
  return "Agency";
}

/** Masks national IDs, phone numbers and emails in evidence text before it is sent to the model. */
export function maskPersonal(text: string) {
  return text
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/(?:\+?966|0)5\d{8}\b/g, "[phone]")
    .replace(/\b[12]\d{9}\b/g, "[national ID]");
}
