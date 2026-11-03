"use client";

import Link from "next/link";
import { useState } from "react";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Field, inputClass, JButton, Panel, PanelHead, Pill } from "@/components/journey/ui";
import { Kpi, Modal, Row, Table, useToast } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { useJourney } from "@/lib/journey/store";
import { clientHref } from "@/lib/journey/portfolio";
import { newWorkplaceId, duplicateOf } from "@/lib/journey/workplaces";
import { cycleKey, seededCycle, useCycle, type Closure, type CycleState } from "@/lib/cycle/use-cycle";
import { PRIOR_CYCLE } from "@/lib/workspace/data";

export default function ClosurePage() {
  const cy = useCycle();
  const { client, cycle, setCycle, controls, closed, framework, workplace, me } = cy;
  const { workplaces, saveWorkplace, update } = useJourney();
  const { say, toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState("");
  const closure: Closure = cycle.closure ?? { controls: [] };
  const applicable = controls.filter((c) => c.applicable);
  const prior = client.id === client.entityId && client.frameworkId === "fw-qiyas" ? PRIOR_CYCLE.at(-1)! : undefined;
  const authority = framework?.authority ?? "Governing body";
  const set = (fn: (c: Closure) => void) => setCycle((d) => void fn((d.closure ??= { controls: [] })));
  const partial = closure.controls.filter((x) => x.status === "Partial").length;
  const non = closure.controls.filter((x) => x.status === "Non").length;
  const index = client.frameworks[0] ?? "index";
  const next = workplace ? duplicateOf(workplaces, workplace.entityId, workplace.frameworkId, workplace.year + 1) : undefined;

  const close = () => {
    if (!workplace) return;
    const closedAt = new Date().toISOString();
    set((c) => {
      c.closedAt = closedAt;
      c.by = me;
    });
    // Next year's workspace: same entity, index and owners, with this cycle's official results as priorities.
    const nextId = next?.id ?? newWorkplaceId(workplace.entityId, workplace.frameworkId, workplace.year + 1, workplaces.map((w) => w.id));
    if (!next) saveWorkplace({ ...workplace, id: nextId, year: workplace.year + 1, createdAt: closedAt });
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
    seeded.standard = { ...cycle.standard, published: undefined, draftChanges: 0 };
    update((s) => void (s.screens[cycleKey(nextId)] = seeded));
    cy.audit("Cycle", `Closed ${index} ${workplace.year} with official score ${closure.score ?? "–"}%`, { after: `${partial} partial · ${non} non-compliant · next workspace ${workplace.year + 1} seeded` });
    setConfirming(false);
    say(`${index} ${workplace.year} closed · ${workplace.year + 1} workspace created with ${partial + non} priorities`);
  };

  return (
    <ClientShell search="Search controls">
      <JMain max={1180}>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-j-muted">After the governing body&apos;s final assessment</span>
          <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Record the official results and close the cycle</h1>
          <p className="m-0 max-w-[820px] text-sm text-j-ink-3">
            Enter the final score, then add only the controls the governing body rated partially compliant or non-compliant. Every other applicable control is recorded as fully compliant.
          </p>
        </div>
        {closed && (
          <p className="m-0 rounded-xl bg-[#E7F3ED] px-4 py-3 text-sm font-semibold text-[#0E5A45]">
            Closed {closure.closedAt?.slice(0, 10)} by {closure.by}. The workspace is read-only.{" "}
            {next && (
              <Link href={clientHref(next.id, "/plan")} className="text-cx">
                Open the {next.year} workspace →
              </Link>
            )}
          </p>
        )}

        <Panel className="flex flex-col gap-3.5 p-[22px]">
          <div className="flex flex-wrap gap-3">
            <Field label="Governing body" className="flex-[1_1_200px]">
              <input readOnly value={authority} className={cx(inputClass, "bg-j-canvas")} />
            </Field>
            <Field label="Official final score (%)" className="flex-[1_1_200px]">
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                disabled={closed}
                value={closure.score ?? ""}
                onChange={(e) => set((c) => void (c.score = e.target.value === "" ? undefined : Number(e.target.value)))}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <Kpi
              label="Change vs previous score"
              value={closure.score != null && prior != null ? `${closure.score - prior >= 0 ? "+" : ""}${(closure.score - prior).toFixed(1)} pts` : "–"}
              sub={prior != null ? `Previous cycle: ${prior.toFixed(1)}%` : "First cycle on the platform"}
              tone={closure.score != null && prior != null ? (closure.score >= prior ? "ok" : "bad") : undefined}
            />
            <Kpi label="Resulting control tiers" value={`${applicable.length - partial - non} Full`} sub={`${partial} Partial · ${non} Non · ${controls.length - applicable.length} N/A`} />
          </div>
        </Panel>

        <Panel className="flex flex-col gap-2 py-[18px]">
          <PanelHead
            className="px-[22px]"
            title="Partially compliant and non-compliant controls"
            aside={
              !closed && (
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
          <p className="m-0 px-[22px] text-[13px] text-j-ink-3">Add each control, its official status and the governing body&apos;s feedback.</p>
          <Table label="Official non-full controls" cols="1.6fr 0.9fr 1fr 2fr 70px" head={["Control", "Official status", "Requirements not met", "Feedback from the governing body", ""]}>
            {closure.controls.map((x, i) => {
              const c = controls.find((k) => k.code === x.code);
              return (
                <Row key={x.code} cols="1.6fr 0.9fr 1fr 2fr 70px">
                  <span>
                    <b className="font-mono text-xs">{x.code}</b> {c?.title}
                  </span>
                  <select aria-label={`Official status of ${x.code}`} disabled={closed} value={x.status} onChange={(e) => set((cl) => void (cl.controls[i].status = e.target.value as "Partial" | "Non"))} className="h-9 rounded-lg border border-j-line px-2 text-[13px]">
                    <option value="Partial">Partially compliant</option>
                    <option value="Non">Non-compliant</option>
                  </select>
                  <input aria-label={`Requirements not met in ${x.code}`} disabled={closed} value={x.notMet} onChange={(e) => set((cl) => void (cl.controls[i].notMet = e.target.value))} className="h-9 rounded-lg border border-j-line px-2 text-[13px]" />
                  <input aria-label={`Feedback for ${x.code}`} disabled={closed} value={x.feedback} onChange={(e) => set((cl) => void (cl.controls[i].feedback = e.target.value))} placeholder="Feedback from the governing body" className="h-9 rounded-lg border border-j-line px-2 text-[13px]" />
                  {!closed ? (
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
          <PanelHead title={`Close ${index} ${client.year} for ${client.name}`} aside={closed ? <Pill tone="ok">Closed</Pill> : undefined} />
          <ul className="m-0 flex flex-col gap-1.5 ps-5 text-sm text-j-ink-2">
            <li>The workspace becomes read-only; reports and the submission pack stay downloadable.</li>
            <li>Next cycle&apos;s workspace shows each control&apos;s official status and the governing body&apos;s feedback.</li>
            <li>Partially and non-compliant controls start the next plan flagged as priorities.</li>
            <li>Owners, departments and reusable evidence carry over, flagged for a freshness re-check.</li>
          </ul>
          <JButton variant="primary" className="self-start" disabled={closed || closure.score == null} title={closure.score == null ? "Enter the official final score first" : undefined} onClick={() => setConfirming(true)}>
            Close cycle
          </JButton>
        </Panel>
      </JMain>
      <Modal
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Close the cycle?"
        sub="This cannot be undone. The workspace becomes read-only and next year's workspace is created."
        footer={
          <>
            <JButton onClick={() => setConfirming(false)}>Cancel</JButton>
            <JButton variant="primary" onClick={close}>
              Close cycle
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
