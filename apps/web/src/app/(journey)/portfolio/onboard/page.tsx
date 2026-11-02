"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/journey/icon";
import { ConsultantShell, JMain } from "@/components/journey/shell";
import { Avatar, JButton, JLink, Panel, Pill, Segmented, inputClass, type PillTone } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { LOGO, type Client, type Engagement } from "@/lib/journey/portfolio";
import { useJourney, useScreenState } from "@/lib/journey/store";

// 04 · Onboard client. A seven-step wizard that builds a draft workspace from public data;
// the client's index owner activates it. Kickoff stays locked until then.

const STEPS: [string, string][] = [
  ["Client", "Reference list"],
  ["Stakeholders", "People & roles"],
  ["Frameworks & history", "Past cycles"],
  ["Team & access", "Assignments"],
  ["Engagement", "Contract & ECC 4-1"],
  ["Send for activation", "Client activates"],
  ["Kickoff", "After approval"],
];

/** Government entities from the reference list that are not yet on the platform. */
const REFERENCE: { id: string; ini: string; name: string; nameAr: string; type: string; parent: string; domain: string; logo: number }[] = [
  { id: "demo-skills", ini: "SF", name: "Demo Skills Fund", nameAr: "صندوق المهارات التجريبي", type: "Fund", parent: "Demo Ministry of Services", domain: "skillsfund.example.sa", logo: 5 },
  { id: "demo-housing", ini: "HA", name: "Demo Housing Authority", nameAr: "هيئة الإسكان التجريبية", type: "Authority", parent: "Demo Ministry of Services", domain: "housing.example.sa", logo: 1 },
  { id: "demo-tourism", ini: "TB", name: "Demo Tourism Board", nameAr: "مجلس السياحة التجريبي", type: "Board", parent: "Demo Ministry of Culture", domain: "tourism.example.sa", logo: 3 },
  { id: "demo-stats", ini: "SA", name: "Demo Statistics Agency", nameAr: "وكالة الإحصاء التجريبية", type: "Agency", parent: "Demo Ministry of Planning", domain: "stats.example.sa", logo: 4 },
];

const AV: [string, string][] = [["#FDECEA", "#B42318"], ["#FFF4DF", "#8A4B00"], ["#EAF1FA", "#1E4E8C"], ["#E7F3ED", "#0E5A45"]];

interface Person {
  av: string;
  name: string;
  roles: string[];
  tone: number;
  user: boolean;
}

const PROVENANCE: Record<string, [string, PillTone]> = { reg: ["Regulator", "ok"], file: ["Client file", "cx"], est: ["Estimated", "warn"] };

const HISTORY = [
  { cycle: "2025", score: "61.4%", rank: "#18 of 41", prov: "file", ver: "Needs client check", ok: false },
  { cycle: "2024", score: "57.9%", rank: "#22 of 40", prov: "reg", ver: "Matches DGA", ok: true },
  { cycle: "2023", score: "52.0%", rank: "—", prov: "reg", ver: "Matches DGA", ok: true },
  { cycle: "2022", score: "~48%", rank: "—", prov: "est", ver: "Estimated", ok: false },
];

const TEAM = [
  { av: "SR", name: "Sami R.", role: "Lead" },
  { av: "MK", name: "Mohammed K.", role: "Consultant" },
  { av: "YT", name: "Yasser T.", role: "Consultant" },
  { av: "RN", name: "Rana N.", role: "Quality reviewer" },
];

const CHOICES: { key: keyof Wizard["choices"]; label: string; opts: string[] }[] = [
  { key: "model", label: "Operating model", opts: ["Managed", "Co-managed"] },
  { key: "duration", label: "Duration", opts: ["6 months", "12 months"] },
  { key: "data", label: "Highest data level", opts: ["Public", "Restricted", "Secret · JIT"] },
  { key: "accept", label: "Final acceptance", opts: ["Client only", "Co-sign"] },
];

const DELIVERABLES = ["Gap assessment", "Evidence pack", "Submission pack", "Remediation plan", "Cycle closure report"];

const ATTEST: [string, string][] = [
  ["NDA signed", "ECC 4-1"],
  ["Data removal at end", "ECC 4-1"],
  ["Incident reporting agreed", "ECC 4-1"],
  ["Apply client policies", "ECC 4-1-2"],
  ["Risk assessment done", "ECC 4-1-3"],
  ["Team works in-Kingdom", "ECC 4-1-3-2"],
  ["No conflict of interest", "COI"],
  ["Processing agreement", "PDPL"],
];

interface Wizard {
  step: number;
  refId: string;
  people: Person[];
  indices: string[];
  choices: { model: string; duration: string; data: string; accept: string };
  contract: { ref: string; start: string; end: string };
  attest: boolean[];
  history: "none" | "imported";
  sent: string[];
  savedAt?: string;
}

const START: Wizard = {
  step: 0,
  refId: "demo-skills",
  people: [
    { av: "AM", name: "Abdullah M.", roles: ["Index owner", "Approver"], tone: 0, user: true },
    { av: "RZ", name: "Dr. Rania Z.", roles: ["Executive sponsor"], tone: 0, user: false },
    { av: "NH", name: "Nawaf H.", roles: ["DGA liaison officer"], tone: 1, user: true },
    { av: "HB", name: "Hessa B.", roles: ["IT head", "SPOC"], tone: 2, user: true },
    { av: "TQ", name: "Turki Q.", roles: ["HR head"], tone: 3, user: false },
  ],
  indices: ["Qiyas"],
  choices: { model: "Co-managed", duration: "12 months", data: "Restricted", accept: "Client only" },
  contract: { ref: "CT-2026-118", start: "15 Nov 2026", end: "14 Nov 2027" },
  attest: [true, true, true, true, false, true, true, false],
  history: "imported",
  sent: [],
};

export default function OnboardPage() {
  const { clients, update, log } = useJourney();
  const [w, setW] = useScreenState<Wizard>("onboard", START);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const ref = REFERENCE.find((r) => r.id === w.refId) ?? REFERENCE[0];
  const sent = w.sent.includes(ref.id);
  const users = w.people.filter((p) => p.user).length;
  const attestOk = w.attest.every(Boolean);
  const matches = REFERENCE.filter((r) => `${r.name} ${r.nameAr}`.toLowerCase().includes(search.trim().toLowerCase()));
  const months = w.choices.duration.startsWith("6") ? "6 mo" : "12 mo";

  const go = (step: number) => setW((d) => void (d.step = Math.max(0, Math.min(5, step))));

  function send() {
    const exists = clients.some((c) => c.id === ref.id);
    const client: Client = {
      id: ref.id,
      ini: ref.ini,
      name: ref.name,
      nameAr: ref.nameAr,
      sub: "Draft · waiting for client activation",
      logo: ref.logo,
      frameworks: w.indices.map((i) => (i === "Qiyas" ? "Qiyas 2026" : i)),
      pct: null,
      next: "Draft",
      nextTone: "draft",
      flag: "draft",
    };
    const engagement: Engagement = {
      clientId: ref.id,
      index: w.indices[0] ?? "Qiyas",
      model: "draft",
      ready: null,
      delta: "—",
      milestone: "Draft expires · 60 d",
      milestoneLate: false,
      term: "Pending approval",
      termState: "pend",
      lead: "SR",
    };
    update((s) => {
      if (!exists) s.added.push({ client, engagement });
      const wz = s.screens.onboard as Wizard | undefined;
      if (wz) wz.sent.push(ref.id);
      else s.screens.onboard = { ...structuredClone(START), sent: [ref.id] };
    });
    log(`Activation request sent to ${w.people.find((p) => p.roles.includes("Index owner"))?.name ?? "index owner"} · ${ref.name}`);
  }

  const stepper = (
    <ol aria-label="Steps" className="m-0 flex flex-[1_1_240px] list-none flex-col gap-1 p-0">
      {STEPS.map(([label, sub], i) => {
        const done = i < w.step || (sent && i <= 5);
        const on = i === w.step && !sent;
        const locked = i === 6;
        return (
          <li key={label}>
            <button
              type="button"
              aria-current={on ? "step" : undefined}
              disabled={locked}
              onClick={() => go(i)}
              className={cx(
                "flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-xl border-0 px-3 text-left disabled:cursor-not-allowed",
                on ? "bg-cx-soft" : "bg-transparent hover:bg-white",
                locked ? "text-[#8A968F]" : "text-j-ink",
              )}
            >
              <span
                className={cx(
                  "flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-bold",
                  done ? "bg-cx text-white" : on ? "bg-white text-cx" : "bg-[#F5F7F9] text-j-muted",
                )}
              >
                {locked ? <Icon name="lock" size={13} /> : done ? <Icon name="check" size={14} strokeWidth={2.6} /> : i + 1}
              </span>
              <span className="flex flex-col">
                <b className="text-sm">{label}</b>
                <span className="text-xs text-j-muted">{sub}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );

  return (
    <ConsultantShell
      search="Search clients and engagements"
      headerExtra={
        <span className="text-xs text-[#8A4B00]">Auto-expires in 60 days</span>
      }
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-[#F0DDB0] bg-[#FFF8EA] px-8 py-3">
        <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#8A4B00]">
          <Icon name="draft" size={16} />
          Draft workspace · Public data only until the client activates it
        </span>
      </div>
      <JMain max={1320}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Onboard client</h1>
          <span className="flex items-center gap-2.5">
            {w.savedAt && <span className="text-xs text-j-muted">Saved {w.savedAt}</span>}
            <JButton
              className="font-medium"
              onClick={() => {
                const at = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                setW((d) => void (d.savedAt = at));
                log(`Draft saved · ${ref.name}`);
              }}
            >
              Save draft
            </JButton>
          </span>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          {stepper}
          <Panel className="flex min-w-0 flex-[999_1_640px] flex-col gap-5 border-[#E3E8EF] p-[26px]">
            {sent ? (
              <div className="flex flex-col items-start gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cx text-white">
                  <Icon name="send" size={22} />
                </span>
                <h2 className="m-0 text-xl">Activation request sent</h2>
                <p className="m-0 max-w-[560px] text-sm text-j-ink-2">
                  {w.people.find((p) => p.roles.includes("Index owner"))?.name ?? "The index owner"} verifies with work email and MFA, then activates the {ref.name} workspace.
                  Kickoff unlocks after approval. The draft stays on public data until then.
                </p>
                <div className="flex flex-wrap gap-2">
                  <JLink href="/portfolio" variant="primary">
                    Back to portfolio
                  </JLink>
                  <JLink href="/entities">See it in the entity list</JLink>
                  <JButton
                    variant="ghost"
                    onClick={() =>
                      setW((d) => {
                        const next = REFERENCE.find((r) => !d.sent.includes(r.id) && !clients.some((c) => c.id === r.id));
                        d.step = 0;
                        d.refId = next?.id ?? d.refId;
                      })
                    }
                  >
                    Onboard another client
                  </JButton>
                </div>
              </div>
            ) : (
              <>
                {w.step === 0 && (
                  <div className="flex flex-col gap-[18px]">
                    <h2 className="m-0 text-xl">Which client?</h2>
                    <label className="flex h-12 items-center gap-2.5 rounded-xl border-2 border-cx px-3.5 text-j-muted">
                      <Icon name="search" size={16} />
                      <span className="sr-only">Search government entities</span>
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search government entities"
                        className="flex-auto border-0 bg-transparent text-[15px] text-j-ink outline-none"
                      />
                    </label>
                    <div role="radiogroup" aria-label="Reference list" className="flex flex-col gap-2">
                      {matches.map((r) => {
                        const on = r.id === ref.id;
                        const [lbg, lfg] = LOGO[r.logo];
                        const onPlatform = clients.some((c) => c.id === r.id && c.flag !== "draft");
                        return (
                          <button
                            key={r.id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            disabled={onPlatform}
                            onClick={() => setW((d) => void (d.refId = r.id))}
                            className={cx(
                              "flex cursor-pointer items-center gap-3.5 rounded-[14px] border p-3.5 text-left text-sm text-j-ink",
                              on ? "border-cx-soft bg-cx-soft" : "border-j-line bg-white hover:bg-j-canvas",
                            )}
                          >
                            <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl text-[13px] font-bold" style={{ background: lbg, color: lfg }}>
                              {r.ini}
                            </span>
                            <span className="flex-auto">
                              <b>{r.name}</b> ·{" "}
                              <span lang="ar" dir="rtl" className="font-arabic">
                                {r.nameAr}
                              </span>
                              <br />
                              <span className="text-xs text-j-ink-3">
                                From reference list · {r.type} · {clients.some((c) => c.id === r.id) ? "draft exists" : "not yet on the platform"}
                              </span>
                            </span>
                            {on && <span className="text-xs font-bold text-cx">✓ Selected</span>}
                          </button>
                        );
                      })}
                      {matches.length === 0 && <span className="text-sm text-j-muted">No entity in the reference list matches.</span>}
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
                      {[
                        ["Name (English)", ref.name, "ltr"],
                        ["الاسم (عربي)", ref.nameAr, "rtl"],
                        ["Entity type", ref.type, "ltr"],
                        ["Parent body", ref.parent, "ltr"],
                        ["Official domain", ref.domain, "ltr"],
                      ].map(([l, v, dir]) => (
                        <label key={`${ref.id}-${l}`} className="flex flex-col gap-1.5 text-[13px] font-semibold">
                          {l}
                          <input type="text" defaultValue={v} dir={dir} className={cx(inputClass, dir === "rtl" && "font-arabic")} />
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {w.step === 1 && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="m-0 text-xl">Key stakeholders</h2>
                      <span className="text-xs text-j-muted">{users} of {w.people.length} get a user account</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {w.people.map((p, i) => (
                        <div key={p.av + i} className="flex flex-wrap items-center gap-3 rounded-[14px] border border-j-line px-3.5 py-3">
                          <Avatar initials={p.av} bg={AV[p.tone][0]} fg={AV[p.tone][1]} size={36} />
                          <span className="flex min-w-0 flex-auto flex-col gap-1">
                            <b className="text-sm">{p.name}</b>
                            <span className="flex flex-wrap gap-1">
                              {p.roles.map((r) => (
                                <Pill key={r} round={false} className="py-0.5 text-[11px]">
                                  {r}
                                </Pill>
                              ))}
                            </span>
                          </span>
                          <Segmented
                            size="sm"
                            label={`Access type for ${p.name}`}
                            value={p.user ? "user" : "contact"}
                            options={[
                              { value: "contact", label: "Contact" },
                              { value: "user", label: "User" },
                            ]}
                            onChange={(v) => setW((d) => void (d.people[i].user = v === "user"))}
                          />
                        </div>
                      ))}
                    </div>
                    <form
                      className="flex flex-wrap gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const name = newName.trim();
                        if (!name) return;
                        const av = name
                          .split(/\s+/)
                          .map((s) => s[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase();
                        setW((d) => void d.people.push({ av, name, roles: ["Contributor"], tone: d.people.length % 4, user: false }));
                        setNewName("");
                      }}
                    >
                      <label className="flex-[1_1_240px]">
                        <span className="sr-only">Name of the new person</span>
                        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name of a new stakeholder" className={cx(inputClass, "w-full")} />
                      </label>
                      <JButton type="submit" variant="outline" size="lg" disabled={!newName.trim()}>
                        + Add person
                      </JButton>
                    </form>
                  </div>
                )}

                {w.step === 2 && (
                  <div className="flex flex-col gap-4">
                    <h2 className="m-0 text-xl">Frameworks &amp; history</h2>
                    <div className="flex flex-wrap gap-2">
                      {["Qiyas", "NCA ECC", "NDMO data", "ISO 27001"].map((x) => {
                        const on = w.indices.includes(x);
                        return (
                          <button
                            key={x}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setW((d) => void (d.indices = on ? d.indices.filter((i) => i !== x) : [...d.indices, x]))}
                            className={cx(
                              "inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] px-3.5 text-sm font-semibold text-j-ink",
                              on ? "border-cx bg-cx-soft" : "border-[#E3E8EF] bg-white",
                            )}
                          >
                            {x}
                            <span className={cx("flex h-5 w-5 items-center justify-center rounded-md border-[1.5px] text-[11px] text-white", on ? "border-cx bg-cx" : "border-[#E3E8EF]")}>{on ? "✓" : ""}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <JButton size="sm" onClick={() => setW((d) => void (d.history = "imported"))}>
                        Import Excel
                      </JButton>
                      <JButton size="sm" className="text-j-ai" onClick={() => setW((d) => void (d.history = "imported"))}>
                        <Icon name="ai" size={14} />
                        Extract DGA report
                      </JButton>
                      <JButton size="sm" onClick={() => setW((d) => void (d.history = "imported"))}>
                        Pull public results
                      </JButton>
                    </div>
                    {w.history === "imported" ? (
                      <>
                        <div role="table" aria-label="Qiyas history" className="overflow-hidden rounded-[14px] border border-j-line text-sm">
                          {HISTORY.map((h) => {
                            const [prov, tone] = PROVENANCE[h.prov];
                            return (
                              <div key={h.cycle} role="row" className="grid grid-cols-[0.6fr_0.8fr_1fr_1fr_1.3fr] items-center gap-3 border-b border-j-line-soft px-4 py-3 last:border-0">
                                <b role="cell">{h.cycle}</b>
                                <b role="cell" className="text-base">
                                  {h.score}
                                </b>
                                <span role="cell" className="text-j-muted">
                                  {h.rank}
                                </span>
                                <span role="cell">
                                  <Pill tone={tone}>{prov}</Pill>
                                </span>
                                <span role="cell" className={cx("text-[13px] font-semibold", h.ok ? "text-brand" : "text-[#8A4B00]")}>
                                  {h.ver}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex flex-col gap-2 rounded-[14px] bg-j-canvas p-3.5">
                          <span className="flex justify-between text-[13px]">
                            <b>Crosswalk 2025 → 2026</b>
                            <span>86 of 89 standards mapped</span>
                          </span>
                          <span className="block h-1.5 overflow-hidden rounded-[3px] bg-[#E3E8EF]">
                            <span className="block h-full rounded-[3px] bg-cx" style={{ width: `${(86 / 89) * 100}%` }} />
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="m-0 text-sm text-j-muted">No past cycles yet. Import a file or pull the published results.</p>
                    )}
                  </div>
                )}

                {w.step === 3 && (
                  <div className="flex flex-col gap-4">
                    <h2 className="m-0 text-xl">Team &amp; assignments</h2>
                    <div className="flex flex-wrap gap-2">
                      {TEAM.map((t) => (
                        <span key={t.av} className="inline-flex items-center gap-2 rounded-full border border-j-line py-1 ps-1 pe-3 text-[13px]">
                          <Avatar initials={t.av} size={28} />
                          <b>{t.name}</b>
                          <span className="text-j-muted">{t.role}</span>
                        </span>
                      ))}
                    </div>
                    {CHOICES.map((c) => (
                      <div key={c.key} className="flex flex-wrap items-center justify-between gap-3 border-b border-j-line-soft pb-3 last:border-0">
                        <span className="text-sm font-semibold">{c.label}</span>
                        <Segmented
                          label={c.label}
                          value={w.choices[c.key]}
                          options={c.opts.map((o) => ({ value: o, label: o }))}
                          onChange={(v) => setW((d) => void (d.choices[c.key] = v))}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {w.step === 4 && (
                  <div className="flex flex-col gap-4">
                    <h2 className="m-0 text-xl">Engagement &amp; NCA ECC 4-1</h2>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
                      {(
                        [
                          ["ref", "Contract ref"],
                          ["start", "Start"],
                          ["end", "End"],
                        ] as const
                      ).map(([k, l]) => (
                        <label key={k} className="flex flex-col gap-1.5 text-[13px] font-semibold">
                          {l}
                          <input type="text" value={w.contract[k]} onChange={(e) => setW((d) => void (d.contract[k] = e.target.value))} className={inputClass} />
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="me-1 text-[13px] font-semibold">Deliverables</span>
                      {DELIVERABLES.map((d) => (
                        <Pill key={d} tone="cx">
                          {d}
                        </Pill>
                      ))}
                    </div>
                    <fieldset className="m-0 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-2 border-0 p-0">
                      <legend className="mb-2 text-[13px] font-semibold">Third-party attestation · all required before sending</legend>
                      {ATTEST.map(([l, r], i) => (
                        <label key={l} className={cx("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border px-3 text-sm", w.attest[i] ? "border-j-line" : "border-[#F0DDB0] bg-[#FFFBF3]")}>
                          <input type="checkbox" checked={w.attest[i]} onChange={(e) => setW((d) => void (d.attest[i] = e.target.checked))} className="h-4 w-4 accent-[#1E4E8C]" />
                          <span className="flex-auto">{l}</span>
                          <span className="font-mono text-[11px] text-j-muted">{r}</span>
                        </label>
                      ))}
                    </fieldset>
                  </div>
                )}

                {w.step === 5 && (
                  <div className="flex flex-col gap-4">
                    <h2 className="m-0 text-xl">Send to the client</h2>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
                      {[
                        [w.people.length, "stakeholders"],
                        [w.history === "imported" ? HISTORY.length : 0, "cycles of history"],
                        [TEAM.length, "consultants"],
                        [months, "access requested"],
                      ].map(([v, l]) => (
                        <div key={l} className="rounded-[14px] bg-j-canvas p-3.5">
                          <b className="text-[22px]">{v}</b>
                          <br />
                          <span className="text-[13px] text-j-muted">{l}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 rounded-[14px] border border-cx-line bg-cx-tint p-3.5 text-sm">
                      <Avatar initials="AM" bg={AV[0][0]} fg={AV[0][1]} size={36} />
                      <span>
                        <b>{w.people.find((p) => p.roles.includes("Index owner"))?.name ?? "Index owner"}</b> · Index owner
                        <br />
                        <span className="text-[13px] text-j-ink-3">Verifies with work email and MFA, then activates the workspace</span>
                      </span>
                    </div>
                    {(!attestOk || w.indices.length === 0) && (
                      <p role="alert" className="m-0 flex items-center gap-2 rounded-xl bg-j-warn-soft px-3.5 py-2.5 text-[13px] text-[#8A4B00]">
                        <Icon name="flag" size={14} />
                        {!attestOk ? (
                          <>
                            {w.attest.filter((a) => !a).length} ECC 4-1 attestations are still open.{" "}
                            <button type="button" onClick={() => go(4)} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-[#8A4B00] underline">
                              Complete them
                            </button>
                          </>
                        ) : (
                          "Choose at least one framework."
                        )}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-between gap-2 border-t border-j-line-soft pt-4">
                  <JButton onClick={() => go(w.step - 1)} disabled={w.step === 0}>
                    Back
                  </JButton>
                  {w.step < 5 ? (
                    <JButton variant="primary" onClick={() => go(w.step + 1)}>
                      Continue
                    </JButton>
                  ) : (
                    <JButton variant="primary" onClick={send} disabled={!attestOk || w.indices.length === 0}>
                      <Icon name="send" size={15} />
                      Send activation request
                    </JButton>
                  )}
                </div>
              </>
            )}
          </Panel>
        </div>
        <p className="m-0 text-xs text-j-muted">
          Drafts hold public data only. <Link href="/portfolio">Back to portfolio</Link>
        </p>
      </JMain>
    </ConsultantShell>
  );
}
