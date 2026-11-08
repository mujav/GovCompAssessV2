// Reads uploaded framework files in the browser and turns them into extraction sources.
// The parsers load on demand, so the Framework Builder page does not ship them up front.

import type { SourceDoc, TextDoc } from "@/lib/engine/extract";
import { decodeIfText, delimitedToDoc, docxHtmlToDocs, formatOf, jsonToDoc, markupToText, pdfItemsToDoc, readableRuns, rowsToDoc, rtfToText, textToDoc, type PdfTextItem, type SourceFormat } from "@/lib/engine/extract-sources";
import { transcribeImage } from "./ai-import";

export interface ReadFile {
  name: string;
  size: number;
  format: SourceFormat | null;
  /** SHA-256, hex. */
  hash: string;
  error?: string;
}

export function shortHash(hash: string) {
  return hash ? `${hash.slice(0, 4)}…${hash.slice(-4)}` : "—";
}

async function sha256(buf: ArrayBuffer) {
  if (!globalThis.crypto?.subtle) return "";
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const decodeText = (buf: ArrayBuffer) => new TextDecoder("utf-8").decode(buf);

async function readSpreadsheet(name: string, buf: ArrayBuffer): Promise<SourceDoc[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((sheet) => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheet], { header: 1, defval: "", raw: false, blankrows: true });
    return rowsToDoc(name, rows, sheet);
  });
}

async function readDocx(buf: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.convertToHtml({ arrayBuffer: buf });
  return result.value;
}

type PdfPage = Awaited<ReturnType<Awaited<ReturnType<typeof import("pdfjs-dist")["getDocument"]>["promise"]>["getPage"]>>;

// page.getTextContent() iterates a ReadableStream with `for await`, which Safari does not
// support ("undefined is not a function … value of readableStream"). Reading the same
// stream with getReader() works in every browser.
async function textItems(page: PdfPage) {
  const reader = page.streamTextContent().getReader();
  const items: Awaited<ReturnType<PdfPage["getTextContent"]>>["items"] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    items.push(...value.items);
  }
  return items;
}

/** The model that reads pictures of text; undefined when the Standard Parser agent is off. */
export type ReadOptions = { tier?: "Standard" | "Fast" };

const MAX_SIDE = 2000;
/** Fewer characters than this per page and a PDF is a scan. */
const SCANNED_BELOW = 20;
const SCAN_WORKERS = 6;

const canvasJpeg = (canvas: HTMLCanvasElement) => canvas.toDataURL("image/jpeg", 0.85).split(",")[1];

function needVision(opts: ReadOptions) {
  if (!opts.tier) throw new Error("This file is a scan or a picture. Turn on the Standard Parser agent in AI settings to read it.");
  return opts.tier;
}

async function transcribePdf(name: string, doc: { numPages: number; getPage: (n: number) => Promise<PdfPage> }, tier: "Standard" | "Fast"): Promise<TextDoc> {
  const pages: string[] = new Array(doc.numPages);
  let next = 0;
  const worker = async () => {
    while (next < doc.numPages) {
      const i = next++;
      const page = await doc.getPage(i + 1);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: MAX_SIDE / Math.max(base.width, base.height) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
      pages[i] = await transcribeImage(canvasJpeg(canvas), tier);
    }
  };
  await Promise.all(Array.from({ length: Math.min(SCAN_WORKERS, doc.numPages) }, worker));
  let line = 0;
  return { kind: "text", file: name, lines: pages.flatMap((t, p) => t.split("\n").map((text) => ({ line: ++line, text, page: p + 1 }))) };
}

async function readPdf(name: string, buf: ArrayBuffer, opts: ReadOptions): Promise<TextDoc> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc ||= new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: PdfTextItem[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    pages.push((await textItems(page)).flatMap((it) => ("str" in it ? [{ str: it.str, transform: it.transform, height: it.height, width: it.width }] : [])));
  }
  const chars = pages.flat().reduce((a, it) => a + it.str.trim().length, 0);
  const out = chars < SCANNED_BELOW * doc.numPages ? await transcribePdf(name, doc, needVision(opts)) : pdfItemsToDoc(name, pages);
  await doc.destroy();
  return out;
}

/** A picture of text, read by Claude; null when the browser cannot open the file as a picture. */
async function readImage(name: string, buf: ArrayBuffer, opts: ReadOptions): Promise<TextDoc | null> {
  if (typeof createImageBitmap !== "function") return null;
  const bitmap = await createImageBitmap(new Blob([buf])).catch(() => null);
  if (!bitmap) return null;
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return textToDoc(name, await transcribeImage(canvasJpeg(canvas), needVision(opts)));
}

/** PowerPoint, OpenDocument and misnamed Word files are zips of XML; any other zip is read file by file. */
async function readZip(name: string, buf: ArrayBuffer, opts: ReadOptions): Promise<SourceDoc[]> {
  const XLSX = await import("xlsx");
  const zip = XLSX.CFB.read(new Uint8Array(buf), { type: "array" });
  const files = (zip.FullPaths as string[])
    .map((path, i) => ({ path: path.replace(/^[^/]*\//, ""), content: zip.FileIndex[i].content as ArrayLike<number> | undefined }))
    .flatMap((f) => (f.path && !f.path.endsWith("/") && !f.path.startsWith("__MACOSX/") && f.content?.length ? [{ path: f.path, bytes: Uint8Array.from(f.content) }] : []));
  const xml = (f: { bytes: Uint8Array }) => markupToText(new TextDecoder("utf-8").decode(f.bytes));
  const slideNo = (path: string) => Number(/slide(\d+)\.xml$/.exec(path)?.[1] ?? 0);
  const slides = files.filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f.path)).sort((a, b) => slideNo(a.path) - slideNo(b.path));
  if (slides.length) {
    let line = 0;
    return [{ kind: "text", file: name, lines: slides.flatMap((f, p) => xml(f).split("\n").map((text) => ({ line: ++line, text, page: p + 1 }))) }];
  }
  const body = files.find((f) => f.path === "content.xml" || f.path === "word/document.xml");
  if (body) return [textToDoc(name, xml(body))];
  const docs: SourceDoc[] = [];
  for (const f of files) {
    const copy = f.bytes.buffer.slice(f.bytes.byteOffset, f.bytes.byteOffset + f.bytes.byteLength) as ArrayBuffer;
    docs.push(...(await readBuffer(`${name}/${f.path}`, copy, opts, true).catch(() => [])));
  }
  return docs;
}

/** A file no extension identifies: goes by what is inside it. */
async function readAny(name: string, buf: ArrayBuffer, opts: ReadOptions, nested: boolean): Promise<SourceDoc[]> {
  const bytes = new Uint8Array(buf);
  const head = String.fromCharCode(...bytes.subarray(0, 5));
  if (head === "%PDF-") return [await readPdf(name, buf, opts)];
  if (head.startsWith("PK") && !nested) return readZip(name, buf, opts);
  const text = decodeIfText(bytes);
  if (text !== null) {
    if (text.trimStart().startsWith("{\\rtf")) return [textToDoc(name, rtfToText(text))];
    return [textToDoc(name, text.trimStart().startsWith("<") ? markupToText(text) : text)];
  }
  const image = await readImage(name, buf, opts);
  if (image) return [image];
  return [textToDoc(name, readableRuns(bytes))];
}

/** Converts one file's bytes into source documents. Throws with a readable message. */
export async function readBuffer(name: string, buf: ArrayBuffer, opts: ReadOptions = {}, nested = false): Promise<SourceDoc[]> {
  switch (formatOf(name)) {
    case "spreadsheet":
      return readSpreadsheet(name, buf);
    case "csv":
      return [delimitedToDoc(name, decodeText(buf))];
    case "text":
      return [textToDoc(name, decodeText(buf))];
    case "json":
      return [jsonToDoc(name, decodeText(buf))];
    case "docx":
      return docxHtmlToDocs(name, await readDocx(buf));
    case "pdf":
      return [await readPdf(name, buf, opts)];
    default:
      return readAny(name, buf, opts, nested);
  }
}

export async function readFiles(files: File[], opts: ReadOptions = {}): Promise<{ docs: SourceDoc[]; files: ReadFile[] }> {
  const docs: SourceDoc[] = [];
  const out: ReadFile[] = [];
  for (const f of files) {
    const buf = await f.arrayBuffer();
    const info: ReadFile = { name: f.name, size: f.size, format: formatOf(f.name), hash: await sha256(buf) };
    try {
      const read = (await readBuffer(f.name, buf, opts)).filter((d) => d.kind !== "text" || d.lines.some((l) => l.text.trim()));
      if (!read.length) info.error = "No text could be found in this file.";
      docs.push(...read);
    } catch (e) {
      info.error = e instanceof Error ? e.message : "Could not read the file.";
    }
    out.push(info);
  }
  return { docs, files: out };
}
