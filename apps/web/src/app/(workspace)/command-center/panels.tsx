"use client";

import Link from "next/link";
import { useState } from "react";
import { Drawer } from "@/components/overlay";
import { AiTag, Badge, Button, CompliancePill, cx } from "@/components/ui";
import { effectiveStatus } from "@/lib/engine/scoring";
import { scoreImpact, type Context } from "@/lib/engine/metrics";
import { DEPARTMENTS, shortDate } from "@/lib/workspace/data";
import { APPROVE_EFFECT, DRAFT_LABEL, type Draft } from "@/lib/workspace/drafts";
import { useWorkspace } from "@/lib/workspace/store";

export type Panel =
  | { type: "records"; title: string; definition?: string; codes: string[] }
  | { type: "draft"; id: string }
  | { type: "assign"; code: string }
  | { type: "drafts" };

/** `scope` is the filtered context, so score impacts match the cards that opened the panel. */
export function Panels({ panel, setPanel, scope }: { panel: Panel | null; setPanel: (p: Panel | null) => void; scope: Context }) {
  const close = () => setPanel(null);
  return (
    <>
      <RecordsPanel panel={panel?.type === "records" ? panel : null} onClose={close} ctx={scope} />
      <DraftPanel id={panel?.type === "draft" ? panel.id : null} onClose={close} />
      <AssignPanel code={panel?.type === "assign" ? panel.code : null} onClose={close} ctx={scope} />
      <DraftsPanel open={panel?.type === "drafts"} onClose={close} onOpen={(id) => setPanel({ type: "draft", id })} />
    </>
  );
}

/* ---------- Drill-down: numerator, definition and source records ---------- */

function RecordsPanel({ panel, onClose, ctx }: { panel: Extract<Panel, { type: "records" }> | null; onClose: () => void; ctx: Context }) {
  const codes = new Set(panel?.codes ?? []);
  const rows = ctx.reqs.filter((r) => codes.has(r.code));
  return (
    <Drawer open={!!panel} onClose={onClose} eyebrow="Source records" title={panel?.title ?? ""}>
      {panel?.definition && (
        <p className="m-0 rounded-lg bg-surface-2 px-3.5 py-3 text-[13px] leading-5 text-ink-2">
          <b className="text-ink">Definition:</b> {panel.definition}
        </p>
      )}
      <div className="text-[13px] text-muted">
        {rows.length} requirement{rows.length === 1 ? "" : "s"}
      </div>
      {rows.length === 0 && <p className="m-0 text-sm text-muted">No records match the current filters.</p>}
      <ul className="m-0 flex list-none flex-col p-0">
        {rows.map((r) => (
          <li key={r.code} className="flex items-start justify-between gap-3 border-t border-line-soft py-3 text-[13px]">
            <div className="min-w-0">
              <Link href={`/requirements/${r.code}`} className="font-mono font-semibold">
                {r.code}
              </Link>{" "}
              {r.title}
              <div className="text-xs text-muted">
                {r.department} · {r.owner || <b className="text-bad">Unassigned</b>} · due {shortDate(r.due)} · weight {r.weight}
                {scoreImpact(r, ctx.reqs, ctx.scheme) > 0 && ` · +${scoreImpact(r, ctx.reqs, ctx.scheme)} pts`}
              </div>
            </div>
            <CompliancePill status={effectiveStatus(r, ctx.scheme)} className="flex-none" />
          </li>
        ))}
      </ul>
    </Drawer>
  );
}

/* ---------- Draft review: AI prepares, a human edits and approves ---------- */

function DraftPanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { state, editDraft, decideDraft } = useWorkspace();
  const d = state.drafts.find((x) => x.id === id);
  const [copied, setCopied] = useState(false);
  const editable = d?.status === "draft";

  const copy = async () => {
    if (!d) return;
    try {
      await navigator.clipboard.writeText(`${d.title}\nTo: ${d.recipients}\n\n${d.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the text stays selectable in the field.
    }
  };

  return (
    <Drawer
      open={!!d}
      onClose={onClose}
      eyebrow={d && `${DRAFT_LABEL[d.kind]} · ${d.id} · prepared ${d.createdAt}`}
      title={d?.title ?? ""}
      footer={
        d && (
          <>
            <Button size="md" onClick={copy}>
              {copied ? "Copied" : "Copy text"}
            </Button>
            {editable ? (
              <>
                <Button size="md" onClick={() => decideDraft(d.id, "discard")}>
                  Discard
                </Button>
                <Button size="md" variant="primary" onClick={() => decideDraft(d.id, "approve")}>
                  Approve
                </Button>
              </>
            ) : (
              <Button size="md" variant="primary" onClick={onClose}>
                Done
              </Button>
            )}
          </>
        )
      }
    >
      {d && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <AiTag>AI DRAFT</AiTag>
            <DraftStatus d={d} />
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Title
            <input
              value={d.title}
              disabled={!editable}
              onChange={(e) => editDraft(d.id, { title: e.target.value })}
              className="h-10 rounded-lg border border-field bg-white px-3 text-sm font-normal disabled:bg-surface-2"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            To
            <input
              value={d.recipients}
              disabled={!editable}
              onChange={(e) => editDraft(d.id, { recipients: e.target.value })}
              className="h-10 rounded-lg border border-field bg-white px-3 text-sm font-normal disabled:bg-surface-2"
            />
          </label>
          <label className="flex flex-auto flex-col gap-1.5 text-[13px] font-semibold">
            Message
            <textarea
              value={d.body}
              disabled={!editable}
              onChange={(e) => editDraft(d.id, { body: e.target.value })}
              rows={16}
              className="min-h-[280px] flex-auto resize-y rounded-lg border border-field bg-white p-3 font-mono text-[13px] leading-5 font-normal disabled:bg-surface-2"
            />
          </label>
          <p className="m-0 rounded-lg border border-ai-line bg-ai-tint px-3.5 py-3 text-[13px] leading-5 text-[#3B3F5C]">
            <b>On approval:</b> {APPROVE_EFFECT[d.kind]} Figures in this draft come from the scoring engine; AI only worded it.
          </p>
        </>
      )}
    </Drawer>
  );
}

function DraftStatus({ d }: { d: Draft }) {
  if (d.status === "draft") return <Badge tone="warn">Awaiting your approval</Badge>;
  if (d.status === "approved") return <Badge tone="ok">{`Approved by ${d.decidedBy} · ${d.decidedAt}`}</Badge>;
  return <Badge tone="gray">{`Discarded · ${d.decidedAt}`}</Badge>;
}

/* ---------- Assign owner and due date ---------- */

function AssignPanel({ code, onClose, ctx }: { code: string | null; onClose: () => void; ctx: Context }) {
  const r = ctx.reqs.find((x) => x.code === code);
  // Remount the form per requirement so its fields start from that record.
  return (
    <Drawer open={!!r} onClose={onClose} eyebrow="Assign" title={r ? `${r.code} ${r.title}` : ""}>
      {r && <AssignForm key={r.code} code={r.code} ctx={ctx} onDone={onClose} />}
    </Drawer>
  );
}

function AssignForm({ code, ctx, onDone }: { code: string; ctx: Context; onDone: () => void }) {
  const { assign } = useWorkspace();
  const r = ctx.reqs.find((x) => x.code === code)!;
  const people = DEPARTMENTS[r.domain].people;
  const [owner, setOwner] = useState(r.owner || people[0]);
  const [due, setDue] = useState(r.due < ctx.today ? ctx.today : r.due);
  const impact = scoreImpact(r, ctx.reqs, ctx.scheme);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        assign(code, owner, due);
        onDone();
      }}
    >
      <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
        <CompliancePill status={effectiveStatus(r, ctx.scheme)} />
        {r.department} · currently {r.owner || <b className="text-bad">unassigned</b>} · due {shortDate(r.due)}
        {impact > 0 && <b className="text-brand">· +{impact} pts if compliant</b>}
      </div>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Owner
        <select value={owner} onChange={(e) => setOwner(e.target.value)} className="h-10 rounded-lg border border-field bg-white px-3 text-sm font-normal">
          {people.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
        Due date
        <input
          type="date"
          value={due}
          min={ctx.today}
          required
          onChange={(e) => setDue(e.target.value)}
          className="h-10 rounded-lg border border-field bg-white px-3 text-sm font-normal"
        />
      </label>
      <p className="m-0 text-xs text-muted">Owners are limited to {r.department}. The owner is notified when you save.</p>
      <div className="flex justify-end gap-2">
        <Button size="md" onClick={onDone}>
          Cancel
        </Button>
        <Button size="md" variant="primary" type="submit">
          Save assignment
        </Button>
      </div>
    </form>
  );
}

/* ---------- Drafts tray and activity ---------- */

function DraftsPanel({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: (id: string) => void }) {
  const { state, reset } = useWorkspace();
  const pending = state.drafts.filter((d) => d.status === "draft");
  const decided = state.drafts.filter((d) => d.status !== "draft");
  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow="Command Center"
      title="Drafts and activity"
      footer={
        <Button
          size="md"
          onClick={() => {
            reset();
            onClose();
          }}
        >
          Reset demo data
        </Button>
      }
    >
      <DraftList title={`Awaiting approval (${pending.length})`} drafts={pending} onOpen={onOpen} empty="No drafts waiting." />
      <DraftList title={`Decided (${decided.length})`} drafts={decided} onOpen={onOpen} empty="Nothing approved or discarded yet." />
      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-sm font-semibold">Activity</h3>
        {state.log.length === 0 && <p className="m-0 text-[13px] text-muted">No activity yet.</p>}
        <ul className="m-0 flex list-none flex-col p-0">
          {state.log.map((l) => (
            <li key={l.id} className="flex gap-3 border-t border-line-soft py-2 text-[13px]">
              <span className="w-[92px] flex-none font-mono text-xs text-muted">{l.at}</span>
              <span>{l.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </Drawer>
  );
}

function DraftList({ title, drafts, onOpen, empty }: { title: string; drafts: Draft[]; onOpen: (id: string) => void; empty: string }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 text-sm font-semibold">{title}</h3>
      {drafts.length === 0 && <p className="m-0 text-[13px] text-muted">{empty}</p>}
      {drafts.map((d) => (
        <button
          key={d.id}
          type="button"
          onClick={() => onOpen(d.id)}
          className={cx(
            "flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-white px-3.5 py-2.5 text-left text-[13px] text-ink hover:border-field",
            d.status === "discarded" && "opacity-60",
          )}
        >
          <span className="min-w-0">
            <b>{d.title}</b>
            <br />
            <span className="text-xs text-muted">
              {DRAFT_LABEL[d.kind]} · {d.id} · {d.createdAt}
            </span>
          </span>
          <DraftStatus d={d} />
        </button>
      ))}
    </section>
  );
}
