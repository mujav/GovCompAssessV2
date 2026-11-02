"use client";

import { useEffect, useState } from "react";
import { Checks, DraftBar, LockNote, type CheckItem } from "@/components/admin-ui";
import { PageHeader } from "@/components/journey/studio";
import { Button, TabBar } from "@/components/ui";
import { requirementCounts } from "@/lib/admin/diff";
import { dateStamp, findDuplicate, findVersionClash, nameKey, versionsOf } from "@/lib/admin/library";
import { stamp, useAdmin, working, type ImportTarget } from "@/lib/admin/store";
import type { FrameworkPackage, FrameworkVersion, HierarchyLevel, LevelAssessment } from "@/lib/admin/types";
import { readFiles } from "@/lib/import/read-files";
import { ASSESSED, ImportFlow, RequirementTree, UploadZone, inputCls, type ExtractMethod, type ImportSession } from "./import-flow";

const TABS = [{ label: "Hierarchy" }, { label: "Requirements" }, { label: "Custom fields" }, { label: "Terminology" }];
const LV_COLS = "44px 1.3fr 1.3fr 1fr 1.1fr 92px";

type Notice = { ok: boolean; text: string; open?: { id: string; label: string } };

function frameworkChecks(v: FrameworkVersion, others: FrameworkPackage[]): CheckItem[] {
  const dup = findDuplicate(others, { name: v.name });
  const labelsOk = v.levels.every((l) => l.en.trim() && l.ar.trim());
  const patterns = v.levels.map((l) => l.pattern.trim());
  const patternsOk = patterns.every(Boolean) && new Set(patterns).size === patterns.length;
  const acceptedOk = v.levels.some((l) => l.assessed === "accepted");
  const importOk = !v.importJob || (v.importJob.errors === 0 && v.importJob.warnings.length === 0);
  const reqs = v.requirements ?? [];
  const placedOk = reqs.every((r) => v.levels.some((l) => l.id === r.level));
  const uniqueOk = new Set(reqs.map((r) => r.code)).size === reqs.length;
  const reqChecks: CheckItem[] = reqs.length
    ? [
        { ok: placedOk, text: placedOk ? `${reqs.length} requirement nodes sit on defined levels` : "Some requirements sit on a removed level: re-import or restore the level" },
        { ok: uniqueOk, text: uniqueOk ? "Requirement codes are unique" : "Requirement codes must be unique" },
      ]
    : [];
  return [
    { ok: !dup, text: dup ? `Another framework in the library has this name: ${dup.name}` : "Name is unique in the library" },
    { ok: v.levels.length > 0, text: v.levels.length ? `${v.levels.length} hierarchy levels` : "Add at least one hierarchy level" },
    { ok: labelsOk, text: labelsOk ? "Every level has English and Arabic labels" : "Every level needs English and Arabic labels" },
    { ok: patternsOk, text: patternsOk ? "Code patterns are unique" : "Code patterns must be filled in and unique" },
    { ok: acceptedOk, text: acceptedOk ? "One level is where results are accepted" : "Mark one level as \"Accepted here\"" },
    { ok: importOk, text: importOk ? "Requirements import has no open warnings" : "Resolve import warnings before submitting" },
    ...reqChecks,
  ];
}

export default function FrameworkBuilderPage() {
  const { state, update, editDraft, user } = useAdmin();
  // No framework selected = the start screen: upload a document first, then edit what was extracted.
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState(0);
  const [session, setSession] = useState<ImportSession | null>(null);
  const [reading, setReading] = useState(false);
  const [method, setMethod] = useState<ExtractMethod>("ai");
  const [notice, setNotice] = useState<Notice | null>(null);

  const pkg = state.frameworks.find((f) => f.id === sel);
  const newFramework = () => {
    const id = `fw-${state.seq + 1}`;
    const taken = new Set(state.frameworks.flatMap((f) => [f.live?.name, f.draft?.name]).filter(Boolean).map((n) => nameKey(n!)));
    let name = "New framework";
    for (let i = 2; taken.has(nameKey(name)); i++) name = `New framework ${i}`;
    update((s) => {
      s.seq += 1;
      s.frameworks.push({
        id,
        usedByCycles: 0,
        draft: {
          name,
          version: "0.1",
          authority: "Internal",
          effective: "—",
          createdAt: dateStamp(),
          scoringNote: "Not configured",
          levels: [
            { id: "lv-1", en: "Domain", ar: "المجال", pattern: "#", assessed: "rollup" },
            { id: "lv-2", en: "Control", ar: "الضابط", pattern: "#.#", assessed: "accepted" },
          ],
        },
      });
      s.audit.unshift({ id: `ev-${s.seq}`, at: stamp(), who: user.name, text: `Created framework draft "${name}" v0.1.` });
    });
    setSel(id);
    setTab(0);
  };

  const startImport = async (files: File[], target: ImportTarget) => {
    setReading(true);
    setNotice(null);
    try {
      const read = await readFiles(files);
      if (!read.docs.length) {
        setNotice({ ok: false, text: read.files.map((f) => `${f.name}: ${f.error ?? "no readable content"}`).join(" · ") });
        return;
      }
      // Stop before extraction (which can take minutes) when the document is already in the library.
      const hashes = read.files.filter((f) => !f.error).map((f) => f.hash);
      const target_ = target.kind === "version" ? state.frameworks.find((f) => f.id === target.id) : undefined;
      const dup = target_
        ? (findVersionClash(target_, { hashes }) ?? findDuplicate(state.frameworks, { hashes, exceptId: target_.id }))
        : findDuplicate(state.frameworks, { hashes });
      if (dup) {
        setNotice({ ok: false, text: dup.message, open: target_?.id === dup.pkgId ? undefined : { id: dup.pkgId, label: `Open ${dup.name}` } });
        return;
      }
      setSession({ ...read, target, method });
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "The files could not be read." });
    } finally {
      setReading(false);
    }
  };

  if (session)
    return (
      <>
        <PageHeader crumb="Studio / Framework Builder / New from document" title="Create a framework from a document" />
        <main className="box-border flex w-full max-w-[1360px] flex-col gap-4 px-8 pb-12 pt-6">
          <ImportFlow
            session={session}
            onCancel={() => setSession(null)}
            onAccepted={(id, text) => {
              setSession(null);
              setSel(id);
              setTab(1);
              setNotice({ ok: true, text });
            }}
          />
        </main>
      </>
    );

  if (!pkg) return <StartScreen method={method} setMethod={setMethod} reading={reading} notice={notice} onFiles={(files) => startImport(files, { kind: "new", name: "", authority: "", version: "" })} onOpen={(id) => { setSel(id); setTab(0); setNotice(null); }} onBlank={() => newFramework()} />;

  const { value: fw, locked } = working(pkg);
  if (!fw) return null;
  const edit = (fn: (d: FrameworkVersion) => void) => editDraft<FrameworkVersion>("framework", pkg.id, fn);
  const editLevel = (id: string, patch: Partial<HierarchyLevel>) =>
    edit((d) => {
      const l = d.levels.find((x) => x.id === id);
      if (l) Object.assign(l, patch);
    });
  const checks = frameworkChecks(
    fw,
    state.frameworks.filter((f) => f.id !== pkg.id),
  );


  return (
    <>
      <PageHeader
        crumb="Studio / Framework Builder"
        title={`${fw.name} · v${fw.version}`}
        actions={
          <Button
            onClick={() => {
              setSel(null);
              setNotice(null);
            }}
          >
            ← All frameworks
          </Button>
        }
      />
      <main className="box-border flex w-full max-w-[1360px] flex-col gap-4 px-8 pb-12 pt-6">
        {notice && <NoticeBar notice={notice} onOpen={(id) => { setSel(id); setTab(0); setNotice(null); }} />}
        <div className="flex flex-wrap items-start gap-4">
          <section className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-[14px] border border-line bg-white">
            <div className="flex flex-col gap-3 border-b border-line-soft px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex min-w-0 flex-col gap-1">
                  {locked ? (
                    <h2 className="m-0 text-[17px] font-semibold">
                      {fw.name} · v{fw.version}
                    </h2>
                  ) : (
                    <label className="flex items-center gap-2 text-[13px] font-semibold">
                      <span className="sr-only">Framework name</span>
                      <input value={fw.name} onChange={(e) => edit((d) => void (d.name = e.target.value))} className="h-10 rounded-lg border border-field px-2.5 text-[15px] font-semibold" />
                      <span className="font-mono text-muted">v{fw.version}</span>
                    </label>
                  )}
                  <div className="text-xs text-muted">
                    Issuing authority {fw.authority} · effective {fw.effective} · {fw.scoringNote} ·{" "}
                    {fw.weighting === "none" ? "no weights (requirements count equally)" : "weighted requirements"}
                  </div>
                </div>
                {pkg.live && pkg.usedByCycles > 0 && (
                  <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">
                    v{pkg.live.version} is in use by {pkg.usedByCycles} cycle and is locked
                  </span>
                )}
              </div>
              <DraftBar kind="framework" id={pkg.id} checks={checks} />
            </div>
            <TabBar label="Framework sections" tabs={TABS} active={Math.max(tab, 0)} onSelect={setTab} className="border-b border-line-soft px-4 [&>button]:px-3" />
            <div className="flex flex-col gap-2.5 px-5 py-4">
              <LockNote kind="framework" id={pkg.id} />
              {tab <= 0 && (
                <>
                  <div className="text-[13px] text-muted">
                    Hierarchy levels are names, not code. Another framework can use pillar / objective / control / sub-control with the same engine.
                  </div>
                  <div role="table" aria-label="Hierarchy levels" className="text-[13px]">
                    <div role="row" className="grid gap-2.5 border-b border-line py-2 text-xs font-semibold text-muted" style={{ gridTemplateColumns: LV_COLS }}>
                      <span role="columnheader">Level</span>
                      <span role="columnheader">English label</span>
                      <span role="columnheader">Arabic label</span>
                      <span role="columnheader">Code pattern</span>
                      <span role="columnheader">Assessed here</span>
                      <span role="columnheader">
                        <span className="sr-only">Order and remove</span>
                      </span>
                    </div>
                    {fw.levels.map((l, i) => (
                      <div role="row" key={l.id} className="grid items-center gap-2.5 border-b border-line-soft py-2" style={{ gridTemplateColumns: LV_COLS }}>
                        <span role="cell" className="font-mono font-semibold">
                          {i + 1}
                        </span>
                        <span role="cell">
                          <input value={l.en} disabled={locked} onChange={(e) => editLevel(l.id, { en: e.target.value })} aria-label={`English label, level ${i + 1}`} className={`${inputCls} text-[13px]`} />
                        </span>
                        <span role="cell">
                          <input value={l.ar} disabled={locked} onChange={(e) => editLevel(l.id, { ar: e.target.value })} dir="rtl" lang="ar" aria-label={`Arabic label, level ${i + 1}`} className={`${inputCls} text-sm`} />
                        </span>
                        <span role="cell">
                          <input value={l.pattern} disabled={locked} onChange={(e) => editLevel(l.id, { pattern: e.target.value })} aria-label={`Code pattern, level ${i + 1}`} className={`${inputCls} font-mono text-xs`} />
                        </span>
                        <span role="cell">
                          <select
                            value={l.assessed}
                            disabled={locked}
                            onChange={(e) => editLevel(l.id, { assessed: e.target.value as LevelAssessment })}
                            aria-label={`Assessed at level ${i + 1}`}
                            className={`${inputCls} bg-white text-xs`}
                          >
                            {Object.entries(ASSESSED).map(([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </span>
                        <span role="cell" className="flex gap-1">
                          <IconButton
                            label={`Move level ${i + 1} up`}
                            disabled={locked || i === 0}
                            onClick={() => edit((d) => void d.levels.splice(i - 1, 0, ...d.levels.splice(i, 1)))}
                          >
                            ↑
                          </IconButton>
                          <IconButton
                            label={`Remove level ${i + 1}`}
                            disabled={locked || fw.levels.length === 1}
                            onClick={() => edit((d) => void (d.levels = d.levels.filter((x) => x.id !== l.id)))}
                          >
                            ×
                          </IconButton>
                        </span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() =>
                      edit((d) =>
                        void d.levels.push({ id: `lv-${Date.now()}`, en: "New level", ar: "مستوى جديد", pattern: `${d.levels.at(-1)?.pattern ?? "#"}.#`, assessed: "rollup" }),
                      )
                    }
                    className="h-10 cursor-pointer self-start rounded-lg border border-dashed border-[#7D8C85] bg-white px-3 text-[13px] text-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + Add level
                  </button>
                </>
              )}
              {tab === 1 && <ImportPanel pkg={pkg} fw={fw} busy={reading} onFiles={(files) => startImport(files, { kind: "version", id: pkg.id })} />}
              {tab > 1 && <div className="py-6 text-[13px] text-muted">{TABS[tab].label} is not built in this prototype yet.</div>}
            </div>
          </section>

          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 rounded-[14px] border border-line bg-white p-[18px]">
            <h2 className="m-0 text-base font-semibold">Validation</h2>
            <Checks checks={checks} />
            <div className="border-t border-line-soft pt-3 text-xs leading-[18px] text-muted">
              Criteria drafted by the Requirement Decomposer stay &ldquo;Draft – SME approval required&rdquo; and cannot be used as assessment logic until a
              framework SME signs them off.
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="h-10 w-10 cursor-pointer rounded-lg border border-field bg-white text-base text-muted disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ImportPanel({ pkg, fw, busy, onFiles }: { pkg: FrameworkPackage; fw: FrameworkVersion; busy: boolean; onFiles: (files: File[]) => void }) {
  const job = fw.importJob;
  return (
    <div className="flex flex-col gap-3">
      {job ? (
        <>
          <div className="rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[13px] leading-5">
            <b>{job.file}</b> · {job.tab} · {job.rows} rows
            <br />
            <span className="text-muted">
              Uploaded by {job.uploadedBy} · SHA-256 {job.hash}
            </span>
          </div>
          <div className="flex flex-col gap-1.5 text-[13px]">
            <ResultRow label="Valid rows" value={String(job.valid)} bg="#E3F1EA" fg="#11603F" />
            <ResultRow label="Warnings" value={String(job.warnings.length)} bg={job.warnings.length ? "#FBEFD9" : "#F7F8F6"} fg={job.warnings.length ? "#8A4B00" : "#33403A"} />
            <ResultRow label="Changed vs live" value={job.changed} bg="#F7F8F6" fg="#33403A" />
            <ResultRow label="Errors" value={String(job.errors)} bg="#F7F8F6" fg="#33403A" />
          </div>
          {job.warnings.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-warn">
              {job.warnings.map((w) => (
                <li key={`${w.row}-${w.field}`}>
                  Row {w.row}: {w.message}
                </li>
              ))}
            </ul>
          )}
          {job.warnings.length > 0 && <div className="text-xs text-muted">Re-import the corrected file to clear these warnings; the review step fixes them before accepting.</div>}
        </>
      ) : (
        <div className="text-[13px] text-muted">No requirements file attached to this version.</div>
      )}
      {!!fw.requirements?.length && (
        <>
          <div className="text-xs text-muted">{requirementCounts(fw)}</div>
          <RequirementTree key={`${pkg.id}-${fw.version}`} requirements={fw.requirements} levels={fw.levels} />
        </>
      )}
      <UploadZone
        busy={busy}
        onFiles={onFiles}
        disabled={pkg.pendingCr ? `Read-only while ${pkg.pendingCr} awaits approval.` : undefined}
        note={pkg.draft ? `Accepting replaces the levels and requirements of draft v${pkg.draft.version}.` : pkg.live ? `Accepting creates a new draft from v${pkg.live.version}.` : undefined}
      />
    </div>
  );
}

function ResultRow({ label, value, bg, fg }: { label: string; value: string; bg: string; fg: string }) {
  return (
    <div className="flex justify-between rounded-lg px-2.5 py-2" style={{ background: bg, color: fg }}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function StartScreen({
  method,
  setMethod,
  reading,
  notice,
  onFiles,
  onOpen,
  onBlank,
}: {
  method: ExtractMethod;
  setMethod: (m: ExtractMethod) => void;
  reading: boolean;
  notice: Notice | null;
  onFiles: (files: File[]) => void;
  onOpen: (id: string) => void;
  onBlank: () => void;
}) {
  const [ai, setAi] = useState<{ available: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/frameworks/extract")
      .then((r) => r.json())
      .then(setAi)
      .catch(() => setAi({ available: false }));
  }, []);
  return (
    <>
      <PageHeader crumb="Studio / Framework Builder" title="Framework Builder" actions={<Button onClick={onBlank}>Start from a blank framework</Button>} />
      <main className="box-border flex w-full max-w-[1360px] flex-col gap-4 px-8 pb-12 pt-6">
        {notice && <NoticeBar notice={notice} onOpen={onOpen} />}
        <section aria-label="Create a framework from a document" className="flex flex-col gap-4 rounded-[14px] border-2 border-brand bg-white px-6 py-5">
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-lg font-semibold">Create a framework from a document</h2>
            <p className="m-0 text-[13px] leading-5 text-muted">
              Upload the framework, index or standards document. The platform extracts its levels, standards, requirements and evidence, then you review and edit the result
              and create the framework.
            </p>
          </div>
          <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2 p-0 text-[13px]">
            {[
              ["Upload", "Drop the document (PDF, Word, Excel…)"],
              ["Extract", method === "ai" ? "Claude reads it and proposes the tree" : "Codes and numbering build the tree"],
              ["Review and edit", "Fix titles, text, evidence, levels"],
              ["Create", "Published right away, no approval needed"],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-2.5 rounded-lg bg-surface-2 px-3 py-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{i + 1}</span>
                <span className="flex flex-col">
                  <b>{t}</b>
                  <span className="text-xs text-muted">{d}</span>
                </span>
              </li>
            ))}
          </ol>
          <fieldset className="m-0 flex flex-wrap items-center gap-2 border-0 p-0 text-[13px]">
            <legend className="sr-only">Extraction method</legend>
            <span className="me-1 text-xs font-semibold text-muted">Extract with</span>
            {(
              [
                ["ai", "Claude (AI) · recommended for PDFs and Word"],
                ["rules", "Rule-based · for coded spreadsheets"],
              ] as const
            ).map(([k, label]) => (
              <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 ${method === k ? "border-brand bg-brand-tint font-semibold" : "border-field"}`}>
                <input type="radio" name="method" checked={method === k} onChange={() => setMethod(k)} className="sr-only" />
                {label}
              </label>
            ))}
          </fieldset>
          {method === "ai" && ai && !ai.available && (
            <div role="alert" className="rounded-lg bg-warn-soft px-3 py-2 text-[13px] text-warn">
              AI extraction is not configured on this server (ANTHROPIC_API_KEY is missing in apps/web/.env), so Claude cannot read documents yet. Set the key and
              restart, or use the rule-based engine for documents with clear requirement codes.
            </div>
          )}
          <UploadZone busy={reading} onFiles={onFiles} />
        </section>

        <Library onOpen={onOpen} />
      </main>
    </>
  );
}

function NoticeBar({ notice, onOpen }: { notice: Notice; onOpen: (id: string) => void }) {
  return (
    <div role="status" className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] ${notice.ok ? "bg-good-soft text-good" : "bg-bad-soft text-bad"}`}>
      <span dir="auto">{notice.text}</span>
      {notice.open && (
        <Button size="sm" onClick={() => onOpen(notice.open!.id)}>
          {notice.open.label}
        </Button>
      )}
    </div>
  );
}

const STATUS_STYLE: Record<string, [string, string]> = {
  live: ["#E3F1EA", "#11603F"],
  draft: ["#FBEFD9", "#8A4B00"],
  "in review": ["#E8ECF3", "#3E4B63"],
  superseded: ["#F1F3F2", "#5B6762"],
};

function StatusPill({ status }: { status: string }) {
  const [bg, fg] = STATUS_STYLE[status] ?? STATUS_STYLE.superseded;
  return (
    <span className="whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold uppercase" style={{ background: bg, color: fg }}>
      {status}
    </span>
  );
}

const LIB_COLS = "minmax(220px,2fr) 110px 150px 150px 90px 90px 70px";

/** Every framework and index in the platform, with its versions and dates. One entry per framework: re-uploads become versions. */
function Library({ onOpen }: { onOpen: (id: string) => void }) {
  const { state } = useAdmin();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const q = nameKey(query);
  const rows = state.frameworks
    .map((f) => ({ f, cur: (f.draft ?? f.live)!, versions: versionsOf(f) }))
    .filter(({ f, cur }) => !q || nameKey(`${f.live?.name ?? ""} ${f.draft?.name ?? ""} ${cur.authority}`).includes(q))
    .sort((a, b) => a.cur.name.localeCompare(b.cur.name));

  return (
    <section aria-label="Framework library" className="flex flex-col overflow-hidden rounded-[14px] border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-3.5">
        <div className="flex flex-col">
          <h2 className="m-0 text-base font-semibold">Framework library · {state.frameworks.length}</h2>
          <span className="text-xs text-muted">One entry per framework or index. A document already in the library cannot be added again; upload a changed edition as a new version.</span>
        </div>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or authority" aria-label="Search the library" className="h-9 w-60 rounded-lg border border-field px-2.5 text-[13px]" />
      </div>
      <div className="overflow-x-auto">
        <div role="table" aria-label="Framework library" className="min-w-[900px] text-[13px]">
          <div role="row" className="grid gap-3 border-b border-line bg-surface-2 px-5 py-2 text-xs font-semibold text-muted" style={{ gridTemplateColumns: LIB_COLS }}>
            <span role="columnheader">Framework</span>
            <span role="columnheader">Live version</span>
            <span role="columnheader">Effective</span>
            <span role="columnheader">Published</span>
            <span role="columnheader">Nodes</span>
            <span role="columnheader">Versions</span>
            <span role="columnheader">
              <span className="sr-only">Open</span>
            </span>
          </div>
          {rows.map(({ f, cur, versions }) => {
            const expanded = open.has(f.id);
            const pending = versions.find((v) => v.status === "draft" || v.status === "in review");
            return (
              <div key={f.id} role="rowgroup" className="border-b border-line-soft">
                <div role="row" className="grid items-center gap-3 px-5 py-2.5" style={{ gridTemplateColumns: LIB_COLS }}>
                  <span role="cell" className="flex min-w-0 flex-col">
                    <b className="truncate" dir="auto">
                      {cur.name}
                    </b>
                    <span className="truncate text-xs text-muted" dir="auto">
                      {cur.authority} · {cur.levels.map((l) => l.en).join(" › ")}
                      {f.usedByCycles ? ` · used by ${f.usedByCycles} cycle` : ""}
                    </span>
                  </span>
                  <span role="cell" className="flex flex-col items-start gap-1">
                    {f.live ? <b className="font-mono">v{f.live.version}</b> : <span className="text-muted">none</span>}
                    {pending && (
                      <span className="flex items-center gap-1 text-xs">
                        <span className="font-mono">v{pending.version}</span>
                        <StatusPill status={pending.status} />
                      </span>
                    )}
                  </span>
                  <span role="cell" className="text-xs">{f.live?.effective ?? "—"}</span>
                  <span role="cell" className="text-xs">{f.live?.publishedAt ?? (f.live ? "—" : `created ${cur.createdAt ?? "—"}`)}</span>
                  <span role="cell" className="font-mono text-xs">{(f.live ?? cur).requirements?.length ?? "—"}</span>
                  <span role="cell">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() =>
                        setOpen((o) => {
                          const next = new Set(o);
                          if (next.has(f.id)) next.delete(f.id);
                          else next.add(f.id);
                          return next;
                        })
                      }
                      className="cursor-pointer border-0 bg-transparent p-0 text-xs font-semibold text-brand underline"
                    >
                      {versions.length} {expanded ? "▾" : "▸"}
                    </button>
                  </span>
                  <span role="cell">
                    <Button size="sm" className="h-8 text-xs" onClick={() => onOpen(f.id)}>
                      Open
                    </Button>
                  </span>
                </div>
                {expanded && (
                  <table className="mb-2.5 ms-5 w-[calc(100%-40px)] table-fixed border-collapse text-xs">
                    <colgroup>
                      <col className="w-[9%]" />
                      <col className="w-[12%]" />
                      <col className="w-[17%]" />
                      <col className="w-[12%]" />
                      <col className="w-[12%]" />
                      <col className="w-[12%]" />
                      <col className="w-[8%]" />
                      <col />
                    </colgroup>
                    <thead>
                      <tr className="text-start text-muted">
                        <th className="py-1 font-semibold">Version</th>
                        <th className="py-1 font-semibold">Status</th>
                        <th className="py-1 font-semibold">Effective</th>
                        <th className="py-1 font-semibold">Created</th>
                        <th className="py-1 font-semibold">Published</th>
                        <th className="py-1 font-semibold">Superseded</th>
                        <th className="py-1 font-semibold">Nodes</th>
                        <th className="py-1 font-semibold">Source documents</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((v) => (
                        <tr key={`${v.version}-${v.status}`} className="border-t border-line-soft">
                          <td className="py-1.5 font-mono font-semibold">v{v.version}</td>
                          <td className="py-1.5">
                            <StatusPill status={v.status} />
                          </td>
                          <td className="py-1.5">{v.effective}</td>
                          <td className="py-1.5">{v.createdAt ?? "—"}</td>
                          <td className="py-1.5">{v.publishedAt ?? "—"}</td>
                          <td className="py-1.5">{v.supersededAt ?? "—"}</td>
                          <td className="py-1.5 font-mono">{v.nodes || "—"}</td>
                          <td className="py-1.5 font-mono text-muted">{v.fileHashes.length ? v.fileHashes.map((h) => `${h.slice(0, 4)}…${h.slice(-4)}`).join(", ") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
          {rows.length === 0 && <div className="px-5 py-6 text-muted">No framework matches the search.</div>}
        </div>
      </div>
    </section>
  );
}
