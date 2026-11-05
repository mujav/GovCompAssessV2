import { describe, expect, it } from "vitest";
import { attention, buildControls, controlOf, oneOwnerPerControl, controlStage, currentPhase, DEFAULT_THRESHOLDS, dimensionOf, domainOf, findingsOf, previousTier, reqLabel, responseGaps, selfCheck, suggestRisks, tierOf, type CycleRequirement } from "./model";
import { maskPersonal } from "./platform";
import type { Stage } from "@/lib/journey/work";

const req = (code: string, over: Partial<CycleRequirement> = {}): CycleRequirement => ({
  code,
  title: `Risk policy: ${code}`,
  domain: "Risk",
  department: "Risk and Compliance",
  owner: "H. Al-Dosari",
  due: "2026-11-10",
  status: "comp",
  evidence: { expected: 2, valid: 2, invalid: 0 },
  ...over,
});

const controls = (reqs: CycleRequirement[], stages: Record<string, Stage>, returned: string[] = []) =>
  buildControls(reqs, { stageOf: (c) => stages[c] ?? "start", returned: (c) => returned.includes(c), names: new Map([["5", "Risk and continuity"], ["5.9.1", "Policy and governance"]]) });

describe("cycle model", () => {
  it("reads the hierarchy from requirement codes", () => {
    expect(controlOf("5.9.1-3")).toBe("5.9.1");
    expect(domainOf("5.9.1-3")).toBe("5.9");
    expect(dimensionOf("5.9.1-3")).toBe("5");
    expect(reqLabel("5.9.1-3")).toBe("R3");
  });

  it("groups requirements into controls with one stage and counts met requirements", () => {
    const [c] = controls([req("5.9.1-1"), req("5.9.1-2"), req("5.9.1-3", { owner: "A. Al-Shehri" })], { "5.9.1-1": "acc", "5.9.1-2": "rev", "5.9.1-3": "acc" });
    expect(c.code).toBe("5.9.1");
    expect(c.title).toBe("Policy and governance");
    expect(c.dimensionName).toBe("Risk and continuity");
    expect(c.owner).toBe("H. Al-Dosari");
    expect(c.stage).toBe("submitted");
    expect(c.met).toBe(2);
    expect(c.total).toBe(3);
  });

  it("gives every requirement of a control its one Control Owner", () => {
    const rows = [
      { code: "1.1.2-1", owner: "Faisal R.", department: "Strategy" },
      { code: "1.1.2-2", owner: "Lama S.", department: "Planning" },
      { code: "1.1.2-3", owner: "Faisal R.", department: "Strategy" },
      { code: "1.2.1-1", owner: "Lama S.", department: "Planning" },
    ];
    expect(oneOwnerPerControl(rows).map((r) => r.owner)).toEqual(["Faisal R.", "Faisal R.", "Faisal R.", "Lama S."]);
    expect(oneOwnerPerControl(rows)[1].department).toBe("Strategy");
    // The owner set in the plan wins.
    expect(oneOwnerPerControl(rows, { "1.1.2": { owner: "Huda B.", department: "HR" } }).slice(0, 3).every((r) => r.owner === "Huda B." && r.department === "HR")).toBe(true);
  });

  it("puts a control with any returned requirement back with its owner", () => {
    expect(controlStage(["accepted", "returned", "review"])).toBe("returned");
    expect(controlStage(["not", "not"])).toBe("not");
    expect(controlStage(["accepted", "draft"])).toBe("draft");
    expect(controlStage(["accepted", "accepted"])).toBe("accepted");
  });

  it("scores requirement-count tiers", () => {
    expect(tierOf(15, 15)).toBe("Full");
    expect(tierOf(14, 15)).toBe("Partial");
    expect(tierOf(13, 15)).toBe("Non");
    expect(tierOf(13, 15, 80)).toBe("Partial");
  });

  it("derives last cycle's tier from previous results", () => {
    expect(previousTier(["comp", "comp"])).toBe("Full");
    expect(previousTier(["comp", "part"])).toBe("Partial");
    expect(previousTier(["comp", "non"])).toBe("Non");
    expect(previousTier(["nas"])).toBeUndefined();
  });

  it("names the phase from where requirements stand", () => {
    const none = { not: 10, draft: 0, submitted: 0, review: 0, returned: 0, accepted: 0 };
    expect(currentPhase(none, false, false)).toBe(0);
    expect(currentPhase({ ...none, not: 2, draft: 8 }, false, false)).toBe(1);
    expect(currentPhase({ ...none, not: 0, submitted: 4, accepted: 6 }, false, false)).toBe(2);
    expect(currentPhase(none, true, false)).toBe(4);
    expect(currentPhase(none, false, true)).toBe(6);
  });

  it("flags overdue, at-risk, stale and repeatedly returned controls", () => {
    const list = controls(
      [req("1.1.1-1", { due: "2026-10-20" }), req("1.1.2-1", { due: "2026-10-30", evidence: { expected: 4, valid: 0, invalid: 0 } }), req("1.1.3-1", { due: "2026-11-30" }), req("1.1.4-1", { due: "2026-11-30" })],
      { "1.1.1-1": "prog", "1.1.2-1": "prog", "1.1.3-1": "prog", "1.1.4-1": "prog" },
    );
    const out = attention(list, "2026-10-28", DEFAULT_THRESHOLDS, { "1.1.4": 2 }, { "1.1.3": "2026-10-10T08:00:00Z", "1.1.4": "2026-10-27T08:00:00Z" });
    expect(out.find((a) => a.control.code === "1.1.1")?.kind).toBe("overdue");
    expect(out.find((a) => a.control.code === "1.1.2")?.kind).toBe("atRisk");
    expect(out.find((a) => a.control.code === "1.1.3")?.kind).toBe("stale");
    expect(out.find((a) => a.control.code === "1.1.4")?.kind).toBe("returnedTwice");
  });

  it("ranks findings by criticality and suggests a risk when one department holds several", () => {
    const list = controls([req("2.1.1-1", { mandatoryFail: true }), req("2.1.1-2", { evidence: { expected: 2, valid: 1, invalid: 0 } }), req("2.1.2-1", { evidence: { expected: 2, valid: 0, invalid: 0 } })], {});
    const f = findingsOf(list[0]);
    expect(f.map((x) => x.level)).toEqual(["Critical", "Medium"]);
    expect(suggestRisks(list, new Set(["2.1.1", "2.1.2"]), "2026-10-28")[0].controls).toEqual(["2.1.1", "2.1.2"]);
  });

  it("finds required evidence the response never cites", () => {
    const [c] = controls([req("5.9.1-1"), req("5.9.1-2")], {});
    expect(responseGaps(c, "Policy approved [E1 · p.3]", { "5.9.1-1": ["E1"], "5.9.1-2": ["E2"] }).map((g) => g.req)).toEqual(["5.9.1-2"]);
  });

  it("self-checks drafts, old files and missing page references", () => {
    const out = selfCheck(
      [
        { id: "E6", name: "Charter_Draft_2026.docx", pages: 6 },
        { id: "E7", name: "Policy_2023.pdf", pages: 3 },
        { id: "E8", name: "Plan.pdf", pages: 40 },
        { id: "E9", name: "Register.xlsx", pages: 2 },
      ],
      "See [E9 · p.1]",
    );
    expect(out.filter((x) => !x.ok).map((x) => x.ref)).toEqual(["E6", "E7", "E8"]);
    expect(out.at(-1)).toMatchObject({ ok: true });
  });

  it("masks personal data before evidence is sent to the model", () => {
    expect(maskPersonal("Call 0551234567 or mail a.b@gov.sa, ID 1012345678")).toBe("Call [phone] or mail [email], ID [national ID]");
  });
});
