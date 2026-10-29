"use client";

import Link from "next/link";
import { useState } from "react";
import { Main, PageHeader } from "@/components/workspace-shell";
import { Button, ButtonLink, Card, CardHeader, GridRow, GridTable, cx } from "@/components/ui";

const indicators = [
  { label: "Open gaps", value: "105", note: "across 6 domains, 7 depts" },
  { label: "DGA observations", value: "18", note: "5 high · 9 medium · 4 low", noteColor: "#33403A" },
  { label: "Past-due actions", value: "23", note: "23 / 141 open", color: "#A3261B", border: "#EBC4BE" },
  { label: "Repeat from 2025", value: "6", note: "same observation recurring", color: "#8A4B00" },
  { label: "Need a project, not a document", value: "4", note: "structural gaps", color: "#3F37A8", border: "#CFCBF2" },
];

type Cell = { n: number; label: string; bg: string; fg?: string; border?: string };

const MATRIX: { row: string; cells: Cell[] }[] = [
  {
    row: "High impact",
    cells: [
      { n: 12, label: "Quick wins", bg: "#E3F1EA", fg: "#11603F", border: "2px solid #2E8B6A" },
      { n: 9, label: "Enablers", bg: "#F3F8F5" },
      { n: 4, label: "Projects", bg: "#EEEDFB", fg: "#3F37A8", border: "2px solid #3F37A8" },
    ],
  },
  {
    row: "Medium",
    cells: [
      { n: 18, label: "Quick wins", bg: "#F3F8F5" },
      { n: 21, label: "Enablers", bg: "#F7F8F6" },
      { n: 7, label: "Projects", bg: "#F5F4FC" },
    ],
  },
  {
    row: "Low impact",
    cells: [
      { n: 14, label: "Housekeeping", bg: "#F7F8F6" },
      { n: 13, label: "Defer", bg: "#F7F8F6" },
      { n: 7, label: "Reconsider", bg: "#F7F8F6", fg: "#56625C" },
    ],
  },
];

const SRC = { dga: ["DGA", "#FBE4E1", "#A3261B"], ai: ["AI gap", "#EEEDFB", "#3F37A8"], int: ["Internal", "#ECEEEC", "#33403A"] } as const;

const gaps: [string, string, keyof typeof SRC, string, string, string, string, string, boolean][] = [
  ["Service catalogue not re-approved for 2026", "Repeat of OBS-2025-12", "dga", "3.4.1-1", "+1.8", "Digital Transformation", "Update requested", "03 Nov", false],
  ["Committee minutes missing for Q2 and Q3", "", "ai", "2.2.3-4", "+1.5", "Strategy & Performance", "Reminder 1 sent", "05 Nov", false],
  ["KPI report covers 2025 period only", "", "ai", "3.2.4-1", "+0.9", "Digital Transformation", "Not started", "31 Oct", true],
  ["Data policy lacks publication evidence", "Repeat of OBS-2025-17", "dga", "2.1.1-1", "+0.8", "Strategy & Performance", "In progress", "09 Nov", false],
  ["Feedback report duplicates prior upload", "", "int", "6.2.1-3", "+0.6", "Customer Experience", "Returned", "06 Nov", false],
];

const GAP_COLS = "2.4fr 0.8fr 1.1fr 0.6fr 1.2fr 1fr 1fr";
const RISKS = ["All", "High", "Medium", "Low"];

export default function RemediationPage() {
  const [risk, setRisk] = useState(0);

  return (
    <>
      <PageHeader
        crumb="Workspace / Remediation"
        title="Gaps, remediation & initiatives"
        actions={
          <>
            <Button>Export corrective-action tracker</Button>
            <Button variant="primary" className="px-4">
              Create initiative
            </Button>
          </>
        }
      />
      <Main wide>
        <section aria-label="Gap indicators" className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          {indicators.map((k) => (
            <div key={k.label} className="rounded-xl border bg-white px-4 py-3.5" style={{ borderColor: k.border ?? "#DCE2DE" }}>
              <div className="text-[13px] text-muted">{k.label}</div>
              <div className="text-[26px] font-bold" style={{ color: k.color }}>
                {k.value}
              </div>
              <div className="text-xs" style={{ color: k.noteColor ?? "#56625C" }}>
                {k.note}
              </div>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap items-start gap-4">
          <Card className="flex min-w-0 flex-[1_1_460px] flex-col gap-3 p-5">
            <CardHeader title="Prioritization: score impact × effort" aside="105 gaps · counts are drillable" />
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">Risk</span>
              {RISKS.map((r, i) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRisk(i)}
                  className={cx(
                    "h-8 cursor-pointer rounded-full border px-2.5 text-xs",
                    risk === i ? "border-brand bg-brand-soft font-semibold text-brand" : "border-field bg-white text-ink",
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-[64px_repeat(3,minmax(0,1fr))] gap-1.5 text-xs">
              <span />
              <span className="text-center text-muted">Low effort</span>
              <span className="text-center text-muted">Medium</span>
              <span className="text-center text-muted">High effort</span>
              {MATRIX.map((m) => (
                <MatrixRow key={m.row} {...m} />
              ))}
            </div>
            <div className="text-xs leading-[18px] text-muted">
              Impact = expected score change from the scoring engine. Effort and risk come from the remediation record; matrix bands are
              configured per framework.
            </div>
          </Card>

          <section className="flex min-w-0 flex-[1_1_400px] flex-col gap-3 rounded-[14px] border border-ai-line bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="m-0 text-base font-semibold">Initiative · Digital skills uplift</h2>
              <span className="rounded-md bg-ai-soft px-2 py-0.5 text-[11px] font-bold text-ai">PROPOSED</span>
            </div>
            <div className="text-[13px] leading-5 text-ink-2">
              Requested evidence keeps failing because the practice does not exist yet. Bundles three gaps into one funded project instead
              of repeated document requests.
            </div>
            <div className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px] leading-5">
              <span className="text-muted">Requirements</span>
              <span>
                <Link href="/requirements/4.1.2-1">4.1.2-1</Link>, <Link href="/requirements/4.3.1-1">4.3.1-1</Link>,{" "}
                <Link href="/requirements/4.3.2-2">4.3.2-2</Link>
              </span>
              <span className="text-muted">Score at stake</span>
              <span>
                <b>+3.8 pts</b> (engine estimate)
              </span>
              <span className="text-muted">Departments</span>
              <span>Human Capital (lead), Digital Transformation</span>
              <span className="text-muted">Sponsor</span>
              <span className="font-semibold text-bad">[Sponsor to be nominated]</span>
              <span className="text-muted">Needs</span>
              <span>Budget approval, procurement of a learning platform</span>
              <span className="text-muted">Done when</span>
              <span>Approved plan, platform live, first-cohort completion report</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/actions" size="md" className="bg-ai font-semibold text-white hover:bg-[#332c8f] hover:text-white">
                Request sponsorship decision
              </ButtonLink>
              <Button size="md">Edit scope</Button>
            </div>
          </section>
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5">
            <h2 className="m-0 text-base font-semibold">Quick wins · high impact, low effort</h2>
            <span className="text-xs text-muted">12 gaps · sorted by impact</span>
          </div>
          <GridTable
            label="Quick-win gaps"
            columns={GAP_COLS}
            minWidth={900}
            headers={["Gap", "Source", "Requirement", "Impact", "Owner", "Action", "Due"]}
            headerClassName="gap-2.5"
          >
            {gaps.map(([gap, repeat, src, req, impact, owner, status, due, late]) => (
              <GridRow key={gap} columns={GAP_COLS} className="gap-2.5">
                <span role="cell" className="leading-[18px]">
                  {gap}
                  <br />
                  <span className="text-xs text-warn">{repeat}</span>
                </span>
                <span role="cell">
                  <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: SRC[src][1], color: SRC[src][2] }}>
                    {SRC[src][0]}
                  </span>
                </span>
                <span role="cell">
                  <Link href={`/requirements/${req}`} className="font-mono text-xs font-semibold">
                    {req}
                  </Link>
                </span>
                <span role="cell" className="font-mono font-semibold text-brand">
                  {impact}
                </span>
                <span role="cell">{owner}</span>
                <span role="cell" className="text-xs">
                  {status}
                </span>
                <span role="cell" className="font-mono text-xs" style={{ color: late ? "#A3261B" : "#14211C" }}>
                  {due}
                </span>
              </GridRow>
            ))}
          </GridTable>
        </Card>
      </Main>
    </>
  );
}

function MatrixRow({ row, cells }: { row: string; cells: Cell[] }) {
  return (
    <>
      <span className="flex items-center text-muted">{row}</span>
      {cells.map((c) => (
        <button
          key={c.label + c.n}
          type="button"
          className="flex min-h-[84px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[10px]"
          style={{ background: c.bg, color: c.fg ?? "#14211C", border: c.border ?? "1px solid #DCE2DE" }}
        >
          <b className="text-[22px]">{c.n}</b>
          {c.label}
        </button>
      ))}
    </>
  );
}
