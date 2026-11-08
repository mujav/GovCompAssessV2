// Assessment cycles within a review year. A standard says how many it runs (Qiyas two, NCA ECC
// one); each workspace runs them in order. A cycle has the seven phases with a deadline each, any
// extra deadlines the Index Owner adds, its submission and its own official results. Closing a
// cycle opens the next one; closing the last one closes the year.

import type { CycleSpec } from "@/lib/admin/types";
import { addDays, SUBMISSION_DEADLINE } from "@/lib/workspace/data";

export type { CycleSpec };

export const PHASE_KEYS = ["planning", "responses", "internal", "submission", "assessment", "corrections", "results"] as const;
export type PhaseKey = (typeof PHASE_KEYS)[number];

export const PHASE_NAME: Record<PhaseKey, string> = {
  planning: "Planning",
  responses: "Responses",
  internal: "Internal review",
  submission: "Submission",
  assessment: "Regulator assessment",
  corrections: "Corrections",
  results: "Final results",
};

/** Days each phase lasts in a default plan, ending at its deadline. */
const PHASE_DAYS: Record<PhaseKey, number> = { planning: 7, responses: 33, internal: 10, submission: 14, assessment: 30, corrections: 14, results: 14 };

export interface PhaseDeadline {
  key: PhaseKey;
  name: string;
  /** Last day of the phase. */
  due: string;
}

export interface Deadline {
  id: string;
  name: string;
  due: string;
}

export interface Closure {
  score?: number;
  controls: { code: string; status: "Partial" | "Non"; notMet: string; feedback: string }[];
  closedAt?: string;
  by?: string;
}

export interface CyclePeriod {
  n: number;
  name: string;
  opens: string;
  phases: PhaseDeadline[];
  deadlines: Deadline[];
  /** Target compliance rate, %. */
  target: number;
  submittedAt?: string;
  closure?: Closure;
}

export interface CycleDates {
  opening: string;
  internalClosing: string;
  submission: string;
  target: number;
}

/** What earlier versions stored once per workspace; it becomes the first cycle. */
export interface LegacyCycle {
  dates?: CycleDates;
  phases?: string[];
  closure?: Closure;
  submittedAt?: string;
}

export const cycleCount = (spec?: CycleSpec) => Math.min(4, Math.max(1, Math.round(spec?.count ?? 1)));
export const cycleName = (spec: CycleSpec | undefined, n: number) => spec?.names?.[n - 1]?.en || `Cycle ${n}`;

/** Phase deadlines laid end to end from an opening date; the internal review ends on `internalClosing` when given. */
function phasesFrom(opens: string, internalClosing?: string, names?: string[]): PhaseDeadline[] {
  let at = opens;
  return PHASE_KEYS.map((key, i) => {
    at = key === "internal" && internalClosing ? internalClosing : addDays(at, PHASE_DAYS[key]);
    return { key, name: names?.[i] || PHASE_NAME[key], due: at };
  });
}

/**
 * The default plan for a year: the first cycle closes internally on `closing`, the others follow
 * at even intervals. A workspace planned before cycles existed keeps its dates as the first cycle.
 */
export function defaultPeriods(spec: CycleSpec | undefined, closing: string, legacy: LegacyCycle = {}): CyclePeriod[] {
  const count = cycleCount(spec);
  const opens = legacy.dates?.opening ?? addDays(closing, -50);
  const gap = Math.round(365 / count);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(opens, i * gap);
    const phases = phasesFrom(start, i === 0 ? (legacy.dates?.internalClosing ?? closing) : addDays(closing, i * gap), legacy.phases);
    if (i === 0 && legacy.dates?.submission) phases[3].due = legacy.dates.submission;
    return {
      n: i + 1,
      name: cycleName(spec, i + 1),
      opens: start,
      phases,
      deadlines: [],
      target: legacy.dates?.target ?? 90,
      ...(i === 0 && { submittedAt: legacy.submittedAt, closure: legacy.closure }),
    };
  });
}

/** The workspace's cycles: what the Index Owner planned, else the default plan. */
export function periodsOf(saved: CyclePeriod[] | undefined, spec: CycleSpec | undefined, closing: string, legacy?: LegacyCycle): CyclePeriod[] {
  return saved?.length ? saved : defaultPeriods(spec, closing, legacy);
}

/** The cycle in progress: the first one not closed, or the last when all are. */
export function activeIndex(periods: CyclePeriod[]) {
  const i = periods.findIndex((p) => !p.closure?.closedAt);
  return i < 0 ? periods.length - 1 : i;
}

export const isClosed = (p: CyclePeriod) => !!p.closure?.closedAt;

export const phaseDue = (p: CyclePeriod, key: PhaseKey) => p.phases.find((x) => x.key === key)?.due ?? p.opens;

/** The dates the plan and dashboards read. */
export function datesOf(p: CyclePeriod): CycleDates {
  return { opening: p.opens, internalClosing: phaseDue(p, "internal"), submission: phaseDue(p, "submission"), target: p.target };
}

/** "Qiyas 2026 · Cycle 1 of 2"; a standard with one cycle needs no label. */
export function cycleLabel(p: CyclePeriod, total: number) {
  return total > 1 ? `Cycle ${p.n} of ${total}${p.name === `Cycle ${p.n}` ? "" : ` · ${p.name}`}` : "";
}

/** Phase deadlines and extra deadlines in date order. */
export function timeline(p: CyclePeriod) {
  return [...p.phases.map((x) => ({ id: x.key, name: x.name, due: x.due, phase: true })), ...p.deadlines.map((d) => ({ id: d.id, name: d.name, due: d.due, phase: false }))].sort((a, b) => a.due.localeCompare(b.due));
}

/** The next date still ahead, from today. */
export function nextDeadline(p: CyclePeriod, today: string) {
  return timeline(p).find((d) => d.due >= today);
}

/** What is wrong with a plan: phases out of order, or a cycle starting before the one before it ends. */
export function planProblems(periods: CyclePeriod[]): string[] {
  const out: string[] = [];
  periods.forEach((p, i) => {
    let prev = p.opens;
    for (const ph of p.phases) {
      if (ph.due < prev) out.push(`${p.name}: ${ph.name} ends ${ph.due}, before the step before it (${prev}).`);
      prev = ph.due > prev ? ph.due : prev;
    }
    for (const d of p.deadlines) if (d.due < p.opens || d.due > phaseDue(p, "results")) out.push(`${p.name}: “${d.name}” (${d.due}) falls outside the cycle.`);
    const before = periods[i - 1];
    if (before && p.opens < phaseDue(before, "results")) out.push(`${p.name} opens ${p.opens}, before ${before.name} ends (${phaseDue(before, "results")}).`);
  });
  return out;
}

/** Moves a cycle's dates by whole days, keeping their spacing. */
export function shiftPeriod(p: CyclePeriod, days: number): CyclePeriod {
  return { ...p, opens: addDays(p.opens, days), phases: p.phases.map((x) => ({ ...x, due: addDays(x.due, days) })), deadlines: p.deadlines.map((d) => ({ ...d, due: addDays(d.due, days) })) };
}

/** A workspace's cycles from its saved cycle state, for lists that do not open the workspace. */
export function workspaceCycle(saved: unknown, spec?: CycleSpec) {
  const state = saved as (LegacyCycle & { cycles?: CyclePeriod[] }) | undefined;
  const periods = periodsOf(state?.cycles, spec, SUBMISSION_DEADLINE, state ?? {});
  const at = activeIndex(periods);
  const period = periods[at];
  return {
    periods,
    period,
    /** Score of the cycle before the current one, when it has closed. */
    previous: periods[at - 1]?.closure?.score,
    label: cycleLabel(period, periods.length),
    closed: periods.every(isClosed),
  };
}
