import { describe, expect, it } from "vitest";
import { ECC_REQUIREMENTS } from "@/lib/admin/ecc-2024";
import { QIYAS_V5_REQUIREMENTS } from "@/lib/admin/qiyas-v5";
import { ECC_RECORDS, QIYAS_RECORDS, standardUnits } from "./data";

describe("demo records from the published standards", () => {
  it("has one Qiyas record per implementation requirement, with its standard's own wording", () => {
    const reqs = QIYAS_V5_REQUIREMENTS.filter((n) => n.level === "lv-4");
    expect(QIYAS_RECORDS.map((r) => r.code)).toEqual(reqs.map((n) => n.code));
    const r = QIYAS_RECORDS.find((x) => x.code === "5.1.1-1")!;
    expect(r.title).toBe(reqs.find((n) => n.code === "5.1.1-1")!.titleAr);
    expect(r).toMatchObject({ controlCode: "5.1.1", domainCode: "5.1", dimensionCode: "P1", frameworkId: "fw-qiyas" });
    expect(r.evidenceText).toContain("الخطة الإستراتيجية المعتمدة");
  });

  it("shares a Qiyas standard's evidence list out over its requirements in order", () => {
    const units = standardUnits(QIYAS_V5_REQUIREMENTS).filter((u) => u.controlCode === "5.2.3");
    expect(units.map((u) => u.evidence.length)).toEqual([1, 1, 1, 1]);
    expect(units[1].evidence[0]).toContain("قرارات تشكيل اللجان المشتركة");
  });

  it("assesses NCA ECC subcontrols, or the control itself when it has none", () => {
    expect(ECC_RECORDS.find((r) => r.code === "1-5-3-1")).toMatchObject({ controlCode: "1-5-3", domainCode: "1-5", dimensionCode: "1" });
    expect(ECC_RECORDS.find((r) => r.code === "1-1-1")).toMatchObject({ controlCode: "1-1-1", title: ECC_REQUIREMENTS.find((n) => n.code === "1-1-1")!.title });
    expect(ECC_RECORDS.some((r) => r.code === "1-5-3")).toBe(false);
  });

  it("gives every control one owner", () => {
    for (const recs of [QIYAS_RECORDS, ECC_RECORDS]) {
      const owners = new Map<string, Set<string>>();
      for (const r of recs) if (r.owner) owners.set(r.controlCode!, (owners.get(r.controlCode!) ?? new Set()).add(r.owner));
      expect([...owners.values()].every((s) => s.size === 1)).toBe(true);
    }
  });
});
