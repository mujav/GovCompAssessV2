"use client";

import Link from "next/link";
import { useState } from "react";
import { AppShell, JMain } from "@/components/journey/shell";
import { inputClass, Panel, Pill } from "@/components/journey/ui";
import { Row, Table } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { useJourney } from "@/lib/journey/store";
import { evidenceKey, type EvidenceState } from "@/lib/journey/evidence";
import { reqLabel } from "@/lib/cycle/model";
import { useMyControls } from "@/lib/cycle/use-my-controls";

// Control Owner's evidence library: every file they attached to their controls, with the
// required evidence it answers and the AI's latest verdict on the requirement.

export default function MyEvidencePage() {
  const mine = useMyControls();
  const { state } = useJourney();
  const [q, setQ] = useState("");
  const rows = mine.flatMap((m) =>
    m.c.reqs.flatMap((r) => {
      const st = state.screens[evidenceKey(m.workspaceId, m.frameworkId, r.code)] as (EvidenceState & { replaced?: Record<string, string> }) | undefined;
      return (st?.files ?? []).map((f) => ({ f, m, r, run: st?.run?.fileIds.includes(f.id) ? st.run : undefined, replaced: !!st?.replaced?.[f.id] }));
    }),
  );
  const shown = rows.filter((x) => !q || `${x.f.name} ${x.m.c.code} ${x.m.c.title}`.toLowerCase().includes(q.toLowerCase()));
  const cols = "2fr 1.6fr 0.7fr 0.8fr 1fr";
  return (
    <AppShell search="Search my evidence">
      <JMain max={1240}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Evidence library</h1>
            <p className="m-0 text-sm text-j-ink-3">Every file you attached to your controls. Upload new files from the control, against the required evidence they answer.</p>
          </div>
          <input aria-label="Search evidence" placeholder="Search evidence" value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputClass, "h-10 w-[260px]")} />
        </div>
        <Panel className="py-2">
          <Table label="My evidence" cols={cols} head={["File", "Control · requirement", "Required evidence", "Uploaded", "Status"]}>
            {shown.map(({ f, m, r, run, replaced }) => (
              <Row key={f.id} cols={cols} className={cx(replaced && "opacity-60")}>
                <span className="min-w-0">
                  <b className="block truncate">{f.name}</b>
                  <span className="text-xs text-j-muted">{f.error ?? `${f.pages.length} pages`}</span>
                </span>
                <Link href={m.href} className="text-[13px]">
                  <b className="font-mono text-xs">{m.c.code}</b> · {reqLabel(r.code)} {m.c.title}
                </Link>
                <span className="font-mono text-xs">{m.cycle.fileSpec[f.id] ?? "–"}</span>
                <span className="text-[13px]">{f.uploadedAt}</span>
                <span>{replaced ? <Pill>Replaced</Pill> : f.error ? <Pill tone="bad">Unreadable</Pill> : r.stage === "accepted" ? <Pill tone="ok">Accepted</Pill> : run ? <Pill tone="ai">Checked</Pill> : <Pill tone="cx">Uploaded</Pill>}</span>
              </Row>
            ))}
            {!shown.length && <p className="m-0 px-[22px] py-4 text-sm text-j-muted">No files yet. Open a control and upload the evidence each requirement asks for.</p>}
          </Table>
        </Panel>
      </JMain>
    </AppShell>
  );
}
