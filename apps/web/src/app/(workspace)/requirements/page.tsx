"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, LanguageLink, Main, PageHeader } from "@/components/workspace-shell";
import { Button, ButtonLink, CompliancePill, GridRow, GridTable, TabBar, WorkTag } from "@/components/ui";
import type { ComplianceKey, WorkKey } from "@/lib/status";

type Row = {
  code: string;
  title: string;
  domain: string;
  weight: string;
  dept: string;
  spoc: string;
  comp: ComplianceKey;
  ai: string;
  work: string;
  w: WorkKey;
  workNote: string;
  acc: string;
  ev: string;
  due: string;
};

const rows: Row[] = [
  { code: "5.11.2-2", title: "Integrated systems demonstrate end-to-end data exchange", domain: "Technology & integration", weight: "High", dept: "IT Operations", spoc: "Faisal K.", comp: "nas", ai: "AI · Non-compliant 0.82", work: "No update", w: "none", workNote: "12 days silent", acc: "Pending L1", ev: "1/4", due: "04 Nov" },
  { code: "3.4.1-1", title: "Published catalogue of digital services", domain: "Digital services", weight: "High", dept: "Digital Transformation", spoc: "Reem S.", comp: "part", ai: "", work: "Update required", w: "update", workNote: "Wrong period", acc: "Accepted", ev: "2/3", due: "03 Nov" },
  { code: "2.2.3-4", title: "Data governance committee meets quarterly", domain: "Data & analytics", weight: "Med", dept: "Strategy & Performance", spoc: "Omar H.", comp: "nas", ai: "AI · Partial 0.64 · low conf.", work: "In progress", w: "prog", workNote: "", acc: "AI only", ev: "2/4", due: "05 Nov" },
  { code: "4.1.2-1", title: "Approved digital capability plan", domain: "Human capital", weight: "High", dept: "Human Capital", spoc: "Lama T.", comp: "non", ai: "", work: "Returned for correction", w: "returned", workNote: "Loop 3", acc: "Returned", ev: "0/2", due: "01 Nov" },
  { code: "6.2.1-3", title: "Beneficiary feedback closes the loop", domain: "Beneficiary experience", weight: "Med", dept: "Customer Experience", spoc: "Hind M.", comp: "part", ai: "AI · Compliant 0.91", work: "Under review", w: "review", workNote: "", acc: "Override pending", ev: "3/3", due: "06 Nov" },
  { code: "3.2.4-1", title: "Service-level KPIs published", domain: "Digital services", weight: "Med", dept: "Digital Transformation", spoc: "Reem S.", comp: "comp", ai: "", work: "Update required", w: "update", workNote: "Compliant in 2025, needs 2026 data", acc: "Reopened", ev: "1/2", due: "08 Nov" },
  { code: "1.1.1-1", title: "Digital transformation strategy approved", domain: "Strategy & governance", weight: "High", dept: "Strategy & Performance", spoc: "Omar H.", comp: "comp", ai: "", work: "Ready for submission", w: "ready", workNote: "", acc: "Accepted", ev: "2/2", due: "—" },
  { code: "1.3.2-2", title: "Digital governance committee charter", domain: "Strategy & governance", weight: "Med", dept: "Legal & Governance", spoc: "Sara N.", comp: "comp", ai: "", work: "Submitted", w: "sub", workNote: "", acc: "Accepted", ev: "1/1", due: "—" },
  { code: "5.3.1-1", title: "Enterprise architecture repository maintained", domain: "Technology & integration", weight: "Med", dept: "IT Operations", spoc: "Faisal K.", comp: "part", ai: "AI · Partial 0.88", work: "Evidence submitted", w: "evsub", workNote: "", acc: "Pending L2", ev: "2/3", due: "07 Nov" },
  { code: "2.1.1-1", title: "Data management policy approved and published", domain: "Data & analytics", weight: "High", dept: "Strategy & Performance", spoc: "Omar H.", comp: "comp", ai: "", work: "DGA observation received", w: "obs", workNote: "OBS-2025-17", acc: "Reopened", ev: "2/2", due: "09 Nov" },
  { code: "5.7.1-2", title: "Shared-services hosting arrangement", domain: "Technology & integration", weight: "Low", dept: "IT Operations", spoc: "Faisal K.", comp: "na", ai: "", work: "Closed", w: "closed", workNote: "N/A approved", acc: "Accepted", ev: "—", due: "—" },
  { code: "4.3.1-1", title: "Digital skills training completion tracked", domain: "Human capital", weight: "Med", dept: "Unassigned", spoc: "Ownership SLA breached", comp: "nas", ai: "", work: "Not started", w: "start", workNote: "", acc: "—", ev: "0/2", due: "10 Nov" },
];

const COLS = "44px 0.8fr 2.6fr 1.4fr 1.3fr 1.3fr 1.1fr 0.6fr 0.6fr";

const VIEWS = [
  { label: "All", count: 350 },
  { label: "At risk", count: 27 },
  { label: "Awaiting acceptance", count: 76 },
  { label: "New or changed vs 2025", count: 41 },
  { label: "Unassigned", count: 5, countTone: "bad" as const },
];

const FILTERS = ["Domain ▾", "Department ▾", "Compliance: any ▾", "Work status ▾", "Acceptance stage ▾", "Evidence health ▾", "Due ▾"];

export default function RequirementsPage() {
  const [view, setView] = useState(0);
  const [sel, setSel] = useState<Record<number, boolean>>({ 0: true, 1: true, 3: true });
  const selCount = Object.values(sel).filter(Boolean).length;

  return (
    <>
      <PageHeader
        crumb="Workspace / Requirements"
        title="Requirements register"
        actions={
          <>
            <Button>Export</Button>
            <LanguageLink />
            <Avatar />
          </>
        }
      />
      <Main wide>
        <TabBar label="Saved views" tabs={VIEWS} active={view} onSelect={setView} className="border-b border-line" />

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex">
            <span className="sr-only">Filter by code or text</span>
            <input
              type="search"
              placeholder="Code or text, Arabic or English"
              className="box-border h-10 w-[260px] max-w-full rounded-lg border border-field bg-white px-3 text-sm"
            />
          </label>
          {FILTERS.map((f) => (
            <Button key={f} variant={f.startsWith("Compliance") ? "chipActive" : "chip"} size="md">
              {f}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-line bg-white px-3.5 py-2.5 text-xs text-ink-2">
          <b>Two independent dimensions</b>
          <span>
            <CompliancePill status="comp" label="Filled pill" className="py-px" /> = compliance status (official once accepted)
          </span>
          <span>
            <WorkTag work="prog">Outlined tag</WorkTag> = work status
          </span>
          <span>
            <span className="font-semibold text-ai">AI · Partial 0.78</span> = recommendation not yet accepted
          </span>
        </div>

        {selCount > 0 && (
          <div
            role="region"
            aria-label="Bulk actions"
            className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-nav py-2 pl-4 pr-2 text-white"
          >
            <span className="text-sm">
              <b>{selCount} selected</b> · actions open as a preview before anything is sent
            </span>
            <div className="flex flex-wrap gap-1.5">
              <ButtonLink href="/actions" variant="dark" size="md">
                Request evidence
              </ButtonLink>
              <ButtonLink href="/actions" variant="dark" size="md">
                Send reminder
              </ButtonLink>
              <Button variant="dark" size="md">
                Assign owner
              </Button>
              <button
                type="button"
                disabled
                title="Bulk approval is disabled for high-risk items by policy"
                className="h-10 rounded-lg border border-dashed border-[#5E7A6F] bg-transparent px-3 text-[13px] text-nav-muted"
              >
                Bulk approve · blocked by policy
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-line bg-white">
          <GridTable
            label="Requirements"
            columns={COLS}
            minWidth={1180}
            headers={[<span key="s" className="sr-only">Select</span>, "Code", "Requirement", "Owner", "Compliance", "Work status", "Acceptance", "Evidence", "Due"]}
            headerClassName="px-3"
          >
            {rows.map((r, i) => (
              <GridRow key={r.code} columns={COLS} className="px-3 py-2" style={{ background: sel[i] ? "#F2F8F5" : "#FFFFFF" }}>
                <span role="cell">
                  <input
                    type="checkbox"
                    checked={!!sel[i]}
                    onChange={() => setSel({ ...sel, [i]: !sel[i] })}
                    aria-label={`Select ${r.code}`}
                    className="m-3 h-5 w-5 accent-brand"
                  />
                </span>
                <span role="cell">
                  <Link href={`/requirements/${r.code}`} className="font-mono font-semibold">
                    {r.code}
                  </Link>
                </span>
                <span role="cell" className="leading-[18px]">
                  {r.title}
                  <br />
                  <span className="text-xs text-muted">
                    {r.domain} · weight {r.weight}
                  </span>
                </span>
                <span role="cell" className="leading-[18px]" style={{ color: r.dept === "Unassigned" ? "#A3261B" : "#14211C" }}>
                  {r.dept}
                  <br />
                  <span className="text-xs text-muted">{r.spoc}</span>
                </span>
                <span role="cell" className="leading-5">
                  <CompliancePill status={r.comp} />
                  <br />
                  <span className="text-xs font-semibold text-ai">{r.ai}</span>
                </span>
                <span role="cell">
                  <WorkTag work={r.w}>{r.work}</WorkTag>
                  <br />
                  <span className="text-[11px] text-muted">{r.workNote}</span>
                </span>
                <span role="cell" className="text-xs text-ink-2">
                  {r.acc}
                </span>
                <span role="cell" className="font-mono text-xs" style={{ color: r.ev.startsWith("0/") ? "#A3261B" : "#14211C" }}>
                  {r.ev}
                </span>
                <span role="cell" className="font-mono text-xs">
                  {r.due}
                </span>
              </GridRow>
            ))}
          </GridTable>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted">
          <span>Showing 1–12 of 350 · sorted by score impact, then due date</span>
          <div className="flex gap-1.5">
            <Button size="md">Previous</Button>
            <Button variant="primary" size="md" aria-current="page" className="min-w-10 px-0 font-normal">
              1
            </Button>
            <Button size="md" className="min-w-10 px-0">
              2
            </Button>
            <Button size="md" className="min-w-10 px-0">
              3
            </Button>
            <Button size="md">Next</Button>
          </div>
        </div>
      </Main>
    </>
  );
}
