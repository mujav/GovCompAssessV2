"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/workspace-shell";
import { Button, ButtonLink, Eyebrow } from "@/components/ui";

const S = {
  ans: ["Answered", "#E8ECF3", "#3E4B63"],
  sub: ["Awaiting DGA", "#FBEFD9", "#8A4B00"],
  draft: ["Draft", "#ECEEEC", "#33403A"],
  done: ["Applied", "#E3F1EA", "#11603F"],
} as const;

const list: [string, keyof typeof S, string, string][] = [
  ["CL-014", "ans", "Is a prior-cycle sample acceptable for unchanged integrations?", "6 affected · answered 24 Oct"],
  ["CL-015", "sub", "Can a staging-environment transaction count as a sample?", "2 affected · submitted 20 Oct · 8 days"],
  ["CL-016", "draft", "Does the shared-services hosting arrangement make 5.7.1 not applicable?", "1 affected · AI-drafted question"],
  ["CL-012", "done", "Which approval level is required for the data policy?", "3 affected · applied 02 Oct"],
  ["CL-011", "done", "Reporting period for quarterly committee minutes", "4 affected · applied 21 Sep"],
];

const affected: [string, string, string, string, boolean][] = [
  ["5.11.2-2", "Sample EV-1988 dated Mar 2025", "Pending L1", "Add finding to review", false],
  ["5.11.1-1", "Accepted with 2025 sample EV-1430", "Accepted", "Reopen · request update", true],
  ["5.3.1-1", "Repository screenshot from 2025", "Pending L2", "Add finding to review", false],
  ["3.2.4-1", "KPI sample covers 2025 only", "Accepted", "Reopen · request update", true],
  ["6.1.2-2", "Portal transaction sample from 2025", "Accepted", "Reopen · request update", true],
  ["6.2.1-3", "Feedback sample, mixed periods", "Accepted", "Reopen · request update", true],
];

const AF_COLS = "0.8fr 2fr 1fr 1.3fr";

export default function ClarificationsPage() {
  const [sel, setSel] = useState(0);

  return (
    <>
      <PageHeader
        crumb="Workspace / Clarifications"
        title="Regulator clarifications"
        actions={
          <Button variant="primary" className="px-4">
            New clarification
          </Button>
        }
      />
      <main className="box-border flex w-full max-w-[1360px] flex-wrap items-start gap-4 px-8 pb-12 pt-6">
        <section aria-label="Clarification register" className="flex min-w-0 flex-[1_1_360px] flex-col gap-2">
          {list.map(([id, s, q, meta], i) => (
            <button
              key={id}
              type="button"
              onClick={() => setSel(i)}
              className="flex cursor-pointer flex-col gap-1.5 rounded-xl bg-white px-4 py-3.5 text-left text-ink"
              style={{ border: sel === i ? "2px solid #0E5A45" : "1px solid #DCE2DE" }}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-semibold">{id}</span>
                <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: S[s][1], color: S[s][2] }}>
                  {S[s][0]}
                </span>
              </span>
              <span className="text-sm leading-5 font-semibold">{q}</span>
              <span className="text-xs text-muted">{meta}</span>
            </button>
          ))}
        </section>

        <section aria-label="Clarification detail" className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-[14px] border border-line bg-white">
          <div className="flex flex-col gap-1.5 border-b border-line-soft px-5 py-[18px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] font-semibold">CL-014</span>
              <span className="rounded-md bg-na-soft px-2 py-0.5 text-[11px] font-semibold text-na-fg">ANSWERED · NOT YET APPLIED</span>
            </div>
            <h2 className="m-0 text-lg leading-[26px] font-semibold">
              Does an implementation sample from the previous cycle satisfy integration requirements if the systems are unchanged?
            </h2>
            <div className="text-xs text-muted">Raised by Faisal K. (IT Operations) · submitted to DGA 11 Oct via portal inquiry · response 24 Oct</div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] border-b border-line-soft">
            <div className="flex flex-col gap-1.5 border-r border-line-soft px-5 py-4">
              <Eyebrow className="text-muted">AUTHORITY RESPONSE · VERBATIM</Eyebrow>
              <div lang="ar" dir="rtl" className="text-[15px] leading-[26px]">
                يجب أن يكون النموذج التطبيقي من الدورة الحالية، ولا يُقبل نموذج الدورة السابقة حتى في حال عدم تغيّر الأنظمة.
              </div>
              <div className="text-xs text-muted">Source: DGA portal response #R-5521 · attachment kept</div>
            </div>
            <div className="flex flex-col gap-1.5 px-5 py-4">
              <Eyebrow color="#0E5A45">FINAL INTERPRETATION · APPROVED</Eyebrow>
              <div className="text-sm leading-[22px]">
                Implementation samples must be dated within the current cycle. Prior-cycle samples are not acceptable even for unchanged
                systems.
              </div>
              <div className="text-xs text-muted">Recorded by Noura A. · approved by Compliance Lead · 25 Oct</div>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 px-5 py-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="m-0 text-[15px] font-semibold">Affected assessments · 6</h3>
              <span className="text-xs text-muted">Found by matching the &ldquo;implementation sample&rdquo; evidence rule</span>
            </div>
            <div className="overflow-x-auto">
              <div role="table" aria-label="Affected assessments" className="min-w-[620px] text-[13px]">
                <div role="row" className="grid gap-2.5 border-b border-line py-2 text-xs font-semibold text-muted" style={{ gridTemplateColumns: AF_COLS }}>
                  <span role="columnheader">Requirement</span>
                  <span role="columnheader">Why affected</span>
                  <span role="columnheader">Acceptance now</span>
                  <span role="columnheader">On apply</span>
                </div>
                {affected.map(([code, why, acc, effect, reopen]) => (
                  <div role="row" key={code} className="grid items-center gap-2.5 border-b border-line-soft py-2" style={{ gridTemplateColumns: AF_COLS }}>
                    <span role="cell">
                      <Link href={`/requirements/${code}`} className="font-mono text-xs font-semibold">
                        {code}
                      </Link>
                    </span>
                    <span role="cell" className="leading-[18px]">
                      {why}
                    </span>
                    <span role="cell" className="text-xs">
                      {acc}
                    </span>
                    <span role="cell" className="text-xs font-semibold" style={{ color: reopen ? "#A3261B" : "#33403A" }}>
                      {effect}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-line-soft bg-[#FAFBFA] px-5 py-3.5">
            <span className="flex-[1_1_280px] text-xs leading-[18px] text-muted">
              Applying reopens 4 accepted assessments and creates update requests for their owners. Historical results keep their original
              configuration version.
            </span>
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/admin/frameworks">Propose guidance change</ButtonLink>
              <Button variant="primary" className="px-4">
                Preview and apply
              </Button>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
