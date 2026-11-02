// Evidence uploaded on a requirement and the AI assessor's verdict on it. Files are read in
// the browser into numbered text pages (the same readers as the Framework Builder), the
// assessor judges each criterion against those pages, and its citations are checked
// against the text before anyone sees them. The assessor only recommends; L1 decides.

import type { AssessCriterion, AssessInput, AssessResult, EvidenceDoc } from "@/lib/assessor/assessor";
import { docsToPages } from "@/lib/engine/ai-extract";
import { readBuffer } from "@/lib/import/read-files";
import type { ClientRequirement } from "./frameworks";

export interface EvidenceFile {
  id: string;
  name: string;
  size: number;
  uploadedAt: string;
  pages: { page: number; text: string }[];
  /** Characters kept; long files are cut so one assessment stays within limits. */
  chars: number;
  truncated?: boolean;
  /** Why the file could not be read (scanned image, unsupported type…). */
  error?: string;
}

export type AssessRun = AssessResult & { runId: string; model: string; promptVersion: string; ms: number; usage: { input: number; output: number } };

export interface EvidenceState {
  files: EvidenceFile[];
  /** The latest assessment and the files it looked at. */
  run?: AssessRun & { at: string; fileIds: string[] };
  error?: string;
}

export const EMPTY_EVIDENCE: EvidenceState = { files: [] };

export const evidenceKey = (clientId: string, frameworkId: string, code: string) => `evidence.${clientId}.${frameworkId}.${code}`;

/** Used when the requirement does not spell out its own sub-items. */
export const GENERIC_CRITERIA = ["Defined and approved by the right authority", "In place across the entity", "Evidence shows it in use this cycle", "Reviewed and improved on a schedule"];

const MAX_FILE_CHARS = 40000;
const ITEM = /^(?:[ء-ي]|[a-z]|\d{1,2}|[ivx]{1,4})[.)\-–]\s+|^[-•▪●]\s+/i;

/** Criteria the assessor judges: the evidence the requirement asks for, then its sub-items (or generic checks). */
export function criteriaFor(r: Pick<ClientRequirement, "title" | "text" | "evidenceText">): AssessCriterion[] {
  const lines = (r.text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const items = lines.slice(1).filter((l) => ITEM.test(l)).map((l) => l.replace(ITEM, "").trim());
  const points = items.length >= 2 ? items : GENERIC_CRITERIA;
  const expect = r.evidenceText?.trim() || "Current, approved records that cover this point";
  const list: Omit<AssessCriterion, "id">[] = [
    ...(r.evidenceText?.trim() ? [{ text: `The evidence the requirement asks for is provided: ${r.evidenceText.trim()}`, expect, fail: "The requested evidence is missing, outdated or unapproved", mandatory: true }] : []),
    ...points.map((t) => ({ text: t, expect, fail: "No current-cycle evidence covers this point", mandatory: false })),
  ];
  return list.map((c, i) => ({ ...c, id: `C${i + 1}` }));
}

export function assessInput(r: ClientRequirement, files: EvidenceFile[], cycle = "2026"): AssessInput {
  const lines = (r.text ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const evidence: EvidenceDoc[] = files.filter((f) => !f.error && f.pages.length).map((f) => ({ id: f.id, name: f.name, pages: f.pages }));
  return {
    code: r.code,
    title: r.title,
    requirement: lines[0] ?? r.title,
    implementation: lines.slice(1).join("\n") || r.title,
    cycle,
    criteria: criteriaFor(r),
    evidence,
  };
}

let seq = 0;

/** Reads one uploaded file into text pages. Never throws: unreadable files come back with an error. */
export async function readEvidenceFile(file: File): Promise<EvidenceFile> {
  const base: EvidenceFile = {
    id: `F${Date.now().toString(36).slice(-4).toUpperCase()}${(seq++).toString(36).toUpperCase()}`,
    name: file.name,
    size: file.size,
    uploadedAt: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    pages: [],
    chars: 0,
  };
  try {
    const docs = await readBuffer(file.name, await file.arrayBuffer());
    let left = MAX_FILE_CHARS;
    const pages: EvidenceFile["pages"] = [];
    for (const p of docsToPages(docs)) {
      if (left <= 0) break;
      const text = p.text.slice(0, left);
      pages.push({ page: pages.length + 1, text });
      left -= text.length;
    }
    const chars = pages.reduce((a, p) => a + p.text.length, 0);
    if (!chars) return { ...base, error: "No text found. A scanned image or photo needs OCR before it can be assessed." };
    return { ...base, pages, chars, truncated: left <= 0 };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "The file could not be read." };
  }
}

export class AssessorUnavailable extends Error {}

export async function requestAssessment(input: AssessInput, signal?: AbortSignal): Promise<AssessRun> {
  const res = await fetch("/api/assessor", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input }), signal });
  const json = await res.json().catch(() => ({ error: `The server answered ${res.status}.` }));
  if (res.ok) return json as AssessRun;
  if (json.code === "no_key") throw new AssessorUnavailable(json.error);
  throw new Error(json.error ?? `The assessment failed (${res.status}).`);
}
