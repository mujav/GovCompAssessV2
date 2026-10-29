"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/workspace-shell";
import { Card, Eyebrow, cx } from "@/components/ui";

const QUEUES: [string, number][] = [
  ["Assigned to me", 14],
  ["Due soon", 5],
  ["Overdue", 2],
  ["Returned", 3],
  ["Overrides awaiting approval", 4],
  ["Final acceptance pending", 6],
];

const items = [
  { code: "5.11.2-2 · C1", title: "End-to-end integration samples", meta: "AI: Not satisfied 0.86 · due 02 Nov" },
  { code: "5.11.2-2 · C3", title: "Current-cycle, approved evidence", meta: "AI: Partial 0.74 · contradiction" },
  { code: "2.2.3-4 · C2", title: "Quarterly committee minutes", meta: "AI: Partial 0.64 · low confidence" },
  { code: "5.3.1-1 · C1", title: "Architecture repository current", meta: "AI: Satisfied 0.92 · due 07 Nov" },
  { code: "6.2.1-3 · C2", title: "Feedback actions closed", meta: "Returned once · due 06 Nov" },
];

const OPTIONS = [
  "Accept AI recommendation",
  "Override the recommendation",
  "Return for evidence",
  "Request clarification",
  "Escalate to senior reviewer",
];
const SUBMIT = ["Accept and send to L2", "Submit override for L2 approval", "Return to evidence owner", "Create clarification draft", "Escalate"];

const selectCls = "h-11 rounded-lg border border-field bg-white px-2.5 text-sm font-normal";

export default function ReviewWorkspacePage() {
  const [q, setQ] = useState(0);
  const [item, setItem] = useState(0);
  const [d, setD] = useState(1);

  return (
    <>
      <PageHeader crumb="Workspace / Reviews / Assigned to me" title="Reviewer workspace">
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
          <span>
            Reviewing as <b className="text-ink">Dr. Khalid R.</b> · Domain SME · Level 1
          </span>
          <span className="rounded-full bg-good-soft px-2.5 py-1 font-semibold text-good">Independence rule satisfied</span>
        </div>
      </PageHeader>

      <main className="box-border flex w-full flex-wrap items-start gap-4 px-6 pb-12 pt-5">
        <aside aria-label="Review queues" className="flex min-w-0 max-w-full flex-[1_1_240px] flex-col gap-3">
          <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-white p-2">
            {QUEUES.map(([label, n], i) => (
              <button
                key={label}
                type="button"
                onClick={() => setQ(i)}
                className={cx(
                  "flex min-h-11 cursor-pointer items-center justify-between rounded-lg border-0 px-2.5 text-left text-[13px]",
                  q === i ? "bg-brand-soft font-semibold text-brand" : "bg-transparent text-ink",
                )}
              >
                {label}
                <span className="font-mono text-xs" style={{ color: i === 2 ? "#A3261B" : "#56625C" }}>
                  {n}
                </span>
              </button>
            ))}
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-white">
            {items.map((it, i) => (
              <button
                key={it.code}
                type="button"
                onClick={() => setItem(i)}
                className="flex w-full cursor-pointer flex-col gap-[3px] border-0 border-b border-l-[3px] border-b-line-soft px-3 py-2.5 text-left text-ink"
                style={{ background: item === i ? "#F2F8F5" : "#FFFFFF", borderLeftColor: item === i ? "#0E5A45" : "transparent" }}
              >
                <span className="font-mono text-xs font-semibold">{it.code}</span>
                <span className="text-[13px] leading-[18px]">{it.title}</span>
                <span className="text-[11px] text-muted">{it.meta}</span>
              </button>
            ))}
          </div>
        </aside>

        <section aria-label="Criterion under review" className="flex min-w-0 flex-[999_1_520px] flex-col gap-3.5">
          <Card className="flex flex-col gap-2.5 px-5 py-[18px]">
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
              <span>
                <Link href="/requirements/5.11.2-2" className="font-mono font-semibold">
                  5.11.2-2
                </Link>{" "}
                · criterion 1 of 3 · mandatory
              </span>
              <span>Due 02 Nov · 4 days</span>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
              <div>
                <Eyebrow className="mb-1 text-muted">OFFICIAL REQUIREMENT</Eyebrow>
                <div className="text-[13px] leading-5">
                  Core systems are integrated and exchange data end to end, with a complete implementation sample for each required
                  integration.
                </div>
              </div>
              <div>
                <Eyebrow className="mb-1 text-muted">CRITERION C1</Eyebrow>
                <div className="text-sm leading-[21px] font-semibold">A complete sample demonstrates every required integration end to end.</div>
                <div className="mt-1 text-xs text-muted">Fails if: only one partial integration, or no end-to-end sample.</div>
              </div>
            </div>
          </Card>

          <div className="flex flex-col gap-2.5 rounded-[14px] border border-ai-line bg-ai-tint px-5 py-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="rounded-md bg-ai px-2 py-[3px] text-[11px] font-bold tracking-[0.08em] text-white">AI RECOMMENDATION</span>
                <span className="rounded-full bg-bad-soft px-2.5 py-[3px] text-xs font-bold text-bad">Not satisfied</span>
              </div>
              <span className="text-xs text-[#4A4F6B]">
                confidence <b className="font-mono">0.86</b> · threshold 0.70 · run MR-88213
              </span>
            </div>
            <div className="text-sm leading-[22px] text-[#1F1C47]">
              The sample shows the HR ↔ Government Service Bus exchange only. No transaction evidence was found for the other three
              integrations listed in the inventory.
            </div>
            <div className="text-[13px] leading-5 text-ai-ink">
              <b>Missing:</b> transaction logs or screenshots for ERP ↔ CRM, ERP ↔ Document Management, CRM ↔ Portal.
            </div>
          </div>

          <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3.5">
            <Card className="flex flex-col gap-2.5 p-4">
              <Eyebrow color="#11603F">SUPPORTING PASSAGES · 2</Eyebrow>
              <div className="border-l-[3px] border-mint pl-2.5 text-[13px] leading-5">
                &ldquo;The HR system publishes employee records to the Government Service Bus; transaction ID GSB-44812 is shown in Figure 3.&rdquo;
                <br />
                <Link href="/evidence" className="font-mono text-xs">
                  EV-1988 · p.4 §2.1 · P-4-2
                </Link>{" "}
                <span className="text-xs text-warn">· dated Mar 2025</span>
              </div>
              <div className="border-l-[3px] border-mint pl-2.5 text-[13px] leading-5">
                Figure 3: GSB console screenshot with message payload and timestamp.
                <br />
                <Link href="/evidence" className="font-mono text-xs">
                  EV-1988 · p.6 fig.3
                </Link>
              </div>
            </Card>
            <Card className="flex flex-col gap-2.5 p-4">
              <Eyebrow color="#A3261B">CONTRADICTING OR WEAK · 1</Eyebrow>
              <div className="border-l-[3px] border-chart-non pl-2.5 text-[13px] leading-5">
                &ldquo;The platform currently operates five production integrations…&rdquo;
                <br />
                <Link href="/evidence" className="font-mono text-xs">
                  EV-2012 · p.3 · P-3-1
                </Link>{" "}
                <span className="text-xs text-bad">· unapproved draft</span>
              </div>
              <div className="text-xs leading-[18px] text-muted">
                Inventory lists 4 integrations; architecture report says 5. Neither shows samples for the remaining systems.
              </div>
            </Card>
          </div>

          <Card className="flex flex-col gap-2 px-5 py-4 text-[13px] leading-5">
            <Eyebrow className="text-muted">PRIOR DECISIONS (VISIBLE BY POLICY)</Eyebrow>
            <div>
              2025 Cycle 1 · reviewer accepted <b>Partial</b> · DGA later observed: &ldquo;The sample covers one integration only.&rdquo;
            </div>
          </Card>
        </section>

        <aside aria-label="Decision" className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5">
          <form className="m-0 flex flex-col gap-3.5 rounded-[14px] border-2 border-brand bg-white p-[18px]" onSubmit={(e) => e.preventDefault()}>
            <Eyebrow className="font-bold text-brand">YOUR DECISION · LEVEL 1</Eyebrow>
            <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
              <legend className="mb-1.5 text-sm font-semibold">Outcome</legend>
              {OPTIONS.map((label, i) => (
                <label
                  key={label}
                  className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-[13px]"
                  style={{ borderColor: d === i ? "#0E5A45" : "#DCE2DE", background: d === i ? "#F2F8F5" : "#FFFFFF" }}
                >
                  <input type="radio" name="decision" checked={d === i} onChange={() => setD(i)} className="h-[18px] w-[18px] accent-brand" />
                  {label}
                </label>
              ))}
            </fieldset>

            {d === 1 && (
              <div className="flex flex-col gap-2.5 rounded-[10px] bg-surface-2 p-3">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-ai-soft p-2 text-ai">
                    <b>AI</b>
                    <br />
                    Not satisfied
                  </div>
                  <div className="rounded-lg bg-warn-soft p-2 text-warn">
                    <b>You</b>
                    <br />
                    Partially satisfied
                  </div>
                </div>
                <label className="flex flex-col gap-1 text-[13px] font-semibold">
                  Your status
                  <select className={selectCls}>
                    <option>Partially satisfied</option>
                    <option>Satisfied</option>
                    <option>Insufficient evidence</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold">
                  Reason code (required)
                  <select className={selectCls}>
                    <option>OV-03 · Evidence outside documents reviewed</option>
                    <option>OV-01 · AI misread passage</option>
                    <option>OV-05 · Authority clarification applies</option>
                  </select>
                </label>
                <div className="text-xs leading-[18px] font-medium text-warn">
                  Override is material: policy adds L2 approval by the Assessment Manager. The AI output is preserved unchanged.
                </div>
              </div>
            )}
            {d === 2 && (
              <div className="flex flex-col gap-1.5 rounded-[10px] bg-warn-soft p-3 text-[13px] leading-5 text-[#6B3F05]">
                <span>
                  Returns to <b>Faisal K.</b> (IT Operations) with the missing items pre-filled. Work status → Returned for correction.
                </span>
              </div>
            )}

            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Rationale (required)
              <textarea
                rows={4}
                className="resize-y rounded-lg border border-field p-2.5 text-sm leading-5 font-normal"
                defaultValue="Partial, not unmet: a CRM ↔ Portal sample arrived after the AI run (EV-2055, p.2). Two integrations still lack end-to-end samples."
              />
            </label>
            <div className="flex flex-col gap-1.5 text-[13px]">
              <label className="flex min-h-8 items-center gap-2.5">
                <input type="checkbox" defaultChecked className="h-[18px] w-[18px] accent-brand" />I opened every cited passage
              </label>
              <label className="flex min-h-8 items-center gap-2.5">
                <input type="checkbox" className="h-[18px] w-[18px] accent-brand" />
                Validity window checked (2026 period)
              </label>
            </div>
            <button type="submit" className="h-12 cursor-pointer rounded-[10px] border-0 bg-brand text-[15px] font-semibold text-white hover:bg-brand-strong">
              {SUBMIT[d]}
            </button>
            <div className="text-xs leading-[18px] text-muted">
              Recorded as an immutable decision event with your role, reason, cited evidence and policy version AP-QIYAS-STD v2.
            </div>
          </form>

          <Card className="flex flex-col gap-2 p-4 text-[13px]">
            <div className="font-semibold">Remaining chain</div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-md bg-ai-soft px-2 py-1 text-ai">AI ✓</span>
              <span aria-hidden="true">→</span>
              <span className="rounded-md bg-brand-soft px-2 py-1 font-semibold text-brand">L1 · you</span>
              <span aria-hidden="true">→</span>
              <span className="rounded-md border border-field px-2 py-1">L2 · Assessment Manager</span>
              <span aria-hidden="true">→</span>
              <span className="rounded-md border border-field px-2 py-1">Final</span>
            </div>
          </Card>
        </aside>
      </main>
    </>
  );
}
