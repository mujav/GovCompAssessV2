import { describe, expect, it } from "vitest";
import { WS_REQUIREMENTS } from "@/lib/workspace/data";
import { EMPTY_OVERLAY, baseStage, codeKey, isReturned, pipelineBands, stageCounts, stageOf } from "./work";

describe("consultant work stages", () => {
  it("places every requirement in exactly one stage", () => {
    const c = stageCounts(WS_REQUIREMENTS, EMPTY_OVERLAY);
    expect(Object.values(c).reduce((a, b) => a + b, 0)).toBe(WS_REQUIREMENTS.length);
    expect(c.acc).toBeGreaterThan(0);
    expect(c.rev).toBeGreaterThan(0);
  });

  it("pipeline bands add up to the same total", () => {
    const b = pipelineBands(WS_REQUIREMENTS, EMPTY_OVERLAY);
    expect(Object.values(b).reduce((a, x) => a + x, 0)).toBe(WS_REQUIREMENTS.length);
  });

  it("a consultant move overrides the base stage and clears a return", () => {
    const r = WS_REQUIREMENTS.find((x) => baseStage(x) === "rev")!;
    const o = { stage: { [r.code]: "cli" as const }, returned: [] };
    expect(stageOf(r, o)).toBe("cli");
    expect(isReturned(r, o)).toBe(false);
    const back = { stage: { [r.code]: "prog" as const }, returned: [r.code] };
    expect(isReturned(r, back)).toBe(true);
  });

  it("sorts codes naturally", () => {
    const codes = ["5.11.2-2", "5.2.1-1", "1.10.1-1", "1.2.1-1"].sort((a, b) => codeKey(a).localeCompare(codeKey(b)));
    expect(codes).toEqual(["1.2.1-1", "1.10.1-1", "5.2.1-1", "5.11.2-2"]);
  });
});
