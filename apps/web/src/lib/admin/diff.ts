// Human-readable comparison of a draft against its live version, stored on the change
// request so reviewers approve exactly what they saw.

import type {
  AcceptancePolicy,
  AutomationRule,
  ConfigKind,
  DiffRow,
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
  };
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
  return rows(keys.map((k) => [k, a[k] ?? "—", b[k] ?? "—"]));
}
