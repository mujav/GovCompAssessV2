import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/components/ui";

// Building blocks for the consultant journey screens (lighter neutrals, 20px cards, consultant blue).

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("rounded-[20px] border border-j-line bg-white", className)} {...props} />;
}

export function PanelHead({ title, aside, className }: { title: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-2.5", className)}>
      <h2 className="m-0 text-base font-semibold">{title}</h2>
      {aside}
    </div>
  );
}

export type PillTone = "ok" | "warn" | "bad" | "cx" | "ai" | "gray" | "draft" | "dark" | "orange";

export const PILL: Record<PillTone, [string, string]> = {
  ok: ["#E7F3ED", "#0E5A45"],
  warn: ["#FFF4DF", "#8A4B00"],
  bad: ["#FDECEA", "#B42318"],
  cx: ["#EAF1FA", "#1E4E8C"],
  ai: ["#EEEDFD", "#4F46E5"],
  gray: ["#F5F7F6", "#33413B"],
  draft: ["#F5F7F6", "#47534D"],
  dark: ["#101C17", "#FFFFFF"],
  orange: ["#FFF1E8", "#9A3412"],
};

export function Pill({ tone = "gray", children, className, round = true }: { tone?: PillTone; children: ReactNode; className?: string; round?: boolean }) {
  const [bg, fg] = PILL[tone];
  return (
    <span
      className={cx("inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold", round ? "rounded-full" : "rounded-lg", className)}
      style={{ background: bg, color: fg }}
    >
      {children}
    </span>
  );
}

export function Avatar({ initials, bg = "#E0ECF8", fg = "#1E4E8C", size = 32, className }: { initials: string; bg?: string; fg?: string; size?: number; className?: string }) {
  return (
    <span
      className={cx("flex flex-none items-center justify-center rounded-full font-bold", className)}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size <= 28 ? 10 : size <= 34 ? 11 : 13 }}
    >
      {initials}
    </span>
  );
}

/** Donut made with a conic gradient, value in the middle. */
export function Ring({
  pct,
  color,
  size = 76,
  thickness = 8,
  track = "#EEF1EF",
  hole = "#FFFFFF",
  children,
  label,
}: {
  pct: number;
  color: string;
  size?: number;
  thickness?: number;
  track?: string;
  hole?: string;
  children?: ReactNode;
  label?: string;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      className="flex flex-none items-center justify-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(${color} 0 ${pct}%, ${track} ${pct}% 100%)` }}
    >
      <span className="flex items-center justify-center rounded-full" style={{ width: size - thickness * 2, height: size - thickness * 2, background: hole }}>
        {children}
      </span>
    </span>
  );
}

export function Bar({ pct, color, height = 6, track = "#EEF1EF" }: { pct: number; color: string; height?: number; track?: string }) {
  return (
    <span className="block overflow-hidden" style={{ height, borderRadius: height / 2, background: track }}>
      <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color, borderRadius: height / 2 }} />
    </span>
  );
}

type BtnVariant = "primary" | "secondary" | "dark" | "ghost" | "outline";

const BTN: Record<BtnVariant, string> = {
  primary: "border-0 bg-cx font-semibold text-white hover:bg-cx-strong hover:text-white",
  secondary: "border border-j-line bg-white font-semibold text-j-ink hover:bg-j-canvas hover:text-j-ink",
  outline: "border border-cx-line bg-white font-semibold text-cx hover:bg-cx-tint hover:text-cx",
  dark: "border-0 bg-j-ink font-semibold text-white hover:text-white",
  ghost: "border-0 bg-transparent font-semibold text-j-ink-2 hover:bg-j-canvas",
};

const BTN_SIZE = { sm: "h-[34px] px-3 text-[13px]", md: "h-10 px-3.5 text-sm", lg: "h-11 px-4 text-sm" };

const btnClass = (variant: BtnVariant, size: keyof typeof BTN_SIZE, className?: string) =>
  cx(
    "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[10px] no-underline disabled:cursor-not-allowed disabled:opacity-50",
    BTN_SIZE[size],
    BTN[variant],
    className,
  );

export function JButton({ variant = "secondary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: BtnVariant; size?: keyof typeof BTN_SIZE }) {
  return <button type="button" className={btnClass(variant, size, className)} {...props} />;
}

export function JLink({ variant = "secondary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: keyof typeof BTN_SIZE }) {
  return <Link className={btnClass(variant, size, className)} {...props} />;
}

/** Pill-shaped segmented control (radio group). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <span role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] bg-j-canvas p-[3px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "cursor-pointer rounded-lg border-0 px-3 font-semibold",
              size === "sm" ? "h-[30px] text-xs" : "h-[34px] text-[13px]",
              on ? "bg-white text-cx shadow-[0_1px_2px_rgba(16,28,23,0.08)]" : "bg-transparent text-j-ink-3",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </span>
  );
}

/** Filter chips: the selected chip is solid ink. */
export function Chips<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: ReactNode; n?: number }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "h-10 cursor-pointer rounded-full border px-3.5 text-[13px] font-semibold",
              on ? "border-j-ink bg-j-ink text-white" : "border-j-line bg-white text-j-ink-2 hover:bg-j-canvas",
            )}
          >
            {o.label}
            {o.n != null && <span className="ml-1 opacity-70">{o.n}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function PageHead({ eyebrow, title, children, tags }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode; tags?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        {tags && <span className="flex flex-wrap gap-1.5">{tags}</span>}
        {eyebrow && <span className="text-sm text-j-muted">{eyebrow}</span>}
        <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function SrOnly({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

export function Field({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return <label className={cx("flex flex-col gap-1.5 text-[13px] font-semibold", className)}>{label}{children}</label>;
}

export const inputClass = "h-11 rounded-[10px] border border-j-line bg-white px-3 text-sm font-normal text-j-ink";
