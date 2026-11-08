// Pure converters from file contents to extraction source documents. File reading and
// the third-party parsers (SheetJS, mammoth, pdf.js) live in src/lib/import; everything
// here is plain string/array work so it runs the same in the browser and in tests.

import type { ExtractionMeta, SourceDoc, TableDoc, TextDoc, TreeItem } from "./extract";

/* ---------- CSV / TSV ---------- */

function sniffDelimiter(text: string) {
  const sample = text.split(/\r?\n/).slice(0, 10).join("\n");
  const count = (d: string) => sample.split(d).length - 1;
  return [",", ";", "\t", "|"].sort((a, b) => count(b) - count(a))[0];
}

/** RFC 4180 reader: quoted fields, doubled quotes, newlines inside quotes. */
export function parseDelimited(text: string, delimiter = sniffDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && !field.trim()) {
      quoted = true;
      field = "";
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function delimitedToDoc(file: string, text: string): TableDoc {
  return rowsToDoc(file, parseDelimited(text));
}

export function rowsToDoc(file: string, rows: unknown[][], sheet?: string): TableDoc {
  return {
    kind: "table",
    file,
    sheet,
    rows: rows.map((cells, i) => ({ ref: i + 1, cells: cells.map((c) => (c == null ? "" : String(c)).trim()) })),
  };
}

/* ---------- Plain text / Markdown ---------- */

export function textToDoc(file: string, text: string): TextDoc {
  return {
    kind: "text",
    file,
    lines: text
      .replace(/^﻿/, "")
      .split(/\r?\n/)
      .map((t, i) => ({ line: i + 1, text: t })),
  };
}

/* ---------- JSON ---------- */

const SINGULAR: Record<string, string> = { axes: "Axis", criteria: "Criterion", indices: "Index", categories: "Category", subdomains: "Sub-domain", sub_domains: "Sub-domain", subcontrols: "Sub-control", sub_controls: "Sub-control" };

function singular(k: string) {
  const l = k.toLowerCase();
  if (SINGULAR[l]) return SINGULAR[l];
  if (/^(children|items|nodes|elements)$/.test(l)) return undefined;
  const s = l.replace(/s$/, "");
  return s[0].toUpperCase() + s.slice(1);
}

const pick = (o: Record<string, unknown>, re: RegExp) => {
  for (const [k, v] of Object.entries(o)) if (re.test(k) && (typeof v === "string" || typeof v === "number")) return String(v);
  return undefined;
};

function toItem(o: Record<string, unknown>, levelFromKey?: string): TreeItem {
  const item: TreeItem = {
    code: pick(o, /^(code|id|ref|reference|number|no)$/i),
    title: pick(o, /^(title|name|title_en|name_en|heading|label)$/i),
    text: pick(o, /^(text|description|statement|text_en|description_en|details|guidance|requirement)$/i),
    weight: pick(o, /^(weight|priority|importance)$/i),
    level: pick(o, /^(level|type|kind|node_type)$/i) ?? levelFromKey,
  };
  const ev = Object.entries(o).find(([k]) => /^(evidence|evidences|required_evidence|documents)$/i.test(k))?.[1];
  if (typeof ev === "string") item.evidence = ev;
  else if (Array.isArray(ev)) item.evidence = ev.map((e) => (typeof e === "string" ? e : JSON.stringify(e))).join("\n");
  for (const [k, v] of Object.entries(o)) {
    if (k !== "levels" && Array.isArray(v) && v.some((x) => x && typeof x === "object" && !Array.isArray(x))) {
      item.children = [...(item.children ?? []), ...v.filter((x) => x && typeof x === "object").map((x) => toItem(x as Record<string, unknown>, singular(k)))];
    }
  }
  return item;
}

/** Accepts an array of nodes, a nested tree, or { name, levels, requirements|children|… }. */
export function jsonToDoc(file: string, text: string): SourceDoc {
  const data = JSON.parse(text) as unknown;
  if (Array.isArray(data)) return { kind: "tree", file, items: data.filter((x) => x && typeof x === "object").map((x) => toItem(x as Record<string, unknown>)) };
  if (!data || typeof data !== "object") throw new Error("JSON must be an object or an array of requirements.");
  const o = data as Record<string, unknown>;
  const meta: ExtractionMeta = {
    name: pick(o, /^(framework|name|title|index)$/i),
    authority: pick(o, /^(authority|issuer|publisher|owner)$/i),
    version: pick(o, /^(version)$/i),
  };
  const levels = Array.isArray(o.levels)
    ? (o.levels as unknown[]).map((l) =>
        typeof l === "string" ? { en: l } : { en: String((l as Record<string, unknown>).en ?? (l as Record<string, unknown>).name ?? ""), ar: (l as Record<string, string>).ar, pattern: (l as Record<string, string>).pattern },
      )
    : undefined;
  const root = toItem(o);
  return { kind: "tree", file, items: root.children ?? [], levels, meta };
}

/* ---------- Word (mammoth HTML) ---------- */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

function decode(s: string) {
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e: string) => {
      if (ENTITIES[e]) return ENTITIES[e];
      if (e.startsWith("#x")) return String.fromCodePoint(parseInt(e.slice(2), 16));
      if (e.startsWith("#")) return String.fromCodePoint(Number(e.slice(1)));
      return m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Converts mammoth's HTML for a .docx into a text document plus one table document per
 * Word table. Word auto-numbering is not part of the text, so numbered lists get their
 * codes back from list nesting (1, 1.1, 1.1.1).
 */
export function docxHtmlToDocs(file: string, html: string): SourceDoc[] {
  const text: TextDoc = { kind: "text", file, lines: [] };
  const tables: TableDoc[] = [];
  const counters: number[] = [];
  const lists: ("ol" | "ul")[] = [];
  let para = 0;
  const re = /<(\/?)(h[1-6]|p|li|ol|ul|table|tr|td|th)\b[^>]*>/gi;
  let table: TableDoc | null = null;
  let tr: string[] | null = null;
  let cellStart = -1;
  let blockStart = -1;
  let blockTag = "";
  let m: RegExpExecArray | null;

  while ((m = re.exec(html))) {
    const [tag, close, nameRaw] = m;
    const name = nameRaw.toLowerCase();
    if (name === "table") {
      if (!close) table = { kind: "table", file, sheet: `table ${tables.length + 1}`, rows: [] };
      else if (table) {
        tables.push(table);
        table = null;
      }
      continue;
    }
    if (table) {
      if (name === "tr") {
        if (!close) tr = [];
        else if (tr) {
          table.rows.push({ ref: table.rows.length + 1, cells: tr });
          tr = null;
        }
      } else if (name === "td" || name === "th") {
        if (!close) cellStart = m.index + tag.length;
        else if (tr && cellStart >= 0) {
          tr.push(decode(html.slice(cellStart, m.index)));
          cellStart = -1;
        }
      }
      continue;
    }
    if (name === "ol" || name === "ul") {
      if (!close) {
        // A list item with a nested list: its own text ends where the nested list starts.
        if (blockStart >= 0 && blockTag === "li") flush(html.slice(blockStart, m.index), "li");
        lists.push(name);
        if (name === "ol") counters.push(0);
      } else if (lists.pop() === "ol") counters.pop();
      continue;
    }
    if (!close) {
      if (name === "li" && lists.at(-1) === "ol") counters[counters.length - 1]++;
      // Nested blocks (<li><p>…) are read once, at the outer element.
      if (blockStart < 0) {
        blockStart = m.index + tag.length;
        blockTag = name;
      }
      continue;
    }
    if (blockStart >= 0 && name === blockTag) flush(html.slice(blockStart, m.index), name);
  }

  function flush(inner: string, name: string) {
    blockStart = -1;
    const own = decode(inner);
    if (!own) return;
    para++;
    const numbered = name === "li" && lists.at(-1) === "ol" && !/^\s*[A-Z]{0,8}[ -]?\d+([.\-]\d+)*\b/.test(own);
    text.lines.push({ line: para, text: numbered ? `${counters.join(".")} ${own}` : own, heading: /^h[1-6]$/.test(name) });
  }
  return [text, ...tables];
}

/* ---------- PDF (pdf.js text items) ---------- */

export interface PdfTextItem {
  str: string;
  /** pdf.js transform matrix; [4] is x, [5] is y. */
  transform: number[];
  height?: number;
  width?: number;
}

const RTL_CHAR = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_CHAR = /[A-Za-z0-9]/;

/**
 * Arabic PDFs often store one glyph per item, in presentation forms (U+FExx), placed right
 * to left with mirrored brackets. Items are ordered by reading direction, joined only where
 * there is a visible gap, then normalised (NFKC folds presentation forms to letters).
 */
function joinRow(parts: { x: number; w?: number; h: number; s: string }[]) {
  const rtl = parts.filter((p) => RTL_CHAR.test(p.s)).length > parts.filter((p) => LTR_CHAR.test(p.s)).length;
  const end = (p: (typeof parts)[number]) => p.x + (p.w ?? 0);
  const sorted = [...parts].sort((a, b) => (rtl ? end(b) - end(a) : a.x - b.x));
  let out = "";
  let prev: (typeof parts)[number] | undefined;
  for (const p of sorted) {
    if (prev) {
      const gap = prev.w === undefined || p.w === undefined ? Infinity : rtl ? prev.x - end(p) : p.x - end(prev);
      if (gap > p.h * 0.18 && !out.endsWith(" ") && !p.s.startsWith(" ")) out += " ";
    }
    out += p.s;
    prev = p;
  }
  out = out.normalize("NFKC").replace(/\u0640/g, "").replace(/\s+/g, " ").trim();
  return rtl ? out.replace(/[()]/g, (c) => (c === "(" ? ")" : "(")) : out;
}

export function pdfItemsToDoc(file: string, pages: PdfTextItem[][]): TextDoc {
  const lines: TextDoc["lines"] = [];
  pages.forEach((items, p) => {
    const rows: { y: number; parts: { x: number; w?: number; h: number; s: string }[] }[] = [];
    for (const it of items) {
      if (!it.str.trim()) continue;
      const y = it.transform[5];
      const h = it.height || 10;
      const tol = Math.max(2, h * 0.4);
      let row = rows.find((r) => Math.abs(r.y - y) <= tol);
      if (!row) {
        row = { y, parts: [] };
        rows.push(row);
      }
      row.parts.push({ x: it.transform[4], w: it.width, h, s: it.str });
    }
    rows
      .sort((a, b) => b.y - a.y)
      .forEach((r, i) => {
        const t = joinRow(r.parts);
        if (t) lines.push({ page: p + 1, line: i + 1, text: t });
      });
  });
  return { kind: "text", file, lines };
}

/* ---------- Dispatch by extension ---------- */

export type SourceFormat = "spreadsheet" | "csv" | "pdf" | "docx" | "text" | "json";

export function formatOf(name: string): SourceFormat | null {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (["xlsx", "xlsm", "xls", "ods"].includes(ext)) return "spreadsheet";
  if (["csv", "tsv"].includes(ext)) return "csv";
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  if (["txt", "md", "markdown", "text"].includes(ext)) return "text";
  if (ext === "json") return "json";
  return null;
}

/* ---------- Any other file ---------- */

/** Readable text of HTML or XML, including the XML inside PowerPoint and OpenDocument files. */
export function markupToText(markup: string) {
  return markup
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6]|a:p|w:p|text:p|text:h|table:table-row)>/gi, "\n")
    .replace(/<\/(td|th|w:tc|table:table-cell)>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e: string) => {
      if (e[0] !== "#") return ENTITIES[e.toLowerCase()] ?? all;
      const code = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
    })
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

/** Readable text of an RTF file; \\uN and \\'hh carry the Arabic. */
export function rtfToText(rtf: string) {
  return rtf
    .replace(/\{\\\*?\\?(fonttbl|colortbl|stylesheet|info|pict|themedata|colorschememapping|datastore|latentstyles)\b(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g, "")
    .replace(/\\u(-?\d+) ?(?:\\'[0-9a-f]{2}|\?)?/gi, (_, n: string) => String.fromCharCode((Number(n) + 65536) % 65536))
    .replace(/\\'([0-9a-f]{2})/gi, (_, h: string) => new TextDecoder("windows-1256").decode(new Uint8Array([parseInt(h, 16)])))
    .replace(/\\(par|line|row|sect|page)\b ?/g, "\n")
    .replace(/\\cell\b ?/g, "\t")
    .replace(/\\[a-z]+-?\d* ?/gi, "")
    .replace(/[{}\\]/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n");
}

/** The file as text when it is text in any encoding that says so. */
export function decodeIfText(bytes: Uint8Array): string | null {
  const bom = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le" : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : null;
  if (bom) return new TextDecoder(bom).decode(bytes);
  if (bytes.subarray(0, 8192).includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

const READABLE = /^[\t\x20-\x7E\u00A0-\u024F\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF\u2010-\u2027]$/;
const WORDS = /[A-Za-z\u0621-\u064A]{3}/;

/**
 * Stretches of English or Arabic inside a binary file: the last resort for formats with no parser
 * here, such as Word 97 documents. Claude ignores the leftovers and the admin reviews the result.
 */
export function readableRuns(bytes: Uint8Array, min = 8) {
  const runs: string[] = [];
  const collect = (start: number, step: 1 | 2) => {
    let run = "";
    const flush = () => {
      if (run.trim().length >= min && WORDS.test(run)) runs.push(run.trim());
      run = "";
    };
    for (let i = start; i + step <= bytes.length; i += step) {
      const ch = String.fromCharCode(step === 2 ? bytes[i] | (bytes[i + 1] << 8) : bytes[i]);
      if (READABLE.test(ch) && (step === 2 || bytes[i] < 0x7f)) run += ch;
      else flush();
    }
    flush();
  };
  collect(0, 2);
  collect(1, 2);
  collect(0, 1);
  return runs.join("\n");
}
