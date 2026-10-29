"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "./ui";

type NavItem = { href: string; label: string; badge?: { n: number; bg: string } };

const NAV: { heading: string; items: NavItem[] }[] = [
  {
    heading: "WORKSPACE",
    items: [
      { href: "/command-center", label: "Command Center" },
      { href: "/requirements", label: "Requirements" },
      { href: "/evidence", label: "Evidence" },
      { href: "/reviews", label: "Reviews", badge: { n: 14, bg: "#2E8B6A" } },
      { href: "/actions", label: "Action Center", badge: { n: 9, bg: "#B4580A" } },
      { href: "/remediation", label: "Remediation" },
      { href: "/clarifications", label: "Clarifications" },
      { href: "/submission", label: "Submission" },
    ],
  },
  {
    heading: "INSIGHTS",
    items: [
      { href: "/departments", label: "Departments" },
      { href: "/comparisons", label: "Comparisons" },
    ],
  },
  {
    heading: "CONFIGURE",
    items: [
      { href: "/admin/frameworks", label: "Admin Studio" },
      { href: "/flows", label: "Flows & architecture" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function WorkspaceNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="box-border flex flex-[1_1_240px] flex-col gap-[18px] bg-nav px-3.5 py-5 text-[#E4ECE8] lg:max-w-[260px]"
    >
      <div className="flex items-center gap-2.5 px-1.5">
        <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-mint text-sm font-bold text-white">
          CI
        </div>
        <div>
          <div className="text-[15px] font-semibold text-white">Compliance Intelligence</div>
          <div className="text-xs text-nav-muted">Demo Entity · Pilot sandbox</div>
        </div>
      </div>
      <button
        type="button"
        className="flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-[10px] border-0 bg-nav-2 px-3 py-2.5 text-left text-white"
      >
        <span className="text-[11px] tracking-[0.06em] text-nav-muted">FRAMEWORK · CYCLE</span>
        <span className="text-sm font-semibold">Qiyas 2026 · Cycle 1 ▾</span>
      </button>
      {NAV.map((group) => (
        <div key={group.heading} className="flex flex-col gap-0.5">
          <div className="px-2.5 py-1 text-[11px] tracking-[0.08em] text-nav-muted">{group.heading}</div>
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-11 items-center justify-between rounded-lg px-2.5 text-sm no-underline",
                  active ? "bg-nav-active font-semibold text-white hover:text-white" : "text-nav-text hover:bg-nav-2 hover:text-white",
                )}
              >
                {item.label}
                {item.badge && (
                  <span
                    className="rounded-full px-[7px] py-px text-[11px] font-semibold text-white"
                    style={{ background: item.badge.bg }}
                  >
                    {item.badge.n}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap bg-canvas text-ink">
      <WorkspaceNav />
      <div className="flex min-w-0 flex-[999_1_560px] flex-col">{children}</div>
    </div>
  );
}

export function PageHeader({
  crumb,
  title,
  actions,
  children,
}: {
  crumb: ReactNode;
  title: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-8 py-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="text-[13px] text-muted">{crumb}</div>
        <h1 className="m-0 text-2xl font-bold leading-8">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
      {children}
    </header>
  );
}

export function Avatar({ initials = "NA", title = "Noura A. · Assessment Manager" }: { initials?: string; title?: string }) {
  return (
    <div
      title={title}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-[#DCEDE5] text-sm font-semibold text-brand"
    >
      {initials}
    </div>
  );
}

export function LanguageLink() {
  return (
    <Link
      href="/spoc"
      lang="ar"
      className="inline-flex h-11 items-center rounded-lg border border-field bg-white px-3.5 text-sm text-ink no-underline hover:bg-surface-2 hover:text-ink"
    >
      العربية
    </Link>
  );
}

export function Main({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <main
      className={cx(
        "box-border flex w-full flex-col gap-4 px-8 pb-12 pt-6",
        wide ? "max-w-[1360px]" : "max-w-[1280px]",
        className,
      )}
    >
      {children}
    </main>
  );
}
