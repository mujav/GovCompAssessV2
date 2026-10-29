"use client";

import { useState } from "react";
import { Checks, DraftBar, LockNote } from "@/components/admin-ui";
import { PageHeader } from "@/components/workspace-shell";
import { Button } from "@/components/ui";
import { DEFAULT_RIGHTS } from "@/lib/admin/seed";
import { stamp, useAdmin, working } from "@/lib/admin/store";
import type { AcceptancePolicy, ReviewStage, StageMode } from "@/lib/admin/types";
import { SCENARIOS, simulate, validatePolicy, type StepTone } from "@/lib/engine/acceptance";

const TONE: Record<StepTone, [string, string]> = {
  ai: ["#EEEDFB", "#3F37A8"],
  neutral: ["#F7F8F6", "#14211C"],
  warn: ["#FBEFD9", "#6B3F05"],
  good: ["#E3F1EA", "#11603F"],
  bad: ["#FBE4E1", "#A3261B"],
};

const inputCls = "h-8 w-full min-w-0 rounded-md border border-field px-1.5 text-xs disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:text-ink";

export default function AcceptanceDesignerPage() {
  const { state, editDraft, update, user } = useAdmin();
  const [sel, setSel] = useState("AP-QIYAS-CRIT");
  const [scenario, setScenario] = useState(SCENARIOS[0].id);

  const slotV = state.policies.find((p) => p.id === sel) ?? state.policies[0];
  const { value: p, locked } = working(slotV);
  if (!p) return null;
  const edit = (fn: (d: AcceptancePolicy) => void) => editDraft<AcceptancePolicy>("acceptance", slotV.id, fn);
  const editStage = (id: string, patch: Partial<ReviewStage>) =>
    edit((d) => {
      const st = d.stages.find((x) => x.id === id);
      if (st) Object.assign(st, patch);
    });
  const checks = validatePolicy(p);
  const steps = simulate(p, SCENARIOS.find((s) => s.id === scenario) ?? SCENARIOS[0]);

  const newPolicy = () => {
    const id = `AP-NEW-${state.seq + 1}`;
    update((s) => {
      s.seq += 1;
      s.policies.push({
        id,
        draft: {
          code: id,
          version: 1,
          name: "New policy",
          scope: "Qiyas 2026 · [set scope]",
          rationaleRequired: true,
          materialOverrideEscalates: true,
          allowBulk: false,
          reopenOnEvidence: true,
          reopenOnClarification: true,
          reopenOnConfig: true,
          stages: [{ id: "st-1", mode: "final", name: "Reviewer", reviewers: "Pool: reviewers", minApprovals: 1, poolSize: 3, onReject: "Return to evidence owner", slaDays: 3, independence: "Not owner or submitter", rights: ["Accept", "Return"] }],
        },
      });
      s.audit.unshift({ id: `ev-${s.seq}`, at: stamp(), who: user.name, text: `Created acceptance policy draft ${id} v1.` });
    });
    setSel(id);
  };

  return (
    <>
      <PageHeader
        crumb="Admin Studio / Acceptance policies"
        title="Acceptance workflow designer"
        actions={<Button onClick={newPolicy}>New policy</Button>}
      />
      <main className="box-border flex w-full max-w-[1360px] flex-col gap-4 px-8 pb-12 pt-6">
        <section aria-label="Policies" className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-2.5">
          {state.policies.map((pol) => {
            const w = pol.draft ?? pol.live!;
            const status = pol.pendingCr ? ["IN REVIEW", "#E8ECF3", "#3E4B63"] : pol.draft ? ["DRAFT", "#FBEFD9", "#8A4B00"] : ["PUBLISHED", "#E3F1EA", "#11603F"];
            return (
              <button
                key={pol.id}
                type="button"
                onClick={() => setSel(pol.id)}
                aria-pressed={pol.id === slotV.id}
                className="flex cursor-pointer flex-col gap-1 rounded-xl bg-white px-3.5 py-3 text-left text-ink"
                style={{ border: pol.id === slotV.id ? "2px solid #0E5A45" : "1px solid #DCE2DE" }}
              >
                <span className="flex justify-between gap-2">
                  <b className="font-mono text-[13px]">
                    {pol.id} v{w.version}
                  </b>
                  <span className="rounded px-1.5 py-px text-[11px] font-bold" style={{ background: status[1], color: status[2] }}>
                    {status[0]}
                  </span>
                </span>
                <span className="text-[13px] font-semibold">{w.name}</span>
                <span className="text-xs text-muted">{w.scope}</span>
              </button>
            );
          })}
        </section>

        <div className="flex flex-wrap items-start gap-4">
          <section className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5 rounded-[14px] border border-line bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-[17px] font-semibold">
                {slotV.id} · v{p.version} {slotV.draft ? "draft" : "live"}
              </h2>
              <label className="flex items-center gap-2 text-xs text-muted">
                Scope
                <input value={p.scope} disabled={locked} onChange={(e) => edit((d) => void (d.scope = e.target.value))} className="h-8 w-64 rounded-md border border-field px-2 text-xs disabled:border-transparent disabled:bg-transparent" />
              </label>
            </div>
            <DraftBar kind="acceptance" id={slotV.id} checks={checks} />
            <LockNote kind="acceptance" id={slotV.id} />

            <div className="flex flex-wrap items-stretch gap-2">
              <div className="flex flex-none items-center rounded-[10px] bg-ai-soft px-3.5 py-2.5 text-[13px] font-semibold text-ai">
                AI assessment
                <br />
                recommendation only
              </div>
              {p.stages.map((s, i) => (
                <div key={s.id} className="flex min-w-0 flex-[1_1_220px] flex-col gap-2 rounded-xl border-2 bg-white p-3.5" style={{ borderColor: s.mode === "final" ? "#0A3F31" : "#0E5A45" }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold tracking-[0.08em] text-brand">STAGE {i + 1}</span>
                    <select
                      aria-label={`Stage ${i + 1} routing`}
                      value={s.mode}
                      disabled={locked}
                      onChange={(e) => editStage(s.id, { mode: e.target.value as StageMode })}
                      className="h-7 rounded border border-field bg-white px-1 text-[11px] text-ink-2 disabled:bg-transparent"
                    >
                      <option value="single">Single</option>
                      <option value="parallel">Parallel</option>
                      <option value="final">Final</option>
                    </select>
                  </div>
                  <input aria-label={`Stage ${i + 1} name`} value={s.name} disabled={locked} onChange={(e) => editStage(s.id, { name: e.target.value })} className={`${inputCls} text-sm font-bold`} />
                  <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-xs leading-[17px]">
                    <span className="text-muted">Reviewers</span>
                    <input aria-label={`Stage ${i + 1} reviewers`} value={s.reviewers} disabled={locked} onChange={(e) => editStage(s.id, { reviewers: e.target.value })} className={inputCls} />
                    <span className="text-muted">Approvals</span>
                    <span className="flex items-center gap-1">
                      <input type="number" min={1} aria-label={`Stage ${i + 1} approvals required`} value={s.minApprovals} disabled={locked} onChange={(e) => editStage(s.id, { minApprovals: Number(e.target.value) })} className={`${inputCls} w-12`} />
                      of
                      <input type="number" min={1} aria-label={`Stage ${i + 1} reviewer pool size`} value={s.poolSize} disabled={locked} onChange={(e) => editStage(s.id, { poolSize: Number(e.target.value) })} className={`${inputCls} w-12`} />
                    </span>
                    <span className="text-muted">On reject</span>
                    <input aria-label={`Stage ${i + 1} on reject`} value={s.onReject} disabled={locked} onChange={(e) => editStage(s.id, { onReject: e.target.value })} className={inputCls} />
                    <span className="text-muted">SLA (days)</span>
                    <input type="number" min={1} aria-label={`Stage ${i + 1} SLA days`} value={s.slaDays} disabled={locked} onChange={(e) => editStage(s.id, { slaDays: Number(e.target.value) })} className={`${inputCls} w-14`} />
                    <span className="text-muted">Independent</span>
                    <input aria-label={`Stage ${i + 1} independence rule`} value={s.independence} placeholder="e.g. Not stage 1" disabled={locked} onChange={(e) => editStage(s.id, { independence: e.target.value })} className={inputCls} />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {DEFAULT_RIGHTS.map((r) => {
                      const on = s.rights.includes(r);
                      if (locked && !on) return null;
                      return (
                        <button
                          key={r}
                          type="button"
                          aria-pressed={on}
                          disabled={locked}
                          onClick={() => editStage(s.id, { rights: on ? s.rights.filter((x) => x !== r) : [...s.rights, r] })}
                          className="cursor-pointer rounded px-1.5 py-0.5 text-[11px] disabled:cursor-default"
                          style={on ? { background: "#F1F4F2", color: "#33403A" } : { background: "transparent", color: "#8A958F", border: "1px dashed #CBD3CE" }}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                  {!locked && (
                    <div className="mt-auto flex gap-1 pt-1">
                      <Button size="sm" disabled={i === 0} onClick={() => edit((d) => void d.stages.splice(i - 1, 0, ...d.stages.splice(i, 1)))} aria-label={`Move stage ${i + 1} earlier`}>
                        ←
                      </Button>
                      <Button size="sm" disabled={i === p.stages.length - 1} onClick={() => edit((d) => void d.stages.splice(i + 1, 0, ...d.stages.splice(i, 1)))} aria-label={`Move stage ${i + 1} later`}>
                        →
                      </Button>
                      <Button size="sm" className="ml-auto text-bad hover:text-bad" onClick={() => edit((d) => void (d.stages = d.stages.filter((x) => x.id !== s.id)))}>
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                disabled={locked}
                onClick={() =>
                  edit((d) => {
                    const at = Math.max(0, d.stages.findIndex((x) => x.mode === "final"));
                    const insertAt = d.stages.length && d.stages.at(-1)!.mode === "final" ? at : d.stages.length;
                    d.stages.splice(insertAt, 0, { id: `st-${Date.now()}`, mode: "single", name: "New stage", reviewers: "Role: reviewer", minApprovals: 1, poolSize: 1, onReject: "Back to previous stage", slaDays: 3, independence: "Not an earlier reviewer", rights: ["Approve", "Return"] });
                  })
                }
                className="min-w-[120px] flex-none cursor-pointer rounded-xl border border-dashed border-[#7D8C85] bg-white text-[13px] text-ink-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                + Add stage
              </button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3 text-[13px]">
              <fieldset className="m-0 flex flex-col gap-1.5 rounded-[10px] border border-line p-3">
                <legend className="px-1 font-semibold">Override governance</legend>
                <Toggle label="Rationale and reason code required" checked={p.rationaleRequired} disabled={locked} onChange={(v) => edit((d) => void (d.rationaleRequired = v))} />
                <Toggle label="Material override adds senior approval" checked={p.materialOverrideEscalates} disabled={locked} onChange={(v) => edit((d) => void (d.materialOverrideEscalates = v))} />
                <Toggle label="Allow bulk approval" checked={p.allowBulk} disabled={locked} onChange={(v) => edit((d) => void (d.allowBulk = v))} />
              </fieldset>
              <fieldset className="m-0 flex flex-col gap-1.5 rounded-[10px] border border-line p-3">
                <legend className="px-1 font-semibold">Reopen when</legend>
                <Toggle label="New or replaced evidence" checked={p.reopenOnEvidence} disabled={locked} onChange={(v) => edit((d) => void (d.reopenOnEvidence = v))} />
                <Toggle label="Authority clarification applied" checked={p.reopenOnClarification} disabled={locked} onChange={(v) => edit((d) => void (d.reopenOnClarification = v))} />
                <Toggle label="Material configuration change" checked={p.reopenOnConfig} disabled={locked} onChange={(v) => edit((d) => void (d.reopenOnConfig = v))} />
              </fieldset>
              <fieldset className="m-0 flex flex-col gap-1.5 rounded-[10px] border border-line p-3">
                <legend className="px-1 font-semibold">Finalization</legend>
                <div className="leading-5">
                  Result becomes official, scored and submittable when <b>stage {p.stages.length || "—"} approves</b> and no blocking rejection exists.
                </div>
                <div className="leading-5 text-muted">Delegation allowed for absence; delegate identity is recorded.</div>
              </fieldset>
            </div>
          </section>

          <aside className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 rounded-[14px] border-2 border-[#3F6FB5] bg-white p-[18px]">
            <div className="text-[11px] font-bold tracking-[0.08em] text-[#2F5893]">SIMULATE</div>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Sample record
              <select value={scenario} onChange={(e) => setScenario(e.target.value)} className="h-11 rounded-lg border border-field bg-white px-2.5 text-sm font-normal">
                {SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[13px] leading-[19px]">
              {steps.map((st, i) => (
                <li key={i} className="rounded-lg px-2.5 py-2" style={{ background: TONE[st.tone][0], color: TONE[st.tone][1] }}>
                  {st.text}
                </li>
              ))}
            </ol>
            <div className="border-t border-line-soft pt-2.5">
              <div className="mb-1.5 text-[13px] font-semibold">Checks</div>
              <Checks checks={checks} />
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}

function Toggle({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-8 items-center gap-2">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-[18px] w-[18px] accent-brand" />
      {label}
    </label>
  );
}
