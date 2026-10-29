"use client";

import { useState } from "react";
import { PageHeader } from "@/components/workspace-shell";
import { Button, ButtonLink } from "@/components/ui";

const S = { pub: ["PUBLISHED", "#E3F1EA", "#11603F"], draft: ["DRAFT", "#FBEFD9", "#8A4B00"] } as const;

const policies: [string, keyof typeof S, string, string][] = [
  ["AP-QIYAS-STD v2", "pub", "Standard entity", "Qiyas 2026 · default"],
  ["AP-QIYAS-CRIT v2", "draft", "Critical requirements", "Qiyas 2026 · risk = critical"],
  ["AP-LOW-SAMPLED v1", "pub", "Low risk, 10% sampled QA", "Qiyas 2026 · risk = low"],
  ["AP-NCA-SEQ v1", "pub", "Two sequential reviewers", "NCA ECC 2024 · default"],
];

const stages = [
  { n: 1, mode: "Parallel", name: "Two domain SMEs", who: "Pool: Qiyas SMEs", min: "2 of 2", reject: "Return to evidence owner", indep: "Not owner or submitter", rights: ["Approve", "Override", "Return", "Clarify"], border: "#0E5A45" },
  { n: 2, mode: "Single", name: "Control owner", who: "Role: control owner", min: "1", reject: "Back to stage 1", indep: "Not a stage 1 reviewer", rights: ["Approve", "Reject", "Escalate"], border: "#0E5A45" },
  { n: 3, mode: "Final", name: "Compliance Lead", who: "Named: Huda S.", min: "1", reject: "Rejected Final", indep: "Not stages 1–2", rights: ["Accept", "Reject final", "Return"], border: "#0A3F31" },
];

const simulation: [string, string, string?][] = [
  ["AI Assessed → routed to stage 1 (critical band)", "#EEEDFB", "#3F37A8"],
  ["Stage 1: SME A approves · SME B overrides to Partial", "#F7F8F6"],
  ["Override is material → Override Pending Approval", "#FBEFD9", "#6B3F05"],
  ["Stage 2: Control owner approves override", "#F7F8F6"],
  ["Stage 3: Compliance Lead → Accepted (Partial)", "#E3F1EA", "#11603F"],
];

function Check({ label, checked }: { label: string; checked?: boolean }) {
  return (
    <label className="flex min-h-8 items-center gap-2">
      <input type="checkbox" defaultChecked={checked} className="h-[18px] w-[18px] accent-brand" />
      {label}
    </label>
  );
}

export default function AcceptanceDesignerPage() {
  const [sel, setSel] = useState(1);

  return (
    <>
      <PageHeader
        crumb="Admin Studio / Acceptance policies"
        title="Acceptance workflow designer"
        actions={
          <>
            <Button>New policy</Button>
            <ButtonLink href="/admin/history" variant="primary" className="px-4">
              Submit for approval
            </ButtonLink>
          </>
        }
      />
      <main className="box-border flex w-full max-w-[1360px] flex-col gap-4 px-8 pb-12 pt-6">
        <section aria-label="Policies" className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-2.5">
          {policies.map(([id, s, name, scope], i) => (
            <button
              key={id}
              type="button"
              onClick={() => setSel(i)}
              className="flex cursor-pointer flex-col gap-1 rounded-xl bg-white px-3.5 py-3 text-left text-ink"
              style={{ border: sel === i ? "2px solid #0E5A45" : "1px solid #DCE2DE" }}
            >
              <span className="flex justify-between gap-2">
                <b className="font-mono text-[13px]">{id}</b>
                <span className="rounded px-1.5 py-px text-[11px] font-bold" style={{ background: S[s][1], color: S[s][2] }}>
                  {S[s][0]}
                </span>
              </span>
              <span className="text-[13px] font-semibold">{name}</span>
              <span className="text-xs text-muted">{scope}</span>
            </button>
          ))}
        </section>

        <div className="flex flex-wrap items-start gap-4">
          <section className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5 rounded-[14px] border border-line bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-[17px] font-semibold">AP-QIYAS-CRIT · v2 draft</h2>
              <span className="text-xs text-muted">Scope: Qiyas 2026 · risk band = critical · 23 requirements</span>
            </div>

            <div className="flex flex-wrap items-stretch gap-2">
              <div className="flex flex-none items-center rounded-[10px] bg-ai-soft px-3.5 py-2.5 text-[13px] font-semibold text-ai">
                AI assessment
                <br />
                recommendation only
              </div>
              {stages.map((s) => (
                <div key={s.n} className="flex min-w-0 flex-[1_1_200px] flex-col gap-2 rounded-xl border-2 bg-white p-3.5" style={{ borderColor: s.border }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold tracking-[0.08em] text-brand">STAGE {s.n}</span>
                    <span className="rounded border border-field px-1.5 py-px text-[11px] text-ink-2">{s.mode}</span>
                  </div>
                  <b className="text-sm leading-5">{s.name}</b>
                  <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-x-2 gap-y-[3px] text-xs leading-[17px]">
                    <span className="text-muted">Reviewers</span>
                    <span>{s.who}</span>
                    <span className="text-muted">Approvals</span>
                    <span>{s.min}</span>
                    <span className="text-muted">On reject</span>
                    <span>{s.reject}</span>
                    <span className="text-muted">SLA</span>
                    <span>3 working days</span>
                    <span className="text-muted">Independent</span>
                    <span>{s.indep}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {s.rights.map((r) => (
                      <span key={r} className="rounded bg-[#F1F4F2] px-1.5 py-0.5 text-[11px] text-ink-2">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <button type="button" className="min-w-[120px] flex-none cursor-pointer rounded-xl border border-dashed border-[#7D8C85] bg-white text-[13px] text-ink-2">
                + Add stage
              </button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 text-[13px]">
              <fieldset className="m-0 flex flex-col gap-1.5 rounded-[10px] border border-line p-3">
                <legend className="px-1 font-semibold">Override governance</legend>
                <Check label="Rationale and reason code required" checked />
                <Check label="Material override adds senior approval" checked />
                <Check label="Allow bulk approval (off for critical)" />
              </fieldset>
              <fieldset className="m-0 flex flex-col gap-1.5 rounded-[10px] border border-line p-3">
                <legend className="px-1 font-semibold">Reopen when</legend>
                <Check label="New or replaced evidence" checked />
                <Check label="Authority clarification applied" checked />
                <Check label="Material configuration change" checked />
              </fieldset>
              <fieldset className="m-0 flex flex-col gap-1.5 rounded-[10px] border border-line p-3">
                <legend className="px-1 font-semibold">Finalization</legend>
                <div className="leading-5">
                  Result becomes official, scored and submittable when <b>stage 3 approves</b> and no blocking rejection exists.
                </div>
                <div className="leading-5 text-muted">Delegation allowed for absence; delegate identity is recorded.</div>
              </fieldset>
            </div>
          </section>

          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 rounded-[14px] border-2 border-[#3F6FB5] bg-white p-[18px]">
            <div className="text-[11px] font-bold tracking-[0.08em] text-[#2F5893]">SIMULATE</div>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Sample record
              <select className="h-11 rounded-lg border border-field bg-white px-2.5 text-sm font-normal">
                <option>5.11.2-2 · AI Non-compliant · reviewer overrides to Partial</option>
                <option>1.1.1-1 · AI Compliant · no override</option>
              </select>
            </label>
            <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-[19px]">
              {simulation.map(([text, bg, fg]) => (
                <li key={text} className="rounded-lg px-2.5 py-2" style={{ background: bg, color: fg }}>
                  {text}
                </li>
              ))}
            </ol>
            <div className="text-xs leading-[18px] text-muted">
              Checks passed: no person fills two stages · AI never satisfies a human stage · SLA chain totals 9 working days.
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
