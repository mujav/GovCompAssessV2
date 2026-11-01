// Reads uploaded framework files in the browser and turns them into extraction sources.
// The parsers load on demand, so the Framework Builder page does not ship them up front.

import type { SourceDoc } from "@/lib/engine/extract";
import { delimitedToDoc, docxHtmlToDocs, formatOf, jsonToDoc, pdfItemsToDoc, rowsToDoc, textToDoc, type PdfTextItem, type SourceFormat } from "@/lib/engine/extract-sources";

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

async function readPdf(buf: ArrayBuffer): Promise<PdfTextItem[][]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc ||= new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: PdfTextItem[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.flatMap((it) => ("str" in it ? [{ str: it.str, transform: it.transform, height: it.height }] : [])));
  }
  await doc.destroy();
  return pages;
}

/** Converts one file's bytes into source documents. Throws with a readable message. */
export async function readBuffer(name: string, buf: ArrayBuffer): Promise<SourceDoc[]> {
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
      return [pdfItemsToDoc(name, await readPdf(buf))];
    default:
      throw new Error("Unsupported file type. Use Excel, CSV, PDF, Word (.docx), text, Markdown or JSON.");
  }
}

export async function readFiles(files: File[]): Promise<{ docs: SourceDoc[]; files: ReadFile[] }> {
  const docs: SourceDoc[] = [];
  const out: ReadFile[] = [];
  for (const f of files) {
    const buf = await f.arrayBuffer();
    const info: ReadFile = { name: f.name, size: f.size, format: formatOf(f.name), hash: await sha256(buf) };
    try {
      const read = await readBuffer(f.name, buf);
      if (!read.length) info.error = "No readable content.";
      docs.push(...read);
    } catch (e) {
      info.error = e instanceof Error ? e.message : "Could not read the file.";
    }
    out.push(info);
  }
  return { docs, files: out };
}
