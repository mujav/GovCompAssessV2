"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/journey/icon";
import { JLink } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { useAuth } from "@/lib/auth/store";
import { useJourney } from "@/lib/journey/store";
import { reqLabel } from "@/lib/cycle/model";
import { useControlEvidence } from "@/lib/cycle/use-control-evidence";
import { cycleKey, defaultSpecs, seededCycle, type CycleState } from "@/lib/cycle/use-cycle";
import type { MyControl } from "@/lib/cycle/use-my-controls";
import { TODAY } from "@/lib/workspace/data";
import { Row, StageBadge, Table } from "./ui";

/** What the Control Owner does next on a control. */
export const nextAction = (m: MyControl) =>
  m.c.stage === "accepted" ? "View" : m.c.stage === "submitted" || m.c.stage === "review" ? "View" : m.c.stage === "returned" ? "Fix and resubmit" : m.c.stage === "not" ? "Start" : "Continue";

/** `onAttached` turns on the paperclip on each row, for attaching evidence without opening the control. */
export function ControlsTable({ list, showWorkspace, onAttached }: { list: MyControl[]; showWorkspace?: boolean; onAttached?: (text: string) => void }) {
  const cols = showWorkspace ? "2.4fr 1.4fr 0.9fr 1fr 0.7fr 0.7fr 1.2fr" : "3fr 0.9fr 1fr 0.7fr 0.7fr 1.2fr";
  return (
    <Table label="My controls" cols={cols} head={["Control", ...(showWorkspace ? ["Workspace"] : []), "Due", "Status", "Req. met", "Evidence", "Action"]}>
      {list.map((m) => (
        <Row key={m.workspaceId + m.c.code} cols={cols}>
          <span>
            <b className="font-mono text-xs">{m.c.code}</b> {m.c.title}
            {!m.owned && <span className="ms-1.5 text-xs text-j-muted">· contributing</span>}
          </span>
          {showWorkspace && <span className="text-[13px] text-j-ink-3">{m.workspace}</span>}
          <span className={cx(m.c.due < TODAY && m.c.stage !== "accepted" && "font-semibold text-[#B2461F]")}>{m.c.due}</span>
          <StageBadge stage={m.c.stage} overdue={m.c.due < TODAY} />
          <span>
            {m.c.met} / {m.c.total}
          </span>
          <span>
            {m.c.evidence.uploaded} / {m.c.evidence.expected}
          </span>
          <span className="flex items-center gap-1.5">
            <JLink size="sm" variant={m.c.stage === "returned" ? "primary" : "secondary"} href={m.href}>
              {nextAction(m)}
            </JLink>
            {onAttached && <QuickAttach m={m} onDone={onAttached} />}
          </span>
        </Row>
      ))}
    </Table>
  );
}

/** Paperclip on a control row: pick the required evidence item, then the files. */
function QuickAttach({ m, onDone }: { m: MyControl; onDone: (text: string) => void }) {
  const { user } = useAuth();
  const { update } = useJourney();
  const ev = useControlEvidence(m.workspaceId, m.frameworkId, m.workspace, user?.name ?? "");
  const [open, setOpen] = useState(false);
  const target = useRef<{ req: string; spec: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const editable = m.c.stage !== "accepted" && m.c.stage !== "submitted" && m.c.stage !== "review";
  const specs = (m.cycle.standard.controls[m.c.code]?.specs ?? defaultSpecs(m.c)).filter((s) => !s.govVerified && m.c.reqs.some((r) => r.code === s.req && r.stage !== "accepted" && r.status !== "na"));
  if (!editable || !specs.length) return <span className="w-[34px]" aria-hidden="true" />;

  const attach = async (files: File[]) => {
    const t = target.current;
    if (!t || !files.length) return;
    const read = await ev.upload(t.req, files);
    update((s) => {
      const cy = (s.screens[cycleKey(m.workspaceId)] ??= seededCycle()) as CycleState;
      for (const f of read) (cy.fileSpec ??= {})[f.id] = t.spec;
      (cy.activity ??= {})[m.c.code] = new Date().toISOString();
    });
    onDone(`${read.length} file${read.length === 1 ? "" : "s"} attached to ${m.c.code} · ${t.spec}`);
    if (input.current) input.current.value = "";
  };

  return (
    <span className="relative">
      <button
        type="button"
        aria-label={`Attach evidence to ${m.c.code}`}
        aria-expanded={open}
        title="Attach evidence"
        disabled={!!ev.busy}
        onClick={() => setOpen(!open)}
        className={cx("flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[10px] border border-j-line bg-white text-j-ink-2 hover:bg-j-canvas hover:text-cx disabled:cursor-wait disabled:opacity-60", open && "border-cx text-cx")}
      >
        <Icon name="clip" size={16} />
      </button>
      <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && void attach([...e.target.files])} />
      {open && (
        <>
          <span className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <span role="menu" aria-label={`Required evidence for ${m.c.code}`} className="absolute end-0 top-[38px] z-20 flex w-[320px] flex-col rounded-xl border border-j-line bg-white p-1.5 shadow-[0_8px_24px_rgba(16,28,23,0.12)]">
            <span className="px-2.5 py-1.5 text-xs font-semibold text-j-muted">Attach to</span>
            {specs.map((s) => (
              <button
                key={s.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  target.current = { req: s.req, spec: s.id };
                  setOpen(false);
                  input.current?.click();
                }}
                className="flex cursor-pointer items-baseline gap-2 rounded-lg border-0 bg-transparent px-2.5 py-2 text-start text-[13px] text-j-ink hover:bg-j-canvas"
              >
                <b className="font-mono text-xs">{s.id}</b>
                <span className="flex-auto">
                  {s.title}
                  <span className="text-xs text-j-muted"> · {reqLabel(s.req)}</span>
                </span>
              </button>
            ))}
          </span>
        </>
      )}
    </span>
  );
}
