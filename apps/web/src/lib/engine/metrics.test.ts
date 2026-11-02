import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/admin/seed";
import type { ScoringScheme } from "@/lib/admin/types";
import { CLARIFICATIONS, EVIDENCE_ISSUES, TODAY, WS_ACTIONS, WS_REQUIREMENTS, type WsRequirement } from "@/lib/workspace/data";
import { composeDraft, executiveUpdate } from "@/lib/workspace/drafts";
import { atRisk, filterRequirements, insights, kpis, NO_FILTERS, officialView, opportunities, readiness, scopeContext, scoreImpact, statusMix, type Context } from "./metrics";
import { score } from "./scoring";

const scheme = createSeed().scoring.live as ScoringScheme;
const ctx: Context = { reqs: WS_REQUIREMENTS, actions: WS_ACTIONS, issues: EVIDENCE_ISSUES, clarifications: CLARIFICATIONS, scheme, today: TODAY };

const req = (p: Partial<WsRequirement>): WsRequirement => ({
  code: "x", domain: "D", weight: "med", status: "comp", mandatoryFail: false, title: "t", department: "Dept", owner: "A",
  work: "prog", due: TODAY, review: "accepted", evidence: { expected: 2, valid: 0, invalid: 0 }, ...p,
});

describe("command center metrics", () => {
  it("counts every requirement once in the status mix", () => {
    const mix = statusMix(ctx);
    expect(Object.values(mix).reduce((n, c) => n + c.length, 0)).toBe(350);
  });

  it("official readiness only counts accepted results", () => {
    const reqs = [req({ code: "a", status: "comp" }), req({ code: "b", status: "comp", review: "l1" })];
    expect(officialView(reqs)[1].status).toBe("nas");
    const r = readiness({ ...ctx, reqs });
    expect(r.projected.pct).toBe(100);
    expect(r.official.pct).toBe(50);
  });

  it("score impact equals the score gained by reaching compliant", () => {
    const reqs = [req({ code: "a", status: "part", weight: "high" }), req({ code: "b", status: "comp" })];
    const gained = score([{ ...reqs[0], status: "comp" }, reqs[1]], scheme).pct - score(reqs, scheme).pct;
    expect(scoreImpact(reqs[0], reqs, scheme)).toBeCloseTo(gained, 1);
    expect(scoreImpact(reqs[1], reqs, scheme)).toBe(0);
  });

  it("filters narrow requirements and their actions together", () => {
    const f = { ...NO_FILTERS, department: "Human Capital" };
    const scoped = scopeContext(ctx, f);
    expect(scoped.reqs.length).toBe(filterRequirements(WS_REQUIREMENTS, f, TODAY).length);
    expect(scoped.reqs.every((r) => r.department === "Human Capital")).toBe(true);
    expect(scoped.actions.every((a) => a.department === "Human Capital")).toBe(true);
    expect(scopeContext(ctx, { ...NO_FILTERS, due: "overdue" }).reqs.every((r) => r.due < TODAY)).toBe(true);
  });

  it("KPI numerators match their source records", () => {
    const k = Object.fromEntries(kpis(ctx).map((x) => [x.id, x]));
    expect(k.accepted.codes.length).toBe(Number(k.accepted.value));
    expect(k.blockers.codes.length).toBe(Number(k.blockers.value));
    expect(k.unassigned.codes.length).toBe(Number(k.unassigned.value));
    expect(k.readiness.value).toBe(`${score(WS_REQUIREMENTS, scheme).pct}%`);
  });

  it("ranks opportunities by impact and keeps at-risk items open and due soon", () => {
    const opps = opportunities(ctx);
    expect(opps).toHaveLength(4);
    expect(opps[0].impact).toBeGreaterThanOrEqual(opps[3].impact);
    const risks = atRisk(ctx);
    expect(risks.length).toBeGreaterThan(0);
    expect(risks.every((r) => r.status !== "comp" && r.due <= "2026-11-11")).toBe(true);
  });

  it("builds the briefing from records with traceable sources", () => {
    const list = insights(ctx, -2.1);
    expect(list.length).toBeGreaterThanOrEqual(4);
    expect(list.every((i) => i.sources.length > 0 && i.codes.length > 0)).toBe(true);
    expect(insights(ctx, 1.2).some((i) => i.id === "trend")).toBe(false);
  });

  it("drafts name the records they cover", () => {
    const codes = atRisk(ctx).slice(0, 2).map((r) => r.code);
    const d = composeDraft("evidence-request", codes, ctx);
    for (const c of codes) expect(d.body).toContain(c);
    expect(executiveUpdate(ctx)).toContain(`${readiness(ctx).projected.pct}%`);
  });
});
