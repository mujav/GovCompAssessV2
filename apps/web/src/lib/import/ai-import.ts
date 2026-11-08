// Runs AI extraction from the browser: an outline call, then the page chunks in parallel
// through /api/frameworks/extract, then a deterministic merge into a reviewable extraction.

import { aiToExtraction, docsToPages, mergeAiNodes, outlinePages, planChunks, type AiNode, type AiOutline, type SourcePage } from "@/lib/engine/ai-extract";
import type { Extraction, SourceDoc } from "@/lib/engine/extract";
import type { AgentPolicy } from "@/lib/assessor/policy";

export interface AiProgress {
  stage: "outline" | "chunks" | "merge";
  done: number;
  total: number;
  nodes: number;
  /** Latest node titles found, for a live preview. */
  recent: string[];
}

export interface AiRun {
  model: string;
  calls: number;
  ms: number;
  usage: { input: number; output: number };
  pages: number;
  chunks: number;
}

export class AiUnavailable extends Error {}

const CONCURRENCY = 16;

async function call<T>(body: object, signal?: AbortSignal): Promise<T & { model: string; ms: number; usage: { input: number; output: number } }> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch("/api/frameworks/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
    const json = await res.json().catch(() => ({ error: `The server answered ${res.status}.` }));
    if (res.ok) return json;
    if (json.code === "no_key") throw new AiUnavailable(json.error);
    // Rate limits and overloads ease off quickly; anything else is reported.
    if ((res.status === 429 || res.status === 529 || res.status >= 500) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 5000 * 2 ** attempt));
      continue;
    }
    throw new Error(json.error ?? `Extraction failed (${res.status}).`);
  }
}

export async function runAiExtraction(
  docs: SourceDoc[],
  ctx: { files: string[]; sheets?: string[]; records: number },
  onProgress: (p: AiProgress) => void,
  signal?: AbortSignal,
  policy?: AgentPolicy,
): Promise<{ ex: Extraction; run: AiRun; outline: AiOutline }> {
  const pages: SourcePage[] = docsToPages(docs);
  if (!pages.length) throw new Error("No readable text in the files. A scanned PDF needs OCR before it can be imported.");
  const files = [...new Set(pages.map((p) => p.file))];
  const run: AiRun = { model: "", calls: 0, ms: 0, usage: { input: 0, output: 0 }, pages: pages.length, chunks: 0 };
  const started = Date.now();
  const tally = (r: { model: string; usage: { input: number; output: number } }) => {
    run.model = r.model;
    run.calls += 1;
    run.usage.input += r.usage.input;
    run.usage.output += r.usage.output;
  };

  onProgress({ stage: "outline", done: 0, total: 1, nodes: 0, recent: [] });
  const o = await call<{ outline: AiOutline }>({ step: "outline", pages: outlinePages(pages), total: { files, pages: pages.length }, policy }, signal);
  tally(o);
  const outline = o.outline;

  const chunks = planChunks(pages, outline);
  run.chunks = chunks.length;
  const results: AiNode[][] = new Array(chunks.length);
  let done = 0;
  let found = 0;
  const recent: string[] = [];
  onProgress({ stage: "chunks", done, total: chunks.length, nodes: outline.nodes.length, recent });

  let next = 0;
  const worker = async () => {
    while (next < chunks.length) {
      const i = next++;
      const r = await call<{ nodes: AiNode[] }>({ step: "chunk", pages: chunks[i], outline, policy }, signal);
      tally(r);
      results[i] = r.nodes;
      done += 1;
      found += r.nodes.length;
      recent.unshift(...r.nodes.filter((n) => n.title).slice(-3).map((n) => `${n.code} ${n.title}`));
      recent.length = Math.min(recent.length, 6);
      onProgress({ stage: "chunks", done, total: chunks.length, nodes: found, recent: [...recent] });
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker));

  onProgress({ stage: "merge", done: chunks.length, total: chunks.length, nodes: found, recent });
  const merged = mergeAiNodes(outline.nodes, results);
  const ex = aiToExtraction(outline, merged, { ...ctx, files: ctx.files.length ? ctx.files : files, pages });
  run.ms = Date.now() - started;
  return { ex, run, outline };
}
