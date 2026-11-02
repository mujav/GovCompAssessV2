"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/journey/icon";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Avatar, JButton, Panel, PanelHead, Pill, Ring, Segmented } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { daysBetween } from "@/lib/workspace/data";
import { clientHref } from "@/lib/journey/portfolio";
import { useScreenState } from "@/lib/journey/store";
import { useClientWork } from "@/lib/journey/use-work";
import { initials, isReturned, stageOf } from "@/lib/journey/work";

// 15 · Departments. Completion and responsiveness per client department, to steer chasing.

const AV: [string, string][] = [["#FDE9D9", "#9A3412"], ["#E0ECF8", "#1E4E8C"], ["#E6E4FB", "#3F37A8"], ["#DDEFE6", "#0E5A45"], ["#F3E8F7", "#7A2E8C"]];
const MIX = [
  ["Accepted", "#1F9D6E"],
  ["In progress", "#E0A100"],
  ["Returned", "#D9442E"],
  ["Not started", "#C9D1CD"],
] as const;

const ragColor = (r: number) => (r >= 85 ? "#1F9D6E" : r >= 60 ? "#E0A100" : "#D9442E");
const ragInk = (r: number) => (r >= 85 ? "text-brand" : r >= 60 ? "text-[#8A4B00]" : "text-j-bad");

/** Heat-map cell colour: good, watch or act. */
function level(v: number, good: number, bad: number, higherBetter: boolean): [string, string] {
  const ok = higherBetter ? v >= good : v <= good;
  const no = higherBetter ? v < bad : v > bad;
  return no ? ["#FAD6D0", "#8C1D12"] : ok ? ["#DDF0E6", "#0B4A38"] : ["#FFF0CC", "#6B3F05"];
}

export default function DepartmentsPage() {
  const { client, ws, reqs, overlay, log } = useClientWork();
  const [order, setOrder] = useState<"low" | "high">("low");
  const [sent, setSent] = useScreenState<boolean>(`departments.${client.id}.report`, false);
  const today = ws.ctx.today;
  const c = (p: string) => clientHref(client.id, p);

  const depts = useMemo(() => {
    const map = new Map<string, { lead: string; mix: number[]; overdue: number; lastDue: string }>();
    for (const r of reqs) {
      if (r.status === "na") continue;
      const e = map.get(r.department) ?? { lead: r.owner, mix: [0, 0, 0, 0], overdue: 0, lastDue: "0000" };
      const s = stageOf(r, overlay);
      e.mix[s === "acc" ? 0 : isReturned(r, overlay) ? 2 : s === "start" ? 3 : 1] += 1;
      if (s !== "acc" && r.due < today) e.overdue += 1;
      if (r.due <= today && r.due > e.lastDue) e.lastDue = r.due;
      map.set(r.department, e);
    }
    return [...map.entries()].map(([name, e], i) => {
      const total = e.mix.reduce((a, b) => a + b, 0);
      const ready = Math.round(((e.mix[0] + e.mix[1] * 0.5) / total) * 100);
      const last = e.lastDue === "0000" ? 30 : daysBetween(e.lastDue, today);
      const rate = Math.max(30, Math.min(100, 100 - e.overdue * 6 - e.mix[2] * 2));
      return {
        name,
        lead: e.lead,
        tone: AV[i % AV.length],
        total,
        mix: e.mix,
        ready,
        overdue: e.overdue,
        last,
        rate,
        esc: e.overdue >= 5,
        heat: [
          [`${rate}%`, level(rate, 85, 60, true)],
          [`${(1 + e.overdue * 0.9).toFixed(1)}d`, level(1 + e.overdue * 0.9, 3, 6, false)],
          [(1 + e.mix[2] * 0.15).toFixed(1), level(1 + e.mix[2] * 0.15, 1.5, 2.2, false)],
          [String(Math.round(e.overdue / 2)), level(Math.round(e.overdue / 2), 1, 4, false)],
          [`${Math.max(1, 4 - Math.floor(e.overdue / 3))}/4`, level(Math.max(1, 4 - Math.floor(e.overdue / 3)), 4, 2, true)],
        ] as [string, [string, string]][],
      };
    });
  }, [reqs, overlay, today]);

  const rows = [...depts].sort((a, b) => (order === "low" ? a.ready - b.ready : b.ready - a.ready));

  return (
    <ClientShell>
      <JMain>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Departments</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label="Order"
              value={order}
              options={[
                { value: "low", label: "Lowest first" },
                { value: "high", label: "Highest first" },
              ]}
              onChange={setOrder}
            />
            <JButton
              variant="primary"
              disabled={sent}
              onClick={() => {
                setSent(() => true);
                log(`Department report sent to Noura A. · ${client.name}`);
              }}
            >
              {sent ? "Report sent" : "Send client report"}
            </JButton>
          </div>
        </div>

        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <div role="table" aria-label="Departments" className="min-w-[980px] text-sm">
              <div role="row" className="grid grid-cols-[2.2fr_1fr_1.6fr_0.7fr_0.9fr_1.1fr_44px] gap-3 border-b border-j-line px-[22px] py-2.5 text-xs font-semibold text-j-muted">
                {["Department", "Completion", "Acceptance mix", "Overdue", "Last update", "Response"].map((h) => (
                  <span key={h} role="columnheader">
                    {h}
                  </span>
                ))}
                <span role="columnheader">
                  <span className="sr-only">Open</span>
                </span>
              </div>
              {rows.map((d) => (
                <div key={d.name} role="row" className="grid grid-cols-[2.2fr_1fr_1.6fr_0.7fr_0.9fr_1.1fr_44px] items-center gap-3 border-b border-j-line-soft px-[22px] py-3">
                  <span role="cell" className="flex min-w-0 items-center gap-2.5">
                    <Avatar initials={initials(d.lead)} bg={d.tone[0]} fg={d.tone[1]} size={34} />
                    <span className="flex min-w-0 flex-col">
                      <b className="truncate">{d.name}</b>
                      <span className="text-xs text-j-muted">{d.total} requirements</span>
                    </span>
                    {d.esc && (
                      <span title="Escalation criteria met" className="text-j-bad">
                        <Icon name="flag" size={15} />
                      </span>
                    )}
                  </span>
                  <span role="cell" className="flex items-center gap-2">
                    <Ring pct={d.ready} color={ragColor(d.ready)} size={30} thickness={4} label={`${d.ready}% completion`} />
                    <b className={ragInk(d.ready)}>{d.ready}%</b>
                  </span>
                  <span role="cell" aria-label={MIX.map(([l], i) => `${d.mix[i]} ${l.toLowerCase()}`).join(", ")} className="flex h-2.5 gap-0.5 overflow-hidden rounded-[5px]">
                    {d.mix.map((n, i) => (n ? <span key={i} style={{ flex: n, background: MIX[i][1] }} /> : null))}
                  </span>
                  <span role="cell">
                    <Pill tone={d.overdue >= 5 ? "bad" : d.overdue ? "warn" : "ok"}>{d.overdue}</Pill>
                  </span>
                  <span role="cell" className={cx("text-[13px]", d.last > 10 ? "font-semibold text-j-bad" : "text-j-muted")}>
                    {d.last <= 0 ? "Today" : d.last === 1 ? "Yesterday" : `${d.last} days`}
                  </span>
                  <span role="cell" className="flex items-center gap-2">
                    <span className="block h-1.5 flex-auto overflow-hidden rounded-[3px] bg-j-line-soft">
                      <span className="block h-full" style={{ width: `${d.rate}%`, background: ragColor(d.rate) }} />
                    </span>
                    <span className="w-9 text-xs font-semibold">{d.rate}%</span>
                  </span>
                  <span role="cell">
                    <Link href={c(`/requirements`)} aria-label={`Open ${d.name}`} className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-cx-soft text-cx hover:text-cx">
                      <Icon name="chevR" size={18} />
                    </Link>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4 px-[22px] py-3 text-xs text-j-muted">
            {MIX.map(([l, col]) => (
              <span key={l} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: col }} />
                {l}
              </span>
            ))}
          </div>
        </Panel>

        <Panel className="flex flex-col gap-4 p-[22px]">
          <PanelHead
            title="Engagement"
            aside={
              <span className="flex gap-3 text-xs text-j-muted">
                {[
                  ["#DDF0E6", "Good"],
                  ["#FFF0CC", "Watch"],
                  ["#FAD6D0", "Act"],
                ].map(([col, l]) => (
                  <span key={l} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: col }} />
                    {l}
                  </span>
                ))}
              </span>
            }
          />
          <div className="overflow-x-auto">
            <div role="table" aria-label="Engagement heat map" className="grid min-w-[760px] grid-cols-[1.8fr_repeat(5,1fr)] gap-1.5 text-[13px]">
              {["", "Response rate", "Days to evidence", "Review loops", "No update", "Meetings"].map((h, i) => (
                <span key={i} role="columnheader" className="text-center text-xs font-semibold text-j-muted">
                  {h}
                </span>
              ))}
              {rows.map((d) => (
                <div key={d.name} role="row" className="contents">
                  <span role="rowheader" className="flex items-center font-semibold">
                    {d.name}
                  </span>
                  {d.heat.map(([v, [bg, fg]], i) => (
                    <span key={i} role="cell" className="rounded-lg py-2 text-center font-semibold" style={{ background: bg, color: fg }}>
                      {v}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </JMain>
    </ClientShell>
  );
}
