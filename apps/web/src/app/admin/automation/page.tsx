"use client";

import { useState } from "react";
import { Checks, DraftBar, LockNote } from "@/components/admin-ui";
import { PageHeader } from "@/components/workspace-shell";
import { Button, Eyebrow } from "@/components/ui";
import { DEMO_TODAY, SAMPLE_ACTIONS } from "@/lib/admin/sample-data";
import { stamp, useAdmin, working } from "@/lib/admin/store";
import type { AutomationRule, RuleField, RuleOp } from "@/lib/admin/types";
import { RULE_FIELDS, daysOverdue, testRule, validateRule } from "@/lib/engine/rules";

const TRIGGERS = ["Daily schedule", "Status changed", "Due date approaching", "SLA breached", "Clarification received", "Evidence uploaded"];

const ACTION_CATALOG = [
  "Create escalation recommendation with history pack → assign to Assessment Manager",
  "Flag requirement red on dashboards",
  "Flag requirement amber",
  "In-app alert to department SPOC",
  "Recommend reminder to owner",
  "Create review task",
  "Flag affected requirements for re-review",
  "Log interaction",
];

const HIT_COLS = "0.8fr 1.8fr 1.1fr 0.7fr 0.7fr 0.8fr";
const ctl = "h-9 rounded-md border border-field bg-white px-2 text-[13px] disabled:bg-surface-2";

export default function AutomationStudioPage() {
  const { state, editDraft, update, user } = useAdmin();
  const [sel, setSel] = useState("ESC-02");
  const [showNear, setShowNear] = useState(false);

  const slotV = state.rules.find((r) => r.id === sel) ?? state.rules[0];
  const { value: rule, locked } = working(slotV);
  if (!rule) return null;
  const edit = (fn: (d: AutomationRule) => void) => editDraft<AutomationRule>("rule", slotV.id, fn);
  const checks = validateRule(rule);
  const result = testRule(rule, SAMPLE_ACTIONS, DEMO_TODAY);
  const liveMatches = slotV.live && slotV.draft ? testRule(slotV.live, SAMPLE_ACTIONS, DEMO_TODAY).matches.length : null;

  const newRule = () => {
    const id = `RUL-${state.seq + 1}`;
    update((s) => {
      s.seq += 1;
      s.rules.push({
        id,
        draft: { code: id, version: 1, name: "New rule", summary: "Draft", trigger: "Daily schedule", time: "07:00", conditions: [{ id: "c1", field: "work_status", op: "=", value: "No update" }], actions: ["Create review task"] },
      });
      s.audit.unshift({ id: `ev-${s.seq}`, at: stamp(), who: user.name, text: `Created rule draft ${id} v1.` });
    });
    setSel(id);
  };

  return (
    <>
      <PageHeader crumb="Admin Studio / Rules & automation" title="Rule & automation studio" actions={<Button onClick={newRule}>New rule</Button>} />
      <main className="box-border flex w-full max-w-[1360px] flex-wrap items-start gap-4 px-8 pb-12 pt-6">
        <section aria-label="Rules" className="min-w-0 flex-[1_1_300px] overflow-hidden rounded-[14px] border border-line bg-white">
          {state.rules.map((r) => {
            const w = r.draft ?? r.live!;
            const on = r.id === slotV.id;
            const status = r.pendingCr ? [`In review v${w.version}`, "#3E4B63"] : r.draft ? [`Draft v${w.version}`, "#8A4B00"] : [`Live v${w.version}`, "#11603F"];
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSel(r.id)}
                aria-pressed={on}
                className="flex w-full cursor-pointer flex-col gap-[3px] border-0 border-b border-l-[3px] border-b-line-soft px-3.5 py-3 text-left text-ink"
                style={{ background: on ? "#F2F8F5" : "#FFFFFF", borderLeftColor: on ? "#0E5A45" : "transparent" }}
              >
                <span className="flex justify-between gap-2">
                  <b className="font-mono text-xs">{r.id}</b>
                  <span className="text-[11px] font-semibold" style={{ color: status[1] }}>
                    {status[0]}
                  </span>
                </span>
                <span className="text-[13px] font-semibold">{w.name}</span>
                <span className="text-xs text-muted">{w.summary}</span>
              </button>
            );
          })}
        </section>

        <section className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">
          <div className="flex flex-col gap-3.5 rounded-[14px] border border-line bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <b className="font-mono text-[15px]">{slotV.id} ·</b>
                <span className="sr-only">Rule name</span>
                <input value={rule.name} disabled={locked} onChange={(e) => edit((d) => void (d.name = e.target.value))} className="h-10 min-w-0 flex-1 rounded-lg border border-field px-2.5 text-[15px] font-semibold disabled:border-transparent disabled:bg-transparent disabled:px-0 disabled:text-ink" />
              </label>
            </div>
            <DraftBar kind="rule" id={slotV.id} checks={checks} />
            <LockNote kind="rule" id={slotV.id} />

            <div className="flex flex-col gap-1.5">
              <Eyebrow className="font-bold text-muted">WHEN</Eyebrow>
              <div className="flex flex-wrap items-center gap-2 text-[13px]">
                <select aria-label="Trigger" value={rule.trigger} disabled={locked} onChange={(e) => edit((d) => void (d.trigger = e.target.value))} className="h-11 rounded-lg border border-field bg-white px-2.5 text-sm disabled:bg-surface-2">
                  {TRIGGERS.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <span>at</span>
                <input type="time" value={rule.time} aria-label="Time" disabled={locked} onChange={(e) => edit((d) => void (d.time = e.target.value))} className="h-11 w-28 rounded-lg border border-field px-2.5 font-mono text-sm disabled:bg-surface-2" />
                <span className="text-muted">Asia/Riyadh · working days (Sun–Thu)</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Eyebrow className="font-bold text-muted">IF ALL OF</Eyebrow>
              {rule.conditions.map((c, i) => {
                const meta = RULE_FIELDS.find((f) => f.field === c.field)!;
                const isNew = slotV.live && slotV.draft && !slotV.live.conditions.some((x) => x.field === c.field && x.op === c.op && x.value === c.value);
                return (
                  <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-surface-2 p-2 text-[13px]">
                    <select
                      aria-label={`Condition ${i + 1} field`}
                      value={c.field}
                      disabled={locked}
                      onChange={(e) =>
                        edit((d) => {
                          const cc = d.conditions[i];
                          cc.field = e.target.value as RuleField;
                          const ops = RULE_FIELDS.find((f) => f.field === cc.field)!.ops;
                          if (!ops.includes(cc.op)) cc.op = ops[0];
                        })
                      }
                      className={`${ctl} font-mono text-xs`}
                    >
                      {RULE_FIELDS.map((f) => (
                        <option key={f.field} value={f.field}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <select aria-label={`Condition ${i + 1} operator`} value={c.op} disabled={locked} onChange={(e) => edit((d) => void (d.conditions[i].op = e.target.value as RuleOp))} className={`${ctl} font-mono font-semibold`}>
                      {meta.ops.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                    <input
                      aria-label={`Condition ${i + 1} value`}
                      value={c.value}
                      disabled={locked}
                      placeholder={c.field === "due_date" ? "today, today-7, 2026-11-01" : c.op === "in" ? "comma, separated" : ""}
                      onChange={(e) => edit((d) => void (d.conditions[i].value = e.target.value))}
                      className={`${ctl} min-w-40 flex-1`}
                    />
                    {isNew && <span className="text-xs font-semibold text-warn">new in v{rule.version}</span>}
                    {!locked && (
                      <button type="button" aria-label={`Remove condition ${i + 1}`} onClick={() => edit((d) => void d.conditions.splice(i, 1))} className="h-9 w-9 cursor-pointer rounded-md border border-field bg-white text-muted">
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              {!locked && (
                <button
                  type="button"
                  onClick={() => edit((d) => void d.conditions.push({ id: `c-${Date.now()}`, field: "priority", op: "in", value: "High, Critical" }))}
                  className="h-9 cursor-pointer self-start rounded-lg border border-dashed border-[#7D8C85] bg-white px-2.5 text-xs text-ink-2"
                >
                  + Condition
                </button>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Eyebrow className="font-bold text-muted">THEN</Eyebrow>
              <div className="flex flex-col gap-1.5 text-[13px]">
                {rule.actions.map((a, i) => (
                  <div key={a} className="flex items-center justify-between gap-2 rounded-[10px] border border-line px-3 py-2.5">
                    {a}
                    {!locked && (
                      <button type="button" aria-label={`Remove action ${a}`} onClick={() => edit((d) => void d.actions.splice(i, 1))} className="h-8 w-8 flex-none cursor-pointer rounded-md border border-field bg-white text-muted">
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {!locked && (
                  <select
                    aria-label="Add action"
                    value=""
                    onChange={(e) => e.target.value && edit((d) => void d.actions.push(e.target.value))}
                    className="h-10 self-start rounded-lg border border-dashed border-[#7D8C85] bg-white px-2 text-xs text-ink-2"
                  >
                    <option value="">+ Action from catalog…</option>
                    {ACTION_CATALOG.filter((a) => !rule.actions.includes(a)).map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                )}
                <div className="flex flex-wrap justify-between gap-2 rounded-[10px] bg-nav px-3 py-2.5 text-[#E4ECE8]">
                  <span>
                    <b>Locked:</b> external communication requires authorized approval
                  </span>
                  <span className="text-xs text-[#8FD3B5]">platform guardrail · cannot be turned off</span>
                </div>
              </div>
            </div>
            <Checks checks={checks} />
          </div>

          <div className="flex flex-col gap-2.5 rounded-[14px] border-2 border-[#3F6FB5] bg-white px-5 py-[18px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[11px] font-bold tracking-[0.08em] text-[#2F5893]">TEST AGAINST SAMPLE RECORDS · {DEMO_TODAY}</div>
              <button type="button" onClick={() => setShowNear(!showNear)} className="h-10 cursor-pointer rounded-lg border border-[#3F6FB5] bg-white px-3 text-[13px] font-semibold text-[#2F5893]">
                {showNear ? "Show matches" : "Show near misses"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2 text-[13px]">
              <span className="rounded-lg bg-bad-soft px-2.5 py-1.5 text-bad">
                <b>{result.matches.length}</b> would match
              </span>
              <span className="rounded-lg bg-surface-2 px-2.5 py-1.5">
                <b>{result.nearMisses.length}</b> near misses (fail one condition)
              </span>
              {liveMatches != null && (
                <span className="rounded-lg bg-surface-2 px-2.5 py-1.5">
                  live v{slotV.live!.version} matches <b>{liveMatches}</b>
                </span>
              )}
              <span className="rounded-lg bg-surface-2 px-2.5 py-1.5">{SAMPLE_ACTIONS.length} sample actions</span>
            </div>
            <div role="table" aria-label="Test results" className="text-xs">
              <div role="row" className="grid gap-2 border-b border-line py-1.5 font-semibold text-muted" style={{ gridTemplateColumns: HIT_COLS }}>
                {["Action", "Requirement", "Department", "Overdue", "Reminders", showNear ? "Fails" : "Priority"].map((h) => (
                  <span role="columnheader" key={h}>
                    {h}
                  </span>
                ))}
              </div>
              {(showNear ? result.nearMisses.map((n) => ({ r: n.record, extra: `${n.failed.field} ${n.failed.op} ${n.failed.value}` })) : result.matches.map((r) => ({ r, extra: r.priority }))).map(({ r, extra }) => (
                <div role="row" key={r.id} className="grid gap-2 border-b border-line-soft py-1.5 font-mono" style={{ gridTemplateColumns: HIT_COLS }}>
                  <span role="cell">{r.id}</span>
                  <span role="cell" className="font-sans">
                    {r.requirement}
                  </span>
                  <span role="cell" className="font-sans">
                    {r.department}
                  </span>
                  <span role="cell">{daysOverdue(r, DEMO_TODAY)} d</span>
                  <span role="cell">{r.reminders_sent}</span>
                  <span role="cell" className="font-sans">
                    {extra}
                  </span>
                </div>
              ))}
              {(showNear ? result.nearMisses : result.matches).length === 0 && <div className="py-3 text-muted">No records.</div>}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
