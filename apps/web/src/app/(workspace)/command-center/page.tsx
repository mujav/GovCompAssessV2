import Link from "next/link";
import { Avatar, LanguageLink, Main, PageHeader } from "@/components/workspace-shell";
import { AiTag, Button, ButtonLink, Card, CardHeader, CompliancePill, GridRow, GridTable, Meter, StackedBar, WorkTag } from "@/components/ui";
import { ragColor, type ComplianceKey, type WorkKey } from "@/lib/status";

const SEV = { high: ["#FBE4E1", "#A3261B"], med: ["#FBEFD9", "#8A4B00"], info: ["#EEEDFB", "#3F37A8"] } as const;

const insights: { sev: keyof typeof SEV; insight: string; why: string; src: string; secondary: string; action: string }[] = [
  { sev: "high", insight: "Three high-impact requirements have no evidence and are due within 7 days.", why: "Each carries ≥ 1.5 pts of score impact; owners have not uploaded since the cycle opened.", src: "5.11.2-2 · 3.4.1-1 · 2.2.3-4", secondary: "View requirements", action: "Draft evidence requests" },
  { sev: "high", insight: "Seven remediation actions are overdue for Human Capital.", why: "Average 12 days overdue; each has had 2 reminders, so the escalation rule now applies.", src: "ACT-118, ACT-121 +5 · rule ESC-02", secondary: "View actions", action: "Prepare escalation" },
  { sev: "med", insight: "Four newly received evidence files failed validation.", why: "Two cover the wrong reporting period, one lacks an approval signature, one is an unreadable scan.", src: "EV-2041, EV-2044, EV-2047, EV-2050", secondary: "Open files", action: "Return for correction" },
  { sev: "info", insight: "DGA clarification CL-014 affects 6 requirements, 4 already accepted.", why: "The response requires a current-cycle implementation sample, so the accepted items need re-review.", src: "CL-014 · 5.11.1-1, 5.11.2-2 +4", secondary: "Read clarification", action: "Flag for re-review" },
  { sev: "med", insight: "Projected readiness fell 2.1 points this week.", why: "Nine new implementation gaps outweighed five completed evidence items.", src: "snapshot 2026-W43 vs W42", secondary: "See drivers", action: "Plan remediation" },
];

const kpis = [
  { label: "Overall readiness", value: "72.4%", ratio: "target 85% · 2025: 65.6%", note: "−2.1 pts this week", noteColor: "#A3261B" },
  { label: "Accepted compliant", value: "186", ratio: "186 / 338 applicable", note: "55.0% of applicable", noteColor: "#33403A" },
  { label: "Evidence readiness", value: "71%", ratio: "612 / 862 expected", note: "38 invalid or outdated", noteColor: "#8A4B00" },
  { label: "Overdue actions", value: "23", ratio: "23 / 141 open", note: "7 in one department", noteColor: "#A3261B" },
  { label: "Critical blockers", value: "8", ratio: "8 score-impacting", note: "3 due ≤ 7 days", noteColor: "#A3261B" },
  { label: "Unassigned", value: "5", ratio: "5 / 350 requirements", note: "SLA breached on 2", noteColor: "#8A4B00" },
];

const statusMix: { key: ComplianceKey; label: string; n: number; color: string }[] = [
  { key: "comp", label: "Compliant", n: 186, color: "#2E8B6A" },
  { key: "part", label: "Partial", n: 74, color: "#D08A1C" },
  { key: "non", label: "Non-compl.", n: 31, color: "#C4412F" },
  { key: "nas", label: "Not assessed", n: 47, color: "#B9C2BD" },
  { key: "na", label: "N/A", n: 12, color: "#8796B0" },
];

const pipeline = [
  { label: "AI only", n: 13, bg: "#EEEDFB", fg: "#3F37A8" },
  { label: "Pending L1", n: 38, bg: "#F1F4F2", fg: "#33403A" },
  { label: "Pending L2", n: 19, bg: "#F1F4F2", fg: "#33403A" },
  { label: "Override", n: 6, bg: "#FBEFD9", fg: "#8A4B00" },
  { label: "Accepted", n: 215, bg: "#E3F1EA", fg: "#11603F" },
];

const domains: [string, number, number, number][] = [
  ["Strategy & governance", 81, 42, 52],
  ["Digital services", 68, 47, 69],
  ["Technology & integration", 61, 38, 62],
  ["Human capital", 58, 25, 43],
  ["Data & analytics", 74, 39, 53],
  ["Beneficiary experience", 88, 52, 59],
];

const opps = [
  { impact: "+2.4", code: "5.11.2", title: "System integrations", need: "End-to-end transaction sample", effort: "medium" },
  { impact: "+1.8", code: "3.4.1", title: "Digital services catalogue", need: "Approved 2026 version", effort: "low" },
  { impact: "+1.5", code: "2.2.3", title: "Data governance committee", need: "Current-cycle minutes", effort: "low" },
  { impact: "+1.1", code: "4.1.2", title: "Digital skills plan", need: "Structural: needs a project", effort: "high" },
];

const risks: { code: string; title: string; owner: string; comp: ComplianceKey; work: string; w: WorkKey; due: string; next: string }[] = [
  { code: "5.11.2-2", title: "Integrated systems demonstrate end-to-end exchange", owner: "IT Operations", comp: "non", work: "No update", w: "none", due: "04 Nov", next: "Request evidence" },
  { code: "3.4.1-1", title: "Published catalogue of digital services", owner: "Digital Transformation", comp: "part", work: "Update required", w: "update", due: "03 Nov", next: "Request update" },
  { code: "2.2.3-4", title: "Data governance committee meets quarterly", owner: "Strategy & Performance", comp: "nas", work: "In progress", w: "prog", due: "05 Nov", next: "Send reminder" },
  { code: "4.1.2-1", title: "Approved digital capability plan", owner: "Human Capital", comp: "non", work: "Returned", w: "returned", due: "01 Nov", next: "Escalate" },
  { code: "6.2.1-3", title: "Beneficiary feedback closes the loop", owner: "Customer Experience", comp: "part", work: "Under review", w: "review", due: "06 Nov", next: "Review now" },
];

const RISK_COLS = "2.4fr 1.2fr 1fr 1.1fr 0.6fr 1fr";

export default function CommandCenterPage() {
  return (
    <>
      <PageHeader
        crumb="Workspace / Command Center"
        title="Command Center"
        actions={
          <>
            <label className="flex">
              <span className="sr-only">Search</span>
              <input
                type="search"
                placeholder="Search requirements, evidence, actions"
                className="box-border h-11 w-[300px] max-w-full rounded-lg border border-field bg-surface-2 px-3 text-sm"
              />
            </label>
            <LanguageLink />
            <button
              type="button"
              aria-label="Notifications, 6 unread"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-field bg-white text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </button>
            <Avatar />
          </>
        }
      />
      <Main className="gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="chip" size="sm">
              <b>View</b> · Executive ▾
            </Button>
            {["Domain: All ▾", "Department: All ▾", "Owner: All ▾", "Due: Any ▾"].map((f) => (
              <Button key={f} variant="chip" size="sm">
                {f}
              </Button>
            ))}
            <span className="text-[13px] text-muted">
              Submission deadline in <b className="text-ink">23 days</b>
            </span>
          </div>
          <div className="flex gap-2">
            <Button className="font-medium">Save view</Button>
            <Button variant="primary">Generate executive update</Button>
          </div>
        </div>

        {/* AI briefing: insight → why → action */}
        <section aria-labelledby="brief-h" className="overflow-hidden rounded-[14px] border border-ai-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DEDBF7] bg-ai-tint px-5 py-4">
            <div className="flex items-center gap-2.5">
              <AiTag />
              <h2 id="brief-h" className="m-0 text-[17px] leading-6 font-semibold">
                Five things need attention today
              </h2>
            </div>
            <div className="text-[13px] text-[#4A4F6B]">
              Generated 09:40 from accepted and in-flight records · prompt v1.4 · <Link href="/flows/evidence-ai">How this was built</Link>
            </div>
          </div>
          {insights.map((it, i) => (
            <div key={i} className="flex flex-wrap items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
              <div className="flex min-w-0 flex-[1_1_520px] gap-3.5">
                <span
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-bold"
                  style={{ background: SEV[it.sev][0], color: SEV[it.sev][1] }}
                >
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="text-[15px] leading-[22px] font-semibold">{it.insight}</div>
                  <div className="text-[13px] leading-5 text-muted">
                    <b className="text-ink-2">Why:</b> {it.why}
                  </div>
                  <div className="font-mono text-xs text-muted">Sources: {it.src}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="md">{it.secondary}</Button>
                <ButtonLink href="/actions" variant="primary" size="md">
                  {it.action}
                </ButtonLink>
              </div>
            </div>
          ))}
          <div className="bg-[#FAFAFE] px-5 py-3 text-xs leading-[18px] text-muted">
            AI summarizes, prioritizes and drafts. It cannot approve compliance, change an official score, send an escalation or
            submit to a regulator. Every action above opens as a draft for an authorized user.
          </div>
        </section>

        <section aria-label="Key indicators" className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          {kpis.map((k) => (
            <Link
              key={k.label}
              href="/requirements"
              className="flex flex-col gap-1.5 rounded-xl border border-line bg-white p-4 text-ink no-underline hover:border-field hover:text-ink"
            >
              <span className="text-[13px] text-muted">{k.label}</span>
              <span className="text-[28px] leading-[34px] font-bold tracking-[-0.01em]">{k.value}</span>
              <span className="font-mono text-xs text-ink-2">{k.ratio}</span>
              <span className="text-xs font-semibold" style={{ color: k.noteColor }}>
                {k.note}
              </span>
            </Link>
          ))}
        </section>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-4">
          <Card className="flex flex-col gap-3.5 p-5">
            <CardHeader title="Compliance status" aside="350 requirements · official = accepted only" />
            <StackedBar
              height={28}
              radius={6}
              label="186 compliant, 74 partial, 31 non-compliant, 47 not assessed, 12 not applicable"
              parts={statusMix.map((s) => ({ value: s.n, color: s.color }))}
            />
            <div className="grid grid-cols-5 gap-2 text-xs leading-4">
              {statusMix.map((s) => (
                <div key={s.key}>
                  <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: s.color }} /> {s.label}
                  <br />
                  <b className="text-base">{s.n}</b>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2.5 border-t border-line-soft pt-3.5">
              <div className="flex justify-between text-[13px]">
                <b>Human acceptance pipeline</b>
                <span className="text-muted">291 assessed</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-xs leading-4">
                {pipeline.map((p) => (
                  <Link key={p.label} href="/reviews" className="rounded-lg p-2 no-underline" style={{ background: p.bg, color: p.fg }}>
                    {p.label}
                    <br />
                    <b className="text-base">{p.n}</b>
                  </Link>
                ))}
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <CardHeader title="Readiness trend" aside="Weighted score, % · week of cycle" />
            <div className="flex flex-wrap gap-4 text-xs text-ink-2">
              <span>
                <span className="inline-block h-[3px] w-3.5 bg-brand align-middle" /> 2026 Cycle 1
              </span>
              <span>
                <span className="inline-block w-3.5 border-t-2 border-dashed border-[#8796B0] align-middle" /> 2025 Cycle 1
              </span>
              <span>
                <span className="inline-block w-3.5 border-t-2 border-dotted border-orange align-middle" /> Target 85%
              </span>
            </div>
            <div className="relative h-[200px]">
              <svg
                width="100%"
                height="180"
                viewBox="0 0 600 180"
                preserveAspectRatio="none"
                role="img"
                aria-label="Readiness rose from 58% to 72.4% over eight weeks, ahead of last cycle's 65.6%, below the 85% target"
                className="block"
              >
                <line x1="0" y1="18" x2="600" y2="18" stroke="#B4580A" strokeWidth="2" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
                <line x1="0" y1="90" x2="600" y2="90" stroke="#EEF0EE" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <line x1="0" y1="144" x2="600" y2="144" stroke="#EEF0EE" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                <polyline
                  points="0,136.8 85.7,129.6 171.4,126 257.1,118.8 342.9,111.6 428.6,104.4 514.3,97.2 600,87.8"
                  fill="none"
                  stroke="#8796B0"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  vectorEffect="non-scaling-stroke"
                />
                <polyline
                  points="0,115.2 85.7,108 171.4,97.2 257.1,90 342.9,79.2 428.6,68.4 514.3,55.8 600,63.4"
                  fill="none"
                  stroke="#0E5A45"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <div className="flex justify-between font-mono text-[11px] text-muted">
                {["W1", "W2", "W3", "W4", "W5", "W6", "W7", "W8"].map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
            </div>
            <div className="text-[13px] leading-5 text-ink-2">
              <b>72.4%</b> now, down 2.1 pts this week: 9 new implementation gaps outweighed 5 completed evidence items.{" "}
              <Link href="/remediation">See drivers</Link>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-4">
          <Card className="flex flex-col gap-3.5 p-5">
            <CardHeader title="Readiness by domain" aside="Green ≥ 85 · amber 60–84.99 · red < 60" />
            {domains.map(([name, pct, num, den]) => (
              <Link
                key={name}
                href="/requirements"
                className="grid min-h-7 grid-cols-[minmax(0,190px)_minmax(0,1fr)_96px] items-center gap-3 text-[13px] text-ink no-underline hover:text-ink"
              >
                <span>{name}</span>
                <Meter pct={pct} color={ragColor(pct)} />
                <span className="text-right font-mono text-xs">
                  <b>{pct}%</b> · {num}/{den}
                </span>
              </Link>
            ))}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <CardHeader title="Top score-impacting opportunities" aside={<Link href="/remediation" className="text-[13px]">Open matrix</Link>} />
            {opps.map((o) => (
              <div key={o.code} className="flex items-center gap-3 border-t border-line-soft py-2.5">
                <span className="flex-[0_0_64px] font-mono text-sm font-semibold text-brand">{o.impact}</span>
                <div className="min-w-0 flex-auto text-[13px] leading-[19px]">
                  <b>{o.code}</b> {o.title}
                  <br />
                  <span className="text-muted">
                    {o.need} · effort {o.effort}
                  </span>
                </div>
                <Button size="md" className="flex-none">
                  Assign
                </Button>
              </div>
            ))}
          </Card>
        </div>

        <Card className="flex flex-col gap-3 p-5">
          <CardHeader title="At risk before the deadline" aside={<Link href="/requirements" className="text-[13px]">All 27 at-risk requirements</Link>} />
          <GridTable
            label="At-risk requirements"
            columns={RISK_COLS}
            minWidth={860}
            headers={["Requirement", "Owner", "Compliance", "Work status", "Due", "Next action"]}
            headerClassName="bg-transparent px-2 py-2"
          >
            {risks.map((r) => (
              <GridRow key={r.code} columns={RISK_COLS} className="px-2">
                <span role="cell">
                  <Link href={`/requirements/${r.code}`} className="font-mono font-semibold">
                    {r.code}
                  </Link>
                  <br />
                  <span className="text-ink-2">{r.title}</span>
                </span>
                <span role="cell">{r.owner}</span>
                <span role="cell">
                  <CompliancePill status={r.comp} />
                </span>
                <span role="cell">
                  <WorkTag work={r.w}>{r.work}</WorkTag>
                </span>
                <span role="cell" className="font-mono text-xs">
                  {r.due}
                </span>
                <span role="cell">
                  <Link href="/actions" className="font-semibold">
                    {r.next}
                  </Link>
                </span>
              </GridRow>
            ))}
          </GridTable>
          <div className="text-xs text-muted">
            Metrics calculated 28 Oct 2026, 09:40 · metric definitions v3 · filters: Qiyas 2026, Cycle 1, all domains. Every value
            opens its numerator, denominator and source records.
          </div>
        </Card>
      </Main>
    </>
  );
}
