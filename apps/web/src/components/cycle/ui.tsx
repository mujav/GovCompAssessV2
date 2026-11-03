"use client";

// Small pieces the cycle screens share: stage and tier badges, KPI tiles, a centred dialog,
// AI boxes and a toast.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/components/ui";
import { Icon } from "@/components/journey/icon";
import { Pill, type PillTone } from "@/components/journey/ui";
import { CYCLE_STAGE, type CycleStage, type FindingLevel, type Tier } from "@/lib/cycle/model";

const STAGE_TONE: Record<CycleStage, PillTone> = { not: "gray", draft: "warn", submitted: "cx", review: "cx", returned: "orange", accepted: "ok" };

export function StageBadge({ stage, overdue }: { stage: CycleStage; overdue?: boolean }) {
  if (overdue && stage !== "accepted") return <Pill tone="bad">Overdue</Pill>;
  return <Pill tone={STAGE_TONE[stage]}>{CYCLE_STAGE[stage].label}</Pill>;
}

const TIER_TONE: Record<Tier, PillTone> = { Full: "ok", Partial: "warn", Non: "bad" };

export function TierPill({ tier, prefix }: { tier?: Tier; prefix?: string }) {
  if (!tier) return <span className="text-xs text-j-muted">–</span>;
  return (
    <Pill tone={TIER_TONE[tier]}>
      {prefix}
      {tier}
    </Pill>
  );
}

const LEVEL_TONE: Record<FindingLevel, PillTone> = { Critical: "bad", High: "orange", Medium: "warn" };

export function LevelPill({ level }: { level: FindingLevel }) {
  return <Pill tone={LEVEL_TONE[level]}>{level.toUpperCase()}</Pill>;
}

export function Kpi({ label, value, sub, tone, className }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "bad" | "ok" | "warn"; className?: string }) {
  return (
    <div className={cx("flex min-w-0 flex-[1_1_160px] flex-col gap-1 rounded-[16px] border border-j-line bg-white px-4 py-3.5", className)}>
      <span className="text-xs font-semibold text-j-muted">{label}</span>
      <b className={cx("text-[26px] leading-8 font-bold tracking-[-0.01em]", tone === "bad" && "text-[#B2461F]", tone === "ok" && "text-[#0E5A45]", tone === "warn" && "text-[#8A4B00]")}>{value}</b>
      {sub && <span className="text-xs text-j-ink-3">{sub}</span>}
    </div>
  );
}

/** Centred modal on the native <dialog>. */
export function Modal({ open, onClose, title, sub, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cx("m-auto max-h-[90vh] w-[min(560px,calc(100vw-32px))] rounded-[20px] border border-j-line bg-white p-0 text-j-ink backdrop:bg-[#0B1F18]/40", wide && "w-[min(820px,calc(100vw-32px))]")}
    >
      {open && (
        <div className="flex max-h-[90vh] flex-col">
          <div className="flex items-start justify-between gap-3 border-b border-j-line px-6 py-4">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="m-0 text-lg font-semibold">{title}</h2>
              {sub && <p className="m-0 text-[13px] text-j-ink-3">{sub}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-lg border border-j-line bg-white text-lg leading-none text-j-ink hover:bg-j-canvas">
              ✕
            </button>
          </div>
          <div className="flex min-h-0 flex-auto flex-col gap-3.5 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-j-line px-6 py-4">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Purple AI panel; `only` marks output the role alone sees. */
export function AiBox({ title, only, children, className }: { title: ReactNode; only?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx("flex flex-col gap-2.5 rounded-[20px] border border-[#DAD7FB] bg-[#F7F6FE] p-[18px]", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#3D35B8]">
          <Icon name="ai" size={16} />
          {title}
        </span>
        {only && <span className="text-xs font-semibold text-[#4F46E5]">{only}</span>}
      </div>
      {children}
    </section>
  );
}

/** Toast at the bottom of the page; `say` shows a message for a few seconds. */
export function useToast() {
  const [msg, setMsg] = useState("");
  const timer = useRef<number | undefined>(undefined);
  const say = useCallback((t: string) => {
    setMsg(t);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(""), 4500);
  }, []);
  const node = msg ? (
    <p role="status" className="fixed bottom-5 start-1/2 z-50 m-0 flex max-w-[min(640px,calc(100vw-32px))] -translate-x-1/2 items-center gap-2 rounded-xl bg-j-ink px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(16,28,23,0.25)] rtl:translate-x-1/2">
      <Icon name="check" size={15} />
      {msg}
    </p>
  ) : null;
  return { say, toast: node };
}

/** Simple table head cell and row wrappers for wide tables that scroll on small screens. */
export function Table({ label, head, children, min = 760, cols }: { label: string; head: ReactNode[]; children: ReactNode; min?: number; cols: string }) {
  return (
    <div className="overflow-x-auto">
      <div role="table" aria-label={label} className="text-sm" style={{ minWidth: min }}>
        <div role="row" className="grid items-center gap-3 border-b border-j-line px-[22px] py-2.5 text-xs font-semibold text-j-muted" style={{ gridTemplateColumns: cols }}>
          {head.map((h, i) => (
            <span role="columnheader" key={i}>
              {h}
            </span>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Row({ cols, children, className, onClick, selected }: { cols: string; children: ReactNode; className?: string; onClick?: () => void; selected?: boolean }) {
  return (
    <div
      role="row"
      onClick={onClick}
      className={cx("grid items-center gap-3 border-b border-j-line-soft px-[22px] py-3 last:border-0", onClick && "cursor-pointer hover:bg-j-canvas", selected && "bg-cx-tint", className)}
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  );
}

/** Small on/off switch. */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cx("flex h-6 w-11 flex-none cursor-pointer items-center rounded-full border-0 p-0.5 disabled:cursor-not-allowed disabled:opacity-50", on ? "justify-end bg-cx" : "justify-start bg-j-field")}
    >
      <span className="h-5 w-5 rounded-full bg-white shadow" />
    </button>
  );
}

/** "Read-only · closed cycle" banner for a closed workspace. */
export function ClosedBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p className="m-0 flex items-center gap-2 rounded-xl bg-j-canvas px-4 py-3 text-sm text-j-ink-2">
      <Icon name="lock" size={15} />
      This cycle is closed. The workspace is read-only; reports and the submission pack stay downloadable.
    </p>
  );
}

export const fmtDate = (iso: string) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
export const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Downloads rows as a CSV file. */
export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v))).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
