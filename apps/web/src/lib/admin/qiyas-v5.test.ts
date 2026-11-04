import { describe, expect, it } from "vitest";
import { libraryRequirements } from "@/lib/journey/frameworks";
import { QIYAS_V5_LEVELS, QIYAS_V5_REQUIREMENTS } from "./qiyas-v5";

describe("DGA Essential Digital Transformation Standards V5.0", () => {
  const at = (level: string) => QIYAS_V5_REQUIREMENTS.filter((r) => r.level === level);

  it("has the published structure: 10 perspectives, 24 axes, 89 standards", () => {
    expect(["lv-1", "lv-2", "lv-3"].map((l) => at(l).length)).toEqual([10, 24, 89]);
    expect(at("lv-4").length).toBeGreaterThan(300);
  });

  it("gives every standard an objective, a scope and evidence documents", () => {
    expect(at("lv-3").filter((r) => !r.textAr?.startsWith("الهدف: ") || !r.textAr.includes("النطاق: ") || !r.evidenceAr)).toEqual([]);
    expect(QIYAS_V5_REQUIREMENTS.filter((r) => !r.titleAr)).toEqual([]);
  });

  it("links every node to an existing parent", () => {
    const codes = new Set(QIYAS_V5_REQUIREMENTS.map((r) => r.code));
    expect(QIYAS_V5_REQUIREMENTS.filter((r) => r.parent && !codes.has(r.parent))).toEqual([]);
    expect(codes.size).toBe(QIYAS_V5_REQUIREMENTS.length);
  });

  it("is assessed per standard, with its requirements as the items to evidence", () => {
    const reqs = libraryRequirements({ name: "Qiyas", version: "5.0", authority: "DGA", effective: "", scoringNote: "", levels: QIYAS_V5_LEVELS, requirements: QIYAS_V5_REQUIREMENTS });
    expect(reqs).toHaveLength(89);
    expect(reqs[0]).toMatchObject({ code: "5.1.1", title: "التخطيط الاستراتيجي للتحول الرقمي", domain: "الإستراتيجية والتخطيط" });
    expect(reqs[0].text).toContain("5.1.1-1 إعداد إستراتيجية للتحول الرقمي");
  });
});
