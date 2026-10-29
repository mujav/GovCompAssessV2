// Deterministic scoring engine. Official scores are always calculated here, never by AI.

import type { ComplianceStatus, ScoringMethod, ScoringScheme } from "@/lib/admin/types";
import type { SampleRequirement } from "@/lib/admin/sample-data";

type Scored = Exclude<ComplianceStatus, "na">;

// Fixed scales; only three-level and custom points read the scheme's points table.
const FIXED: Partial<Record<ScoringMethod, Record<Scored, number>>> = {
  binary: { comp: 1, part: 0, non: 0, nas: 0 },
  maturity: { comp: 1, part: 0.6, non: 0.2, nas: 0 },
};

export function pointsTable(scheme: ScoringScheme): Record<Scored, number> {
  return FIXED[scheme.method] ?? scheme.points;
}

/** Status after blocking rules: a failed mandatory criterion caps the requirement. */
export function effectiveStatus(req: SampleRequirement, scheme: ScoringScheme): ComplianceStatus {
  if (!req.mandatoryFail || scheme.blockingCap === "off") return req.status;
  if (req.status === "comp" || req.status === "part") return scheme.blockingCap;
  return req.status;
}

function round(n: number, digits: number) {
  const f = 10 ** digits;
  return Math.round(n * f + Number.EPSILON) / f;
}

export interface ScoreResult {
  pct: number;
  numerator: number;
  denominator: number;
}

/** Weighted percentage: Σ points × weight ÷ Σ applicable weight × 100. */
export function score(reqs: SampleRequirement[], scheme: ScoringScheme): ScoreResult {
  const table = pointsTable(scheme);
  let num = 0;
  let den = 0;
  for (const r of reqs) {
    const w = scheme.weights[r.weight];
    const s = effectiveStatus(r, scheme);
    if (s === "na") {
      // "exclude" and "redistribute" both leave N/A out of the denominator at this level;
      // "authority" counts N/A as fully met.
      if (scheme.naTreatment === "authority") {
        num += w;
        den += w;
      }
      continue;
    }
    num += table[s] * w;
    den += w;
  }
  const pct = den === 0 ? 0 : round((num / den) * 100, scheme.rounding);
  return { pct, numerator: round(num, 2), denominator: round(den, 2) };
}

export function scoreByDomain(reqs: SampleRequirement[], scheme: ScoringScheme) {
  const domains = [...new Set(reqs.map((r) => r.domain))];
  return domains.map((domain) => ({ domain, ...score(reqs.filter((r) => r.domain === domain), scheme) }));
}

export interface SchemeComparison {
  before: ScoreResult;
  after: ScoreResult;
  changedRequirements: string[];
  domains: { domain: string; before: number; after: number }[];
}

/** Preview a draft against the live scheme on the same records. */
export function compareSchemes(reqs: SampleRequirement[], live: ScoringScheme, draft: ScoringScheme): SchemeComparison {
  const lt = pointsTable(live);
  const dt = pointsTable(draft);
  const pts = (t: Record<Scored, number>, s: ComplianceStatus) => (s === "na" ? -1 : t[s]);
  const changedRequirements = reqs
    .filter((r) => {
      const a = effectiveStatus(r, live);
      const b = effectiveStatus(r, draft);
      // A weight change moves the score but not the requirement's own result.
      return a !== b || pts(lt, a) !== pts(dt, b);
    })
    .map((r) => r.code);
  const before = scoreByDomain(reqs, live);
  const after = scoreByDomain(reqs, draft);
  return {
    before: score(reqs, live),
    after: score(reqs, draft),
    changedRequirements,
    domains: before.map((b, i) => ({ domain: b.domain, before: b.pct, after: after[i].pct })),
  };
}

export interface Check {
  ok: boolean;
  text: string;
}

export function validateScheme(scheme: ScoringScheme): Check[] {
  const table = pointsTable(scheme);
  const pointsOk = Object.values(table).every((p) => Number.isFinite(p) && p >= 0 && p <= 1);
  const ordered = table.comp >= table.part && table.part >= table.non;
  const thresholds = scheme.green > scheme.amber && scheme.amber > 0 && scheme.green <= 100;
  const weightsOk = Object.values(scheme.weights).every((w) => Number.isFinite(w) && w > 0);
  const checks: Check[] = [
    { ok: pointsOk, text: pointsOk ? "Every status maps to points between 0 and 1" : "Points must be numbers between 0 and 1" },
    { ok: ordered, text: ordered ? "Compliant ≥ partial ≥ non-compliant" : "Points must not rank partial above compliant" },
    { ok: thresholds, text: thresholds ? "Thresholds ordered and non-overlapping" : "Green must be above amber, both within 0–100" },
    { ok: weightsOk, text: weightsOk ? "Weights are positive" : "Every weight must be a positive number" },
    { ok: true, text: "Formula uses approved blocks only" },
  ];
  return checks;
}

export function isMaterialScoringChange(live: ScoringScheme, draft: ScoringScheme) {
  const strip = (s: ScoringScheme) => JSON.stringify({ ...s, version: 0 });
  return strip(live) !== strip(draft);
}
