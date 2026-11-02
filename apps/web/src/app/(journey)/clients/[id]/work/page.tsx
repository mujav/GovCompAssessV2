"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/journey/icon";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Avatar, JButton, JLink, Panel, PanelHead, Pill, type PillTone } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { daysBetween } from "@/lib/workspace/data";
import { clientHref } from "@/lib/journey/portfolio";
import { useScreenState } from "@/lib/journey/store";
import { useClientWork } from "@/lib/journey/use-work";
import { codeKey, initials, stageOf } from "@/lib/journey/work";

// 10 · My work. Everything the consultant has handed off or must act on, by counterpart.

const TABS = ["Reviews", "To SPOCs", "To client", "Escalations"] as const;
const RULES = ["Auto-remind every 3 days", "Escalate after 2 reminders", "Weekly summary to index owner"];
const PATH = [
  ["SPOC", "Day 0"],
  ["Department head", "After 2 reminders"],
  ["Index owner", "After 10 days"],
];

interface Row {
  key: string;
  t: string;
  code: string;
  href: string;
  av: string;
  who: string;
  role: string;
  since: string;
  st: [string, PillTone];
  actions: { label: string; run?: () => void; href?: string; primary?: boolean }[];
}

interface WorkScreen {
  rules: boolean[];
  reminded: Record<string, number>;
  escalated: { id: string; dept: string; who: string; codes: string[] }[];
}

const ago = (d: number) => (d <= 0 ? "Today" : d === 1 ? "Yesterday" : `${d} d ago`);

export default function MyWorkPage() {
  const { client, ws, reqs, overlay, move, ret, log } = useClientWork();
  const [tab, setTab] = useState(0);
  const [s, set] = useScreenState<WorkScreen>(`work-screen.${client.id}`, { rules: [true, true, false], reminded: {}, escalated: [] });
  const [toast, setToast] = useState("");
  const today = ws.ctx.today;
  const c = (p: string) => clientHref(client.id, p);
  const flash = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(""), 4000);
  };

  const remind = (ids: string[], text: string) => {
    set((d) => {
      for (const id of ids) d.reminded[id] = (d.reminded[id] ?? 0) + 1;
    });
    log(text);
    flash(text);
  };

  const data = useMemo(() => {
    const byStage = (st: string) => reqs.filter((r) => stageOf(r, overlay) === st).sort((a, b) => a.due.localeCompare(b.due) || codeKey(a.code).localeCompare(codeKey(b.code)));
    const reviews: Row[] = byStage("rev").map((r) => {
      const ai = r.review === "ai" || r.review === "none";
      return {
        key: r.code,
        t: r.title,
        code: r.code,
        href: c(`/requirements/${r.code}`),
        av: ai ? "AI" : initials(r.owner),
        who: ai ? "AI check" : r.owner || "Unassigned",
        role: ai ? `${r.status === "comp" ? "Ready" : "Not ready"} · ${r.status === "comp" ? 94 : 86}%` : "New evidence",
        since: ago(Math.abs(daysBetween(r.due, today)) % 4),
        st: ["To review", "cx"],
        actions: [{ label: "Review", href: c(`/requirements/${r.code}`), primary: true }],
      };
    });
    const open = ws.ctx.actions.filter((a) => {
      const r = reqs.find((x) => x.code === a.code);
      return r && stageOf(r, overlay) === "prog";
    });
    const spoc: Row[] = open
      .sort((a, b) => a.due.localeCompare(b.due))
      .map((a) => {
        const r = reqs.find((x) => x.code === a.code)!;
        const sentAgo = Math.max(1, daysBetween(a.due, today) + 7);
        const late = a.due < today;
        const extra = s.reminded[a.id] ?? 0;
        const total = a.reminders + extra;
        return {
          key: a.id,
          t: `Evidence · ${r.title.split(":")[0]}`,
          code: a.code,
          href: c(`/requirements/${a.code}`),
          av: initials(a.owner),
          who: a.owner || "Unassigned",
          role: a.department,
          since: ago(sentAgo),
          st: extra ? [`Reminded ×${total}`, "cx"] : late ? ["Overdue", "bad"] : total ? ["Opened", "cx"] : ["Not opened", "gray"],
          actions: [
            { label: "Remind", run: () => remind([a.id], `Reminder sent to ${a.owner || a.department} for ${a.code}`) },
            ...(late && total >= 2 && !s.escalated.some((e) => e.codes.includes(a.code))
              ? [
                  {
                    label: "Escalate",
                    run: () => {
                      ws.createDraft("escalation", [a.code]);
                      set((d) => void d.escalated.unshift({ id: `ESC-${10 + d.escalated.length}`, dept: a.department, who: "Department head", codes: [a.code] }));
                      log(`Escalated ${a.code} to the ${a.department} head`);
                      flash(`Escalation drafted for ${a.code}. Review it in Outbox before it is sent.`);
                    },
                  },
                ]
              : []),
          ],
        };
      });
    const client_: Row[] = byStage("cli").map((r) => ({
      key: r.code,
      t: r.title,
      code: r.code,
      href: c(`/requirements/${r.code}`),
      av: "NA",
      who: "Noura A.",
      role: "Index owner",
      since: ago(Math.abs(daysBetween(r.due, today)) % 9),
      st: ["Reviewing", "warn"],
      actions: [
        {
          label: "Record acceptance",
          primary: true,
          run: () => {
            move([r.code], "acc", `Noura A. accepted ${r.code}`);
            flash(`${r.code} accepted by the client. It is now in the submission pack.`);
          },
        },
        { label: "Returned", run: () => ret([r.code], `Noura A. returned ${r.code}`) },
      ],
    }));
    const esc: Row[] = [
      ...s.escalated.map((e) => ({
        key: e.id,
        t: `${e.dept} · ${e.codes.join(", ")}`,
        code: e.id,
        href: c(`/requirements/${e.codes[0]}`),
        av: "DH",
        who: e.who,
        role: e.dept,
        since: "Today",
        st: ["Draft · in Outbox", "ai"] as [string, PillTone],
        actions: [{ label: "Open", href: c(`/requirements/${e.codes[0]}`) }],
      })),
      { key: "ESC-02", t: "Human Capital · 9 overdue", code: "ESC-02", href: c("/departments"), av: "HD", who: "Hamad D.", role: "Exec. Director, HC", since: "1 d ago", st: ["Opened", "cx"], actions: [{ label: "Open", href: c("/departments") }] },
      { key: "ESC-01", t: "IT & Digital · catalogue", code: "ESC-01", href: c("/departments"), av: "KA", who: "Khalid A.", role: "IT & Digital", since: "9 d ago", st: ["Answered", "ok"], actions: [{ label: "Open", href: c("/departments") }] },
    ];
    return { reviews, spoc, client: client_, esc, overdue: open.filter((a) => a.due < today) };
  }, [reqs, overlay, ws, s, today, client.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const lists = [data.reviews, data.spoc, data.client, data.esc];
  const rows = lists[tab];

  return (
    <ClientShell workBadge={String(data.reviews.length + data.overdue.length)}>
      <JMain>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">My work</h1>
          <div className="flex flex-wrap gap-2">
            <JButton disabled={!data.overdue.length} onClick={() => remind(data.overdue.map((a) => a.id), `Reminded ${data.overdue.length} overdue hand-offs`)}>
              Remind all overdue
            </JButton>
            <JLink href={c("/requirements")} variant="primary">
              <Icon name="plus" size={15} />
              New request
            </JLink>
          </div>
        </div>

        <div role="tablist" aria-label="Hand-offs" className="flex flex-wrap gap-1.5">
          {TABS.map((l, i) => {
            const on = tab === i;
            return (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setTab(i)}
                className={cx("inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-4 text-[13px] font-semibold", on ? "border-cx bg-cx text-white" : "border-j-line bg-white text-j-ink-2")}
              >
                {l}
                <span className={cx("rounded-full px-2 py-0.5 text-[11px]", on ? "bg-cx-mid" : "bg-j-canvas")}>{lists[i].length}</span>
              </button>
            );
          })}
        </div>

        {toast && (
          <p role="status" className="m-0 flex items-center gap-2 rounded-xl bg-[#E7F3ED] px-4 py-3 text-sm font-semibold text-brand">
            <Icon name="check" size={15} />
            {toast}
          </p>
        )}

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="min-w-0 flex-[3_1_640px] overflow-hidden">
            <div className="overflow-x-auto">
              <div role="table" aria-label={TABS[tab]} className="min-w-[760px] text-sm">
                <div role="row" className="grid grid-cols-[2.2fr_1.5fr_0.8fr_1fr_1.4fr] gap-3 border-b border-j-line px-[18px] py-2.5 text-xs font-semibold text-j-muted">
                  {["Requirement", "With", "Since", "Status", ""].map((h, i) => (
                    <span key={i} role="columnheader">
                      {h}
                    </span>
                  ))}
                </div>
                {rows.slice(0, 40).map((r) => (
                  <div key={r.key} role="row" className="grid grid-cols-[2.2fr_1.5fr_0.8fr_1fr_1.4fr] items-center gap-3 border-b border-j-line-soft px-[18px] py-3">
                    <span role="cell" className="min-w-0">
                      <Link href={r.href} className="block truncate font-semibold text-j-ink hover:text-cx">
                        {r.t}
                      </Link>
                      <span className="font-mono text-xs text-j-muted">{r.code}</span>
                    </span>
                    <span role="cell" className="flex min-w-0 items-center gap-2">
                      <Avatar initials={r.av} size={30} bg={r.av === "AI" ? "#EEEDFD" : undefined} fg={r.av === "AI" ? "#4F46E5" : undefined} />
                      <span className="min-w-0 leading-[17px]">
                        <span className="block truncate">{r.who}</span>
                        <span className="block truncate text-xs text-j-muted">{r.role}</span>
                      </span>
                    </span>
                    <span role="cell" className="text-[13px] text-j-muted">
                      {r.since}
                    </span>
                    <span role="cell">
                      <Pill tone={r.st[1]}>{r.st[0]}</Pill>
                    </span>
                    <span role="cell" className="flex flex-wrap justify-end gap-1.5">
                      {r.actions.map((a) =>
                        a.href ? (
                          <JLink key={a.label} href={a.href} size="sm" variant={a.primary ? "outline" : "secondary"}>
                            {a.label}
                          </JLink>
                        ) : (
                          <JButton key={a.label} size="sm" variant={a.primary ? "outline" : a.label === "Escalate" ? "dark" : "secondary"} onClick={a.run}>
                            {a.label}
                          </JButton>
                        ),
                      )}
                    </span>
                  </div>
                ))}
                {rows.length === 0 && <p className="m-0 px-[18px] py-8 text-center text-sm text-j-muted">Nothing here right now.</p>}
                {rows.length > 40 && <p className="m-0 px-[18px] py-3 text-xs text-j-muted">Showing the first 40 of {rows.length}, soonest first.</p>}
              </div>
            </div>
          </Panel>
          <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-3.5">
            <Panel className="flex flex-col gap-3 p-[22px]">
              <PanelHead title="Reminders" />
              {RULES.map((label, i) => {
                const on = s.rules[i];
                return (
                  <div key={label} className="flex items-center justify-between gap-3 text-sm">
                    <span>{label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={label}
                      onClick={() => {
                        set((d) => void (d.rules[i] = !on));
                        log(`${label}: ${on ? "off" : "on"}`);
                      }}
                      className={cx("flex h-6 w-11 flex-none cursor-pointer items-center rounded-full border-0 p-0.5", on ? "justify-end bg-cx" : "justify-start bg-j-field")}
                    >
                      <span className="h-5 w-5 rounded-full bg-white" />
                    </button>
                  </div>
                );
              })}
            </Panel>
            <Panel className="flex flex-col gap-3 p-[22px]">
              <h2 className="m-0 text-base">Escalation path</h2>
              <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
                {PATH.map(([l, when], i) => (
                  <li key={l} className="flex items-center gap-2.5 text-sm">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cx-soft text-xs font-bold text-cx">{i + 1}</span>
                    <b className="flex-auto">{l}</b>
                    <span className="text-xs text-j-muted">{when}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          </aside>
        </div>
      </JMain>
    </ClientShell>
  );
}
