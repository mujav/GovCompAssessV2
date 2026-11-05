// Operational demo records behind the workspace screens, built from the published standards in
// the library: DGA's Qiyas V5.0 and NCA's ECC-2:2024. Each record is one requirement of the real
// standard with its own wording and evidence list; only the progress on it (owner, dates, stage,
// last result) is demo data.

import { DEMO_TODAY, type SampleRequirement } from "@/lib/admin/sample-data";
import { ECC_REQUIREMENTS } from "@/lib/admin/ecc-2024";
import { QIYAS_V5_REQUIREMENTS } from "@/lib/admin/qiyas-v5";
import type { FrameworkRequirement } from "@/lib/admin/types";
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
  /** Library framework the record belongs to. */
  frameworkId?: string;
  /** Codes of the control, domain and dimension the requirement sits under in its standard; read off the code when absent. */
  controlCode?: string;
  domainCode?: string;
  dimensionCode?: string;
  /** The requirement's detail in the standard, and the evidence items it asks for, one per line. */
  text?: string;
  evidenceText?: string;
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

/** Which department area answers each top-level part of a standard. */
const AREA: Record<string, keyof typeof DEPARTMENTS> = {
  // Qiyas V5.0 perspectives
  P1: "Strategy & governance",
  P2: "Human capital",
  P3: "Digital services",
  P4: "Strategy & governance",
  P5: "Technology & integration",
  P6: "Data & analytics",
  P7: "Digital services",
  P8: "Beneficiary experience",
  P9: "Beneficiary experience",
  P10: "Data & analytics",
  // NCA ECC-2:2024 main domains
  "1": "Strategy & governance",
  "2": "Technology & integration",
  "3": "Technology & integration",
  "4": "Data & analytics",
};

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

function pickStatus(r: number): SampleRequirement["status"] {
  return r < 0.56 ? "comp" : r < 0.75 ? "part" : r < 0.85 ? "non" : r < 0.97 ? "nas" : "na";
}

/** A requirement as the standard defines it, before any progress on it. */
export interface StandardUnit {
  code: string;
  title: string;
  text?: string;
  /** Evidence items the standard asks for. */
  evidence: string[];
  controlCode: string;
  domainCode: string;
  dimensionCode: string;
  dimensionName: string;
}

const nodeTitle = (n: FrameworkRequirement) => n.title || n.titleAr || n.code;

/** "1) Attach …\n2) …" → ["Attach …", "…"]. */
function evidenceItems(text: string | undefined) {
  return (text ?? "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => /^\d+\s*[).]/.test(l))
    .map((l) => l.replace(/^\d+\s*[).]\s*/, ""));
}

/**
 * The assessed units of a standard: each implementation requirement or subcontrol under its
 * control, or the control itself when it has none. The control's evidence list is shared out in
 * order, one item per requirement, as Qiyas lists them; the last requirement takes any extra.
 */
export function standardUnits(nodes: FrameworkRequirement[], fallbackEvidence: (n: FrameworkRequirement, control: FrameworkRequirement) => string[] = () => []): StandardUnit[] {
  const byCode = new Map(nodes.map((n) => [n.code, n]));
  const top = (n: FrameworkRequirement) => {
    let cur = n;
    for (let g = 0; cur.parent && byCode.has(cur.parent) && g < 8; g++) cur = byCode.get(cur.parent)!;
    return cur;
  };
  return nodes
    .filter((n) => n.level === "lv-3")
    .flatMap((control) => {
      const subs = nodes.filter((k) => k.parent === control.code && k.level === "lv-4");
      const list = subs.length ? subs : [control];
      const items = evidenceItems(control.evidenceAr ?? control.evidence);
      const dim = top(control);
      return list.map((n, i) => {
        const own = items.length >= list.length ? (i === list.length - 1 ? items.slice(i) : [items[i]]) : items[i] ? [items[i]] : [];
        return {
          code: n.code,
          title: nodeTitle(n),
          text: n === control ? n.text ?? n.textAr : [n.text ?? n.textAr, subs.length && !n.text && !n.textAr ? nodeTitle(control) : ""].filter(Boolean).join("\n") || undefined,
          evidence: own.length ? own : fallbackEvidence(n, control),
          controlCode: control.code,
          domainCode: control.parent ?? control.code,
          dimensionCode: dim.code,
          dimensionName: nodeTitle(dim),
        };
      });
    });
}

/** NCA ECC publishes no evidence list; ask for what an assessor checks on every control. */
const eccEvidence = (n: FrameworkRequirement, control: FrameworkRequirement) => [
  `Approved policy, procedure or standard that covers control ${control.code}`,
  `Records from this cycle showing ${n === control ? "the control" : `subcontrol ${n.code}`} is implemented (logs, reports or screenshots)`,
];

/** Demo progress on every requirement of a standard: last result, stage, owner, due date and evidence received. */
export function buildRequirements(frameworkId: string, units: StandardUnit[], seed: number): WsRequirement[] {
  const rand = mulberry32(seed);
  const areaOf = (u: StandardUnit) => AREA[u.dimensionCode] ?? "Strategy & governance";
  // Each control has one owner: controls take turns among their area's people.
  const turn = new Map<string, number>();
  const count: Record<string, number> = {};
  for (const u of units) if (!turn.has(u.controlCode)) turn.set(u.controlCode, (count[areaOf(u)] = (count[areaOf(u)] ?? -1) + 1));
  return units.map((u) => {
    const area = areaOf(u);
    const dept = DEPARTMENTS[area];
    const status = pickStatus(rand());
    const work = pickWork(status, rand());
    const done = work === "closed" || work === "ready";
    const due = addDays(TODAY, done ? -Math.floor(rand() * 40) - 5 : Math.floor(rand() * 34) - 12);
    const expected = Math.max(1, u.evidence.length);
    const valid = status === "comp" ? expected : status === "part" ? Math.max(1, expected - 1) : status === "non" ? Math.floor(rand() * 2) : 0;
    const invalid = !done && rand() < 0.04 ? 1 : 0;
    // A handful of open requirements have no owner yet.
    const owner = !done && rand() < 0.03 ? "" : dept.people[turn.get(u.controlCode)! % dept.people.length];
    const weight: SampleRequirement["weight"] = rand() < 0.3 ? "high" : rand() < 0.7 ? "med" : "low";
    return {
      code: u.code,
      domain: u.dimensionName,
      weight,
      status,
      mandatoryFail: status === "part" && rand() < 0.33,
      title: u.title,
      department: dept.name,
      owner,
      work,
      due,
      review: pickReview(status, rand()),
      evidence: { expected, valid: Math.min(valid, expected), invalid },
      frameworkId,
      controlCode: u.controlCode,
      domainCode: u.domainCode,
      dimensionCode: u.dimensionCode,
      text: u.text,
      evidenceText: u.evidence.join("\n"),
    };
  });
}

/** Demo records per library framework. */
export const QIYAS_RECORDS = buildRequirements("fw-qiyas", standardUnits(QIYAS_V5_REQUIREMENTS), 4317);
export const ECC_RECORDS = buildRequirements("fw-nca", standardUnits(ECC_REQUIREMENTS, eccEvidence), 5120);

export const WS_REQUIREMENTS = [...QIYAS_RECORDS, ...ECC_RECORDS];

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
    // The information technology perspective (P5) of Qiyas V5.0.
    affects: QIYAS_RECORDS.filter((r) => r.dimensionCode === "P5" && r.weight === "high").slice(0, 6).map((r) => r.code),
  },
];

/**
 * Readiness at each weekly snapshot, relative to the current projected score. The last
 * entry is "now"; the prior cycle line is a fixed series.
 */
export const TREND_OFFSETS = [-14.4, -12.6, -10.8, -8.9, -6.4, -3.6, 2.1, 0];
export const PRIOR_CYCLE = [52, 54, 55, 57, 59, 61, 63, 65.6];
