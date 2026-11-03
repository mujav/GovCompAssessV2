import { describe, expect, it } from "vitest";
import { ENGAGEMENTS } from "./portfolio";
import { duplicateOf, mergeWorkplaces, newWorkplaceId, phaseOf, workplacesFromEngagements } from "./workplaces";

describe("workplaces", () => {
  const derived = workplacesFromEngagements(ENGAGEMENTS);

  it("makes one workplace per engagement, the entity's first keeping the entity id", () => {
    expect(derived).toHaveLength(ENGAGEMENTS.length);
    const ministry = derived.filter((w) => w.entityId === "demo-ministry");
    expect(ministry.map((w) => w.frameworkId)).toEqual(["fw-qiyas", "fw-nca"]);
    expect(ministry[0].id).toBe("demo-ministry");
    expect(ministry[1].id).not.toBe("demo-ministry");
    expect(new Set(derived.map((w) => w.id)).size).toBe(derived.length);
  });

  it("gives seeded workplaces their engagement lead as index owner", () => {
    expect(derived.find((w) => w.id === "demo-entity")!.ownerIds).toEqual(["u-sami"]);
  });

  it("lets the admin's changes and additions win", () => {
    const changed = { ...derived[0], ownerIds: ["u-layla"] };
    const added = { id: "x", entityId: "demo-entity", frameworkId: "fw-nca", year: 2027, ownerIds: [] };
    const out = mergeWorkplaces(derived, { [changed.id]: changed, x: added });
    expect(out.find((w) => w.id === changed.id)!.ownerIds).toEqual(["u-layla"]);
    expect(out.at(-1)).toEqual(added);
  });

  it("allows an index only once per entity and review year", () => {
    expect(duplicateOf(derived, "demo-entity", "fw-qiyas", 2026)).toBeTruthy();
    expect(duplicateOf(derived, "demo-entity", "fw-qiyas", 2027)).toBeUndefined();
    expect(newWorkplaceId("demo-entity", "fw-qiyas", 2027, ["demo-entity--qiyas-2027"])).toBe("demo-entity--qiyas-2027-2");
  });

  it("names the phase from the stages", () => {
    expect(phaseOf({ start: 5, prog: 0, rev: 0, acc: 0 }, false)).toBe("Planning");
    expect(phaseOf({ start: 1, prog: 2, rev: 1, acc: 1 }, false)).toBe("Internal review");
    expect(phaseOf({ start: 0, prog: 0, rev: 0, acc: 3 }, false)).toBe("Ready to submit");
    expect(phaseOf({ start: 0, prog: 0, rev: 0, acc: 3 }, true)).toBe("Submitted");
  });
});
