import { describe, expect, it } from "vitest";
import { ECC_REQUIREMENTS } from "./ecc-2024";

describe("NCA ECC-2:2024", () => {
  const at = (depth: number) => ECC_REQUIREMENTS.filter((r) => r.code.split("-").length === depth);

  it("has the published structure", () => {
    expect([1, 2, 3, 4].map((d) => at(d).length)).toEqual([4, 28, 110, 92]);
  });

  it("has Arabic for every node and English for all but the Arabic-only controls", () => {
    expect(ECC_REQUIREMENTS.filter((r) => !r.titleAr)).toEqual([]);
    expect(ECC_REQUIREMENTS.filter((r) => !r.title).map((r) => r.code)).toEqual(["1-7-1", "2-7-3"]);
    expect(at(2).filter((r) => !r.text || !r.textAr)).toEqual([]);
  });

  it("links every node to an existing parent", () => {
    const codes = new Set(ECC_REQUIREMENTS.map((r) => r.code));
    expect(ECC_REQUIREMENTS.filter((r) => r.parent && !codes.has(r.parent))).toEqual([]);
    expect(new Set(ECC_REQUIREMENTS.map((r) => r.code)).size).toBe(ECC_REQUIREMENTS.length);
  });
});
