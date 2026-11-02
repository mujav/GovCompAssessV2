"use client";

import { useState } from "react";
import { Icon } from "@/components/journey/icon";
import { ClientShell, JMain, useCurrentClient } from "@/components/journey/shell";
import { Avatar, JButton, JLink, Panel, PanelHead, Pill, Ring } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { LOGO, clientHref, completionColor } from "@/lib/journey/portfolio";
import { useJourney, useScreenState } from "@/lib/journey/store";

// 05 · Entity 360. Profile, index enrollments, history and stakeholders for one client.

const TABS = ["Overview", "Stakeholders · 9", "Index history", "Systems", "Activity"] as const;

const BARS: { y: string; v: number; src: "reg" | "file" | "live"; rank: string }[] = [
  { y: "2022", v: 58.2, src: "reg", rank: "#31" },
  { y: "2023", v: 61.9, src: "reg", rank: "#27" },
  { y: "2024", v: 63.0, src: "file", rank: "#24" },
  { y: "2025", v: 65.6, src: "reg", rank: "#21" },
  { y: "2026", v: 72.4, src: "live", rank: "live" },
];

const FACTS: [string, string][] = [
  ["Employees", "1,000–5,000"],
  ["Beneficiaries", "≈ 2.1 M / yr"],
  ["Digital services", "38"],
  ["Hosting", "Gov cloud · in-Kingdom"],
  ["DGA liaison", "Noura A."],
  ["Data level", "Restricted"],
];

const PERSPECTIVES = ["Strategy", "Services", "Technology", "People", "Data"];
const RACI_TONE: Record<string, [string, string]> = { R: ["#FDECEA", "#B42318"], A: ["#E0ECF8", "#1E4E8C"], C: ["#EEEDFD", "#4F46E5"], I: ["#F5F7F9", "#47534D"], "": ["#FAFBFC", "#C9D1CD"] };
const AV: [string, string][] = [["#FDECEA", "#B42318"], ["#FFF4DF", "#8A4B00"], ["#E0ECF8", "#1E4E8C"], ["#E7F3ED", "#0E5A45"], ["#F3E8F7", "#7A2E8C"]];
const RACI: { av: string; tone: number; name: string; role: string; cells: string[]; user: boolean }[] = [
  { av: "NA", tone: 3, name: "Noura A.", role: "Index owner · DGA liaison", cells: ["A", "A", "A", "A", "A"], user: true },
  { av: "RZ", tone: 0, name: "Dr. Rami Z.", role: "Executive sponsor", cells: ["I", "I", "I", "I", "I"], user: false },
  { av: "FK", tone: 2, name: "Faisal K.", role: "IT Operations head", cells: ["", "C", "R", "", "C"], user: true },
  { av: "RS", tone: 4, name: "Reem S.", role: "Digital Transformation", cells: ["R", "R", "C", "", ""], user: true },
  { av: "LT", tone: 1, name: "Lama T.", role: "Human Capital head", cells: ["", "", "", "R", ""], user: true },
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
  const { state, log } = useJourney();
  const [tab, setTab] = useState(0);
  const [proposed, setProposed] = useScreenState<string[]>(`360.${client.id}.proposed`, []);
  const [lbg, lfg] = LOGO[client.logo];
  const active = client.flag !== "draft";
  const pct = client.id === "demo-entity" ? 72.4 : client.pct;

  const propose = (what: string) => {
    setProposed((d) => void (d.includes(what) || d.push(what)));
    log(`Proposed ${what} to ${client.name}`);
  };

  const history = (
    <Panel className="flex flex-[2_1_520px] flex-col gap-4 p-[22px]">
      <PanelHead
        title={`${client.frameworks[0]?.split(" ")[0] ?? "Qiyas"} history`}
        aside={
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
        }
      />
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
    </Panel>
  );

  const profile = (
    <Panel className="flex flex-[1_1_300px] flex-col gap-1 p-[22px]">
      <h2 className="m-0 mb-2 text-base">Profile</h2>
      {FACTS.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-b border-j-line-soft py-2.5 text-sm last:border-0">
          <span className="text-j-muted">{k}</span>
          <b className="text-end">{v}</b>
        </div>
      ))}
      <div className="mt-2 flex gap-1.5">
        {["DGA", "NCA", "SDAIA"].map((r) => (
          <Pill key={r} round={false}>
            {r}
          </Pill>
        ))}
      </div>
    </Panel>
  );

  const raci = (
    <Panel className="flex flex-col gap-4 p-[22px]">
      <PanelHead
        title="Stakeholders · RACI by perspective"
        aside={
          <span className="text-xs text-j-muted">
            <b>R</b> responsible <b>A</b> accountable <b>C</b> consulted <b>I</b> informed
          </span>
        }
      />
      <div className="overflow-x-auto">
        <div role="table" aria-label="RACI" className="grid min-w-[760px] grid-cols-[2fr_repeat(5,1fr)_0.9fr] items-center gap-1.5 text-sm">
          <span role="columnheader" />
          {PERSPECTIVES.map((p) => (
            <span key={p} role="columnheader" className="text-center text-xs font-semibold text-j-muted">
              {p}
            </span>
          ))}
          <span role="columnheader" className="text-center text-xs font-semibold text-j-muted">
            Access
          </span>
          {RACI.map((r) => (
            <div key={r.av} role="row" className="contents">
              <span role="rowheader" className="flex items-center gap-2.5 py-1">
                <Avatar initials={r.av} bg={AV[r.tone][0]} fg={AV[r.tone][1]} />
                <span className="flex flex-col leading-[17px]">
                  <b>{r.name}</b>
                  <span className="text-xs text-j-muted">{r.role}</span>
                </span>
              </span>
              {r.cells.map((v, i) => (
                <span key={i} role="cell" className="flex h-9 items-center justify-center rounded-lg text-[13px] font-bold" style={{ background: RACI_TONE[v][0], color: RACI_TONE[v][1] }}>
                  {v || "·"}
                </span>
              ))}
              <span role="cell" className="text-center">
                <Pill tone={r.user ? "ok" : "draft"}>{r.user ? "User" : "Contact"}</Pill>
              </span>
            </div>
          ))}
        </div>
      </div>
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
                {active ? <Pill tone="ok">✓ Activated by client</Pill> : <Pill tone="warn">Waiting for client activation</Pill>}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {proposed.includes("a profile change") ? (
              <Pill tone="cx">Profile change proposed</Pill>
            ) : (
              <JButton onClick={() => propose("a profile change")}>Propose profile change</JButton>
            )}
            {active && (
              <JLink href={clientHref(client.id)} variant="primary">
                Open {client.frameworks[0]?.split(" ")[0]} workspace
              </JLink>
            )}
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
              {t}
            </button>
          ))}
        </div>

        {tab === 0 && (
          <>
            <section aria-label="Index enrollments" className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
              <Panel className="flex items-center gap-4 border-2 border-cx p-[18px]">
                <Ring pct={pct ?? 0} color={completionColor(pct ?? null)} label={pct == null ? "Not started" : `Completion ${pct} percent`}>
                  <b className="text-base">{pct == null ? "—" : `${Math.round(pct)}%`}</b>
                </Ring>
                <span className="flex flex-col gap-0.5 text-sm">
                  <b className="text-base">{client.frameworks[0]}</b>
                  <span className="font-semibold text-cx">Managed by you</span>
                  <span className="text-[13px] text-j-muted">Target 85 · verification in 9 d</span>
                </span>
              </Panel>
              <Panel className="flex items-center gap-4 p-[18px]">
                <span className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-j-canvas text-j-muted">
                  <Icon name="lock" size={22} />
                </span>
                <span className="flex flex-col gap-0.5 text-sm">
                  <b className="text-base">NCA ECC</b>
                  <span className="font-semibold text-j-ink-3">Self-managed</span>
                  <span className="text-[13px] text-j-muted">Not in your engagement</span>
                </span>
              </Panel>
              <button
                type="button"
                onClick={() => propose("another index")}
                disabled={proposed.includes("another index")}
                className="flex cursor-pointer items-center gap-4 rounded-[20px] border-2 border-dashed border-cx-line bg-cx-tint p-[18px] text-left text-j-ink disabled:cursor-default"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cx text-xl text-white">+</span>
                <span className="flex flex-col text-sm">
                  <b className="text-base">{proposed.includes("another index") ? "Add-on proposed" : "Propose another index"}</b>
                  <span className="text-[13px] text-j-muted">NDMO, ISO 27001 · offer as add-on</span>
                </span>
              </button>
            </section>
            <div className="flex flex-wrap gap-3.5">
              {history}
              {profile}
            </div>
            {raci}
          </>
        )}
        {tab === 1 && raci}
        {tab === 2 && <div className="flex flex-wrap gap-3.5">{history}</div>}
        {tab === 3 && (
          <Panel className="overflow-hidden">
            {SYSTEMS.map(([name, what, st]) => (
              <div key={name} className="flex flex-wrap items-center gap-3 border-b border-j-line-soft px-[22px] py-3.5 text-sm last:border-0">
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
        )}
        {tab === 4 && (
          <Panel className="flex flex-col gap-2 p-[22px]">
            <h2 className="m-0 text-base">Activity</h2>
            {[...state.log.map((l) => [l.at, l.text]), ["10 Jun", "Engagement ENG-0142 activated by Noura A."], ["9 Jun", "Client signed the engagement"], ["2 Jun", "Draft workspace created by Sami R."]].map(([at, text], i) => (
              <div key={i} className="flex gap-3 border-b border-j-line-soft py-2 text-sm last:border-0">
                <span className="w-28 flex-none text-xs text-j-muted">{at}</span>
                <span>{text}</span>
              </div>
            ))}
          </Panel>
        )}
      </JMain>
    </ClientShell>
  );
}
