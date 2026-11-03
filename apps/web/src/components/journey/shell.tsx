"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { canManage, homeFor, ROLE_OF, type Role } from "@/lib/auth/accounts";
import { useAuth, useGuard } from "@/lib/auth/store";
import { LOGO, DEMO_CLIENT_ID, clientHref } from "@/lib/journey/portfolio";
import { useAdmin } from "@/lib/admin/store";
import { LanguageToggle } from "@/lib/i18n/locale";
import { initialsOf } from "@/lib/journey/people";
import { useJourney } from "@/lib/journey/store";
import { useWorkplaces } from "@/lib/journey/use-workplaces";
import { CURRENT_YEAR, workplaceLabel, type WorkplaceClient } from "@/lib/journey/workplaces";
import { Icon, type IconName } from "./icon";

type NavItem = { label: string; icon: IconName; href: string; badge?: string; badgeBg?: string; exact?: boolean };

/** Studio sections; the side nav shows one Studio entry and the studio pages show these as a sub-menu. */
export const STUDIO: NavItem[] = [
  { label: "Framework builder", icon: "layers", href: "/studio/frameworks" },
  { label: "Scoring", icon: "trend", href: "/studio/scoring" },
  { label: "Automation", icon: "refresh", href: "/studio/automation" },
  { label: "Change log", icon: "history", href: "/studio/history" },
];

type Groups = [string, NavItem[]][];

/** Side nav for a role, with the workplace's own pages when one is open. */
function navFor(role: Role, wp: { id: string; name: string } | undefined, badges: { work?: string; studio?: string; access?: string; requests?: string }): Groups {
  const c = (path: string) => clientHref(wp!.id, path);
  const workplace: Groups = wp
    ? [
        [
          wp.name.toUpperCase(),
          [
            { label: "Overview", icon: "home", href: c(""), exact: true },
            { label: "Requirements", icon: "req", href: c("/requirements") },
            { label: "My work", icon: "act", href: c("/work"), badge: badges.work },
            { label: "Evidence library", icon: "ev", href: c("/evidence") },
            { label: "Submission", icon: "sub", href: c("/submission") },
            { label: "Entity profile", icon: "ent", href: c("/360") },
          ],
        ],
      ]
    : [];
  const insights: Groups = [["INSIGHTS", [{ label: "Dashboards", icon: "trend", href: "/dashboards" }]]];
  if (role === "control") return [["MY WORK", [{ label: "My requirements", icon: "req", href: "/my-requirements" }]]];
  if (role === "viewer") return insights;
  if (role === "owner") return [["WORKPLACES", [{ label: "My workplaces", icon: "grid", href: "/workplaces", exact: true }]], ...workplace, ...insights];
  return [
    [
      "WORKPLACES",
      [
        { label: "All workplaces", icon: "grid", href: "/workplaces", exact: true },
        { label: "New workplace", icon: "plus", href: "/workplaces/new", badge: badges.requests, badgeBg: "#C2410C" },
      ],
    ],
    ...workplace,
    [
      "ADMINISTRATION",
      [
        { label: "Access & users", icon: "key", href: "/admin/access", badge: badges.access, badgeBg: "#C2410C" },
        { label: "Studio", icon: "layers", href: "/studio", badge: badges.studio, badgeBg: "#C2410C" },
      ],
    ],
    ...insights,
  ];
}

function isActive(pathname: string, item: NavItem) {
  const href = item.href.split("#")[0];
  if (item.href.includes("#")) return false;
  return item.exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
}

/**
 * Platform frame: white side nav for the signed-in user's role and a top bar. `clientId`
 * (a workplace id) adds that workplace's pages to the nav. Only signed-in users allowed on
 * the page see it; everyone else is sent to sign in or to their own home.
 */
export function AppShell({
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
  const router = useRouter();
  const { ready, user } = useGuard();
  const { signOut, requests } = useAuth();
  const views = useWorkplaces();
  const current = clientId ? views.find((v) => v.client.id === clientId) : undefined;
  const { state: admin } = useAdmin();
  const pendingCr = admin.changeRequests.filter((cr) => cr.status === "awaiting").length;
  const pendingAccess = requests.filter((r) => r.status === "pending").length;
  const { state: journey } = useJourney();
  const pendingWp = (journey.workplaceRequests ?? []).filter((r) => r.status === "pending").length;
  if (!ready || !user) return <div className="min-h-screen bg-j-canvas" aria-busy="true" />;

  const groups = navFor(user.role, current && user.role !== "control" ? { id: current.client.id, name: current.entity.name } : undefined, {
    work: workBadge,
    studio: pendingCr ? String(pendingCr) : undefined,
    access: pendingAccess ? String(pendingAccess) : undefined,
    requests: pendingWp ? String(pendingWp) : undefined,
  });
  // Several items share a destination; highlight only the first match.
  let matched = false;
  const manages = canManage(user.role);
  // Index owners open only the workplaces they run; control owners only their entity's.
  const outside =
    !!current && ((user.role === "owner" && !current.workplace.ownerIds.includes(user.id)) || (user.role === "control" && !!user.entityId && current.workplace.entityId !== user.entityId));

  return (
    <div className="flex min-h-screen flex-wrap bg-j-canvas text-j-ink">
      <nav aria-label="Main" className="box-border flex flex-[1_1_232px] flex-col gap-[18px] border-e border-[#E3E8EF] bg-white px-3 py-5 lg:max-w-[260px]">
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-mark text-white">
            <Icon name="shield" size={17} />
          </span>
          <span className="leading-[17px]">
            <b className="text-sm">Compliance Intelligence</b>
            <br />
            <span className="text-xs text-j-muted">{ROLE_OF[user.role].label}</span>
          </span>
        </div>
        {current && manages && (
          <Link href="/workplaces" className="flex min-h-[52px] items-center gap-2.5 rounded-xl border border-cx-line bg-cx-tint px-3 text-j-ink no-underline hover:text-j-ink">
            <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg text-[11px] font-bold" style={{ background: LOGO[current.entity.logo][0], color: LOGO[current.entity.logo][1] }}>
              {current.entity.ini}
            </span>
            <span className="min-w-0 flex-auto leading-4">
              <b className="text-[13px]">{current.entity.name}</b>
              <br />
              <span className="text-xs text-j-muted">{workplaceLabel(current.framework?.name ?? current.client.frameworks[0], current.workplace.year)}</span>
            </span>
            <Icon name="switch" size={16} />
            <span className="sr-only">Switch workplace</span>
          </Link>
        )}
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
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[#E0ECF8] text-xs font-bold text-cx">{initialsOf(user.name)}</span>
          <span className="min-w-0 flex-auto text-[13px] leading-[17px]">
            <b className="block truncate">{user.name}</b>
            <span className="block truncate text-j-muted">{user.email}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              signOut();
              router.push("/login");
            }}
            className="cursor-pointer border-0 bg-transparent p-0 text-xs text-j-muted hover:text-j-ink"
          >
            Sign out
          </button>
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
          {!outside && headerExtra}
          <LanguageToggle />
        </header>
        {outside ? (
          <main className="box-border flex w-full max-w-[720px] flex-col items-start gap-3 px-8 pt-10">
            <h1 className="m-0 text-2xl">This workplace is not assigned to you</h1>
            <p className="m-0 text-sm text-j-ink-3">Ask the platform admin to add you as an index owner of {current!.entity.name} if you need it.</p>
            <Link href={homeFor(user.role)} className="font-semibold text-cx">
              Back to your home
            </Link>
          </main>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/** The workplace whose pages the current route shows, as its entity (falls back to Demo Entity's first workplace). */
export function useCurrentClient(): WorkplaceClient {
  const { id } = useParams<{ id?: string }>();
  const views = useWorkplaces();
  const { clients } = useJourney();
  const view = views.find((v) => v.client.id === id) ?? views.find((v) => v.client.id === DEMO_CLIENT_ID) ?? views[0];
  if (view) return view.client;
  const demo = clients.find((c) => c.id === DEMO_CLIENT_ID) ?? clients[0];
  return { ...demo, entityId: demo.id, workplaceId: demo.id, year: CURRENT_YEAR, frameworkId: demo.frameworkIds?.[0] ?? "" };
}

/** App shell with the workplace in the URL open. */
export function ClientShell({ children, workBadge, search }: { children: ReactNode; workBadge?: string; search?: string }) {
  const client = useCurrentClient();
  return (
    <AppShell clientId={client.id} workBadge={workBadge} search={search ?? `Search ${client.name}`} headerExtra={<ClientHeaderExtra />}>
      {children}
    </AppShell>
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

/** Header extras for a workplace: its index and review year, and a way back to the other workplaces. */
export function ClientHeaderExtra() {
  const client = useCurrentClient();
  const { user } = useAuth();
  return (
    <>
      <span className="inline-flex h-[30px] items-center rounded-full bg-cx-soft px-3 text-xs font-bold text-cx">{workplaceLabel(client.frameworks[0] ?? "", client.year)}</span>
      {canManage(user?.role) && (
        <Link
          href="/workplaces"
          className="inline-flex h-9 items-center rounded-[10px] border border-j-line px-3 text-[13px] font-semibold text-j-ink no-underline hover:bg-j-canvas hover:text-j-ink"
        >
          Switch workplace
        </Link>
      )}
    </>
  );
}
