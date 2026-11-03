"use client";

import { JLink } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import type { MyControl } from "@/lib/cycle/use-my-controls";
import { TODAY } from "@/lib/workspace/data";
import { Row, StageBadge, Table } from "./ui";

/** What the Control Owner does next on a control. */
export const nextAction = (m: MyControl) =>
  m.c.stage === "accepted" ? "View" : m.c.stage === "submitted" || m.c.stage === "review" ? "View" : m.c.stage === "returned" ? "Fix and resubmit" : m.c.stage === "not" ? "Start" : "Continue";

export function ControlsTable({ list, showWorkspace }: { list: MyControl[]; showWorkspace?: boolean }) {
  const cols = showWorkspace ? "2.4fr 1.4fr 0.9fr 1fr 0.7fr 0.7fr 1fr" : "2.4fr 0.9fr 1fr 0.7fr 0.7fr 1fr";
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
          <JLink size="sm" variant={m.c.stage === "returned" ? "primary" : "secondary"} href={m.href}>
            {nextAction(m)}
          </JLink>
        </Row>
      ))}
    </Table>
  );
}

