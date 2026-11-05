import { describe, expect, it } from "vitest";
import { findDuplicate, findVersionClash, nameKey, retireLive, versionsOf } from "./library";
import { createSeed } from "./seed";
import type { FrameworkPackage } from "./types";

const DGA: FrameworkPackage = {
  id: "fw-dga",
  usedByCycles: 0,
  live: {
    name: "المعايير الأساسية للتحول الرقمي",
    version: "5.0",
    authority: "هيئة الحكومة الرقمية",
    effective: "02 Nov 2026",
    scoringNote: "",
    levels: [],
    requirements: [],
    fileHashes: ["a".repeat(64)],
    createdAt: "02 Nov 2026",
    publishedAt: "02 Nov 2026",
  },
};

describe("framework library", () => {
  const frameworks = [...createSeed().frameworks, DGA];

  it("reduces names to what identifies the framework", () => {
    expect(nameKey("Qiyas 2026 v1.3")).toBe("qiyas");
    expect(nameKey("وثيقة المعايير الأساسية للتحول الرقمي - الإصدار 5.0")).toBe(nameKey("وثيقة المعايير الاساسيه للتحول الرقمي"));
    expect(nameKey("ISO 27001")).toBe("iso 27001");
  });

  it("finds the same document by its SHA-256 whatever it is called", () => {
    const dup = findDuplicate(frameworks, { name: "Something else", hashes: ["a".repeat(64)] });
    expect(dup).toMatchObject({ pkgId: "fw-dga", reason: "same_file", version: "5.0" });
    expect(dup!.message).toContain("published 02 Nov 2026");
  });

  it("matches the short hash kept by versions saved before full hashes were stored", () => {
    const old: FrameworkPackage = { ...DGA, id: "fw-old", live: { ...DGA.live!, name: "Old import", fileHashes: undefined, importJob: { file: "x.pdf", tab: "PDF", rows: 1, uploadedBy: "M", hash: "4cfb…1afc", valid: 1, warnings: [], changed: "", errors: 0 } } };
    expect(findDuplicate([old], { hashes: [`4cfb${"0".repeat(56)}1afc`] })?.pkgId).toBe("fw-old");
    expect(findDuplicate([old], { hashes: [`4cfa${"0".repeat(56)}1afc`] })).toBeNull();
  });

  it("finds the same framework by name across versions, years and Arabic spelling variants", () => {
    expect(findDuplicate(frameworks, { name: "المعايير الاساسيه للتحول الرقمي 2027" })?.pkgId).toBe("fw-dga");
    expect(findDuplicate(frameworks, { name: "QIYAS 2027" })?.pkgId).toBe("fw-qiyas");
    expect(findDuplicate(frameworks, { name: "NCA ECC controls" })?.pkgId).toBe("fw-nca");
  });

  it("lets a genuinely different framework through", () => {
    expect(findDuplicate(frameworks, { name: "ISO 27002", hashes: ["b".repeat(64)] })).toBeNull();
    expect(findDuplicate(frameworks, { name: "Cloud security controls" })).toBeNull();
    expect(findDuplicate(frameworks, { name: "المعايير الأساسية للتحول الرقمي", exceptId: "fw-dga" })).toBeNull();
  });

  it("stops the same file or an existing version number coming back as a new version", () => {
    expect(findVersionClash(DGA, { hashes: ["a".repeat(64)] })?.reason).toBe("same_file");
    expect(findVersionClash(DGA, { version: "5.0" })?.reason).toBe("same_version");
    expect(findVersionClash(DGA, { version: "5.1", hashes: ["c".repeat(64)] })).toBeNull();
  });

  it("lists every version of a framework newest first, with dates", () => {
    const nca = frameworks.find((f) => f.id === "fw-nca")!;
    expect(versionsOf({ ...nca, draft: { ...nca.live!, version: "2025", publishedAt: undefined } }).map((v) => [v.version, v.status, v.publishedAt ?? "—"])).toEqual([
      ["2025", "draft", "—"],
      ["2024", "live", "20 Feb 2024"],
      ["2018", "superseded", "15 Sep 2018"],
    ]);
  });

  it("moves the outgoing live version into the history when a new one is published", () => {
    const qiyas = structuredClone(frameworks.find((f) => f.id === "fw-qiyas")!);
    qiyas.draft = { ...qiyas.live!, version: "5.1", publishedAt: undefined };
    retireLive(qiyas, "03 Nov 2026");
    qiyas.live = qiyas.draft;
    qiyas.draft = undefined;
    expect(versionsOf(qiyas).map((v) => [v.version, v.status, v.publishedAt ?? "—", v.supersededAt ?? "—"])).toEqual([
      ["5.1", "live", "03 Nov 2026", "—"],
      ["5.0", "superseded", "Apr 2026", "03 Nov 2026"],
    ]);
  });
});
