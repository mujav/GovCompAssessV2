"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminProvider, useAdmin } from "@/lib/admin/store";
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

function PendingBadge() {
  const { state } = useAdmin();
  const n = state.changeRequests.filter((c) => c.status === "awaiting").length;
  if (!n) return null;
  return <span className="rounded-full bg-orange px-[7px] py-px text-[11px] font-semibold text-white">{n}</span>;
}

/** Demo persona switcher: lets one person play author and approver (four-eyes). */
function ActingAs() {
  const { state, user, setUser, reset } = useAdmin();
  return (
    <div className="mt-auto flex flex-col gap-2 rounded-[10px] border border-admin-line p-2.5">
      <label className="flex flex-col gap-1 text-[11px] tracking-[0.08em] text-admin-muted">
        ACTING AS (DEMO)
        <select
          value={user.id}
          onChange={(e) => setUser(e.target.value)}
          className="h-10 rounded-lg border border-admin-line bg-admin-active px-2 text-[13px] tracking-normal text-white"
        >
          {state.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.role}
            </option>
          ))}
        </select>
      </label>
      <div className="text-xs leading-4 text-admin-muted">{user.canApprove ? "Can approve configuration changes" : "Can draft and submit, not approve"}</div>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Reset all Admin Studio demo data to the starting state?")) reset();
        }}
        className="h-9 cursor-pointer rounded-lg border border-admin-line bg-transparent text-xs text-admin-text hover:text-white"
      >
        Reset demo data
      </button>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminProvider>
      <AdminFrame>{children}</AdminFrame>
    </AdminProvider>
  );
}

function AdminFrame({ children }: { children: ReactNode }) {
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
                    "flex min-h-10 items-center justify-between rounded-lg px-2.5 text-sm no-underline",
                    active ? "bg-admin-active font-semibold text-white hover:text-white" : "text-admin-text hover:bg-[#252c40] hover:text-white",
                  )}
                >
                  {it.label}
                  {it.href === "/admin/history" && it.primary && <PendingBadge />}
                </Link>
              );
            })}
          </div>
        ))}
        <ActingAs />
      </nav>
      <div className="flex min-w-0 flex-[999_1_560px] flex-col">{children}</div>
    </div>
  );
}
