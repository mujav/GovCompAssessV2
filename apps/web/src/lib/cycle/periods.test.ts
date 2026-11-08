import { describe, expect, it } from "vitest";
import { activeIndex, cycleLabel, datesOf, defaultPeriods, nextDeadline, phaseDue, planProblems, shiftPeriod, workspaceCycle } from "./periods";

const QIYAS = { count: 2, names: [{ en: "Cycle 1" }, { en: "Cycle 2" }] };

describe("assessment cycles", () => {
  it("plans one cycle per cycle the standard runs, the first closing internally on the deadline", () => {
    const ps = defaultPeriods(QIYAS, "2026-11-20");
    expect(ps.map((p) => p.n)).toEqual([1, 2]);
    expect(phaseDue(ps[0], "internal")).toBe("2026-11-20");
    expect(ps[1].opens > phaseDue(ps[0], "results")).toBe(true);
    expect(planProblems(ps)).toEqual([]);
    expect(defaultPeriods(undefined, "2026-11-20")).toHaveLength(1);
  });

  it("keeps a workspace planned before cycles as its first cycle", () => {
    const ps = defaultPeriods(QIYAS, "2026-11-20", { dates: { opening: "2026-09-01", internalClosing: "2026-11-15", submission: "2026-12-01", target: 85 }, phases: ["Plan"], closure: { controls: [], score: 80 } });
    expect(datesOf(ps[0])).toEqual({ opening: "2026-09-01", internalClosing: "2026-11-15", submission: "2026-12-01", target: 85 });
    expect(ps[0].phases[0].name).toBe("Plan");
    expect(ps[0].closure?.score).toBe(80);
    expect(ps[1].closure).toBeUndefined();
  });

  it("runs the first cycle not closed, and closes the year with the last", () => {
    const ps = defaultPeriods(QIYAS, "2026-11-20");
    expect(activeIndex(ps)).toBe(0);
    ps[0].closure = { controls: [], closedAt: "2026-12-30" };
    expect(activeIndex(ps)).toBe(1);
    const w = workspaceCycle({ cycles: ps }, QIYAS);
    expect(w).toMatchObject({ label: "Cycle 2 of 2", closed: false });
    ps[1].closure = { controls: [], closedAt: "2027-06-30" };
    expect(workspaceCycle({ cycles: ps }, QIYAS).closed).toBe(true);
  });

  it("flags phases out of order, deadlines outside the cycle and overlapping cycles", () => {
    const ps = defaultPeriods(QIYAS, "2026-11-20");
    ps[0].phases[2].due = "2026-09-01";
    ps[0].deadlines.push({ id: "d1", name: "Steering committee", due: "2030-01-01" });
    ps[1] = shiftPeriod(ps[1], -200);
    const problems = planProblems(ps);
    expect(problems.some((x) => x.includes("Internal review"))).toBe(true);
    expect(problems.some((x) => x.includes("Steering committee"))).toBe(true);
    expect(problems.some((x) => x.startsWith("Cycle 2 opens"))).toBe(true);
  });

  it("finds the next date, extra deadlines included, and labels only multi-cycle standards", () => {
    const [p] = defaultPeriods(QIYAS, "2026-11-20");
    p.deadlines.push({ id: "d1", name: "Steering committee", due: "2026-11-07" });
    expect(nextDeadline(p, "2026-11-05")?.name).toBe("Steering committee");
    expect(cycleLabel(p, 2)).toBe("Cycle 1 of 2");
    expect(cycleLabel(p, 1)).toBe("");
  });
});
