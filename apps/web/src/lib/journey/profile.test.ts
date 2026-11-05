import { describe, expect, it } from "vitest";
import { shortName } from "./frameworks";
import { CLIENTS, ENGAGEMENTS } from "./portfolio";
import { applyProfile, defaultProfile, engagementsFor } from "./profile";

const ministry = CLIENTS.find((c) => c.id === "demo-ministry")!;
const mine = ENGAGEMENTS.filter((e) => e.clientId === ministry.id);

describe("entity profile edits", () => {
  it("renames the entity everywhere and keeps the rest of the subtitle", () => {
    const p = { ...defaultProfile(ministry, false), name: "Ministry of Demo Services", type: "Ministry (federal)" };
    expect(applyProfile(ministry, p)).toMatchObject({ name: "Ministry of Demo Services", sub: "Ministry (federal)" });
    expect(applyProfile({ ...ministry, sub: "Fund · new client" }, { ...p, type: "Fund" }).sub).toBe("Fund · new client");
    expect(applyProfile(ministry, undefined)).toBe(ministry);
  });

  it("drops the engagement of a removed framework and opens one for an added framework", () => {
    const p = { ...defaultProfile(ministry, false), frameworkIds: ["fw-qiyas", "fw-ndmo"], frameworkNames: ["Qiyas 2026", "NDMO Data Management Standards"] };
    const out = engagementsFor(ministry, mine, p, shortName);
    expect(out.map((e) => [e.frameworkId, e.index, e.ready])).toEqual([
      ["fw-qiyas", "Qiyas", 81],
      ["fw-ndmo", "NDMO", 0],
    ]);
    expect(out[1]).toMatchObject({ term: mine[0].term, model: "co", delta: "new" });
    expect(applyProfile(ministry, p).frameworks).toEqual(["Qiyas 2026", "NDMO Data Management Standards"]);
  });

  it("leaves engagements alone until frameworks are edited", () => {
    expect(engagementsFor(ministry, mine, defaultProfile(ministry, false), shortName)).toBe(mine);
  });
});
