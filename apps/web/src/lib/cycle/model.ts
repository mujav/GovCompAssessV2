// The cycle as the design describes it: a workspace's standard is read as Dimension › Domain ›
// Control › Requirement › Required evidence, the Control Owner answers one control at a time,
// and the Index Owner plans, reviews and closes the cycle per control. Controls are not stored
// on their own: they group the workspace's requirements by code (5.9.1-3 belongs to control
// 5.9.1, domain 5.9, dimension 5), so every requirement-level screen stays in step.
//
// Pure data and rules; ./use-cycle.ts keeps the per-workspace state in the journey store.

import type { FrameworkRequirement } from "@/lib/admin/types";
import { addDays, daysBetween } from "@/lib/workspace/data";
import type { Stage, WorkOverlay } from "@/lib/journey/work";

/* ---------- Hierarchy ---------- */

export const controlOf = (code: string) => code.split("-")[0];
export const domainOf = (code: string) => controlOf(code).split(".").slice(0, 2).join(".");
export const dimensionOf = (code: string) => controlOf(code).split(".")[0];
/** "5.9.1-3" → "R3"; codes without a requirement suffix keep their last segment. */
export const reqLabel = (code: string) => `R${code.includes("-") ? code.slice(code.indexOf("-") + 1) : code.split(".").pop()}`;

/** Requirement as the cycle sees it: what the requirement-level hooks already provide. */
export interface CycleRequirement {
  code: string;
  title: string;
  domain: string;
  department: string;
  owner: string;
  due: string;
  /** Last cycle's official result (comp, part, non), "nas" when new, "na" when not applicable. */
  status: string;
  mandatoryFail?: boolean;
  weight?: string;
  evidence: { expected: number; valid: number; invalid: number };
  evidenceText?: string;
  text?: string;
  work?: string;
  review?: string;
  upload?: { files: number; assessed: boolean };
}

/* ---------- Stages ---------- */

export type CycleStage = "not" | "draft" | "submitted" | "review" | "returned" | "accepted";

export const CYCLE_STAGES: { key: CycleStage; label: string; color: string }[] = [
  { key: "not", label: "Not started", color: "#C9D1CD" },
  { key: "draft", label: "Drafted", color: "#E0A100" },
  { key: "submitted", label: "Submitted", color: "#6C9BD2" },
  { key: "review", label: "Under review", color: "#3A6FB8" },
  { key: "returned", label: "Returned", color: "#C2410C" },
  { key: "accepted", label: "Accepted", color: "#1F9D6E" },
];
export const CYCLE_STAGE: Record<CycleStage, (typeof CYCLE_STAGES)[number]> = Object.fromEntries(CYCLE_STAGES.map((s) => [s.key, s])) as never;

/** A requirement's stage in the design's words, from the pipeline stage and whether it came back. */
export function reqStage(r: CycleRequirement, stage: Stage, returned: boolean, decided: boolean): CycleStage {
  if (stage === "acc") return "accepted";
  if (returned) return "returned";
  if (stage === "rev") return decided || r.review === "l1" ? "review" : "submitted";
  if (stage === "prog") return "draft";
  return "not";
}

/* ---------- Controls ---------- */

export type Tier = "Full" | "Partial" | "Non";

export interface Control {
  code: string;
  title: string;
  dimension: string;
  dimensionName: string;
  domain: string;
  domainName: string;
  department: string;
  owner: string;
  due: string;
  reqs: (CycleRequirement & { stage: CycleStage })[];
  stage: CycleStage;
  applicable: boolean;
  /** Requirements met: accepted and not ruled not met by the Index Owner. */
  met: number;
  total: number;
  submitted: number;
  evidence: { expected: number; uploaded: number; accepted: number };
  previous?: Tier;
}

/** Most common value, first seen on a tie. */
export function majority(values: string[]) {
  const n = new Map<string, number>();
  for (const v of values) if (v) n.set(v, (n.get(v) ?? 0) + 1);
  let best = "";
  for (const [v, c] of n) if (!best || c > (n.get(best) ?? 0)) best = v;
  return best;
}

/** Deterministic 0–1 from a string, for stable demo signals (stale days, previous tiers). */
export function hashUnit(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Names for dimension, domain and control codes: the standard's own nodes, else the requirement wording. */
export function namesFrom(nodes: FrameworkRequirement[] | undefined, reqs: CycleRequirement[]) {
  const names = new Map<string, string>();
  for (const n of nodes ?? []) names.set(n.code, n.title);
  for (const r of reqs) {
    const dim = dimensionOf(r.code);
    if (!names.has(dim) && r.domain) names.set(dim, titleCase(r.domain));
    const ctl = controlOf(r.code);
    if (!names.has(ctl)) names.set(ctl, r.title.split(":")[0]);
  }
  return names;
}

export interface PlanEntry {
  due?: string;
  owner?: string;
  department?: string;
  /** Marked not applicable, with the proof that was confirmed. */
  na?: { reason: string; by: string; at: string; confirmed: boolean };
  instruction?: string;
}

export interface ReviewRecord {
  /** Index Owner's decision per requirement code. */
  decisions: Record<string, "met" | "not">;
  /** Times the control went back to its owner. */
  returns: number;
  acceptedAt?: string;
  tier?: Tier;
  /** Index Owner who took the review. */
  reviewer?: string;
}

/**
 * A control has one Control Owner and every requirement in it is theirs: the owner set in the
 * plan, else the one holding most of its requirements. Their department follows.
 */
export function oneOwnerPerControl<R extends { code: string; owner: string; department: string }>(reqs: R[], plan?: Record<string, { owner?: string; department?: string }>): R[] {
  const groups = new Map<string, R[]>();
  for (const r of reqs) {
    const k = controlOf(r.code);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const owners = new Map(
    [...groups.entries()].map(([code, list]) => {
      const owner = plan?.[code]?.owner ?? majority(list.map((r) => r.owner));
      const department = plan?.[code]?.department ?? (majority(list.filter((r) => r.owner === owner).map((r) => r.department)) || majority(list.map((r) => r.department)));
      return [code, { owner, department }];
    }),
  );
  return reqs.map((r) => {
    const o = owners.get(controlOf(r.code))!;
    return r.owner === o.owner && r.department === o.department ? r : { ...r, owner: o.owner, department: o.department || r.department };
  });
}

export function buildControls(
  reqs: CycleRequirement[],
  opts: {
    stageOf: (code: string) => Stage;
    returned: (code: string) => boolean;
    names: Map<string, string>;
    plan?: Record<string, PlanEntry>;
    reviews?: Record<string, ReviewRecord>;
  },
): Control[] {
  const groups = new Map<string, CycleRequirement[]>();
  for (const r of reqs) {
    const k = controlOf(r.code);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  return [...groups.entries()].map(([code, list]) => {
    const plan = opts.plan?.[code];
    const review = opts.reviews?.[code];
    const staged = list.map((r) => ({ ...r, stage: reqStage(r, opts.stageOf(r.code), opts.returned(r.code), !!review?.decisions[r.code]) }));
    const applicable = !plan?.na && list.some((r) => r.status !== "na");
    const live = staged.filter((r) => r.status !== "na");
    const owner = plan?.owner ?? majority(list.map((r) => r.owner));
    const met = live.filter((r) => r.stage === "accepted" && review?.decisions[r.code] !== "not").length;
    const dim = dimensionOf(code);
    const dom = domainOf(code);
    return {
      code,
      title: opts.names.get(code) ?? code,
      dimension: dim,
      dimensionName: opts.names.get(dim) ?? `Dimension ${dim}`,
      domain: dom,
      domainName: opts.names.get(dom) ?? `Domain ${dom}`,
      department: plan?.department ?? majority(list.map((r) => r.department)),
      owner,
      due: plan?.due ?? list.map((r) => r.due).sort().at(-1) ?? "",
      reqs: staged,
      stage: controlStage(live.map((r) => r.stage)),
      applicable,
      met,
      total: live.length,
      submitted: live.filter((r) => r.stage !== "not" && r.stage !== "draft").length,
      evidence: {
        expected: live.reduce((a, r) => a + r.evidence.expected, 0),
        uploaded: live.reduce((a, r) => a + Math.min(r.evidence.expected, r.evidence.valid + r.evidence.invalid), 0),
        accepted: live.filter((r) => r.stage === "accepted").reduce((a, r) => a + r.evidence.valid, 0),
      },
      previous: previousTier(live.map((r) => r.status)),
    };
  });
}

/** Last cycle's official tier from the requirements' previous results; new controls have none. */
export function previousTier(results: string[]): Tier | undefined {
  const known = results.filter((s) => s === "comp" || s === "part" || s === "non");
  if (!known.length) return undefined;
  if (known.includes("non")) return "Non";
  return known.every((s) => s === "comp") ? "Full" : "Partial";
}

/** One stage for a control from its requirements' stages. */
export function controlStage(stages: CycleStage[]): CycleStage {
  if (!stages.length) return "accepted";
  if (stages.every((s) => s === "accepted")) return "accepted";
  if (stages.includes("returned")) return "returned";
  if (stages.every((s) => s === "accepted" || s === "submitted" || s === "review")) return stages.includes("review") ? "review" : "submitted";
  if (stages.every((s) => s === "not")) return "not";
  return "draft";
}

/** Requirement-count tiers: every requirement met is Full, at least `partialFrom` % is Partial. */
export function tierOf(met: number, total: number, partialFrom = 90): Tier {
  if (!total || met >= total) return "Full";
  return (met / total) * 100 >= partialFrom ? "Partial" : "Non";
}

export const sortByCode = <T extends { code: string }>(list: T[]) =>
  [...list].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

/* ---------- Cycle dates and phases ---------- */

export const PHASES = ["Planning", "Responses", "Internal review", "Submission", "Regulator assessment", "Corrections", "Final results"] as const;

export interface CycleDates {
  opening: string;
  internalClosing: string;
  submission: string;
  target: number;
}

export function defaultDates(closing: string): CycleDates {
  return { opening: addDays(closing, -50), internalClosing: closing, submission: addDays(closing, 14), target: 90 };
}

/** Phase the workspace is in, from where its requirements stand and whether it was submitted or closed. */
export function currentPhase(counts: Record<CycleStage, number>, submitted: boolean, closed: boolean): number {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (closed) return 6;
  if (submitted) return 4;
  if (!total || counts.not === total) return 0;
  if (counts.accepted === total) return 3;
  if (counts.submitted + counts.review + counts.accepted >= total * 0.5) return 2;
  return 1;
}

/** Share done of each phase, for the phase strip. */
export function phaseProgress(phase: number, counts: Record<CycleStage, number>) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const responded = (total - counts.not) / total;
  const accepted = counts.accepted / total;
  return PHASES.map((_, i) => (i < phase ? 100 : i > phase ? 0 : Math.round((i === 0 ? 1 : i === 1 ? responded : i === 2 ? accepted : 0) * 100)));
}

/* ---------- Attention ---------- */

export interface Thresholds {
  confidence: number;
  staleDays: number;
  atRiskDays: number;
  escalateDays: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = { confidence: 70, staleDays: 7, atRiskDays: 5, escalateDays: 3 };

/** Days since the control last moved: real activity when known, else a stable demo value. */
export const idleDays = (c: Control, lastActivity?: string, today?: string) =>
  lastActivity && today ? Math.max(0, daysBetween(lastActivity.slice(0, 10), today)) : Math.floor(hashUnit(`idle:${c.code}`) * 12);

export type AttentionKind = "overdue" | "atRisk" | "stale" | "returnedTwice";

export interface AttentionItem<C extends Control = Control> {
  kind: AttentionKind;
  control: C;
  detail: string;
  when: string;
}

export function attention<C extends Control>(controls: C[], today: string, t: Thresholds, returns: Record<string, number>, activity: Record<string, string> = {}): AttentionItem<C>[] {
  const out: AttentionItem<C>[] = [];
  for (const c of controls) {
    if (!c.applicable || c.stage === "accepted") continue;
    const left = daysBetween(today, c.due);
    const evPct = c.evidence.expected ? c.evidence.uploaded / c.evidence.expected : 1;
    const idle = idleDays(c, activity[c.code], activity[c.code] ? today : undefined);
    if (left < 0) {
      out.push({ kind: "overdue", control: c, detail: idle >= 3 ? `No activity for ${idle} days` : `Response ${c.stage === "not" ? "not started" : "drafted"}, ${c.evidence.uploaded} of ${c.evidence.expected} evidence`, when: `${-left} days late` });
      continue;
    }
    if ((returns[c.code] ?? 0) >= 2) out.push({ kind: "returnedTwice", control: c, detail: `Returned ${returns[c.code]} times`, when: `Due in ${left} days` });
    else if (left <= t.atRiskDays && evPct < 0.5) out.push({ kind: "atRisk", control: c, detail: `${c.evidence.uploaded} of ${c.evidence.expected} evidence uploaded`, when: `Due in ${left} days` });
    else if (idle >= t.staleDays) out.push({ kind: "stale", control: c, detail: `Last edit ${idle} days ago`, when: `Due in ${left} days` });
  }
  return out;
}

/* ---------- AI findings ---------- */

export type FindingLevel = "Critical" | "High" | "Medium";

export interface Finding {
  req: string;
  level: FindingLevel;
  text: string;
}

export type AiVerdict = "satisfied" | "partly" | "not evidenced" | "check page";

/** What the evidence review found on a requirement, from its evidence counts and the latest AI run. */
export function verdictOf(r: CycleRequirement, run?: { recommendation: string }): AiVerdict {
  if (run) return run.recommendation === "Compliant" ? "satisfied" : run.recommendation === "Partial" ? "partly" : "not evidenced";
  if (r.evidence.invalid > 0) return "check page";
  if (r.mandatoryFail) return "not evidenced";
  if (r.evidence.valid >= r.evidence.expected) return "satisfied";
  return r.evidence.valid > 0 ? "partly" : "not evidenced";
}

export function findingsOf(c: Control, runs: Record<string, { recommendation: string; summary?: string }> = {}): Finding[] {
  const out: Finding[] = [];
  for (const r of c.reqs) {
    if (r.status === "na") continue;
    const v = verdictOf(r, runs[r.code]);
    const label = reqLabel(r.code);
    if (r.mandatoryFail) out.push({ req: r.code, level: "Critical", text: `${label}: a mandatory item is not evidenced; approval or signature missing.` });
    else if (v === "not evidenced") out.push({ req: r.code, level: "Critical", text: `${label}: no evidence supports this requirement${runs[r.code]?.summary ? ` – ${runs[r.code].summary}` : "."}` });
    else if (v === "check page") out.push({ req: r.code, level: "High", text: `${label}: a file was flagged; check the cited page and date.` });
    else if (v === "partly") out.push({ req: r.code, level: "Medium", text: `${label}: evidence covers part of the requirement (${r.evidence.valid} of ${r.evidence.expected} items).` });
  }
  const rank: Record<FindingLevel, number> = { Critical: 0, High: 1, Medium: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/** Self-check hints for the Control Owner: dates, approvals, samples and page references, no criticality. */
export function selfCheck(files: { id: string; name: string; pages: number }[], response: string): { ok: boolean; ref: string; text: string }[] {
  const out: { ok: boolean; ref: string; text: string }[] = [];
  let fine = 0;
  for (const f of files) {
    if (/draft|مسودة/i.test(f.name)) out.push({ ok: false, ref: f.id, text: "No signature or approval page found; the file looks like a draft." });
    else if (/20(1\d|2[0-4])/.test(f.name)) out.push({ ok: false, ref: f.id, text: "The file name points to an earlier year; check it covers this cycle." });
    else if (f.pages > 20 && !new RegExp(`${f.id}\\s*·\\s*p\\.`).test(response)) out.push({ ok: false, ref: f.id, text: `${f.pages} pages and no page reference in your response.` });
    else fine++;
  }
  if (fine) out.push({ ok: true, ref: "", text: `${fine} other item${fine === 1 ? "" : "s"} look${fine === 1 ? "s" : ""} complete.` });
  return out;
}

/** Response Advisor: requirements whose evidence the response never cites. */
export function responseGaps(c: Control, response: string, evidenceIds: Record<string, string[]>) {
  return c.reqs
    .filter((r) => r.status !== "na")
    .filter((r) => {
      const ids = evidenceIds[r.code] ?? [];
      return ids.length > 0 && !ids.some((id) => response.includes(id));
    })
    .map((r) => ({ req: r.code, ids: evidenceIds[r.code] }));
}

/* ---------- Risks and issues ---------- */

export interface RiskItem {
  id: string;
  title: string;
  type: "Risk" | "Issue";
  controls: string[];
  impact: "High" | "Medium" | "Low";
  owner: string;
  due: string;
  status: "Open" | "Mitigating" | "Closed";
}

/** AI-suggested risk: one department holding two or more critical controls due the same week. */
export function suggestRisks(controls: Control[], critical: Set<string>, today: string): RiskItem[] {
  const byDept = new Map<string, Control[]>();
  for (const c of controls) {
    if (!critical.has(c.code) || c.stage === "accepted") continue;
    const week = Math.floor(daysBetween(today, c.due) / 7);
    const k = `${c.department}|${week}`;
    byDept.set(k, [...(byDept.get(k) ?? []), c]);
  }
  return [...byDept.entries()]
    .filter(([, list]) => list.length >= 2)
    .map(([k, list]) => ({
      id: `ai-${k}`,
      title: `${k.split("|")[0]} has ${list.length} critical controls due the same week`,
      type: "Risk" as const,
      controls: list.map((c) => c.code),
      impact: "High" as const,
      owner: "",
      due: list.map((c) => c.due).sort()[0],
      status: "Open" as const,
    }));
}

/* ---------- Overlay helpers ---------- */

/** Codes of requirements that went back to their owner at least once, from the pipeline overlay. */
export const returnedCodes = (o: WorkOverlay) => new Set(o.returned);
