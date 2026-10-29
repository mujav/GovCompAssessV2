"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, ButtonLink, Card, Eyebrow, TabBar } from "@/components/ui";
import { TONE, type ToneKey } from "@/lib/status";

// Prototype: every code opens the 5.11.2-2 pilot record.

const S = {
  not: { ...TONE.bad, label: "Not satisfied" },
  sat: { ...TONE.ok, label: "Satisfied" },
  part: { ...TONE.warn, label: "Partially satisfied" },
};

const criteria: {
  id: string;
  text: string;
  expect: string;
  fail: string;
  s: keyof typeof S;
  conf: number;
  why: string;
  cites: string[];
  gapHead: string;
  gap: string;
  gapColor: string;
}[] = [
  {
    id: "5.11.2-2-C1",
    text: "A complete sample demonstrates every required integration end to end",
    expect: "source, target, interface, transaction or screenshot per integration",
    fail: "only one partial integration, or no end-to-end sample",
    s: "not",
    conf: 0.86,
    why: "The sample shows the HR ↔ Government Service Bus exchange only. No transaction evidence was found for the other three integrations in the inventory.",
    cites: ["EV-1988 · p.4 §2.1", "EV-1988 · p.6 fig.3"],
    gapHead: "MISSING EVIDENCE",
    gap: "Transaction logs or screenshots for ERP ↔ CRM, ERP ↔ Document Management and CRM ↔ Portal.",
    gapColor: "#A3261B",
  },
  {
    id: "5.11.2-2-C2",
    text: "The integration inventory names source, target and interface for each system",
    expect: "inventory table with all three fields",
    fail: "any listed integration missing a field",
    s: "sat",
    conf: 0.91,
    why: "Table 1 lists four integrations with source, target and interface type; all fields are populated.",
    cites: ["EV-1988 · p.2–3 table 1"],
    gapHead: "NOTHING MISSING",
    gap: "Criterion fully supported by the cited table.",
    gapColor: "#11603F",
  },
  {
    id: "5.11.2-2-C3",
    text: "Evidence is current-cycle and formally approved",
    expect: "dated within the 2026 reporting period, signed approval page",
    fail: "outdated, unsigned or superseded version",
    s: "part",
    conf: 0.74,
    why: "The approval page is signed, but the inventory is dated March 2025. A second document lists five integrations, contradicting the four in the inventory.",
    cites: ["EV-1988 · p.1", "EV-2012 · p.3 ⚠ contradiction"],
    gapHead: "CONTRADICTION FLAGGED",
    gap: "Inventory (4 integrations) and architecture report (5) disagree. Confirm which is current before accepting.",
    gapColor: "#8A4B00",
  },
];

const evidence: { id: string; name: string; state: string; tone: ToneKey }[] = [
  { id: "EV-1988", name: "Integration inventory and sample, v2.pdf", state: "Outdated period", tone: "warn" },
  { id: "EV-2012", name: "Enterprise architecture report 2026.docx", state: "Contradiction", tone: "bad" },
  { id: "EV-1430", name: "GSB integration screenshot (2025)", state: "Superseded", tone: "gray" },
  { id: "EV-1702", name: "Integration policy, approved.pdf", state: "Valid · reused ×3", tone: "ok" },
];

const history = [
  { t: "27 Oct 18:12", e: "AI assessment run MR-88213 completed: 3 criteria, schema valid, 4 citations resolved." },
  { t: "25 Oct 10:03", e: "Reminder 2 sent to Faisal K. (approved by Noura A.)." },
  { t: "18 Oct 09:30", e: "Evidence request ACT-102 created from DGA observation OBS-2025-31." },
  { t: "01 Oct 08:00", e: "Cycle opened; requirement mapped from 2025 5.11.2-2 (unchanged wording)." },
];

const TABS = ["Overview", "Criteria (3)", "Evidence (4)", "Observations & actions (2)", "Clarifications (1)", "History & audit"];

const chain = [
  { title: "AI assessed", meta: "27 Oct, 18:12 · recommendation only", state: "done" },
  { title: "L1 · Domain SME", meta: "Dr. Khalid R. · due 02 Nov · pending", state: "current" },
  { title: "L2 · Assessment Manager", meta: "Noura A.", state: "todo" },
  { title: "Final acceptance", meta: "Compliance Lead", state: "todo" },
];

function SideCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`flex flex-col gap-2.5 p-[18px] ${className ?? ""}`}>
      <h2 className="m-0 text-[15px] font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

export default function RequirementDetailPage() {
  const [tab, setTab] = useState(1);

  return (
    <>
      <header className="flex flex-col gap-3 border-b border-line bg-white px-8 pt-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-1.5">
            <div className="text-[13px] text-muted">
              <Link href="/requirements">Requirements</Link> / Technology &amp; integration / 5.11.2
            </div>
            <h1 className="m-0 text-2xl leading-8 font-bold">
              <span className="font-mono">5.11.2-2</span> · Integrated systems demonstrate end-to-end data exchange
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-neutral-soft px-2 py-0.5 font-semibold text-neutral-fg">Not assessed (official)</span>
              <span className="rounded-full bg-ai-soft px-2 py-0.5 font-semibold text-ai">AI · Non-compliant · 0.82</span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-field px-2 py-px text-ink-2">
                <span className="h-1.5 w-1.5 rounded-full bg-bad" />
                No update · 12 days
              </span>
              <span className="rounded-md border border-field px-2 py-px text-ink-2">Pending Review L1</span>
              <span className="text-muted">
                Weight high · score impact <b className="text-ink">+2.4 pts</b> · due 04 Nov
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/clarifications">Request clarification</ButtonLink>
            <ButtonLink href="/actions" variant="outlineBrand">
              Request evidence
            </ButtonLink>
            <ButtonLink href="/reviews" variant="primary">
              Open in review
            </ButtonLink>
          </div>
        </div>
        <TabBar label="Requirement sections" tabs={TABS.map((label) => ({ label }))} active={tab} onSelect={setTab} />
      </header>

      <main className="box-border flex w-full max-w-[1360px] flex-wrap items-start gap-5 px-8 pb-12 pt-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-base font-semibold">Official requirement</h2>
              <span className="text-xs text-muted">
                Qiyas 2026 · framework version 1.2 · published, immutable · <a href="#">source p. 87</a>
              </span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
              <div className="text-sm leading-[22px]">
                <Eyebrow className="mb-1 text-muted">ENGLISH</Eyebrow>
                The entity demonstrates that its core systems are integrated and exchange data end to end, supported by a complete
                implementation sample for each required integration.
              </div>
              <div lang="ar" dir="rtl" className="text-[15px] leading-[26px]">
                <div className="mb-1 text-[11px] font-semibold text-muted">العربية</div>
                تُثبت الجهة تكامل أنظمتها الأساسية وتبادل البيانات بينها بشكل متكامل، مع تقديم نموذج تطبيقي كامل لكل تكامل مطلوب.
              </div>
            </div>
            <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] leading-5 text-ink-2">
              <b>Implementation requirement:</b> provide the integration inventory and at least one end-to-end sample (source, target,
              interface and transaction) per listed integration, from the current cycle.
            </div>
          </Card>

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-lg font-semibold">Criteria assessment</h2>
              <span className="text-xs text-muted">3 criteria · SME-approved decomposition v1 · AI run MR-88213 · prompt assess-v1.4</span>
            </div>
            {criteria.map((c) => (
              <article key={c.id} className="overflow-hidden rounded-[14px] border border-line bg-white">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
                  <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1">
                    <div className="text-xs text-muted">
                      <span className="font-mono font-semibold text-ink">{c.id}</span> · Mandatory
                    </div>
                    <div className="text-[15px] leading-[22px] font-semibold">{c.text}</div>
                    <div className="text-xs leading-[18px] text-muted">
                      Expected: {c.expect} · Fails if: {c.fail}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="rounded-full px-2.5 py-[3px] text-xs font-bold" style={{ background: S[c.s].bg, color: S[c.s].fg }}>
                      AI · {S[c.s].label}
                    </span>
                    <span className="flex items-center gap-2 text-xs text-ink-2">
                      confidence
                      <span className="block h-1.5 w-20 overflow-hidden rounded-[3px] bg-line-soft">
                        <span className="block h-1.5 bg-ai" style={{ width: `${Math.round(c.conf * 100)}%` }} />
                      </span>
                      <b className="font-mono">{c.conf.toFixed(2)}</b>
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
                  <div className="flex flex-col gap-2 border-r border-line-soft px-5 py-3.5">
                    <Eyebrow color="#3F37A8">AI RATIONALE</Eyebrow>
                    <div className="text-[13px] leading-5">{c.why}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.cites.map((q) => (
                        <Link key={q} href="/evidence" className="rounded-md bg-ai-tint px-2 py-[3px] font-mono text-xs text-ai no-underline">
                          {q}
                        </Link>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 px-5 py-3.5">
                    <Eyebrow color={c.gapColor}>{c.gapHead}</Eyebrow>
                    <div className="text-[13px] leading-5">{c.gap}</div>
                    <div className="text-xs text-muted">
                      Human decision: <b className="text-ink">awaiting L1</b>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section className="flex flex-col gap-2 rounded-[14px] border border-dashed border-[#7D8C85] bg-[#F1F4F2] px-5 py-[18px]">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="m-0 text-[15px] font-semibold">Deterministic roll-up preview</h2>
              <span className="font-mono text-xs text-[#44524B]">scoring scheme QY-2026 v3 · rule SR-03</span>
            </div>
            <div className="text-[13px] leading-5 text-ink-2">
              If accepted as recommended: mandatory criterion C1 not satisfied → <b>blocking rule caps the requirement at Non-compliant</b>.
              Requirement score 0 / 1.5 → Technology &amp; integration domain 61.3% → 58.9%. Calculated by the rule engine, never by AI;
              not reportable until accepted.
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-4">
          <SideCard title="Acceptance chain">
            <div className="text-xs text-muted">Policy AP-QIYAS-STD v2 · sequential</div>
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0 text-[13px] leading-[18px]">
              {chain.map((s) => (
                <li key={s.title} className="flex items-start gap-2.5">
                  {s.state === "done" ? (
                    <span className="flex h-[22px] flex-[0_0_22px] items-center justify-center rounded-full bg-ai text-xs text-white">✓</span>
                  ) : (
                    <span
                      className="h-5 flex-[0_0_22px] rounded-full border-2"
                      style={s.state === "current" ? { borderColor: "#0E5A45", background: "#E2EFE9" } : { borderColor: "#CBD3CE" }}
                    />
                  )}
                  <span>
                    <b>{s.title}</b>
                    <br />
                    <span className="text-muted">{s.meta}</span>
                  </span>
                </li>
              ))}
            </ol>
          </SideCard>

          <SideCard title="Ownership" className="text-[13px] leading-5">
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-1">
              <span className="text-muted">Department</span>
              <span>IT Operations</span>
              <span className="text-muted">SPOC</span>
              <span>Faisal K.</span>
              <span className="text-muted">Contributing</span>
              <span>Digital Transformation</span>
              <span className="text-muted">Reviewer</span>
              <span>Dr. Khalid R. (SME)</span>
              <span className="text-muted">Evidence SLA</span>
              <span className="font-semibold text-bad">Breached 2 days ago</span>
            </div>
          </SideCard>

          <SideCard title="Linked evidence">
            {evidence.map((e) => (
              <Link
                key={e.id}
                href="/evidence"
                className="flex items-start justify-between gap-2 border-t border-line-soft py-2 text-[13px] leading-[18px] text-ink no-underline hover:text-ink"
              >
                <span>
                  <span className="font-mono text-xs text-muted">{e.id}</span>
                  <br />
                  {e.name}
                </span>
                <Badge tone={e.tone} className="flex-none">
                  {e.state}
                </Badge>
              </Link>
            ))}
          </SideCard>

          <SideCard title="Prior cycle · 2025" className="text-[13px] leading-5">
            <div>
              <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn">Partial</span>{" "}
              <span className="text-muted">score 0.75 / 1.5</span>
            </div>
            <blockquote className="m-0 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2">
              &ldquo;The sample covers one integration only. Provide end-to-end evidence for all integrations listed in the inventory.&rdquo;
              <br />
              <span className="text-xs text-muted">DGA observation OBS-2025-31, received verbatim</span>
            </blockquote>
          </SideCard>

          <SideCard title="History">
            {history.map((h) => (
              <div key={h.t} className="border-l-2 border-line pl-2.5 text-xs leading-[18px]">
                <span className="font-mono text-muted">{h.t}</span>
                <br />
                {h.e}
              </div>
            ))}
            <Link href="/admin/history" className="text-[13px]">
              Full audit trail
            </Link>
          </SideCard>
        </aside>
      </main>
    </>
  );
}
