import { describe, expect, it } from "vitest";
import { ECC_LEVELS, ECC_REQUIREMENTS } from "@/lib/admin/ecc-2024";
import { QIYAS_V5_LEVELS, QIYAS_V5_REQUIREMENTS } from "@/lib/admin/qiyas-v5";
import { DEFAULT_LEVELS, indexLevels, levelText, otherLevels } from "./levels";

describe("index levels", () => {
  it("reads workspace records' path off the code, with the names it has", () => {
    const l = indexLevels({ names: new Map([["4", "Human capital"], ["4.1.2", "Digital competency"]]) });
    expect(l.labels).toEqual(DEFAULT_LEVELS);
    expect(l.rowLevel).toBe(3);
    expect(l.pathOf("4.1.2-1", "Framework defined")).toEqual([
      { code: "4", name: "Human capital" },
      { code: "4.1", name: "" },
      { code: "4.1.2", name: "Digital competency" },
      { code: "4.1.2-1", name: "Framework defined" },
    ]);
  });

  it("follows Qiyas V5 parents: perspective › axis › standard, with the implementation requirements below", () => {
    const l = indexLevels({ levels: QIYAS_V5_LEVELS, nodes: QIYAS_V5_REQUIREMENTS });
    expect(l.labels).toEqual(["Perspective", "Axis", "Standard", "Implementation requirement"]);
    expect(l.rowLevel).toBe(2);
    const standard = QIYAS_V5_REQUIREMENTS.find((n) => n.level === "lv-3" && n.code.startsWith("5.9."))!;
    const p = l.pathOf(standard.code, "Risk standard");
    expect(p[0].code).toBe("P4");
    expect(p[1].code).toBe("5.9");
    expect(p[2]).toEqual({ code: standard.code, name: "Risk standard" });
    expect(p[3].below!.every((c) => c.startsWith(`${standard.code}-`))).toBe(true);
    expect(p[3].name).toMatch(/^\d+ implementation requirements?$/);
  });

  it("follows NCA ECC parents down to the control", () => {
    const l = indexLevels({ levels: ECC_LEVELS, nodes: ECC_REQUIREMENTS });
    const p = l.pathOf("1-1-1", "Strategy");
    expect(p.map((c) => c.code).slice(0, 3)).toEqual(["1", "1-1", "1-1-1"]);
    expect(p[0].name).toBe("Cybersecurity Governance");
    expect(otherLevels(l, "1-1-1", "Strategy").map((x) => x.label)).toEqual(["Main domain", "Subdomain", "Subcontrol"]);
  });

  it("joins code and name for spreadsheet cells", () => {
    expect(levelText({ code: "5.9", name: "Risk" })).toBe("5.9 · Risk");
    expect(levelText({ code: "4.1", name: "" })).toBe("4.1");
  });
});
