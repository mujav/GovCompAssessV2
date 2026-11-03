"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/journey/icon";
import { AppShell, JMain } from "@/components/journey/shell";
import { Panel, Pill, type PillTone } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { useAuth } from "@/lib/auth/store";
import { shortName } from "@/lib/journey/frameworks";
import { clientHref } from "@/lib/journey/portfolio";
import { useMyWorkplaces } from "@/lib/journey/use-workplaces";
import { useWorkplacesWork } from "@/lib/journey/use-work";
import { STAGE_OF, codeKey, isReturned, stageOf, type Stage } from "@/lib/journey/work";
import { daysBetween, shortDate } from "@/lib/workspace/data";
import { useWorkspace } from "@/lib/workspace/store";

// Control owner's landing page: the requirements assigned to them in every workplace of their
// entity, what to do on each, and what is waiting for the index owner.

type Group = "todo" | "rev" | "acc";
const GROUPS: { key: Group; label: string; sub: string }[] = [
  { key: "todo", label: "To do", sub: "Upload evidence, write the response and submit for review" },
  { key: "rev", label: "In review", sub: "Submitted; the index owner reviews them" },
  { key: "acc", label: "Accepted", sub: "Done for this review year" },
];
const groupOf = (s: Stage): Group => (s === "acc" ? "acc" : s === "rev" ? "rev" : "todo");
const STAGE_TONE: Record<Stage, PillTone> = { start: "gray", prog: "warn", rev: "cx", acc: "ok" };

export default function MyRequirementsPage() {
  const { user } = useAuth();
  const ws = useWorkspace();
  const views = useMyWorkplaces();
  const work = useWorkplacesWork(views);
  const [group, setGroup] = useState<Group>("todo");
  const today = ws.ctx.today;

  const rows = useMemo(
    () =>
      work.flatMap((w) =>
        w.reqs
          .filter((r) => !!user && r.owner === user.name)
          .map((r) => {
            const stage = stageOf(r, w.overlay);
            return { r, stage, returned: isReturned(r, w.overlay), w, href: clientHref(w.client.id, `/requirements/${encodeURIComponent(r.code)}`) };
          }),
      ),
    [work, user],
  );
  const counts = { todo: 0, rev: 0, acc: 0 } as Record<Group, number>;
  for (const x of rows) counts[groupOf(x.stage)] += 1;
  const shown = rows
    .filter((x) => groupOf(x.stage) === group)
    .sort((a, b) => Number(b.returned) - Number(a.returned) || a.r.due.localeCompare(b.r.due) || codeKey(a.r.code).localeCompare(codeKey(b.r.code)));
  const overdue = rows.filter((x) => groupOf(x.stage) === "todo" && x.r.due < today).length;
  const returned = rows.filter((x) => x.returned).length;

  return (
    <AppShell search="Search my requirements">
      <JMain max={1200}>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-j-muted">{user ? `Welcome, ${user.name.split(" ")[0]}${user.department ? ` · ${user.department}` : ""}` : ""}</span>
          <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">My requirements</h1>
        </div>

        <section aria-label="Summary" className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          {[
            ["Assigned to me", rows.length, "text-j-ink"],
            ["To do", counts.todo, "text-j-ink"],
            ["Overdue", overdue, overdue ? "text-j-bad" : "text-j-ink"],
            ["Returned to me", returned, returned ? "text-j-bad" : "text-j-ink"],
            ["Accepted", counts.acc, "text-brand"],
          ].map(([l, v, ink]) => (
            <div key={l as string} className="flex flex-col gap-1 rounded-2xl border border-[#E3E8EF] bg-white p-[18px]">
              <b className={cx("text-[26px] leading-[30px]", ink as string)}>{v}</b>
              <span className="text-[13px] text-j-muted">{l}</span>
            </div>
          ))}
        </section>

        <div role="tablist" aria-label="Status" className="flex flex-wrap gap-1.5">
          {GROUPS.map((g) => {
            const on = group === g.key;
            return (
              <button
                key={g.key}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setGroup(g.key)}
                className={cx("inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-[13px] font-semibold", on ? "border-cx bg-cx text-white" : "border-j-line bg-white text-j-ink-2")}
              >
                {g.label}
                <span className={cx("rounded-full px-2 py-0.5 text-[11px]", on ? "bg-cx-mid" : "bg-j-canvas")}>{counts[g.key]}</span>
              </button>
            );
          })}
        </div>
        <p className="m-0 -mt-2 text-[13px] text-j-muted">{GROUPS.find((g) => g.key === group)!.sub}</p>

        <Panel className="flex flex-col p-0">
          {shown.map(({ r, stage, returned: back, w, href }) => {
            const left = daysBetween(today, r.due);
            return (
              <Link key={`${w.client.id}-${r.code}`} href={href} className="flex flex-wrap items-center gap-3 border-b border-j-line-soft px-[22px] py-3.5 text-j-ink no-underline last:border-0 hover:bg-j-canvas hover:text-j-ink">
                <span className="min-w-[260px] flex-auto">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-j-muted">{r.code}</span>
                    {back && stage !== "acc" && <Pill tone="bad">Returned</Pill>}
                    {r.weight === "high" && <Pill tone="orange">Mandatory</Pill>}
                  </span>
                  <b className="mt-0.5 block text-sm">{r.title}</b>
                  <span className="text-xs text-j-muted">
                    {w.entity.name} · {w.framework ? shortName(w.framework.name) : ""} {w.workplace.year} · {r.evidence.valid} of {r.evidence.expected} evidence items
                  </span>
                </span>
                <span className={cx("text-xs font-semibold", stage !== "acc" && left < 0 ? "text-j-bad" : "text-j-muted")}>
                  {stage === "acc" ? "Accepted" : left < 0 ? `${-left} d overdue` : `Due ${shortDate(r.due)}`}
                </span>
                <Pill tone={STAGE_TONE[stage]}>{STAGE_OF[stage].label}</Pill>
                <Icon name="chevR" size={16} className="text-j-muted" />
              </Link>
            );
          })}
          {shown.length === 0 && (
            <p className="m-0 px-[22px] py-10 text-center text-sm text-j-muted">
              {rows.length ? "Nothing here right now." : "No requirements are assigned to you yet. Your index owner assigns them; they appear here straight away."}
            </p>
          )}
        </Panel>
      </JMain>
    </AppShell>
  );
}
