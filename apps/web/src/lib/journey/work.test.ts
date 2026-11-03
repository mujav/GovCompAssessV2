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

  it("an index owner's move overrides the base stage and clears a return", () => {
    const r = WS_REQUIREMENTS.find((x) => baseStage(x) === "rev")!;
    const o = { stage: { [r.code]: "acc" as const }, returned: [] };
    expect(stageOf(r, o)).toBe("acc");
    expect(isReturned(r, o)).toBe(false);
    const back = { stage: { [r.code]: "prog" as const }, returned: [r.code] };
    expect(isReturned(r, back)).toBe(true);
  });

  it("evidence moves a requirement on: files → in progress, AI-assessed files → in review", () => {
    const r = WS_REQUIREMENTS.find((x) => baseStage(x) === "start")!;
    expect(stageOf({ ...r, upload: { files: 2, assessed: false, sig: "a,b|" } }, EMPTY_OVERLAY)).toBe("prog");
    expect(stageOf({ ...r, upload: { files: 2, assessed: true, sig: "a,b|R1" } }, EMPTY_OVERLAY)).toBe("rev");
    // Evidence never pulls a requirement back.
    const acc = WS_REQUIREMENTS.find((x) => baseStage(x) === "acc")!;
    expect(stageOf({ ...acc, upload: { files: 1, assessed: false, sig: "a|" } }, EMPTY_OVERLAY)).toBe("acc");
  });

  it("a consultant move holds until the evidence changes after it", () => {
    const r = WS_REQUIREMENTS.find((x) => baseStage(x) === "start")!;
    const assessed = { ...r, upload: { files: 1, assessed: true, sig: "a|R1" } };
    // L1 asked for more evidence after the assessment: it stays in progress.
    const o = { stage: { [r.code]: "prog" as const }, returned: [r.code], seen: { [r.code]: "a|R1" } };
    expect(stageOf(assessed, o)).toBe("prog");
    expect(isReturned(assessed, o)).toBe(true);
    // New files arrive and are assessed: back in review, no longer marked returned.
    const fresh = { ...r, upload: { files: 2, assessed: true, sig: "a,b|R2" } };
    expect(stageOf(fresh, o)).toBe("rev");
    expect(isReturned(fresh, o)).toBe(false);
  });

  it("reads moves saved under the two-layer review as accepted", () => {
    const r = WS_REQUIREMENTS.find((x) => baseStage(x) === "rev")!;
    expect(stageOf(r, { stage: { [r.code]: "cli" } as never, returned: [] })).toBe("acc");
  });

  it("sorts codes naturally", () => {
    const codes = ["5.11.2-2", "5.2.1-1", "1.10.1-1", "1.2.1-1"].sort((a, b) => codeKey(a).localeCompare(codeKey(b)));
    expect(codes).toEqual(["1.2.1-1", "1.10.1-1", "5.2.1-1", "5.11.2-2"]);
  });
});
