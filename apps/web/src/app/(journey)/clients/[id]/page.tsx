"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Drawer } from "@/components/overlay";
import { FrameworkSwitcher } from "@/components/journey/framework-switcher";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Avatar, JButton, JLink, Panel, PanelHead, Pill, Ring } from "@/components/journey/ui";
import { readiness } from "@/lib/engine/metrics";
import { clientHref } from "@/lib/journey/portfolio";
import type { ClientRequirement, EntityFramework } from "@/lib/journey/frameworks";
import { useScreenState } from "@/lib/journey/store";
import { ALL, useAllFrameworkWork, useClientWork, useEntityFrameworks } from "@/lib/journey/use-work";
import { codeKey, initials, isReturned, pipelineBands, stageOf, type WorkOverlay } from "@/lib/journey/work";
import { executiveUpdate } from "@/lib/workspace/drafts";
import { PRIOR_CYCLE, SUBMISSION_DEADLINE, daysBetween, shortDate } from "@/lib/workspace/data";
import type { useWorkspace } from "@/lib/workspace/store";

// 07 · Workplace overview. Where the workplace stands and what the index owner does next, for
// one framework or, when the entity has several, for all of them side by side.


const DEPT_MIX = [
  ["Accepted", "#1F9D6E"],
  ["In progress", "#E0A100"],
  ["Returned", "#D9442E"],
  ["Not started", "#C9D1CD"],
] as const;

const AV_TONE = { late: ["#FDECEA", "#B42318"], warn: ["#FFF4DF", "#8A4B00"], ok: ["#E7F3ED", "#0E5A45"] } as const;

type Ws = ReturnType<typeof useWorkspace>;
type QueueItem = { k: "rev" | "ev" | "draft" | "cla" | "send"; t: string; code: string; due: string; late: boolean; cta: string; href: string; fw?: EntityFramework };

/** Headline numbers, pipeline, queue and SPOC hand-offs for one framework's requirements. */
function summarize(reqs: ClientRequirement[], overlay: WorkOverlay, workspace: boolean, ws: Ws, c: (p: string) => string, fw?: EntityFramework) {
  const today = ws.ctx.today;
  const total = reqs.length;
  const st = reqs.map((r) => stageOf(r, overlay));
  const atLeast = (s: string[]) => st.filter((x) => s.includes(x)).length;
  // The workspace framework has a scoring model; library frameworks show the share accepted so far.
  const pct = workspace ? readiness(ws.ctx).projected.pct : total ? Math.round((atLeast(["acc"]) / total) * 1000) / 10 : 0;
  const issues = workspace ? ws.ctx.issues.filter((i) => !ws.state.returned.includes(i.id)) : [];
  const clarifications = workspace ? ws.ctx.clarifications : [];
  const evValid = reqs.filter((r) => r.evidence.valid > 0 && r.evidence.invalid === 0 && !issues.some((i) => i.code === r.code)).length;
  const bands = pipelineBands(reqs, overlay);
  const inReview = reqs.filter((r) => stageOf(r, overlay) === "rev").sort((a, b) => a.due.localeCompare(b.due) || codeKey(a.code).localeCompare(codeKey(b.code)));
  const drafting = reqs.filter((r) => stageOf(r, overlay) === "prog" && r.work !== "update" && r.work !== "prog").sort((a, b) => a.due.localeCompare(b.due));
  const dueLabel = (d: string) => {
    const n = daysBetween(today, d);
    return n <= 0 ? "Today" : n === 1 ? "Tomorrow" : `${n} d`;
  };
  const queue: QueueItem[] = [
    ...inReview.slice(0, 2).map((r) => ({ k: "rev" as const, t: r.title, code: r.code, due: dueLabel(r.due), late: r.due <= today, cta: "Review", href: c(`/requirements/${r.code}`), fw })),
    ...(issues.length ? [{ k: "ev" as const, t: `${issues.length} files failed validation`, code: issues[0].id, due: "Today", late: true, cta: "Check", href: c("/evidence"), fw }] : []),
    ...drafting.slice(0, 1).map((r) => ({ k: "draft" as const, t: r.title, code: r.code, due: dueLabel(r.due), late: r.due < today, cta: "Draft", href: c(`/requirements/${r.code}`), fw })),
    ...clarifications.map((cl) => ({ k: "cla" as const, t: `Apply DGA answer to ${cl.affects.length} items`, code: cl.id, due: "2 d", late: false, cta: "Apply", href: c("/requirements?view=cla"), fw })),
    ...(inReview.length ? [{ k: "send" as const, t: `${inReview.length} requirements waiting for your review`, code: "Batch", due: "2 d", late: false, cta: "Open", href: c("/work"), fw }] : []),
  ];
  // SPOC hand-offs: requirements waiting on a department, grouped by department.
  const spocMap = new Map<string, { who: string; codes: string[]; oldest: string }>();
  for (const r of reqs) {
    if (stageOf(r, overlay) !== "prog" || (r.work !== "update" && r.work !== "prog")) continue;
    const e = spocMap.get(r.department) ?? { who: r.owner || "Unassigned", codes: [], oldest: r.due };
    e.codes.push(r.code);
    if (r.due < e.oldest) e.oldest = r.due;
    spocMap.set(r.department, e);
  }
  const spocs = [...spocMap.entries()].map(([dept, e]) => ({ dept, ...e, age: Math.max(1, daysBetween(e.oldest, today)), fw }));
  return {
    total,
    pct,
    delta: workspace ? Math.round((pct - PRIOR_CYCLE[PRIOR_CYCLE.length - 1]) * 10) / 10 : null,
    stats: [
      { l: "Submitted", v: atLeast(["rev", "acc"]), bar: "#1E4E8C", href: c("/requirements") },
      { l: "Accepted", v: atLeast(["acc"]), bar: "#1F9D6E", href: c("/submission") },
      { l: "Evidence valid", v: evValid, bar: "#5FBF93", href: c("/evidence") },
    ],
    bands,
    queue,
    queueCount: inReview.length + issues.length + drafting.length + clarifications.length,
    spocs,
  };
}

const PIPE: { key: keyof ReturnType<typeof pipelineBands>; l: string; color: string; path: string }[] = [
  { key: "start", l: "Not started", color: "#D5DCD8", path: "/requirements?stage=start" },
  { key: "draft", l: "Drafting", color: "#9AA6A0", path: "/requirements?stage=prog" },
  { key: "spoc", l: "With control owner", color: "#E0A100", path: "/work" },
  { key: "rev", l: "In review", color: "#3A6FB8", path: "/requirements?stage=rev" },
  { key: "acc", l: "Accepted", color: "#1F9D6E", path: "/submission" },
  { key: "ret", l: "Returned", color: "#D9442E", path: "/requirements?returned=1" },
];

export default function ClientOverviewPage() {
  const { client, ws, framework, workspace, reqs, overlay, log } = useClientWork();
  const { frameworks, active, setActive } = useEntityFrameworks();
  const all = useAllFrameworkWork();
  const showAll = active === ALL && frameworks.length > 1;
  const [reminded, setReminded] = useScreenState<string[]>(`overview.${client.id}.reminded`, []);
  const [update, setUpdate] = useState(false);
  const c = (p: string) => clientHref(client.id, p);
  const today = ws.ctx.today;
  const daysLeft = daysBetween(today, SUBMISSION_DEADLINE);

  const m = useMemo(() => {
    if (!showAll) {
      const one = summarize(reqs, overlay, workspace, ws, c, framework);
      return { ...one, spocs: one.spocs.sort((a, b) => b.codes.length - a.codes.length).slice(0, 5), parts: [] };
    }
    const parts = all.map((x) => summarize(x.reqs, x.overlay, x.workspace, ws, c, x.framework));
    const bands = PIPE.reduce((acc, p) => ({ ...acc, [p.key]: parts.reduce((n, x) => n + x.bands[p.key], 0) }), {} as ReturnType<typeof pipelineBands>);
    return {
      total: parts.reduce((n, x) => n + x.total, 0),
      pct: 0,
      delta: null,
      stats: [],
      bands,
      queue: parts.flatMap((x) => x.queue),
      queueCount: parts.reduce((n, x) => n + x.queueCount, 0),
      spocs: parts
        .flatMap((x) => x.spocs)
        .sort((a, b) => b.codes.length - a.codes.length)
        .slice(0, 5),
      parts,
    };
  }, [showAll, reqs, overlay, workspace, ws, framework, all, client.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const pipe = PIPE.map((p) => ({ ...p, n: m.bands[p.key], href: c(p.path) }));
  // Department progress (formerly its own page): every requirement in view, grouped by its owner's department.
  const depts = useMemo(() => {
    const sets = showAll ? all.map((x) => ({ reqs: x.reqs, overlay: x.overlay })) : [{ reqs, overlay }];
    const map = new Map<string, { lead: string; mix: number[]; overdue: number; open: number }>();
    for (const { reqs: list, overlay: o } of sets)
      for (const r of list) {
        if (r.status === "na" || !r.department) continue;
        const e = map.get(r.department) ?? { lead: r.owner, mix: [0, 0, 0, 0], overdue: 0, open: 0 };
        const st = stageOf(r, o);
        e.mix[st === "acc" ? 0 : isReturned(r, o) ? 2 : st === "start" ? 3 : 1] += 1;
        if (st !== "acc") e.open += 1;
        if (st !== "acc" && r.due < today) e.overdue += 1;
        e.lead ||= r.owner;
        map.set(r.department, e);
      }
    return [...map.entries()]
      .map(([name, e]) => {
        const total = e.mix.reduce((x, y) => x + y, 0);
        return { name, ...e, total, pct: total ? Math.round(((e.mix[0] + e.mix[1] * 0.5) / total) * 100) : 0 };
      })
      .sort((x, y) => x.pct - y.pct);
  }, [showAll, all, reqs, overlay, today]);

  return (
    <ClientShell workBadge={String(m.queueCount)}>
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="flex flex-wrap gap-1.5">
              {showAll ? <Pill tone="cx">{frameworks.length} frameworks</Pill> : <Pill tone="cx">{framework ? `${framework.name} v${framework.version}` : client.frameworks[0]}</Pill>}
              <Pill>Review year {client.year}</Pill>
              {(showAll ? all.some((x) => x.workspace) : workspace) && (
                <Pill tone={daysLeft <= 7 ? "bad" : "warn"}>
                  Portal closes {shortDate(SUBMISSION_DEADLINE)} · {daysLeft} d
                </Pill>
              )}
            </span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">{client.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FrameworkSwitcher allowAll />
            <JButton onClick={() => setUpdate(true)}>Status update</JButton>
            <JLink href={c("/submission")} variant="primary">
              Submission pack
            </JLink>
          </div>
        </div>

        {showAll ? (
          <section aria-label="Frameworks" className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
            {m.parts.map((x, i) => {
              const f = all[i].framework;
              return (
                <div key={f.id} className="flex flex-col gap-3.5 rounded-[20px] border border-j-line bg-white p-[18px]">
                  <span className="flex items-center gap-3.5">
                    <Ring pct={x.pct} color="#1F9D6E" size={64} label={`${f.short} completion ${x.pct} percent`}>
                      <b className="text-sm">{Math.round(x.pct)}%</b>
                    </Ring>
                    <span className="flex min-w-0 flex-col">
                      <b className="text-base" dir="auto">
                        {f.name}
                      </b>
                      <span className="text-xs text-j-muted">
                        v{f.version} · {f.authority} · {x.total} requirements
                      </span>
                    </span>
                  </span>
                  <span role="img" aria-label={`${f.short} by stage`} className="flex h-2.5 gap-[2px] overflow-hidden rounded-md bg-j-line-soft">
                    {PIPE.filter((p) => x.bands[p.key] > 0).map((p) => (
                      <span key={p.key} style={{ flex: x.bands[p.key], background: p.color }} />
                    ))}
                  </span>
                  <span className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      [x.stats[0].v, "submitted"],
                      [x.stats[1].v, "accepted"],
                      [x.queueCount, "open tasks"],
                    ].map(([v, l]) => (
                      <span key={l}>
                        <b className="text-base">{v}</b>
                        <br />
                        <span className="text-j-muted">{l}</span>
                      </span>
                    ))}
                  </span>
                  <JButton size="sm" className="self-start" onClick={() => setActive(f.id)}>
                    Open {f.short}
                  </JButton>
                </div>
              );
            })}
          </section>
        ) : (
          <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            <div className="flex items-center gap-4 rounded-[20px] bg-cx-deep p-[18px] text-white">
              <Ring pct={m.pct} color="#5FBF93" track="#2A3F5E" hole="#0F1F36" size={72} label={`Completion ${m.pct} percent`}>
                <b className="text-base">{Math.round(m.pct)}%</b>
              </Ring>
              <span className="text-sm">
                <b className="text-base">Completion</b>
                <br />
                <span className="text-cx-line">{m.delta == null ? "First cycle on the platform" : `${m.delta >= 0 ? "+" : ""}${m.delta} vs 2025`}</span>
              </span>
            </div>
            {m.stats.map((s) => (
              <Link key={s.l} href={s.href} className="flex flex-col gap-2 rounded-[20px] border border-j-line bg-white p-[18px] text-j-ink no-underline hover:border-cx-line hover:text-j-ink">
                <span className="text-[13px] text-j-muted">{s.l}</span>
                <span>
                  <b className="text-[26px] leading-[30px]">{s.v}</b> <span className="text-sm text-j-muted">/ {m.total}</span>
                </span>
                <span className="block h-1.5 overflow-hidden rounded-[3px] bg-j-line-soft">
                  <span className="block h-full rounded-[3px]" style={{ width: `${m.total ? (s.v / m.total) * 100 : 0}%`, background: s.bar }} />
                </span>
              </Link>
            ))}
          </section>
        )}

        <Panel className="flex flex-col gap-4 p-[22px]">
          <PanelHead
            title={showAll ? `Work pipeline · all frameworks · ${m.total} requirements` : "Work pipeline"}
            aside={showAll ? undefined : <Link href={c("/requirements")} className="text-[13px] font-semibold text-cx">All requirements →</Link>}
          />
          <div role="img" aria-label={`Requirements by stage: ${pipe.map((p) => `${p.l} ${p.n}`).join(", ")}`} className="flex h-4 gap-[3px] overflow-hidden rounded-lg">
            {pipe
              .filter((p) => p.n > 0)
              .map((p) => (
                <span key={p.l} style={{ flex: p.n, background: p.color }} />
              ))}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            {pipe.map((p) => {
              const body = (
                <>
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: p.color }} />
                  <span className="flex-auto text-j-ink-2">{p.l}</span>
                  <b>{p.n}</b>
                </>
              );
              // Stage links open one framework's list, so the combined view shows totals only.
              return showAll ? (
                <span key={p.l} className="flex items-center gap-2 px-2.5 py-2 text-[13px]">
                  {body}
                </span>
              ) : (
                <Link key={p.l} href={p.href} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-j-ink no-underline hover:bg-j-canvas hover:text-j-ink">
                  {body}
                </Link>
              );
            })}
          </div>
        </Panel>

        <Panel className="flex flex-col gap-1 p-[22px]">
          <PanelHead
            title={`By department${showAll ? " · all frameworks" : ""}`}
            aside={
              <Link href={c("/work")} className="text-[13px] font-semibold text-cx">
                My work →
              </Link>
            }
            className="mb-2"
          />
          {depts.map((d) => {
            const k = d.overdue >= 5 ? "late" : d.overdue >= 1 ? "warn" : "ok";
            const done = reminded.includes(d.name);
            return (
              <div key={d.name} className="flex flex-wrap items-center gap-3 border-b border-j-line-soft py-3 last:border-0">
                <Avatar initials={initials(d.lead || d.name)} bg={AV_TONE[k][0]} fg={AV_TONE[k][1]} size={34} />
                <span className="min-w-[180px] flex-[2_1_180px] text-sm">
                  <b>{d.name}</b>
                  <br />
                  <span className="text-xs text-j-muted">
                    {d.lead || "No owner"} · {d.total} requirements
                  </span>
                </span>
                <span role="img" aria-label={`${d.name}: ${d.mix[0]} accepted, ${d.mix[1]} in progress, ${d.mix[2]} returned, ${d.mix[3]} not started`} className="flex h-2.5 min-w-[140px] flex-[3_1_200px] gap-[2px] overflow-hidden rounded-md bg-j-line-soft">
                  {DEPT_MIX.map(([l, color], i) => (d.mix[i] ? <span key={l} style={{ flex: d.mix[i], background: color }} /> : null))}
                </span>
                <b className="w-12 text-end text-sm">{d.pct}%</b>
                <span className="w-20 text-xs font-semibold" style={{ color: AV_TONE[k][1] }}>
                  {d.overdue ? `${d.overdue} overdue` : "On time"}
                </span>
                {done ? (
                  <Pill tone="ok">Reminded</Pill>
                ) : (
                  <JButton
                    size="sm"
                    disabled={!d.open}
                    onClick={() => {
                      setReminded((x) => void x.push(d.name));
                      log(`Reminder sent to ${d.lead || d.name} for ${d.open} open requirements`);
                    }}
                  >
                    Remind
                  </JButton>
                )}
              </div>
            );
          })}
          {depts.length === 0 && <p className="m-0 text-sm text-j-muted">No requirement is assigned to a department yet. Assign owners in Requirements.</p>}
        </Panel>
      </JMain>

      <Drawer
        open={update}
        onClose={() => setUpdate(false)}
        eyebrow="Draft · you review before it is sent"
        title={`Status update · ${client.name}`}
        footer={
          <>
            <JButton onClick={() => setUpdate(false)}>Close</JButton>
            <JButton
              variant="primary"
              onClick={() => {
                log(`Status update sent to management · ${client.name}`);
                setUpdate(false);
              }}
            >
              Send to management
            </JButton>
          </>
        }
      >
        <pre className="m-0 font-sans text-sm leading-6 whitespace-pre-wrap text-j-ink-2">{executiveUpdate(ws.ctx)}</pre>
      </Drawer>
    </ClientShell>
  );
}
