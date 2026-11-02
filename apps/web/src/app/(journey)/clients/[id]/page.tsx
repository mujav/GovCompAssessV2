"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Drawer } from "@/components/overlay";
import { Icon, type IconName } from "@/components/journey/icon";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Avatar, JButton, JLink, Panel, PanelHead, Pill, Ring, type PillTone } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { readiness } from "@/lib/engine/metrics";
import { clientHref } from "@/lib/journey/portfolio";
import { useScreenState } from "@/lib/journey/store";
import { useClientWork } from "@/lib/journey/use-work";
import { codeKey, initials, pipelineBands, stageOf } from "@/lib/journey/work";
import { executiveUpdate } from "@/lib/workspace/drafts";
import { PRIOR_CYCLE, SUBMISSION_DEADLINE, daysBetween, shortDate } from "@/lib/workspace/data";

// 07 · Client overview. Where the engagement stands and what the consultant does next.

const KIND: Record<string, [IconName, PillTone, string]> = {
  rev: ["rev", "cx", "L1 review"],
  ev: ["ev", "warn", "Evidence check"],
  draft: ["draft", "gray", "Draft response"],
  cla: ["cla", "ai", "Clarification"],
  send: ["send", "ok", "Send to client"],
};

const AV_TONE = { late: ["#FDECEA", "#B42318"], warn: ["#FFF4DF", "#8A4B00"], ok: ["#E7F3ED", "#0E5A45"] } as const;

export default function ClientOverviewPage() {
  const { client, ws, reqs, overlay, log } = useClientWork();
  const [reminded, setReminded] = useScreenState<string[]>(`overview.${client.id}.reminded`, []);
  const [update, setUpdate] = useState(false);
  const c = (p: string) => clientHref(client.id, p);
  const today = ws.ctx.today;
  const daysLeft = daysBetween(today, SUBMISSION_DEADLINE);

  const m = useMemo(() => {
    const total = reqs.length;
    const st = reqs.map((r) => stageOf(r, overlay));
    const atLeast = (s: string[]) => st.filter((x) => s.includes(x)).length;
    const pct = readiness(ws.ctx).projected.pct;
    const evValid = reqs.filter((r) => r.evidence.valid > 0 && r.evidence.invalid === 0 && !ws.state.returned.some((id) => ws.ctx.issues.find((i) => i.id === id)?.code === r.code)).length;
    const bands = pipelineBands(reqs, overlay);
    const inReview = reqs.filter((r) => stageOf(r, overlay) === "rev").sort((a, b) => a.due.localeCompare(b.due) || codeKey(a.code).localeCompare(codeKey(b.code)));
    const drafting = reqs.filter((r) => stageOf(r, overlay) === "prog" && r.work !== "update" && r.work !== "prog").sort((a, b) => a.due.localeCompare(b.due));
    const issues = ws.ctx.issues.filter((i) => !ws.state.returned.includes(i.id));
    const dueLabel = (d: string) => {
      const n = daysBetween(today, d);
      return n <= 0 ? "Today" : n === 1 ? "Tomorrow" : `${n} d`;
    };
    const queue: { k: keyof typeof KIND; t: string; code: string; due: string; late: boolean; cta: string; href: string }[] = [
      ...inReview.slice(0, 2).map((r) => ({ k: "rev" as const, t: r.title, code: r.code, due: dueLabel(r.due), late: r.due <= today, cta: "Review", href: c(`/requirements/${r.code}`) })),
      ...(issues.length ? [{ k: "ev" as const, t: `${issues.length} files failed validation`, code: issues[0].id, due: "Today", late: true, cta: "Check", href: c("/evidence") }] : []),
      ...drafting.slice(0, 1).map((r) => ({ k: "draft" as const, t: r.title, code: r.code, due: dueLabel(r.due), late: r.due < today, cta: "Draft", href: c(`/requirements/${r.code}`) })),
      ...ws.ctx.clarifications.map((cl) => ({ k: "cla" as const, t: `Apply DGA answer to ${cl.affects.length} items`, code: cl.id, due: "2 d", late: false, cta: "Apply", href: c("/clarifications") })),
      ...(inReview.length ? [{ k: "send" as const, t: `${inReview.length} requirements waiting for L1 before the client`, code: "Batch", due: "2 d", late: false, cta: "Open", href: c("/work") }] : []),
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
    const spocs = [...spocMap.entries()]
      .map(([dept, e]) => ({ dept, ...e, age: Math.max(1, daysBetween(e.oldest, today)) }))
      .sort((a, b) => b.codes.length - a.codes.length)
      .slice(0, 5);
    return {
      total,
      pct,
      delta: Math.round((pct - PRIOR_CYCLE[PRIOR_CYCLE.length - 1]) * 10) / 10,
      stats: [
        { l: "Prepared", v: atLeast(["rev", "cli", "acc"]), bar: "#1E4E8C", href: c("/requirements") },
        { l: "L1 reviewed", v: atLeast(["cli", "acc"]), bar: "#3A6FB8", href: c("/work") },
        { l: "Client accepted", v: atLeast(["acc"]), bar: "#1F9D6E", href: c("/submission") },
        { l: "Evidence valid", v: evValid, bar: "#5FBF93", href: c("/evidence") },
      ],
      pipe: [
        { l: "Not started", n: bands.start, color: "#D5DCD8", href: c("/requirements?stage=start") },
        { l: "Drafting", n: bands.draft, color: "#9AA6A0", href: c("/requirements?stage=prog") },
        { l: "Waiting on SPOC", n: bands.spoc, color: "#E0A100", href: c("/work") },
        { l: "L1 review", n: bands.rev, color: "#3A6FB8", href: c("/requirements?stage=rev") },
        { l: "With client", n: bands.cli, color: "#7E8FD9", href: c("/requirements?stage=cli") },
        { l: "Accepted", n: bands.acc, color: "#1F9D6E", href: c("/submission") },
        { l: "Returned", n: bands.ret, color: "#D9442E", href: c("/requirements?returned=1") },
      ],
      queue,
      queueCount: inReview.length + issues.length + drafting.length + ws.ctx.clarifications.length,
      spocs,
    };
  }, [reqs, overlay, ws, today, client.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ClientShell workBadge={String(m.queueCount)}>
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <span className="flex flex-wrap gap-1.5">
              <Pill tone="cx">{client.frameworks[0]}</Pill>
              <Pill>Self-assessment</Pill>
              <Pill tone={daysLeft <= 7 ? "bad" : "warn"}>
                Portal closes {shortDate(SUBMISSION_DEADLINE)} · {daysLeft} d
              </Pill>
            </span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">{client.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <JButton onClick={() => setUpdate(true)}>Client update</JButton>
            <JLink href={c("/submission")} variant="primary">
              Submission pack
            </JLink>
          </div>
        </div>

        <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          <div className="flex items-center gap-4 rounded-[20px] bg-cx-deep p-[18px] text-white">
            <Ring pct={m.pct} color="#5FBF93" track="#2A3F5E" hole="#0F1F36" size={72} label={`Completion ${m.pct} percent`}>
              <b className="text-base">{Math.round(m.pct)}%</b>
            </Ring>
            <span className="text-sm">
              <b className="text-base">Completion</b>
              <br />
              <span className="text-cx-line">
                {m.delta >= 0 ? "+" : ""}
                {m.delta} vs 2025
              </span>
            </span>
          </div>
          {m.stats.map((s) => (
            <Link key={s.l} href={s.href} className="flex flex-col gap-2 rounded-[20px] border border-j-line bg-white p-[18px] text-j-ink no-underline hover:border-cx-line hover:text-j-ink">
              <span className="text-[13px] text-j-muted">{s.l}</span>
              <span>
                <b className="text-[26px] leading-[30px]">{s.v}</b> <span className="text-sm text-j-muted">/ {m.total}</span>
              </span>
              <span className="block h-1.5 overflow-hidden rounded-[3px] bg-j-line-soft">
                <span className="block h-full rounded-[3px]" style={{ width: `${(s.v / m.total) * 100}%`, background: s.bar }} />
              </span>
            </Link>
          ))}
        </section>

        <Panel className="flex flex-col gap-4 p-[22px]">
          <PanelHead title="Work pipeline" aside={<Link href={c("/requirements")} className="text-[13px] font-semibold text-cx">All requirements →</Link>} />
          <div role="img" aria-label={`Requirements by stage: ${m.pipe.map((p) => `${p.l} ${p.n}`).join(", ")}`} className="flex h-4 gap-[3px] overflow-hidden rounded-lg">
            {m.pipe
              .filter((p) => p.n > 0)
              .map((p) => (
                <span key={p.l} style={{ flex: p.n, background: p.color }} />
              ))}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            {m.pipe.map((p) => (
              <Link key={p.l} href={p.href} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-j-ink no-underline hover:bg-j-canvas hover:text-j-ink">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: p.color }} />
                <span className="flex-auto text-j-ink-2">{p.l}</span>
                <b>{p.n}</b>
              </Link>
            ))}
          </div>
        </Panel>

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="flex min-w-0 flex-[3_1_520px] flex-col gap-1 p-[22px]">
            <PanelHead title="My queue" aside={<span className="text-[13px] text-j-muted">{m.queueCount} tasks</span>} className="mb-2" />
            {m.queue.map((q) => {
              const [icon, tone, kind] = KIND[q.k];
              return (
                <div key={`${q.k}-${q.code}`} className="flex items-center gap-3 border-b border-j-line-soft py-3 last:border-0">
                  <Pill tone={tone} round={false} className="h-9 w-9 flex-none justify-center rounded-[10px] p-0">
                    <Icon name={icon} size={17} />
                  </Pill>
                  <span className="min-w-0 flex-auto text-sm">
                    <b className="block truncate">{q.t}</b>
                    <span className="text-xs text-j-muted">
                      <span className="font-mono">{q.code}</span> · {kind}
                    </span>
                  </span>
                  <span className={cx("text-xs font-semibold", q.late ? "text-j-bad" : "text-j-muted")}>{q.due}</span>
                  <JLink href={q.href} size="sm" variant="outline">
                    {q.cta}
                  </JLink>
                </div>
              );
            })}
          </Panel>
          <Panel className="flex min-w-0 flex-[2_1_360px] flex-col gap-1 p-[22px]">
            <PanelHead title="Waiting on SPOCs" aside={<Link href={c("/work")} className="text-[13px] font-semibold text-cx">Hand-offs →</Link>} className="mb-2" />
            {m.spocs.map((p) => {
              const k = p.age >= 10 ? "late" : p.age >= 4 ? "warn" : "ok";
              const done = reminded.includes(p.dept);
              return (
                <div key={p.dept} className="flex items-center gap-3 border-b border-j-line-soft py-3 last:border-0">
                  <Avatar initials={initials(p.who)} bg={AV_TONE[k][0]} fg={AV_TONE[k][1]} size={34} />
                  <span className="min-w-0 flex-auto text-sm">
                    <b>{p.dept}</b>
                    <br />
                    <span className="text-xs text-j-muted">
                      {p.who} · {p.codes.length} open
                    </span>
                  </span>
                  <span className="text-xs font-semibold" style={{ color: AV_TONE[k][1] }}>
                    {p.age} d
                  </span>
                  {done ? (
                    <Pill tone="ok">Reminded</Pill>
                  ) : (
                    <JButton
                      size="sm"
                      onClick={() => {
                        setReminded((d) => void d.push(p.dept));
                        log(`Reminder sent to ${p.who} (${p.dept}) for ${p.codes.length} requirements`);
                      }}
                    >
                      Remind
                    </JButton>
                  )}
                </div>
              );
            })}
            {m.spocs.length === 0 && <p className="m-0 text-sm text-j-muted">Nothing is waiting on a department.</p>}
          </Panel>
        </div>
      </JMain>

      <Drawer
        open={update}
        onClose={() => setUpdate(false)}
        eyebrow="Draft · you review before it is sent"
        title={`Client update · ${client.name}`}
        footer={
          <>
            <JButton onClick={() => setUpdate(false)}>Close</JButton>
            <JButton
              variant="primary"
              onClick={() => {
                log(`Client update sent to Noura A. · ${client.name}`);
                setUpdate(false);
              }}
            >
              Send to Noura A.
            </JButton>
          </>
        }
      >
        <pre className="m-0 font-sans text-sm leading-6 whitespace-pre-wrap text-j-ink-2">{executiveUpdate(ws.ctx)}</pre>
      </Drawer>
    </ClientShell>
  );
}
