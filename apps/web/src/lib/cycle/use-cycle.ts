"use client";

// Per-workspace cycle state (plan, standard tailoring, reviews, responses, risks, closure)
// and the controls built from the workspace's requirements. Requirement stages stay in the
// pipeline overlay of ../journey/use-work.ts: accepting or returning a control moves its
// requirements there, so requirement-level screens and dashboards agree with the cycle.

import { useMemo } from "react";
import { useAuth } from "@/lib/auth/store";
import { recordAudit, type AuditType } from "@/lib/audit";
import { evidenceKey, type EvidenceState } from "@/lib/journey/evidence";
import { useJourney, useScreenState } from "@/lib/journey/store";
import { useClientWork } from "@/lib/journey/use-work";
import { isReturned, stageOf, type StagedRequirement, type WorkOverlay } from "@/lib/journey/work";
import { workplaceLabel } from "@/lib/journey/workplaces";
import { ROLE_OF } from "@/lib/auth/accounts";
import { SUBMISSION_DEADLINE, TODAY } from "@/lib/workspace/data";
import type { FrameworkRequirement } from "@/lib/admin/types";
import { ECC_REQUIREMENTS } from "@/lib/admin/ecc-2024";
import { QIYAS_V5_REQUIREMENTS } from "@/lib/admin/qiyas-v5";
import { demoSeed, type DemoSeed } from "./demo-seed";
import { activeIndex, cycleCount, cycleLabel, datesOf, isClosed, periodsOf, type Closure, type CyclePeriod } from "./periods";
import {
  buildControls,
  CYCLE_STAGES,
  controlKey,
  currentPhase,
  defaultDates,
  hashUnit,
  namesFrom,
  applyRenames,
  PHASES,
  reqLabel,
  sortByCode,
  type Control,
  type CycleDates,
  type CycleRequirement,
  type CycleStage,
  type PlanEntry,
  type ReviewRecord,
  type RiskItem,
} from "./model";
import { DEFAULT_PLATFORM, PLATFORM_KEY, sectorFrom, type AnnexList, type PlatformState } from "./platform";

/* ---------- Standard tailoring ---------- */

export type DocType = "Approved document" | "Report" | "Samples" | "Screenshot" | "Link";

export interface EvidenceSpec {
  id: string;
  req: string;
  title: string;
  docType: DocType;
  freshness: number;
  minSamples: number;
  format: "Any" | "PDF" | "Excel";
  approval: boolean;
  pageRef: boolean;
  govVerified: boolean;
}

export interface ControlTailoring {
  objective?: string;
  titleAr?: string;
  applies?: "all" | "lists" | "perReq";
  lists?: AnnexList[];
  references?: string[];
  specs?: EvidenceSpec[];
}

export interface StandardState {
  controls: Record<string, ControlTailoring>;
  scheme: "tiers" | "maturity" | "three";
  partialFrom: number;
  weights: boolean;
  /** Library edition this workspace adopted. */
  edition?: string;
  published?: { version: number; at: string; by: string };
  draftChanges: number;
  /** Requirements added by the Index Owner: code → title and the dimension it sits in. */
  added?: Record<string, { title: string; dimension: string }>;
  /** Names the Index Owner gave to added or renamed dimensions, domains and controls. */
  names?: Record<string, string>;
  /** Applicability set per requirement (annex lists it applies to). */
  reqLists?: Record<string, AnnexList[]>;
}

/* ---------- Cycle state ---------- */

export interface PlanChange {
  at: string;
  controls: string[];
  change: string;
  reason: string;
  by: string;
  notified: number;
}

export interface Comment {
  id: string;
  by: string;
  role: string;
  at: string;
  text: string;
}

export interface FollowUp {
  id: string;
  control: string;
  to: string;
  text: string;
  at: string;
  by: string;
  kind: "Follow-up" | "Call" | "Deadline" | "Instruction" | "Return";
}

export type { Closure, CyclePeriod } from "./periods";

export interface CycleState {
  /** The year's assessment cycles as the Index Owner planned them; the default plan until then. */
  cycles?: CyclePeriod[];
  /** Before cycles: the one set of dates, phase names, closure and submission, read as the first cycle. */
  dates?: CycleDates;
  phases?: string[];
  plan: Record<string, PlanEntry>;
  history: PlanChange[];
  reviews: Record<string, ReviewRecord>;
  responses: Record<string, { text: string; savedAt: string; by: string; editedBy?: string }>;
  /** Index Owner instructions per requirement code. */
  reqInstructions: Record<string, string>;
  /** Correction notes per requirement code, from the Index Owner. */
  notes: Record<string, string>;
  comments: Record<string, Comment[]>;
  risks: RiskItem[];
  dismissed: string[];
  followUps: FollowUp[];
  /** Last activity per control, ISO. */
  activity: Record<string, string>;
  aiRuns: Record<string, number>;
  /** Uploaded file id → required-evidence id it answers. */
  fileSpec: Record<string, string>;
  /** Uploaded file id → page, section or sheet the owner points to. */
  fileRefs?: Record<string, string>;
  /** Control Owner's own status per requirement code. */
  claims?: Record<string, "met" | "not" | "na">;
  standard: StandardState;
  closure?: Closure;
  submittedAt?: string;
}

export const cycleKey = (workspaceId: string) => `cycle.${workspaceId}`;

export const EMPTY_CYCLE: CycleState = {
  plan: {},
  history: [],
  reviews: {},
  responses: {},
  reqInstructions: {},
  notes: {},
  comments: {},
  risks: [],
  dismissed: [],
  followUps: [],
  activity: {},
  aiRuns: {},
  fileSpec: {},
  standard: { controls: {}, scheme: "tiers", partialFrom: 90, weights: false, draftChanges: 0 },
};

/** Seeded register and history so a demo workspace opens with the design's examples. */
let seed: DemoSeed | undefined;
/** Built once: the review content that goes with the demo records. */
function demo() {
  if (!seed) {
    const names = new Map([...QIYAS_V5_REQUIREMENTS, ...ECC_REQUIREMENTS].map((n) => [n.code, n.titleAr || n.title]));
    seed = demoSeed((ctl) => names.get(ctl) ?? ctl);
  }
  return seed;
}

export function seededCycle(): CycleState {
  const d = demo();
  return {
    ...structuredClone(EMPTY_CYCLE),
    notes: { ...d.notes },
    responses: structuredClone(d.responses),
    comments: structuredClone(d.comments),
    followUps: structuredClone(d.followUps),
    reviews: Object.fromEntries(Object.entries(d.returns).map(([k, n]) => [k, { decisions: {}, returns: n }])),
    risks: [
      { id: "rk-1", title: "Department capacity during the closing month", type: "Risk", controls: [], impact: "High", owner: "", due: "2026-11-10", status: "Mitigating" },
      { id: "rk-2", title: "Updated plans still waiting for the head of entity's approval", type: "Issue", controls: [], impact: "High", owner: "", due: "2026-11-14", status: "Open" },
    ],
    standard: { ...EMPTY_CYCLE.standard, published: { version: 1, at: "2026-10-01", by: "Sami R." } },
  };
}

/** Required evidence for a requirement: the standard's own list, else one item per expected file. */
export function defaultSpecs(c: { code: string; reqs: CycleRequirement[] }): EvidenceSpec[] {
  let n = 0;
  return c.reqs.flatMap((r) => {
    const named = (r.evidenceText ?? "").split(/[\n;؛]/).map((s) => s.trim()).filter(Boolean);
    const titles = named.length ? named : Array.from({ length: Math.max(1, r.evidence.expected) }, (_, i) => (i === 0 ? `Approved ${r.title.split(":")[0].toLowerCase()} document` : i === 1 ? "Records showing it in use this cycle" : "Samples"));
    return titles.map((title, i) => {
      n++;
      const samples = /sample|عين/i.test(title);
      // The standard often says how many samples ("(3) عينات") and how recent ("(36) شهرًا").
      const count = Number((title.match(/\((\d+)\)\s*عين/) ?? title.match(/(\d+)\s*samples/i))?.[1] ?? 0);
      const months = Number((title.match(/\((\d+)\)\s*شهر/) ?? title.match(/(\d+)\s*months/i))?.[1] ?? 0);
      return {
        id: `E${n}`,
        req: r.code,
        title,
        docType: samples ? "Samples" : i === 0 ? "Approved document" : "Report",
        freshness: months || 12,
        minSamples: samples ? count || 3 : 0,
        format: "Any",
        approval: i === 0,
        pageRef: i === 0,
        govVerified: false,
      } satisfies EvidenceSpec;
    });
  });
}

/** Standard applicability flags seeded on a few controls (lists B and C only). */
export function seededLists(code: string): AnnexList[] | undefined {
  return hashUnit(`app:${code}`) < 0.05 ? ["B", "C"] : undefined;
}

/* ---------- Platform ---------- */

export function usePlatform() {
  const [state, set] = useScreenState<PlatformState>(PLATFORM_KEY, DEFAULT_PLATFORM);
  const platform = useMemo(() => ({ ...DEFAULT_PLATFORM, ...state, ai: { ...DEFAULT_PLATFORM.ai, ...state.ai } }), [state]);
  return { platform, setPlatform: set };
}

/** Sector and annex list of an entity. */
export function entityMeta(p: PlatformState, entity: { id: string; sub: string; nameAr?: string }) {
  const m = p.entities[entity.id] ?? {};
  return { ...m, sector: m.sector ?? sectorFrom(entity.sub), annex: m.annex ?? ("C" as AnnexList), nameAr: m.nameAr ?? entity.nameAr };
}

/* ---------- Controls for any workspace ---------- */

export function evidenceRuns(screens: Record<string, unknown>, clientId: string, fwId: string, codes: string[]) {
  const runs: Record<string, { recommendation: string; summary?: string }> = {};
  for (const code of codes) {
    const st = screens[evidenceKey(clientId, fwId, code)] as EvidenceState | undefined;
    if (st?.run) runs[code] = { recommendation: st.run.recommendation, summary: st.run.summary };
  }
  return runs;
}

/** Controls of a workspace from its requirements, overlay and cycle state. */
export function controlsOf(reqs: StagedRequirement[], overlay: WorkOverlay, cycle: CycleState, nodes?: FrameworkRequirement[], annex?: AnnexList) {
  const names = namesFrom(nodes, reqs as CycleRequirement[]);
  applyRenames(names, cycle.standard.names, nodes);
  const plan = { ...cycle.plan };
  // Controls the standard limits to other annex lists stay applicable until the Index Owner confirms N/A in the plan.
  const controls = buildControls(reqs as CycleRequirement[], {
    stageOf: (code) => {
      const r = reqs.find((x) => x.code === code);
      return r ? stageOf(r, overlay) : "start";
    },
    returned: (code) => {
      const r = reqs.find((x) => x.code === code);
      return r ? isReturned(r, overlay) : false;
    },
    names,
    plan,
    reviews: cycle.reviews,
  });
  return sortByCode(controls).map((c) => {
    const lists = cycle.standard.controls[c.code]?.lists ?? seededLists(c.code);
    const flagged = !!annex && !!lists && cycle.standard.controls[c.code]?.applies !== "all" && !lists.includes(annex);
    return { ...c, flaggedNa: flagged && !cycle.plan[c.code]?.na };
  });
}

export type CycleControl = Control & { flaggedNa: boolean };

export function stageTotals(controls: Control[], by: "req" | "control" = "req") {
  const out = Object.fromEntries(CYCLE_STAGES.map((s) => [s.key, 0])) as Record<CycleStage, number>;
  for (const c of controls) {
    if (!c.applicable) continue;
    if (by === "control") out[c.stage]++;
    else for (const r of c.reqs) if (r.status !== "na") out[r.stage]++;
  }
  return out;
}

/** Headline numbers the dashboard, workspaces list and analytics share, for the cycle in progress. */
export function cycleSummary(controls: Control[], cycle: CycleState, period?: CyclePeriod) {
  const live = controls.filter((c) => c.applicable);
  const reqs = live.reduce((a, c) => a + c.total, 0);
  const met = live.reduce((a, c) => a + c.met, 0);
  const submitted = live.reduce((a, c) => a + c.submitted, 0);
  const counts = stageTotals(controls);
  const dates = period ? datesOf(period) : (cycle.dates ?? defaultDates(SUBMISSION_DEADLINE));
  // A cycle that has not opened yet is still being planned, whatever carried over from the last one.
  const phase = period && TODAY < period.opens ? 0 : currentPhase(counts, !!period?.submittedAt, !!period?.closure?.closedAt);
  const ev = live.reduce((a, c) => ({ expected: a.expected + c.evidence.expected, uploaded: a.uploaded + c.evidence.uploaded, accepted: a.accepted + c.evidence.accepted }), { expected: 0, uploaded: 0, accepted: 0 });
  // The plan expects controls accepted in step with the days elapsed since opening.
  const span = Math.max(1, Date.parse(dates.internalClosing) - Date.parse(dates.opening));
  const elapsed = Math.min(1, Math.max(0, (Date.parse(TODAY) - Date.parse(dates.opening)) / span));
  const accepted = live.filter((c) => c.stage === "accepted").length;
  const planPct = live.length ? Math.round((accepted / live.length) * 100) : 0;
  return {
    controls: live.length,
    na: controls.length - live.length,
    accepted,
    planPct,
    behind: Math.round(elapsed * 100) - planPct,
    reqs,
    met,
    submitted,
    rate: reqs ? Math.round((met / reqs) * 100) : 0,
    rateOfSubmitted: submitted ? Math.round((met / submitted) * 100) : 0,
    counts,
    dates,
    phase,
    phaseName: period?.phases[phase]?.name ?? PHASES[phase],
    evidence: ev,
    overdue: live.filter((c) => c.stage !== "accepted" && c.due < TODAY).length,
    returned: counts.returned,
  };
}

/* ---------- The workspace in the URL ---------- */

const nowIso = () => new Date().toISOString();
const day = () => nowIso().slice(0, 10);

export function useCycle() {
  const work = useClientWork();
  const { client, framework, reqs, overlay, move, ret, assign, people } = work;
  const { user } = useAuth();
  const { state, workplaces } = useJourney();
  const { platform } = usePlatform();
  const [cycle, setCycle] = useScreenState<CycleState>(cycleKey(client.id), seededCycle());
  const entity = { id: client.entityId, sub: client.sub, nameAr: client.nameAr };
  const meta = entityMeta(platform, entity);
  const fwId = framework?.id ?? "fw-qiyas";

  const controls = useMemo(
    () => controlsOf(reqs, overlay, cycle, framework?.live.requirements, meta.annex) as CycleControl[],
    [reqs, overlay, cycle, framework, meta.annex],
  );
  const runs = useMemo(() => evidenceRuns(state.screens, client.id, fwId, reqs.map((r) => r.code)), [state.screens, client.id, fwId, reqs]);
  // The year's cycles, as the standard sets their number; the first one not closed is in progress.
  const spec = framework?.live.cycles;
  const periods = useMemo(() => periodsOf(cycle.cycles, spec, SUBMISSION_DEADLINE, cycle), [cycle, spec]);
  const period = periods[activeIndex(periods)];
  const summary = useMemo(() => cycleSummary(controls, cycle, period), [controls, cycle, period]);
  const workspace = workplaceLabel(client.frameworks[0] ?? "", client.year);
  const label = `${client.name} · ${workspace}`;
  const me = user?.name ?? "Someone";
  const role = user ? ROLE_OF[user.role].label : "";
  // The workspace closes with its last cycle.
  const closed = periods.every(isClosed);
  const workplace = workplaces.find((w) => w.id === client.id);
  /** Changes the plan of the year's cycles; the first change writes the default plan down. */
  const setPeriods = (fn: (p: CyclePeriod[]) => void) =>
    setCycle((d) => {
      d.cycles = structuredClone(periodsOf(d.cycles, spec, SUBMISSION_DEADLINE, d));
      fn(d.cycles);
    });

  const audit = (type: AuditType, action: string, extra: { before?: string; after?: string } = {}) => recordAudit({ user: me, role, type, action, workspace: label, ...extra });
  const touch = (codes: string[]) => setCycle((d) => void codes.forEach((c) => (d.activity[controlKey(reqs.find((r) => r.code === c) ?? { code: c })] = nowIso())));
  const control = (code: string) => controls.find((c) => c.code === code);

  return {
    ...work,
    cycle,
    setCycle,
    controls,
    control,
    runs,
    summary,
    label,
    workspace,
    entityMeta: meta,
    closed,
    periods,
    period,
    /** "Cycle 1 of 2", or empty for a standard with one cycle. */
    cycleText: cycleLabel(period, periods.length),
    cycleCount: cycleCount(spec),
    setPeriods,
    workplace,
    me,
    role,
    ai: platform.ai,
    audit,
    touch,
    fwId,

    /** Changes deadline, owner, department, applicability or instruction of several controls, with the reason kept in the history. */
    updatePlan(codes: string[], change: { due?: string; owner?: string; department?: string; na?: string | null; instruction?: string }, reason: string, notify: number) {
      const parts: string[] = [];
      if (change.due) parts.push(`Deadline → ${change.due}`);
      if (change.owner) parts.push(`Owner → ${change.owner}`);
      if (change.department) parts.push(`Department → ${change.department}`);
      if (change.na) parts.push("Marked not applicable");
      if (change.na === null) parts.push("Applicable again");
      if (change.instruction) parts.push("Instruction updated");
      setCycle((d) => {
        for (const code of codes) {
          const e = (d.plan[code] ??= {});
          if (change.due) e.due = change.due;
          if (change.owner) e.owner = change.owner;
          if (change.department) e.department = change.department;
          if (change.na) e.na = { reason: change.na, by: me, at: day(), confirmed: true };
          if (change.na === null) delete e.na;
          if (change.instruction) e.instruction = change.instruction;
          d.activity[code] = nowIso();
        }
        d.history.unshift({ at: day(), controls: codes, change: parts.join(" · "), reason, by: me, notified: notify });
      });
      // Owner and deadline reach the requirements too, so every list shows the same plan.
      if (change.owner || change.due) {
        for (const code of codes) {
          const c = control(code);
          if (!c) continue;
          for (const r of c.reqs) assign([r.code], change.owner ?? r.owner, change.due ?? r.due);
        }
      }
      audit("Plan", `${parts.join(" · ")} for ${codes.join(", ")}`, { after: reason });
    },

    /** Index Owner's decision on one requirement of a control under review. */
    decide(code: string, req: string, v: "met" | "not") {
      setCycle((d) => {
        const r = (d.reviews[code] ??= { decisions: {}, returns: 0 });
        r.decisions[req] = v;
      });
    },

    accept(code: string) {
      const c = control(code);
      if (!c) return;
      move(c.reqs.map((r) => r.code), "acc", `${me} accepted control ${code}`);
      setCycle((d) => {
        const r = (d.reviews[code] ??= { decisions: {}, returns: 0 });
        r.acceptedAt = day();
        d.activity[code] = nowIso();
      });
      audit("Review", `Accepted control ${code}`, { after: `${c.met}/${c.total} met` });
    },

    /** Sends the requirements ruled not met back to the Control Owner with a note for each. */
    returnControl(code: string, notes: Record<string, string>, message: string, met?: string[]) {
      const c = control(code);
      if (!c) return;
      const back = Object.keys(notes);
      const codes = back.length ? back : c.reqs.filter((r) => r.stage !== "accepted").map((r) => r.code);
      ret(codes, `${me} returned control ${code} to ${c.owner || "its owner"}`);
      const isMet = (r: string) => (met ? met.includes(r) : cycle.reviews[code]?.decisions[r] === "met");
      const keep = c.reqs.filter((r) => !codes.includes(r.code) && r.stage !== "accepted" && isMet(r.code)).map((r) => r.code);
      if (keep.length) move(keep, "acc");
      setCycle((d) => {
        const r = (d.reviews[code] ??= { decisions: {}, returns: 0 });
        r.returns += 1;
        for (const [k, v] of Object.entries(notes)) d.notes[k] = v;
        d.followUps.unshift({ id: `fu-${Date.now()}`, control: code, to: c.owner, text: message, at: nowIso(), by: me, kind: "Return" });
        d.activity[code] = nowIso();
      });
      audit("Review", `Returned control ${code} to ${c.owner || "owner"}`, { after: `${codes.length} requirements to fix` });
    },

    /** Control Owner submits the control's open requirements to the Index Owner. */
    submit(code: string) {
      const c = control(code);
      if (!c) return;
      const open = c.reqs.filter((r) => r.stage !== "accepted" && r.status !== "na").map((r) => r.code);
      move(open, "rev", `${me} submitted control ${code} to the Index Owner`);
      setCycle((d) => {
        for (const r of open) delete d.notes[r];
        d.activity[code] = nowIso();
      });
      audit("Review", `Submitted control ${code}`, { after: `${open.length} requirements` });
    },

    saveResponse(code: string, text: string) {
      setCycle((d) => {
        const prev = d.responses[code];
        d.responses[code] = { text, savedAt: nowIso(), by: prev?.by ?? me, editedBy: prev && prev.by !== me ? me : prev?.editedBy };
        d.activity[code] = nowIso();
      });
      // Writing the response starts the control.
      const c = control(code);
      if (c) {
        const fresh = c.reqs.filter((r) => r.stage === "not").map((r) => r.code);
        if (fresh.length) move(fresh, "prog");
      }
    },

    comment(code: string, text: string) {
      setCycle((d) => void (d.comments[code] ??= []).push({ id: `c-${Date.now()}`, by: me, role, at: nowIso(), text }));
    },

    followUp(code: string, to: string, text: string, kind: FollowUp["kind"] = "Follow-up") {
      setCycle((d) => void d.followUps.unshift({ id: `fu-${Date.now()}-${code}`, control: code, to, text, at: nowIso(), by: me, kind }));
    },

    addRisk(r: Omit<RiskItem, "id">) {
      setCycle((d) => void d.risks.unshift({ ...r, id: `rk-${Date.now()}` }));
      audit("Plan", `Logged ${r.type.toLowerCase()}: ${r.title}`);
    },

    owners: people,
    deptOf: (name: string) => people.find((p) => p.name === name)?.department ?? "",
    reqLabel,
  };
}
