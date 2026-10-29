"use client";

import { useState } from "react";
import { PageHeader } from "@/components/workspace-shell";
import { Button, ButtonLink, Eyebrow } from "@/components/ui";

const rules: [string, string, string, string, boolean][] = [
  ["REM-01", "Reminder cadence", "Due in 3 days, then every 4 days · max 2", "Live v4", true],
  ["ESC-02", "Escalate silent overdue items", "Daily · recommends, never sends", "Draft v3", false],
  ["EXP-01", "Evidence expiry watch", "Valid-to date within 30 days", "Live v2", true],
  ["OWN-01", "Ownership SLA", "Unassigned after 5 working days", "Live v1", true],
  ["RTE-01", "Route reviews by domain", "Domain → SME pool", "Live v3", true],
  ["CLA-01", "Clarification impact", "On response → flag affected items", "Live v1", true],
];

const conds = [
  { field: "work_status", op: "=", value: "No update" },
  { field: "due_date", op: "<", value: "today" },
  { field: "reminders_sent", op: "≥", value: "2" },
  { field: "priority", op: "in", value: "High, Critical", note: "new in v3" },
];

const hits: [string, string, string, string, string][] = [
  ["ACT-118", "4.1.2-1 Approved digital capability plan", "Human Capital", "19 d", "2"],
  ["ACT-121", "4.3.1-1 Digital skills training tracked", "Human Capital", "14 d", "2"],
  ["ACT-124", "4.2.2-1 Succession plan for digital roles", "Human Capital", "11 d", "3"],
  ["ACT-102", "5.11.2-2 End-to-end integration samples", "IT Operations", "12 d", "2"],
];

const HIT_COLS = "0.8fr 1.6fr 1fr 0.8fr 0.8fr";
const pill = "inline-flex h-9 items-center rounded-md border border-field bg-white px-2.5";

export default function AutomationStudioPage() {
  const [sel, setSel] = useState(1);

  return (
    <>
      <PageHeader
        crumb="Admin Studio / Rules & automation"
        title="Rule & automation studio"
        actions={
          <>
            <Button>New rule</Button>
            <ButtonLink href="/admin/history" variant="primary" className="px-4">
              Submit ESC-02 v3
            </ButtonLink>
          </>
        }
      />
      <main className="box-border flex w-full max-w-[1360px] flex-wrap items-start gap-4 px-8 pb-12 pt-6">
        <section aria-label="Rules" className="min-w-0 flex-[1_1_300px] overflow-hidden rounded-[14px] border border-line bg-white">
          {rules.map(([id, name, meta, status, live], i) => (
            <button
              key={id}
              type="button"
              onClick={() => setSel(i)}
              className="flex w-full cursor-pointer flex-col gap-[3px] border-0 border-b border-l-[3px] border-b-line-soft px-3.5 py-3 text-left text-ink"
              style={{ background: sel === i ? "#F2F8F5" : "#FFFFFF", borderLeftColor: sel === i ? "#0E5A45" : "transparent" }}
            >
              <span className="flex justify-between gap-2">
                <b className="font-mono text-xs">{id}</b>
                <span className="text-[11px] font-semibold" style={{ color: live ? "#11603F" : "#8A4B00" }}>
                  {status}
                </span>
              </span>
              <span className="text-[13px] font-semibold">{name}</span>
              <span className="text-xs text-muted">{meta}</span>
            </button>
          ))}
        </section>

        <section className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">
          <div className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-[17px] font-semibold">ESC-02 · Recommend escalation for silent overdue items</h2>
              <span className="text-xs font-semibold text-warn">v3 draft · v2 live</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <Eyebrow className="font-bold text-muted">WHEN</Eyebrow>
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <select aria-label="Trigger" className="h-11 rounded-lg border border-field bg-white px-2.5 text-sm">
                  <option>Daily schedule</option>
                  <option>Status changed</option>
                  <option>Due date approaching</option>
                  <option>SLA breached</option>
                  <option>Clarification received</option>
                </select>
                <span>at</span>
                <input type="text" defaultValue="07:00" aria-label="Time" className="h-11 w-20 rounded-lg border border-field px-2.5 font-mono text-sm" />
                <span className="text-muted">Asia/Riyadh · working days (Sun–Thu)</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Eyebrow className="font-bold text-muted">IF ALL OF</Eyebrow>
              {conds.map((c) => (
                <div key={c.field} className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-surface-2 p-2 text-[13px]">
                  <span className={`${pill} font-mono text-xs`}>{c.field}</span>
                  <span className="font-mono font-semibold">{c.op}</span>
                  <span className={pill}>{c.value}</span>
                  {c.note && <span className="text-xs font-semibold text-warn">{c.note}</span>}
                </div>
              ))}
              <button type="button" className="h-9 cursor-pointer self-start rounded-lg border border-dashed border-[#7D8C85] bg-white px-2.5 text-xs text-ink-2">
                + Condition
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <Eyebrow className="font-bold text-muted">THEN</Eyebrow>
              <div className="flex flex-col gap-1.5 text-[13px]">
                <div className="rounded-[10px] border border-line px-3 py-2.5">
                  Create <b>escalation recommendation</b> with history pack → assign to <b>Assessment Manager</b>
                </div>
                <div className="rounded-[10px] border border-line px-3 py-2.5">
                  Flag requirement <span className="font-semibold text-bad">red</span> on dashboards
                </div>
                <div className="rounded-[10px] border border-line px-3 py-2.5">In-app alert to department SPOC</div>
                <div className="flex flex-wrap justify-between gap-2 rounded-[10px] bg-nav px-3 py-2.5 text-[#E4ECE8]">
                  <span>
                    <b>Locked:</b> external communication requires authorized approval
                  </span>
                  <span className="text-xs text-[#8FD3B5]">platform guardrail · cannot be turned off</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 rounded-[14px] border-2 border-[#3F6FB5] bg-white px-5 py-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-bold tracking-[0.08em] text-[#2F5893]">TEST AGAINST SAMPLE RECORDS</div>
              <button type="button" className="h-10 cursor-pointer rounded-lg border border-[#3F6FB5] bg-white px-3 text-[13px] font-semibold text-[#2F5893]">
                Run test on today&rsquo;s data
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-[13px]">
              <span className="rounded-lg bg-bad-soft px-2.5 py-1.5 text-bad">
                <b>7</b> would match
              </span>
              <span className="rounded-lg bg-surface-2 px-2.5 py-1.5">
                <b>3</b> near misses (1 reminder)
              </span>
              <span className="rounded-lg bg-surface-2 px-2.5 py-1.5">
                v2 matched <b>5</b>; v3 adds the &ldquo;critical&rdquo; condition
              </span>
            </div>
            <div role="table" aria-label="Test results" className="text-xs">
              <div role="row" className="grid gap-2 border-b border-line py-1.5 font-semibold text-muted" style={{ gridTemplateColumns: HIT_COLS }}>
                {["Action", "Requirement", "Department", "Overdue", "Reminders"].map((h) => (
                  <span role="columnheader" key={h}>
                    {h}
                  </span>
                ))}
              </div>
              {hits.map(([a, r, d, o, n]) => (
                <div role="row" key={a} className="grid gap-2 border-b border-line-soft py-1.5 font-mono" style={{ gridTemplateColumns: HIT_COLS }}>
                  <span role="cell">{a}</span>
                  <span role="cell" className="font-sans">
                    {r}
                  </span>
                  <span role="cell" className="font-sans">
                    {d}
                  </span>
                  <span role="cell">{o}</span>
                  <span role="cell">{n}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
