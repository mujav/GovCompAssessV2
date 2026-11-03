"use client";

import { useState } from "react";
import { AppShell, JMain } from "@/components/journey/shell";
import { Chips, Panel } from "@/components/journey/ui";
import { ControlsTable } from "@/components/cycle/my-controls";
import { useMyControls } from "@/lib/cycle/use-my-controls";
import { TODAY } from "@/lib/workspace/data";

type Group = "todo" | "returned" | "submitted" | "accepted";

const groupOf = (stage: string): Group => (stage === "accepted" ? "accepted" : stage === "returned" ? "returned" : stage === "submitted" || stage === "review" ? "submitted" : "todo");

export default function MyControlsPage() {
  const mine = useMyControls();
  const [group, setGroup] = useState<Group | "all">("all");
  const n = (g: Group) => mine.filter((m) => groupOf(m.c.stage) === g).length;
  const list = mine.filter((m) => group === "all" || groupOf(m.c.stage) === group).sort((a, b) => a.c.due.localeCompare(b.c.due));
  return (
    <AppShell search="Search my controls">
      <JMain max={1240}>
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">My controls</h1>
          <p className="m-0 text-sm text-j-ink-3">
            {mine.length} controls · {mine.filter((m) => m.c.stage !== "accepted" && m.c.due < TODAY).length} overdue. Open a control to write its response and attach the required evidence.
          </p>
        </div>
        <Chips
          label="Filter controls"
          value={group}
          onChange={setGroup}
          options={[
            { value: "all", label: "All", n: mine.length },
            { value: "todo", label: "To do", n: n("todo") },
            { value: "returned", label: "Returned to me", n: n("returned") },
            { value: "submitted", label: "With the Index Owner", n: n("submitted") },
            { value: "accepted", label: "Accepted", n: n("accepted") },
          ]}
        />
        <Panel className="py-2">
          <ControlsTable list={list} showWorkspace />
          {!list.length && <p className="m-0 px-[22px] py-4 text-sm text-j-muted">Nothing here right now.</p>}
        </Panel>
      </JMain>
    </AppShell>
  );
}
