import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { COMPLIANCE, TONE, WORK_DOT, type ComplianceKey, type ToneKey, type WorkKey } from "@/lib/status";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export { cx };

/* ---------- Surfaces ---------- */

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cx("rounded-[14px] border border-line bg-white", className)} {...props} />;
}

export function CardHeader({ title, aside, as = "h2" }: { title: ReactNode; aside?: ReactNode; as?: "h2" | "h3" }) {
  const H = as;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <H className="m-0 text-base font-semibold">{title}</H>
      {aside != null && <span className="text-xs text-muted">{aside}</span>}
    </div>
  );
}

export function Eyebrow({ children, className, color }: { children: ReactNode; className?: string; color?: string }) {
  return (
    <div className={cx("text-[11px] font-semibold tracking-[0.08em]", className)} style={color ? { color } : undefined}>
      {children}
    </div>
  );
}

/* ---------- Buttons ---------- */

type Variant = "primary" | "secondary" | "outlineBrand" | "chip" | "chipActive" | "dark";

const VARIANT: Record<Variant, string> = {
  primary: "border-0 bg-brand font-semibold text-white hover:bg-brand-strong hover:text-white",
  secondary: "border border-field bg-white text-ink hover:bg-surface-2 hover:text-ink",
  outlineBrand: "border border-brand bg-white font-semibold text-brand hover:bg-brand-tint",
  chip: "rounded-full border border-field bg-white text-[13px] text-ink hover:bg-surface-2",
  chipActive: "rounded-full border border-brand bg-brand-soft text-[13px] font-semibold text-brand",
  dark: "border-0 bg-nav-active text-[13px] text-white hover:text-white",
};

const SIZE = { lg: "h-11 px-3.5 text-sm", md: "h-10 px-3 text-[13px]", sm: "h-9 px-3 text-[13px]" };

export function Button({
  variant = "secondary",
  size = "lg",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof SIZE }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg no-underline disabled:cursor-not-allowed",
        SIZE[size],
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "secondary",
  size = "lg",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof SIZE }) {
  return (
    <Link
      className={cx(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg no-underline",
        SIZE[size],
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}

/* ---------- Status ---------- */

/** Filled pill = compliance status (official once accepted). */
export function CompliancePill({ status, label, className }: { status: ComplianceKey; label?: string; className?: string }) {
  const c = COMPLIANCE[status];
  return (
    <span
      className={cx("inline-block rounded-full px-2 py-0.5 text-xs font-semibold", className)}
      style={{ background: c.bg, color: c.fg }}
    >
      {label ?? c.label}
    </span>
  );
}

/** Outlined tag with a dot = work status. */
export function WorkTag({ work, children }: { work: WorkKey; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-field px-2 py-px text-xs text-ink-2">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: WORK_DOT[work] }} />
      {children}
    </span>
  );
}

/** Small rounded label (validity, evidence state, action type). */
export function Badge({
  tone,
  children,
  className,
  bg,
  fg,
}: {
  tone?: ToneKey;
  children: ReactNode;
  className?: string;
  bg?: string;
  fg?: string;
}) {
  const t = tone ? TONE[tone] : { bg: bg ?? "#ECEEEC", fg: fg ?? "#33403A" };
  return (
    <span
      className={cx("inline-block rounded-md px-2 py-0.5 text-[11px] font-semibold", className)}
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

/** Chip with a border, used for "On every screen" style lists and tags. */
export function OutlineTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-block rounded-md border border-field px-2 py-0.5 text-[11px] text-ink-2", className)}>
      {children}
    </span>
  );
}

export function AiTag({ children = "AI BRIEFING" }: { children?: ReactNode }) {
  return (
    <span className="rounded-md bg-ai px-2 py-[3px] text-[11px] font-bold tracking-[0.08em] text-white">{children}</span>
  );
}

/* ---------- Data display ---------- */

export function Meter({ pct, color, className }: { pct: number; color: string; className?: string }) {
  return (
    <span className={cx("block h-2.5 overflow-hidden rounded-[5px] bg-line-soft", className)}>
      <span className="block h-full rounded-[5px]" style={{ width: `${pct}%`, background: color }} />
    </span>
  );
}

export function StackedBar({
  parts,
  height = 10,
  label,
  radius = 5,
}: {
  parts: { value: number; color: string }[];
  height?: number;
  label: string;
  radius?: number;
}) {
  return (
    <div role="img" aria-label={label} className="flex gap-0.5 overflow-hidden" style={{ height, borderRadius: radius }}>
      {parts.map((p, i) => (
        <span key={i} className="block" style={{ flex: `${p.value} 1 0`, background: p.color }} />
      ))}
    </div>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("font-mono", className)}>{children}</span>;
}

/* ---------- Tables (grid rows, as in the design) ---------- */

export function GridTable({
  label,
  columns,
  headers,
  minWidth,
  children,
  headerClassName,
}: {
  label: string;
  columns: string;
  headers: ReactNode[];
  minWidth: number;
  children: ReactNode;
  headerClassName?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <div role="table" aria-label={label} className="text-[13px]" style={{ minWidth }}>
        <div
          role="row"
          className={cx(
            "grid items-center gap-3 border-b border-line bg-surface-2 px-4 py-2.5 text-xs font-semibold text-muted",
            headerClassName,
          )}
          style={{ gridTemplateColumns: columns }}
        >
          {headers.map((h, i) => (
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

export function GridRow({
  columns,
  children,
  className,
  style,
}: {
  columns: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      role="row"
      className={cx("grid items-center gap-3 border-b border-line-soft px-4 py-2.5", className)}
      style={{ gridTemplateColumns: columns, ...style }}
    >
      {children}
    </div>
  );
}

/* ---------- Tabs ---------- */

export function TabBar({
  label,
  tabs,
  active,
  onSelect,
  className,
}: {
  label: string;
  tabs: { label: ReactNode; count?: ReactNode; countTone?: "bad" }[];
  active: number;
  onSelect?: (i: number) => void;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cx("flex flex-wrap gap-1", className)}>
      {tabs.map((t, i) => {
        const on = i === active;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect?.(i)}
            className={cx(
              "h-11 cursor-pointer border-0 border-b-[3px] bg-transparent px-3.5 text-sm",
              on ? "border-brand font-semibold text-brand" : "border-transparent text-ink-2",
            )}
          >
            {t.label}
            {t.count != null && (
              <>
                {" "}
                <span className={cx(t.countTone === "bad" ? "font-semibold text-bad" : "text-muted", on && "font-medium")}>
                  {t.count}
                </span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}
