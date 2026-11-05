import { describe, expect, it } from "vitest";
import { aiToExtraction, buildChunkPrompt, docsToPages, mergeAiNodes, planChunks, type AiNode, type AiOutline, type SourcePage } from "./ai-extract";
import { addNode, checkExtraction, deleteNode, levelCounts, suggestChildCode, toFrameworkDraft, treeOrder } from "./extract";
import { pdfItemsToDoc, rowsToDoc, textToDoc } from "./extract-sources";

const node = (code: string, parent: string, level: number, title = `T ${code}`, extra: Partial<AiNode> = {}): AiNode => ({
  code,
  parent,
  level,
  title,
  text: "",
  evidence: "",
  weight: "",
  file: "dga.pdf",
  page: 11,
  ...extra,
});

const outline: AiOutline = {
  name: "المعايير الأساسية للتحول الرقمي",
  authority: "هيئة الحكومة الرقمية",
  version: "5.0",
  levels: [
    { en: "Perspective", ar: "المنظور" },
    { en: "Axis", ar: "المحور" },
    { en: "Standard", ar: "المعيار" },
    { en: "Requirement", ar: "المتطلب" },
  ],
  assessedLevel: 3,
  startPage: 11,
  endPage: 125,
  nodes: [node("P1", "", 1, "الإستراتيجية والتخطيط"), node("5.1", "P1", 2, "التخطيط للتحول الرقمي"), node("5.2", "P1", 2, "حوكمة التحول الرقمي")],
};

const page = (n: number, text = "x".repeat(1000)): SourcePage => ({ file: "dga.pdf", n, text, loc: { file: "dga.pdf", page: n } });

describe("AI extraction: pages and chunks", () => {
  it("turns PDF pages, text and spreadsheet rows into numbered pages", () => {
    const pdf = pdfItemsToDoc("a.pdf", [[{ str: "1.1 Policy", transform: [1, 0, 0, 1, 50, 700] }], [{ str: "1.2 Review", transform: [1, 0, 0, 1, 50, 700] }]]);
    const txt = textToDoc("b.txt", "1 Governance\n1.1 Policy");
    const sheet = rowsToDoc("c.xlsx", [["Code", "Title"], ["1.1", "Policy"]], "Controls");
    const pages = docsToPages([pdf, txt, sheet]);
    expect(pages.map((p) => [p.file, p.n])).toEqual([
      ["a.pdf", 1],
      ["a.pdf", 2],
      ["b.txt", 1],
      ["c.xlsx", 1],
    ]);
    expect(pages[1].loc).toEqual({ file: "a.pdf", page: 2 });
    expect(pages[3].text).toContain("Sheet: Controls");
    expect(pages[3].text).toContain("[row 2] 1.1 | Policy");
  });

  it("keeps to the requirement page range and carries one page into the next chunk", () => {
    const pages = Array.from({ length: 30 }, (_, i) => page(i + 1));
    const chunks = planChunks(pages, { startPage: 5, endPage: 24 }, 5000);
    expect(chunks[0][0].n).toBe(5);
    expect(chunks.at(-1)!.at(-1)!.n).toBe(24);
    expect(chunks[1][0].n).toBe(chunks[0].at(-1)!.n);
    expect(new Set(chunks.flat().map((p) => p.n)).size).toBe(20);
  });

  it("ignores a page range that is implausibly narrow", () => {
    const pages = Array.from({ length: 30 }, (_, i) => page(i + 1));
    const chunks = planChunks(pages, { startPage: 3, endPage: 4 }, 50000);
    expect(chunks.flat()).toHaveLength(30);
  });

  it("puts the outline and the pages in the chunk prompt", () => {
    const prompt = buildChunkPrompt(outline, [page(11, "5.1.1 التخطيط الاستراتيجي")]);
    expect(prompt).toContain("1. Perspective (المنظور)");
    expect(prompt).toContain("2\t5.1\tP1\tالتخطيط للتحول الرقمي");
    expect(prompt).toContain('<page file="dga.pdf" n="11">');
  });
});

describe("AI extraction: merge into a reviewable tree", () => {
  const chunkA = [
    node("5.1", "P1", 2, "التخطيط للتحول الرقمي", { text: "يشمل المحور تطوير خطة" }),
    node("5.1.1", "5.1", 3, "التخطيط الاستراتيجي", { text: "الهدف" }),
    node("5.1.1-1", "5.1.1", 4, "", { text: "إعداد إستراتيجية", evidence: "إرفاق الخطة" }),
    node("5.1.2", "5.1", 3, "التخطيط التنفيذي"),
    node("5.1.2-1", "5.1.2", 4, "", { text: "إعداد خطة تنفيذية", evidence: "إرفاق" }),
  ];
  // The next chunk starts with the carried-over page and sees 5.1.2-1 in full.
  const chunkB = [
    node("5.1.2-1", "5.1.2", 4, "", { text: "إعداد خطة تنفيذية للتحول الرقمي", evidence: "إرفاق الخطة التنفيذية المعتمدة", page: 12 }),
    node("5.2.1", "5.2", 3, "اعتماد إطار لحوكمة التحول الرقمي", { page: 14, weight: "High" }),
  ];

  it("de-duplicates by code, keeping the fuller text", () => {
    const merged = mergeAiNodes(outline.nodes, [chunkA, chunkB]);
    expect(merged.map((n) => n.code)).toEqual(["P1", "5.1", "5.2", "5.1.1", "5.1.1-1", "5.1.2", "5.1.2-1", "5.2.1"]);
    const r = merged.find((n) => n.code === "5.1.2-1")!;
    expect(r.text).toBe("إعداد خطة تنفيذية للتحول الرقمي");
    expect(r.evidence).toBe("إرفاق الخطة التنفيذية المعتمدة");
    expect(merged.find((n) => n.code === "5.1")!.text).toBe("يشمل المحور تطوير خطة");
  });

  it("builds levels, parents and the assessed level from the outline", () => {
    const merged = mergeAiNodes(outline.nodes, [chunkA, chunkB]);
    const pages = [page(11), page(12), page(14)];
    const ex = aiToExtraction(outline, merged, { files: ["dga.pdf"], records: 3, pages });
    expect(ex.meta).toEqual({ name: outline.name, authority: outline.authority, version: "5.0" });
    expect(ex.levels.map((l) => [l.en, l.ar, l.pattern, l.assessed])).toEqual([
      ["Perspective", "المنظور", "P#", "rollup"],
      ["Axis", "المحور", "#.#", "rollup"],
      ["Standard", "المعيار", "#.#.#", "accepted"],
      ["Requirement", "المتطلب", "#.#.#-#", "ai_reviewer"],
    ]);
    expect(levelCounts(ex)).toEqual([1, 2, 3, 2]);
    const order = treeOrder(ex).map((r) => `${"  ".repeat(r.depth)}${r.node.code}`);
    expect(order).toEqual(["P1", "  5.1", "    5.1.1", "      5.1.1-1", "    5.1.2", "      5.1.2-1", "  5.2", "    5.2.1"]);
    expect(ex.nodes.find((n) => n.code === "5.2.1")!.loc).toEqual({ file: "dga.pdf", page: 14 });

    const draft = toFrameworkDraft(ex);
    expect(draft.requirements.find((r) => r.code === "5.1.1-1")).toMatchObject({ parent: "5.1.1", level: "lv-4", text: "إعداد إستراتيجية", evidence: "إرفاق الخطة" });
    // Codes and parents are clean, and weights are never asked for.
    expect(checkExtraction(ex).map((w) => w.kind)).toEqual([]);
  });

  it("keeps the AI's parent when a node is deleted or added, and breaks cycles", () => {
    const merged = mergeAiNodes(outline.nodes, [chunkA, [node("X", "Y", 1), node("Y", "X", 1)]]);
    let ex = aiToExtraction(outline, merged, { files: ["dga.pdf"], records: 0, pages: [] });
    expect(ex.nodes.filter((n) => n.code === "X" || n.code === "Y").some((n) => !n.parentId)).toBe(true);

    const std = ex.nodes.find((n) => n.code === "5.1.2")!;
    expect(suggestChildCode(ex, std.id)).toBe("5.1.2-2");
    const added = addNode(ex, std.id);
    ex = added.ex;
    const fresh = ex.nodes.find((n) => n.id === added.id)!;
    expect(fresh).toMatchObject({ code: "5.1.2-2", parentId: std.id });
    expect(checkExtraction(ex).some((w) => w.kind === "empty" && w.nodeId === added.id)).toBe(true);

    ex = deleteNode(ex, ex.nodes.find((n) => n.code === "5.1")!.id, true);
    expect(ex.nodes.find((n) => n.code === "5.1.1")!.parentId).toBe(ex.nodes.find((n) => n.code === "P1")!.id);
  });
});

describe("Arabic PDF text", () => {
  it("joins one-glyph items right to left, folds presentation forms and fixes mirrored brackets", () => {
    // "التخطيط (2030)" drawn as single presentation-form glyphs from right to left.
    const glyphs = ["ﺍ", "ﻟ", "ﺘ", "ﺨ", "ﻄ", "ﻴ", "ﻂ"];
    const items = glyphs.map((g, i) => ({ str: g, transform: [1, 0, 0, 1, 300 - i * 5, 700], width: 5, height: 10 }));
    items.push({ str: ")2030(", transform: [1, 0, 0, 1, 230, 700], width: 30, height: 10 });
    const doc = pdfItemsToDoc("ar.pdf", [items]);
    expect(doc.lines[0].text).toBe("التخطيط (2030)");
  });
});
