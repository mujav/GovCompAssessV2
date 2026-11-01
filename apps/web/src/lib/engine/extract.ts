// Deterministic framework extraction. Turns parsed source documents (spreadsheet rows,
// document lines, JSON trees) into a hierarchy of levels and requirement nodes. No AI:
// codes, numbering and column headers decide everything, so the same file always gives
// the same tree, and every node keeps the row or page it came from.

import type { FrameworkRequirement, HierarchyLevel, LevelAssessment } from "@/lib/admin/types";

/* ---------- Source documents ---------- */

export interface SourceLoc {
  file: string;
  sheet?: string;
  row?: number;
  page?: number;
  line?: number;
}

export interface TableDoc {
  kind: "table";
  file: string;
  sheet?: string;
  rows: { ref: number; cells: string[] }[];
}

export interface TextLine {
  line: number;
  page?: number;
  text: string;
  heading?: boolean;
}

export interface TextDoc {
  kind: "text";
  file: string;
  lines: TextLine[];
}

export interface TreeItem {
  code?: string;
  title?: string;
  text?: string;
  weight?: string;
  evidence?: string;
  level?: string;
  children?: TreeItem[];
}

export interface TreeDoc {
  kind: "tree";
  file: string;
  items: TreeItem[];
}

export type SourceDoc = (TableDoc | TextDoc | TreeDoc) & {
  /** Level names the source states explicitly (JSON "levels"), top level first. */
  levels?: { en: string; ar?: string; pattern?: string }[];
  meta?: ExtractionMeta;
};

export interface ExtractionMeta {
  name?: string;
  authority?: string;
  version?: string;
}

/* ---------- Extraction result ---------- */

export interface ExtractedNode {
  id: string;
  code: string;
  title: string;
  text: string;
  weight?: string;
  evidence?: string;
  /** Resolved parent (derived; recomputed by resolveTree). */
  parentId?: string;
  /** Parent from the source layout (row's group columns, JSON nesting, labelled headings). */
  contextParentId?: string;
  /** Parent fixed by an admin edit (merge, remove placeholder); null = top level. */
  parentOverride?: string | null;
  /** Level name the source suggests (column header, "Axis 1:" label, type column). */
  levelHint?: string;
  /** Created because a child referenced a missing parent code. */
  placeholder?: boolean;
  loc: SourceLoc;
}

export interface DetectedLevel {
  id: string;
  en: string;
  ar: string;
  pattern: string;
  assessed: LevelAssessment;
}

export interface OrphanRow {
  id: string;
  loc: SourceLoc;
  preview: string;
  dismissed?: boolean;
}

export interface Extraction {
  files: string[];
  sheets: string[];
  records: number;
  codeRegex?: string;
  meta: ExtractionMeta;
  levels: DetectedLevel[];
  nodes: ExtractedNode[];
  orphans: OrphanRow[];
  seq: number;
}

export type WarningKind = "duplicate" | "missing_parent" | "orphan" | "missing_weight" | "pattern" | "empty";

export interface ExtractWarning {
  id: string;
  kind: WarningKind;
  message: string;
  nodeId?: string;
  orphanId?: string;
  loc?: SourceLoc;
}

export interface ExtractOptions {
  /** Regular expression (source) that matches a requirement code at the start of a cell or line. */
  codeRegex?: string;
}

/* ---------- Codes ---------- */

// Optional letter prefix ("ECC 1", "C1"), then numeric segments joined by "." or "-";
// a segment may carry a short letter prefix ("-C1"). Stops at a boundary so "2026" or
// "12/05" never read as codes.
const DEFAULT_CODE = /^(?:[A-Z]{2,8}[ -]|[A-Z]{1,3})?\d{1,3}(?:[.\-](?:[A-Z]{1,2})?\d{1,3})*(?=$|[\s.:)\]–—,;-])/;

export function codeMatcher(regex?: string): RegExp {
  if (!regex?.trim()) return DEFAULT_CODE;
  return new RegExp(`^(?:${regex.trim()})`);
}

/** Checks a custom code expression; returns an error message or null. */
export function validateCodeRegex(regex: string): string | null {
  if (!regex.trim()) return null;
  try {
    const re = codeMatcher(regex);
    if (re.test("")) return "The expression matches empty text.";
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid expression.";
  }
}

export function normalizeCode(code: string) {
  return code.replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
}

const key = (code: string) => normalizeCode(code).toUpperCase();

/** Code shape with digits replaced by "#": "5.11.2-2" → "#.#.#-#", "ECC 1-2-3" → "ECC #-#-#". */
export function patternOf(code: string) {
  return normalizeCode(code).replace(/\d+/g, "#");
}

export function patternRegex(pattern: string): RegExp {
  const esc = pattern.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/#/g, "\\d+").replace(/\s+/g, "\\s*");
  return new RegExp(`^${esc}$`, "i");
}

export function matchesPattern(code: string, pattern: string) {
  return patternRegex(pattern).test(normalizeCode(code));
}

/** Code with its last segment removed: "5.11.2-2" → "5.11.2"; null at the top. */
export function parentCode(code: string): string | null {
  const m = /^(.*\d)[\s.\-_/]+[A-Za-z]{0,3}\d+[a-z]?$/.exec(normalizeCode(code));
  return m ? m[1] : null;
}

export function segmentCount(code: string) {
  return (normalizeCode(code).match(/\d+/g) ?? []).length;
}

/** Splits "1.2.3 Title" into code and the rest; null when the text does not start with a code. */
export function splitCode(text: string, re: RegExp): { code: string; rest: string } | null {
  const t = text.trim();
  const m = re.exec(t);
  if (!m || !m[0].trim()) return null;
  return { code: normalizeCode(m[0]), rest: t.slice(m[0].length).replace(/^[\s.:)\]–—,;-]+/, "").trim() };
}

/* ---------- Vocabulary ---------- */

const LEVEL_WORDS: [RegExp, string][] = [
  [/^(perspectives?|المنظور)$/, "Perspective"],
  [/^(axis|axes|المحور)$/, "Axis"],
  [/^(standards?|المعيار)$/, "Standard"],
  [/^(sub-?domains?|المجال الفرعي)$/, "Sub-domain"],
  [/^(domains?|المجال)$/, "Domain"],
  [/^(pillars?|الركيزة)$/, "Pillar"],
  [/^(objectives?|الهدف)$/, "Objective"],
  [/^(categor(y|ies)|الفئة)$/, "Category"],
  [/^(sections?|القسم)$/, "Section"],
  [/^(chapters?|الفصل)$/, "Chapter"],
  [/^(themes?)$/, "Theme"],
  [/^(principles?|المبدأ)$/, "Principle"],
  [/^(dimensions?|البعد)$/, "Dimension"],
  [/^(families|family)$/, "Family"],
  [/^(practices?|الممارسة)$/, "Practice"],
  [/^(articles?|المادة)$/, "Article"],
  [/^(sub-?controls?|الضابط الفرعي)$/, "Sub-control"],
  [/^(controls?|الضابط)$/, "Control"],
  [/^(requirements?|المتطلب)$/, "Requirement"],
  [/^(criteri(on|a)|البند)$/, "Criterion"],
  [/^(clauses?)$/, "Clause"],
  [/^(indicators?|المؤشر)$/, "Indicator"],
];

/** Row-level words: a column group or label with these names is the requirement itself. */
const ROW_WORDS = new Set(["Requirement", "Control", "Criterion", "Clause", "Sub-control", "Indicator", "Practice", "Article"]);

const ARABIC: Record<string, string> = {
  Perspective: "المنظور",
  Axis: "المحور",
  Standard: "المعيار",
  Domain: "المجال",
  "Sub-domain": "المجال الفرعي",
  Pillar: "الركيزة",
  Objective: "الهدف",
  Category: "الفئة",
  Section: "القسم",
  Chapter: "الفصل",
  Theme: "المحور الفرعي",
  Principle: "المبدأ",
  Dimension: "البعد",
  Family: "العائلة",
  Practice: "الممارسة",
  Article: "المادة",
  Control: "الضابط",
  "Sub-control": "الضابط الفرعي",
  Requirement: "المتطلب",
  Criterion: "البند",
  Clause: "البند",
  Indicator: "المؤشر",
  "Sub-requirement": "المتطلب الفرعي",
};

export function arabicFor(en: string) {
  return ARABIC[en] ?? "";
}

export function levelWord(text: string): string | undefined {
  const t = text.trim().toLowerCase();
  return LEVEL_WORDS.find(([re]) => re.test(t))?.[1];
}

const LEVEL_SOURCE = LEVEL_WORDS.map(([re]) => re.source.slice(2, -2).replace(/\((?!\?)/g, "(?:")).join("|");
// "Axis 1: Strategy", "Objective 1.1 — Ownership", "Pillar: Data" (code optional).
const LABEL = new RegExp(`^(${LEVEL_SOURCE})\\s*(?:([A-Z]{0,8}[ -]?\\d[\\w.\\-]*))?\\s*[:.\\-–—]\\s*(.+)$`, "i");

const DEFAULT_NAMES = [
  ["Requirement"],
  ["Domain", "Requirement"],
  ["Domain", "Standard", "Requirement"],
  ["Perspective", "Axis", "Standard", "Requirement"],
  ["Perspective", "Axis", "Standard", "Requirement", "Criterion"],
];

function defaultNames(count: number, endsWithCriterion: boolean): string[] {
  if (endsWithCriterion && count > 1) return [...defaultNames(count - 1, false), "Criterion"];
  if (count <= DEFAULT_NAMES.length) return DEFAULT_NAMES[count - 1] ?? [];
  return [...DEFAULT_NAMES[4], ...Array.from({ length: count - 5 }, (_, i) => `Level ${i + 6}`)];
}

/* ---------- Weights and hints ---------- */

export function normalizeWeight(raw: string | undefined): string | undefined {
  const t = (raw ?? "").trim().toLowerCase();
  if (!t) return undefined;
  if (/^(high|h|critical|very high|عال[يية]*|مرتفع[ةه]?)$/.test(t)) return "high";
  if (/^(medium|med|m|moderate|متوسط[ةه]?)$/.test(t)) return "med";
  if (/^(low|l|minor|منخفض[ةه]?)$/.test(t)) return "low";
  const n = /^(\d+(?:\.\d+)?)\s*%?$/.exec(t);
  return n ? t.replace(/\s+/g, "") : undefined;
}

const WEIGHT_LINE = /^(?:weight|priority|importance|الوزن|الأولوية)\s*[:=\-–]\s*(.+)$/i;
const EVIDENCE_LINE = /^(?:evidence(?: required)?|required evidence|expected evidence|documents?|الأدلة|الشواهد)\s*[:\-–]\s*(.*)$/i;
const INLINE_WEIGHT_BRACKET = /\s*[[(]\s*(?:(?:weight|priority)\s*[:=]?\s*)?(high|medium|med|low|\d+(?:\.\d+)?%?)\s*[\])]\s*/i;
const INLINE_WEIGHT_TAIL = /[\s—–\-|,;]+(?:weight|priority)\s*[:=]\s*(high|medium|med|low|\d+(?:\.\d+)?%?)\.?\s*$/i;
const TRAILING_WEIGHT = /\s+(High|Medium|Low)$/;
const INLINE_EVIDENCE = /[\s—–|;]+(?:evidence|required evidence)\s*:\s*(.+)$/i;

function pullHints(text: string): { text: string; weight?: string; evidence?: string } {
  let t = text;
  let weight: string | undefined;
  let evidence: string | undefined;
  const ev = INLINE_EVIDENCE.exec(t);
  if (ev) {
    evidence = ev[1].trim();
    t = t.slice(0, ev.index);
  }
  for (const re of [INLINE_WEIGHT_TAIL, INLINE_WEIGHT_BRACKET, TRAILING_WEIGHT]) {
    const m = re.exec(t);
    if (m && normalizeWeight(m[1])) {
      weight = normalizeWeight(m[1]);
      t = (t.slice(0, m.index) + " " + t.slice(m.index + m[0].length)).trim();
      break;
    }
  }
  return { text: t.trim(), weight, evidence };
}

function splitTitle(rest: string): { title: string; text: string } {
  if (rest.length <= 140) return { title: rest, text: "" };
  const cut = rest.slice(0, 140).search(/[.;:](\s|$)/);
  const i = cut > 8 ? cut + 1 : rest.slice(0, 140).lastIndexOf(" ");
  return { title: rest.slice(0, i).trim(), text: rest.slice(i).trim() };
}

const join = (a: string, b: string) => (a && b ? `${a}\n${b}` : a || b);

/* ---------- Builder ---------- */

class Builder {
  nodes: ExtractedNode[] = [];
  orphans: OrphanRow[] = [];
  seq = 0;
  constructor(readonly re: RegExp) {}

  node(p: Omit<ExtractedNode, "id" | "text" | "title"> & { title?: string; text?: string }): ExtractedNode {
    const n: ExtractedNode = { id: `n${++this.seq}`, title: "", text: "", ...p };
    this.nodes.push(n);
    return n;
  }

  orphan(loc: SourceLoc, preview: string) {
    this.orphans.push({ id: `o${++this.seq}`, loc, preview: preview.slice(0, 160) });
  }

  /** Short generated code for nodes the source names but does not number. */
  genCode(hint: string | undefined, parent: ExtractedNode | undefined, counters: Map<string, number>) {
    const letter = (hint?.[0] ?? "G").toUpperCase().replace(/[^A-Z]/, "G");
    const base = parent ? `${parent.code}.` : "";
    const k = `${base}${letter}`;
    const n = (counters.get(k) ?? 0) + 1;
    counters.set(k, n);
    return `${base}${letter}${n}`;
  }
}

/* ---------- Tables ---------- */

type Attr = "code" | "title" | "text" | "weight" | "evidence" | "type";

interface ColGroup {
  word?: string;
  first: number;
  cols: Partial<Record<Attr, number>>;
  text: number[];
  /** Arabic text columns, used only when the group has no other text column. */
  textAr?: number[];
}

const ATTR_TESTS: [Attr, RegExp][] = [
  ["type", /^(level|type|node type|item type|hierarchy level|المستوى|النوع)$/],
  ["weight", /weight|priority|importance|criticality|الوزن|الأهمية|الأولوية/],
  ["evidence", /evidence|artifact|artefact|proof|deliverable|documents?|الأدلة|الشواهد|المستندات/],
  ["code", /(^|\s)(code|id|ref|reference|no|number|#)$|^(code|id|ref|reference|no\.?|number|#)(\s|$)|الرمز|الرقم|رقم/],
  ["text", /description|statement|text|detail|guidance|implementation|explanation|النص|الوصف|التفاصيل|الإرشادات/],
  ["title", /^(title|name|heading|العنوان|الاسم)$|(\s)(title|name)$/],
];

function cleanHeader(h: string) {
  return h
    .toLowerCase()
    .replace(/\(([^)]*)\)/g, " $1 ")
    .replace(/[*:_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const isArabicVariant = (h: string) => /(^|\s)(ar|arabic)(\s|$)|عربي/.test(h);

/** Reads a header cell into (level word, attribute). */
function readHeader(raw: string): { word?: string; attr?: Attr; ar: boolean } | null {
  const h = cleanHeader(raw);
  if (!h) return null;
  const ar = isArabicVariant(h);
  const bare = h.replace(/(^|\s)(en|english|ar|arabic)(\s|$)/g, " ").trim();
  const words = bare.split(" ");
  let word: string | undefined;
  for (let n = Math.min(2, words.length); n >= 1 && !word; n--) word = levelWord(words.slice(0, n).join(" "));
  word ??= levelWord(bare);
  const attr = ATTR_TESTS.find(([, re]) => re.test(bare))?.[0];
  if (!word && !attr) return null;
  return { word, attr: attr ?? (word ? "title" : undefined), ar };
}

function headerScore(cells: string[]) {
  return cells.filter((c) => c.trim() && c.trim().length < 60 && readHeader(c)).length;
}

function looksLikeCode(cell: string, re: RegExp) {
  const s = splitCode(cell, re);
  return !!s && !s.rest;
}

function tableNodes(doc: TableDoc, b: Builder): boolean {
  const rows = doc.rows.filter((r) => r.cells.some((c) => c.trim()));
  if (!rows.length) return false;
  const loc = (ref: number): SourceLoc => ({ file: doc.file, sheet: doc.sheet, row: ref });

  let headerAt = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    if (headerScore(rows[i].cells) >= 2) {
      headerAt = i;
      break;
    }
  }
  const width = Math.max(...rows.map((r) => r.cells.length));
  const data = rows.slice(headerAt + 1);
  const groups: ColGroup[] = [];
  const main: ColGroup = { first: Infinity, cols: {}, text: [] };

  if (headerAt >= 0) {
    const header = rows[headerAt].cells;
    const seen = new Set<string>();
    header.forEach((raw, i) => {
      const h = readHeader(raw);
      if (!h?.attr) return;
      let g = main;
      if (h.word) {
        g = groups.find((x) => x.word === h.word) ?? { word: h.word, first: i, cols: {}, text: [] };
        if (!groups.includes(g)) groups.push(g);
      }
      g.first = Math.min(g.first, i);
      const slotKey = `${h.word ?? ""}:${h.attr}`;
      if (h.attr === "text") {
        if (h.ar) (g.textAr ??= []).push(i);
        else g.text.push(i);
      } else if (!seen.has(slotKey) || (g.cols[h.attr] !== undefined && isArabicVariant(cleanHeader(header[g.cols[h.attr]!])) && !h.ar)) {
        g.cols[h.attr] = i;
        seen.add(slotKey);
      } else if (h.attr === "title" && !h.ar) {
        g.text.push(i);
      }
    });
  }

  for (const g of [...groups, main]) if (!g.text.length && g.textAr) g.text = g.textAr;

  // Code column by content when the header did not name one.
  const used = new Set([...groups, main].flatMap((g) => [...Object.values(g.cols), ...g.text]));
  const anyCode = [...groups, main].some((g) => g.cols.code !== undefined);
  if (!anyCode) {
    let best = -1;
    let bestShare = 0;
    for (let c = 0; c < width; c++) {
      if (used.has(c) && main.cols.title !== c) continue;
      const vals = data.map((r) => r.cells[c] ?? "").filter((v) => v.trim());
      if (vals.length < 2) continue;
      const share = vals.filter((v) => looksLikeCode(v, b.re) || !!splitCode(v, b.re)).length / vals.length;
      if (share > bestShare) [best, bestShare] = [c, share];
    }
    if (best >= 0 && bestShare >= 0.5) {
      main.cols.code = best;
      if (main.cols.title === best) delete main.cols.title;
      used.add(best);
    }
  }

  const hasRoles = [...groups, main].some((g) => Object.keys(g.cols).length || g.text.length);
  if (!hasRoles) return false;

  // No header: longest-text column is the requirement text.
  if (headerAt < 0 && main.cols.title === undefined && !main.text.length) {
    let best = -1;
    let bestLen = 0;
    for (let c = 0; c < width; c++) {
      if (used.has(c)) continue;
      const vals = data.map((r) => r.cells[c] ?? "").filter((v) => v.trim());
      const avg = vals.reduce((s, v) => s + v.length, 0) / Math.max(1, vals.length);
      const weightCol = vals.length > 0 && vals.every((v) => normalizeWeight(v) && !/^\d+$/.test(v));
      if (weightCol) main.cols.weight ??= c;
      else if (avg > bestLen) [best, bestLen] = [c, avg];
    }
    if (best >= 0) main.cols.title = best;
  }

  // The row entity is the requirement-like group (or the unnamed main group); others are context.
  const named = groups.filter((g) => g.word && ROW_WORDS.has(g.word));
  let row: ColGroup;
  if (named.length) row = named.sort((a, b) => b.first - a.first)[0];
  else if (Object.keys(main.cols).length > 0 && (main.cols.code !== undefined || main.cols.title !== undefined || main.text.length)) row = main;
  else row = groups.sort((a, b) => b.first - a.first)[0] ?? main;
  if (row !== main) {
    for (const [a, i] of Object.entries(main.cols) as [Attr, number][]) row.cols[a] ??= i;
    row.text.push(...main.text);
  }
  const context = groups.filter((g) => g !== row).sort((a, b) => a.first - b.first);
  const hasCodeCol = row.cols.code !== undefined;

  const cell = (r: { cells: string[] }, i?: number) => (i === undefined ? "" : (r.cells[i] ?? "").trim());
  const last = new Map<ColGroup, ExtractedNode>();
  const groupIndex = new Map<string, ExtractedNode>();
  const counters = new Map<string, number>();

  for (const r of data) {
    let parent: ExtractedNode | undefined;
    const rowTitle = cell(r, row.cols.title);
    const rowText = row.text.map((i) => cell(r, i)).filter(Boolean).join("\n");
    const rowCode = cell(r, row.cols.code);
    const rowHasContent = !!(rowTitle || rowText || rowCode);

    for (const g of context) {
      const codeVal = cell(r, g.cols.code);
      const titleVal = cell(r, g.cols.title) || g.text.map((i) => cell(r, i)).find(Boolean) || "";
      if (!codeVal && !titleVal) {
        // Merged cells arrive empty on following rows: fill down.
        const prev = last.get(g);
        if (prev && rowHasContent) parent = prev;
        continue;
      }
      let code = codeVal ? normalizeCode(codeVal) : "";
      let title = titleVal;
      if (!code) {
        const s = splitCode(titleVal, b.re);
        if (s?.rest) [code, title] = [s.code, s.rest];
      } else if (titleVal) {
        const s = splitCode(titleVal, b.re);
        if (s && key(s.code) === key(code)) title = s.rest;
      }
      const k = `${parent?.id ?? ""}|${g.word}|${code ? key(code) : title.toLowerCase()}`;
      let n = groupIndex.get(k);
      if (!n) {
        n = b.node({ code: code || b.genCode(g.word, parent, counters), title, contextParentId: parent?.id, levelHint: g.word, loc: loc(r.ref) });
        if (g.cols.weight !== undefined) n.weight = normalizeWeight(cell(r, g.cols.weight));
        groupIndex.set(k, n);
      }
      last.set(g, n);
      parent = n;
    }

    if (!rowHasContent) continue;
    let code = rowCode;
    let title = rowTitle;
    let text = rowText;
    if (code) {
      const s = splitCode(code, b.re);
      if (s) {
        code = s.code;
        if (s.rest && !title) title = s.rest;
      } else code = normalizeCode(code);
    } else if (!hasCodeCol) {
      const s = splitCode(title || text, b.re);
      if (s && s.rest) {
        code = s.code;
        if (title) title = s.rest;
        else text = s.rest;
      }
    }
    if (!code) {
      if (hasCodeCol) {
        b.orphan(loc(r.ref), [title, text].filter(Boolean).join(" · ") || r.cells.filter(Boolean).join(" · "));
        continue;
      }
      code = b.genCode(row.word ?? "Requirement", parent, counters);
    }
    if (!title && text) ({ title, text } = splitTitle(text));
    const typeHint = cell(r, row.cols.type);
    b.node({
      code,
      title,
      text,
      weight: normalizeWeight(cell(r, row.cols.weight)),
      evidence: cell(r, row.cols.evidence) || undefined,
      contextParentId: parent?.id,
      levelHint: (typeHint && (levelWord(typeHint) ?? typeHint)) || row.word,
      loc: loc(r.ref),
    });
  }
  return true;
}

/* ---------- Text ---------- */

function stripMarkdown(s: string): { text: string; heading: boolean; listNumber: boolean } {
  let t = s.replace(/\t/g, " ").trim();
  let heading = false;
  const h = /^#{1,6}\s+/.exec(t);
  if (h) {
    heading = true;
    t = t.slice(h[0].length);
  }
  t = t.replace(/^(?:[-*+•▪◦]|\d+\))\s+(?=\S)/, (m) => (/^\d/.test(m) ? m : "")).replace(/\*\*|__|`/g, "").trim();
  const listNumber = !heading && /^\d{1,3}[.)]\s/.test(t);
  return { text: t, heading, listNumber };
}

function isTableLine(s: string) {
  const t = s.trim();
  return t.startsWith("|") && t.split("|").length >= 3;
}

function textNodes(doc: TextDoc, b: Builder, meta: ExtractionMeta) {
  // Markdown tables inside a text document go through the table reader.
  const lines: TextLine[] = [];
  for (let i = 0; i < doc.lines.length; i++) {
    if (isTableLine(doc.lines[i].text) && i + 1 < doc.lines.length && isTableLine(doc.lines[i + 1].text)) {
      const block: TableDoc = { kind: "table", file: doc.file, rows: [] };
      while (i < doc.lines.length && isTableLine(doc.lines[i].text)) {
        const cells = doc.lines[i].text.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c) || !c)) block.rows.push({ ref: doc.lines[i].line, cells });
        i++;
      }
      i--;
      const [n0, o0] = [b.nodes.length, b.orphans.length];
      if (!tableNodes(block, b)) lines.push(...block.rows.map((r) => ({ line: r.ref, text: r.cells.join(" ") })));
      // Table rows are lines of the document.
      for (const x of [...b.nodes.slice(n0), ...b.orphans.slice(o0)]) x.loc = { file: doc.file, line: x.loc.row };
      continue;
    }
    lines.push(doc.lines[i]);
  }

  type Kind = "code" | "label" | "weight" | "evidence" | "other";
  const parsed = lines.map((l) => {
    const md = stripMarkdown(l.text);
    const heading = md.heading || !!l.heading;
    const t = md.text;
    if (!t) return { l, kind: "other" as Kind, t, heading };
    const label = LABEL.exec(t);
    if (label && (label[2] || heading)) return { l, kind: "label" as Kind, t, heading, label };
    const w = WEIGHT_LINE.exec(t);
    if (w) return { l, kind: "weight" as Kind, t, heading, value: w[1] };
    const e = EVIDENCE_LINE.exec(t);
    if (e) return { l, kind: "evidence" as Kind, t, heading, value: e[1] };
    const c = splitCode(t, b.re);
    if (c) return { l, kind: "code" as Kind, t, heading, c, listNumber: md.listNumber };
    return { l, kind: "other" as Kind, t, heading };
  });

  // "1. Do this" lists under a requirement are body text, not nodes: when the document
  // has dotted codes, a single-number list item that follows a deeper code (or repeats
  // an earlier number) belongs to the requirement above it.
  const multi = parsed.some((p) => p.kind === "code" && segmentCount(p.c!.code) > 1);
  const singles = parsed.filter((p) => p.kind === "code" && p.listNumber && segmentCount(p.c!.code) === 1).map((p) => key(p.c!.code));
  const restart = multi && new Set(singles).size < singles.length;
  let lastSegs = 0;
  for (const p of parsed) {
    if (p.kind === "label") lastSegs = p.label![2] ? segmentCount(p.label![2]) : lastSegs;
    if (p.kind !== "code") continue;
    const segs = segmentCount(p.c!.code);
    if (p.listNumber && segs === 1 && (restart || (multi && lastSegs > 1))) p.kind = "other";
    else lastSegs = segs;
  }

  const loc = (l: TextLine): SourceLoc => ({ file: doc.file, page: l.page, line: l.line });
  let current: ExtractedNode | undefined;
  let mode: "text" | "evidence" = "text";
  const stack: ExtractedNode[] = [];
  const counters = new Map<string, number>();

  for (const p of parsed) {
    if (p.kind === "label") {
      const [, wordRaw, codeRaw, rest] = p.label!;
      const word = levelWord(wordRaw) ?? wordRaw;
      const { text: title, weight, evidence } = pullHints(rest.trim());
      const same = stack.findIndex((x) => x.levelHint === word);
      if (same >= 0) stack.length = same;
      const parent = stack[stack.length - 1];
      current = b.node({
        code: codeRaw ? normalizeCode(codeRaw) : b.genCode(word, parent, counters),
        title,
        weight,
        evidence,
        levelHint: word,
        contextParentId: parent?.id,
        loc: loc(p.l),
      });
      if (!ROW_WORDS.has(word)) stack.push(current);
      mode = "text";
      continue;
    }
    if (p.kind === "code") {
      const { text: rest, weight, evidence } = pullHints(p.c!.rest);
      const { title, text } = splitTitle(rest);
      current = b.node({ code: p.c!.code, title, text, weight, evidence, contextParentId: stack[stack.length - 1]?.id, loc: loc(p.l) });
      mode = "text";
      continue;
    }
    if (!current) {
      if (p.heading && !meta.name && p.t) meta.name = p.t;
      continue;
    }
    if (p.kind === "weight") {
      current.weight = normalizeWeight(p.value) ?? current.weight;
      continue;
    }
    if (p.kind === "evidence") {
      if (p.value?.trim()) current.evidence = join(current.evidence ?? "", p.value.trim());
      mode = "evidence";
      continue;
    }
    if (!p.t || p.heading) {
      mode = "text";
      continue;
    }
    if (mode === "evidence") current.evidence = join(current.evidence ?? "", p.t);
    else if (!current.title) {
      const h = pullHints(p.t);
      const s = splitTitle(h.text);
      current.title = s.title;
      current.text = join(current.text, s.text);
      current.weight ??= h.weight;
      if (h.evidence) current.evidence = join(current.evidence ?? "", h.evidence);
    } else current.text = join(current.text, p.t);
  }
}

/* ---------- Trees (JSON) ---------- */

function treeNodes(doc: TreeDoc, b: Builder) {
  const walk = (items: TreeItem[], parent: ExtractedNode | undefined, path: string) => {
    items.forEach((it, i) => {
      const hint = it.level ? (levelWord(it.level) ?? it.level) : undefined;
      let code = it.code ? normalizeCode(String(it.code)) : "";
      let title = it.title?.trim() ?? "";
      if (!code && title) {
        const s = splitCode(title, b.re);
        if (s?.rest) [code, title] = [s.code, s.rest];
      }
      if (!code) code = parent ? `${parent.code}.${i + 1}` : String(i + 1);
      let text = it.text?.trim() ?? "";
      if (!title && text) ({ title, text } = splitTitle(text));
      const n = b.node({
        code,
        title,
        text,
        weight: normalizeWeight(it.weight),
        evidence: it.evidence?.trim() || undefined,
        levelHint: hint,
        contextParentId: parent?.id,
        loc: { file: doc.file, sheet: `${path}[${i}]` },
      });
      if (it.children?.length) walk(it.children, n, `${path}[${i}].children`);
    });
  };
  walk(doc.items, undefined, "items");
}

/* ---------- Tree resolution and levels ---------- */

/** Resolves parents from codes (then source layout), creating placeholders for missing parents. */
export function resolveTree(ex: Extraction): Extraction {
  const nodes = ex.nodes;
  const byCode = new Map<string, ExtractedNode>();
  for (const n of nodes) if (!byCode.has(key(n.code))) byCode.set(key(n.code), n);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const shapes = new Set(nodes.filter((n) => !n.placeholder).map((n) => patternOf(n.code)));
  let seq = ex.seq;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.parentOverride !== undefined) {
      n.parentId = n.parentOverride && byId.has(n.parentOverride) ? n.parentOverride : undefined;
      continue;
    }
    let parent: ExtractedNode | undefined;
    let c = parentCode(n.code);
    let first = true;
    while (c) {
      const hit = byCode.get(key(c));
      if (hit && hit !== n) {
        parent = hit;
        break;
      }
      if (first && shapes.has(patternOf(c))) {
        parent = { id: `n${++seq}`, code: c, title: "", text: "", placeholder: true, contextParentId: n.contextParentId, loc: n.loc };
        nodes.push(parent);
        byCode.set(key(c), parent);
        byId.set(parent.id, parent);
        break;
      }
      first = false;
      c = parentCode(c);
    }
    if (!parent && n.contextParentId && n.contextParentId !== n.id) parent = byId.get(n.contextParentId);
    n.parentId = parent?.id;
  }

  // Break any cycle an edit may have introduced.
  for (const n of nodes) {
    const seen = new Set([n.id]);
    let p = n.parentId ? byId.get(n.parentId) : undefined;
    while (p) {
      if (seen.has(p.id)) {
        n.parentId = undefined;
        break;
      }
      seen.add(p.id);
      p = p.parentId ? byId.get(p.parentId) : undefined;
    }
  }
  ex.seq = seq;
  return ex;
}

export function depths(ex: Extraction): Map<string, number> {
  const byId = new Map(ex.nodes.map((n) => [n.id, n]));
  const out = new Map<string, number>();
  const depth = (n: ExtractedNode, guard = 0): number => {
    const known = out.get(n.id);
    if (known !== undefined) return known;
    const p = n.parentId ? byId.get(n.parentId) : undefined;
    const d = p && guard < 64 ? depth(p, guard + 1) + 1 : 0;
    out.set(n.id, d);
    return d;
  };
  ex.nodes.forEach((n) => depth(n));
  return out;
}

function majority<T>(values: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function assessedFor(names: string[], patterns: string[]): LevelAssessment[] {
  const last = names.length - 1;
  const crit = names.findIndex((n, i) => /criteri|sub-?control|sub-?requirement/i.test(n) || (i === last && i > 0 && /[A-Z]#$/.test(patterns[i])));
  const acceptedAt = crit > 0 ? crit - 1 : (() => {
    const named = names.findIndex((n) => ROW_WORDS.has(n));
    return named >= 0 ? named : last;
  })();
  return names.map((_, i) => (i === acceptedAt ? "accepted" : i > acceptedAt ? "ai_reviewer" : "rollup"));
}

function inferLevels(ex: Extraction, explicit?: SourceDoc["levels"]): DetectedLevel[] {
  const d = depths(ex);
  const count = ex.nodes.length ? Math.max(...d.values()) + 1 : 0;
  const patterns: string[] = [];
  const hints: (string | undefined)[] = [];
  for (let i = 0; i < count; i++) {
    const at = ex.nodes.filter((n) => d.get(n.id) === i);
    patterns.push(majority(at.filter((n) => !n.placeholder).map((n) => patternOf(n.code))) ?? patternOf(at[0]?.code ?? "#"));
    hints.push(majority(at.map((n) => n.levelHint).filter((h): h is string => !!h)));
  }
  const fallback = defaultNames(count, /[A-Z]#$/.test(patterns[count - 1] ?? ""));
  const used = new Set(hints.filter(Boolean));
  const names = Array.from({ length: count }, (_, i) => {
    if (explicit?.[i]?.en) return explicit[i].en;
    if (hints[i]) return hints[i]!;
    let name = fallback[i];
    if (used.has(name)) name = fallback.find((f) => !used.has(f)) ?? `Level ${i + 1}`;
    used.add(name);
    return name;
  });
  const assessed = assessedFor(names, patterns);
  return names.map((en, i) => ({
    id: `lv-${i + 1}`,
    en,
    ar: explicit?.[i]?.ar ?? arabicFor(en),
    pattern: explicit?.[i]?.pattern ?? patterns[i],
    assessed: assessed[i],
  }));
}

/** Keeps the level list in step with tree depth after edits: appends missing levels, drops empty trailing ones. */
function syncLevels(ex: Extraction): Extraction {
  const d = depths(ex);
  const count = ex.nodes.length ? Math.max(...d.values()) + 1 : 0;
  if (count > ex.levels.length) {
    const fresh = inferLevels(ex);
    ex.levels = [...ex.levels, ...fresh.slice(ex.levels.length).map((l, i) => ({ ...l, id: `lv-x${ex.seq + i + 1}` }))];
    ex.seq += count;
  } else if (count < ex.levels.length && count > 0) {
    ex.levels = ex.levels.slice(0, count);
  }
  return ex;
}

/* ---------- Entry point ---------- */

export function extractFramework(docs: SourceDoc[], opts: ExtractOptions = {}): Extraction {
  const b = new Builder(codeMatcher(opts.codeRegex));
  const meta: ExtractionMeta = {};
  let records = 0;
  const sheets: string[] = [];

  // Spreadsheets: prefer sheets that carry codes; prose-only sheets (instructions) are read as text.
  const tables = docs.filter((d): d is TableDoc & SourceDoc => d.kind === "table");
  for (const doc of docs) {
    Object.assign(meta, Object.fromEntries(Object.entries(doc.meta ?? {}).filter(([, v]) => v)));
    if (doc.kind === "table") {
      records += doc.rows.length;
      const before = b.nodes.length;
      const ok = tableNodes(doc, b);
      if (ok && b.nodes.length > before) sheets.push(doc.sheet ?? doc.file);
      else if (!ok && tables.length === 1) textNodes({ kind: "text", file: doc.file, lines: doc.rows.map((r) => ({ line: r.ref, text: r.cells.filter(Boolean).join(" ") })) }, b, meta);
    } else if (doc.kind === "text") {
      records += doc.lines.length;
      textNodes(doc, b, meta);
    } else {
      treeNodes(doc, b);
      records += b.nodes.length;
    }
  }

  const ex: Extraction = {
    files: [...new Set(docs.map((d) => d.file))],
    sheets,
    records,
    codeRegex: opts.codeRegex?.trim() || undefined,
    meta,
    levels: [],
    nodes: b.nodes,
    orphans: b.orphans,
    seq: b.seq,
  };
  resolveTree(ex);
  ex.levels = inferLevels(ex, docs.find((d) => d.levels?.length)?.levels);
  return ex;
}

/* ---------- Checks ---------- */

export function formatLoc(loc?: SourceLoc) {
  if (!loc) return "";
  const parts = [loc.file];
  if (loc.sheet) parts.push(loc.sheet);
  if (loc.row) parts.push(`row ${loc.row}`);
  if (loc.page) parts.push(`page ${loc.page}`);
  if (loc.line && !loc.row) parts.push(`line ${loc.line}`);
  return parts.join(" · ");
}

/** Which level carries weights: the most common level among weighted nodes, else the accepted level. */
export function weightedLevel(ex: Extraction): number {
  const d = depths(ex);
  const w = majority(ex.nodes.filter((n) => n.weight).map((n) => d.get(n.id)!));
  if (w !== undefined) return w;
  const acc = ex.levels.findIndex((l) => l.assessed === "accepted");
  return acc >= 0 ? acc : ex.levels.length - 1;
}

export function checkExtraction(ex: Extraction): ExtractWarning[] {
  const out: ExtractWarning[] = [];
  const d = depths(ex);
  const firstByCode = new Map<string, ExtractedNode>();
  for (const n of ex.nodes) {
    const k = key(n.code);
    const first = firstByCode.get(k);
    if (first) out.push({ id: `dup-${n.id}`, kind: "duplicate", nodeId: n.id, loc: n.loc, message: `Duplicate code ${n.code} (first seen at ${formatLoc(first.loc)})` });
    else firstByCode.set(k, n);
  }
  for (const n of ex.nodes) {
    if (n.placeholder) {
      out.push({ id: `mp-${n.id}`, kind: "missing_parent", nodeId: n.id, loc: n.loc, message: `Missing parent ${n.code}: referenced by a child but not in the file` });
      continue;
    }
    if (!n.title.trim() && !n.text.trim()) out.push({ id: `em-${n.id}`, kind: "empty", nodeId: n.id, loc: n.loc, message: `${n.code} has no title or text` });
  }
  for (const n of ex.nodes) {
    const lv = ex.levels[d.get(n.id)!];
    if (lv?.pattern.trim() && !matchesPattern(n.code, lv.pattern))
      out.push({ id: `pt-${n.id}`, kind: "pattern", nodeId: n.id, loc: n.loc, message: `${n.code} does not match the ${lv.en} pattern ${lv.pattern}` });
  }
  for (const o of ex.orphans) {
    if (!o.dismissed) out.push({ id: `or-${o.id}`, kind: "orphan", orphanId: o.id, loc: o.loc, message: `Row without a code: "${o.preview}"` });
  }
  const wl = weightedLevel(ex);
  const atLevel = ex.nodes.filter((n) => d.get(n.id) === wl);
  const missing = atLevel.filter((n) => !n.weight);
  if (missing.length === atLevel.length && atLevel.length > 0) {
    out.push({ id: "mw-all", kind: "missing_weight", message: `No weights in the source for ${atLevel.length} ${ex.levels[wl]?.en ?? "level"} nodes` });
  } else {
    for (const n of missing) out.push({ id: `mw-${n.id}`, kind: "missing_weight", nodeId: n.id, loc: n.loc, message: `Weight missing for ${n.code}` });
  }
  return out;
}

export function levelCounts(ex: Extraction): number[] {
  const d = depths(ex);
  const counts = ex.levels.map(() => 0);
  for (const n of ex.nodes) {
    const i = d.get(n.id)!;
    if (i < counts.length) counts[i]++;
  }
  return counts;
}

/* ---------- Review edits (pure: each returns a new extraction) ---------- */

function edit(ex: Extraction, fn: (e: Extraction) => void): Extraction {
  const next = structuredClone(ex);
  fn(next);
  return syncLevels(resolveTree(next));
}

export function updateLevel(ex: Extraction, index: number, patch: Partial<Omit<DetectedLevel, "id">>): Extraction {
  return edit(ex, (e) => void Object.assign(e.levels[index], patch));
}

export function updateNode(ex: Extraction, id: string, patch: Partial<Pick<ExtractedNode, "code" | "title" | "text" | "weight" | "evidence">>): Extraction {
  return edit(ex, (e) => {
    const n = e.nodes.find((x) => x.id === id);
    if (!n) return;
    Object.assign(n, patch);
    if (patch.code !== undefined) n.code = normalizeCode(patch.code);
    if (patch.weight !== undefined) n.weight = normalizeWeight(patch.weight) ?? (patch.weight.trim() || undefined);
    if (n.placeholder && n.title.trim()) n.placeholder = false;
  });
}

function descendants(e: Extraction, id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of e.nodes)
      if (n.parentId && out.has(n.parentId) && !out.has(n.id)) {
        out.add(n.id);
        grew = true;
      }
  }
  return out;
}

/** Deletes a node with its subtree, or only the node (children move up a level). */
export function deleteNode(ex: Extraction, id: string, keepChildren = false): Extraction {
  return edit(ex, (e) => {
    const n = e.nodes.find((x) => x.id === id);
    if (!n) return;
    if (keepChildren) {
      for (const c of e.nodes) if (c.parentId === id) c.parentOverride = n.parentId ?? null;
      e.nodes = e.nodes.filter((x) => x.id !== id);
    } else {
      const drop = descendants(e, id);
      e.nodes = e.nodes.filter((x) => !drop.has(x.id));
    }
  });
}

/** Merges nodes into the first one: text and evidence are appended, children move over. */
export function mergeNodes(ex: Extraction, keepId: string, dropIds: string[]): Extraction {
  return edit(ex, (e) => {
    const keep = e.nodes.find((x) => x.id === keepId);
    if (!keep) return;
    const drops = dropIds.filter((id) => id !== keepId).map((id) => e.nodes.find((x) => x.id === id)).filter((x): x is ExtractedNode => !!x);
    for (const d of drops) {
      if (!keep.title) keep.title = d.title;
      else if (d.title && d.title !== keep.title) keep.text = join(keep.text, key(d.code) === key(keep.code) ? d.title : `${d.code} ${d.title}`);
      if (d.text && d.text !== keep.text) keep.text = join(keep.text, d.text);
      keep.weight ??= d.weight;
      if (d.evidence && d.evidence !== keep.evidence) keep.evidence = join(keep.evidence ?? "", d.evidence);
      for (const c of e.nodes) if (c.parentId === d.id) c.parentOverride = keep.id;
    }
    if (keep.placeholder && keep.title) keep.placeholder = false;
    const dropSet = new Set(drops.map((x) => x.id));
    e.nodes = e.nodes.filter((x) => !dropSet.has(x.id));
  });
}

/** Merges every duplicate code into its first occurrence. */
export function mergeDuplicates(ex: Extraction): Extraction {
  let next = ex;
  const groups = new Map<string, string[]>();
  for (const n of ex.nodes) groups.set(key(n.code), [...(groups.get(key(n.code)) ?? []), n.id]);
  for (const ids of groups.values()) if (ids.length > 1) next = mergeNodes(next, ids[0], ids.slice(1));
  return next;
}

export function applyDefaultWeight(ex: Extraction, weight = "med"): Extraction {
  const wl = weightedLevel(ex);
  const d = depths(ex);
  return edit(ex, (e) => {
    for (const n of e.nodes) if (d.get(n.id) === wl && !n.weight) n.weight = weight;
  });
}

export function dismissOrphan(ex: Extraction, id: string): Extraction {
  return edit(ex, (e) => {
    const o = e.orphans.find((x) => x.id === id);
    if (o) o.dismissed = true;
  });
}

/** Turns an orphan row into a node under the node read just before it. */
export function adoptOrphan(ex: Extraction, id: string, code: string): Extraction {
  return edit(ex, (e) => {
    const o = e.orphans.find((x) => x.id === id);
    if (!o) return;
    const before = e.nodes.filter((n) => !n.placeholder && n.loc.file === o.loc.file && (n.loc.row ?? n.loc.line ?? 0) < (o.loc.row ?? o.loc.line ?? 0)).at(-1);
    const n: ExtractedNode = { id: `n${++e.seq}`, code: normalizeCode(code), title: o.preview, text: "", loc: o.loc };
    if (before && !parentCode(n.code)) n.parentOverride = before.parentId ?? null;
    e.nodes.splice(before ? e.nodes.indexOf(before) + 1 : e.nodes.length, 0, n);
    e.orphans = e.orphans.filter((x) => x.id !== id);
  });
}

/** Tree order (parents before children, source order among siblings). */
export function treeOrder(ex: Extraction): { node: ExtractedNode; depth: number }[] {
  const kids = new Map<string | undefined, ExtractedNode[]>();
  const ids = new Set(ex.nodes.map((n) => n.id));
  for (const n of ex.nodes) {
    const p = n.parentId && ids.has(n.parentId) ? n.parentId : undefined;
    kids.set(p, [...(kids.get(p) ?? []), n]);
  }
  const out: { node: ExtractedNode; depth: number }[] = [];
  const walk = (p: string | undefined, depth: number) => {
    for (const n of kids.get(p) ?? []) {
      out.push({ node: n, depth });
      walk(n.id, depth + 1);
    }
  };
  walk(undefined, 0);
  return out;
}

/** The reviewed result as Admin Studio configuration. */
export function toFrameworkDraft(ex: Extraction): { levels: HierarchyLevel[]; requirements: FrameworkRequirement[] } {
  const levels: HierarchyLevel[] = ex.levels.map((l, i) => ({ id: `lv-${i + 1}`, en: l.en.trim(), ar: l.ar.trim(), pattern: l.pattern.trim(), assessed: l.assessed }));
  const byId = new Map(ex.nodes.map((n) => [n.id, n]));
  const requirements = treeOrder(ex).map(({ node: n, depth }) => {
    const r: FrameworkRequirement = { code: n.code, level: levels[Math.min(depth, levels.length - 1)]?.id ?? "lv-1", title: n.title.trim() };
    const p = n.parentId ? byId.get(n.parentId) : undefined;
    if (p) r.parent = p.code;
    if (n.text.trim()) r.text = n.text.trim();
    if (n.weight) r.weight = n.weight;
    if (n.evidence?.trim()) r.evidence = n.evidence.trim();
    r.source = formatLoc(n.loc);
    return r;
  });
  return { levels, requirements };
}
