"use client";

// AI feedback on submitted evidence. Only the Index Owner runs the AI assessor and sees its result;
// the Control Owner sees the feedback once the Index Owner shares it, as generated or edited.

import { useState } from "react";
import { JButton } from "@/components/journey/ui";
import type { SharedFeedback } from "@/lib/journey/evidence";

/** Index Owner: share the AI feedback with the Control Owner as is, or edit it first. */
export function ShareFeedback({ draft, shared, owner, disabled, onShare }: { draft: string; shared?: SharedFeedback; owner: string; disabled?: boolean; onShare: (text: string, edited: boolean) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft);
  const edited = text.trim() !== draft.trim();
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#DAD7FB] bg-white p-3">
      <b className="text-[13px]">Feedback for {owner || "the Control Owner"}</b>
      {editing ? (
        <textarea aria-label="Feedback to share" rows={6} value={text} onChange={(e) => setText(e.target.value)} className="rounded-xl border border-j-line p-3 font-sans text-sm leading-6" dir="auto" />
      ) : (
        <p className="m-0 text-[13px] whitespace-pre-wrap text-j-ink-2" dir="auto">
          {draft}
        </p>
      )}
      <span className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <JButton size="sm" variant="primary" disabled={disabled || !text.trim()} onClick={() => (onShare(text.trim(), edited), setEditing(false))}>
              Share {edited ? "edited feedback" : "feedback"}
            </JButton>
            <JButton size="sm" variant="ghost" onClick={() => (setText(draft), setEditing(false))}>
              Cancel
            </JButton>
          </>
        ) : (
          <>
            <JButton size="sm" variant="primary" disabled={disabled} onClick={() => onShare(draft, false)}>
              Share as is
            </JButton>
            <JButton size="sm" variant="outline" disabled={disabled} onClick={() => (setText(shared?.edited ? shared.text : draft), setEditing(true))}>
              Edit before sharing
            </JButton>
          </>
        )}
        {shared && (
          <span className="text-xs text-j-muted">
            Shared {shared.at} by {shared.by}
            {shared.edited ? " · edited" : " · as generated"}
          </span>
        )}
      </span>
    </div>
  );
}

/** Control Owner: the feedback their Index Owner shared. */
export function FeedbackNote({ feedback }: { feedback: SharedFeedback }) {
  return (
    <span className="flex flex-col gap-1 rounded-xl bg-cx-tint px-3 py-2 text-[13px]">
      <b className="text-xs tracking-[0.04em]">FEEDBACK FROM YOUR INDEX OWNER</b>
      <span className="whitespace-pre-wrap" dir="auto">
        {feedback.text}
      </span>
      <span className="text-xs text-j-muted">
        {feedback.by} · {feedback.at}
      </span>
    </span>
  );
}
