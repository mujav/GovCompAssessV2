"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, JMain } from "@/components/journey/shell";
import { Icon } from "@/components/journey/icon";
import { inputClass, JLink, Panel, PanelHead, Pill } from "@/components/journey/ui";
import { Kpi, useToast } from "@/components/cycle/ui";
import { ControlsTable } from "@/components/cycle/my-controls";
import { cx } from "@/components/ui";
import { useAuth } from "@/lib/auth/store";
import { useJourney } from "@/lib/journey/store";
import { defaultDates } from "@/lib/cycle/model";
import { cycleKey, defaultSpecs, seededCycle, type CycleState } from "@/lib/cycle/use-cycle";
import { useControlEvidence } from "@/lib/cycle/use-control-evidence";
import { messagesFor, useMyControls, type MyControl } from "@/lib/cycle/use-my-controls";
import { SUBMISSION_DEADLINE, TODAY, daysBetween } from "@/lib/workspace/data";

// S07 · Control Owner home: the controls they own or contribute to, what is late or returned,
// and a quick way to attach evidence.

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
  const deadlines = [...mine].filter((m) => m.c.stage !== "accepted").sort((a, b) => a.c.due.localeCompare(b.c.due)).slice(0, 5);
  const unread = user ? messagesFor(mine, user.name).length : 0;

  return (
    <AppShell search="Search my controls" workBadge={unread ? String(unread) : undefined}>
      <JMain max={1240}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <Pill tone="warn" className="self-start">
              Internal closing {closing} · {Math.max(0, daysBetween(TODAY, closing))} days
            </Pill>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Welcome back, {user?.name}</h1>
            <p className="m-0 text-sm text-j-ink-3">
              You own {owned.length} controls and contribute to {mine.length - owned.length}. Write one response per control and attach the evidence each requirement asks for.
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

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="min-w-0 flex-[2_1_560px] py-[18px]">
            <PanelHead
              className="px-[22px] pb-2"
              title="My controls"
              aside={
                <Link href="/my-controls" className="text-[13px] font-semibold text-cx">
                  All my controls →
                </Link>
              }
            />
            <ControlsTable list={[...mine].sort((a, b) => Number(b.c.stage === "returned") - Number(a.c.stage === "returned") || Number(a.c.stage === "accepted") - Number(b.c.stage === "accepted") || a.c.due.localeCompare(b.c.due)).slice(0, 8)} />
            {!mine.length && <p className="m-0 px-[22px] py-4 text-sm text-j-muted">No controls are assigned to you yet. Your Index Owner maps them in People and access; they appear here straight away.</p>}
          </Panel>
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5">
            <Panel className="flex flex-col gap-2 p-[22px]">
              <PanelHead title="Deadlines and delays" />
              {deadlines.map((m) => {
                const left = daysBetween(TODAY, m.c.due);
                return (
                  <Link key={m.workspaceId + m.c.code} href={m.href} className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-sm text-j-ink no-underline hover:bg-j-canvas hover:text-j-ink">
                    <b className="font-mono text-xs">{m.c.code}</b>
                    <span className="flex-auto truncate">{m.c.stage === "returned" ? "returned" : left < 0 ? "overdue" : m.c.stage === "not" ? "not started" : "in progress"}</span>
                    <Pill tone={left < 0 ? "bad" : left <= 3 ? "warn" : "gray"}>{left < 0 ? `${-left} days late` : `due in ${left} days`}</Pill>
                  </Link>
                );
              })}
              {!deadlines.length && <p className="m-0 text-sm text-j-muted">Nothing open.</p>}
            </Panel>
            {mine.length > 0 && <QuickUpload mine={mine} onDone={say} />}
          </div>
        </div>
      </JMain>
      {toast}
    </AppShell>
  );
}

function QuickUpload({ mine, onDone }: { mine: MyControl[]; onDone: (t: string) => void }) {
  const open = mine.filter((m) => m.c.stage !== "accepted" && m.c.stage !== "submitted" && m.c.stage !== "review");
  const targets = open.flatMap((m) => (m.cycle.standard.controls[m.c.code]?.specs ?? defaultSpecs(m.c)).filter((s) => !s.govVerified).map((s) => ({ m, s, key: `${m.workspaceId}|${m.c.code}|${s.id}` })));
  const [target, setTarget] = useState(targets[0]?.key ?? "");
  const t = targets.find((x) => x.key === target) ?? targets[0];
  if (!t) return null;
  return <QuickUploadFor key={t.m.workspaceId} t={t} targets={targets} target={target} setTarget={setTarget} onDone={onDone} />;
}

function QuickUploadFor({ t, targets, target, setTarget, onDone }: { t: { m: MyControl; s: { id: string; req: string; title: string } }; targets: { key: string; m: MyControl; s: { id: string; req: string; title: string } }[]; target: string; setTarget: (k: string) => void; onDone: (t: string) => void }) {
  const { user } = useAuth();
  const { update } = useJourney();
  const ev = useControlEvidence(t.m.workspaceId, t.m.frameworkId, t.m.workspace, user?.name ?? "");
  const [over, setOver] = useState(false);
  const attach = async (files: File[]) => {
    const read = await ev.upload(t.s.req, files);
    update((s) => {
      const cy = (s.screens[cycleKey(t.m.workspaceId)] ??= seededCycle()) as CycleState;
      for (const f of read) (cy.fileSpec ??= {})[f.id] = t.s.id;
    });
    onDone(`${read.length} file${read.length === 1 ? "" : "s"} attached to ${t.m.c.code} · ${t.s.id}`);
  };
  return (
    <Panel className="flex flex-col gap-2.5 p-[22px]">
      <PanelHead title="Quick evidence upload" />
      <label
        onDragOver={(e) => (e.preventDefault(), setOver(true))}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void attach([...e.dataTransfer.files]);
        }}
        className={cx("flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center text-sm", over ? "border-cx bg-cx-tint" : "border-j-line")}
      >
        <Icon name="upload" size={20} />
        <span>
          Drop files here or <b className="text-cx">browse</b>
        </span>
        <span className="text-xs text-j-muted">PDF, Office, images, ZIP · up to 30 MB each</span>
        <input type="file" multiple hidden onChange={(e) => e.target.files && void attach([...e.target.files])} />
      </label>
      <label className="flex flex-col gap-1 text-[13px] font-semibold">
        Attach to
        <select value={target} onChange={(e) => setTarget(e.target.value)} className={cx(inputClass, "h-10")}>
          {targets.map((x) => (
            <option key={x.key} value={x.key}>
              {x.m.c.code} · R{x.s.req.split("-")[1] ?? ""} · {x.s.id} {x.s.title}
            </option>
          ))}
        </select>
      </label>
      {ev.busy && <span className="text-xs text-j-muted">Reading files…</span>}
    </Panel>
  );
}
