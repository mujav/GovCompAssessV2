"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/journey/icon";
import { ConsultantShell, JMain } from "@/components/journey/shell";
import { Avatar, JButton, JLink, Panel, PanelHead, Pill, Ring, type PillTone } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { ENGAGEMENTS, LOGO, clientHref, readyColor, type Model } from "@/lib/journey/portfolio";
import { useJourney, useScreenState } from "@/lib/journey/store";

// 03 · Portfolio cockpit. Metadata only: the consultant sees every assigned client and
// opens one to work inside it.

const MODEL: Record<Model, [string, PillTone]> = { managed: ["Managed", "cx"], co: ["Co-managed", "ai"], draft: ["Draft", "warn"] };
const TERM = { ok: ["#1F9D6E", "#0E5A45"], soon: ["#E0A100", "#8A4B00"], pend: ["#C2410C", "#9A3412"] } as const;
const COLS = "grid-cols-[2.2fr_0.9fr_1.1fr_1fr_1fr_1fr_0.7fr_44px]";

const TEAM: [string, string, number[]][] = [
  ["SR", "Sami R. · Lead", [80, 95, 118, 90]],
  ["LA", "Layla A.", [70, 88, 112, 85]],
  ["MK", "Mohammed K.", [90, 104, 126, 92]],
  ["RN", "Rana N. · QA", [55, 70, 96, 80]],
  ["YT", "Yasser T.", [40, 52, 74, 60]],
];

const heat = (v: number) => (v > 100 ? ["#FAD6D0", "#8C1D12"] : v > 85 ? ["#FFF0CC", "#6B3F05"] : ["#E6F0FA", "#1E4E8C"]);

const EXPIRING: { id: string; name: string; what: string; cta: string; done: string; tone: PillTone }[] = [
  { id: "renew", name: "Demo Ministry of Services", what: "Qiyas + NCA ECC · 41 days", cta: "Request renewal", done: "Renewal requested", tone: "warn" },
  { id: "kickoff", name: "Demo Skills Fund", what: "New client · kickoff not scheduled", cta: "Schedule kickoff", done: "Kickoff scheduled", tone: "bad" },
  { id: "jit", name: "Demo Ports Authority", what: "Secret items need JIT access", cta: "Request JIT", done: "JIT requested", tone: "cx" },
];

export default function PortfolioPage() {
  const { clients, engagements, state, log } = useJourney();
  const [done, setDone] = useScreenState<string[]>("portfolio.done", []);
  const [q, setQ] = useState("");
  const added = state.added.length;
  const addedEngagements = engagements.length - ENGAGEMENTS.length;

  const rows = engagements
    .map((e) => ({ e, c: clients.find((c) => c.id === e.clientId)! }))
    .filter(({ c, e }) => `${c.name} ${e.index}`.toLowerCase().includes(q.trim().toLowerCase()));

  const kpis: { v: number; l: string; icon: IconName; tone: PillTone }[] = [
    { v: 12 + added, l: "Clients", icon: "ent", tone: "cx" },
    { v: 15 + addedEngagements, l: "Index engagements", icon: "eng", tone: "cx" },
    { v: 6, l: "Milestones ≤ 14 days", icon: "clock", tone: "warn" },
    { v: 2, l: "Terms ending", icon: "key", tone: "bad" },
  ];

  return (
    <ConsultantShell search="Search clients and engagements">
      <JMain>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Good evening, Sami</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Portfolio</h1>
          </div>
          <JLink href="/portfolio/onboard" variant="primary">
            <Icon name="plus" size={16} />
            Onboard client
          </JLink>
        </div>

        <section aria-label="Portfolio indicators" className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          {kpis.map((k) => (
            <div key={k.l} className="flex flex-col gap-2 rounded-2xl border border-[#E3E8EF] bg-white p-[18px]">
              <Pill tone={k.tone} round={false} className="h-9 w-9 justify-center rounded-[10px] p-0">
                <Icon name={k.icon} size={18} />
              </Pill>
              <b className={cx("text-[26px] leading-[30px]", k.tone === "warn" ? "text-[#8A4B00]" : k.tone === "bad" ? "text-j-bad" : "text-j-ink")}>{k.v}</b>
              <span className="text-[13px] text-j-muted">{k.l}</span>
            </div>
          ))}
        </section>

        <section className="flex flex-wrap items-center gap-4 rounded-[20px] bg-cx px-[22px] py-[18px] text-white">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2E62A6]">
            <Icon name="calendar" size={18} />
          </span>
          <span className="flex-[1_1_320px]">
            <b className="text-base">Qiyas verification opens in 9 days</b>
            <br />
            <span className="text-[13px] text-cx-line">8 clients hit the same window</span>
          </span>
          <a href="#team" className="inline-flex h-10 items-center rounded-[10px] bg-white px-3.5 text-[13px] font-semibold text-cx no-underline hover:text-cx">
            Rebalance team
          </a>
        </section>

        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-[22px] py-[18px]">
            <h2 className="m-0 text-base">Clients · {rows.length}</h2>
            <label className="flex h-9 items-center gap-2 rounded-[10px] bg-j-canvas px-3 text-j-muted">
              <Icon name="filter" size={14} />
              <span className="sr-only">Filter clients</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter" className="w-36 border-0 bg-transparent text-[13px] text-j-ink outline-none" />
            </label>
            <span title="Only clients you are assigned to are shown. Open one to work inside it." className="inline-flex items-center gap-1.5 text-xs text-j-muted">
              <Icon name="lock" size={13} />
              Metadata only ⓘ
            </span>
          </div>
          <div className="overflow-x-auto">
            <div role="table" aria-label="Clients" className="min-w-[1000px] text-sm">
              <div role="row" className={cx("grid items-center gap-3 border-y border-[#E3E8EF] px-[22px] py-2.5 text-xs font-semibold text-j-muted", COLS)}>
                {["Client", "Framework", "Model", "Completion", "Next milestone", "Term", "Lead"].map((h) => (
                  <span key={h} role="columnheader">
                    {h}
                  </span>
                ))}
                <span role="columnheader">
                  <span className="sr-only">Open</span>
                </span>
              </div>
              {rows.map(({ e, c }) => {
                const [lbg, lfg] = LOGO[c.logo];
                const [model, mTone] = MODEL[e.model];
                const href = clientHref(c.id, "/360");
                return (
                  <div key={`${e.clientId}-${e.frameworkId ?? e.index}`} role="row" className={cx("grid items-center gap-3 border-b border-[#EEF1F5] bg-white px-[22px] py-3", COLS)}>
                    <span role="cell" className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] text-[11px] font-bold" style={{ background: lbg, color: lfg }}>
                        {c.ini}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <b className="truncate text-sm">{c.name}</b>
                        <span className="text-xs text-j-muted">{c.sub}</span>
                      </span>
                    </span>
                    <span role="cell">
                      <span className="rounded-md bg-j-canvas px-2 py-[3px] text-xs font-semibold">{e.index}</span>
                    </span>
                    <span role="cell">
                      <Pill tone={mTone} className="py-[3px]">
                        {model}
                      </Pill>
                    </span>
                    <span role="cell" className="flex items-center gap-2">
                      <Ring pct={e.ready ?? 0} color={readyColor(e.ready)} size={30} thickness={4} track="#EEF1F5" label={e.ready == null ? "Not started" : `${e.ready}%`} />
                      <b className="text-[13px]">{e.ready == null ? "—" : `${e.ready}%`}</b>
                    </span>
                    <span role="cell" className={cx("text-[13px] font-semibold", e.milestoneLate ? "text-j-bad" : "text-j-ink-2")}>
                      {e.milestone}
                    </span>
                    <span role="cell" className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: TERM[e.termState][1] }}>
                      <span className="h-2 w-2 rounded-full" style={{ background: TERM[e.termState][0] }} />
                      {e.term}
                    </span>
                    <span role="cell">
                      <Avatar initials={e.lead} size={28} />
                    </span>
                    <span role="cell">
                      <Link href={href} aria-label={`Open ${c.name}`} className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-cx-soft text-cx hover:text-cx">
                        <Icon name="chevR" size={18} />
                      </Link>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-3.5">
          <Panel id="team" className="flex scroll-mt-6 flex-col gap-3.5 p-[22px]">
            <PanelHead title="Team capacity · next 4 weeks" aside={<span className="text-xs text-j-muted">Week 3 is the verification window</span>} />
            <div role="table" aria-label="Team capacity" className="flex flex-col gap-1.5 text-[13px]">
              <div role="row" className="grid grid-cols-[1.6fr_repeat(4,1fr)] gap-1.5 text-xs font-semibold text-j-muted">
                <span role="columnheader">Member</span>
                {["W1", "W2", "W3", "W4"].map((w) => (
                  <span key={w} role="columnheader" className="text-center">
                    {w}
                  </span>
                ))}
              </div>
              {TEAM.map(([av, name, weeks]) => (
                <div key={av} role="row" className="grid grid-cols-[1.6fr_repeat(4,1fr)] items-center gap-1.5">
                  <span role="cell" className="flex items-center gap-2">
                    <Avatar initials={av} size={26} />
                    {name}
                  </span>
                  {weeks.map((v, i) => {
                    const [bg, fg] = heat(v);
                    return (
                      <span key={i} role="cell" className="rounded-lg py-1.5 text-center text-xs font-semibold" style={{ background: bg, color: fg }}>
                        {v}%
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="flex flex-col gap-3 p-[22px]">
            <PanelHead title="Terms and access" />
            {EXPIRING.map((x) => {
              const isDone = done.includes(x.id);
              return (
                <div key={x.id} className="flex flex-wrap items-center gap-3 border-b border-j-line-soft pb-3 last:border-0 last:pb-0">
                  <span className="min-w-0 flex-auto text-sm">
                    <b>{x.name}</b>
                    <br />
                    <span className="text-[13px] text-j-muted">{x.what}</span>
                  </span>
                  {isDone ? (
                    <Pill tone="ok">
                      <Icon name="check" size={12} />
                      {x.done}
                    </Pill>
                  ) : (
                    <JButton
                      size="sm"
                      onClick={() => {
                        setDone((d) => void d.push(x.id));
                        log(`${x.done} · ${x.name}`);
                      }}
                    >
                      {x.cta}
                    </JButton>
                  )}
                </div>
              );
            })}
          </Panel>
        </div>
      </JMain>
    </ConsultantShell>
  );
}
