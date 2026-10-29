"use client";

import { useState } from "react";
import { PageHeader } from "@/components/workspace-shell";
import { Button, ButtonLink, Card } from "@/components/ui";

const METHODS: [string, string][] = [
  ["Binary", "Met / not met"],
  ["Three-level", "Compliant, partial, non-compliant"],
  ["Maturity 0–5", "Level per control, minimum or average"],
  ["Weighted points", "Custom point scale"],
];

const statuses = [
  { en: "Compliant", ar: "ممتثل", pts: "1.0", den: "Yes", bg: "#E3F1EA", fg: "#11603F" },
  { en: "Partially compliant", ar: "ممتثل جزئيًا", pts: "0.5", den: "Yes", bg: "#FBEFD9", fg: "#8A4B00" },
  { en: "Non-compliant", ar: "غير ممتثل", pts: "0.0", den: "Yes", bg: "#FBE4E1", fg: "#A3261B" },
  { en: "Not assessed", ar: "لم يُقيَّم", pts: "0.0", den: "Yes, flagged", bg: "#ECEEEC", fg: "#4A5550" },
  { en: "Not applicable", ar: "لا ينطبق", pts: "—", den: "Per N/A rule", bg: "#E8ECF3", fg: "#3E4B63" },
];

const NA_OPTS = ["Exclude from denominator", "Redistribute weight within standard", "Authority-defined treatment"];

const ST_COLS = "1.4fr 1.4fr 0.8fr 1.2fr";
const selectCls = "h-11 rounded-lg border border-field bg-white px-2.5 text-sm font-normal";
const token = "rounded-md border border-field bg-white px-2.5 py-1.5";
const op = "rounded-md bg-brand-soft px-2.5 py-1.5 font-semibold text-brand";

export default function ScoringDesignerPage() {
  const [m, setM] = useState(1);
  const [na, setNa] = useState(0);

  return (
    <>
      <PageHeader
        crumb="Admin Studio / Qiyas 2026 v1.3 / Scoring"
        title="Scoring & maturity designer"
        actions={
          <>
            <span className="rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn">Draft QY-2026 v4 · from v3</span>
            <Button>Validate</Button>
            <ButtonLink href="/admin/history" variant="primary" className="px-4">
              Submit for four-eyes approval
            </ButtonLink>
          </>
        }
      />
      <main className="box-border flex w-full max-w-[1360px] flex-wrap items-start gap-4 px-8 pb-12 pt-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="m-0 text-base font-semibold">1 · Scale</h2>
            <div role="radiogroup" aria-label="Scoring method" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
              {METHODS.map(([label, desc], i) => (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={m === i}
                  onClick={() => setM(i)}
                  className="flex min-h-11 cursor-pointer flex-col gap-1 rounded-[10px] p-3 text-left text-ink"
                  style={{ border: m === i ? "2px solid #0E5A45" : "1px solid #DCE2DE", background: m === i ? "#F2F8F5" : "#FFFFFF" }}
                >
                  <b className="text-sm">{label}</b>
                  <span className="text-xs leading-4 text-muted">{desc}</span>
                </button>
              ))}
            </div>
            <div role="table" aria-label="Status values" className="text-[13px]">
              <div role="row" className="grid gap-2.5 border-b border-line py-2 text-xs font-semibold text-muted" style={{ gridTemplateColumns: ST_COLS }}>
                <span role="columnheader">Status (EN)</span>
                <span role="columnheader">Status (AR)</span>
                <span role="columnheader">Points</span>
                <span role="columnheader">Counts in denominator</span>
              </div>
              {statuses.map((s) => (
                <div role="row" key={s.en} className="grid items-center gap-2.5 border-b border-line-soft py-2" style={{ gridTemplateColumns: ST_COLS }}>
                  <span role="cell">
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: s.bg, color: s.fg }}>
                      {s.en}
                    </span>
                  </span>
                  <span role="cell" lang="ar" dir="rtl" className="text-left">
                    {s.ar}
                  </span>
                  <span role="cell">
                    <input
                      type="text"
                      defaultValue={s.pts}
                      aria-label={`Points for ${s.en}`}
                      className="h-10 w-[72px] rounded-lg border border-field px-2.5 font-mono text-[13px]"
                    />
                  </span>
                  <span role="cell" className="text-xs">
                    {s.den}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="m-0 text-base font-semibold">2 · Roll-up formula</h2>
            <div className="text-xs text-muted">Built from approved blocks. Free-text or executable formulas are not allowed.</div>
            <div className="flex flex-wrap items-center gap-2 rounded-[10px] bg-surface-2 p-3.5 font-mono text-[13px]">
              <span className={op}>Σ</span>
              <span className={token}>requirement.points</span>
              <span>×</span>
              <span className={token}>requirement.weight</span>
              <span className={op}>÷ Σ</span>
              <span className={token}>applicable.weight</span>
              <span>×</span>
              <span className={token}>100</span>
              <button type="button" className="h-9 cursor-pointer rounded-md border border-dashed border-[#7D8C85] bg-white px-2.5 font-sans text-xs text-ink-2">
                + block
              </button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 text-[13px]">
              <label className="flex flex-col gap-1 font-semibold">
                Level roll-up
                <select className={selectCls}>
                  <option>Weighted average</option>
                  <option>Sum of points</option>
                  <option>Minimum maturity</option>
                  <option>Threshold table</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                Rounding
                <select className={selectCls}>
                  <option>1 decimal, half up</option>
                  <option>2 decimals</option>
                  <option>Whole number</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                Weights by
                <select className={selectCls}>
                  <option>Requirement (high 1.5 · med 1.0 · low 0.5)</option>
                  <option>Criterion</option>
                  <option>Domain</option>
                </select>
              </label>
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <h2 className="m-0 text-base font-semibold">3 · Rules</h2>
            <div className="flex flex-col gap-2 text-[13px]">
              <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line p-3">
                <span className="rounded-md bg-bad-soft px-2 py-0.5 text-[11px] font-bold text-bad">BLOCKING · SR-03</span>
                <span>
                  If a <b>mandatory criterion</b> is <b>Not satisfied</b>, cap the requirement at <b>Non-compliant</b>.
                </span>
                <span className="ml-auto text-xs font-semibold text-warn">changed in v4: was &ldquo;cap at Partial&rdquo;</span>
              </div>
              <fieldset className="m-0 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border border-line p-3">
                <legend className="px-1 font-semibold">Not applicable treatment</legend>
                {NA_OPTS.map((label, i) => (
                  <label key={label} className="flex min-h-10 items-center gap-2">
                    <input type="radio" name="na" checked={na === i} onChange={() => setNa(i)} className="h-[18px] w-[18px] accent-brand" />
                    {label}
                  </label>
                ))}
              </fieldset>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-2">
                <Threshold label="Green from" value="85.0" border="2px solid #2E8B6A" />
                <Threshold label="Amber from" value="60.0" border="2px solid #D08A1C" />
                <Threshold label="Target score" value="85.0" border="1px solid #CBD3CE" />
              </div>
              <div className="rounded-[10px] border border-line p-3 leading-5">
                <b>Human override:</b> SME, Assessment Manager · reason code required · second approval when requirement points change by 0.5 or more
              </div>
            </div>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-[14px] border-2 border-[#3F6FB5] bg-white p-[18px]">
            <div className="text-[11px] font-bold tracking-[0.08em] text-[#2F5893]">PREVIEW AGAINST LIVE DATA · READ-ONLY</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[10px] bg-surface-2 p-2.5">
                <div className="text-xs text-muted">v3 (live)</div>
                <div className="text-2xl font-bold">72.4%</div>
              </div>
              <div className="rounded-[10px] bg-[#EEF3FA] p-2.5">
                <div className="text-xs text-[#2F5893]">v4 (draft)</div>
                <div className="text-2xl font-bold">70.9%</div>
              </div>
            </div>
            <div className="text-[13px] leading-5">
              <b>14 requirements</b> change result, in <b>2 domains</b>.
            </div>
            <div className="flex flex-col gap-1.5 font-mono text-xs">
              <div className="flex justify-between">
                <span>Technology &amp; integration</span>
                <span>61.3 → 58.9</span>
              </div>
              <div className="flex justify-between">
                <span>Human capital</span>
                <span>58.1 → 55.7</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Other 4 domains</span>
                <span>no change</span>
              </div>
            </div>
            <div className="border-t border-line-soft pt-2.5 text-xs leading-[18px] text-muted">
              Accepted 2026 results keep v3 until re-accepted under v4. 2025 history is never recalculated.
            </div>
            <Button size="md">See the 14 requirements</Button>
          </section>
          <Card className="flex flex-col gap-2 p-[18px] text-[13px] leading-5">
            <h2 className="m-0 text-[15px] font-semibold">Validation</h2>
            <div className="text-good">✓ Every status maps to points</div>
            <div className="text-good">✓ Thresholds ordered and non-overlapping</div>
            <div className="text-good">✓ Formula uses approved blocks only</div>
            <div className="text-warn">! Changes official results: four-eyes approval required</div>
            <div className="text-warn">! Author Majed F. holds override rights on 9 affected requirements</div>
          </Card>
        </aside>
      </main>
    </>
  );
}

function Threshold({ label, value, border }: { label: string; value: string; border: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold">
      {label}
      <input type="text" defaultValue={value} className="h-10 rounded-lg px-2.5 font-mono text-[13px] font-normal" style={{ border }} />
    </label>
  );
}
