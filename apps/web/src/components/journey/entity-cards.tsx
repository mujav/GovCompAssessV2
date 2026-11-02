"use client";

import Link from "next/link";
import { cx } from "@/components/ui";
import { LOGO, clientHref, completionColor, type Client, type Tone } from "@/lib/journey/portfolio";
import { Icon } from "./icon";
import { Bar, Pill, type PillTone } from "./ui";

const NEXT_TONE: Record<Tone, PillTone> = { ok: "ok", warn: "warn", late: "bad", draft: "draft" };

/** The portfolio's card view: one card per entity, opening its workspace. */
export function EntityCards({ clients }: { clients: Client[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5 p-[22px] pt-0">
      <Link
        href="/portfolio/onboard"
        className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-[20px] border-2 border-dashed border-cx-line bg-cx-tint p-5 text-center text-cx no-underline hover:border-cx hover:text-cx"
      >
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-cx text-white">
          <Icon name="plus" size={22} />
        </span>
        <span>
          <b className="text-[17px]">Add entity</b>
          <br />
          <span className="text-[13px] text-j-ink-2">Profile, people, frameworks</span>
        </span>
      </Link>
      {clients.map((c) => {
        const [lbg, lfg] = LOGO[c.logo];
        return (
          <Link
            key={c.id}
            href={clientHref(c.id)}
            className={cx(
              "box-border flex min-h-[180px] flex-col gap-3.5 rounded-[20px] border bg-white p-5 text-j-ink no-underline hover:text-j-ink hover:shadow-[0_2px_10px_rgba(16,28,23,0.06)]",
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
  );
}
