"use client";

import { useState } from "react";
import { PageHeader } from "@/components/workspace-shell";
import { Button } from "@/components/ui";

const S = {
  wait: ["AWAITING YOU", "#FBEFD9", "#8A4B00"],
  val: ["VALIDATING", "#E8ECF3", "#3E4B63"],
  pub: ["PUBLISHED", "#E3F1EA", "#11603F"],
  rej: ["REJECTED", "#FBE4E1", "#A3261B"],
} as const;

const crs: [string, keyof typeof S, string, string][] = [
  ["CR-041", "wait", "Scoring scheme QY-2026 v3 → v4", "Majed F. · 27 Oct · material"],
  ["CR-040", "wait", "Acceptance policy AP-QIYAS-CRIT v2", "Majed F. · 27 Oct · material"],
  ["CR-039", "val", "Rule ESC-02 v3 adds priority condition", "Noura A. · 28 Oct"],
  ["CR-038", "pub", "Arabic labels for hierarchy levels", "Sara N. · 21 Oct · cosmetic"],
  ["CR-036", "rej", "Allow bulk approval for medium risk", "Noura A. · 14 Oct · rejected by Huda S."],
];

const diff: [string, string, string, boolean][] = [
  ["Blocking rule SR-03", "mandatory fail → cap at Partial", "mandatory fail → cap at Non-compliant", true],
  ["Weight · standard 5.11", "1.0", "1.5", true],
  ["Weight · standard 4.1", "1.0", "1.5", true],
  ["N/A treatment", "exclude from denominator", "exclude from denominator", false],
  ["Thresholds", "green ≥ 85 · amber ≥ 60", "green ≥ 85 · amber ≥ 60", false],
  ["Override second approval", "Δ ≥ 0.5 pts", "Δ ≥ 0.5 pts", false],
];

const audit: [string, string, string][] = [
  ["28 Oct 09:12", "System", "Impact analysis recalculated on live data: 14 requirements, 2 domains."],
  ["27 Oct 16:20", "Majed F.", "Submitted CR-041 for approval (validation passed, 0 errors)."],
  ["27 Oct 15:58", "System", "Sandbox test ran v4 against 350 requirements; results stored as snapshot SNP-77."],
  ["27 Oct 11:04", "Majed F.", "Draft v4 created from published v3."],
  ["02 Sep 08:30", "Huda S.", "Approved and published v3 (CR-022), effective Cycle 1."],
];

export default function ConfigHistoryPage() {
  const [sel, setSel] = useState(0);

  return (
    <>
      <PageHeader
        crumb="Admin Studio / Configuration history"
        title="Configuration history & approval"
        actions={
          <div className="flex items-center gap-2 text-[13px] text-muted">
            Signed in as <b className="text-ink">Huda S. · Compliance Lead</b>
          </div>
        }
      />
      <main className="box-border flex w-full max-w-[1360px] flex-wrap items-start gap-4 px-8 pb-12 pt-6">
        <section aria-label="Change requests" className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
          {crs.map(([id, s, title, meta], i) => (
            <button
              key={id}
              type="button"
              onClick={() => setSel(i)}
              className="flex cursor-pointer flex-col gap-1 rounded-xl bg-white px-3.5 py-3 text-left text-ink"
              style={{ border: sel === i ? "2px solid #0E5A45" : "1px solid #DCE2DE" }}
            >
              <span className="flex justify-between gap-2">
                <b className="font-mono text-xs">{id}</b>
                <span className="rounded px-1.5 py-px text-[11px] font-bold" style={{ background: S[s][1], color: S[s][2] }}>
                  {S[s][0]}
                </span>
              </span>
              <span className="text-[13px] leading-[18px] font-semibold">{title}</span>
              <span className="text-xs text-muted">{meta}</span>
            </button>
          ))}
        </section>

        <section className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">
          <div className="overflow-hidden rounded-[14px] border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line-soft px-5 py-4">
              <div>
                <h2 className="m-0 text-[17px] font-semibold">CR-041 · Scoring scheme QY-2026 v3 → v4</h2>
                <div className="text-xs text-muted">Author Majed F. (Framework Admin) · submitted 27 Oct 16:20 · validated in sandbox</div>
              </div>
              <div role="group" aria-label="Environment promotion" className="flex items-center gap-1 text-xs">
                <span className="rounded-md bg-good-soft px-2 py-1 font-semibold text-good">dev ✓</span>
                <span aria-hidden="true">→</span>
                <span className="rounded-md bg-good-soft px-2 py-1 font-semibold text-good">test ✓</span>
                <span aria-hidden="true">→</span>
                <span className="rounded-md border border-field px-2 py-1">prod · on approval</span>
              </div>
            </div>
            <div role="table" aria-label="Changes between versions" className="text-[13px]">
              <div role="row" className="grid grid-cols-3 border-b border-line bg-surface-2 text-xs font-semibold text-muted">
                <span role="columnheader" className="px-4 py-2.5">
                  Setting
                </span>
                <span role="columnheader" className="px-4 py-2.5">
                  v3 · live
                </span>
                <span role="columnheader" className="px-4 py-2.5">
                  v4 · proposed
                </span>
              </div>
              {diff.map(([k, o, n, changed]) => (
                <div role="row" key={k} className="grid grid-cols-3 border-b border-line-soft">
                  <span role="cell" className="px-4 py-2.5 font-semibold">
                    {k}
                  </span>
                  <span role="cell" className="px-4 py-2.5 font-mono text-xs leading-[18px]" style={{ background: changed ? "#FDF1EF" : "#FFFFFF" }}>
                    {o}
                  </span>
                  <span role="cell" className="px-4 py-2.5 font-mono text-xs leading-[18px]" style={{ background: changed ? "#EEF7F2" : "#FFFFFF" }}>
                    {n}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-start gap-3.5">
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2 rounded-[14px] border border-line bg-white p-[18px] text-[13px] leading-5">
              <h3 className="m-0 text-[15px] font-semibold">Impact analysis</h3>
              <div>
                <b>14</b> requirements change result · <b>2</b> domains
              </div>
              <div>
                Readiness <span className="font-mono">72.4% → 70.9%</span>
              </div>
              <div>
                <b>9</b> accepted assessments keep v3 until re-accepted
              </div>
              <div>Dependencies: 3 dashboards, 1 report template, ESC-02 (uses &ldquo;critical&rdquo;)</div>
            </div>
            <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5 rounded-[14px] border-2 border-brand bg-white p-[18px]">
              <h3 className="m-0 text-[15px] font-semibold">Your approval</h3>
              <div className="flex flex-col gap-1.5 text-[13px] leading-[19px]">
                <div className="text-good">✓ You are not the author (four-eyes)</div>
                <div className="text-good">✓ You hold &ldquo;approve scoring change&rdquo;</div>
                <div className="text-warn">
                  ! Author holds override rights on 9 affected requirements. Approving will suspend those rights for this cycle.
                </div>
              </div>
              <label className="flex flex-col gap-1 text-[13px] font-semibold">
                Comment (required)
                <textarea
                  rows={3}
                  defaultValue="Aligned with DGA scoring note 2026-03; effective from Cycle 2."
                  className="resize-y rounded-lg border border-field p-2.5 text-sm font-normal"
                />
              </label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold">
                Effective from
                <input type="text" defaultValue="Qiyas 2026 · Cycle 2 · 01 Dec 2026" className="h-11 rounded-lg border border-field px-2.5 text-sm font-normal" />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button className="text-bad hover:text-bad">Reject</Button>
                <Button variant="primary" className="px-4">
                  Approve and publish v4
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-[14px] border border-line bg-white px-5 py-[18px]">
            <h3 className="m-0 text-[15px] font-semibold">Audit trail · immutable</h3>
            {audit.map(([t, who, e]) => (
              <div key={t} className="grid grid-cols-[130px_160px_minmax(0,1fr)] gap-2.5 border-t border-line-soft py-1.5 text-xs leading-[18px]">
                <span className="font-mono text-muted">{t}</span>
                <span>
                  <b>{who}</b>
                </span>
                <span>{e}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
