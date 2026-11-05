import { describe, expect, it } from "vitest";
import { ECC_RECORDS, QIYAS_RECORDS } from "@/lib/workspace/data";
import { demoSeed } from "./demo-seed";

describe("seeded review content", () => {
  const seed = demoSeed((c) => `name of ${c}`);

  it("notes every returned requirement, quoting the evidence its standard asks for", () => {
    const returned = [...QIYAS_RECORDS, ...ECC_RECORDS].filter((r) => r.work === "returned" && r.owner);
    expect(returned.length).toBeGreaterThan(0);
    for (const r of returned) expect(seed.notes[r.code]).toBeTruthy();
    const q = QIYAS_RECORDS.find((r) => r.work === "returned" && r.owner && r.evidenceText)!;
    expect(seed.notes[q.code]).toMatch(/أُعيد للتصحيح/);
    const e = ECC_RECORDS.find((r) => r.work === "returned" && r.owner)!;
    expect(seed.notes[e.code]).toMatch(/^Returned:/);
  });

  it("sends each returned control back to its owner once", () => {
    for (const f of seed.followUps) {
      expect(f.kind).toBe("Return");
      expect(seed.returns[f.control]).toBe(1);
    }
  });

  it("writes responses that cite each requirement's evidence", () => {
    const [ctl, res] = Object.entries(seed.responses).find(([c]) => c.startsWith("5."))!;
    expect(res.text).toContain(`name of ${ctl}`);
    expect(res.text).toMatch(/\[E1 · ص\.2\]/);
  });

  it("keeps comment threads to a few controls, question then answer", () => {
    const threads = Object.values(seed.comments);
    expect(threads.length).toBeGreaterThan(0);
    expect(threads.length).toBeLessThanOrEqual(16);
    for (const t of threads) expect(t.map((c) => c.role)).toEqual(["Control Owner", "Index Owner"]);
  });
});
