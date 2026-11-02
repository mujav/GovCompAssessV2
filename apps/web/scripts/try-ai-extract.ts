// Dev helper: runs the browser's AI extraction path against a running dev server.
//   npx vite-node --config vitest.config.mts scripts/try-ai-extract.ts <file.pdf> [http://localhost:3300] [out.json]
import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { pdfItemsToDoc, type PdfTextItem } from "../src/lib/engine/extract-sources";
import { checkExtraction, levelCounts } from "../src/lib/engine/extract";

const [file, base = "http://localhost:3300", out] = process.argv.slice(2);
const realFetch = globalThis.fetch;
globalThis.fetch = ((url: string, init?: RequestInit) => realFetch(url.startsWith("/") ? base + url : url, init)) as typeof fetch;
const { runAiExtraction } = await import("../src/lib/import/ai-import");

const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(file)), verbosity: 0 }).promise;
const pages: PdfTextItem[][] = [];
for (let i = 1; i <= doc.numPages; i++) pages.push((await (await doc.getPage(i)).getTextContent()).items as PdfTextItem[]);
const src = pdfItemsToDoc(basename(file), pages);
const { ex, run, outline } = await runAiExtraction([src], { files: [basename(file)], records: src.lines.length }, (p) => console.log(p.stage, `${p.done}/${p.total}`, p.nodes, p.recent[0] ?? ""));
console.log(JSON.stringify({ name: outline.name, levels: ex.levels, counts: levelCounts(ex), run }, null, 1));
const w = checkExtraction(ex);
console.log("warnings", w.length, w.slice(0, 15).map((x) => x.message));
if (out) writeFileSync(out, JSON.stringify(ex, null, 1));
