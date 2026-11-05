import { describe, expect, it } from "vitest";
import AR from "./ar.json";
import { translateText } from "./translate";

const dict = AR as Record<string, string>;

describe("Arabic translation", () => {
  it("translates interface strings and ignores text it does not know", () => {
    expect(translateText("Requirements")).toBe(dict["Requirements"]);
    expect(translateText("  Evidence   library ")).toBe(dict["Evidence library"]);
    expect(translateText("Layan T.")).toBeNull();
    expect(translateText("5.1.2-3")).toBeNull();
  });

  it("fills templates with the values from the page, translating known values", () => {
    const t = translateText("Assigned 1.1.1-1 to Layan T.")!;
    expect(t).toContain("1.1.1-1");
    expect(t).toContain("Layan T.");
    expect(t).not.toMatch(/Assigned/);
    expect(translateText("Clarifications · 3")).toBe(dict["Clarifications · {0}"].replace("{0}", "3"));
  });

  it("handles dates, day counts and lines built from known parts", () => {
    expect(translateText("02 Nov 2026")).toBe("02 نوفمبر 2026");
    expect(translateText("37 d left")).toBe("متبقٍ 37 يوم");
    expect(translateText("Co-managed · Not started")).toBe(`${dict["Co-managed"]} · ${dict["Not started"]}`);
  });

  it("keeps every template's placeholders", () => {
    const bad = Object.entries(dict).filter(([en, ar]) => (en.match(/\{\d+\}/g) ?? []).sort().join() !== (ar.match(/\{\d+\}/g) ?? []).sort().join());
    expect(bad).toEqual([]);
  });
});
