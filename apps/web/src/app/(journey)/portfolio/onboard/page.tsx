"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/journey/icon";
import { PeopleEditor } from "@/components/journey/people-editor";
import { ConsultantShell, JMain } from "@/components/journey/shell";
import { Avatar, JButton, JLink, Panel, Pill, Segmented, inputClass, type PillTone } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { useAdmin } from "@/lib/admin/store";
import { shortName } from "@/lib/journey/frameworks";
import { LOGO, clientHref, type Client, type Engagement } from "@/lib/journey/portfolio";
import { PEOPLE_KEY, normalizePerson, type EntityPerson } from "@/lib/journey/people";
import { DEFAULT_FACTS, PROFILE_KEY } from "@/lib/journey/profile";
import { useJourney, useScreenState } from "@/lib/journey/store";

// 04 · Add entity. A six-step wizard; creating the entity makes it active straight away,
// with one engagement per framework picked from the Framework Builder library. Stakeholders
// marked as users are invited, but nothing waits on their approval.

const STEPS: [string, string][] = [
  ["Client", "Reference list"],
  ["Stakeholders", "People & roles"],
  ["Frameworks & history", "From the library"],
  ["Team & access", "Assignments"],
  ["Engagement", "Contract & ECC 4-1"],
  ["Review & create", "Entity goes live"],
];
const LAST = STEPS.length - 1;

/** Government entities from the reference list that are not yet on the platform. */
const REFERENCE: { id: string; ini: string; name: string; nameAr: string; type: string; parent: string; domain: string; logo: number }[] = [
  { id: "demo-skills", ini: "SF", name: "Demo Skills Fund", nameAr: "صندوق المهارات التجريبي", type: "Fund", parent: "Demo Ministry of Services", domain: "skillsfund.example.sa", logo: 5 },
  { id: "demo-housing", ini: "HA", name: "Demo Housing Authority", nameAr: "هيئة الإسكان التجريبية", type: "Authority", parent: "Demo Ministry of Services", domain: "housing.example.sa", logo: 1 },
  { id: "demo-tourism", ini: "TB", name: "Demo Tourism Board", nameAr: "مجلس السياحة التجريبي", type: "Board", parent: "Demo Ministry of Culture", domain: "tourism.example.sa", logo: 3 },
  { id: "demo-stats", ini: "SA", name: "Demo Statistics Agency", nameAr: "وكالة الإحصاء التجريبية", type: "Agency", parent: "Demo Ministry of Planning", domain: "stats.example.sa", logo: 4 },
];


/** Stakeholders as saved by older versions of the wizard (initials, tone, user flag) or as people with details. */
type Person = Partial<EntityPerson> & { av?: string; user?: boolean };

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
  /** Library frameworks the entity is enrolled in. */
  frameworkIds?: string[];
  /** Short names picked before frameworks came from the library. */
  indices?: string[];
  choices: { model: string; duration: string; data: string; accept: string };
  contract: { ref: string; start: string; end: string };
  attest: boolean[];
  history: "none" | "imported";
  /** Entities created from this wizard (called "sent" while creation needed client approval). */
  created?: string[];
  sent?: string[];
  savedAt?: string;
}

const START: Wizard = {
  step: 0,
  refId: "demo-housing",
  people: [
    { id: "s-am", name: "Abdullah M.", email: "abdullah.m@housing.example.sa", department: "Strategy & Performance", title: "Director of strategy", roles: ["Index owner", "Approver"], access: "user" },
    { id: "s-rz", name: "Dr. Rania Z.", email: "", department: "Executive office", title: "Deputy governor", roles: ["Executive sponsor"], access: "contact" },
    { id: "s-nh", name: "Nawaf H.", email: "nawaf.h@housing.example.sa", department: "Digital Transformation", title: "Transformation lead", roles: ["DGA liaison officer"], access: "user" },
    { id: "s-hb", name: "Hessa B.", email: "hessa.b@housing.example.sa", department: "IT Operations", title: "IT head", roles: ["SPOC"], access: "user" },
    { id: "s-tq", name: "Turki Q.", email: "", department: "Human Capital", title: "HR head", roles: [], access: "contact" },
  ],
  frameworkIds: ["fw-qiyas"],
  choices: { model: "Co-managed", duration: "12 months", data: "Restricted", accept: "Client only" },
  contract: { ref: "CT-2026-118", start: "15 Nov 2026", end: "14 Nov 2027" },
  attest: [true, true, true, true, false, true, true, false],
  history: "imported",
  created: [],
};

export default function OnboardPage() {
  const { clients, update, log } = useJourney();
  const { state: admin } = useAdmin();
  const [w, setW] = useScreenState<Wizard>("onboard", START);
  const [search, setSearch] = useState("");
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const ref = REFERENCE.find((r) => r.id === w.refId) ?? REFERENCE[0];
  const created = w.created ?? w.sent ?? [];
  const done = created.includes(ref.id);
  const people = w.people.map(normalizePerson);
  const users = people.filter((p) => p.access === "user").length;
  const attestOk = w.attest.every(Boolean);
  const matches = REFERENCE.filter((r) => `${r.name} ${r.nameAr}`.toLowerCase().includes(search.trim().toLowerCase()));
  const months = w.choices.duration.startsWith("6") ? "6 mo" : "12 mo";
  const onPlatform = (id: string) => clients.some((c) => c.id === id);

  // Only published library frameworks can be assigned; drafts are listed but locked.
  const library = admin.frameworks.filter((f) => f.live || f.draft).sort((x, y) => (x.live ? 0 : 1) - (y.live ? 0 : 1) || (x.live ?? x.draft)!.name.localeCompare((y.live ?? y.draft)!.name));
  const legacy = (w.indices ?? []).map((i) => admin.frameworks.find((f) => f.live && shortName(f.live.name).toLowerCase().startsWith(i.toLowerCase().split(" ")[0]))?.id).filter((x): x is string => !!x);
  const picked = (w.frameworkIds ?? legacy).filter((id) => admin.frameworks.some((f) => f.id === id && f.live));
  const pickedFw = picked.map((id) => admin.frameworks.find((f) => f.id === id)!.live!);
  const historyFw = historyFor && picked.includes(historyFor) ? historyFor : picked[0];

  const go = (step: number) => setW((d) => void (d.step = Math.max(0, Math.min(LAST, step))));
  const toggle = (id: string) =>
    setW((d) => {
      const cur = (d.frameworkIds ?? legacy).filter((x) => x !== id);
      d.frameworkIds = picked.includes(id) ? cur : [...cur, id];
      delete d.indices;
    });

  function create() {
    if (onPlatform(ref.id)) return;
    const term = w.choices.duration.startsWith("6") ? "182 d left" : "365 d left";
    const model = w.choices.model === "Managed" ? "managed" : "co";
    const client: Client = {
      id: ref.id,
      ini: ref.ini,
      name: ref.name,
      nameAr: ref.nameAr,
      sub: `${ref.type} · new client`,
      logo: ref.logo,
      frameworks: pickedFw.map((f) => f.name),
      frameworkIds: picked,
      pct: 0,
      next: "Kickoff · 7 d",
      nextTone: "ok",
      flag: "active",
    };
    const engagements: Engagement[] = picked.map((id, i) => ({
      clientId: ref.id,
      index: shortName(pickedFw[i].name),
      frameworkId: id,
      model,
      ready: 0,
      delta: "new",
      milestone: "Kickoff · 7 d",
      milestoneLate: false,
      term,
      termState: "ok",
      lead: "SR",
    }));
    update((s) => {
      s.added.push({ client, engagement: engagements[0], more: engagements.slice(1) });
      // The people captured here are who requirements can be assigned to in the workspace.
      s.screens[PEOPLE_KEY(ref.id)] = people;
      s.screens[PROFILE_KEY(ref.id)] = { name: ref.name, nameAr: ref.nameAr, type: ref.type, parent: ref.parent, domain: ref.domain, facts: structuredClone(DEFAULT_FACTS) };
      const wz = (s.screens.onboard as Wizard | undefined) ?? structuredClone(START);
      wz.created = [...(wz.created ?? wz.sent ?? []), ref.id];
      delete wz.sent;
      s.screens.onboard = wz;
    });
    log(`Created ${ref.name} with ${pickedFw.map((f) => shortName(f.name)).join(" + ")}`);
    const invited = people.filter((p) => p.access === "user").map((p) => p.name);
    if (invited.length) log(`Invitations sent to ${invited.join(", ")} · ${ref.name}`);
  }

  const stepper = (
    <ol aria-label="Steps" className="m-0 flex flex-[1_1_240px] list-none flex-col gap-1 p-0">
      {STEPS.map(([label, sub], i) => {
        const past = i < w.step || done;
        const on = i === w.step && !done;
        return (
          <li key={label}>
            <button
              type="button"
              aria-current={on ? "step" : undefined}
              disabled={done}
              onClick={() => go(i)}
              className={cx(
                "flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-xl border-0 px-3 text-start text-j-ink disabled:cursor-default",
                on ? "bg-cx-soft" : "bg-transparent hover:bg-white",
              )}
            >
              <span
                className={cx(
                  "flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-bold",
                  past ? "bg-cx text-white" : on ? "bg-white text-cx" : "bg-[#F5F7F9] text-j-muted",
                )}
              >
                {past ? <Icon name="check" size={14} strokeWidth={2.6} /> : i + 1}
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
    <ConsultantShell search="Search clients and engagements">
      <JMain max={1320}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Add entity</h1>
          <span className="flex items-center gap-2.5">
            {w.savedAt && <span className="text-xs text-j-muted">Saved {w.savedAt}</span>}
            <JButton
              className="font-medium"
              onClick={() => {
                const at = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
                setW((d) => void (d.savedAt = at));
                log(`Onboarding progress saved · ${ref.name}`);
              }}
            >
              Save progress
            </JButton>
          </span>
        </div>

        <div className="flex flex-wrap items-start gap-5">
          {stepper}
          <Panel className="flex min-w-0 flex-[999_1_640px] flex-col gap-5 border-[#E3E8EF] p-[26px]">
            {done ? (
              <div className="flex flex-col items-start gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cx text-white">
                  <Icon name="check" size={22} strokeWidth={2.6} />
                </span>
                <h2 className="m-0 text-xl">{ref.name} is on the platform</h2>
                <p className="m-0 max-w-[560px] text-sm text-j-ink-2">
                  The workspace is active with {clients.find((c) => c.id === ref.id)?.frameworks.join(" and ") ?? "its frameworks"}. {users ? `${users} stakeholders were invited to sign in with their work email.` : ""} Schedule the
                  kickoff and start assigning requirements.
                </p>
                <div className="flex flex-wrap gap-2">
                  <JLink href={clientHref(ref.id)} variant="primary">
                    Open the workspace
                  </JLink>
                  <JLink href="/portfolio">Back to portfolio</JLink>
                  <JButton
                    variant="ghost"
                    onClick={() =>
                      setW((d) => {
                        const next = REFERENCE.find((r) => !clients.some((c) => c.id === r.id) && r.id !== ref.id);
                        // A new client starts with its own people, attestations and contract.
                        Object.assign(d, structuredClone({ ...START, created: d.created ?? d.sent ?? [] }), { people: [], refId: next?.id ?? d.refId, step: 0 });
                        delete d.sent;
                      })
                    }
                  >
                    Add another entity
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
                        const exists = onPlatform(r.id);
                        return (
                          <button
                            key={r.id}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            disabled={exists}
                            onClick={() => setW((d) => void (d.refId = r.id))}
                            className={cx(
                              "flex cursor-pointer items-center gap-3.5 rounded-[14px] border p-3.5 text-start text-sm text-j-ink disabled:cursor-not-allowed disabled:opacity-60",
                              on && !exists ? "border-cx-soft bg-cx-soft" : "border-j-line bg-white hover:bg-j-canvas",
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
                                From reference list · {r.type} · {exists ? "already on the platform" : "not yet on the platform"}
                              </span>
                            </span>
                            {on && !exists && <span className="text-xs font-bold text-cx">✓ Selected</span>}
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
                    <div className="flex flex-col gap-1">
                      <h2 className="m-0 text-xl">Key stakeholders and people</h2>
                      <p className="m-0 text-sm text-j-ink-2">
                        Everyone who will own or contribute to requirements. Type them in or import the client&apos;s staff list; requirements can be assigned to anyone here.
                      </p>
                    </div>
                    <PeopleEditor people={people} onChange={(next) => setW((d) => void (d.people = next))} onLog={log} />
                  </div>
                )}

                {w.step === 2 && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="m-0 text-xl">Frameworks &amp; history</h2>
                      <Link href="/studio/frameworks" className="text-[13px] font-semibold text-cx">
                        Manage the library →
                      </Link>
                    </div>
                    <p className="m-0 text-sm text-j-ink-2">Pick the indices this entity is managed for. Each one becomes its own engagement and requirement list.</p>
                    <div role="group" aria-label="Framework library" className="flex flex-col gap-2">
                      {library.map((f) => {
                        const v = (f.live ?? f.draft)!;
                        const on = picked.includes(f.id);
                        const locked = !f.live;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            aria-pressed={on}
                            disabled={locked}
                            onClick={() => toggle(f.id)}
                            className={cx(
                              "flex cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] p-3.5 text-start text-sm text-j-ink disabled:cursor-not-allowed disabled:opacity-60",
                              on ? "border-cx bg-cx-soft" : "border-[#E3E8EF] bg-white hover:bg-j-canvas",
                            )}
                          >
                            <span className={cx("flex h-5 w-5 flex-none items-center justify-center rounded-md border-[1.5px] text-[11px] text-white", on ? "border-cx bg-cx" : "border-[#C9D1CD]")}>{on ? "✓" : ""}</span>
                            <span className="flex min-w-0 flex-auto flex-col">
                              <b dir="auto">
                                {v.name} · v{v.version}
                              </b>
                              <span className="text-xs text-j-ink-3">
                                {v.authority} · {v.levels.map((l) => l.en).join(" › ")} · {v.requirements?.length ?? 0} nodes
                                {v.weighting === "none" ? " · no weights" : ""}
                              </span>
                            </span>
                            {locked ? <Pill tone="warn">Not published yet</Pill> : <span className="text-xs text-j-muted">{v.publishedAt ? `Published ${v.publishedAt}` : "Published"}</span>}
                          </button>
                        );
                      })}
                    </div>
                    {picked.length > 1 && (
                      <Segmented
                        label="History for"
                        value={historyFw ?? ""}
                        options={pickedFw.map((f, i) => ({ value: picked[i], label: shortName(f.name) }))}
                        onChange={setHistoryFor}
                      />
                    )}
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
                    {!historyFw ? (
                      <p className="m-0 text-sm text-j-muted">Pick at least one framework to bring in its past cycles.</p>
                    ) : w.history === "imported" && historyFw === "fw-qiyas" ? (
                      <>
                        <div role="table" aria-label="Past cycles" className="overflow-hidden rounded-[14px] border border-j-line text-sm">
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
                      <p className="m-0 text-sm text-j-muted">No past cycles for {shortName(admin.frameworks.find((f) => f.id === historyFw)?.live?.name ?? "this framework")} yet. Import a file or pull the published results.</p>
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

                {w.step === LAST && (
                  <div className="flex flex-col gap-4">
                    <h2 className="m-0 text-xl">Review and create</h2>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
                      {[
                        [picked.length, picked.length === 1 ? "framework" : "frameworks"],
                        [people.length, "people"],
                        [TEAM.length, "consultants"],
                        [months, "engagement term"],
                      ].map(([v, l]) => (
                        <div key={l} className="rounded-[14px] bg-j-canvas p-3.5">
                          <b className="text-[22px]">{v}</b>
                          <br />
                          <span className="text-[13px] text-j-muted">{l}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 rounded-[14px] border border-cx-line bg-cx-tint p-3.5 text-sm">
                      <b>{ref.name} goes live as soon as you create it</b>
                      <span className="text-[13px] text-j-ink-3">
                        One engagement per framework: {pickedFw.map((f) => `${shortName(f.name)} v${f.version}`).join(", ") || "none picked"}.{" "}
                        {users ? `${users} stakeholders get an invitation to sign in with their work email and MFA.` : "No stakeholder gets a user account yet."}
                      </span>
                    </div>
                    {(onPlatform(ref.id) || !attestOk || picked.length === 0) && (
                      <p role="alert" className="m-0 flex items-center gap-2 rounded-xl bg-j-warn-soft px-3.5 py-2.5 text-[13px] text-[#8A4B00]">
                        <Icon name="flag" size={14} />
                        {onPlatform(ref.id) ? (
                          `${ref.name} is already on the platform. Pick another entity.`
                        ) : picked.length === 0 ? (
                          <>
                            Pick at least one framework.{" "}
                            <button type="button" onClick={() => go(2)} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-[#8A4B00] underline">
                              Choose frameworks
                            </button>
                          </>
                        ) : (
                          <>
                            {w.attest.filter((x) => !x).length} ECC 4-1 attestations are still open.{" "}
                            <button type="button" onClick={() => go(4)} className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-[#8A4B00] underline">
                              Complete them
                            </button>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-between gap-2 border-t border-j-line-soft pt-4">
                  <JButton onClick={() => go(w.step - 1)} disabled={w.step === 0}>
                    Back
                  </JButton>
                  {w.step < LAST ? (
                    <JButton variant="primary" onClick={() => go(w.step + 1)}>
                      Continue
                    </JButton>
                  ) : (
                    <JButton variant="primary" onClick={create} disabled={onPlatform(ref.id) || !attestOk || picked.length === 0}>
                      <Icon name="check" size={15} strokeWidth={2.6} />
                      Create entity
                    </JButton>
                  )}
                </div>
              </>
            )}
          </Panel>
        </div>
        <p className="m-0 text-xs text-j-muted">
          Progress is saved as you go. <Link href="/portfolio">Back to portfolio</Link>
        </p>
      </JMain>
    </ConsultantShell>
  );
}
