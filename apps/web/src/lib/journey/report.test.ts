import { describe, expect, it } from "vitest";
import { WS_REQUIREMENTS } from "@/lib/workspace/data";
import { UNASSIGNED, buildReport, reportFileName } from "./report";
import { EMPTY_OVERLAY } from "./work";

const input = { entity: "Demo Entity", index: "Qiyas", year: 2026, indexOwners: ["Sami R."], today: "2026-11-05", overlay: EMPTY_OVERLAY };

describe("workspace report", () => {
  const r = buildReport({ ...input, reqs: WS_REQUIREMENTS });

  it("adds up across stages, domains and Control Owners", () => {
    expect(Object.values(r.counts).reduce((a, b) => a + b, 0)).toBe(r.total);
    expect(r.domains.reduce((a, d) => a + d.total, 0)).toBe(r.total);
    expect(r.owners.reduce((a, o) => a + o.total, 0)).toBe(r.total);
    expect(r.owners.reduce((a, o) => a + o.overdue, 0)).toBe(r.overdue);
  });

  it("gives each Control Owner only their own requirements, open work first", () => {
    for (const o of r.owners) {
      expect(o.rows.every((x) => x.owner === o.name)).toBe(true);
      const firstDone = o.rows.findIndex((x) => x.stage === "acc");
      if (firstDone >= 0) expect(o.rows.slice(firstDone).every((x) => x.stage === "acc")).toBe(true);
    }
  });

  it("counts a requirement as overdue only while it is not accepted", () => {
    expect(r.late.every((x) => x.stage !== "acc" && x.due < input.today)).toBe(true);
  });

  it("puts unassigned work last and matches people by name", () => {
    const reqs = [{ ...WS_REQUIREMENTS[0], owner: "" }, { ...WS_REQUIREMENTS[1], owner: "Faisal R." }];
    const x = buildReport({ ...input, reqs, people: [{ name: "Faisal R.", email: "faisal.r@demo.sa", department: "IT" }] });
    expect(x.owners.map((o) => o.name)).toEqual(["Faisal R.", UNASSIGNED]);
    expect(x.owners[0]).toMatchObject({ email: "faisal.r@demo.sa", department: "IT" });
  });

  it("names export files without characters a file system rejects", () => {
    expect(reportFileName({ ...r, entity: "A/B: C" }, "detailed")).toBe("A B C - Qiyas 2026 - Detailed report");
  });
});
