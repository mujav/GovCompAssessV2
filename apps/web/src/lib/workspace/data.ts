// Operational dummy records behind the workspace screens. Built from the same 350 sample
// requirements the Admin Studio previews, so a published scoring change moves these numbers.

import { DEMO_TODAY, SAMPLE_REQUIREMENTS, type SampleRequirement } from "@/lib/admin/sample-data";
import type { WorkKey } from "@/lib/status";

/** Where a result sits in the human acceptance pipeline. Only "accepted" is official. */
export type ReviewStage = "none" | "ai" | "l1" | "l2" | "override" | "accepted";

export interface WsRequirement extends SampleRequirement {
  title: string;
  department: string;
  /** Empty when nobody has been assigned yet. */
  owner: string;
  work: WorkKey;
  due: string;
  review: ReviewStage;
  evidence: { expected: number; valid: number; invalid: number };
}

export interface WsAction {
  id: string;
  code: string;
  department: string;
  owner: string;
  due: string;
  reminders: number;
  status: "open" | "done";
}

export interface EvidenceIssue {
  id: string;
  code: string;
  problem: string;
}

export interface Clarification {
  id: string;
  title: string;
  affects: string[];
}

export const TODAY = DEMO_TODAY;
export const SUBMISSION_DEADLINE = "2026-11-20";

export const DEPARTMENTS: Record<string, { name: string; people: string[] }> = {
  "Strategy & governance": { name: "Strategy & Performance", people: ["Faisal R.", "Lama S."] },
  "Digital services": { name: "Digital Transformation", people: ["Reem A.", "Omar K.", "Sara H."] },
  "Technology & integration": { name: "IT Operations", people: ["Khalid M.", "Yousef T."] },
  "Human capital": { name: "Human Capital", people: ["Huda B.", "Nasser Q."] },
  "Data & analytics": { name: "Data Office", people: ["Abdullah Z.", "Mona F."] },
  "Beneficiary experience": { name: "Customer Experience", people: ["Rana J.", "Tariq W."] },
};

const TOPICS: Record<string, string[]> = {
  "Strategy & governance": ["Digital strategy approved", "Governance committee charter", "Annual roadmap reviewed", "KPIs linked to strategy", "Risk register maintained"],
  "Digital services": ["Digital services catalogue", "Service-level KPIs published", "Services available end-to-end", "Unified sign-in adopted", "Service journeys documented"],
  "Technology & integration": ["Integration register approved", "End-to-end integration samples", "Architecture repository current", "Cloud adoption plan", "Shared platforms reused"],
  "Human capital": ["Digital capability plan", "Digital roles in org structure", "Training needs analysis", "Digital competency framework", "Succession plan for digital roles"],
  "Data & analytics": ["Data governance committee", "Data catalogue published", "Open data released", "Data quality measured", "Master data defined"],
  "Beneficiary experience": ["Feedback closes the loop", "Satisfaction measured", "Accessibility tested", "Complaints analysed", "Channels integrated"],
};

// Each standard has four requirements, one per aspect.
const ASPECTS = ["defined", "in place", "in use", "reviewed"];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function shortDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });
}

function pickWork(status: SampleRequirement["status"], r: number): WorkKey {
  if (status === "comp") return r < 0.8 ? "closed" : "ready";
  if (status === "na") return "closed";
  if (status === "nas") return r < 0.4 ? "none" : r < 0.7 ? "start" : "prog";
  return r < 0.25 ? "none" : r < 0.45 ? "update" : r < 0.65 ? "prog" : r < 0.8 ? "returned" : r < 0.92 ? "review" : "evsub";
}

function pickReview(status: SampleRequirement["status"], r: number): ReviewStage {
  if (status === "nas" || status === "na") return status === "na" ? "accepted" : r < 0.3 ? "ai" : "none";
  return r < 0.72 ? "accepted" : r < 0.82 ? "l1" : r < 0.9 ? "l2" : r < 0.95 ? "override" : "ai";
}

export function buildRequirements(source = SAMPLE_REQUIREMENTS): WsRequirement[] {
  const rand = mulberry32(4317);
  const topicIndex: Record<string, number> = {};
  return source.map((s) => {
    const dept = DEPARTMENTS[s.domain];
    const topics = TOPICS[s.domain];
    const n = (topicIndex[s.domain] = (topicIndex[s.domain] ?? -1) + 1);
    const work = pickWork(s.status, rand());
    const done = work === "closed" || work === "ready";
    const due = addDays(TODAY, done ? -Math.floor(rand() * 40) - 5 : Math.floor(rand() * 34) - 12);
    const expected = s.weight === "high" ? 3 : 2;
    const valid = s.status === "comp" ? expected : s.status === "part" ? 1 : s.status === "non" ? Math.floor(rand() * 2) : 0;
    const invalid = !done && rand() < 0.04 ? 1 : 0;
    // A handful of open requirements have no owner yet.
    const owner = !done && rand() < 0.03 ? "" : dept.people[n % dept.people.length];
    return {
      ...s,
      title: `${topics[Math.floor(n / 4) % topics.length]}: ${ASPECTS[n % 4]}`,
      department: dept.name,
      owner,
      work,
      due,
      review: pickReview(s.status, rand()),
      evidence: { expected, valid, invalid },
    };
  });
}

export const WS_REQUIREMENTS = buildRequirements();

/** One open remediation action per open, applicable requirement that is not compliant. */
export function buildActions(reqs: WsRequirement[]): WsAction[] {
  const rand = mulberry32(118);
  return reqs
    .filter((r) => r.status !== "comp" && r.status !== "na" && r.work !== "closed")
    .map((r, i) => {
      const overdue = r.due < TODAY;
      return {
        id: `ACT-${100 + i}`,
        code: r.code,
        department: r.department,
        owner: r.owner,
        due: r.due,
        reminders: overdue ? 1 + Math.floor(rand() * 3) : Math.floor(rand() * 2),
        status: "open" as const,
      };
    });
}

export const WS_ACTIONS = buildActions(WS_REQUIREMENTS);

const PROBLEMS = ["Covers the wrong reporting period", "Approval signature missing", "Scan is unreadable", "Document is a draft, not the approved version"];

export const EVIDENCE_ISSUES: EvidenceIssue[] = WS_REQUIREMENTS.filter((r) => r.evidence.invalid > 0).map((r, i) => ({
  id: `EV-${2041 + i * 3}`,
  code: r.code,
  problem: PROBLEMS[i % PROBLEMS.length],
}));

export const CLARIFICATIONS: Clarification[] = [
  {
    id: "CL-014",
    title: "Implementation evidence must come from the current cycle",
    affects: WS_REQUIREMENTS.filter((r) => r.domain === "Technology & integration" && r.weight === "high").slice(0, 6).map((r) => r.code),
  },
];

/**
 * Readiness at each weekly snapshot, relative to the current projected score. The last
 * entry is "now"; the prior cycle line is a fixed series.
 */
export const TREND_OFFSETS = [-14.4, -12.6, -10.8, -8.9, -6.4, -3.6, 2.1, 0];
export const PRIOR_CYCLE = [52, 54, 55, 57, 59, 61, 63, 65.6];
