// Human-readable comparison of a draft against its live version, stored on the change
// request so reviewers approve exactly what they saw.

import type {
  AcceptancePolicy,
  AutomationRule,
  ConfigKind,
  DiffRow,
  FrameworkRequirement,
  FrameworkVersion,
  ScoringScheme,
} from "./types";

const METHOD = { binary: "Binary", three: "Three-level", maturity: "Maturity 0–5", points: "Weighted points" };
const NA = { exclude: "exclude from denominator", redistribute: "redistribute within standard", authority: "authority-defined (counts as met)" };
const CAP = { non: "cap at Non-compliant", part: "cap at Partial", off: "no cap" };

function rows(pairs: [string, string, string][]): DiffRow[] {
  return pairs.map(([label, before, after]) => ({ label, before, after, changed: before !== after }));
}

export function describeFramework(v?: FrameworkVersion) {
  return {
    Name: v?.name ?? "—",
    Effective: v?.effective ?? "—",
    "Hierarchy levels": v ? v.levels.map((l) => l.en).join(" › ") : "—",
    "Arabic labels": v ? v.levels.map((l) => l.ar).join(" › ") : "—",
    "Code patterns": v ? v.levels.map((l) => l.pattern).join(" · ") : "—",
    "Requirements import": v?.importJob ? `${v.importJob.file} · ${v.importJob.valid} valid · ${v.importJob.warnings.length} warnings` : "—",
    Requirements: v?.requirements?.length ? requirementCounts(v) : "—",
  };
}

/** "3 Axis · 9 Standard · 17 Requirement" for a version's requirement tree. */
export function requirementCounts(v: FrameworkVersion) {
  const reqs = v.requirements ?? [];
  const parts = v.levels.map((l) => `${reqs.filter((r) => r.level === l.id).length} ${l.en}`);
  const unplaced = reqs.filter((r) => !v.levels.some((l) => l.id === r.level)).length;
  return [...parts, ...(unplaced ? [`${unplaced} without a level`] : [])].join(" · ");
}

export interface RequirementDiff {
  added: FrameworkRequirement[];
  changed: { before: FrameworkRequirement; after: FrameworkRequirement; fields: string[] }[];
  removed: FrameworkRequirement[];
}

const REQ_FIELDS = ["title", "text", "evidence", "parent"] as const;

/** Requirement-level comparison by code. */
export function diffRequirements(before: FrameworkRequirement[] = [], after: FrameworkRequirement[] = []): RequirementDiff {
  const old = new Map(before.map((r) => [r.code, r]));
  const now = new Set(after.map((r) => r.code));
  const changed: RequirementDiff["changed"] = [];
  for (const r of after) {
    const b = old.get(r.code);
    if (!b) continue;
    const fields = REQ_FIELDS.filter((f) => (b[f] ?? "") !== (r[f] ?? ""));
    if (fields.length) changed.push({ before: b, after: r, fields });
  }
  return { added: after.filter((r) => !old.has(r.code)), changed, removed: before.filter((r) => !now.has(r.code)) };
}

export function requirementSummary(d: RequirementDiff) {
  const parts = [d.added.length && `${d.added.length} new`, d.changed.length && `${d.changed.length} changed`, d.removed.length && `${d.removed.length} removed`].filter(Boolean);
  return parts.length ? parts.join(" · ") : "no requirement changes";
}

function describeRequirement(r: FrameworkRequirement, fields: readonly string[] = ["title"]) {
  const parts = [r.title || "(untitled)"];
  for (const f of fields) {
    if (f === "text" && r.text) parts.push(`text: ${r.text}`);
    if (f === "evidence" && r.evidence) parts.push(`evidence: ${r.evidence}`);
    if (f === "parent") parts.push(`under ${r.parent ?? "top level"}`);
  }
  return parts.join(" · ");
}

const MAX_REQUIREMENT_ROWS = 60;

function requirementRows(before?: FrameworkVersion, after?: FrameworkVersion): DiffRow[] {
  const d = diffRequirements(before?.requirements, after?.requirements);
  const rows: DiffRow[] = [
    ...d.added.map((r) => ({ label: `+ ${r.code}`, before: "—", after: describeRequirement(r), changed: true })),
    ...d.changed.map((c) => ({ label: `~ ${c.after.code}`, before: describeRequirement(c.before, c.fields), after: describeRequirement(c.after, c.fields), changed: true })),
    ...d.removed.map((r) => ({ label: `− ${r.code}`, before: describeRequirement(r), after: "—", changed: true })),
  ];
  if (rows.length <= MAX_REQUIREMENT_ROWS) return rows;
  const rest = rows.length - MAX_REQUIREMENT_ROWS;
  return [...rows.slice(0, MAX_REQUIREMENT_ROWS), { label: "More requirement changes", before: "", after: `${rest} more not shown`, changed: true }];
}

export function describeScoring(s?: ScoringScheme) {
  if (!s) return {};
  return {
    Method: METHOD[s.method],
    "Points (C / P / N / NA-assessed)": s.method === "three" || s.method === "points" ? `${s.points.comp} / ${s.points.part} / ${s.points.non} / ${s.points.nas}` : "fixed scale",
    "Blocking rule SR-03": `mandatory fail → ${CAP[s.blockingCap]}`,
    "N/A treatment": NA[s.naTreatment],
    Weights: `high ${s.weights.high} · med ${s.weights.med} · low ${s.weights.low}`,
    Thresholds: `green ≥ ${s.green} · amber ≥ ${s.amber}`,
    Target: String(s.target),
    Rounding: `${s.rounding} decimal${s.rounding === 1 ? "" : "s"}`,
    "Override second approval": `Δ ≥ ${s.overrideDelta} pts`,
  };
}

export function describePolicy(p?: AcceptancePolicy) {
  if (!p) return {};
  const out: Record<string, string> = { Name: p.name, Scope: p.scope };
  p.stages.forEach((s, i) => {
    out[`Stage ${i + 1}`] = `${s.name} · ${s.mode} · ${s.minApprovals} of ${s.poolSize} · ${s.slaDays}d SLA`;
  });
  out["Override governance"] = [p.rationaleRequired && "rationale", p.materialOverrideEscalates && "material escalates", p.allowBulk && "bulk allowed"]
    .filter(Boolean)
    .join(", ") || "none";
  out["Reopen when"] = [p.reopenOnEvidence && "evidence", p.reopenOnClarification && "clarification", p.reopenOnConfig && "config change"]
    .filter(Boolean)
    .join(", ") || "never";
  return out;
}

export function describeRule(r?: AutomationRule) {
  if (!r) return {};
  return {
    Name: r.name,
    Trigger: `${r.trigger} at ${r.time}`,
    Conditions: r.conditions.map((c) => `${c.field} ${c.op} ${c.value}`).join(" AND ") || "none",
    Actions: r.actions.join("; "),
  };
}

const DESCRIBE = {
  framework: describeFramework,
  scoring: describeScoring,
  acceptance: describePolicy,
  rule: describeRule,
} as const;

export function diffConfig(kind: ConfigKind, before: unknown, after: unknown): DiffRow[] {
  const describe = DESCRIBE[kind] as (v: unknown) => Record<string, string>;
  const a = describe(before);
  const b = describe(after);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  const out = rows(keys.map((k) => [k, a[k] ?? "—", b[k] ?? "—"]));
  if (kind === "framework") out.push(...requirementRows(before as FrameworkVersion | undefined, after as FrameworkVersion | undefined));
  return out;
}
