"use client";

import { useState } from "react";
import { PageHeader } from "@/components/workspace-shell";
import { Button, ButtonLink, TabBar } from "@/components/ui";

const S = { pub: ["PUBLISHED", "#E3F1EA", "#11603F"], draft: ["DRAFT", "#FBEFD9", "#8A4B00"] } as const;

const fws: [string, keyof typeof S, string, string][] = [
  ["Qiyas 2026 · v1.2", "pub", "DGA · used by 2026 Cycle 1 · immutable", "Axis › Standard › Requirement › Criterion"],
  ["Qiyas 2026 · v1.3", "draft", "DGA · 2 changes since v1.2 · sandbox", "Axis › Standard › Requirement › Criterion"],
  ["NCA ECC · 2024", "pub", "NCA · maturity 0–5 · 2 sequential reviewers", "Domain › Subdomain › Control › Subcontrol"],
  ["Internal ISO 27001", "draft", "Internal audit · binary scoring", "Clause › Annex A control"],
];

const levels = [
  { n: 1, en: "Axis", ar: "المحور", pattern: "#", assessed: "Roll-up only" },
  { n: 2, en: "Standard", ar: "المعيار", pattern: "#.#.#", assessed: "Roll-up only" },
  { n: 3, en: "Requirement", ar: "المتطلب", pattern: "#.#.#-#", assessed: "Accepted here" },
  { n: 4, en: "Criterion", ar: "البند", pattern: "#.#.#-#-C#", assessed: "AI + reviewer" },
];

const mapping: [string, string][] = [
  ["Requirement code", "official_code"],
  ["Domain", "level 1 · Axis"],
  ["Official text (AR)", "official_text.ar"],
  ["Official text (EN)", "official_text.en"],
  ["Implementation req.", "guidance"],
  ["Weight", "weight"],
  ["Applicability", "applicability_rule"],
];

const results: [string, string, string, string][] = [
  ["Valid rows", "348", "#E3F1EA", "#11603F"],
  ["Warnings: weight missing", "2", "#FBEFD9", "#8A4B00"],
  ["Changed vs v1.2", "37 wording · 31 new", "#F7F8F6", "#33403A"],
  ["Errors", "0", "#F7F8F6", "#33403A"],
];

const TABS = [{ label: "Hierarchy" }, { label: "Requirements · 350" }, { label: "Criteria · 912" }, { label: "Custom fields" }, { label: "Terminology" }];
const LV_COLS = "44px 1.3fr 1.3fr 1fr 1fr 44px";
const inputCls = "box-border h-10 w-full rounded-lg border border-field px-2.5";

export default function FrameworkBuilderPage() {
  const [sel, setSel] = useState(1);
  const [tab, setTab] = useState(0);

  return (
    <>
      <PageHeader
        crumb="Admin Studio / Framework package"
        title="Framework Builder"
        actions={
          <>
            <Button>Import package</Button>
            <Button variant="primary" className="px-4">
              New framework
            </Button>
          </>
        }
      />
      <main className="box-border flex w-full max-w-[1360px] flex-col gap-4 px-8 pb-12 pt-6">
        <section aria-label="Frameworks" className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3">
          {fws.map(([name, s, meta, lv], i) => (
            <button
              key={name}
              type="button"
              onClick={() => setSel(i)}
              className="flex cursor-pointer flex-col gap-1.5 rounded-xl bg-white px-4 py-3.5 text-left text-ink"
              style={{ border: sel === i ? "2px solid #0E5A45" : "1px solid #DCE2DE" }}
            >
              <span className="flex items-center justify-between gap-2">
                <b className="text-[15px]">{name}</b>
                <span className="rounded-md px-2 py-0.5 text-[11px] font-bold" style={{ background: S[s][1], color: S[s][2] }}>
                  {S[s][0]}
                </span>
              </span>
              <span className="text-xs text-muted">{meta}</span>
              <span className="font-mono text-xs text-ink-2">{lv}</span>
            </button>
          ))}
        </section>

        <div className="flex flex-wrap items-start gap-4">
          <section className="min-w-0 flex-[999_1_560px] overflow-hidden rounded-[14px] border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line-soft px-5 py-4">
              <div>
                <h2 className="m-0 text-[17px] font-semibold">Qiyas 2026 · v1.3</h2>
                <div className="text-xs text-muted">
                  Draft from v1.2 · issuing authority DGA · effective 01 Jan 2026 · sources: Qiyas guide 2026 (PDF), requirements master (XLSX)
                </div>
              </div>
              <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">v1.2 is in use by 1 cycle and is locked</span>
            </div>
            <TabBar label="Framework sections" tabs={TABS} active={tab} onSelect={setTab} className="border-b border-line-soft px-4 [&>button]:px-3" />
            <div className="flex flex-col gap-2.5 px-5 py-4">
              <div className="text-[13px] text-muted">
                Hierarchy levels are names, not code. Another framework can use pillar / objective / control / sub-control with the same engine.
              </div>
              <div role="table" aria-label="Hierarchy levels" className="text-[13px]">
                <div role="row" className="grid gap-2.5 border-b border-line py-2 text-xs font-semibold text-muted" style={{ gridTemplateColumns: LV_COLS }}>
                  <span role="columnheader">Level</span>
                  <span role="columnheader">English label</span>
                  <span role="columnheader">Arabic label</span>
                  <span role="columnheader">Code pattern</span>
                  <span role="columnheader">Assessed here</span>
                  <span role="columnheader">
                    <span className="sr-only">Remove</span>
                  </span>
                </div>
                {levels.map((l) => (
                  <div role="row" key={l.n} className="grid items-center gap-2.5 border-b border-line-soft py-2" style={{ gridTemplateColumns: LV_COLS }}>
                    <span role="cell" className="font-mono font-semibold">
                      {l.n}
                    </span>
                    <span role="cell">
                      <input type="text" defaultValue={l.en} aria-label={`English label, level ${l.n}`} className={`${inputCls} text-[13px]`} />
                    </span>
                    <span role="cell">
                      <input type="text" defaultValue={l.ar} dir="rtl" lang="ar" aria-label={`Arabic label, level ${l.n}`} className={`${inputCls} text-sm`} />
                    </span>
                    <span role="cell" className="font-mono text-xs">
                      {l.pattern}
                    </span>
                    <span role="cell" className="text-xs">
                      {l.assessed}
                    </span>
                    <span role="cell">
                      <button
                        type="button"
                        aria-label={`Remove level ${l.n}`}
                        className="h-10 w-10 cursor-pointer rounded-lg border border-field bg-white text-base text-muted"
                      >
                        ×
                      </button>
                    </span>
                  </div>
                ))}
              </div>
              <button type="button" className="h-10 cursor-pointer self-start rounded-lg border border-dashed border-[#7D8C85] bg-white px-3 text-[13px] text-ink-2">
                + Add level
              </button>
            </div>
          </section>

          <section className="flex min-w-0 flex-[1_1_360px] flex-col gap-3 rounded-[14px] border border-line bg-white p-[18px]">
            <h2 className="m-0 text-base font-semibold">Import requirements</h2>
            <div className="rounded-[10px] border border-line bg-surface-2 px-3 py-2.5 text-[13px] leading-5">
              <b>qiyas-2026.xlsx</b> · tab 03_Requirements · 350 rows
              <br />
              <span className="text-muted">Uploaded by Majed F. · 26 Oct · SHA-256 4b1e…90c2</span>
            </div>
            <div className="text-xs font-semibold text-muted">Column mapping</div>
            <div className="grid grid-cols-[minmax(0,1fr)_20px_minmax(0,1fr)] items-center gap-1.5 text-xs">
              {mapping.map(([from, to]) => (
                <Row key={from} from={from} to={to} />
              ))}
            </div>
            <div className="flex flex-col gap-1.5 text-[13px]">
              {results.map(([label, v, bg, fg]) => (
                <div key={label} className="flex justify-between rounded-lg px-2.5 py-2" style={{ background: bg, color: fg }}>
                  <span>{label}</span>
                  <b>{v}</b>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button>Fix 2 warnings</Button>
              <ButtonLink href="/admin/history" variant="primary">
                Validate &amp; submit
              </ButtonLink>
            </div>
            <div className="text-xs leading-[18px] text-muted">
              Criteria drafted by the Requirement Decomposer stay &ldquo;Draft – SME approval required&rdquo; and cannot be used as assessment logic
              until a Qiyas SME signs them off.
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function Row({ from, to }: { from: string; to: string }) {
  return (
    <>
      <span className="font-mono">{from}</span>
      <span aria-hidden="true">→</span>
      <span>{to}</span>
    </>
  );
}
