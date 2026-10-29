import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/admin/seed";
import { diffConfig } from "@/lib/admin/diff";
import { DEMO_TODAY, SAMPLE_ACTIONS, SAMPLE_REQUIREMENTS, type SampleRequirement } from "@/lib/admin/sample-data";
import type { AcceptancePolicy, AutomationRule, ScoringScheme } from "@/lib/admin/types";
import { SCENARIOS, simulate, validatePolicy } from "./acceptance";
import { conditionMatches, resolveDate, testRule, validateRule } from "./rules";
import { compareSchemes, effectiveStatus, score, validateScheme } from "./scoring";

const seed = createSeed();
const live = seed.scoring.live as ScoringScheme;
const draft = seed.scoring.draft as ScoringScheme;

const req = (p: Partial<SampleRequirement>): SampleRequirement => ({ code: "x", domain: "D", weight: "med", status: "comp", mandatoryFail: false, ...p });

describe("scoring engine", () => {
  it("weights points over applicable requirements", () => {
    const r = score([req({ status: "comp", weight: "high" }), req({ status: "part" }), req({ status: "non", weight: "low" })], live);
    // (1×1.5 + 0.5×1 + 0×0.5) / 3 = 66.7
    expect(r.pct).toBe(66.7);
    expect(r.denominator).toBe(3);
  });

  it("excludes N/A by default and counts it as met under authority treatment", () => {
    const reqs = [req({ status: "non" }), req({ status: "na" })];
    expect(score(reqs, live).pct).toBe(0);
    expect(score(reqs, { ...live, naTreatment: "authority" }).pct).toBe(50);
  });

  it("applies the blocking cap for failed mandatory criteria", () => {
    const r = req({ status: "part", mandatoryFail: true });
    expect(effectiveStatus(r, live)).toBe("part");
    expect(effectiveStatus(r, draft)).toBe("non");
    expect(effectiveStatus(r, { ...live, blockingCap: "off" })).toBe("part");
  });

  it("binary scoring gives partial no credit", () => {
    expect(score([req({ status: "part" })], { ...live, method: "binary" }).pct).toBe(0);
  });

  it("compares live and draft on the same records", () => {
    const c = compareSchemes(SAMPLE_REQUIREMENTS, live, draft);
    expect(c.changedRequirements.length).toBeGreaterThan(0);
    expect(c.after.pct).not.toBe(c.before.pct);
    expect(c.domains).toHaveLength(6);
  });

  it("flags unordered thresholds and bad points", () => {
    const bad = validateScheme({ ...live, green: 50, amber: 60, points: { ...live.points, part: 2 } });
    expect(bad.filter((c) => !c.ok)).toHaveLength(3);
    expect(validateScheme(live).every((c) => c.ok)).toBe(true);
  });
});

describe("rule engine", () => {
  const esc = seed.rules.find((r) => r.id === "ESC-02")!;

  it("resolves relative dates", () => {
    expect(resolveDate("today", DEMO_TODAY)).toBe("2026-10-28");
    expect(resolveDate("today+3", DEMO_TODAY)).toBe("2026-10-31");
    expect(resolveDate("today-28", DEMO_TODAY)).toBe("2026-09-30");
  });

  it("matches the 'in' operator case-insensitively", () => {
    const r = SAMPLE_ACTIONS[0];
    expect(conditionMatches({ id: "c", field: "priority", op: "in", value: "high, critical" }, r, DEMO_TODAY)).toBe(true);
  });

  it("v3 adds the priority condition and narrows matches", () => {
    const v2 = testRule(esc.live as AutomationRule, SAMPLE_ACTIONS, DEMO_TODAY);
    const v3 = testRule(esc.draft as AutomationRule, SAMPLE_ACTIONS, DEMO_TODAY);
    expect(v3.matches.length).toBeLessThan(v2.matches.length);
    expect(v3.matches.every((m) => ["High", "Critical"].includes(m.priority))).toBe(true);
    expect(v3.nearMisses.length).toBeGreaterThan(0);
  });

  it("rejects empty or non-numeric values", () => {
    const rule = { ...(esc.live as AutomationRule), conditions: [{ id: "c", field: "reminders_sent" as const, op: "≥" as const, value: "two" }] };
    expect(validateRule(rule).some((c) => !c.ok)).toBe(true);
  });
});

describe("acceptance engine", () => {
  const crit = seed.policies.find((p) => p.id === "AP-QIYAS-CRIT")!.draft as AcceptancePolicy;

  it("routes a material override through extra approval to acceptance", () => {
    const steps = simulate(crit, SCENARIOS[0]);
    expect(steps.some((s) => s.tone === "warn")).toBe(true);
    expect(steps.at(-1)).toMatchObject({ tone: "good" });
    expect(steps.at(-1)!.text).toContain("Accepted (Partial)");
  });

  it("stops at the rejecting stage", () => {
    const steps = simulate(crit, SCENARIOS[2]);
    expect(steps.at(-1)!.tone).toBe("bad");
    expect(steps).toHaveLength(3);
  });

  it("requires a single final stage placed last", () => {
    expect(validatePolicy(crit).every((c) => c.ok)).toBe(true);
    const broken = { ...crit, stages: [...crit.stages].reverse() };
    expect(validatePolicy(broken).some((c) => !c.ok)).toBe(true);
    expect(validatePolicy({ ...crit, stages: [] })[0].ok).toBe(false);
  });
});

describe("change request diff", () => {
  it("marks only changed settings", () => {
    const rows = diffConfig("scoring", live, draft);
    const changed = rows.filter((r) => r.changed).map((r) => r.label);
    expect(changed).toEqual(["Blocking rule SR-03", "Weights"]);
  });
});
