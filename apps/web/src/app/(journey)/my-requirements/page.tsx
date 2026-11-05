"use client";

import Link from "next/link";
import { AppShell, JMain } from "@/components/journey/shell";
import { JLink, Panel, PanelHead, Pill } from "@/components/journey/ui";
import { Kpi, useToast } from "@/components/cycle/ui";
import { ControlsTable } from "@/components/cycle/my-controls";
import { useAuth } from "@/lib/auth/store";
import { defaultDates } from "@/lib/cycle/model";
import { messagesFor, useMyControls } from "@/lib/cycle/use-my-controls";
import { SUBMISSION_DEADLINE, TODAY, daysBetween } from "@/lib/workspace/data";

// S07 · Control Owner home: the controls they own or contribute to and what is late or returned.
// Each control row has a paperclip to attach evidence without opening the control.

export default function HomePage() {
  const { user } = useAuth();
  const mine = useMyControls();
  const { say, toast } = useToast();
  const owned = mine.filter((m) => m.owned);
  const closing = mine[0]?.cycle.dates?.internalClosing ?? defaultDates(SUBMISSION_DEADLINE).internalClosing;
  const reqs = mine.reduce((a, m) => a + m.c.total, 0);
  const met = mine.reduce((a, m) => a + m.c.met, 0);
  const ev = mine.reduce((a, m) => ({ e: a.e + m.c.evidence.expected, u: a.u + m.c.evidence.uploaded }), { e: 0, u: 0 });
  const returned = mine.filter((m) => m.c.stage === "returned");
  const overdue = mine.filter((m) => m.c.stage !== "accepted" && m.c.due < TODAY);
  const last = [...mine].filter((m) => m.c.stage !== "accepted").sort((a, b) => (b.cycle.activity[b.c.code] ?? "").localeCompare(a.cycle.activity[a.c.code] ?? "") || a.c.due.localeCompare(b.c.due))[0];
  const unread = user ? messagesFor(mine, user.name).length : 0;

  return (
    <AppShell search="Search my controls" workBadge={unread ? String(unread) : undefined}>
      <JMain max={1600}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <Pill tone="warn" className="self-start">
              Internal closing {closing} · {Math.max(0, daysBetween(TODAY, closing))} days
            </Pill>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Welcome back, {user?.name}</h1>
            <p className="m-0 text-sm text-j-ink-3">
              You own {owned.length} controls and contribute to {mine.length - owned.length}.
            </p>
          </div>
          {last && (
            <JLink variant="primary" href={last.href}>
              Continue where you left off · {last.c.code}
            </JLink>
          )}
        </div>

        <section className="flex flex-wrap gap-3">
          <Kpi label="Controls" value={mine.length} sub={`${owned.length} owned · ${mine.length - owned.length} contributing`} />
          <Kpi label="Requirements met" value={`${met} / ${reqs}`} />
          <Kpi label="Evidence uploaded" value={`${ev.u} / ${ev.e}`} />
          <Kpi label="Returned to you" value={returned.length} sub={`${returned.reduce((a, m) => a + m.c.reqs.filter((r) => r.stage === "returned").length, 0)} requirements to fix`} tone={returned.length ? "warn" : undefined} />
          <Kpi label="Overdue" value={overdue.length} sub={overdue[0] ? `${overdue[0].c.code} · ${daysBetween(overdue[0].c.due, TODAY)} days late` : "Nothing late"} tone={overdue.length ? "bad" : undefined} />
        </section>

        <Panel className="py-[18px]">
          <PanelHead
            className="px-[22px] pb-2"
            title="My controls"
            aside={
              <Link href="/my-controls" className="text-[13px] font-semibold text-cx">
                All my controls →
              </Link>
            }
          />
          <ControlsTable onAttached={say} list={[...mine].sort((a, b) => Number(b.c.stage === "returned") - Number(a.c.stage === "returned") || Number(a.c.stage === "accepted") - Number(b.c.stage === "accepted") || a.c.due.localeCompare(b.c.due)).slice(0, 12)} />
          {!mine.length && <p className="m-0 px-[22px] py-4 text-sm text-j-muted">No controls are assigned to you yet. Your Index Owner maps them in People and access; they appear here straight away.</p>}
        </Panel>
      </JMain>
      {toast}
    </AppShell>
  );
}
