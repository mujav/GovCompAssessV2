"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/journey/icon";
import { AppShell, JMain } from "@/components/journey/shell";
import { Bar, Panel, PanelHead, Pill, Ring, inputClass } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { shortName } from "@/lib/journey/frameworks";
import { completionColor } from "@/lib/journey/portfolio";
import { useMyWorkplaces } from "@/lib/journey/use-workplaces";
import { useWorkplacesWork } from "@/lib/journey/use-work";
import { STAGES, stageOf } from "@/lib/journey/work";
import { SUBMISSION_DEADLINE, daysBetween } from "@/lib/workspace/data";
import { useWorkspace } from "@/lib/workspace/store";

// Dashboards for management: where every workplace stands, read-only. Each row opens the
// workplace's report.

export default function DashboardsPage() {
  const ws = useWorkspace();
  const views = useMyWorkplaces();
  const work = useWorkplacesWork(views);
  const [year, setYear] = useState("all");
  const today = ws.ctx.today;
  const years = [...new Set(views.map((v) => v.workplace.year))].sort((a, b) => b - a);

  const rows = useMemo(
    () =>
      work
        .filter((w) => year === "all" || String(w.workplace.year) === year)
        .map((w) => {
          const total = w.reqs.length;
          const overdue = w.reqs.filter((r) => r.due < today && stageOf(r, w.overlay) !== "acc").length;
          return { w, total, overdue, pct: total ? Math.round((w.counts.acc / total) * 100) : 0 };
        })
        .sort((a, b) => a.pct - b.pct),
    [work, year, today],
  );

  const sum = rows.reduce(
    (a, x) => ({ total: a.total + x.total, acc: a.acc + x.w.counts.acc, rev: a.rev + x.w.counts.rev, start: a.start + x.w.counts.start, prog: a.prog + x.w.counts.prog, overdue: a.overdue + x.overdue }),
    { total: 0, acc: 0, rev: 0, start: 0, prog: 0, overdue: 0 },
  );
  const pct = sum.total ? Math.round((sum.acc / sum.total) * 100) : 0;
  const byIndex = [...new Map(rows.map((x) => [x.w.workplace.frameworkId, x.w.framework ? shortName(x.w.framework.name) : x.w.workplace.frameworkId])).entries()].map(([id, name]) => {
    const list = rows.filter((x) => x.w.workplace.frameworkId === id);
    const t = list.reduce((a, x) => a + x.total, 0);
    const acc = list.reduce((a, x) => a + x.w.counts.acc, 0);
    return { id, name, n: list.length, pct: t ? Math.round((acc / t) * 100) : 0 };
  });

  return (
    <AppShell search="Search dashboards">
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Insights</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Dashboards</h1>
          </div>
          <select aria-label="Review year" value={year} onChange={(e) => setYear(e.target.value)} className={cx(inputClass, "h-10")}>
            <option value="all">All review years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-stretch gap-3.5">
          <Panel className="flex flex-[1_1_300px] items-center gap-5 p-[22px]">
            <Ring pct={pct} color={completionColor(pct)} size={110} thickness={12} label={`${pct} percent accepted`}>
              <b className="text-2xl">{pct}%</b>
            </Ring>
            <span className="flex flex-col gap-1 text-sm">
              <b className="text-base">Accepted across workplaces</b>
              <span className="text-j-ink-3">
                {sum.acc} of {sum.total} requirements in {rows.length} workplaces
              </span>
              <span className="text-j-ink-3">Portal closes in {daysBetween(today, SUBMISSION_DEADLINE)} days</span>
            </span>
          </Panel>
          <section aria-label="Totals" className="grid flex-[2_1_480px] grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            {[
              ["Not started", sum.start, "text-j-ink"],
              ["In progress", sum.prog, "text-[#8A4B00]"],
              ["Waiting for review", sum.rev, "text-cx"],
              ["Overdue", sum.overdue, sum.overdue ? "text-j-bad" : "text-j-ink"],
            ].map(([l, v, ink]) => (
              <div key={l as string} className="flex flex-col justify-center gap-1 rounded-2xl border border-[#E3E8EF] bg-white p-[18px]">
                <b className={cx("text-[26px] leading-[30px]", ink as string)}>{v}</b>
                <span className="text-[13px] text-j-muted">{l}</span>
              </div>
            ))}
          </section>
        </div>

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="min-w-0 flex-[3_1_640px] overflow-hidden">
            <PanelHead title="Workplaces" aside={<span className="text-xs text-j-muted">Lowest acceptance first</span>} className="px-[22px] pt-[18px] pb-3" />
            <div className="overflow-x-auto">
              <div role="table" aria-label="Workplaces" className="min-w-[720px] text-sm">
                <div role="row" className="grid grid-cols-[2fr_1fr_1.6fr_0.7fr_0.7fr_24px] gap-3 border-y border-j-line px-[22px] py-2.5 text-xs font-semibold text-j-muted">
                  {["Workplace", "Accepted", "By stage", "Review", "Overdue", ""].map((h, i) => (
                    <span key={i} role="columnheader">
                      {h}
                    </span>
                  ))}
                </div>
                {rows.map(({ w, total, overdue, pct: p }) => (
                  <Link
                    key={w.workplace.id}
                    href={`/dashboards/${w.client.id}`}
                    role="row"
                    className="grid grid-cols-[2fr_1fr_1.6fr_0.7fr_0.7fr_24px] items-center gap-3 border-b border-j-line-soft px-[22px] py-3 text-j-ink no-underline hover:bg-j-canvas hover:text-j-ink"
                  >
                    <span role="cell" className="min-w-0">
                      <b className="block truncate">{w.entity.name}</b>
                      <span className="text-xs text-j-muted">
                        {w.framework ? shortName(w.framework.name) : w.workplace.frameworkId} · {w.workplace.year} · {w.owners.map((o) => o.name).join(", ") || "no index owner"}
                      </span>
                    </span>
                    <span role="cell" className="flex flex-col gap-1">
                      <b>{p}%</b>
                      <Bar pct={p} color={completionColor(p)} />
                    </span>
                    <span role="img" aria-label={STAGES.map((s) => `${s.label} ${w.counts[s.key]}`).join(", ")} className="flex h-2.5 gap-[2px] overflow-hidden rounded-md bg-j-line-soft">
                      {total > 0 && STAGES.filter((s) => w.counts[s.key] > 0).map((s) => <span key={s.key} style={{ flex: w.counts[s.key], background: s.color }} />)}
                    </span>
                    <span role="cell">{w.counts.rev}</span>
                    <span role="cell" className={overdue ? "font-semibold text-j-bad" : ""}>
                      {overdue}
                    </span>
                    <Icon name="chevR" size={16} className="text-j-muted" />
                  </Link>
                ))}
                {rows.length === 0 && <p className="m-0 px-[22px] py-8 text-center text-sm text-j-muted">No workplaces for this year.</p>}
              </div>
            </div>
            <div className="flex flex-wrap gap-3 px-[22px] py-3 text-xs text-j-muted">
              {STAGES.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
          </Panel>
          <Panel className="flex min-w-0 flex-[1_1_280px] flex-col gap-3 p-[22px]">
            <PanelHead title="By index" />
            {byIndex.map((x) => (
              <div key={x.id} className="flex flex-col gap-1.5 text-sm">
                <span className="flex justify-between">
                  <b>{x.name}</b>
                  <span className="text-j-muted">
                    {x.n} workplace{x.n === 1 ? "" : "s"} · <b className="text-j-ink">{x.pct}%</b>
                  </span>
                </span>
                <Bar pct={x.pct} color={completionColor(x.pct)} />
              </div>
            ))}
            {byIndex.length === 0 && <p className="m-0 text-sm text-j-muted">Nothing to show.</p>}
            <Pill className="mt-2 self-start">Read-only</Pill>
          </Panel>
        </div>
      </JMain>
    </AppShell>
  );
}
