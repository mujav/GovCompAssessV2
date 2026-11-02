"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/journey/icon";
import { Avatar, Bar, Chips, JLink, Pill, type PillTone } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { CONSULTANT, LOGO, clientHref, completionColor, type Flag, type Tone } from "@/lib/journey/portfolio";
import { useJourney } from "@/lib/journey/store";

// 02 · Workspace chooser. After SSO the consultant picks the entity to work on.

const NEXT_TONE: Record<Tone, PillTone> = { ok: "ok", warn: "warn", late: "bad", draft: "draft" };

type F = "all" | Flag;

export default function EntitiesPage() {
  const { clients } = useJourney();
  const [filter, setFilter] = useState<F>("all");
  const [q, setQ] = useState("");

  const count = (f: Flag) => clients.filter((c) => c.flag === f).length;
  const shown = clients.filter((c) => (filter === "all" || c.flag === filter) && c.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div className="flex min-h-screen flex-col bg-j-canvas text-j-ink">
      <header className="flex items-center gap-3 border-b border-j-line bg-white px-8 py-3.5">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-brand text-white">
          <Icon name="shield" size={18} />
        </span>
        <span className="leading-[17px]">
          <b className="text-sm">Compliance Intelligence</b>
          <br />
          <span className="text-xs text-j-muted">by {CONSULTANT.firm}</span>
        </span>
        <span className="flex-auto" />
        <Pill tone="cx" className="font-bold">
          Consultant
        </Pill>
        <span className="flex items-center gap-2.5 text-[13px]">
          <Avatar initials={CONSULTANT.initials} />
          <span className="leading-[17px]">
            <b>{CONSULTANT.name}</b>
            <br />
            <span className="text-j-muted">Company SSO</span>
          </span>
        </span>
        <JLink href="/login" size="sm" className="font-normal text-j-ink-2">
          Sign out
        </JLink>
      </header>

      <main className="mx-auto box-border flex w-full max-w-[1120px] flex-auto flex-col gap-[22px] px-6 pt-11 pb-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 text-[32px] leading-10 font-bold tracking-[-0.02em]">Which entity are you working on?</h1>
            <span className="text-[15px] text-j-muted">
              {clients.length - count("draft")} entities assigned to you · {count("attn")} need attention this week
            </span>
          </div>
          <JLink href="/portfolio" className="border-j-field">
            <Icon name="grid" size={16} />
            Portfolio overview
          </JLink>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex h-[46px] flex-[1_1_320px] items-center gap-2 rounded-xl border border-j-line bg-white px-3.5 text-j-muted">
            <Icon name="search" size={16} />
            <span className="sr-only">Search entities</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search entities"
              className="min-w-0 flex-auto border-0 bg-transparent text-sm text-j-ink outline-none"
            />
          </label>
          <Chips
            label="Filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", n: clients.length },
              { value: "attn", label: "Needs attention", n: count("attn") },
              { value: "active", label: "On track", n: count("active") },
              { value: "draft", label: "Drafts", n: count("draft") },
            ]}
          />
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3.5">
          <Link
            href="/portfolio/onboard"
            className="flex min-h-[196px] flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed border-[#9FC9B7] bg-[#F3FAF6] p-5 text-center text-brand no-underline hover:text-brand"
          >
            <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-brand text-white">
              <Icon name="plus" size={22} />
            </span>
            <span>
              <b className="text-[17px]">Add an entity</b>
              <br />
              <span className="text-[13px] text-j-ink-2">Profile, stakeholders, framework history</span>
            </span>
          </Link>
          {shown.map((c) => {
            const [lbg, lfg] = LOGO[c.logo];
            return (
              <Link
                key={c.id}
                href={c.flag === "draft" ? "/portfolio/onboard" : clientHref(c.id)}
                className={cx(
                  "box-border flex min-h-[196px] flex-col gap-3.5 rounded-[20px] border bg-white p-5 text-j-ink no-underline hover:text-j-ink hover:shadow-[0_2px_10px_rgba(16,28,23,0.06)]",
                  c.nextTone === "late" ? "border-[#F0C2BA]" : "border-j-line",
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-[14px] text-sm font-bold" style={{ background: lbg, color: lfg }}>
                    {c.ini}
                  </span>
                  <span className="min-w-0 flex-auto">
                    <b className="text-base">{c.name}</b>
                    <br />
                    <span className="text-[13px] text-j-muted">{c.sub}</span>
                  </span>
                  <Icon name="chevR" size={18} className="text-j-muted" />
                </span>
                <span className="flex flex-wrap gap-1.5">
                  {c.frameworks.map((w) => (
                    <Pill key={w}>{w}</Pill>
                  ))}
                </span>
                <span className="mt-auto flex items-center gap-3">
                  <span className="flex flex-auto flex-col gap-1.5">
                    <span className="flex justify-between text-xs">
                      <span className="text-j-muted">Completion</span>
                      <b>{c.pct == null ? "—" : `${c.pct}%`}</b>
                    </span>
                    <Bar pct={c.pct ?? 0} color={completionColor(c.pct)} />
                  </span>
                  <Pill tone={NEXT_TONE[c.nextTone]} round={false}>
                    {c.next}
                  </Pill>
                </span>
              </Link>
            );
          })}
        </div>
        {shown.length === 0 && <p className="m-0 text-center text-sm text-j-muted">No entities match.</p>}
      </main>
    </div>
  );
}
