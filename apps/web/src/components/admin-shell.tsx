"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "./ui";

// Several modules share a screen in the prototype; only the `primary` entry highlights.
const NAV: { heading: string; items: { href: string; label: string; primary?: boolean }[] }[] = [
  {
    heading: "FRAMEWORK PACKAGE",
    items: [
      { href: "/admin/frameworks", label: "Framework Builder", primary: true },
      { href: "/admin/frameworks", label: "Requirement schema" },
      { href: "/admin/frameworks", label: "Criteria & evidence rules" },
      { href: "/admin/scoring", label: "Scoring & maturity", primary: true },
      { href: "/admin/acceptance", label: "Workflow & acceptance", primary: true },
    ],
  },
  {
    heading: "OPERATIONS",
    items: [
      { href: "/admin/automation", label: "Actions & automation", primary: true },
      { href: "/admin/automation", label: "Metrics & dashboards" },
      { href: "/admin/automation", label: "Reports & notifications" },
    ],
  },
  {
    heading: "PLATFORM",
    items: [
      { href: "/admin/history", label: "Organization & roles" },
      { href: "/admin/history", label: "AI configuration" },
      { href: "/admin/history", label: "Terminology & localization" },
      { href: "/admin/history", label: "Configuration history", primary: true },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-wrap bg-canvas text-ink">
      <nav
        aria-label="Admin Studio"
        className="box-border flex flex-[1_1_240px] flex-col gap-4 bg-admin px-3.5 py-5 text-[#E3E6EF] lg:max-w-[260px]"
      >
        <div className="flex items-center gap-2.5 px-1.5">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-orange text-sm font-bold text-white">AS</div>
          <div>
            <div className="text-[15px] font-semibold text-white">Admin Studio</div>
            <div className="text-xs text-admin-muted">Demo Entity · Sandbox</div>
          </div>
        </div>
        <Link
          href="/command-center"
          className="flex min-h-11 items-center rounded-lg border border-admin-line px-2.5 text-[13px] text-admin-text no-underline hover:text-white"
        >
          ← Back to workspace
        </Link>
        {NAV.map((g) => (
          <div key={g.heading} className="flex flex-col gap-px">
            <div className="px-2.5 py-1 text-[11px] tracking-[0.08em] text-admin-muted">{g.heading}</div>
            {g.items.map((it) => {
              const active = it.primary && pathname === it.href;
              return (
                <Link
                  key={it.label}
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex min-h-10 items-center rounded-lg px-2.5 text-sm no-underline",
                    active ? "bg-admin-active font-semibold text-white hover:text-white" : "text-admin-text hover:bg-[#252c40] hover:text-white",
                  )}
                >
                  {it.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="flex min-w-0 flex-[999_1_560px] flex-col">{children}</div>
    </div>
  );
}
