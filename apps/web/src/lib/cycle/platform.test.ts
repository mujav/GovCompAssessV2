import { describe, expect, it } from "vitest";
import { agentPolicy, DEFAULT_AI, type AiSettings } from "./platform";
import { selfCheck } from "./model";

const ai: AiSettings = structuredClone(DEFAULT_AI);

describe("AI settings reach the agents", () => {
  it("sends only editable guardrails that are on, with the agent's own behaviour and model tier", () => {
    const s = structuredClone(ai);
    s.guardrails.find((g) => g.id === "g-criticality")!.on = false;
    s.guardrails.push({ id: "x", title: "Check the signatory", detail: "Name who signed", on: true, custom: true }, { id: "y", title: " ", detail: "", on: true, custom: true });
    s.behavior.review = { instructions: "Be careful", strictness: "strict", language: "ar" };
    s.models.review = "Fast";
    const p = agentPolicy(s, "review");
    expect(p.guardrails).toEqual(["Follow the standard strictly: Judge only against the requirement text and the Index Owner instructions", "Check the signatory: Name who signed"]);
    expect(p).toMatchObject({ instructions: "Be careful", strictness: "strict", language: "ar", tier: "Fast" });
  });

  it("keeps the locked guardrails switched on by default", () => {
    expect(ai.guardrails.filter((g) => g.locked).every((g) => g.on)).toBe(true);
  });

  it("self-check follows its options", () => {
    const files = [{ id: "E1", name: "plan-draft.pdf", pages: 3 }, { id: "E2", name: "report-2023.pdf", pages: 3 }, { id: "E3", name: "manual.pdf", pages: 12 }];
    expect(selfCheck(files, "").filter((x) => !x.ok)).toHaveLength(2);
    const off = selfCheck(files, "", { pageRefOver: 10, flagDrafts: false, flagOldYears: false }).filter((x) => !x.ok);
    expect(off.map((x) => x.ref)).toEqual(["E3"]);
  });
});
