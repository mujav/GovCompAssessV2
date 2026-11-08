"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Field, inputClass, JButton, Panel, PanelHead, Pill, Segmented } from "@/components/journey/ui";
import { Kpi, Modal, Row, Table, useToast } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { useJourney } from "@/lib/journey/store";
import { clientHref } from "@/lib/journey/portfolio";
import { newWorkplaceId, duplicateOf } from "@/lib/journey/workplaces";
import { cycleKey, seededCycle, useCycle, type Closure, type CycleState } from "@/lib/cycle/use-cycle";
import { isClosed, phaseDue } from "@/lib/cycle/periods";
import { PRIOR_CYCLE, TODAY } from "@/lib/workspace/data";

// Cycle closure, one cycle at a time: record the submission to the governing body, then its
// official results, then close. Closing a cycle that is not the year's last reopens the controls
// rated partial or non-compliant for the next cycle; closing the last one closes the year and
// creates next year's workspace.

export default function ClosurePage() {
  const cy = useCycle();
  const { client, setCycle, controls, closed, framework, workplace, me, periods, period, setPeriods } = cy;
  const { workplaces, saveWorkplace, update } = useJourney();
  const { say, toast } = useToast();
  const active = periods.indexOf(period);
  // Follows the cycle in progress until someone picks another (saved work loads after the first render).
  const [picked, setView] = useState<number | null>(null);
  const view = picked ?? active;
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState("");
  const [sentOn, setSentOn] = useState(TODAY);
  const p = periods[view] ?? period;
  // Only the cycle in progress can be changed; earlier ones are on record, later ones not started.
  const locked = closed || view !== active || isClosed(p);
  const last = view === periods.length - 1;
  const nextCycle = periods[view + 1];
  const closure: Closure = p.closure ?? { controls: [] };
  const applicable = controls.filter((c) => c.applicable);
  const before = periods[view - 1]?.closure?.score ?? (view === 0 && client.id === client.entityId && client.frameworkId === "fw-qiyas" ? PRIOR_CYCLE.at(-1)! : undefined);
  const authority = framework?.authority ?? "Governing body";
  const set = (fn: (c: Closure) => void) => setPeriods((ps) => void fn((ps[view].closure ??= { controls: [] })));
  const partial = closure.controls.filter((x) => x.status === "Partial").length;
  const non = closure.controls.filter((x) => x.status === "Non").length;
  // "Qiyas" from "Qiyas 2026": the year is shown on its own.
  const index = (client.frameworks[0] ?? "index").replace(/\s*\b(19|20)\d{2}\b/, "");
  const multi = periods.length > 1;
  const what = multi ? `${p.name} of ${index} ${client.year}` : `${index} ${client.year}`;
  const nextYear = workplace ? duplicateOf(workplaces, workplace.entityId, workplace.frameworkId, workplace.year + 1) : undefined;

  /** Requirements the governing body found not met: the labels it listed (R2, R3), else every applicable one. */
  const notMetCodes = (code: string, text: string) => {
    const c = controls.find((k) => k.code === code);
    if (!c) return [];
    const said = text.split(/[,،;\s]+/).filter(Boolean);
    const hit = c.reqs.filter((r) => said.includes(cy.reqLabel(r.code)) || said.includes(r.code));
    return (hit.length ? hit : c.reqs.filter((r) => r.status !== "na")).map((r) => r.code);
  };

  const recordSubmission = () => {
    setPeriods((ps) => void (ps[view].submittedAt = sentOn));
    cy.audit("Cycle", `Recorded the submission of ${what} to ${authority}`, { after: sentOn });
    say(`${what} submitted to ${authority} on ${sentOn}`);
  };

  /** Closes this cycle and opens the next: controls not rated fully compliant go back to their owners with the feedback. */
  const closeCycle = () => {
    const at = new Date().toISOString();
    for (const x of closure.controls) {
      const rating = x.status === "Partial" ? "partially compliant" : "non-compliant";
      const note = `${p.name}: rated ${rating} by ${authority}.${x.feedback ? ` ${x.feedback}` : ""}`;
      const codes = notMetCodes(x.code, x.notMet);
      cy.returnControl(x.code, Object.fromEntries(codes.map((k) => [k, note])), `Reopened for ${nextCycle!.name}: ${authority} rated ${x.code} ${rating} in ${p.name}.${x.feedback ? ` ${x.feedback}` : ""}`, []);
    }
    // Reopened controls are due by the next cycle's internal review.
    if (closure.controls.length) cy.updatePlan(closure.controls.map((x) => x.code), { due: phaseDue(nextCycle!, "internal") }, `Reopened for ${nextCycle!.name}`, closure.controls.length);
    setCycle((d) => {
      for (const x of closure.controls) (d.plan[x.code] ??= {}).instruction = `Priority for ${nextCycle!.name}: rated ${x.status === "Partial" ? "partially compliant" : "non-compliant"} by ${authority} in ${p.name}. ${x.feedback}`.trim();
    });
    setPeriods((ps) => {
      Object.assign((ps[view].closure ??= { controls: [] }), { closedAt: at, by: me });
    });
    cy.audit("Cycle", `Closed ${what} with official score ${closure.score ?? "–"}%`, { after: `${partial} partial · ${non} non-compliant reopened for ${nextCycle!.name}` });
    setConfirming(false);
    setView(null);
    say(`${p.name} closed · ${nextCycle!.name} open with ${partial + non} control${partial + non === 1 ? "" : "s"} reopened`);
  };

  /** Closes the year's last cycle: the workspace becomes read-only and next year's is created with this year's priorities. */
  const closeYear = () => {
    if (!workplace) return;
    const closedAt = new Date().toISOString();
    set((c) => Object.assign(c, { closedAt, by: me }));
    const nextId = nextYear?.id ?? newWorkplaceId(workplace.entityId, workplace.frameworkId, workplace.year + 1, workplaces.map((w) => w.id));
    if (!nextYear) saveWorkplace({ ...workplace, id: nextId, year: workplace.year + 1, createdAt: closedAt });
    const seeded: CycleState = seededCycle();
    seeded.risks = [];
    for (const c of applicable) {
      const official = closure.controls.find((x) => x.code === c.code);
      seeded.plan[c.code] = {
        owner: c.owner || undefined,
        department: c.department || undefined,
        instruction: official
          ? `Priority: rated ${official.status === "Partial" ? "partially compliant" : "non-compliant"} by ${authority} in ${workplace.year}. ${official.feedback}`.trim()
          : `Carried over from ${workplace.year}: rated fully compliant. Re-check evidence freshness before reuse.`,
      };
    }
    seeded.standard = { ...cy.cycle.standard, published: undefined, draftChanges: 0 };
    update((s) => void (s.screens[cycleKey(nextId)] = seeded));
    cy.audit("Cycle", `Closed ${index} ${workplace.year} with official score ${closure.score ?? "–"}%`, { after: `${partial} partial · ${non} non-compliant · next workspace ${workplace.year + 1} seeded` });
    setConfirming(false);
    say(`${index} ${workplace.year} closed · ${workplace.year + 1} workspace created with ${partial + non} priorities`);
  };

  return (
    <ClientShell search="Search controls">
      <JMain max={1180}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">After the governing body&apos;s assessment</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">{multi ? `Close ${p.name}` : "Record the official results and close the cycle"}</h1>
          </div>
          {multi && (
            <Segmented
              label="Cycle"
              value={String(view)}
              onChange={(v) => setView(Number(v))}
              options={periods.map((x, i) => ({ value: String(i), label: `${x.name}${isClosed(x) ? " · closed" : i === active ? " · now" : ""}` }))}
            />
          )}
        </div>
        {closed && (
          <p className="m-0 rounded-xl bg-[#E7F3ED] px-4 py-3 text-sm font-semibold text-[#0E5A45]">
            {index} {client.year} closed {periods.at(-1)?.closure?.closedAt?.slice(0, 10)} by {periods.at(-1)?.closure?.by} · The workspace is read-only.{" "}
            {nextYear && (
              <Link href={clientHref(nextYear.id, "/plan")} className="text-cx">
                Open the {nextYear.year} workspace →
              </Link>
            )}
          </p>
        )}
        {!closed && isClosed(p) && (
          <p className="m-0 rounded-xl bg-[#E7F3ED] px-4 py-3 text-sm">
            {`${p.name} closed ${p.closure?.closedAt?.slice(0, 10)} by ${p.closure?.by}, official score ${p.closure?.score ?? "–"}%. Its results are on record below.`}
          </p>
        )}
        {!isClosed(p) && view > active && <p className="m-0 rounded-xl bg-j-canvas px-4 py-3 text-sm">{`${p.name} opens when ${periods[active].name} is closed. Its deadlines are set in Plan › Set-up.`}</p>}

        <Panel className="flex flex-col gap-3 p-[22px]">
          <PanelHead title={`1 · Submission to ${authority}`} aside={p.submittedAt ? <Pill tone="ok">Submitted {p.submittedAt}</Pill> : <Pill>Due {p.phases.find((x) => x.key === "submission")?.due}</Pill>} />
          {p.submittedAt ? (
            <p className="m-0 text-sm text-j-ink-3">{`The cycle moved to ${p.phases.find((x) => x.key === "assessment")?.name ?? "regulator assessment"}. Record the official results once ${authority} publishes them.`}</p>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <Field label="Submitted on">
                <input type="date" disabled={locked} value={sentOn} onChange={(e) => setSentOn(e.target.value)} className={cx(inputClass, "h-10")} />
              </Field>
              <JButton variant="primary" disabled={locked || !sentOn} onClick={recordSubmission}>
                Record submission
              </JButton>
              <span className="text-xs text-j-muted">{`The dashboard moves this cycle to ${authority}'s assessment.`}</span>
            </div>
          )}
        </Panel>

        <Panel className={cx("flex flex-col gap-3.5 p-[22px]", !p.submittedAt && "opacity-70")}>
          <PanelHead title="2 · Official results" />
          <div className="flex flex-wrap gap-3">
            <Field label="Governing body" className="flex-[1_1_200px]">
              <input readOnly value={authority} className={cx(inputClass, "bg-j-canvas")} />
            </Field>
            <Field label="Official score (%)" className="flex-[1_1_200px]">
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                disabled={locked || !p.submittedAt}
                value={closure.score ?? ""}
                onChange={(e) => set((c) => void (c.score = e.target.value === "" ? undefined : Number(e.target.value)))}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <Kpi
              label={view > 0 ? `Change vs ${periods[view - 1].name}` : "Change vs previous score"}
              value={closure.score != null && before != null ? `${closure.score - before >= 0 ? "+" : ""}${(closure.score - before).toFixed(1)} pts` : "–"}
              sub={before != null ? `${view > 0 ? periods[view - 1].name : "Previous cycle"}: ${before.toFixed(1)}%` : "First cycle on the platform"}
              tone={closure.score != null && before != null ? (closure.score >= before ? "ok" : "bad") : undefined}
            />
            <Kpi label="Resulting control tiers" value={`${applicable.length - partial - non} Full`} sub={`${partial} Partial · ${non} Non · ${controls.length - applicable.length} N/A`} />
          </div>

          <PanelHead
            title="Partially compliant and non-compliant controls"
            aside={
              !locked &&
              p.submittedAt && (
                <span className="flex gap-2">
                  <select aria-label="Control to add" value={adding} onChange={(e) => setAdding(e.target.value)} className={cx(inputClass, "h-9")}>
                    <option value="">Choose a control…</option>
                    {applicable.filter((c) => !closure.controls.some((x) => x.code === c.code)).map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} {c.title}
                      </option>
                    ))}
                  </select>
                  <JButton
                    size="sm"
                    variant="primary"
                    disabled={!adding}
                    onClick={() => {
                      const c = applicable.find((x) => x.code === adding)!;
                      set((cl) => void cl.controls.push({ code: adding, status: c.met < c.total / 2 ? "Non" : "Partial", notMet: c.reqs.filter((r) => r.stage !== "accepted").map((r) => cy.reqLabel(r.code)).join(", "), feedback: "" }));
                      setAdding("");
                    }}
                  >
                    + Add control
                  </JButton>
                </span>
              )
            }
          />
          <p className="m-0 text-[13px] text-j-ink-3">
            {`Add each control ${authority} did not rate fully compliant, the requirements it found not met and its feedback.${last ? "" : ` These controls reopen for ${nextCycle?.name} with the feedback as their instruction.`}`}
          </p>
          <Table label="Official non-full controls" cols="1.6fr 0.9fr 1fr 2fr 70px" head={["Control", "Official status", "Requirements not met", "Feedback from the governing body", ""]}>
            {closure.controls.map((x, i) => {
              const c = controls.find((k) => k.code === x.code);
              return (
                <Row key={x.code} cols="1.6fr 0.9fr 1fr 2fr 70px">
                  <span className="min-w-0">
                    <b className="font-mono text-xs">{x.code}</b>{" "}
                    <span dir="auto" className="line-clamp-2">
                      {c?.title}
                    </span>
                  </span>
                  <select aria-label={`Official status of ${x.code}`} disabled={locked} value={x.status} onChange={(e) => set((cl) => void (cl.controls[i].status = e.target.value as "Partial" | "Non"))} className="h-9 rounded-lg border border-j-line px-2 text-[13px]">
                    <option value="Partial">Partially compliant</option>
                    <option value="Non">Non-compliant</option>
                  </select>
                  <input aria-label={`Requirements not met in ${x.code}`} disabled={locked} value={x.notMet} onChange={(e) => set((cl) => void (cl.controls[i].notMet = e.target.value))} className="h-9 rounded-lg border border-j-line px-2 text-[13px]" />
                  <input aria-label={`Feedback for ${x.code}`} disabled={locked} value={x.feedback} onChange={(e) => set((cl) => void (cl.controls[i].feedback = e.target.value))} placeholder="Feedback from the governing body" className="h-9 rounded-lg border border-j-line px-2 text-[13px]" />
                  {!locked ? (
                    <JButton size="sm" variant="ghost" aria-label={`Remove ${x.code}`} onClick={() => set((cl) => void cl.controls.splice(i, 1))}>
                      ✕
                    </JButton>
                  ) : (
                    <span />
                  )}
                </Row>
              );
            })}
            {!closure.controls.length && <p className="m-0 px-[22px] py-4 text-sm text-j-muted">No control added. Every applicable control will be recorded as fully compliant.</p>}
          </Table>
        </Panel>

        <Panel className="flex flex-col gap-2.5 p-[22px]">
          <PanelHead title={last ? `3 · Close ${index} ${client.year} for ${client.name}` : `3 · Close ${p.name} and open ${nextCycle?.name}`} aside={isClosed(p) ? <Pill tone="ok">Closed</Pill> : undefined} />
          <ul className="m-0 flex flex-col gap-1.5 ps-5 text-sm text-j-ink-2">
            {last ? (
              <>
                <li>The workspace becomes read-only; reports and the submission pack stay downloadable.</li>
                <li>Next year&apos;s workspace shows each control&apos;s official status and the governing body&apos;s feedback.</li>
                <li>Partially and non-compliant controls start next year&apos;s plan flagged as priorities.</li>
                <li>Owners, departments and reusable evidence carry over, flagged for a freshness re-check.</li>
              </>
            ) : (
              <>
                <li>{`${p.name}'s official score and results are kept on record.`}</li>
                <li>Controls rated fully compliant stay accepted.</li>
                <li>
                  {`${partial + non === 1 ? "The control above goes back to its owner" : `The ${partial + non} controls above go back to their owners`}, due by ${nextCycle?.name}'s internal review, with the requirements not met and ${authority}'s feedback as instructions; owners are notified.`}
                </li>
                <li>
                  {`${nextCycle?.name} opens with the deadlines planned for it (opening ${nextCycle?.opens}, internal review ${nextCycle?.phases.find((x) => x.key === "internal")?.due}).`}
                </li>
              </>
            )}
          </ul>
          <JButton variant="primary" className="self-start" disabled={locked || !p.submittedAt || closure.score == null} title={!p.submittedAt ? "Record the submission first" : closure.score == null ? "Enter the official score first" : undefined} onClick={() => setConfirming(true)}>
            {last ? (multi ? `Close ${p.name} and the year` : "Close cycle") : `Close ${p.name} and open ${nextCycle?.name}`}
          </JButton>
        </Panel>
      </JMain>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title={last ? `Close ${index} ${client.year}?` : `Close ${p.name}?`}
        sub={last ? "This cannot be undone. The workspace becomes read-only and next year's workspace is created." : `This cannot be undone. ${nextCycle?.name} opens and ${partial + non === 1 ? "1 control goes" : `${partial + non} controls go`} back to its owner${partial + non === 1 ? "" : "s"}.`}
        footer={
          <>
            <JButton onClick={() => setConfirming(false)}>Cancel</JButton>
            <JButton variant="primary" onClick={last ? closeYear : closeCycle}>
              {last ? "Close the year" : `Close ${p.name}`}
            </JButton>
          </>
        }
      >
        <p className="m-0 text-sm">
          Official score {closure.score}% · {applicable.length - partial - non} Full · {partial} Partial · {non} Non.
        </p>
      </Modal>
      {toast}
    </ClientShell>
  );
}
