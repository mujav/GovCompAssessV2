"use client";

import { useState, type ReactNode } from "react";
import { Drawer } from "@/components/overlay";
import { cx } from "@/components/ui";
import { useJourney } from "@/lib/journey/store";
import type { DraftKind } from "@/lib/engine/metrics";
import { APPROVE_EFFECT, DRAFT_LABEL } from "@/lib/workspace/drafts";
import { useWorkspace } from "@/lib/workspace/store";
import { JButton, inputClass } from "./ui";

/**
 * Messages the platform drafts (evidence requests, returns, escalations, remediation) are
 * reviewed and sent where they are created: nothing leaves until the consultant presses Send.
 * Returns `send(kind, codes)` to open a draft and the drawer element to render.
 */
export function useDraftSender(): { send: (kind: DraftKind, codes: string[], onSent?: () => void) => void; drawer: ReactNode } {
  const ws = useWorkspace();
  const { log } = useJourney();
  const [open, setOpen] = useState<{ id: string; onSent?: () => void } | null>(null);
  const draft = open ? ws.state.drafts.find((d) => d.id === open.id) : undefined;

  const send = (kind: DraftKind, codes: string[], onSent?: () => void) => {
    if (!codes.length) return;
    setOpen({ id: ws.createDraft(kind, codes), onSent });
  };
  const close = (decision: "approve" | "discard") => {
    if (!draft) return setOpen(null);
    ws.decideDraft(draft.id, decision);
    if (decision === "approve") {
      log(`${DRAFT_LABEL[draft.kind]} sent to ${draft.recipients}: ${draft.title}`);
      open?.onSent?.();
    }
    setOpen(null);
  };

  const drawer = (
    <Drawer
      open={!!draft}
      onClose={() => close("discard")}
      eyebrow={draft ? `${DRAFT_LABEL[draft.kind]} · drafted for you, sent only when you approve` : ""}
      title={draft?.title ?? ""}
      footer={
        <>
          <JButton onClick={() => close("discard")}>Discard</JButton>
          <JButton variant="primary" onClick={() => close("approve")} disabled={!draft?.recipients.trim()}>
            Send
          </JButton>
        </>
      }
    >
      {draft && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Subject
            <input value={draft.title} onChange={(e) => ws.editDraft(draft.id, { title: e.target.value })} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            To
            <input value={draft.recipients} onChange={(e) => ws.editDraft(draft.id, { recipients: e.target.value })} className={cx(inputClass, !draft.recipients.trim() && "border-j-bad")} />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            Message
            <textarea value={draft.body} onChange={(e) => ws.editDraft(draft.id, { body: e.target.value })} rows={10} dir="auto" className="rounded-xl border border-j-line p-3 font-sans text-sm leading-6 font-normal text-j-ink" />
          </label>
          <p className="m-0 text-xs text-j-muted">On send: {APPROVE_EFFECT[draft.kind]}</p>
        </div>
      )}
    </Drawer>
  );

  return { send, drawer };
}
