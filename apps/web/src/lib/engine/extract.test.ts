import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { createSeed } from "@/lib/admin/seed";
import { diffConfig, diffRequirements } from "@/lib/admin/diff";
import type { FrameworkVersion } from "@/lib/admin/types";
import {
  adoptOrphan,
  applyDefaultWeight,
  checkExtraction,
  deleteNode,
  dismissOrphan,
  dropContentsPages,
  extractFramework,
  levelCounts,
  mergeDuplicates,
  mergeNodes,
  normalizeWeight,
  parentCode,
  patternOf,
  setWeighting,
  splitCode,
  codeMatcher,
  toFrameworkDraft,
  treeOrder,
  updateLevel,
  updateNode,
  validateCodeRegex,
  type Extraction,
  type SourceDoc,
} from "./extract";
import { delimitedToDoc, docxHtmlToDocs, jsonToDoc, parseDelimited, pdfItemsToDoc, rowsToDoc, textToDoc } from "./extract-sources";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const sample = (name: string) => readFileSync(new URL(`../../../public/samples/${name}`, import.meta.url));

const byCode = (ex: Extraction, code: string) => ex.nodes.find((n) => n.code === code)!;
const parentOf = (ex: Extraction, code: string) => ex.nodes.find((n) => n.id === byCode(ex, code).parentId)?.code;
const kinds = (ex: Extraction) => checkExtraction(ex).map((w) => w.kind);

function workbookDocs(name: string): SourceDoc[] {
  const wb = XLSX.read(sample(name));
  return wb.SheetNames.map((s) => rowsToDoc(name, XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[s], { header: 1, defval: "", raw: false, blankrows: true }), s));
}

describe("code detection", () => {
  const re = codeMatcher();

  it("reads dotted, dashed, prefixed and criterion codes", () => {
    expect(splitCode("5.11.2-2 Publish the data", re)).toEqual({ code: "5.11.2-2", rest: "Publish the data" });
    expect(splitCode("1.2.3. Title", re)?.code).toBe("1.2.3");
    expect(splitCode("ECC 1-2-3 Control text", re)).toEqual({ code: "ECC 1-2-3", rest: "Control text" });
    expect(splitCode("5.11.2-2-C1: Criterion", re)).toEqual({ code: "5.11.2-2-C1", rest: "Criterion" });
    expect(splitCode("PDP-2.1 Access requests", re)?.code).toBe("PDP-2.1");
  });

  it("does not read years, dates or plain words as codes", () => {
    expect(splitCode("2026 annual report", re)).toBeNull();
    expect(splitCode("12/05/2026 meeting", re)).toBeNull();
    expect(splitCode("The entity shall", re)).toBeNull();
  });

  it("derives patterns and parents", () => {
    expect(patternOf("5.11.2-2")).toBe("#.#.#-#");
    expect(patternOf("ECC 1-2-3")).toBe("ECC #-#-#");
    expect(patternOf("1.1.1-1-C2")).toBe("#.#.#-#-C#");
    expect(parentCode("5.11.2-2")).toBe("5.11.2");
    expect(parentCode("1.1.1-1-C2")).toBe("1.1.1-1");
    expect(parentCode("ECC 1-2")).toBe("ECC 1");
    expect(parentCode("ECC 1")).toBeNull();
    expect(parentCode("7")).toBeNull();
  });

  it("normalises weights", () => {
    expect(normalizeWeight("High")).toBe("high");
    expect(normalizeWeight("M")).toBe("med");
    expect(normalizeWeight("منخفض")).toBe("low");
    expect(normalizeWeight("1.5")).toBe("1.5");
    expect(normalizeWeight("10 %")).toBe("10%");
    expect(normalizeWeight("n/a")).toBeUndefined();
  });

  it("validates custom code expressions", () => {
    expect(validateCodeRegex("REQ-\\d+")).toBeNull();
    expect(validateCodeRegex("(")).toMatch(/./);
    expect(validateCodeRegex("x*")).toMatch(/empty/);
  });
});

describe("CSV", () => {
  it("parses quoted fields, doubled quotes and embedded newlines", () => {
    const rows = parseDelimited('a,"b, c","say ""hi"""\n1,"two\nlines",3\n');
    expect(rows).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["1", "two\nlines", "3"],
    ]);
    expect(parseDelimited("a;b;c\n1;2;3")[1]).toEqual(["1", "2", "3"]);
  });

  const ex = extractFramework([delimitedToDoc("flat.csv", fixture("flat-requirements.csv"))]);

  it("finds the header below a title row and builds the tree from codes", () => {
    expect(ex.levels.map((l) => l.pattern)).toEqual(["#", "#.#", "#.#.#", "#.#.#-#"]);
    expect(ex.levels.map((l) => l.en)).toEqual(["Perspective", "Axis", "Standard", "Requirement"]);
    expect(ex.levels.map((l) => l.assessed)).toEqual(["rollup", "rollup", "rollup", "accepted"]);
    expect(parentOf(ex, "1.1.1-1")).toBe("1.1.1");
    expect(parentOf(ex, "2.1")).toBe("2");
  });

  it("pulls title, text, weight and evidence", () => {
    const n = byCode(ex, "1.1.1-1");
    expect(n.title).toBe("Approved strategic plan");
    expect(n.text).toBe("The plan is approved, published and reviewed yearly.");
    expect(n.weight).toBe("high");
    expect(n.evidence).toBe("Approved plan");
    expect(byCode(ex, "1.1.1-2").evidence).toBe('KPI sheet; "targets" register');
    expect(byCode(ex, "2.1.1-1").title).toBe("Services available online,\nincluding mobile");
    expect(byCode(ex, "1.1.1-1").loc).toEqual({ file: "flat.csv", sheet: undefined, row: 7 });
  });

  it("reports duplicates, missing parents, orphan rows and missing weights with their rows", () => {
    const w = checkExtraction(ex);
    const dup = w.find((x) => x.kind === "duplicate")!;
    expect(dup.message).toContain("1.1.1-2");
    expect(dup.loc?.row).toBe(9);
    const mp = w.find((x) => x.kind === "missing_parent")!;
    expect(mp.message).toContain("1.1.2");
    expect(parentOf(ex, "1.1.2-1")).toBe("1.1.2");
    expect(parentOf(ex, "1.1.2")).toBe("1.1");
    const orphan = w.find((x) => x.kind === "orphan")!;
    expect(orphan.loc?.row).toBe(11);
    expect(orphan.message).toContain("Stakeholder map maintained");
    expect(w.filter((x) => x.kind === "missing_weight").map((x) => x.message)).toEqual(["Weight missing for 2.1.1-1"]);
  });

  it("counts nodes per level", () => {
    expect(levelCounts(ex)).toEqual([2, 2, 3, 5]);
  });
});

describe("hierarchical spreadsheet columns", () => {
  it("fills down merged group cells and keeps prefixed codes (csv)", () => {
    const ex = extractFramework([delimitedToDoc("ecc.csv", sample("nca-ecc-controls.csv").toString())]);
    expect(ex.levels.map((l) => [l.en, l.pattern])).toEqual([
      ["Domain", "ECC #"],
      ["Sub-domain", "ECC #-#"],
      ["Control", "ECC #-#-#"],
    ]);
    expect(ex.levels[2].assessed).toBe("accepted");
    expect(parentOf(ex, "ECC 1-1-2")).toBe("ECC 1-1");
    expect(byCode(ex, "ECC 1-1-1").text).toMatch(/^A cybersecurity strategy/);
    // The file has no weights, so the framework starts unweighted and nothing is flagged.
    expect(ex.weighting).toBe("none");
    expect(kinds(ex)).toEqual(["duplicate", "orphan"]);
    const weighted = setWeighting(ex, "weighted");
    expect(kinds(weighted)).toEqual(expect.arrayContaining(["duplicate", "orphan", "missing_weight"]));
    expect(toFrameworkDraft(applyDefaultWeight(weighted)).requirements.some((r) => r.weight)).toBe(true);
    expect(toFrameworkDraft(setWeighting(applyDefaultWeight(weighted), "none")).requirements.some((r) => r.weight)).toBe(false);
  });

  it("skips table-of-contents pages in paged documents", () => {
    const toc = ["5. Standards 11", "5.1 Planning 11", "5.2 Governance 14", "5.3 Architecture 18", "5.4 Culture 23", "6. Definitions 126"].map((text, i) => ({ page: 2, line: i + 1, text }));
    const body = ["5.1 Planning", "5.1.1 Strategic plan", "5.2 Governance", "5.2.1 Governance framework approved by the board in 2024"].map((text, i) => ({ page: 11, line: i + 1, text }));
    expect(dropContentsPages([...toc, ...body])).toEqual(body);
    const ex = extractFramework([{ kind: "text", file: "std.pdf", lines: [...toc, ...body] }]);
    expect(kinds(ex)).toEqual([]);
    expect(ex.nodes.map((n) => n.code)).toEqual(["5.1", "5.1.1", "5.2", "5.2.1"]);
  });

  it("reads the Qiyas workbook, skips the prose sheet and finds criteria (xlsx)", () => {
    const ex = extractFramework(workbookDocs("qiyas-2026-v1.3.xlsx"));
    expect(ex.sheets).toEqual(["03_Requirements"]);
    expect(ex.levels.map((l) => l.en)).toEqual(["Axis", "Standard", "Requirement", "Criterion"]);
    expect(ex.levels.map((l) => l.pattern)).toEqual(["#", "#.#.#", "#.#.#-#", "#.#.#-#-C#"]);
    expect(ex.levels.map((l) => l.assessed)).toEqual(["rollup", "rollup", "accepted", "ai_reviewer"]);
    expect(byCode(ex, "1").title).toBe("Strategy & Governance");
    expect(parentOf(ex, "1.1.1")).toBe("1");
    expect(parentOf(ex, "1.1.1-1-C2")).toBe("1.1.1-1");
    expect(checkExtraction(ex).map((w) => w.message)).toEqual(["Weight missing for 2.2.1-2", "Weight missing for 3.1.2-2"]);
  });
});

describe("text and Markdown", () => {
  it("reads labelled headings, code-only lines, inline weights and evidence (txt)", () => {
    const ex = extractFramework([textToDoc("controls.txt", fixture("controls.txt"))]);
    expect(ex.levels.map((l) => l.en)).toEqual(["Domain", "Standard", "Requirement"]);
    expect(byCode(ex, "ECC 1").title).toBe("Governance");
    const a = byCode(ex, "ECC 1-1-1");
    expect([a.title, a.weight]).toEqual(["A cybersecurity strategy is approved.", "high"]);
    expect(byCode(ex, "ECC 1-1-2").evidence).toBe("review minutes");
    const b = byCode(ex, "ECC 2-1-1");
    expect([b.title, b.weight]).toEqual(["Multi-factor authentication is enforced for privileged access", "med"]);
    expect(byCode(ex, "ECC 2-1-2").weight).toBe("low");
    expect(byCode(ex, "ECC 2-1-2").loc.line).toBe(12);
    expect(checkExtraction(ex)).toEqual([]);
  });

  it("reads Markdown headings, nested lists, evidence lists and tables (md)", () => {
    const ex = extractFramework([textToDoc("index.md", fixture("index.md"))]);
    expect(ex.meta.name).toBe("Open Government Index");
    expect(ex.levels.map((l) => l.en)).toEqual(["Perspective", "Axis", "Standard", "Requirement"]);
    const r = byCode(ex, "1.1.1-1");
    expect(r.weight).toBe("high");
    expect(r.evidence).toBe("Portal link\nPublication log");
    // A numbered list under a requirement is its text, not new nodes.
    expect(byCode(ex, "1.1.1-2").text).toBe("The publication covers:\n1. supplier name\n2. contract value");
    expect(ex.nodes.some((n) => n.code === "1" && n.title === "supplier name")).toBe(false);
    expect(byCode(ex, "1.1.2-1").loc).toEqual({ file: "index.md", line: 23 });
    expect(byCode(ex, "1.1.2-2").weight).toBe("low");
    expect(kinds(ex)).toEqual(["missing_parent"]);
  });

  it("reads plain-text section labels and bracketed weights (sample txt)", () => {
    const ex = extractFramework([textToDoc("dsi.txt", sample("digital-services-index.txt").toString())]);
    expect(ex.levels[0].en).toBe("Section");
    expect(parentOf(ex, "1.1")).toBe("1");
    expect(byCode(ex, "1.2.1").evidence).toBe("test plans; findings log");
  });
});

describe("JSON, Word and PDF", () => {
  it("reads a nested JSON tree with generated codes and level names from keys", () => {
    const ex = extractFramework([jsonToDoc("tree.json", fixture("tree.json"))]);
    expect(ex.meta).toEqual({ name: "Service Quality Index", authority: "Ministry", version: "2.0" });
    expect(ex.levels.map((l) => [l.en, l.ar, l.pattern])).toEqual([
      ["Domain", "المجال", "#"],
      ["Standard", "المعيار", "#.#"],
    ]);
    expect(byCode(ex, "1.2").evidence).toBe("Screenshots\nAnalytics");
    expect(checkExtraction(ex).map((w) => w.message)).toEqual(["Weight missing for 2.1"]);
  });

  it("uses explicit JSON levels", () => {
    const ex = extractFramework([jsonToDoc("ai.json", sample("ai-ethics-index.json").toString())]);
    expect(ex.levels.map((l) => l.en)).toEqual(["Principle", "Practice"]);
    expect(parentOf(ex, "AIE-2.1")).toBe("AIE-2");
  });

  it("restores Word list numbering and reads Word tables (docx HTML)", () => {
    const html =
      "<h1>Controls</h1><ol><li>Governance<ol><li>A policy exists</li><li>The policy is reviewed</li></ol></li><li>Operations</li></ol>" +
      "<table><tr><td><p>Code</p></td><td><p>Control</p></td><td><p>Weight</p></td></tr><tr><td><p>3.1</p></td><td><p>Logs &amp; alerts</p></td><td><p>High</p></td></tr></table>";
    const docs = docxHtmlToDocs("c.docx", html);
    expect(docs[0].kind === "text" && docs[0].lines.map((l) => l.text)).toEqual(["Controls", "1 Governance", "1.1 A policy exists", "1.2 The policy is reviewed", "2 Operations"]);
    const ex = extractFramework(docs);
    expect(parentOf(ex, "1.2")).toBe("1");
    expect(byCode(ex, "3.1").title).toBe("Logs & alerts");
    expect(byCode(ex, "3.1").weight).toBe("high");
  });

  it("reads the sample .docx through mammoth", async () => {
    const html = (await mammoth.convertToHtml({ buffer: sample("privacy-controls.docx") })).value;
    const ex = extractFramework(docxHtmlToDocs("privacy-controls.docx", html));
    expect(ex.levels.map((l) => [l.en, l.pattern])).toEqual([
      ["Domain", "PDP-#"],
      ["Control", "PDP-#.#"],
    ]);
    expect(byCode(ex, "PDP-2.3").weight).toBe("low");
    expect(byCode(ex, "PDP-2.3").loc.sheet).toBe("table 1");
  });

  it("groups PDF text items into lines by position, with page numbers", () => {
    const item = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y], height: 10 });
    const doc = pdfItemsToDoc("s.pdf", [
      [item("Governance", 90, 700), item("1", 50, 700), item("1.1 Policy approved", 50, 680), item("High", 300, 681)],
      [item("1.2 Policy reviewed", 50, 700)],
    ]);
    expect(doc.lines).toEqual([
      { page: 1, line: 1, text: "1 Governance" },
      { page: 1, line: 2, text: "1.1 Policy approved High" },
      { page: 2, line: 1, text: "1.2 Policy reviewed" },
    ]);
    const ex = extractFramework([doc]);
    expect(byCode(ex, "1.1").weight).toBe("high");
    expect(byCode(ex, "1.2").loc).toEqual({ file: "s.pdf", page: 2, line: 1 });
  });

  it("reads the sample PDF through pdf.js", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(sample("cloud-security-standard.pdf")), verbosity: 0 }).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) pages.push((await (await pdf.getPage(i)).getTextContent()).items as never[]);
    const ex = extractFramework([pdfItemsToDoc("css.pdf", pages)]);
    expect(ex.levels.map((l) => l.pattern)).toEqual(["CSS-#", "CSS-#.#"]);
    expect(byCode(ex, "CSS-2.3").loc.page).toBe(2);
    expect(kinds(ex)).toEqual(["duplicate", "missing_weight"]);
  });
});

describe("custom code expression", () => {
  it("re-runs detection with an admin-supplied pattern", () => {
    const doc = textToDoc("x.txt", "§ 12 First\n§ 13 Second\n1.1 Not a code here");
    expect(extractFramework([doc]).nodes.map((n) => n.code)).toEqual(["1.1"]);
    const ex = extractFramework([doc], { codeRegex: "§ ?\\d+" });
    expect(ex.nodes.map((n) => n.code)).toEqual(["§ 12", "§ 13"]);
    expect(ex.nodes[1].text).toBe("1.1 Not a code here");
  });
});

describe("review edits", () => {
  const base = extractFramework([delimitedToDoc("flat.csv", fixture("flat-requirements.csv"))]);

  it("renames levels and flags codes that no longer match an edited pattern", () => {
    let ex = updateLevel(base, 3, { en: "Control", ar: "الضابط" });
    expect(ex.levels[3].en).toBe("Control");
    expect(base.levels[3].en).toBe("Requirement");
    ex = updateLevel(ex, 3, { pattern: "#.#.#.#" });
    expect(kinds(ex).filter((k) => k === "pattern")).toHaveLength(5);
  });

  it("fixes every warning with merge, title, adopt, dismiss and default weight", () => {
    let ex = mergeDuplicates(base);
    expect(ex.nodes.filter((n) => n.code === "1.1.1-2")).toHaveLength(1);
    expect(byCode(ex, "1.1.1-2").text).toBe("Plan has measurable targets (copy)");
    const ph = byCode(ex, "1.1.2");
    ex = updateNode(ex, ph.id, { title: "Operational planning" });
    expect(byCode(ex, "1.1.2").placeholder).toBe(false);
    ex = adoptOrphan(ex, ex.orphans[0].id, "1.1.2-2");
    expect(parentOf(ex, "1.1.2-2")).toBe("1.1.2");
    ex = applyDefaultWeight(ex);
    expect(byCode(ex, "2.1.1-1").weight).toBe("med");
    expect(checkExtraction(ex)).toEqual([]);
  });

  it("dismisses orphans and deletes subtrees or single nodes", () => {
    expect(kinds(dismissOrphan(base, base.orphans[0].id))).not.toContain("orphan");
    const s2 = byCode(base, "2");
    expect(deleteNode(base, s2.id).nodes.some((n) => n.code.startsWith("2"))).toBe(false);
    const kept = deleteNode(base, byCode(base, "1.1").id, true);
    expect(parentOf(kept, "1.1.1")).toBe("1");
    expect(kept.levels.length).toBe(4);
  });

  it("merges different nodes and moves their children", () => {
    const ex = mergeNodes(base, byCode(base, "1.1.1").id, [byCode(base, "1.1.2").id]);
    expect(parentOf(ex, "1.1.2-1")).toBe("1.1.1");
    expect(ex.nodes.some((n) => n.code === "1.1.2")).toBe(false);
  });

  it("re-parents a node when its code is edited", () => {
    const ex = updateNode(base, byCode(base, "2.1.1-1").id, { code: "1.1.1-3" });
    expect(parentOf(ex, "1.1.1-3")).toBe("1.1.1");
  });

  it("keeps tree order with parents first", () => {
    const order = treeOrder(base).map((t) => t.node.code);
    expect(order.indexOf("1.1.2")).toBeLessThan(order.indexOf("1.1.2-1"));
    expect(order.slice(0, 3)).toEqual(["1", "1.1", "1.1.1"]);
  });
});

describe("accepting into Admin Studio", () => {
  const seed = createSeed();
  const live = seed.frameworks[0].live as FrameworkVersion;
  const ex = applyDefaultWeight(extractFramework(workbookDocs("qiyas-2026-v1.3.xlsx")));

  it("produces levels and requirements in tree order with parent codes", () => {
    const { levels, requirements } = toFrameworkDraft(ex);
    expect(levels.map((l) => l.id)).toEqual(["lv-1", "lv-2", "lv-3", "lv-4"]);
    const r = requirements.find((x) => x.code === "1.1.1-1-C1")!;
    expect(r).toMatchObject({ level: "lv-4", parent: "1.1.1-1", title: "The strategy is approved by the head of the entity" });
    expect(r.source).toBe("qiyas-2026-v1.3.xlsx · 03_Requirements · row 3");
    expect(requirements[0]).toMatchObject({ code: "1", level: "lv-1" });
    expect(requirements[0].parent).toBeUndefined();
  });

  it("diffs requirements against the live version", () => {
    const { requirements } = toFrameworkDraft(ex);
    const d = diffRequirements(live.requirements, requirements);
    expect(d.added.map((r) => r.code).sort()).toEqual(["1.2.1-2", "2.1.1-1-C1", "2.2.1-2", "3.1.2-2"]);
    expect(d.removed.map((r) => r.code)).toEqual(["2.1.2-2"]);
    expect(d.changed.map((c) => [c.after.code, c.fields])).toEqual([
      ["1.1.1-2", ["title"]],
      ["3.2.1-2", ["weight", "evidence"]],
    ]);
    const rows = diffConfig("framework", live, { ...live, version: "1.3", requirements });
    expect(rows.filter((r) => /^[+~−] /.test(r.label)).map((r) => r.label)).toEqual(["+ 1.2.1-2", "+ 2.1.1-1-C1", "+ 2.2.1-2", "+ 3.1.2-2", "~ 1.1.1-2", "~ 3.2.1-2", "− 2.1.2-2"]);
  });
});
