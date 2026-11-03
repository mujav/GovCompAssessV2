"use client";

import { useState } from "react";
import { Avatar, JButton, Panel, PanelHead } from "@/components/journey/ui";
import { initialsOf } from "@/lib/journey/people";
import type { useCycle } from "@/lib/cycle/use-cycle";
import { fmtWhen } from "./ui";

/** Comment thread on a control, shared by the Control Owner and the Index Owner. */
export function Comments({ cy, code }: { cy: Pick<ReturnType<typeof useCycle>, "cycle" | "comment" | "closed">; code: string }) {
  const list = cy.cycle.comments[code] ?? [];
  const [text, setText] = useState("");
  return (
    <Panel className="flex flex-col gap-3 p-[22px]">
      <PanelHead title={`Comments${list.length ? ` · ${list.length}` : ""}`} />
      {list.map((m) => (
        <div key={m.id} className="flex gap-2.5 text-sm">
          <Avatar initials={initialsOf(m.by)} size={28} />
          <span className="flex flex-col gap-0.5">
            <span>
              <b>{m.by}</b> <span className="text-xs text-j-muted">· {m.role} · {fmtWhen(m.at)}</span>
            </span>
            <span dir="auto">{m.text}</span>
          </span>
        </div>
      ))}
      {!list.length && <p className="m-0 text-sm text-j-muted">No comments yet.</p>}
      <div className="flex gap-2">
        <input aria-label="Reply" value={text} disabled={cy.closed} onChange={(e) => setText(e.target.value)} placeholder="Write a reply" className="h-10 min-w-0 flex-auto rounded-[10px] border border-j-line px-3 text-sm" />
        <JButton
          size="sm"
          disabled={!text.trim() || cy.closed}
          onClick={() => {
            cy.comment(code, text.trim());
            setText("");
          }}
        >
          Reply
        </JButton>
      </div>
    </Panel>
  );
}
