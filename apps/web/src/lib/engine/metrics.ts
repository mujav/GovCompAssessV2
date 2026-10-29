// Command Center metrics. Every number is calculated here from records and the published
// scoring scheme; AI only words the briefing, it never produces a value.

import type { ComplianceStatus, ScoringScheme } from "@/lib/admin/types";
import { effectiveStatus, pointsTable, score, scoreByDomain } from "./scoring";
import {
  addDays,
  daysBetween,
  type Clarification,
  type EvidenceIssue,
  type ReviewStage,
  type WsAction,
  type WsRequirement,
} from "@/lib/workspace/data";

export const ALL = "all";
export type DueFilter = "any" | "overdue" | "7d" | "30d";

export interface Filters {
  domain: string;
  department: string;
  owner: string;
  due: DueFilter;
}

export const NO_FILTERS: Filters = { domain: ALL, department: ALL, owner: ALL, due: "any" };

export type Assignments = Record<string, { owner: string; due: string }>;

export interface Context {
  reqs: WsRequirement[];
  actions: WsAction[];
  issues: EvidenceIssue[];
  clarifications: Clarification[];
  scheme: ScoringScheme;
  today: string;
}

/* ---------- Filtering ---------- */

export function applyAssignments(reqs: WsRequirement[], a: Assignments): WsRequirement[] {
  return reqs.map((r) => (a[r.code] ? { ...r, owner: a[r.code].owner, due: a[r.code].due } : r));
}

export function matchesDue(due: string, f: DueFilter, today: string) {
  if (f === "any") return true;
  if (f === "overdue") return due < today;
  return due >= today && due <= addDays(today, f === "7d" ? 7 : 30);
}

export function filterRequirements(reqs: WsRequirement[], f: Filters, today: string) {
  return reqs.filter(
    (r) =>
      (f.domain === ALL || r.domain === f.domain) &&
      (f.department === ALL || r.department === f.department) &&
      (f.owner === ALL || r.owner === f.owner || (f.owner === "" && !r.owner)) &&
      matchesDue(r.due, f.due, today),
  );
}

/** Narrow every record set in the context to the requirements that pass the filters. */
export function scopeContext(ctx: Context, f: Filters): Context {
  const reqs = filterRequirements(ctx.reqs, f, ctx.today);
  const codes = new Set(reqs.map((r) => r.code));
  return {
    ...ctx,
    reqs,
    actions: ctx.actions.filter((a) => codes.has(a.code)),
    issues: ctx.issues.filter((i) => codes.has(i.code)),
    clarifications: ctx.clarifications.map((c) => ({ ...c, affects: c.affects.filter((x) => codes.has(x)) })),
  };
}

/* ---------- Scores ---------- */

const applicable = (r: WsRequirement) => r.status !== "na";
const isOpen = (r: WsRequirement) => r.work !== "closed" && r.work !== "ready";

/** Official results count accepted reviews only; anything in flight is "not assessed". */
export function officialView(reqs: WsRequirement[]): WsRequirement[] {
  return reqs.map((r) => (r.review === "accepted" ? r : { ...r, status: "nas" as ComplianceStatus, mandatoryFail: false }));
}

export function readiness(ctx: Context) {
  return { projected: score(ctx.reqs, ctx.scheme), official: score(officialView(ctx.reqs), ctx.scheme) };
}

/** Score points gained if this requirement reached compliant, holding everything else. */
export function scoreImpact(r: WsRequirement, reqs: WsRequirement[], scheme: ScoringScheme) {
  const s = effectiveStatus(r, scheme);
  if (s === "na" || s === "comp") return 0;
  const den = score(reqs, scheme).denominator;
  if (!den) return 0;
  const w = scheme.weights[r.weight];
  return Math.round(((w * (1 - pointsTable(scheme)[s])) / den) * 1000) / 10;
}

export function ragOf(pct: number, scheme: ScoringScheme): "green" | "amber" | "red" {
  return pct >= scheme.green ? "green" : pct >= scheme.amber ? "amber" : "red";
}

/* ---------- KPIs ---------- */

export type Tone = "bad" | "warn" | "neutral" | "good";

export interface Kpi {
  id: string;
  label: string;
  value: string;
  ratio: string;
  note: string;
  tone: Tone;
  definition: string;
  /** Requirement codes behind the numerator. */
  codes: string[];
}

export function kpis(ctx: Context): Kpi[] {
  const { reqs, actions, scheme, today } = ctx;
  const app = reqs.filter(applicable);
  const { projected, official } = readiness(ctx);

  const acceptedComp = app.filter((r) => r.review === "accepted" && effectiveStatus(r, scheme) === "comp");
  const expected = app.reduce((n, r) => n + r.evidence.expected, 0);
  const valid = app.reduce((n, r) => n + r.evidence.valid, 0);
  const invalid = app.filter((r) => r.evidence.invalid > 0);

  const open = actions.filter((a) => a.status === "open");
  const overdue = open.filter((a) => a.due < today);
  const byDept = countBy(overdue, (a) => a.department);
  const [topDept, topDeptN] = Object.entries(byDept).sort((a, b) => b[1] - a[1])[0] ?? ["", 0];

  const blockers = app.filter((r) => r.weight === "high" && effectiveStatus(r, scheme) === "non" && isOpen(r));
  const blockersSoon = blockers.filter((r) => r.due <= addDays(today, 7));
  const unassigned = reqs.filter((r) => !r.owner && isOpen(r));
  const unassignedLate = unassigned.filter((r) => r.due < today);

  return [
    {
      id: "readiness",
      label: "Projected readiness",
      value: `${projected.pct}%`,
      ratio: `target ${scheme.target}% · official ${official.pct}%`,
      note: projected.pct >= scheme.target ? "On target" : `${round1(scheme.target - projected.pct)} pts below target`,
      tone: projected.pct >= scheme.target ? "good" : "bad",
      definition: `Σ points × weight ÷ Σ applicable weight (${projected.numerator} ÷ ${projected.denominator}), scheme ${scheme.code} v${scheme.version}. Official counts accepted results only.`,
      codes: app.filter((r) => effectiveStatus(r, scheme) !== "comp").map((r) => r.code),
    },
    {
      id: "accepted",
      label: "Accepted compliant",
      value: String(acceptedComp.length),
      ratio: `${acceptedComp.length} / ${app.length} applicable`,
      note: `${pct(acceptedComp.length, app.length)}% of applicable`,
      tone: "neutral",
      definition: "Applicable requirements whose compliant result has been accepted by a human reviewer.",
      codes: acceptedComp.map((r) => r.code),
    },
    {
      id: "evidence",
      label: "Evidence readiness",
      value: `${pct(valid, expected, 0)}%`,
      ratio: `${valid} / ${expected} expected`,
      note: `${invalid.length} invalid or outdated`,
      tone: invalid.length ? "warn" : "good",
      definition: "Valid evidence items received ÷ evidence items expected across applicable requirements.",
      codes: invalid.map((r) => r.code),
    },
    {
      id: "overdue",
      label: "Overdue actions",
      value: String(overdue.length),
      ratio: `${overdue.length} / ${open.length} open`,
      note: topDeptN > 1 ? `${topDeptN} in ${topDept}` : overdue.length ? "Spread across departments" : "None overdue",
      tone: overdue.length ? "bad" : "good",
      definition: "Open remediation actions whose due date has passed.",
      codes: overdue.map((a) => a.code),
    },
    {
      id: "blockers",
      label: "Critical blockers",
      value: String(blockers.length),
      ratio: `${blockers.length} score-impacting`,
      note: `${blockersSoon.length} due ≤ 7 days`,
      tone: blockers.length ? "bad" : "good",
      definition: "Open high-weight requirements currently non-compliant after blocking rules.",
      codes: blockers.map((r) => r.code),
    },
    {
      id: "unassigned",
      label: "Unassigned",
      value: String(unassigned.length),
      ratio: `${unassigned.length} / ${reqs.length} requirements`,
      note: unassignedLate.length ? `${unassignedLate.length} already past due` : "None past due",
      tone: unassigned.length ? "warn" : "good",
      definition: "Open requirements with no named owner.",
      codes: unassigned.map((r) => r.code),
    },
  ];
}

/* ---------- Distributions ---------- */

export function statusMix(ctx: Context): Record<ComplianceStatus, string[]> {
  const out: Record<ComplianceStatus, string[]> = { comp: [], part: [], non: [], nas: [], na: [] };
  for (const r of ctx.reqs) out[effectiveStatus(r, ctx.scheme)].push(r.code);
  return out;
}

export const PIPELINE: { stage: Exclude<ReviewStage, "none">; label: string }[] = [
  { stage: "ai", label: "AI only" },
  { stage: "l1", label: "Pending L1" },
  { stage: "l2", label: "Pending L2" },
  { stage: "override", label: "Override" },
  { stage: "accepted", label: "Accepted" },
];

export function pipeline(ctx: Context) {
  const app = ctx.reqs.filter(applicable);
  return PIPELINE.map((p) => ({ ...p, codes: app.filter((r) => r.review === p.stage).map((r) => r.code) }));
}

export function domainReadiness(ctx: Context) {
  return scoreByDomain(ctx.reqs, ctx.scheme).map((d) => ({ ...d, rag: ragOf(d.pct, ctx.scheme) }));
}

/* ---------- Opportunities and risk ---------- */

export interface Opportunity {
  code: string;
  title: string;
  impact: number;
  need: string;
  effort: "low" | "medium" | "high";
  owner: string;
}

export function opportunities(ctx: Context, n = 4): Opportunity[] {
  return ctx.reqs
    .filter((r) => applicable(r) && isOpen(r))
    .map((r) => {
      const s = effectiveStatus(r, ctx.scheme);
      const need = r.mandatoryFail
        ? "Mandatory criterion not met"
        : r.evidence.invalid
          ? "Replace invalid evidence"
          : r.evidence.valid === 0
            ? "No valid evidence yet"
            : "Close remaining gap";
      const effort: Opportunity["effort"] = s === "non" ? "high" : s === "part" && r.evidence.valid > 0 ? "low" : "medium";
      return { code: r.code, title: r.title, impact: scoreImpact(r, ctx.reqs, ctx.scheme), need, effort, owner: r.owner };
    })
    .filter((o) => o.impact > 0)
    .sort((a, b) => b.impact - a.impact || EFFORT[a.effort] - EFFORT[b.effort] || a.code.localeCompare(b.code))
    .slice(0, n);
}

const EFFORT = { low: 0, medium: 1, high: 2 };

export type NextStep = { label: string; kind: DraftKind } | { label: string; href: string };

export function nextStep(r: WsRequirement): NextStep {
  switch (r.work) {
    case "review":
    case "evsub":
      return { label: "Review now", href: "/reviews" };
    case "returned":
      return { label: "Escalate", kind: "escalation" };
    case "update":
      return { label: "Request update", kind: "evidence-request" };
    case "prog":
      return { label: "Send reminder", kind: "reminder" };
    default:
      return r.owner ? { label: "Request evidence", kind: "evidence-request" } : { label: "Assign owner", kind: "assignment" };
  }
}

/** Open, not-yet-compliant requirements due within the window (overdue included), soonest first. */
export function atRisk(ctx: Context, windowDays = 14) {
  const limit = addDays(ctx.today, windowDays);
  return ctx.reqs
    .filter((r) => applicable(r) && isOpen(r) && effectiveStatus(r, ctx.scheme) !== "comp" && r.due <= limit)
    .sort((a, b) => a.due.localeCompare(b.due) || ctx.scheme.weights[b.weight] - ctx.scheme.weights[a.weight] || a.code.localeCompare(b.code));
}

/* ---------- Briefing ---------- */

export type DraftKind = "evidence-request" | "escalation" | "reminder" | "return" | "re-review" | "remediation" | "assignment" | "exec-update";

export interface Insight {
  id: string;
  sev: "high" | "med" | "info";
  insight: string;
  why: string;
  sources: string[];
  /** Requirement codes the secondary button opens. */
  codes: string[];
  secondary: string;
  action: string;
  kind: DraftKind;
}

export function insights(ctx: Context, trendDelta: number): Insight[] {
  const { reqs, actions, scheme, today } = ctx;
  const out: Insight[] = [];
  const soon = addDays(today, 7);

  const noEvidence = reqs.filter(
    (r) => r.weight === "high" && applicable(r) && isOpen(r) && r.evidence.valid === 0 && r.due >= today && r.due <= soon,
  );
  if (noEvidence.length) {
    const minImpact = Math.min(...noEvidence.map((r) => scoreImpact(r, reqs, scheme)));
    out.push({
      id: "evidence-due",
      sev: "high",
      insight: `${plural(noEvidence.length, "high-impact requirement")} ${noEvidence.length === 1 ? "has" : "have"} no evidence and ${noEvidence.length === 1 ? "is" : "are"} due within 7 days.`,
      why: `Each carries ≥ ${minImpact} pts of score impact; no valid evidence has been uploaded this cycle.`,
      sources: noEvidence.map((r) => r.code),
      codes: noEvidence.map((r) => r.code),
      secondary: "View requirements",
      action: "Draft evidence requests",
      kind: "evidence-request",
    });
  }

  const escalable = actions.filter((a) => a.status === "open" && a.due < today && a.reminders >= 2);
  const byDept = Object.entries(groupBy(escalable, (a) => a.department)).sort((a, b) => b[1].length - a[1].length);
  if (byDept.length) {
    const [dept, list] = byDept[0];
    const avg = Math.round(list.reduce((n, a) => n + daysBetween(a.due, today), 0) / list.length);
    out.push({
      id: `escalate:${dept}`,
      sev: "high",
      insight: `${plural(list.length, "remediation action")} ${list.length === 1 ? "is" : "are"} overdue for ${dept}.`,
      why: `Average ${avg} days overdue; each has had 2 or more reminders, so the escalation rule ESC-02 now applies.`,
      sources: [...list.map((a) => a.id), "rule ESC-02"],
      codes: list.map((a) => a.code),
      secondary: "View actions",
      action: "Prepare escalation",
      kind: "escalation",
    });
  }

  if (ctx.issues.length) {
    const problems = Object.entries(countBy(ctx.issues, (i) => i.problem))
      .map(([p, n]) => `${n} ${p.toLowerCase()}`)
      .join("; ");
    out.push({
      id: "evidence-invalid",
      sev: "med",
      insight: `${plural(ctx.issues.length, "evidence file")} failed validation.`,
      why: `${problems}.`,
      sources: ctx.issues.map((i) => i.id),
      codes: ctx.issues.map((i) => i.code),
      secondary: "Open files",
      action: "Return for correction",
      kind: "return",
    });
  }

  for (const c of ctx.clarifications) {
    const accepted = reqs.filter((r) => c.affects.includes(r.code) && r.review === "accepted");
    if (!accepted.length) continue;
    out.push({
      id: `clarification:${c.id}`,
      sev: "info",
      insight: `Clarification ${c.id} affects ${plural(c.affects.length, "requirement", false)}, ${accepted.length} already accepted.`,
      why: `${c.title}, so the accepted items need re-review.`,
      sources: [c.id, ...c.affects],
      codes: accepted.map((r) => r.code),
      secondary: "Read clarification",
      action: "Flag for re-review",
      kind: "re-review",
    });
  }

  if (trendDelta < 0) {
    const worst = domainReadiness(ctx).sort((a, b) => a.pct - b.pct)[0];
    const top = opportunities(ctx, 5);
    out.push({
      id: "trend",
      sev: "med",
      insight: `Projected readiness fell ${Math.abs(trendDelta)} points this week.`,
      why: `Weakest domain is ${worst.domain} at ${worst.pct}%; the five biggest opportunities are worth +${round1(top.reduce((n, o) => n + o.impact, 0))} pts.`,
      sources: ["snapshot 2026-W43 vs W42"],
      codes: top.map((o) => o.code),
      secondary: "See drivers",
      action: "Plan remediation",
      kind: "remediation",
    });
  }
  return out;
}

/* ---------- Helpers ---------- */

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function pct(n: number, d: number, digits = 1) {
  if (!d) return 0;
  const f = 10 ** digits;
  return Math.round((n / d) * 100 * f) / f;
}

function plural(n: number, word: string, start = true) {
  const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  const num = n < 10 ? words[n] : String(n);
  return `${start ? num[0].toUpperCase() + num.slice(1) : num} ${word}${n === 1 ? "" : "s"}`;
}

function countBy<T>(xs: T[], key: (x: T) => string) {
  const out: Record<string, number> = {};
  for (const x of xs) out[key(x)] = (out[key(x)] ?? 0) + 1;
  return out;
}

function groupBy<T>(xs: T[], key: (x: T) => string) {
  const out: Record<string, T[]> = {};
  for (const x of xs) (out[key(x)] ??= []).push(x);
  return out;
}
