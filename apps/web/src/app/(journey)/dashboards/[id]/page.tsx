"use client";

import { useParams } from "next/navigation";
import { useMemo } from "react";
import { AppShell, JMain } from "@/components/journey/shell";
import { Bar, JButton, JLink, Panel, PanelHead, Pill, Ring } from "@/components/journey/ui";
import { shortName } from "@/lib/journey/frameworks";
import { completionColor } from "@/lib/journey/portfolio";
import { useMyWorkplaces } from "@/lib/journey/use-workplaces";
import { useWorkplacesWork } from "@/lib/journey/use-work";
import { STAGES, codeKey, stageOf } from "@/lib/journey/work";
import { SUBMISSION_DEADLINE, daysBetween, shortDate } from "@/lib/workspace/data";
import { useWorkspace } from "@/lib/workspace/store";

// One workplace's report: acceptance by domain, the control owners' load and what is late.
// Read-only; it prints as the management report.

export default function WorkplaceReportPage() {
  const { id } = useParams<{ id: string }>();
  const ws = useWorkspace();
  const views = useMyWorkplaces();
  const mine = useMemo(() => views.filter((v) => v.client.id === id), [views, id]);
  const [w] = useWorkplacesWork(mine);
  const today = ws.ctx.today;

  const data = useMemo(() => {
    if (!w) return null;
    const staged = w.reqs.map((r) => ({ r, s: stageOf(r, w.overlay) }));
    const domains = [...new Set(w.reqs.map((r) => r.domain))].map((d) => {
      const list = staged.filter((x) => x.r.domain === d);
      const counts = Object.fromEntries(STAGES.map((s) => [s.key, list.filter((x) => x.s === s.key).length])) as Record<(typeof STAGES)[number]["key"], number>;
      return { d, total: list.length, counts, pct: list.length ? Math.round((counts.acc / list.length) * 100) : 0 };
    });
    const owners = [...new Set(w.reqs.map((r) => r.owner || "Unassigned"))]
      .map((o) => {
        const list = staged.filter((x) => (x.r.owner || "Unassigned") === o);
        return { o, total: list.length, open: list.filter((x) => x.s !== "acc").length, late: list.filter((x) => x.s !== "acc" && x.r.due < today).length };
      })
      .sort((a, b) => b.late - a.late || b.open - a.open);
    const late = staged.filter((x) => x.s !== "acc" && x.r.due < today).sort((a, b) => a.r.due.localeCompare(b.r.due) || codeKey(a.r.code).localeCompare(codeKey(b.r.code)));
    return { domains, owners, late };
  }, [w, today]);

  if (!w || !data) {
    return (
      <AppShell search="Search dashboards">
        <JMain>
          <h1 className="m-0 text-2xl">This workspace is not available to you</h1>
          <JLink href="/dashboards">Back to dashboards</JLink>
        </JMain>
      </AppShell>
    );
  }

  const total = w.reqs.length;
  const pct = total ? Math.round((w.counts.acc / total) * 100) : 0;
  const fw = w.framework ? shortName(w.framework.name) : w.workplace.frameworkId;

  return (
    <AppShell clientId={id} search="Search dashboards">
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Reports › Workspace report</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">{w.entity.name}</h1>
            <span className="flex flex-wrap gap-1.5">
              <Pill tone="cx">
                {fw} · {w.workplace.year}
              </Pill>
              <Pill>Index Owners: {w.owners.map((o) => o.name).join(", ") || "none"}</Pill>
            </span>
          </div>
          <JButton onClick={() => window.print()}>Print report</JButton>
        </div>

        <div className="flex flex-wrap items-stretch gap-3.5">
          <Panel className="flex flex-[1_1_280px] items-center gap-5 p-[22px]">
            <Ring pct={pct} color={completionColor(pct)} size={110} thickness={12} label={`${pct} percent accepted`}>
              <b className="text-2xl">{pct}%</b>
            </Ring>
            <span className="flex flex-col gap-1 text-sm">
              <b className="text-base">Accepted</b>
              <span className="text-j-ink-3">
                {w.counts.acc} of {total} requirements
              </span>
              {w.workplace.year === new Date(SUBMISSION_DEADLINE).getFullYear() && <span className="text-j-ink-3">Portal closes in {daysBetween(today, SUBMISSION_DEADLINE)} days</span>}
            </span>
          </Panel>
          <section aria-label="By stage" className="grid flex-[2_1_480px] grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
            {STAGES.map((s) => (
              <div key={s.key} className="flex flex-col justify-center gap-1 rounded-2xl border border-[#E3E8EF] bg-white p-[18px]">
                <span className="h-1.5 w-8 rounded" style={{ background: s.color }} />
                <b className="text-[26px] leading-[30px]">{w.counts[s.key]}</b>
                <span className="text-[13px] text-j-muted">{s.label}</span>
              </div>
            ))}
          </section>
        </div>

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="flex min-w-0 flex-[3_1_560px] flex-col gap-3 p-[22px]">
            <PanelHead title="By domain" />
            {data.domains.map((d) => (
              <div key={d.d} className="flex flex-col gap-1.5 text-sm">
                <span className="flex justify-between gap-3">
                  <b className="truncate" dir="auto">
                    {d.d}
                  </b>
                  <span className="whitespace-nowrap text-j-muted">
                    {d.counts.acc} / {d.total} · <b className="text-j-ink">{d.pct}%</b>
                  </span>
                </span>
                <span className="flex h-2.5 gap-[2px] overflow-hidden rounded-md bg-j-line-soft">
                  {STAGES.filter((s) => d.counts[s.key] > 0).map((s) => (
                    <span key={s.key} style={{ flex: d.counts[s.key], background: s.color }} />
                  ))}
                </span>
              </div>
            ))}
          </Panel>
          <Panel className="flex min-w-0 flex-[2_1_340px] flex-col gap-2.5 p-[22px]">
            <PanelHead title="Control Owners" aside={<span className="text-xs text-j-muted">open · late</span>} />
            {data.owners.slice(0, 12).map((o) => (
              <div key={o.o} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-auto truncate">{o.o}</span>
                <span className="w-24">
                  <Bar pct={o.total ? ((o.total - o.open) / o.total) * 100 : 0} color="#1F9D6E" />
                </span>
                <span className="w-8 text-end">{o.open}</span>
                <span className={o.late ? "w-8 text-end font-semibold text-j-bad" : "w-8 text-end text-j-muted"}>{o.late}</span>
              </div>
            ))}
          </Panel>
        </div>

        <Panel className="flex flex-col p-0">
          <PanelHead title={`Overdue · ${data.late.length}`} className="px-[22px] pt-[18px] pb-3" />
          {data.late.slice(0, 15).map(({ r, s }) => (
            <div key={r.code} className="flex flex-wrap items-center gap-3 border-t border-j-line-soft px-[22px] py-2.5 text-sm">
              <span className="w-24 font-mono text-xs text-j-muted">{r.code}</span>
              <span className="min-w-[220px] flex-auto">{r.title}</span>
              <span className="text-j-ink-3">{r.owner || "Unassigned"}</span>
              <span className="font-semibold text-j-bad">due {shortDate(r.due)}</span>
              <Pill>{STAGES.find((x) => x.key === s)!.label}</Pill>
            </div>
          ))}
          {data.late.length === 0 && <p className="m-0 border-t border-j-line-soft px-[22px] py-4 text-sm text-j-muted">Nothing overdue.</p>}
          {data.late.length > 15 && <p className="m-0 px-[22px] py-3 text-xs text-j-muted">And {data.late.length - 15} more.</p>}
        </Panel>
      </JMain>
    </AppShell>
  );
}
