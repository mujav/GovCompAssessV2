"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { CONSULTANT, LOGO, DEMO_CLIENT_ID, clientHref } from "@/lib/journey/portfolio";
import { useJourney } from "@/lib/journey/store";
import { Icon, type IconName } from "./icon";

type NavItem = { label: string; icon: IconName; href: string; badge?: string; badgeBg?: string; exact?: boolean };

function portfolioNav(): [string, NavItem[]][] {
  return [
    [
      "WORK",
      [
        { label: "Portfolio", icon: "home", href: "/portfolio", exact: true },
        { label: "Clients", icon: "ent", href: clientHref(DEMO_CLIENT_ID, "/360") },
        { label: "Engagements", icon: "eng", href: clientHref(DEMO_CLIENT_ID, "/engagement"), badge: "2" },
        { label: "Onboard client", icon: "plus", href: "/portfolio/onboard" },
      ],
    ],
    [
      "PRACTICE",
      [
        { label: "Team & capacity", icon: "dep", href: "/portfolio#team" },
        { label: "Knowledge library", icon: "file", href: "/portfolio#library" },
        { label: "Client reports", icon: "cmp", href: "/portfolio#reports" },
      ],
    ],
  ];
}

function clientNav(id: string, name: string, workBadge?: string): [string, NavItem[]][] {
  const c = (path: string) => clientHref(id, path);
  return [
    [
      "PORTFOLIO",
      [
        { label: "All entities", icon: "grid", href: "/portfolio", exact: true },
        { label: "Add entity", icon: "plus", href: "/portfolio/onboard" },
      ],
    ],
    [
      name.toUpperCase(),
      [
        { label: "Overview", icon: "home", href: c(""), exact: true },
        { label: "Requirements", icon: "req", href: c("/requirements") },
        { label: "My work", icon: "act", href: c("/work"), badge: workBadge },
        { label: "Evidence library", icon: "ev", href: c("/evidence") },
        { label: "Clarifications", icon: "cla", href: c("/clarifications") },
        { label: "Submission", icon: "sub", href: c("/submission") },
      ],
    ],
    [
      "INSIGHTS",
      [
        { label: "Departments", icon: "dep", href: c("/departments") },
        { label: "Comparisons", icon: "cmp", href: c("/comparisons") },
        { label: "Entity 360", icon: "ent", href: c("/360") },
      ],
    ],
    [
      "ENGAGEMENT",
      [
        { label: "Engagement", icon: "eng", href: c("/engagement") },
        { label: "Entity settings", icon: "adm", href: "/admin/frameworks" },
      ],
    ],
  ];
}

function isActive(pathname: string, item: NavItem) {
  const href = item.href.split("#")[0];
  if (item.href.includes("#")) return false;
  return item.exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

/**
 * Consultant portal frame: white side nav (portfolio or client mode) and a top bar.
 * `clientId` switches the nav to the client workspace for that entity.
 */
export function ConsultantShell({
  clientId,
  workBadge,
  search,
  headerExtra,
  children,
}: {
  clientId?: string;
  workBadge?: string;
  search: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { clients } = useJourney();
  const current = clients.find((c) => c.id === (clientId ?? DEMO_CLIENT_ID)) ?? clients[0];
  const groups = clientId ? clientNav(clientId, current.name, workBadge) : portfolioNav();
  // Several items share a destination; highlight only the first match.
  let matched = false;
  const [lbg, lfg] = LOGO[current.logo];

  return (
    <div className="flex min-h-screen flex-wrap bg-j-canvas text-j-ink">
      <nav
        aria-label="Consultant portal"
        className="box-border flex flex-[1_1_232px] flex-col gap-[18px] border-r border-[#E3E8EF] bg-white px-3 py-5 lg:max-w-[260px]"
      >
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-cx text-[13px] font-bold text-white">DA</span>
          <span className="leading-[17px]">
            <b className="text-sm">Consultant portal</b>
            <br />
            <span className="text-xs text-j-muted">{CONSULTANT.firm}</span>
          </span>
        </div>
        <Link
          href="/entities"
          className="flex min-h-[52px] items-center gap-2.5 rounded-xl border border-cx-line bg-cx-tint px-3 text-j-ink no-underline hover:text-j-ink"
        >
          <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg text-[11px] font-bold" style={{ background: lbg, color: lfg }}>
            {current.ini}
          </span>
          <span className="min-w-0 flex-auto leading-4">
            <b className="text-[13px]">{current.name}</b>
            <br />
            <span className="text-xs text-j-muted">{current.frameworks[0]}</span>
          </span>
          <Icon name="switch" size={16} />
          <span className="sr-only">Switch entity</span>
        </Link>
        {groups.map(([title, items]) => (
          <div key={title} className="flex flex-col gap-0.5">
            <div className="px-3 pb-1 text-[11px] font-semibold tracking-[0.06em] text-j-muted">{title}</div>
            {items.map((n) => {
              const on = !matched && isActive(pathname, n);
              if (on) matched = true;
              return (
                <Link
                  key={n.label}
                  href={n.href}
                  aria-current={on ? "page" : undefined}
                  className={cx(
                    "flex min-h-[38px] items-center gap-3 rounded-[10px] px-3 text-sm no-underline",
                    on ? "bg-cx-soft font-semibold text-cx hover:text-cx" : "font-medium text-j-ink-2 hover:bg-j-canvas hover:text-j-ink",
                  )}
                >
                  <Icon name={n.icon} />
                  <span className="flex-auto">{n.label}</span>
                  {n.badge && (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white" style={{ background: n.badgeBg ?? "#1E4E8C" }}>
                      {n.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
        <div className="mt-auto flex items-center gap-2.5 border-t border-[#E3E8EF] px-2 pt-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E0ECF8] text-xs font-bold text-cx">{CONSULTANT.initials}</span>
          <span className="flex-auto text-[13px] leading-[17px]">
            <b>{CONSULTANT.name}</b>
            <br />
            <span className="text-j-muted">{CONSULTANT.role}</span>
          </span>
          <Link href="/login" className="text-xs text-j-muted no-underline hover:text-j-ink">
            Sign out
          </Link>
        </div>
      </nav>
      <div className="flex min-w-0 flex-[999_1_560px] flex-col">
        <header className="flex flex-wrap items-center gap-2.5 border-b border-j-line bg-white px-8 py-2.5">
          <label className="flex h-10 flex-[0_1_420px] items-center gap-2 rounded-[10px] bg-j-canvas px-3 text-j-muted">
            <Icon name="search" size={16} />
            <span className="sr-only">Search</span>
            <input type="search" placeholder={search} className="min-w-0 flex-auto border-0 bg-transparent text-sm text-j-ink outline-none" />
          </label>
          <span className="flex-auto" />
          {headerExtra}
        </header>
        {children}
      </div>
    </div>
  );
}

/** The client whose workspace the current route shows (falls back to Demo Entity). */
export function useCurrentClient() {
  const { id } = useParams<{ id?: string }>();
  const { clients } = useJourney();
  return clients.find((c) => c.id === id) ?? clients.find((c) => c.id === DEMO_CLIENT_ID)!;
}

/** Consultant shell in client-workspace mode for the client in the URL. */
export function ClientShell({ children, workBadge, search }: { children: ReactNode; workBadge?: string; search?: string }) {
  const client = useCurrentClient();
  return (
    <ConsultantShell clientId={client.id} workBadge={workBadge} search={search ?? `Search ${client.name}`} headerExtra={<ClientHeaderExtra />}>
      {children}
    </ConsultantShell>
  );
}

/** Page body inside the shell. */
export function JMain({ children, className, max = 1360 }: { children: ReactNode; className?: string; max?: number }) {
  return (
    <main className={cx("box-border flex w-full flex-col gap-[18px] px-8 pt-7 pb-14", className)} style={{ maxWidth: max }}>
      {children}
    </main>
  );
}

/** Header extras for a client workspace: service model, engagement term, switch entity. */
export function ClientHeaderExtra() {
  return (
    <>
      <span className="inline-flex h-[30px] items-center rounded-full bg-cx-soft px-3 text-xs font-bold text-cx">Managed service</span>
      <span className="inline-flex h-[30px] items-center rounded-full bg-j-canvas px-3 text-xs font-semibold text-j-ink-2">ENG-0142 · 214 d left</span>
      <Link
        href="/entities"
        className="inline-flex h-9 items-center rounded-[10px] border border-j-line px-3 text-[13px] font-semibold text-j-ink no-underline hover:bg-j-canvas hover:text-j-ink"
      >
        Switch entity
      </Link>
    </>
  );
}

export function LangButton() {
  return (
    <Link
      href="/spoc"
      lang="ar"
      aria-label="العربية"
      className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#E3E8EF] bg-white text-base font-semibold text-j-ink no-underline hover:text-j-ink"
    >
      ع
    </Link>
  );
}
