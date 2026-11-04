"use client";

import { useMemo, useState } from "react";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Field, inputClass, JButton, PageHead, Panel, PanelHead, Pill, Segmented } from "@/components/journey/ui";
import { ClosedBanner, fmtDate, Row, StageBadge, Table, useToast } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { PHASES } from "@/lib/cycle/model";
import { useCycle, type CycleControl } from "@/lib/cycle/use-cycle";
import { addDays, daysBetween, TODAY } from "@/lib/workspace/data";

const KEEP = "";
const ALL = "all";

export default function PlanPage() {
  const cy = useCycle();
  const { controls, summary, cycle, closed } = cy;
  const { say, toast } = useToast();
  const [tab, setTab] = useState<"update" | "setup" | "history">("update");
  const live = controls.filter((c) => c.applicable);

  return (
    <ClientShell search="Search controls">
      <JMain>
        <PageHead eyebrow={`Submission plan · active since ${summary.dates.opening}`} title="Plan">
          <JButton variant="primary" disabled={closed} onClick={() => setTab("update")}>
            Update plan
          </JButton>
        </PageHead>
        <p className="m-0 -mt-2 text-sm text-j-ink-3">
          {live.length} applicable controls · {controls.length - live.length} not applicable · internal closing {summary.dates.internalClosing}
        </p>
        <ClosedBanner show={closed} />
        <Segmented
          label="Plan sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: "update", label: "Update active plan" },
            { value: "setup", label: "Set-up" },
            { value: "history", label: `Change history · ${cycle.history.length}` },
          ]}
        />
        {tab === "update" && <UpdatePlan cy={cy} say={say} />}
        {tab === "setup" && <SetUp cy={cy} say={say} />}
        {tab === "history" && <History cy={cy} />}
      </JMain>
      {toast}
    </ClientShell>
  );
}

type Cy = ReturnType<typeof useCycle>;

function UpdatePlan({ cy, say }: { cy: Cy; say: (t: string) => void }) {
  const { controls, owners, closed, summary } = cy;
  const [step, setStep] = useState(1);
  const [dim, setDim] = useState(ALL);
  const [dom, setDom] = useState(ALL);
  const [dept, setDept] = useState(ALL);
  const [sel, setSel] = useState<string[]>([]);
  const [due, setDue] = useState("");
  const [owner, setOwner] = useState(KEEP);
  const [department, setDepartment] = useState(KEEP);
  const [na, setNa] = useState(false);
  const [proof, setProof] = useState("");
  const [instruction, setInstruction] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [notifyOwner, setNotifyOwner] = useState(true);
  const [notifyViewers, setNotifyViewers] = useState(false);

  const live = controls.filter((c) => c.applicable);
  const dims = [...new Map(live.map((c) => [c.dimension, c.dimensionName])).entries()];
  const doms = [...new Map(live.filter((c) => dim === ALL || c.dimension === dim).map((c) => [c.domain, c.domainName])).entries()];
  const depts = [...new Set(live.map((c) => c.department).filter(Boolean))].sort();
  const rows = live.filter((c) => (dim === ALL || c.dimension === dim) && (dom === ALL || c.domain === dom) && (dept === ALL || c.department === dept));
  const chosen = live.filter((c) => sel.includes(c.code));
  const firstOwner = chosen[0]?.owner ?? "";
  const firstDept = chosen[0]?.department ?? "";

  const impact = useMemo(() => impactOf(chosen, controls, due, owner || firstOwner, summary.dates.internalClosing), [chosen, controls, due, owner, firstOwner, summary.dates.internalClosing]);
  const changes = [due && `deadline → ${due}`, owner && `owner → ${owner}`, department && `department → ${department}`, na && "not applicable", instruction.trim() && "instruction updated"].filter(Boolean) as string[];
  const recipients = [...new Set(chosen.flatMap((c) => [c.owner, owner].filter(Boolean)))];

  const reset = () => {
    setStep(1);
    setSel([]);
    setDue("");
    setOwner(KEEP);
    setDepartment(KEEP);
    setNa(false);
    setProof("");
    setInstruction("");
    setReason("");
    setMessage("");
  };

  const confirm = () => {
    cy.updatePlan(sel, { due: due || undefined, owner: owner || undefined, department: department || undefined, na: na ? proof.trim() : undefined, instruction: instruction.trim() || undefined }, reason.trim(), (notifyOwner ? recipients.length : 0) + (notifyViewers ? 1 : 0));
    if (notifyOwner) for (const c of chosen) cy.followUp(c.code, owner || c.owner, message.trim(), due ? "Deadline" : "Instruction");
    say(`Plan updated for ${sel.length} control${sel.length === 1 ? "" : "s"}${notifyOwner && recipients.length ? ` · ${recipients.join(", ")} notified` : ""}`);
    reset();
  };

  return (
    <div className="flex flex-col gap-3.5">
      <ol className="m-0 flex list-none flex-wrap gap-2 p-0 text-[13px] font-semibold">
        {["Which controls are you changing?", "What changes?", "Reason and impact", "Notify and confirm"].map((t, i) => (
          <li key={t} className={cx("rounded-full px-3 py-1.5", step === i + 1 ? "bg-cx text-white" : step > i + 1 ? "bg-cx-soft text-cx" : "bg-j-canvas text-j-ink-3")}>
            {i + 1} · {t}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <Panel className="flex flex-col gap-3 py-[18px]">
          <div className="flex flex-wrap items-end gap-2.5 px-[22px]">
            <Field label="Dimension">
              <select value={dim} onChange={(e) => (setDim(e.target.value), setDom(ALL))} className={inputClass}>
                <option value={ALL}>All dimensions</option>
                {dims.map(([k, n]) => (
                  <option key={k} value={k}>
                    {k} {n}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Domain">
              <select value={dom} onChange={(e) => setDom(e.target.value)} className={inputClass}>
                <option value={ALL}>All domains</option>
                {doms.map(([k, n]) => (
                  <option key={k} value={k}>
                    {n.startsWith("Domain") ? n : `${k} ${n}`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <select value={dept} onChange={(e) => setDept(e.target.value)} className={inputClass}>
                <option value={ALL}>All departments</option>
                {depts.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <span className="flex-auto" />
            <JButton size="sm" variant="ghost" onClick={() => setSel(rows.map((c) => c.code))}>
              Select all {rows.length}
            </JButton>
          </div>
          <Table label="Controls" cols="40px 2.6fr 1fr 1.3fr 1.1fr 0.9fr" head={["", "Control", "Deadline", "Department", "Owner", "Status"]}>
            <div className="max-h-[440px] overflow-y-auto">
              {rows.map((c) => {
                const on = sel.includes(c.code);
                return (
                  <Row key={c.code} cols="40px 2.6fr 1fr 1.3fr 1.1fr 0.9fr" selected={on} onClick={() => setSel(on ? sel.filter((x) => x !== c.code) : [...sel, c.code])}>
                    <input type="checkbox" checked={on} readOnly aria-label={`Select ${c.code}`} />
                    <span>
                      <b className="font-mono text-xs">{c.code}</b> {c.title}
                    </span>
                    <span className={cx(c.due < TODAY && c.stage !== "accepted" && "font-semibold text-[#B2461F]")}>{c.due}</span>
                    <span>{c.department || "–"}</span>
                    <span>{c.owner || <i className="text-j-bad">Unassigned</i>}</span>
                    <StageBadge stage={c.stage} overdue={c.due < TODAY} />
                  </Row>
                );
              })}
            </div>
          </Table>
          <div className="flex items-center justify-between px-[22px]">
            <b className="text-sm">{sel.length} controls selected</b>
            <JButton variant="primary" disabled={!sel.length || closed} onClick={() => setStep(2)}>
              Next
            </JButton>
          </div>
        </Panel>
      )}

      {step === 2 && (
        <Panel className="flex flex-col gap-3.5 p-[22px]">
          <PanelHead title={`What changes for the ${sel.length} selected control${sel.length === 1 ? "" : "s"}?`} />
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
            <Field label="New deadline">
              <input type="date" value={due} min={TODAY} onChange={(e) => setDue(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Control Owner">
              <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass}>
                <option value={KEEP}>Keep {firstOwner || "current owner"}</option>
                {owners.filter((p) => p.name !== firstOwner).map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} · {p.department}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Owning department">
              <select value={department} onChange={(e) => setDepartment(e.target.value)} className={inputClass}>
                <option value={KEEP}>Keep {firstDept || "current department"}</option>
                {[...new Set(owners.map((p) => p.department).filter((d) => d && d !== firstDept))].map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 text-[13px] font-semibold">Applicability</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={!na} onChange={() => setNa(false)} /> Keep applicable
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={na} onChange={() => setNa(true)} /> Mark not applicable (proof needed)
            </label>
            {na && <input value={proof} onChange={(e) => setProof(e.target.value)} placeholder="Proof, e.g. Entity outside annex list – DGA letter 2026/114" className={inputClass} />}
          </fieldset>
          <Field label="Add or change an instruction (optional)">
            <textarea rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Attach this year's DR test report signed by the CIO." className="rounded-xl border border-j-line p-3 font-sans text-sm font-normal" />
          </Field>
          <div className="flex justify-between">
            <JButton onClick={() => setStep(1)}>Back</JButton>
            <JButton variant="primary" disabled={!changes.length || (na && !proof.trim())} onClick={() => setStep(3)}>
              Next
            </JButton>
          </div>
        </Panel>
      )}

      {step === 3 && (
        <Panel className="flex flex-col gap-3.5 p-[22px]">
          <PanelHead title="Reason and impact" />
          <Field label="Reason for the change">
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="DR test is scheduled for 2026-11-12; the report is issued 2 days later." className="rounded-xl border border-j-line p-3 font-sans text-sm font-normal" />
          </Field>
          <div className="flex flex-col gap-1.5 rounded-xl bg-j-canvas px-4 py-3 text-sm">
            <b>Impact check</b>
            {impact.lines.length ? impact.lines.map((l) => <span key={l} className={cx(l.startsWith("!") && "font-semibold text-[#8A4B00]")}>{l.replace(/^!/, "")}</span>) : <span className="text-j-ink-3">No deadline change, so no knock-on effects.</span>}
          </div>
          <div className="flex justify-between">
            <JButton onClick={() => setStep(2)}>Back</JButton>
            <JButton
              variant="primary"
              disabled={!reason.trim()}
              onClick={() => {
                setMessage(
                  due
                    ? `Your deadline for ${sel.join(" and ")} has moved to ${fmtDate(due)}. ${instruction.trim() || reason.trim()}`
                    : `${sel.join(" and ")}: ${changes.join(", ")}. ${instruction.trim() || reason.trim()}`,
                );
                setStep(4);
              }}
            >
              Next
            </JButton>
          </div>
        </Panel>
      )}

      {step === 4 && (
        <Panel className="flex flex-col gap-3.5 p-[22px]">
          <PanelHead title="Notify and confirm" />
          <p className="m-0 text-sm">
            <b>Summary:</b> {sel.join(", ")} · {changes.join(" · ")}
            {impact.domainMove?.map(([d]) => ` · domain ${d} deadline → ${due}`)}.
          </p>
          <Field label="Message to owners">
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} className="rounded-xl border border-j-line p-3 font-sans text-sm font-normal" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notifyOwner} onChange={(e) => setNotifyOwner(e.target.checked)} /> Notify {recipients.join(", ") || "the owners"} (Control Owner)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notifyViewers} onChange={(e) => setNotifyViewers(e.target.checked)} /> Notify Management Viewers
          </label>
          <div className="flex justify-between">
            <JButton onClick={() => setStep(3)}>Back</JButton>
            <JButton variant="primary" onClick={confirm}>
              Confirm and notify
            </JButton>
          </div>
        </Panel>
      )}
    </div>
  );
}

/** What a new deadline does to the domain, the closing date and the owner's load. */
function impactOf(chosen: CycleControl[], all: CycleControl[], due: string, owner: string, closing: string) {
  const lines: string[] = [];
  if (!due) return { lines, domainMove: undefined };
  const moves = new Map<string, string>();
  for (const c of chosen) {
    const domainDue = all.filter((x) => x.domain === c.domain && x.applicable).map((x) => x.due).sort().at(-1) ?? "";
    if (due > domainDue) moves.set(c.domain, domainDue);
  }
  const domainMove: [string, string][] = [...moves.entries()];
  for (const [d, old] of domainMove) lines.push(`!New deadline ${due} is after domain ${d}'s deadline (${old}). The domain deadline will move to ${due}.`);
  const gap = daysBetween(due, closing);
  lines.push(gap >= 0 ? `Still ${gap} days before the internal closing date.` : `!${-gap} days after the internal closing date (${closing}).`);
  if (owner) {
    const lo = addDays(due, -2);
    const n = all.filter((c) => c.owner === owner && c.stage !== "accepted" && ((c.due >= lo && c.due <= due) || chosen.includes(c))).length;
    lines.push(`${owner} will have ${n} control${n === 1 ? "" : "s"} due between ${lo} and ${due}.`);
  }
  return { lines, domainMove };
}

function SetUp({ cy, say }: { cy: Cy; say: (t: string) => void }) {
  const { summary, cycle, setCycle, controls, closed, entityMeta } = cy;
  const d = summary.dates;
  const phases = cycle.phases ?? [...PHASES];
  const flagged = controls.filter((c) => c.flaggedNa);
  const confirmed = controls.filter((c) => !c.applicable && cycle.plan[c.code]?.na);
  const [proof, setProof] = useState<Record<string, string>>({});
  const setDate = (k: keyof typeof d, v: string | number) => setCycle((s) => void (s.dates = { ...d, [k]: v }));

  return (
    <div className="flex flex-col gap-3.5">
      <Panel className="flex flex-col gap-3.5 p-[22px]">
        <PanelHead title="Cycle dates and phases" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          <Field label="Opening">
            <input type="date" disabled={closed} value={d.opening} onChange={(e) => setDate("opening", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Internal closing">
            <input type="date" disabled={closed} value={d.internalClosing} onChange={(e) => setDate("internalClosing", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Submission to regulator">
            <input type="date" disabled={closed} value={d.submission} onChange={(e) => setDate("submission", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Target compliance rate">
            <input type="number" min={0} max={100} disabled={closed} value={d.target} onChange={(e) => setDate("target", Number(e.target.value))} className={inputClass} />
          </Field>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-semibold">
            Phases <span className="font-normal text-j-muted">· generic template, rename or remove per index</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {phases.map((p, i) => (
              <span key={i} className={cx("flex items-center gap-1 rounded-xl border px-2 py-1", i === summary.phase ? "border-cx bg-cx-tint" : "border-j-line")}>
                <span className="text-xs text-j-muted">{i + 1}</span>
                <input
                  aria-label={`Phase ${i + 1}`}
                  disabled={closed}
                  value={p}
                  onChange={(e) => setCycle((s) => void (s.phases = phases.map((x, j) => (j === i ? e.target.value : x))))}
                  className="w-[150px] border-0 bg-transparent text-sm outline-none"
                />
                {phases.length > 3 && !closed && (
                  <button type="button" aria-label={`Remove ${p}`} onClick={() => setCycle((s) => void (s.phases = phases.filter((_, j) => j !== i)))} className="cursor-pointer border-0 bg-transparent text-j-muted">
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      </Panel>

      <Panel className="flex flex-col gap-2 p-[22px]">
        <PanelHead title="Not applicable – from the standard" aside={<span className="text-xs text-j-muted">Entity annex list {entityMeta.annex}</span>} />
        {flagged.map((c) => (
          <div key={c.code} className="flex flex-wrap items-center gap-2.5 border-b border-j-line-soft py-2.5 text-sm last:border-0">
            <span className="min-w-[240px] flex-auto">
              <b className="font-mono text-xs">{c.code}</b> {c.title}
            </span>
            <input value={proof[c.code] ?? ""} onChange={(e) => setProof({ ...proof, [c.code]: e.target.value })} placeholder="Proof, e.g. Entity outside annex list" className={cx(inputClass, "h-9 min-w-[220px] flex-auto")} />
            <JButton
              size="sm"
              variant="primary"
              disabled={closed || !proof[c.code]?.trim()}
              onClick={() => {
                cy.updatePlan([c.code], { na: proof[c.code].trim() }, "Not applicable from the standard", 0);
                say(`${c.code} confirmed not applicable`);
              }}
            >
              Confirm N/A
            </JButton>
          </div>
        ))}
        {confirmed.map((c) => (
          <div key={c.code} className="flex flex-wrap items-center gap-2.5 border-b border-j-line-soft py-2.5 text-sm last:border-0">
            <span className="flex-auto">
              <b className="font-mono text-xs">{c.code}</b> {c.title} <span className="text-xs text-j-muted">· {cycle.plan[c.code]?.na?.reason}</span>
            </span>
            <Pill tone="ok">Confirmed</Pill>
            {!closed && (
              <JButton size="sm" variant="ghost" onClick={() => cy.updatePlan([c.code], { na: null }, "Applicable again", 0)}>
                Undo
              </JButton>
            )}
          </div>
        ))}
        {!flagged.length && !confirmed.length && <p className="m-0 text-sm text-j-muted">Every control in the standard applies to this entity.</p>}
      </Panel>
    </div>
  );
}

function History({ cy }: { cy: Cy }) {
  const { cycle } = cy;
  return (
    <Panel className="py-2">
      <Table label="Change history" cols="0.8fr 1fr 1.8fr 1.6fr 0.9fr 0.7fr" head={["When", "Controls", "Change", "Reason", "By", "Notified"]}>
        {cycle.history.map((h, i) => (
          <Row key={i} cols="0.8fr 1fr 1.8fr 1.6fr 0.9fr 0.7fr">
            <span>{h.at}</span>
            <span className="font-mono text-xs">{h.controls.join(", ")}</span>
            <span>{h.change}</span>
            <span className="text-j-ink-3">{h.reason}</span>
            <span>{h.by}</span>
            <span>{h.notified ? `${h.notified} ${h.notified === 1 ? "person" : "people"}` : "–"}</span>
          </Row>
        ))}
        {!cycle.history.length && <p className="m-0 px-[22px] py-4 text-sm text-j-muted">No changes since the plan went live.</p>}
      </Table>
    </Panel>
  );
}

