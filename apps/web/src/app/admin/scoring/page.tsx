"use client";

import { useState } from "react";
import { Checks, DraftBar, LockNote } from "@/components/admin-ui";
import { PageHeader } from "@/components/workspace-shell";
import { Button, Card } from "@/components/ui";
import { SAMPLE_REQUIREMENTS } from "@/lib/admin/sample-data";
import { useAdmin, working } from "@/lib/admin/store";
import type { BlockingCap, NaTreatment, ScoringMethod, ScoringScheme } from "@/lib/admin/types";
import { compareSchemes, pointsTable, score, validateScheme } from "@/lib/engine/scoring";

const METHODS: [ScoringMethod, string, string][] = [
  ["binary", "Binary", "Met / not met"],
  ["three", "Three-level", "Compliant, partial, non-compliant"],
  ["maturity", "Maturity 0–5", "Fixed scale, normalized to 0–1"],
  ["points", "Weighted points", "Custom point scale"],
];

const STATUSES = [
  { key: "comp", en: "Compliant", ar: "ممتثل", den: "Yes", bg: "#E3F1EA", fg: "#11603F" },
  { key: "part", en: "Partially compliant", ar: "ممتثل جزئيًا", den: "Yes", bg: "#FBEFD9", fg: "#8A4B00" },
  { key: "non", en: "Non-compliant", ar: "غير ممتثل", den: "Yes", bg: "#FBE4E1", fg: "#A3261B" },
  { key: "nas", en: "Not assessed", ar: "لم يُقيَّم", den: "Yes, flagged", bg: "#ECEEEC", fg: "#4A5550" },
] as const;

const NA_OPTS: [NaTreatment, string][] = [
  ["exclude", "Exclude from denominator"],
  ["redistribute", "Redistribute weight within standard"],
  ["authority", "Authority-defined (count as met)"],
];

const CAP_OPTS: [BlockingCap, string][] = [
  ["non", "Non-compliant"],
  ["part", "Partial"],
  ["off", "No cap (rule off)"],
];

const ST_COLS = "1.4fr 1.4fr 0.8fr 1.2fr";
const selectCls = "h-11 rounded-lg border border-field bg-white px-2.5 text-sm font-normal disabled:bg-surface-2";
const numCls = "h-10 rounded-lg border border-field px-2.5 font-mono text-[13px] font-normal disabled:bg-surface-2";
const token = "rounded-md border border-field bg-white px-2.5 py-1.5";
const op = "rounded-md bg-brand-soft px-2.5 py-1.5 font-semibold text-brand";

const num = (v: number) => (Number.isFinite(v) ? v : "");

export default function ScoringDesignerPage() {
  const { state, editDraft } = useAdmin();
  const [showChanged, setShowChanged] = useState(false);
  const slotV = state.scoring;
  const { value: s, locked } = working(slotV);
  if (!s) return null;
  const edit = (fn: (d: ScoringScheme) => void) => editDraft<ScoringScheme>("scoring", slotV.id, fn);
  const checks = validateScheme(s);
  const table = pointsTable(s);
  const editablePoints = !locked && (s.method === "three" || s.method === "points");
  const cmp = slotV.draft && slotV.live ? compareSchemes(SAMPLE_REQUIREMENTS, slotV.live, slotV.draft) : null;
  const liveScore = slotV.live ? score(SAMPLE_REQUIREMENTS, slotV.live) : null;

  return (
    <>
      <PageHeader crumb={`Admin Studio / ${s.code} / Scoring`} title="Scoring & maturity designer">
        <DraftBar kind="scoring" id={slotV.id} checks={checks} />
      </PageHeader>
      <main className="box-border flex w-full max-w-[1360px] flex-wrap items-start gap-4 px-8 pb-12 pt-6">
        <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <LockNote kind="scoring" id={slotV.id} />
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="m-0 text-base font-semibold">1 · Scale</h2>
            <div role="radiogroup" aria-label="Scoring method" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
              {METHODS.map(([key, label, desc]) => {
                const on = s.method === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={locked}
                    onClick={() => edit((d) => void (d.method = key))}
                    className="flex min-h-11 cursor-pointer flex-col gap-1 rounded-[10px] p-3 text-left text-ink disabled:cursor-default"
                    style={{ border: on ? "2px solid #0E5A45" : "1px solid #DCE2DE", background: on ? "#F2F8F5" : "#FFFFFF" }}
                  >
                    <b className="text-sm">{label}</b>
                    <span className="text-xs leading-4 text-muted">{desc}</span>
                  </button>
                );
              })}
            </div>
            <div role="table" aria-label="Status values" className="text-[13px]">
              <div role="row" className="grid gap-2.5 border-b border-line py-2 text-xs font-semibold text-muted" style={{ gridTemplateColumns: ST_COLS }}>
                <span role="columnheader">Status (EN)</span>
                <span role="columnheader">Status (AR)</span>
                <span role="columnheader">Points</span>
                <span role="columnheader">Counts in denominator</span>
              </div>
              {STATUSES.map((st) => (
                <div role="row" key={st.key} className="grid items-center gap-2.5 border-b border-line-soft py-2" style={{ gridTemplateColumns: ST_COLS }}>
                  <span role="cell">
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: st.bg, color: st.fg }}>
                      {st.en}
                    </span>
                  </span>
                  <span role="cell" lang="ar" dir="rtl" className="text-left">
                    {st.ar}
                  </span>
                  <span role="cell">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={num(table[st.key])}
                      disabled={!editablePoints}
                      onChange={(e) => edit((d) => void (d.points[st.key] = e.target.value === "" ? NaN : Number(e.target.value)))}
                      aria-label={`Points for ${st.en}`}
                      className={`${numCls} w-[80px]`}
                    />
                  </span>
                  <span role="cell" className="text-xs">
                    {st.den}
                  </span>
                </div>
              ))}
              <div role="row" className="grid items-center gap-2.5 py-2" style={{ gridTemplateColumns: ST_COLS }}>
                <span role="cell">
                  <span className="inline-block rounded-full bg-na-soft px-2 py-0.5 text-xs font-semibold text-na-fg">Not applicable</span>
                </span>
                <span role="cell" lang="ar" dir="rtl" className="text-left">
                  لا ينطبق
                </span>
                <span role="cell" className="font-mono text-xs">
                  —
                </span>
                <span role="cell" className="text-xs">
                  Per N/A rule
                </span>
              </div>
            </div>
            {!editablePoints && !locked && <div className="text-xs text-muted">This method uses a fixed point scale.</div>}
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
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3 text-[13px]">
              {(["high", "med", "low"] as const).map((w) => (
                <label key={w} className="flex flex-col gap-1 font-semibold">
                  Weight · {w === "med" ? "medium" : w}
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={num(s.weights[w])}
                    disabled={locked}
                    onChange={(e) => edit((d) => void (d.weights[w] = e.target.value === "" ? NaN : Number(e.target.value)))}
                    className={numCls}
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1 font-semibold">
                Rounding
                <select value={s.rounding} disabled={locked} onChange={(e) => edit((d) => void (d.rounding = Number(e.target.value) as 0 | 1 | 2))} className={selectCls}>
                  <option value={1}>1 decimal, half up</option>
                  <option value={2}>2 decimals</option>
                  <option value={0}>Whole number</option>
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
                  If a <b>mandatory criterion</b> is <b>Not satisfied</b>, cap the requirement at
                </span>
                <select
                  aria-label="Blocking cap"
                  value={s.blockingCap}
                  disabled={locked}
                  onChange={(e) => edit((d) => void (d.blockingCap = e.target.value as BlockingCap))}
                  className="h-10 rounded-lg border border-field bg-white px-2 text-[13px] font-semibold disabled:bg-surface-2"
                >
                  {CAP_OPTS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
                {slotV.live && slotV.draft && slotV.live.blockingCap !== s.blockingCap && (
                  <span className="ml-auto text-xs font-semibold text-warn">
                    changed in v{s.version}: was &ldquo;{CAP_OPTS.find(([k]) => k === slotV.live!.blockingCap)?.[1]}&rdquo;
                  </span>
                )}
              </div>
              <fieldset className="m-0 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border border-line p-3">
                <legend className="px-1 font-semibold">Not applicable treatment</legend>
                {NA_OPTS.map(([k, label]) => (
                  <label key={k} className="flex min-h-10 items-center gap-2">
                    <input type="radio" name="na" checked={s.naTreatment === k} disabled={locked} onChange={() => edit((d) => void (d.naTreatment = k))} className="h-[18px] w-[18px] accent-brand" />
                    {label}
                  </label>
                ))}
              </fieldset>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2">
                <NumField label="Green from" value={s.green} border="2px solid #2E8B6A" disabled={locked} onChange={(v) => edit((d) => void (d.green = v))} />
                <NumField label="Amber from" value={s.amber} border="2px solid #D08A1C" disabled={locked} onChange={(v) => edit((d) => void (d.amber = v))} />
                <NumField label="Target score" value={s.target} disabled={locked} onChange={(v) => edit((d) => void (d.target = v))} />
                <NumField label="Override 2nd approval at Δ" value={s.overrideDelta} disabled={locked} onChange={(v) => edit((d) => void (d.overrideDelta = v))} />
              </div>
            </div>
          </Card>
        </div>

        <aside className="flex min-w-0 flex-[1_1_340px] flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-[14px] border-2 border-[#3F6FB5] bg-white p-[18px]">
            <div className="text-[11px] font-bold tracking-[0.08em] text-[#2F5893]">PREVIEW AGAINST SAMPLE DATA · READ-ONLY</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-[10px] bg-surface-2 p-2.5">
                <div className="text-xs text-muted">{slotV.live ? `v${slotV.live.version} (live)` : "no live version"}</div>
                <div className="text-2xl font-bold">{liveScore ? `${liveScore.pct}%` : "—"}</div>
              </div>
              <div className="rounded-[10px] bg-[#EEF3FA] p-2.5">
                <div className="text-xs text-[#2F5893]">{slotV.draft ? `v${slotV.draft.version} (draft)` : "no draft"}</div>
                <div className="text-2xl font-bold">{cmp ? `${cmp.after.pct}%` : "—"}</div>
              </div>
            </div>
            {cmp ? (
              <>
                <div className="text-[13px] leading-5">
                  <b>{cmp.changedRequirements.length} requirements</b> change result ·{" "}
                  <b>{cmp.domains.filter((d) => d.before !== d.after).length} domain scores</b> move.
                </div>
                <div className="flex flex-col gap-1.5 font-mono text-xs">
                  {cmp.domains.map((d) => (
                    <div key={d.domain} className="flex justify-between" style={{ color: d.before === d.after ? "#56625C" : "#14211C" }}>
                      <span>{d.domain}</span>
                      <span>{d.before === d.after ? "no change" : `${d.before} → ${d.after}`}</span>
                    </div>
                  ))}
                </div>
                <Button size="md" onClick={() => setShowChanged(!showChanged)}>
                  {showChanged ? "Hide" : "See"} the {cmp.changedRequirements.length} requirements
                </Button>
                {showChanged && <div className="max-h-40 overflow-y-auto font-mono text-xs leading-5 text-ink-2">{cmp.changedRequirements.join(" · ")}</div>}
              </>
            ) : (
              <div className="text-[13px] text-muted">Create a draft to preview its effect on the sample cycle.</div>
            )}
            <div className="border-t border-line-soft pt-2.5 text-xs leading-[18px] text-muted">
              {SAMPLE_REQUIREMENTS.length} dummy requirements. Accepted results keep the live version until re-accepted; history is never recalculated.
            </div>
          </section>
          <Card className="flex flex-col gap-2 p-[18px]">
            <h2 className="m-0 text-[15px] font-semibold">Validation</h2>
            <Checks checks={checks} />
            {slotV.draft && <div className="text-[13px] text-warn">! Changes official results: four-eyes approval required</div>}
          </Card>
        </aside>
      </main>
    </>
  );
}

function NumField({ label, value, border, disabled, onChange }: { label: string; value: number; border?: string; disabled?: boolean; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold">
      {label}
      <input
        type="number"
        value={num(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        className={numCls}
        style={{ border: border ?? "1px solid #CBD3CE" }}
      />
    </label>
  );
}
