"use client";

import { useState } from "react";
import { Checks, DraftBar, LockNote, type CheckItem } from "@/components/admin-ui";
import { PageHeader } from "@/components/workspace-shell";
import { Button, TabBar } from "@/components/ui";
import { stamp, useAdmin, working } from "@/lib/admin/store";
import type { FrameworkVersion, HierarchyLevel, LevelAssessment } from "@/lib/admin/types";

const ASSESSED: Record<LevelAssessment, string> = {
  rollup: "Roll-up only",
  accepted: "Accepted here",
  ai_reviewer: "AI + reviewer",
};

const TABS = [{ label: "Hierarchy" }, { label: "Requirements import" }, { label: "Custom fields" }, { label: "Terminology" }];
const LV_COLS = "44px 1.3fr 1.3fr 1fr 1.1fr 92px";
const inputCls = "box-border h-10 w-full rounded-lg border border-field px-2.5 disabled:bg-surface-2 disabled:text-ink-2";

function frameworkChecks(v: FrameworkVersion): CheckItem[] {
  const labelsOk = v.levels.every((l) => l.en.trim() && l.ar.trim());
  const patterns = v.levels.map((l) => l.pattern.trim());
  const patternsOk = patterns.every(Boolean) && new Set(patterns).size === patterns.length;
  const acceptedOk = v.levels.some((l) => l.assessed === "accepted");
  const importOk = !v.importJob || (v.importJob.errors === 0 && v.importJob.warnings.length === 0);
  return [
    { ok: v.levels.length > 0, text: v.levels.length ? `${v.levels.length} hierarchy levels` : "Add at least one hierarchy level" },
    { ok: labelsOk, text: labelsOk ? "Every level has English and Arabic labels" : "Every level needs English and Arabic labels" },
    { ok: patternsOk, text: patternsOk ? "Code patterns are unique" : "Code patterns must be filled in and unique" },
    { ok: acceptedOk, text: acceptedOk ? "One level is where results are accepted" : "Mark one level as \"Accepted here\"" },
    { ok: importOk, text: importOk ? "Requirements import has no open warnings" : "Resolve import warnings before submitting" },
  ];
}

export default function FrameworkBuilderPage() {
  const { state, update, editDraft, user } = useAdmin();
  const [sel, setSel] = useState("fw-qiyas");
  const [tab, setTab] = useState(0);

  const pkg = state.frameworks.find((f) => f.id === sel) ?? state.frameworks[0];
  const { value: fw, locked } = working(pkg);
  if (!fw) return null;
  const edit = (fn: (d: FrameworkVersion) => void) => editDraft<FrameworkVersion>("framework", pkg.id, fn);
  const editLevel = (id: string, patch: Partial<HierarchyLevel>) =>
    edit((d) => {
      const l = d.levels.find((x) => x.id === id);
      if (l) Object.assign(l, patch);
    });
  const checks = frameworkChecks(fw);

  const newFramework = () => {
    const id = `fw-${state.seq + 1}`;
    update((s) => {
      s.seq += 1;
      s.frameworks.push({
        id,
        usedByCycles: 0,
        draft: {
          name: "New framework",
          version: "0.1",
          authority: "Internal",
          effective: "—",
          scoringNote: "Not configured",
          levels: [
            { id: "lv-1", en: "Domain", ar: "المجال", pattern: "#", assessed: "rollup" },
            { id: "lv-2", en: "Control", ar: "الضابط", pattern: "#.#", assessed: "accepted" },
          ],
        },
      });
      s.audit.unshift({ id: `ev-${s.seq}`, at: stamp(), who: user.name, text: "Created framework draft \"New framework\" v0.1." });
    });
    setSel(id);
    setTab(0);
  };

  return (
    <>
      <PageHeader
        crumb="Admin Studio / Framework package"
        title="Framework Builder"
        actions={
          <Button variant="primary" className="px-4" onClick={newFramework}>
            New framework
          </Button>
        }
      />
      <main className="box-border flex w-full max-w-[1360px] flex-col gap-4 px-8 pb-12 pt-6">
        <section aria-label="Frameworks" className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3">
          {state.frameworks.map((f) => {
            const w = f.draft ?? f.live!;
            const status = f.pendingCr ? ["IN REVIEW", "#E8ECF3", "#3E4B63"] : f.draft ? ["DRAFT", "#FBEFD9", "#8A4B00"] : ["PUBLISHED", "#E3F1EA", "#11603F"];
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSel(f.id)}
                aria-pressed={f.id === pkg.id}
                className="flex cursor-pointer flex-col gap-1.5 rounded-xl bg-white px-4 py-3.5 text-left text-ink"
                style={{ border: f.id === pkg.id ? "2px solid #0E5A45" : "1px solid #DCE2DE" }}
              >
                <span className="flex items-center justify-between gap-2">
                  <b className="text-[15px]">
                    {w.name} · v{w.version}
                  </b>
                  <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: status[1], color: status[2] }}>
                    {status[0]}
                  </span>
                </span>
                <span className="text-xs text-muted">
                  {w.authority} · {f.live ? `v${f.live.version} live` : "never published"}
                  {f.usedByCycles ? ` · used by ${f.usedByCycles} cycle` : ""}
                </span>
                <span className="font-mono text-xs text-ink-2">{w.levels.map((l) => l.en).join(" › ")}</span>
              </button>
            );
          })}
        </section>

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
                    Issuing authority {fw.authority} · effective {fw.effective} · {fw.scoringNote}
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
            <TabBar label="Framework sections" tabs={TABS} active={tab} onSelect={setTab} className="border-b border-line-soft px-4 [&>button]:px-3" />
            <div className="flex flex-col gap-2.5 px-5 py-4">
              <LockNote kind="framework" id={pkg.id} />
              {tab === 0 && (
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
              {tab === 1 && <ImportPanel fw={fw} locked={locked} edit={edit} />}
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

const MAPPING: [string, string][] = [
  ["Requirement code", "official_code"],
  ["Domain", "level 1"],
  ["Official text (AR)", "official_text.ar"],
  ["Official text (EN)", "official_text.en"],
  ["Implementation req.", "guidance"],
  ["Weight", "weight"],
  ["Applicability", "applicability_rule"],
];

function ImportPanel({ fw, locked, edit }: { fw: FrameworkVersion; locked: boolean; edit: (fn: (d: FrameworkVersion) => void) => void }) {
  const job = fw.importJob;
  if (!job)
    return (
      <div className="flex flex-col items-start gap-2 py-2 text-[13px] text-muted">
        No requirements file attached to this version.
        <Button
          size="md"
          disabled={locked}
          onClick={() =>
            edit(
              (d) =>
                void (d.importJob = {
                  file: "requirements-master.xlsx",
                  tab: "03_Requirements",
                  rows: 120,
                  uploadedBy: "You",
                  hash: "a91c…3f07",
                  valid: 119,
                  warnings: [{ row: 42, field: "weight", message: "Weight missing for row 42" }],
                  changed: "120 new",
                  errors: 0,
                }),
            )
          }
        >
          Attach sample requirements file
        </Button>
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[13px] leading-5">
        <b>{job.file}</b> · tab {job.tab} · {job.rows} rows
        <br />
        <span className="text-muted">
          Uploaded by {job.uploadedBy} · SHA-256 {job.hash}
        </span>
      </div>
      <div className="text-xs font-semibold text-muted">Column mapping</div>
      <div className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-center gap-1.5 text-xs">
        {MAPPING.map(([from, to]) => (
          <MapRow key={from} from={from} to={to === "level 1" ? `level 1 · ${fw.levels[0]?.en ?? "—"}` : to} />
        ))}
      </div>
      <div className="flex flex-col gap-1.5 text-[13px]">
        <ResultRow label="Valid rows" value={String(job.valid)} bg="#E3F1EA" fg="#11603F" />
        <ResultRow label="Warnings" value={String(job.warnings.length)} bg={job.warnings.length ? "#FBEFD9" : "#F7F8F6"} fg={job.warnings.length ? "#8A4B00" : "#33403A"} />
        <ResultRow label="Changed vs live" value={job.changed} bg="#F7F8F6" fg="#33403A" />
        <ResultRow label="Errors" value={String(job.errors)} bg="#F7F8F6" fg="#33403A" />
      </div>
      {job.warnings.length > 0 && (
        <>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-xs text-warn">
            {job.warnings.map((w) => (
              <li key={w.row}>
                Row {w.row}: {w.message}
              </li>
            ))}
          </ul>
          <Button
            className="self-start"
            disabled={locked}
            onClick={() =>
              edit((d) => {
                if (!d.importJob) return;
                d.importJob.valid += d.importJob.warnings.length;
                d.importJob.warnings = [];
              })
            }
          >
            Apply default weight (medium) to {job.warnings.length} row{job.warnings.length > 1 ? "s" : ""}
          </Button>
        </>
      )}
    </div>
  );
}

function MapRow({ from, to }: { from: string; to: string }) {
  return (
    <>
      <span className="font-mono">{from}</span>
      <span aria-hidden="true">→</span>
      <span>{to}</span>
    </>
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
