"use client";

import { useParams } from "next/navigation";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/journey/icon";
import { LevelCellView } from "@/components/journey/levels";
import { AppShell, JMain } from "@/components/journey/shell";
import { Bar, JButton, JLink, Panel, PanelHead, Pill, Ring, Segmented } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { shortName } from "@/lib/journey/frameworks";
import { completionColor } from "@/lib/journey/portfolio";
import { levelText } from "@/lib/journey/levels";
import { UNASSIGNED, buildReport, contextLevels, scopeOf, type OwnerReport, type ReportRow, type StageCounts, type WorkspaceReport } from "@/lib/journey/report";
import { exportReport, type ExportFormat, type ReportKind } from "@/lib/journey/report-export";
import { useIndexLevels } from "@/lib/journey/use-levels";
import { useJourney } from "@/lib/journey/store";
import { cycleKey } from "@/lib/cycle/use-cycle";
import { phaseDue, workspaceCycle } from "@/lib/cycle/periods";
import { useControlOwners, useMyWorkplaces } from "@/lib/journey/use-workplaces";
import { useWorkplacesWork } from "@/lib/journey/use-work";
import { STAGES } from "@/lib/journey/work";
import { SUBMISSION_DEADLINE, daysBetween, shortDate } from "@/lib/workspace/data";
import { useWorkspace } from "@/lib/workspace/store";

// One workplace's reports. The executive report shows where the workspace stands; the detailed
// report gives every Control Owner a page of their own. Both download as PDF, PowerPoint or Excel.
// Every [data-report-page] block becomes its own page in the PDF.

const NO_REQS: never[] = [];

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "pdf", label: "PDF" },
  { value: "pptx", label: "PowerPoint" },
  { value: "xlsx", label: "Excel" },
];

export default function WorkplaceReportPage() {
  const { id } = useParams<{ id: string }>();
  const ws = useWorkspace();
  const views = useMyWorkplaces();
  const mine = useMemo(() => views.filter((v) => v.client.id === id), [views, id]);
  const [w] = useWorkplacesWork(mine);
  const people = useControlOwners(w?.workplace.entityId);
  const { state } = useJourney();
  const cy = useMemo(() => workspaceCycle(state.screens[cycleKey(id)], w?.framework?.live.cycles), [state.screens, id, w?.framework]);
  const levels = useIndexLevels(w?.framework, w?.workspace ?? true, w?.reqs ?? NO_REQS, id);
  const today = ws.ctx.today;
  const [kind, setKind] = useState<ReportKind>("executive");
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [failed, setFailed] = useState("");
  const pagesRef = useRef<HTMLDivElement>(null);

  const report = useMemo(
    () =>
      w &&
      buildReport({
        entity: w.entity.name,
        index: w.framework ? shortName(w.framework.name) : w.workplace.frameworkId,
        year: w.workplace.year,
        cycle: cy.label,
        submissionDue: phaseDue(cy.period, "submission"),
        indexOwners: w.owners.map((o) => o.name),
        today,
        reqs: w.reqs,
        overlay: w.overlay,
        people,
        levels,
      }),
    [w, today, people, levels, cy],
  );

  if (!w || !report) {
    return (
      <AppShell search="Search dashboards">
        <JMain>
          <h1 className="m-0 text-2xl">This workspace is not available to you</h1>
          <JLink href="/dashboards">Back to dashboards</JLink>
        </JMain>
      </AppShell>
    );
  }

  const download = async (f: ExportFormat) => {
    setBusy(f);
    setFailed("");
    try {
      await exportReport(f, report, kind, pagesRef.current);
    } catch (e) {
      console.error(e);
      setFailed(`The ${FORMATS.find((x) => x.value === f)!.label} file could not be made. Try again.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell clientId={id} search="Search dashboards">
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Reports › {kind === "executive" ? "Executive report" : "Detailed report"}</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">{report.entity}</h1>
            <span className="flex flex-wrap gap-1.5">
              <Pill tone="cx">
                {scopeOf(report)}
              </Pill>
              <Pill>Index Owners: {report.indexOwners.join(", ") || "none"}</Pill>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-semibold text-j-ink-3">Download</span>
            {FORMATS.map((f) => (
              <JButton key={f.value} size="sm" disabled={busy !== null} onClick={() => void download(f.value)}>
                <Icon name="download" size={15} />
                {busy === f.value ? "Preparing…" : f.label}
              </JButton>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Report"
            value={kind}
            onChange={setKind}
            options={[
              { value: "executive", label: "Executive report" },
              { value: "detailed", label: `Detailed report · ${report.owners.length} Control Owners` },
            ]}
          />
          {failed && (
            <span role="alert" className="text-sm font-semibold text-j-bad">
              {failed}
            </span>
          )}
        </div>

        <div ref={pagesRef} className="flex flex-col gap-3.5">
          {kind === "executive" ? <Executive r={report} /> : <Detailed r={report} />}
        </div>
      </JMain>
    </AppShell>
  );
}

/** Title block that heads each exported page, so a PDF page reads on its own. */
function PageTitle({ r, title, sub }: { r: WorkspaceReport; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-j-line-soft pb-3">
      <span className="flex flex-col gap-0.5">
        <span className="text-xs text-j-muted">
          {r.entity} · {scopeOf(r)}
        </span>
        <b className="text-xl leading-7" dir="auto">
          {title}
        </b>
        {sub && <span className="text-sm text-j-ink-3">{sub}</span>}
      </span>
      <span className="text-xs text-j-muted">As of {shortDate(r.today)}</span>
    </div>
  );
}

function StageStrip({ counts, total }: { counts: StageCounts; total: number }) {
  return (
    <span role="img" aria-label={STAGES.map((s) => `${s.label} ${counts[s.key]}`).join(", ")} className="flex h-2.5 gap-[2px] overflow-hidden rounded-md bg-j-line-soft">
      {total > 0 && STAGES.filter((s) => counts[s.key] > 0).map((s) => <span key={s.key} style={{ flex: counts[s.key], background: s.color }} />)}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: "bad" }) {
  return (
    <div className="flex flex-col justify-center gap-1 rounded-2xl border border-[#E3E8EF] bg-white px-4 py-3">
      <b className={cx("text-[22px] leading-7", tone === "bad" && "text-j-bad")}>{value}</b>
      <span className="text-[13px] text-j-muted">{label}</span>
    </div>
  );
}

function Executive({ r }: { r: WorkspaceReport }) {
  const due = r.submissionDue ?? SUBMISSION_DEADLINE;
  const closes = r.year === new Date(due).getFullYear() && due >= r.today;
  return (
    <>
      <Panel data-report-page className="flex flex-col gap-4 p-[22px]">
        <PageTitle r={r} title="Executive report" sub={`${r.counts.acc} of ${r.total} requirements accepted`} />
        <div className="flex flex-wrap items-stretch gap-3.5">
          <div className="flex flex-[1_1_280px] items-center gap-5 rounded-2xl border border-[#E3E8EF] p-[18px]">
            <Ring pct={r.pct} color={completionColor(r.pct)} size={110} thickness={12} label={`${r.pct} percent accepted`}>
              <b className="text-2xl">{r.pct}%</b>
            </Ring>
            <span className="flex flex-col gap-1 text-sm">
              <b className="text-base">Accepted</b>
              <span className="text-j-ink-3">
                {r.counts.acc} of {r.total} requirements
              </span>
              {closes && <span className="text-j-ink-3">Submission due in {daysBetween(r.today, due)} days</span>}
            </span>
          </div>
          <section aria-label="By stage" className="grid flex-[2_1_480px] grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-3">
            {STAGES.map((s) => (
              <div key={s.key} className="flex flex-col justify-center gap-1 rounded-2xl border border-[#E3E8EF] bg-white p-[18px]">
                <span className="h-1.5 w-8 rounded" style={{ background: s.color }} />
                <b className="text-[26px] leading-[30px]">{r.counts[s.key]}</b>
                <span className="text-[13px] text-j-muted">{s.label}</span>
              </div>
            ))}
            <Stat label="Overdue" value={r.overdue} tone={r.overdue ? "bad" : undefined} />
          </section>
        </div>
        <div className="flex flex-col gap-3">
          <PanelHead title="By domain" />
          {r.domains.map((d) => (
            <div key={d.name} className="flex flex-col gap-1.5 text-sm">
              <span className="flex justify-between gap-3">
                <b className="truncate" dir="auto">
                  {d.name}
                </b>
                <span className="whitespace-nowrap text-j-muted">
                  {d.counts.acc} / {d.total} · <b className="text-j-ink">{d.pct}%</b>
                </span>
              </span>
              <StageStrip counts={d.counts} total={d.total} />
            </div>
          ))}
          <Legend />
        </div>
      </Panel>

      <Panel data-report-page className="flex flex-col gap-4 p-[22px]">
        <PageTitle r={r} title="Control Owners and overdue work" />
        <div className="flex flex-col gap-2.5">
          <PanelHead title="Control Owners" aside={<span className="text-xs text-j-muted">open · late</span>} />
          {r.owners.slice(0, 12).map((o) => (
            <div key={o.name} className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-auto truncate">{o.name}</span>
              <span className="w-24">
                <Bar pct={o.total ? ((o.total - o.open) / o.total) * 100 : 0} color="#1F9D6E" />
              </span>
              <span className="w-8 text-end">{o.open}</span>
              <span className={o.overdue ? "w-8 text-end font-semibold text-j-bad" : "w-8 text-end text-j-muted"}>{o.overdue}</span>
            </div>
          ))}
          {r.owners.length > 12 && <span className="text-xs text-j-muted">And {r.owners.length - 12} more in the detailed report.</span>}
        </div>
        <div className="flex flex-col">
          <PanelHead title={`Overdue · ${r.late.length}`} className="pb-2" />
          {r.late.slice(0, 15).map((x) => (
            <div key={x.code} className="flex flex-wrap items-center gap-3 border-t border-j-line-soft py-2.5 text-sm">
              <span className="w-24 font-mono text-xs text-j-muted">{x.code}</span>
              <span className="flex min-w-[220px] flex-auto flex-col">
                <span dir="auto">{x.title}</span>
                <span className="text-xs text-j-muted" dir="auto">
                  {contextLevels(r, x)
                    .map((l) => `${l.label} ${levelText(l.cell)}`)
                    .join(" › ")}
                </span>
              </span>
              <span className="text-j-ink-3">{x.owner}</span>
              <span className="font-semibold text-j-bad">due {shortDate(x.due)}</span>
              <Pill>{x.stageLabel}</Pill>
            </div>
          ))}
          {r.late.length === 0 && <p className="m-0 border-t border-j-line-soft py-4 text-sm text-j-muted">Nothing overdue.</p>}
          {r.late.length > 15 && <p className="m-0 py-3 text-xs text-j-muted">And {r.late.length - 15} more in the detailed report.</p>}
        </div>
      </Panel>
    </>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-j-muted">
      {STAGES.map((s) => (
        <span key={s.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

const ownerAnchor = (name: string) => `owner-${name.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "-")}`;
const OWNER_COLS = "grid-cols-[1.6fr_1.3fr_0.7fr_0.8fr_1.4fr_0.7fr_0.7fr]";

function Detailed({ r }: { r: WorkspaceReport }) {
  return (
    <>
      <Panel data-report-page className="flex flex-col gap-4 p-[22px]">
        <PageTitle r={r} title="Detailed report" sub={`One page per Control Owner · ${r.total} requirements · ${r.overdue} overdue`} />
        <div className="overflow-x-auto">
          <div role="table" aria-label="Control Owners" className="min-w-[760px] text-sm">
            <div role="row" className={cx("grid gap-3 border-b border-j-line py-2 text-xs font-semibold text-j-muted", OWNER_COLS)}>
              {["Control Owner", "Department", "Assigned", "Accepted", "By stage", "Overdue", "Returned"].map((h) => (
                <span key={h} role="columnheader">
                  {h}
                </span>
              ))}
            </div>
            {r.owners.map((o) => (
              <a key={o.name} role="row" href={`#${ownerAnchor(o.name)}`} className={cx("grid items-center gap-3 border-b border-j-line-soft py-2.5 text-j-ink no-underline hover:bg-j-canvas hover:text-j-ink", OWNER_COLS)}>
                <b role="cell" className="truncate">
                  {o.name}
                </b>
                <span role="cell" className="truncate text-j-ink-3">
                  {o.department ?? "–"}
                </span>
                <span role="cell">{o.total}</span>
                <span role="cell" className="font-semibold">
                  {o.pct}%
                </span>
                <span role="cell">
                  <StageStrip counts={o.counts} total={o.total} />
                </span>
                <span role="cell" className={o.overdue ? "font-semibold text-j-bad" : "text-j-muted"}>
                  {o.overdue}
                </span>
                <span role="cell" className={o.returned ? "font-semibold text-[#8A4B00]" : "text-j-muted"}>
                  {o.returned}
                </span>
              </a>
            ))}
          </div>
        </div>
        <Legend />
      </Panel>
      {r.owners.map((o) => (
        <OwnerPage key={o.name} r={r} o={o} />
      ))}
    </>
  );
}

const ROW_COLS = "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,2fr)_110px_76px_70px_minmax(0,0.9fr)]";

function OwnerPage({ r, o }: { r: WorkspaceReport; o: OwnerReport }) {
  return (
    <Panel data-report-page id={ownerAnchor(o.name)} className="flex scroll-mt-4 flex-col gap-4 p-[22px]">
      <PageTitle r={r} title={o.name} sub={o.name === UNASSIGNED ? "Requirements nobody owns yet" : [o.department, o.email].filter(Boolean).join(" · ") || undefined} />
      <section aria-label={`${o.name} at a glance`} className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
        <Stat label="Assigned" value={o.total} />
        <Stat label="Accepted" value={`${o.pct}%`} />
        <Stat label="In review" value={o.counts.rev} />
        <Stat label="In progress" value={o.counts.prog} />
        <Stat label="Not started" value={o.counts.start} />
        <Stat label="Overdue" value={o.overdue} tone={o.overdue ? "bad" : undefined} />
        <Stat label="Returned" value={o.returned} tone={o.returned ? "bad" : undefined} />
      </section>
      <StageStrip counts={o.counts} total={o.total} />
      <div className="overflow-x-auto">
        <div role="table" aria-label={`Requirements of ${o.name}`} className="min-w-[1060px] text-sm">
          <div role="row" className={cx("grid gap-3 border-b border-j-line py-2 text-xs font-semibold text-j-muted", ROW_COLS)}>
            {[...r.levels, "Stage", "Due", "Evidence", "Flags"].map((h) => (
              <span key={h} role="columnheader">
                {h}
              </span>
            ))}
          </div>
          {o.rows.map((x) => (
            <OwnerRow key={x.code} x={x} rowLevel={r.rowLevel} />
          ))}
        </div>
      </div>
    </Panel>
  );
}

function OwnerRow({ x, rowLevel }: { x: ReportRow; rowLevel: number }) {
  const stage = STAGES.find((s) => s.key === x.stage)!;
  return (
    <div role="row" className={cx("grid items-center gap-3 border-b border-j-line-soft py-2", ROW_COLS)}>
      {x.path.map((cell, i) =>
        i === rowLevel ? (
          <span key={i} role="cell" className="flex min-w-0 flex-col">
            <b className="font-mono text-xs">{x.code}</b>
            <span dir="auto">{x.title}</span>
          </span>
        ) : (
          <span key={i} role="cell" className="min-w-0">
            <LevelCellView cell={cell} />
          </span>
        ),
      )}
      <span role="cell" className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stage.color }} />
        {stage.label}
      </span>
      <span role="cell" className={x.overdue ? "font-semibold text-j-bad" : ""}>
        {shortDate(x.due)}
      </span>
      <span role="cell" className="text-j-ink-3">
        {x.files} / {x.expected}
      </span>
      <span role="cell" className="flex flex-wrap gap-1">
        {x.overdue && <Pill tone="bad">Overdue</Pill>}
        {x.returned && <Pill tone="warn">Returned</Pill>}
      </span>
    </div>
  );
}
