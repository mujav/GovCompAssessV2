import { describe, expect, it } from "vitest";
import { checkOutput } from "@/lib/assessor/assessor";
import { GENERIC_CRITERIA, assessInput, criteriaFor, type EvidenceFile } from "./evidence";
import type { ClientRequirement } from "./frameworks";

const req = (extra: Partial<ClientRequirement>): ClientRequirement => ({
  code: "5.1.1-1",
  domain: "Strategy",
  weight: "med",
  status: "nas",
  mandatoryFail: false,
  title: "إعداد إستراتيجية للتحول الرقمي",
  department: "",
  owner: "",
  work: "none",
  due: "2026-11-20",
  review: "none",
  evidence: { expected: 1, valid: 0, invalid: 0 },
  ...extra,
});

const file = (id: string, text: string, error?: string): EvidenceFile => ({ id, name: `${id}.pdf`, size: 1, uploadedAt: "", pages: error ? [] : [{ page: 1, text }], chars: text.length, error });

describe("requirement evidence for the AI assessor", () => {
  it("makes the requested evidence a mandatory criterion and each sub-item a criterion", () => {
    const r = req({
      text: "إعداد إستراتيجية للتحول الرقمي، بحيث تشمل ما يأتي:\nأ. رؤية ورسالة وأهداف إستراتيجية.\nب. المبادرات والمشاريع ومؤشرات الأداء.\nت. نموذج التكامل مع الجهات الخارجية.",
      evidenceText: "إرفاق الخطة الإستراتيجية المعتمدة خلال 36 شهرًا",
    });
    const c = criteriaFor(r);
    expect(c.map((x) => [x.id, x.mandatory])).toEqual([
      ["C1", true],
      ["C2", false],
      ["C3", false],
      ["C4", false],
    ]);
    expect(c[0].text).toContain("إرفاق الخطة الإستراتيجية");
    expect(c[1].text).toBe("رؤية ورسالة وأهداف إستراتيجية.");
    expect(c[2].expect).toBe("إرفاق الخطة الإستراتيجية المعتمدة خلال 36 شهرًا");
  });

  it("falls back to the generic checks when the requirement lists no sub-items", () => {
    const c = criteriaFor(req({ text: "A cybersecurity strategy is defined and approved" }));
    expect(c.map((x) => x.text)).toEqual(GENERIC_CRITERIA);
  });

  it("sends only readable files and the requirement wording", () => {
    const input = assessInput(req({ text: "Main line\na. First\nb. Second" }), [file("F1", "Strategy approved by the board on 3 March 2026"), file("F2", "", "No text found")]);
    expect(input.evidence.map((d) => d.id)).toEqual(["F1"]);
    expect(input.requirement).toBe("Main line");
    expect(input.implementation).toBe("a. First\nb. Second");
    expect(input.cycle).toBe("2026");
  });

  it("checks the assessor's quotes against the uploaded text and rolls verdicts up", () => {
    const input = assessInput(req({ text: "Main\na. One\nb. Two" }), [file("F1", "The strategy was approved by the board on 3 March 2026.")]);
    const out = checkOutput(input, {
      summary: "Approved strategy; roadmap missing.",
      criteria: [
        { criterion_id: "C1", verdict: "satisfied", confidence: 0.9, rationale: "Approved.", citations: [{ evidence_id: "F1", page: 1, quote: "approved by the board on 3 March 2026" }], gap_kind: "none", gap: "" },
        { criterion_id: "C2", verdict: "not_satisfied", confidence: 0.7, rationale: "No roadmap.", citations: [{ evidence_id: "F1", page: 1, quote: "a roadmap with owners" }], gap_kind: "missing_evidence", gap: "Upload the roadmap." },
      ],
    });
    expect(out.recommendation).toBe("Partial");
    expect(out.criteria.map((c) => c.citations.map((q) => q.resolved))).toEqual([[true], [false]]);
    expect(out.checks).toMatchObject({ citationsResolved: 1, citationsTotal: 2 });
  });
});
