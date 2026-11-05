"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/journey/icon";
import { PeopleEditor } from "@/components/journey/people-editor";
import { ClientShell, JMain, useCurrentClient } from "@/components/journey/shell";
import { EngagementBody } from "@/components/journey/engagement-body";
import { EntityEditor } from "@/components/journey/entity-editor";
import { Avatar, JButton, JLink, Panel, PanelHead, Pill, Ring } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { useAdmin } from "@/lib/admin/store";
import { WORKSPACE_FRAMEWORK_ID, shortName } from "@/lib/journey/frameworks";
import { LOGO, clientHref, completionColor } from "@/lib/journey/portfolio";
import { useJourney } from "@/lib/journey/store";
import { initialsOf } from "@/lib/journey/people";
import { PROFILE_KEY, defaultProfile, type EntityProfile } from "@/lib/journey/profile";
import { useEntityFrameworks, useEntityPeople } from "@/lib/journey/use-work";

// 05 · Entity profile. Identity and frameworks, people, the engagement and index history for one client.

const TABS = ["Profile", "People", "Engagement", "History"] as const;
const TAB_PARAM: Record<string, number> = { people: 1, engagement: 2, history: 3 };

const BARS: { y: string; v: number; src: "reg" | "file" | "live"; rank: string }[] = [
  { y: "2022", v: 58.2, src: "reg", rank: "#31" },
  { y: "2023", v: 61.9, src: "reg", rank: "#27" },
  { y: "2024", v: 63.0, src: "file", rank: "#24" },
  { y: "2025", v: 65.6, src: "reg", rank: "#21" },
  { y: "2026", v: 72.4, src: "live", rank: "live" },
];

const SYSTEMS: [string, string, string][] = [
  ["Unified sign-in", "National SSO", "Integrated"],
  ["ERP", "Finance & HR", "Integrated"],
  ["Service portal", "38 digital services", "Integrated"],
  ["Document management", "Evidence source", "Connector pending"],
  ["Data catalogue", "Open data", "Manual upload"],
];

export default function Entity360Page() {
  const client = useCurrentClient();
  const { state, log, engagements } = useJourney();
  const { state: admin } = useAdmin();
  const { frameworks, current, setActive } = useEntityFrameworks();
  // Past cycles exist for the seeded clients' Qiyas only; a new entity or another framework starts with none.
  const hasHistory = current?.id === WORKSPACE_FRAMEWORK_ID && !state.added.some((a) => a.client.id === client.id);
  const notEnrolled = admin.frameworks.filter((f) => f.live && !frameworks.some((x) => x.id === f.id)).map((f) => shortName(f.live!.name));
  const params = useSearchParams();
  const [tab, setTab] = useState(TAB_PARAM[params.get("tab") ?? ""] ?? 0);
  // The sidebar's People link lands here with ?tab=people, also when 360 is already open.
  const wanted = TAB_PARAM[params.get("tab") ?? ""];
  useEffect(() => {
    if (wanted !== undefined) setTab(wanted);
  }, [wanted]);
  const [people, setPeople] = useEntityPeople();
  const [editing, setEditing] = useState(false);
  const onboarded = state.added.some((a) => a.client.id === client.id);
  const saved = state.screens[PROFILE_KEY(client.id)] as EntityProfile | undefined;
  const profileData = saved ?? defaultProfile(client, onboarded);
  const liaison = people.find((p) => p.roles.includes("DGA liaison officer"))?.name;
  const facts: [string, string][] = [
    ...(profileData.parent ? [["Parent body", profileData.parent] as [string, string]] : []),
    ...(profileData.domain ? [["Official domain", profileData.domain] as [string, string]] : []),
    ...profileData.facts,
    ...(liaison ? [["DGA liaison", liaison] as [string, string]] : []),
  ];
  const [lbg, lfg] = LOGO[client.logo];
  const pct = client.id === "demo-entity" ? 72.4 : client.pct;


  const history = (
    <Panel className="flex flex-[2_1_520px] flex-col gap-4 p-[22px]">
      <PanelHead
        title={`${current?.short ?? client.frameworks[0] ?? "Index"} history`}
        aside={
          hasHistory && (
            <span className="flex gap-3 text-xs text-j-muted">
              {[
                ["#0E5A45", "Regulator"],
                ["#1E4E8C", "Client file"],
                ["#EAF1FA", "Live"],
              ].map(([c, l]) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c, border: l === "Live" ? "1.5px dashed #1E4E8C" : undefined }} />
                  {l}
                </span>
              ))}
            </span>
          )
        }
      />
      {!hasHistory ? (
        <p className="m-0 text-sm text-j-muted">
          No past cycles for {current?.name ?? "this standard"} on the platform yet. Import them from the onboarding wizard or start this cycle as the baseline.
        </p>
      ) : (
        <>
          <div role="img" aria-label="Qiyas score: 2022 58.2, 2023 61.9, 2024 63.0, 2025 65.6, 2026 live 72.4, target 85" className="relative flex h-[240px] items-end gap-[6%] border-b border-j-line px-[4%]">
            <span className="absolute inset-x-0 border-t-2 border-dashed border-j-ok" style={{ bottom: `${(85 / 100) * 220}px` }} />
            <span className="absolute end-0 text-[11px] font-semibold text-brand" style={{ bottom: `${(85 / 100) * 220 + 4}px` }}>
              Target 85
            </span>
            {BARS.map((b) => (
              <span key={b.y} className="flex flex-1 flex-col items-center gap-1.5">
                <b className="text-[13px]">{b.v}%</b>
                <span
                  className="block w-full max-w-[64px] rounded-t-[10px]"
                  style={{
                    height: (b.v / 100) * 220,
                    background: b.src === "live" ? "#EAF1FA" : b.src === "reg" ? "#0E5A45" : "#1E4E8C",
                    border: b.src === "live" ? "2px dashed #1E4E8C" : 0,
                  }}
                />
              </span>
            ))}
          </div>
          <div className="flex gap-[6%] px-[4%]">
            {BARS.map((b) => (
              <span key={b.y} className="flex flex-1 flex-col items-center text-xs">
                <b>{b.y}</b>
                <span className="text-j-muted">{b.rank}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Pill>Carried from 2025</Pill>
            <Pill tone="warn">↻ 6 repeat observations</Pill>
            <Pill tone="cx">214 evidence items to re-validate</Pill>
            <Pill tone="ok">Crosswalk 96% mapped</Pill>
          </div>
        </>
      )}
    </Panel>
  );

  const profile = (
    <Panel className="flex flex-[1_1_300px] flex-col gap-1 p-[22px]">
      <h2 className="m-0 mb-2 text-base">Profile</h2>
      {facts.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-j-line-soft py-2.5 text-sm last:border-0">
          <span className="text-j-muted">{k}</span>
          <b className={cx("text-end", !v && "font-normal text-j-muted")}>{v || "Not set"}</b>
        </div>
      ))}
      <JButton size="sm" className="mt-2 self-start" onClick={() => setEditing(true)}>
        Edit profile
      </JButton>
      <div className="mt-2 flex gap-1.5">
        {["DGA", "NCA", "SDAIA"].map((r) => (
          <Pill key={r} round={false}>
            {r}
          </Pill>
        ))}
      </div>
    </Panel>
  );

  const systems = (
    <Panel className="flex flex-[1_1_300px] flex-col overflow-hidden">
      <h2 className="m-0 px-[22px] pt-[18px] pb-2 text-base">Systems</h2>
      {SYSTEMS.map(([name, what, st]) => (
        <div key={name} className="flex flex-wrap items-center gap-3 border-b border-j-line-soft px-[22px] py-3 text-sm last:border-0">
          <Icon name="layers" size={18} className="text-cx" />
          <span className="flex-auto">
            <b>{name}</b>
            <br />
            <span className="text-[13px] text-j-muted">{what}</span>
          </span>
          <Pill tone={st === "Integrated" ? "ok" : st === "Connector pending" ? "warn" : "gray"}>{st}</Pill>
        </div>
      ))}
    </Panel>
  );

  const team = (
    <Panel className="flex flex-col gap-4 p-[22px]">
      <PanelHead title={`People · ${people.length}`} aside={<span className="text-xs text-j-muted">Requirements can be assigned to anyone on this list</span>} />
      <PeopleEditor people={people} onChange={(next) => setPeople((d) => void d.splice(0, d.length, ...next))} onLog={log} />
    </Panel>
  );

  return (
    <ClientShell>
      <JMain>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold" style={{ background: lbg, color: lfg }}>
              {client.ini}
            </span>
            <div className="flex flex-col gap-1.5">
              <h1 className="m-0 text-[28px] leading-9 font-bold tracking-[-0.02em]">
                {client.name}{" "}
                {client.nameAr && (
                  <span lang="ar" dir="rtl" className="font-arabic text-lg font-semibold text-j-muted">
                    {client.nameAr}
                  </span>
                )}
              </h1>
              <span className="flex flex-wrap gap-1.5">
                <Pill>{client.sub.split(" · ")[0]}</Pill>
                <Pill tone="ok">✓ Active</Pill>
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <JButton onClick={() => setEditing(true)}>Edit entity</JButton>
            <JLink href={clientHref(client.id)} variant="primary">
              Open workspace
            </JLink>
          </div>
        </div>

        <div role="tablist" aria-label="Sections" className="flex gap-1 overflow-x-auto border-b border-j-line">
          {TABS.map((t, i) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === i}
              onClick={() => setTab(i)}
              className={cx(
                "h-11 cursor-pointer whitespace-nowrap border-0 border-b-2 bg-transparent px-3.5 text-sm",
                tab === i ? "border-cx font-semibold text-cx" : "border-transparent font-medium text-j-ink-3 hover:text-j-ink",
              )}
            >
              {t === "People" ? `People · ${people.length}` : t}
            </button>
          ))}
        </div>

        {tab === 0 && (
          <>
            <section aria-label="Index enrollments" className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
              {frameworks.map((f, i) => {
                const e = engagements.find((x) => x.clientId === client.id && (x.frameworkId === f.id || (!x.frameworkId && f.short.startsWith(x.index))));
                const done = client.id === "demo-entity" && i === 0 ? pct : (e?.ready ?? null);
                return (
                  <Panel key={f.id} className={cx("flex items-center gap-4 p-[18px]", i === 0 && "border-2 border-cx")}>
                    <Ring pct={done ?? 0} color={completionColor(done ?? null)} label={done == null ? "Not started" : `Completion ${done} percent`}>
                      <b className="text-base">{done == null ? "—" : `${Math.round(done)}%`}</b>
                    </Ring>
                    <span className="flex min-w-0 flex-col gap-0.5 text-sm">
                      <b className="text-base" dir="auto">
                        {f.name}
                      </b>
                      <span className="font-semibold text-cx">Managed by you · v{f.version}</span>
                      <span className="text-[13px] text-j-muted">{e?.milestone ?? "Not started"}</span>
                      <JLink href={clientHref(client.id)} size="sm" className="mt-1 self-start" onClick={() => setActive(f.id)}>
                        Open {f.short}
                      </JLink>
                    </span>
                  </Panel>
                );
              })}
              <button
                type="button"
                onClick={() => setEditing(true)}
                disabled={notEnrolled.length === 0}
                className="flex cursor-pointer items-center gap-4 rounded-[20px] border-2 border-dashed border-cx-line bg-cx-tint p-[18px] text-start text-j-ink disabled:cursor-default"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cx text-xl text-white">+</span>
                <span className="flex flex-col text-sm">
                  <b className="text-base">Add a standard</b>
                  <span className="text-[13px] text-j-muted">{notEnrolled.length ? `${notEnrolled.slice(0, 3).join(", ")} · from the library` : "Every library standard is already enrolled"}</span>
                </span>
              </button>
            </section>
            <div className="flex flex-wrap items-start gap-3.5">
              {profile}
              {systems}
            </div>
            <Panel className="flex flex-col gap-3 p-[22px]">
              <PanelHead
                title={`Key people · ${people.length}`}
                aside={
                  <JButton size="sm" onClick={() => setTab(1)}>
                    Manage people
                  </JButton>
                }
              />
              {people.length === 0 ? (
                <p className="m-0 text-sm text-j-muted">No people yet. Add the client&apos;s stakeholders so requirements can be assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {[...people]
                    .sort((a, b) => b.roles.length - a.roles.length)
                    .slice(0, 8)
                    .map((p) => (
                      <span key={p.id} className="inline-flex items-center gap-2 rounded-full border border-j-line py-1 ps-1 pe-3 text-[13px]">
                        <Avatar initials={initialsOf(p.name)} size={28} />
                        <b>{p.name}</b>
                        <span className="text-j-muted">{p.roles[0] ?? p.title ?? p.department}</span>
                      </span>
                    ))}
                </div>
              )}
            </Panel>
          </>
        )}
        {tab === 1 && team}
        {tab === 2 && <EngagementBody />}
        {tab === 3 && (
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap gap-3.5">{history}</div>
            <Panel className="flex flex-col gap-2 p-[22px]">
              <h2 className="m-0 text-base">Activity</h2>
              {[...state.log.map((l) => [l.at, l.text]), ["10 Jun", "Engagement ENG-0142 activated by Noura A."], ["9 Jun", "Client signed the engagement"], ["2 Jun", "Workspace created by Sami R."]].map(([at, text], i) => (
                <div key={i} className="flex gap-3 border-b border-j-line-soft py-2 text-sm last:border-0">
                  <span className="w-28 flex-none text-xs text-j-muted">{at}</span>
                  <span>{text}</span>
                </div>
              ))}
            </Panel>
          </div>
        )}
      </JMain>
      {editing && <EntityEditor open onClose={() => setEditing(false)} onPeople={() => setTab(1)} />}
    </ClientShell>
  );
}
