import { describe, expect, it } from "vitest";
import { createSeed } from "@/lib/admin/seed";
import { entityFrameworks, libraryRequirements, shortName, usesWorkspaceRecords } from "./frameworks";
import { CLIENTS, ENGAGEMENTS, asActive } from "./portfolio";

const library = createSeed().frameworks;

describe("entity frameworks from the library", () => {
  it("resolves every seeded client's frameworks to published library entries", () => {
    for (const c of CLIENTS) expect(entityFrameworks(c, library).map((f) => f.name)).toEqual(c.frameworks);
    const ministry = CLIENTS.find((c) => c.id === "demo-ministry")!;
    expect(entityFrameworks(ministry, library).map((f) => [f.id, f.short, f.version])).toEqual([
      ["fw-qiyas", "Qiyas", "1.2"],
      ["fw-nca", "NCA ECC", "2024"],
    ]);
  });

  it("gives every engagement a framework the client is enrolled in", () => {
    for (const e of ENGAGEMENTS) expect(CLIENTS.find((c) => c.id === e.clientId)?.frameworkIds).toContain(e.frameworkId);
    for (const c of CLIENTS) expect(ENGAGEMENTS.filter((e) => e.clientId === c.id).map((e) => e.frameworkId).sort()).toEqual([...c.frameworkIds!].sort());
  });

  it("falls back to names for clients saved before ids, and skips unpublished frameworks", () => {
    const old = { ...CLIENTS[0], frameworkIds: undefined, frameworks: ["QIYAS 2026", "Internal ISO 27001"] };
    expect(entityFrameworks(old, library).map((f) => f.id)).toEqual(["fw-qiyas"]);
  });

  it("lists the requirements at the assessed level as fresh work items", () => {
    const nca = library.find((f) => f.id === "fw-nca")!.live!;
    const reqs = libraryRequirements(nca);
    expect(reqs.map((r) => r.code)).toEqual(["1-1-1", "1-1-2", "1-2-1", "1-2-2", "2-1-1", "2-2-1", "2-2-2", "2-3-1", "3-1-1", "4-1-1", "4-1-2"]);
    expect(reqs[0]).toMatchObject({ domain: "Cybersecurity Governance", work: "none", owner: "", status: "nas", evidenceText: "Approved cybersecurity strategy" });
  });

  it("uses the shared workspace records only for seeded clients' Qiyas", () => {
    expect(usesWorkspaceRecords("fw-qiyas", false)).toBe(true);
    expect(usesWorkspaceRecords("fw-qiyas", true)).toBe(false);
    expect(usesWorkspaceRecords("fw-nca", false)).toBe(false);
  });

  it("shortens names for tabs", () => {
    expect(shortName("Qiyas 2026")).toBe("Qiyas");
    expect(shortName("NDMO Data Management Standards")).toBe("NDMO");
  });

  it("turns clients stored as drafts by the old approval flow into active ones", () => {
    const a = asActive({ client: { ...CLIENTS[0], flag: "draft", pct: null, sub: "Draft · waiting for client activation" }, engagement: { ...ENGAGEMENTS[0], model: "draft", ready: null } });
    expect(a.client).toMatchObject({ flag: "active", pct: 0, sub: "New client" });
    expect(a.engagement).toMatchObject({ model: "co", ready: 0 });
  });
});
