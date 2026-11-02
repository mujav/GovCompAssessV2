"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAdmin } from "@/lib/admin/store";
import { cx } from "@/components/ui";
import { STUDIO } from "./shell";

// Studio: the consultant's configuration area (frameworks, scoring, review rules,
// automation and the change log). Changes are drafted, then approved by a second person.

/** Page title block for studio screens, matching the journey page heads. */
export function PageHeader({ crumb, title, actions, children }: { crumb: ReactNode; title: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="box-border flex w-full max-w-[1360px] flex-wrap items-end justify-between gap-4 px-8 pt-7">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm text-j-muted">{crumb}</span>
        <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">{title}</h1>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      {children}
    </header>
  );
}

/** Demo persona switch so one person can play author and approver (four-eyes). */
export function ActingAs() {
  const { state, user, setUser, reset } = useAdmin();
  return (
    <span className="flex items-center gap-2">
      <label className="flex items-center gap-2 text-xs font-semibold text-j-muted">
        Acting as
        <select
          value={user.id}
          onChange={(e) => setUser(e.target.value)}
          className="h-9 rounded-[10px] border border-j-line bg-white px-2 text-[13px] font-semibold text-j-ink"
        >
          {state.users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.role}
            </option>
          ))}
        </select>
      </label>
      <span className={cx("hidden rounded-full px-2.5 py-1 text-xs font-semibold xl:inline", user.canApprove ? "bg-j-ok-soft text-brand" : "bg-j-canvas text-j-ink-3")}>
        {user.canApprove ? "Can approve" : "Draft only"}
      </span>
      <button
        type="button"
        onClick={() => {
          if (window.confirm("Reset all studio demo data to the starting state?")) reset();
        }}
        className="h-9 cursor-pointer rounded-[10px] border border-j-line bg-white px-3 text-xs font-semibold text-j-ink-2 hover:bg-j-canvas"
      >
        Reset
      </button>
    </span>
  );
}

/** Studio sub-menu: one Studio entry in the side nav, its sections here. */
export function StudioNav() {
  const pathname = usePathname();
  const items = STUDIO;
  return (
    <nav aria-label="Studio sections" className="box-border flex w-full max-w-[1360px] gap-1 overflow-x-auto border-b border-j-line px-8 pt-4">
      {items.map((n) => {
        const on = pathname === n.href || pathname.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            aria-current={on ? "page" : undefined}
            className={cx("h-10 whitespace-nowrap border-b-2 px-3 pt-2 text-sm no-underline", on ? "border-cx font-semibold text-cx" : "border-transparent font-medium text-j-ink-3 hover:text-j-ink")}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
