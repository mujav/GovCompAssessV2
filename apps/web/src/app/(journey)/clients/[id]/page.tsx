"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Drawer } from "@/components/overlay";
import { ClientShell, JMain } from "@/components/journey/shell";
import { JButton, JLink, Panel, PanelHead, Pill, Ring, Segmented } from "@/components/journey/ui";
import { AiBox, ClosedBanner, Kpi } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { canManage } from "@/lib/auth/accounts";
import { useAuth } from "@/lib/auth/store";
import { clientHref, completionColor } from "@/lib/journey/portfolio";
import { useScreenState } from "@/lib/journey/store";
import { attention, CYCLE_STAGES, findingsOf, phaseProgress, type CycleStage } from "@/lib/cycle/model";
import { useCycle } from "@/lib/cycle/use-cycle";
import { isClosed, nextDeadline, timeline, type CyclePeriod } from "@/lib/cycle/periods";
import { executiveUpdate } from "@/lib/workspace/drafts";
import { PRIOR_CYCLE, TODAY, daysBetween } from "@/lib/workspace/data";

// S03 · 360° dashboard. Where the workspace stands in its cycle, by phase, stage, dimension
// and department, and what to act on today.

export default function DashboardPage() {
  const cy = useCycle();
  const { client, ws, controls, summary, cycle, ai, runs, closed, log } = cy;
  const { user } = useAuth();
  const manages = canManage(user?.role);
  const [view, setView] = useState<"submission" | "compliance">("submission");
  const [update, setUpdate] = useState(false);
  const [reminded, setReminded] = useScreenState<string[]>(`overview.${client.id}.reminded`, []);
  const c = (p: string) => clientHref(client.id, p);
  const s = summary;
  const { periods, period } = cy;
  const activeAt = periods.indexOf(period);
  // Follows the cycle in progress until someone picks another (saved work loads after the first render).
  const [picked, setShown] = useState<number | null>(null);
  const shown = picked ?? activeAt;
  // The last official score: the cycle before this one, else last year's.
  const prior = periods[activeAt - 1]?.closure?.score ?? (client.id === client.entityId && client.frameworkId === "fw-qiyas" ? PRIOR_CYCLE.at(-1)! : null);
  const progress = phaseProgress(s.phase, s.counts);
  const upcoming = nextDeadline(period, TODAY);
  const totalReqs = Object.values(s.counts).reduce((a, b) => a + b, 0) || 1;
  const live = controls.filter((x) => x.applicable);
  const returns = Object.fromEntries(Object.entries(cycle.reviews).map(([k, v]) => [k, v.returns]));
  const openRisks = cycle.risks.filter((r) => r.status !== "Closed").length;

  const byDim = useMemo(() => {
    const m = new Map<string, { name: string; met: number; total: number; controls: number; accepted: number; counts: Record<CycleStage, number> }>();
    for (const x of live) {
      const e = m.get(x.dimension) ?? { name: x.dimensionName, met: 0, total: 0, controls: 0, accepted: 0, counts: { not: 0, draft: 0, submitted: 0, review: 0, returned: 0, accepted: 0 } };
      e.met += x.met;
      e.total += x.total;
      e.controls++;
      if (x.stage === "accepted") e.accepted++;
      for (const r of x.reqs) if (r.status !== "na") e.counts[r.stage]++;
      m.set(x.dimension, e);
    }
    return [...m.entries()];
  }, [live]);

  const byDept = useMemo(() => {
    const m = new Map<string, Record<CycleStage, number> & { lead: string; notMet: number; open: number }>();
    for (const x of live)
      for (const r of x.reqs) {
        if (r.status === "na" || !r.department) continue;
        const e = m.get(r.department) ?? { not: 0, draft: 0, submitted: 0, review: 0, returned: 0, accepted: 0, lead: r.owner, notMet: 0, open: 0 };
        e[r.stage]++;
        if (r.stage !== "accepted") e.open++;
        if (r.stage === "returned" || cycle.reviews[x.code]?.decisions[r.code] === "not") e.notMet++;
        m.set(r.department, e);
      }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [live, cycle.reviews]);

  // Act today: critical findings due soon first, then the longest overdue.
  const actToday = useMemo(() => {
    if (!ai.agents.remediation) return [];
    const items: { level: string; code: string; title: string; why: string; rank: number }[] = [];
    for (const x of live) {
      if (x.stage === "accepted") continue;
      const left = daysBetween(TODAY, x.due);
      const f = findingsOf(x, runs).filter((k) => k.level === "Critical");
      const notMet = x.reqs.filter((r) => r.stage === "returned").length;
      if (left < 0) items.push({ level: "CRITICAL", code: x.code, title: x.title, why: `overdue ${-left} days · ${x.evidence.uploaded} of ${x.evidence.expected} evidence`, rank: 100 - left });
      else if (f.length && left <= 7) items.push({ level: "CRITICAL", code: x.code, title: x.title, why: `due in ${left} days · ${notMet || f.length} of ${x.total} requirements not met`, rank: 80 - left });
      else if (x.previous === "Non") items.push({ level: "HIGH", code: x.code, title: x.title, why: "non-compliant last cycle", rank: 40 - left / 10 });
    }
    return items.sort((a, b) => b.rank - a.rank).slice(0, 3);
  }, [live, runs, ai.agents.remediation]);

  const att = attention(controls, TODAY, ai.thresholds, returns, cycle.activity);

  return (
    <ClientShell workBadge={String(att.length)}>
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-j-muted">
              {client.name} · {cy.workspace}
            </span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Compliance at a glance</h1>
            <span className="flex flex-wrap gap-1.5">
              {cy.cycleText && <Pill tone="dark">{cy.cycleText}</Pill>}
              {upcoming && (
                <Pill tone={daysBetween(TODAY, upcoming.due) <= 7 ? "bad" : "warn"}>
                  Next: {upcoming.name} · {upcoming.due === TODAY ? "today" : `${daysBetween(TODAY, upcoming.due)} days`}
                </Pill>
              )}
              <Pill tone={daysBetween(TODAY, s.dates.internalClosing) <= 7 ? "bad" : "warn"}>Internal closing · {Math.max(0, daysBetween(TODAY, s.dates.internalClosing))} days</Pill>
              <Pill tone="cx">Submission to regulator · {Math.max(0, daysBetween(TODAY, s.dates.submission))} days</Pill>
              <Pill>{activeAt > 0 ? `${periods[activeAt - 1].name} official score` : "Previous official score"} · {prior == null ? "–" : `${prior}%`}</Pill>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <JLink size="sm" variant="ghost" href={c("/360")}>
              Entity profile
            </JLink>
            <JButton onClick={() => setUpdate(true)}>Progress report</JButton>
            {manages && (
              <JLink href={c("/review")} variant="primary">
                Open review hub
              </JLink>
            )}
          </div>
        </div>
        <ClosedBanner show={closed} />

        <CycleStrip periods={periods} active={activeAt} shown={shown} onShow={setShown} phase={s.phase} progress={progress} index={cy.workspace} />

        <section className="flex flex-wrap gap-3">
          <Kpi label="Plan progress" value={`${s.planPct}%`} sub={`${s.accepted} of ${s.controls} controls accepted${s.behind > 0 ? ` · ${s.behind} pts behind plan` : " · on plan"}`} tone={s.behind > 5 ? "warn" : undefined} />
          <Kpi label="Compliance rate" value={`${s.rate}%`} sub={`${s.met} of ${s.reqs} requirements met · Target ${s.dates.target}%`} />
          <Kpi label="Evidence uploaded" value={`${s.evidence.expected ? Math.round((s.evidence.uploaded / s.evidence.expected) * 100) : 0}%`} sub={`${s.evidence.uploaded} of ${s.evidence.expected} items · ${s.evidence.accepted} accepted`} />
          <Link href={manages ? c("/review") : c("/analytics")} className="flex min-w-0 flex-[1_1_220px] flex-col gap-1 rounded-[16px] border border-j-line bg-white px-4 py-3.5 text-j-ink no-underline hover:border-cx-line hover:text-j-ink">
            <span className="text-xs font-semibold text-j-muted">Needs attention {manages && "· Review hub →"}</span>
            <span className="flex gap-5 text-sm">
              <span>
                <b className="block text-[22px] text-[#B2461F]">{s.overdue}</b>Overdue
              </span>
              <span>
                <b className="block text-[22px]">{s.returned}</b>Returned req.
              </span>
              <span>
                <b className="block text-[22px]">{openRisks}</b>Open risks
              </span>
            </span>
          </Link>
        </section>

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="flex min-w-0 flex-[1.3_1_420px] flex-col gap-3 p-[22px]">
            <PanelHead title={`Where the ${totalReqs} requirements are`} aside={<span className="text-xs text-j-muted">Share of all requirements under each stage</span>} />
            <div role="img" aria-label={CYCLE_STAGES.map((x) => `${x.label} ${s.counts[x.key]}`).join(", ")} className="flex h-4 gap-[3px] overflow-hidden rounded-lg">
              {CYCLE_STAGES.filter((x) => s.counts[x.key]).map((x) => (
                <span key={x.key} style={{ flex: s.counts[x.key], background: x.color }} />
              ))}
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2 text-[13px]">
              {CYCLE_STAGES.map((x) => (
                <span key={x.key} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: x.color }} />
                  <span className="flex-auto text-j-ink-2">{x.key === "accepted" ? "Accepted (met)" : x.label}</span>
                  <b>{s.counts[x.key]}</b>
                  <span className="text-j-muted">{Math.round((s.counts[x.key] / totalReqs) * 100)}%</span>
                </span>
              ))}
            </div>
          </Panel>
        </div>

        <Panel className="flex flex-col gap-3 p-[22px]">
          <PanelHead title="By dimension · requirements met" aside={<span className="text-xs text-j-muted">{byDim.length} dimensions</span>} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
            {byDim.map(([k, d]) => {
              const p = d.total ? Math.round((d.met / d.total) * 100) : 0;
              return (
                <div key={k} className="flex flex-col gap-3 rounded-2xl border border-j-line bg-white p-4">
                  <div className="flex items-start gap-3">
                    <Ring pct={p} color={completionColor(p)} size={56} thickness={7} label={`${p} percent met`}>
                      <b className="text-[13px]">{p}%</b>
                    </Ring>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <b className="font-mono text-xs text-j-muted">{k}</b>
                      <b className="line-clamp-2 text-sm leading-5" dir="auto">
                        {d.name}
                      </b>
                    </span>
                  </div>
                  <span role="img" aria-label={CYCLE_STAGES.map((x) => `${x.label} ${d.counts[x.key]}`).join(", ")} className="flex h-2 gap-[2px] overflow-hidden rounded-full bg-j-line-soft">
                    {CYCLE_STAGES.filter((x) => d.counts[x.key]).map((x) => (
                      <span key={x.key} style={{ flex: d.counts[x.key], background: x.color }} />
                    ))}
                  </span>
                  <span className="flex justify-between gap-2 text-xs text-j-ink-3">
                    <span>
                      <b className="text-j-ink">{d.met}</b> / {d.total} requirements met
                    </span>
                    <span>
                      <b className="text-j-ink">{d.accepted}</b> / {d.controls} controls
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="flex flex-col gap-2 py-[18px]">
          <PanelHead
            className="px-[22px]"
            title="Requirements by department"
            aside={<Segmented size="sm" label="Department view" value={view} onChange={setView} options={[{ value: "submission", label: "Submission view" }, { value: "compliance", label: "Compliance view" }]} />}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-[13px]">
              <thead>
                <tr className="text-xs text-j-muted">
                  <th className="px-[22px] py-2 text-start font-semibold">Department</th>
                  {(view === "submission" ? [...CYCLE_STAGES.map((x) => x.label), "Total"] : ["Submitted", "Met", "Returned (not met)", "Awaiting decision", "Compliance rate"]).map((h) => (
                    <th key={h} className="px-2 py-2 text-end font-semibold">
                      {h}
                    </th>
                  ))}
                  {manages && view === "submission" && <th />}
                </tr>
              </thead>
              <tbody>
                {[...byDept, ["All", byDept.reduce((a, [, e]) => { for (const k of Object.keys(a) as (keyof typeof a)[]) if (typeof e[k] === "number") (a[k] as number) += e[k] as number; return a; }, { not: 0, draft: 0, submitted: 0, review: 0, returned: 0, accepted: 0, lead: "", notMet: 0, open: 0 })] as const].map(([name, e]) => {
                  const total = CYCLE_STAGES.reduce((a, x) => a + e[x.key], 0);
                  const submitted = e.submitted + e.review + e.returned + e.accepted;
                  const all = name === "All";
                  return (
                    <tr key={name} className={cx("border-t border-j-line-soft", all && "font-bold")}>
                      <td className="px-[22px] py-2.5">{name}</td>
                      {view === "submission"
                        ? [...CYCLE_STAGES.map((x) => e[x.key]), total].map((v, i) => (
                            <td key={i} className="px-2 py-2.5 text-end">
                              {v}
                            </td>
                          ))
                        : [submitted, e.accepted, e.notMet, e.submitted + e.review, `${submitted ? Math.round((e.accepted / submitted) * 100) : 0}%`].map((v, i) => (
                            <td key={i} className="px-2 py-2.5 text-end">
                              {v}
                            </td>
                          ))}
                      {manages && view === "submission" && (
                        <td className="px-2 py-1.5 text-end">
                          {!all &&
                            (reminded.includes(name) ? (
                              <Pill tone="ok">Reminded</Pill>
                            ) : (
                              <JButton
                                size="sm"
                                variant="ghost"
                                disabled={!e.open || closed}
                                onClick={() => {
                                  setReminded((x) => void x.push(name));
                                  log(`Reminder sent to ${e.lead || name} for ${e.open} open requirements`);
                                }}
                              >
                                Remind
                              </JButton>
                            ))}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="m-0 px-[22px] text-xs text-j-muted">Counted per requirement. Compliance rate = met ÷ submitted requirements.</p>
        </Panel>

        {actToday.length > 0 && (
          <AiBox title="Act today" only="AI ranked">
            {actToday.map((a) => (
              <div key={a.code} className="flex flex-wrap items-center gap-2 border-t border-[#DAD7FB] pt-2 text-sm first:border-0 first:pt-0">
                <Pill tone={a.level === "CRITICAL" ? "bad" : "orange"}>{a.level}</Pill>
                <span className="flex-auto">
                  <b>
                    {a.code} {a.title}
                  </b>{" "}
                  · {a.why}
                </span>
                {manages && (
                  <Link href={c(`/review/${encodeURIComponent(a.code)}`)} className="text-[13px] font-semibold text-cx">
                    Open review →
                  </Link>
                )}
              </div>
            ))}
            {manages && (
              <JLink size="sm" variant="outline" href={c("/review")} className="self-start">
                Open review hub
              </JLink>
            )}
          </AiBox>
        )}
      </JMain>

      <Drawer
        open={update}
        onClose={() => setUpdate(false)}
        eyebrow={manages ? "Draft · you review before it is sent" : "Progress report"}
        title={`Progress report · ${client.name}`}
        footer={
          <>
            <JLink href={`/dashboards/${client.id}`}>Open printable report</JLink>
            {manages && (
              <JButton
                variant="primary"
                onClick={() => {
                  log(`Progress report sent to Management Viewers · ${client.name}`);
                  setUpdate(false);
                }}
              >
                Send to Management Viewers
              </JButton>
            )}
          </>
        }
      >
        <pre className="m-0 font-sans text-sm leading-6 whitespace-pre-wrap text-j-ink-2">
          {`${client.name} · ${cy.workspace}\nPhase: ${s.phaseName} · plan ${s.planPct}% (${s.accepted} of ${s.controls} controls accepted)\nCompliance rate ${s.rate}% (${s.met} of ${s.reqs} requirements met) · target ${s.dates.target}%\n${s.overdue} controls overdue · ${s.returned} requirements returned\n\n`}
          {executiveUpdate(ws.ctx)}
        </pre>
      </Drawer>
    </ClientShell>
  );
}

/** Where the year stands: the cycle's phases with their deadlines, and the other cycles of the year. */
function CycleStrip({ periods, active, shown, onShow, phase, progress, index }: { periods: CyclePeriod[]; active: number; shown: number; onShow: (i: number) => void; phase: number; progress: number[]; index: string }) {
  const p = periods[shown] ?? periods[active];
  const now = shown === active && !isClosed(p);
  const extra = timeline(p).filter((d) => !d.phase);
  return (
    <Panel className="flex flex-col gap-3 p-[18px]" aria-label="Phases">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">
          <b>{index}</b>
          {periods.length > 1 && (
            <>
              {" · "}
              <b>
                {p.name} of {periods.length}
              </b>
            </>
          )}
          <span className="text-j-muted">
            {" · "}
            {isClosed(p) ? `closed ${p.closure?.closedAt?.slice(0, 10)} · official score ${p.closure?.score ?? "–"}%` : TODAY < p.opens ? `opens ${p.opens}` : `opened ${p.opens}${p.submittedAt ? ` · submitted ${p.submittedAt}` : ""}`}
          </span>
        </span>
        {periods.length > 1 && (
          <Segmented size="sm" label="Cycle" value={String(shown)} onChange={(v) => onShow(Number(v))} options={periods.map((x, i) => ({ value: String(i), label: `${x.name}${isClosed(x) ? " · closed" : i === active ? " · now" : ""}` }))} />
        )}
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
        {p.phases.map((ph, i) => {
          const pct = isClosed(p) ? 100 : now ? (progress[i] ?? 0) : 0;
          const here = now && i === phase;
          const left = daysBetween(TODAY, ph.due);
          return (
            <div key={ph.key} className={cx("flex flex-col gap-1.5 rounded-xl px-2.5 py-2", here && "bg-cx-tint")}>
              <span className="text-xs font-semibold text-j-ink-2">
                {ph.name}
                {here && " · now"}
              </span>
              <span className="block h-1.5 overflow-hidden rounded-full bg-j-line-soft">
                <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: isClosed(p) || (now && i < phase) ? "#1F9D6E" : "#1E4E8C" }} />
              </span>
              <span className="flex items-baseline justify-between gap-1">
                <b className="text-sm">{pct}%</b>
                <span className={cx("text-[11px]", here && left < 0 ? "font-semibold text-j-bad" : "text-j-muted")}>
                  {here ? (left < 0 ? `${-left} d late` : left === 0 ? "due today" : `${left} d left`) : `by ${ph.due.slice(5)}`}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      {extra.length > 0 && (
        <span className="flex flex-wrap gap-1.5 text-xs">
          {extra.map((d) => (
            <Pill key={d.id} tone={d.due < TODAY ? "gray" : "cx"}>
              {d.name || "Deadline"} · {d.due}
            </Pill>
          ))}
        </span>
      )}
    </Panel>
  );
}
