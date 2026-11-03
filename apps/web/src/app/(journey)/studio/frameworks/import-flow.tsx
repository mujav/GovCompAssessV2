"use client";

// Framework Builder file import: upload → extract (Claude, or the rule-based engine) →
// review and edit the result → create the framework. Claude only proposes the tree; merging
// and checks are deterministic (src/lib/engine), and the admin edits everything before it is
// created. A new framework is published at once; a new version of an existing one becomes a
// draft that goes through four-eyes approval.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, cx } from "@/components/ui";
import { diffRequirements, requirementSummary } from "@/lib/admin/diff";
import { findDuplicate, findVersionClash } from "@/lib/admin/library";
import { useAdmin, type ImportTarget } from "@/lib/admin/store";
import type { FrameworkRequirement, LevelAssessment } from "@/lib/admin/types";
import {
  addNode,
  adoptOrphan,
  applyDefaultWeight,
  checkExtraction,
  deleteNode,
  dismissOrphan,
  extractFramework,
  formatLoc,
  levelCounts,
  mergeDuplicates,
  mergeNodes,
  setWeighting,
  toFrameworkDraft,
  treeOrder,
  updateLevel,
  updateNode,
  validateCodeRegex,
  type ExtractWarning,
  type ExtractedNode,
  type Extraction,
  type SourceDoc,
  type WarningKind,
} from "@/lib/engine/extract";
import { ACCEPTED_EXTENSIONS } from "@/lib/engine/extract-sources";
import { AiUnavailable, runAiExtraction, type AiProgress, type AiRun } from "@/lib/import/ai-import";
import { shortHash, type ReadFile } from "@/lib/import/read-files";

export const ASSESSED: Record<LevelAssessment, string> = {
  rollup: "Roll-up only",
  accepted: "Accepted here",
  ai_reviewer: "AI + reviewer",
};

export const inputCls = "box-border h-10 w-full rounded-lg border border-field px-2.5 disabled:bg-surface-2 disabled:text-ink-2";

const WEIGHT_LABEL: Record<string, string> = { high: "High", med: "Medium", low: "Low" };
export const weightLabel = (w?: string) => (w ? (WEIGHT_LABEL[w] ?? w) : "—");

const FORMAT_LABEL: Record<string, string> = { spreadsheet: "Excel", csv: "CSV", pdf: "PDF", docx: "Word", text: "Text", json: "JSON" };

const SAMPLES = [
  ["qiyas-2026-v1.3.xlsx", "Qiyas v1.3 (Excel)"],
  ["nca-ecc-controls.csv", "Cyber controls (CSV)"],
  ["cloud-security-standard.pdf", "Cloud standard (PDF)"],
  ["privacy-controls.docx", "Privacy controls (Word)"],
  ["national-data-index.md", "Data index (Markdown)"],
  ["digital-services-index.txt", "Services index (text)"],
  ["ai-ethics-index.json", "AI ethics index (JSON)"],
];

/* ---------- Upload ---------- */

export function UploadZone({ onFiles, busy, disabled, note }: { onFiles: (files: File[]) => void; busy?: boolean; disabled?: string; note?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const loadSample = async (name: string) => {
    setLoading(name);
    try {
      const res = await fetch(`/samples/${name}`);
      const blob = await res.blob();
      onFiles([new File([blob], name, { type: blob.type })]);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          if (!disabled && e.dataTransfer.files.length) onFiles([...e.dataTransfer.files]);
        }}
        className={cx(
          "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-5 py-6 text-center text-[13px]",
          over ? "border-brand bg-brand-tint" : "border-field bg-surface-2",
          disabled && "opacity-60",
        )}
      >
        <b className="text-sm">{busy ? "Reading files…" : "Drop the standard document here"}</b>
        <span className="text-muted">PDF, Word (.docx), Excel or CSV, text or Markdown, JSON, in Arabic or English. Several files are combined into one standard.</span>
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          className="sr-only"
          aria-label="Choose requirement files"
          onChange={(e) => {
            if (e.target.files?.length) onFiles([...e.target.files]);
            e.target.value = "";
          }}
        />
        <Button variant="primary" size="md" disabled={!!disabled || busy} onClick={() => input.current?.click()}>
          Choose files
        </Button>
        {disabled && <span className="text-xs text-warn">{disabled}</span>}
        {note && !disabled && <span className="text-xs text-muted">{note}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        Try a sample:
        {SAMPLES.map(([file, label]) => (
          <Button key={file} size="sm" variant="chip" className="h-8 text-xs" disabled={!!disabled || busy || !!loading} onClick={() => loadSample(file)}>
            {loading === file ? "Loading…" : label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Review ---------- */

const KIND_LABEL: Record<WarningKind, string> = {
  duplicate: "Duplicate codes",
  missing_parent: "Missing parents",
  orphan: "Rows without a code",
  missing_weight: "Missing weights",
  pattern: "Code pattern mismatches",
  empty: "Empty nodes",
};

function prettyName(file: string) {
  const base = file.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
  return base ? base[0].toUpperCase() + base.slice(1) : "Imported standard";
}

export type ExtractMethod = "ai" | "rules";

export interface ImportSession {
  files: ReadFile[];
  docs: SourceDoc[];
  target: ImportTarget;
  method: ExtractMethod;
}

const STEPS = ["Upload", "Extract", "Review and edit", "Create"];

function Steps({ at }: { at: number }) {
  return (
    <ol className="m-0 flex list-none flex-wrap items-center gap-2 p-0 text-[13px]">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span className={cx("rounded-full px-2.5 py-1 font-semibold", i < at ? "bg-good-soft text-good" : i === at ? "bg-brand text-white" : "border border-field text-ink-2")}>
            {i < at ? "✓ " : `${i + 1} · `}
            {s}
          </span>
          {i < STEPS.length - 1 && <span aria-hidden="true">→</span>}
        </li>
      ))}
    </ol>
  );
}

function FileChips({ files }: { files: ReadFile[] }) {
  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0 text-xs">
      {files.map((f) => (
        <li key={f.name + f.hash} className={cx("rounded-lg border px-2.5 py-1.5", f.error ? "border-bad-line bg-bad-soft text-bad" : "border-line bg-surface-2")}>
          <b>{f.name}</b> · {FORMAT_LABEL[f.format ?? ""] ?? "unknown"} · {f.size > 1024 * 1024 ? `${(f.size / 1024 / 1024).toFixed(1)} MB` : `${(f.size / 1024).toFixed(1)} KB`}
          {f.error ? ` · ${f.error}` : ` · SHA-256 ${shortHash(f.hash)}`}
        </li>
      ))}
    </ul>
  );
}

interface Extracted {
  ex: Extraction;
  method: ExtractMethod;
  run?: AiRun;
  note?: string;
}

function rulesResult(session: ImportSession, note?: string): Extracted {
  return { ex: extractFramework(session.docs), method: "rules", note };
}

/** Runs the extraction for a session, shows progress, then hands the result to the review. */
export function ImportFlow({ session, onAccepted, onCancel }: { session: ImportSession; onAccepted: (id: string, message: string) => void; onCancel: () => void }) {
  const [result, setResult] = useState<Extracted | null>(() => (session.method === "rules" ? rulesResult(session) : null));
  const [progress, setProgress] = useState<AiProgress | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(Date.now());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (result || failed) return;
    const ctrl = new AbortController();
    started.current = Date.now();
    const timer = setInterval(() => setNow(Date.now()), 1000);
    const files = session.files.filter((f) => !f.error).map((f) => f.name);
    const records = session.docs.reduce((a, d) => a + (d.kind === "text" ? d.lines.length : d.kind === "table" ? d.rows.length : d.items.length), 0);
    const sheets = session.docs.flatMap((d) => (d.kind === "table" && d.sheet ? [d.sheet] : []));
    runAiExtraction(session.docs, { files, sheets, records }, setProgress, ctrl.signal)
      .then(({ ex, run }) => setResult({ ex, method: "ai", run }))
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        // No silent fallback: on a long document the rule-based engine also picks up contents
        // pages, annexes and glossaries, so the admin chooses it knowingly.
        if (e instanceof AiUnavailable) setFailed(`${e.message} Ask the platform administrator to set the Claude API key, or use the rule-based engine for documents with clear requirement codes.`);
        else setFailed(e instanceof Error ? e.message : "The extraction failed.");
      })
      .finally(() => clearInterval(timer));
    return () => {
      ctrl.abort();
      clearInterval(timer);
    };
  }, [session, result, failed, attempt]);

  if (result) return <ImportReview session={session} extracted={result} onAccepted={onAccepted} onCancel={onCancel} />;

  const pct = !progress ? 2 : progress.stage === "outline" ? 6 : progress.stage === "merge" ? 100 : 8 + Math.round((92 * progress.done) / Math.max(progress.total, 1));
  const secs = Math.round((now - started.current) / 1000);
  return (
    <section aria-label="Extracting" className="flex flex-col gap-4 rounded-[14px] border border-line bg-white px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Steps at={1} />
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      <FileChips files={session.files} />
      {failed ? (
        <div className="flex flex-col gap-3">
          <div role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
            Claude could not read the file: {failed}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setFailed(null);
                setProgress(null);
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </Button>
            <Button size="md" onClick={() => setResult(rulesResult(session, "Extracted with the rule-based engine: check for contents, annex or glossary entries and delete them."))}>
              Use the rule-based engine
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3" aria-live="polite">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-base font-semibold">
              {!progress || progress.stage === "outline"
                ? "Claude is reading the table of contents and working out the hierarchy…"
                : progress.stage === "chunks"
                  ? `Claude is extracting standards, requirements and evidence from ${progress.total} parts…`
                  : "Building the tree…"}
            </h2>
            <span className="font-mono text-xs text-muted">{secs}s</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Extraction progress">
            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-[13px] text-muted">
            {progress?.stage === "chunks" ? `${progress.done} of ${progress.total} parts read · ${progress.nodes} nodes found so far. ` : ""}
            Large documents take a few minutes. Parts are read in parallel; you review and edit everything before the standard is created.
          </div>
          {!!progress?.recent.length && (
            <ul className="m-0 flex list-none flex-col gap-1 rounded-lg bg-surface-2 p-3 text-[13px]" dir="auto">
              {progress.recent.map((r, i) => (
                <li key={`${r}-${i}`} className="truncate" dir="auto">
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function ImportReview({ session, extracted, onAccepted, onCancel }: { session: ImportSession; extracted: Extracted; onAccepted: (id: string, message: string) => void; onCancel: () => void }) {
  const { state, user, importFramework } = useAdmin();
  const [regex, setRegex] = useState("");
  const [ex, setEx] = useState<Extraction>(extracted.ex);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const firstFile = session.files.find((f) => !f.error)?.name ?? session.files[0]?.name ?? "file";
  const [target, setTarget] = useState<"version" | "new">(session.target.kind);
  const [versionOf, setVersionOf] = useState(session.target.kind === "version" ? session.target.id : (state.frameworks[0]?.id ?? ""));
  const [newName, setNewName] = useState(session.target.kind === "new" && session.target.name ? session.target.name : (ex.meta.name ?? prettyName(firstFile)));
  const [newAuthority, setNewAuthority] = useState(ex.meta.authority ?? "Internal");
  const [newVersion, setNewVersion] = useState(ex.meta.version ?? "1.0");
  const add = (parentId: string | null) => {
    const r = addNode(ex, parentId);
    apply(r.ex);
    if (parentId) setCollapsed((c) => new Set([...c].filter((id) => id !== parentId)));
    setEditing(r.id);
    requestAnimationFrame(() => document.getElementById(`node-${r.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  };

  const warnings = useMemo(() => checkExtraction(ex), [ex]);
  const counts = useMemo(() => levelCounts(ex), [ex]);
  const order = useMemo(() => treeOrder(ex), [ex]);
  const draft = useMemo(() => toFrameworkDraft(ex), [ex]);
  const byNode = useMemo(() => {
    const m = new Map<string, ExtractWarning[]>();
    for (const w of warnings) if (w.nodeId) m.set(w.nodeId, [...(m.get(w.nodeId) ?? []), w]);
    return m;
  }, [warnings]);
  const firstByCode = useMemo(() => {
    const m = new Map<string, ExtractedNode>();
    for (const n of ex.nodes) if (!m.has(n.code.toUpperCase())) m.set(n.code.toUpperCase(), n);
    return m;
  }, [ex]);

  const pkg = state.frameworks.find((f) => f.id === versionOf);
  const compareTo = target === "version" ? pkg?.live?.requirements : undefined;
  const reqDiff = useMemo(() => diffRequirements(compareTo, draft.requirements), [compareTo, draft.requirements]);

  const apply = (next: Extraction) => {
    setEx(next);
    setError(null);
  };

  const rerun = () => {
    const err = validateCodeRegex(regex);
    if (err) return setError(`Code pattern: ${err}`);
    const next = extractFramework(session.docs, { codeRegex: regex });
    if (!next.nodes.length) return setError("No requirement codes found with that pattern. The previous result is kept.");
    setSelected(new Set());
    setEditing(null);
    apply(next);
  };

  const focus = (id: string) => {
    const byId = new Map(ex.nodes.map((n) => [n.id, n]));
    setCollapsed((c) => {
      const next = new Set(c);
      let p = byId.get(id)?.parentId;
      while (p) {
        next.delete(p);
        p = byId.get(p)?.parentId;
      }
      return next;
    });
    setQuery("");
    setEditing(id);
    requestAnimationFrame(() => document.getElementById(`node-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
  };

  // Rows to show: search matches with their ancestors, minus collapsed subtrees.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byId = new Map(ex.nodes.map((n) => [n.id, n]));
    let keep: Set<string> | null = null;
    if (q) {
      keep = new Set();
      for (const n of ex.nodes) {
        if (!`${n.code} ${n.title} ${n.text}`.toLowerCase().includes(q)) continue;
        let cur: ExtractedNode | undefined = n;
        while (cur && !keep.has(cur.id)) {
          keep.add(cur.id);
          cur = cur.parentId ? byId.get(cur.parentId) : undefined;
        }
      }
    }
    const out: typeof order = [];
    let hideBelow = Infinity;
    for (const row of order) {
      if (row.depth > hideBelow) continue;
      hideBelow = Infinity;
      if (keep && !keep.has(row.node.id)) continue;
      out.push(row);
      if (!keep && collapsed.has(row.node.id)) hideBelow = row.depth;
    }
    return out;
  }, [order, collapsed, query, ex.nodes]);
  const hasKids = useMemo(() => new Set(ex.nodes.map((n) => n.parentId).filter(Boolean) as string[]), [ex.nodes]);

  const fileHashes = useMemo(() => session.files.filter((f) => !f.error && f.hash).map((f) => f.hash), [session.files]);
  const duplicate = useMemo(
    () =>
      target === "new"
        ? findDuplicate(state.frameworks, { name: newName, hashes: fileHashes })
        : pkg
          ? (findVersionClash(pkg, { hashes: fileHashes }) ?? findDuplicate(state.frameworks, { hashes: fileHashes, exceptId: pkg.id }))
          : null,
    [target, newName, pkg, state.frameworks, fileHashes],
  );

  const levelsOk = ex.levels.every((l) => l.en.trim() && l.ar.trim() && l.pattern.trim());
  const acceptedOk = ex.levels.some((l) => l.assessed === "accepted");
  const blockers = [
    !ex.nodes.length && "No requirements were found in the files",
    warnings.length > 0 && `Fix or dismiss ${warnings.length} warning${warnings.length > 1 ? "s" : ""}`,
    !levelsOk && "Every level needs English and Arabic labels and a code pattern",
    !acceptedOk && 'Mark one level as "Accepted here"',
    target === "version" && pkg?.pendingCr && `${(pkg.draft ?? pkg.live)?.name} is waiting on ${pkg.pendingCr}`,
    target === "new" && !newName.trim() && "Name the new standard",
    duplicate && "Already in the library",
  ].filter((x): x is string => !!x);

  const accept = () => {
    if (blockers.length) return;
    const readable = session.files.filter((f) => !f.error);
    const hashes = readable.map((f) => f.hash).filter(Boolean);
    const changed = target === "version" ? requirementSummary(reqDiff) : `${draft.requirements.length} new`;
    const payload = {
      levels: draft.levels,
      requirements: draft.requirements,
      weighting: draft.weighting,
      importJob: {
        file: readable.map((f) => f.name).join(", "),
        tab: ex.sheets.join(", ") || [...new Set(readable.map((f) => FORMAT_LABEL[f.format ?? ""] ?? "file"))].join(", "),
        rows: ex.records,
        uploadedBy: user.name,
        hash: hashes.length ? shortHash(hashes[0]) + (hashes.length > 1 ? ` +${hashes.length - 1}` : "") : "—",
        valid: draft.requirements.length,
        warnings: [],
        changed,
        errors: session.files.filter((f) => f.error).length,
      },
      fileHashes,
    };
    const t: ImportTarget = target === "version" ? { kind: "version", id: versionOf } : { kind: "new", name: newName, authority: newAuthority, version: newVersion };
    const r = importFramework(t, payload);
    if (!r.ok) return setError(r.error);
    onAccepted(
      r.id!,
      target === "new"
        ? `Created and published ${newName.trim()} v${newVersion.trim() || "1.0"} with ${draft.requirements.length} requirement nodes.`
        : `Imported ${draft.requirements.length} requirement nodes into the draft (${changed}). Check the validation, then submit for approval.`,
    );
  };

  const sel = [...selected].filter((id) => ex.nodes.some((n) => n.id === id));
  const selOrdered = order.filter((r) => selected.has(r.node.id)).map((r) => r.node.id);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Import progress" className="flex flex-col gap-3 rounded-[14px] border border-line bg-white px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Steps at={2} />
          <Button onClick={onCancel}>Cancel import</Button>
        </div>
        <FileChips files={session.files} />
        <div className="text-xs text-muted">
          {extracted.method === "ai" && extracted.run
            ? `Extracted by Claude (${extracted.run.model}) from ${extracted.run.pages} pages in ${extracted.run.chunks} parts · ${Math.round(extracted.run.ms / 1000)}s · ${ex.nodes.length} nodes. The tree, codes and parents are checked by the platform's rules; review the text against the document before creating.`
            : `${ex.records} source rows or lines read${ex.sheets.length ? ` · sheets used: ${ex.sheets.join(", ")}` : ""} · ${ex.nodes.length} nodes found. Rule-based detection (codes, numbering, column headers): the same file always gives the same result.`}
        </div>
        {extracted.note && <div className="rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn">{extracted.note}</div>}
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[999_1_620px] flex-col gap-4">
          <section aria-label="Detected levels" className="flex flex-col gap-2.5 rounded-[14px] border border-line bg-white px-5 py-4">
            <h2 className="m-0 text-base font-semibold">Hierarchy levels</h2>
            <div className="overflow-x-auto">
              <div role="table" aria-label="Detected levels" className="min-w-[640px] text-[13px]">
                <div role="row" className="grid gap-2.5 border-b border-line py-2 text-xs font-semibold text-muted" style={{ gridTemplateColumns: LEVEL_COLS }}>
                  <span role="columnheader">Level</span>
                  <span role="columnheader">English label</span>
                  <span role="columnheader">Arabic label</span>
                  <span role="columnheader">Code pattern</span>
                  <span role="columnheader">Assessed here</span>
                  <span role="columnheader" className="text-end">
                    Nodes
                  </span>
                </div>
                {ex.levels.map((l, i) => (
                  <div role="row" key={l.id} className="grid items-center gap-2.5 border-b border-line-soft py-2" style={{ gridTemplateColumns: LEVEL_COLS }}>
                    <span role="cell" className="font-mono font-semibold">
                      {i + 1}
                    </span>
                    <span role="cell">
                      <input value={l.en} onChange={(e) => apply(updateLevel(ex, i, { en: e.target.value }))} aria-label={`English label, level ${i + 1}`} className={cx(inputCls, "text-[13px]", !l.en.trim() && "border-bad")} />
                    </span>
                    <span role="cell">
                      <input
                        value={l.ar}
                        onChange={(e) => apply(updateLevel(ex, i, { ar: e.target.value }))}
                        dir="rtl"
                        lang="ar"
                        placeholder="مطلوب"
                        aria-label={`Arabic label, level ${i + 1}`}
                        className={cx(inputCls, "text-sm", !l.ar.trim() && "border-bad")}
                      />
                    </span>
                    <span role="cell">
                      <input value={l.pattern} onChange={(e) => apply(updateLevel(ex, i, { pattern: e.target.value }))} aria-label={`Code pattern, level ${i + 1}`} className={cx(inputCls, "font-mono text-xs")} />
                    </span>
                    <span role="cell">
                      <select value={l.assessed} onChange={(e) => apply(updateLevel(ex, i, { assessed: e.target.value as LevelAssessment }))} aria-label={`Assessed at level ${i + 1}`} className={cx(inputCls, "bg-white text-xs")}>
                        {Object.entries(ASSESSED).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </span>
                    <span role="cell" className="text-end font-mono font-semibold">
                      {counts[i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="text-xs text-muted">
              In a code pattern <span className="font-mono">#</span> stands for a number, e.g. <span className="font-mono">#.#.#-#</span> or <span className="font-mono">ECC #-#-#</span>. Codes that
              do not match their level&apos;s pattern are listed as warnings.
            </div>
            {extracted.method === "rules" && (
            <details className="text-[13px]">
              <summary className="cursor-pointer font-semibold">Requirement codes look different? Set the code expression</summary>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs font-semibold text-muted">
                  Regular expression matched at the start of each cell or line
                  <input value={regex} onChange={(e) => setRegex(e.target.value)} placeholder="e.g. REQ-\d{3} or §\s?\d+(\.\d+)*" className={cx(inputCls, "font-mono text-xs font-normal text-ink")} />
                </label>
                <Button size="md" onClick={rerun}>
                  Re-run detection
                </Button>
              </div>
              <div className="mt-1 text-xs text-muted">Leave empty for the built-in detector. Re-running starts the review again and discards edits.</div>
            </details>
            )}
          </section>

          <section aria-label="Requirement tree" className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-3">
              <h2 className="m-0 text-base font-semibold">
                Requirement tree <span className="text-[13px] font-normal text-muted">· {ex.nodes.length} nodes</span>
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search code or text" aria-label="Search requirements" className="h-9 w-52 rounded-lg border border-field px-2.5 text-[13px]" />
                <Button size="sm" onClick={() => setCollapsed(new Set())}>
                  Expand all
                </Button>
                <Button size="sm" onClick={() => setCollapsed(new Set([...hasKids]))}>
                  Collapse all
                </Button>
                <Button size="sm" onClick={() => add(null)}>
                  + Top-level node
                </Button>
              </div>
            </div>
            {sel.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-brand-tint px-5 py-2 text-[13px]">
                <b>{sel.length} selected</b>
                <Button
                  size="sm"
                  disabled={sel.length < 2}
                  onClick={() => {
                    apply(mergeNodes(ex, selOrdered[0], selOrdered.slice(1)));
                    setSelected(new Set());
                  }}
                >
                  Merge into {ex.nodes.find((n) => n.id === selOrdered[0])?.code}
                </Button>
                <Button
                  size="sm"
                  className="text-bad"
                  onClick={() => {
                    let next = ex;
                    for (const id of sel) next = deleteNode(next, id);
                    apply(next);
                    setSelected(new Set());
                  }}
                >
                  Delete with children
                </Button>
                <Button size="sm" variant="chip" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </div>
            )}
            <ul className="m-0 max-h-[640px] list-none overflow-y-auto p-0 text-[13px]" aria-label="Requirements">
              {visible.map(({ node: n, depth }) => (
                <li key={n.id} id={`node-${n.id}`} className="border-b border-line-soft">
                  <div className={cx("flex items-start gap-2 py-1.5 pe-4", byNode.has(n.id) && "bg-warn-soft/40", editing === n.id && "bg-brand-tint")} style={{ paddingInlineStart: 12 + depth * 22 }}>
                    <button
                      type="button"
                      aria-label={collapsed.has(n.id) ? `Expand ${n.code}` : `Collapse ${n.code}`}
                      aria-expanded={hasKids.has(n.id) ? !collapsed.has(n.id) : undefined}
                      disabled={!hasKids.has(n.id)}
                      onClick={() =>
                        setCollapsed((c) => {
                          const next = new Set(c);
                          if (next.has(n.id)) next.delete(n.id);
                          else next.add(n.id);
                          return next;
                        })
                      }
                      className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded border-0 bg-transparent text-muted disabled:invisible"
                    >
                      {collapsed.has(n.id) ? "▸" : "▾"}
                    </button>
                    <input
                      type="checkbox"
                      checked={selected.has(n.id)}
                      onChange={(e) =>
                        setSelected((s) => {
                          const next = new Set(s);
                          if (e.target.checked) next.add(n.id);
                          else next.delete(n.id);
                          return next;
                        })
                      }
                      aria-label={`Select ${n.code}`}
                      className="mt-1.5 shrink-0"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <b className="font-mono text-xs">{n.code}</b>
                        <span dir="auto" className={cx("min-w-0", !n.title && "italic text-muted")}>
                          {n.title || (n.placeholder ? "Missing parent: not in the file" : n.text ? "" : "No title")}
                        </span>
                        <Badge tone="gray">{ex.levels[depth]?.en ?? `Level ${depth + 1}`}</Badge>
                        {n.evidence && <Badge tone="na">Evidence</Badge>}
                        {byNode.get(n.id)?.map((w) => (
                          <Badge key={w.id} tone="warn">
                            {KIND_LABEL[w.kind].replace(/s$/, "").replace("Missing weight", "No weight")}
                          </Badge>
                        ))}
                      </div>
                      {n.text && editing !== n.id && (
                        <div dir="auto" className={cx("whitespace-pre-line", n.title ? "line-clamp-2 text-xs text-ink-2" : "line-clamp-3 text-[13px] text-ink")}>
                          {n.text}
                        </div>
                      )}
                      <div className="text-[11px] text-muted">{formatLoc(n.loc)}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" className="h-8 px-2 text-xs" onClick={() => setEditing(editing === n.id ? null : n.id)} aria-label={`Edit ${n.code}`}>
                        Edit
                      </Button>
                      <Button size="sm" className="h-8 px-2 text-xs" onClick={() => add(n.id)} aria-label={`Add a child under ${n.code}`}>
                        + Child
                      </Button>
                      <Button size="sm" className="h-8 px-2 text-xs text-bad" onClick={() => apply(deleteNode(ex, n.id))} aria-label={`Delete ${n.code}`}>
                        Delete
                      </Button>
                    </div>
                  </div>
                  {editing === n.id && (
                    <NodeEditor
                      key={`${n.id}-${n.code}-${n.title}`}
                      node={n}
                      onCancel={() => setEditing(null)}
                      onSave={(patch) => {
                        apply(updateNode(ex, n.id, patch));
                        setEditing(null);
                      }}
                    />
                  )}
                </li>
              ))}
              {visible.length === 0 && <li className="px-5 py-6 text-muted">{query ? "No node matches the search." : "No requirements found."}</li>}
            </ul>
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <section aria-label="Accept" className="flex flex-col gap-3 rounded-[14px] border-2 border-brand bg-white p-[18px] text-[13px]">
            <h2 className="m-0 text-base font-semibold">{target === "new" ? "Create the standard" : "Save as a new version"}</h2>
            <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
              <legend className="mb-1 text-xs font-semibold text-muted">Import as</legend>
              <label className="flex items-center gap-2">
                <input type="radio" name="target" checked={target === "version"} onChange={() => setTarget("version")} />
                New version of an existing standard
              </label>
              {target === "version" && (
                <select value={versionOf} onChange={(e) => setVersionOf(e.target.value)} aria-label="Framework" className={cx(inputCls, "ms-6 w-[calc(100%-24px)] bg-white text-[13px]")}>
                  {state.frameworks.map((f) => {
                    const w = f.draft ?? f.live!;
                    return (
                      <option key={f.id} value={f.id}>
                        {w.name} · {f.draft ? `draft v${f.draft.version}` : `v${f.live?.version} live → new draft`}
                        {f.pendingCr ? ` · in review (${f.pendingCr})` : ""}
                      </option>
                    );
                  })}
                </select>
              )}
              <label className="flex items-center gap-2">
                <input type="radio" name="target" checked={target === "new"} onChange={() => setTarget("new")} />
                New standard or index (published right away)
              </label>
              {target === "new" && (
                <div className="ms-6 grid grid-cols-[1fr_90px] gap-2">
                  <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold text-muted">
                    Name
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} className={cx(inputCls, "text-[13px] font-normal text-ink")} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                    Issuing authority
                    <input value={newAuthority} onChange={(e) => setNewAuthority(e.target.value)} className={cx(inputCls, "text-[13px] font-normal text-ink")} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
                    Version
                    <input value={newVersion} onChange={(e) => setNewVersion(e.target.value)} className={cx(inputCls, "text-[13px] font-normal text-ink")} />
                  </label>
                </div>
              )}
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <SummaryRow label="Levels" value={ex.levels.map((l) => l.en || "?").join(" › ") || "—"} />
              <SummaryRow label="Requirement nodes" value={String(draft.requirements.length)} />
              {target === "version" && (
                <SummaryRow
                  label={`vs live ${pkg?.live ? `v${pkg.live.version}` : "(none)"}`}
                  value={pkg?.live?.requirements?.length ? requirementSummary(reqDiff) : pkg?.live ? "live version has no requirement list" : "first version"}
                />
              )}
            </div>
            {target === "version" && pkg?.live?.requirements?.length ? (
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge tone="ok">+{reqDiff.added.length} added</Badge>
                <Badge tone="warn">~{reqDiff.changed.length} changed</Badge>
                <Badge tone="bad">−{reqDiff.removed.length} removed</Badge>
              </div>
            ) : null}

            {duplicate && (
              <div role="alert" className="flex flex-col gap-2 rounded-lg border border-warn-line bg-warn-soft px-3 py-2.5 text-[13px] text-ink">
                <b className="text-warn">Already in the library</b>
                <span dir="auto">{duplicate.message}</span>
                {target === "new" && duplicate.reason === "same_name" && (
                  <Button
                    size="sm"
                    className="self-start"
                    onClick={() => {
                      setTarget("version");
                      setVersionOf(duplicate.pkgId);
                    }}
                  >
                    Add as a new version of {duplicate.name}
                  </Button>
                )}
              </div>
            )}
            {blockers.length > 0 && (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] text-bad">
                {blockers.map((b) => (
                  <li key={b}>✕ {b}</li>
                ))}
              </ul>
            )}
            {error && (
              <div role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-bad">
                {error}
              </div>
            )}
            <Button variant="primary" className="px-4" disabled={blockers.length > 0} onClick={accept} aria-disabled={blockers.length > 0}>
              {target === "new" ? "Create standard" : "Save into draft"}
            </Button>
            <div className="text-xs leading-[18px] text-muted">
              {target === "new"
                ? "A new standard is not used by any assessment cycle yet, so it is published as soon as you create it. Later changes are made in a new version, which goes through approval."
                : "The live version may be in use by assessment cycles, so the new version is saved as a draft. It goes live after you submit it and another person with approval rights approves it."}
            </div>
          </section>
          <Warnings
            ex={ex}
            warnings={warnings}
            firstByCode={firstByCode}
            apply={apply}
            focus={focus}
          />

        </aside>
      </div>
    </div>
  );
}

const LEVEL_COLS = "44px 1.2fr 1.2fr 1fr 1.1fr 60px";

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-lg bg-surface-2 px-2.5 py-2">
      <span className="text-muted">{label}</span>
      <b className="text-end">{value}</b>
    </div>
  );
}

function NodeEditor({ node, onSave, onCancel }: { node: ExtractedNode; onSave: (patch: Partial<Pick<ExtractedNode, "code" | "title" | "text" | "evidence">>) => void; onCancel: () => void }) {
  const [code, setCode] = useState(node.code);
  const [title, setTitle] = useState(node.title);
  const [text, setText] = useState(node.text);
  const [evidence, setEvidence] = useState(node.evidence ?? "");
  return (
    <form
      className="grid grid-cols-[140px_minmax(0,1fr)] gap-2 border-t border-line-soft bg-brand-tint px-5 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!code.trim()) return;
        onSave({ code, title, text, evidence });
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        Code
        <input value={code} onChange={(e) => setCode(e.target.value)} required className={cx(inputCls, "font-mono text-xs font-normal text-ink")} autoFocus />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} dir="auto" className={cx(inputCls, "text-[13px] font-normal text-ink")} />
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold text-muted">
        Text
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(8, Math.max(3, text.split("\n").length + 1))} dir="auto" className="resize-y rounded-lg border border-field p-2 text-[13px] font-normal leading-5 text-ink" />
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold text-muted">
        Evidence required
        <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={Math.min(6, Math.max(2, evidence.split("\n").length + 1))} dir="auto" className="resize-y rounded-lg border border-field p-2 text-[13px] font-normal leading-5 text-ink" />
      </label>
      <div className="col-span-2 flex gap-2">
        <Button type="submit" variant="primary" size="md">
          Save node
        </Button>
        <Button size="md" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Warnings({
  ex,
  warnings,
  firstByCode,
  apply,
  focus,
}: {
  ex: Extraction;
  warnings: ExtractWarning[];
  firstByCode: Map<string, ExtractedNode>;
  apply: (e: Extraction) => void;
  focus: (id: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [adopting, setAdopting] = useState<{ id: string; code: string } | null>(null);
  const node = (id?: string) => ex.nodes.find((n) => n.id === id);
  const groups = (Object.keys(KIND_LABEL) as WarningKind[]).map((k) => [k, warnings.filter((w) => w.kind === k)] as const).filter(([, ws]) => ws.length);
  const LIMIT = 8;

  return (
    <section aria-label="Warnings" className="flex flex-col gap-3 rounded-[14px] border border-line bg-white p-[18px] text-[13px]">
      <h2 className="m-0 flex items-center justify-between text-base font-semibold">
        Warnings
        <Badge tone={warnings.length ? "warn" : "ok"}>{warnings.length ? `${warnings.length} open` : "none"}</Badge>
      </h2>
      {warnings.length === 0 && <div className="text-good">✓ No duplicates, missing parents or orphan rows.</div>}
      {groups.map(([kind, ws]) => (
        <div key={kind} className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-warn">
              {KIND_LABEL[kind]} · {ws.length}
            </b>
            {kind === "duplicate" && (
              <Button size="sm" className="h-8 text-xs" onClick={() => apply(mergeDuplicates(ex))}>
                Merge all into first
              </Button>
            )}
            {kind === "orphan" && (
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  let next = ex;
                  for (const w of ws) next = dismissOrphan(next, w.orphanId!);
                  apply(next);
                }}
              >
                Dismiss all
              </Button>
            )}
            {kind === "missing_weight" && (
              <span className="flex gap-1.5">
                <Button size="sm" className="h-8 text-xs" onClick={() => apply(applyDefaultWeight(ex))}>
                  Apply Medium to {ws.length === 1 && !ws[0].nodeId ? "all" : ws.length}
                </Button>
                <Button size="sm" className="h-8 text-xs" onClick={() => apply(setWeighting(ex, "none"))}>
                  No weights
                </Button>
              </span>
            )}
          </div>
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {(showAll ? ws : ws.slice(0, LIMIT)).map((w) => {
              const n = node(w.nodeId);
              return (
                <li key={w.id} className="flex flex-col gap-1 rounded-lg bg-warn-soft px-2.5 py-2 text-xs leading-[17px]">
                  <span className="text-ink">{w.message}</span>
                  {w.loc && <span className="text-muted">{formatLoc(w.loc)}</span>}
                  <span className="flex flex-wrap gap-1.5">
                    {kind === "duplicate" && n && (
                      <Fix onClick={() => apply(mergeNodes(ex, firstByCode.get(n.code.toUpperCase())!.id, [n.id]))}>Merge into first</Fix>
                    )}
                    {kind === "missing_parent" && n && <Fix onClick={() => focus(n.id)}>Name it</Fix>}
                    {kind === "missing_parent" && n && <Fix onClick={() => apply(deleteNode(ex, n.id, true))}>Remove, keep children</Fix>}
                    {(kind === "pattern" || kind === "empty" || (kind === "missing_weight" && n)) && n && <Fix onClick={() => focus(n.id)}>Edit {n.code}</Fix>}
                    {(kind === "duplicate" || kind === "empty") && n && <Fix onClick={() => apply(deleteNode(ex, n.id))}>Delete</Fix>}
                    {kind === "orphan" && adopting?.id !== w.orphanId && (
                      <>
                        <Fix onClick={() => setAdopting({ id: w.orphanId!, code: "" })}>Add as node</Fix>
                        <Fix onClick={() => apply(dismissOrphan(ex, w.orphanId!))}>Dismiss</Fix>
                      </>
                    )}
                  </span>
                  {kind === "orphan" && adopting && adopting.id === w.orphanId && (
                    <form
                      className="flex gap-1.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!adopting.code.trim()) return;
                        apply(adoptOrphan(ex, adopting.id, adopting.code));
                        setAdopting(null);
                      }}
                    >
                      <input value={adopting.code} onChange={(e) => setAdopting({ ...adopting, code: e.target.value })} placeholder="Code, e.g. 1.2.3-4" aria-label="Code for the new node" autoFocus className="h-8 min-w-0 flex-1 rounded-md border border-field bg-white px-2 font-mono" />
                      <Fix type="submit">Add</Fix>
                      <Fix onClick={() => setAdopting(null)}>Cancel</Fix>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
          {!showAll && ws.length > LIMIT && (
            <button type="button" onClick={() => setShowAll(true)} className="cursor-pointer self-start border-0 bg-transparent p-0 text-xs font-semibold text-brand underline">
              Show {ws.length - LIMIT} more
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

function Fix({ children, onClick, type = "button" }: { children: React.ReactNode; onClick?: () => void; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} className="h-7 cursor-pointer rounded-md border border-warn-line bg-white px-2 text-xs text-ink hover:bg-surface-2">
      {children}
    </button>
  );
}

/* ---------- Read-only tree of a saved version ---------- */

export function RequirementTree({ requirements, levels }: { requirements: FrameworkRequirement[]; levels: { id: string; en: string }[] }) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(requirements.filter((r) => !r.parent).map((r) => r.code)));
  const [query, setQuery] = useState("");
  const kids = useMemo(() => {
    const m = new Map<string | undefined, FrameworkRequirement[]>();
    const codes = new Set(requirements.map((r) => r.code));
    for (const r of requirements) {
      const p = r.parent && codes.has(r.parent) ? r.parent : undefined;
      m.set(p, [...(m.get(p) ?? []), r]);
    }
    return m;
  }, [requirements]);
  const levelName = (id: string) => levels.find((l) => l.id === id)?.en ?? "—";
  const q = query.trim().toLowerCase();

  const rows: { r: FrameworkRequirement; depth: number }[] = [];
  const walk = (p: string | undefined, depth: number) => {
    for (const r of kids.get(p) ?? []) {
      if (!q || `${r.code} ${r.title}`.toLowerCase().includes(q)) rows.push({ r, depth: q ? 0 : depth });
      if (q || open.has(r.code)) walk(r.code, depth + 1);
    }
  };
  walk(undefined, 0);

  return (
    <div className="flex flex-col overflow-hidden rounded-[10px] border border-line">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft bg-surface-2 px-3 py-2">
        <b className="text-[13px]">Requirements in this version · {requirements.length}</b>
        <div className="flex gap-1.5">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search requirements in this version" className="h-8 w-40 rounded-md border border-field bg-white px-2 text-xs" />
          <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(new Set(requirements.map((r) => r.code)))}>
            Expand all
          </Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => setOpen(new Set())}>
            Collapse
          </Button>
        </div>
      </div>
      <ul className="m-0 max-h-[420px] list-none overflow-y-auto p-0 text-[13px]">
        {rows.map(({ r, depth }) => {
          const has = kids.has(r.code);
          return (
            <li key={r.code} className="flex items-baseline gap-2 border-b border-line-soft py-1.5 pe-3" style={{ paddingInlineStart: 8 + depth * 20 }}>
              <button
                type="button"
                disabled={!has || !!q}
                aria-label={open.has(r.code) ? `Collapse ${r.code}` : `Expand ${r.code}`}
                onClick={() =>
                  setOpen((o) => {
                    const next = new Set(o);
                    if (next.has(r.code)) next.delete(r.code);
                    else next.add(r.code);
                    return next;
                  })
                }
                className="h-6 w-6 shrink-0 cursor-pointer border-0 bg-transparent text-muted disabled:invisible"
              >
                {open.has(r.code) ? "▾" : "▸"}
              </button>
              <b className="shrink-0 font-mono text-xs">{r.code}</b>
              <span className="min-w-0 flex-1" dir="auto">
                {r.title || <span className="line-clamp-2">{r.text}</span>}
                {(r.text || r.evidence) && (
                  <details className="mt-0.5 text-xs text-ink-2">
                    <summary className="cursor-pointer text-muted">Text{r.evidence ? " and evidence" : ""}</summary>
                    {r.text && <div className="whitespace-pre-line">{r.text}</div>}
                    {r.evidence && <div className="mt-1 whitespace-pre-line text-muted">Evidence: {r.evidence}</div>}
                  </details>
                )}
              </span>
              <span className="shrink-0 text-[11px] text-muted">{levelName(r.level)}</span>
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-3 py-4 text-muted">No requirements match.</li>}
      </ul>
    </div>
  );
}
