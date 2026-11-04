"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AppShell, JMain } from "@/components/journey/shell";
import { inputClass, JLink, Panel, PanelHead, Pill } from "@/components/journey/ui";
import { Row, Table } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { shortName } from "@/lib/journey/frameworks";
import { clientHref } from "@/lib/journey/portfolio";
import { useJourney } from "@/lib/journey/store";
import { useWorkplacesWork } from "@/lib/journey/use-work";
import { useWorkplaces } from "@/lib/journey/use-workplaces";
import { cycleKey, type CycleState } from "@/lib/cycle/use-cycle";

const ALL = "all";

// S02 · Platform Admin: every workspace, its Index Owners and status, and the grants.

export default function AdminWorkspacesPage() {
  const views = useWorkplaces();
  const work = useWorkplacesWork(views);
  const { state } = useJourney();
  const [entity, setEntity] = useState(ALL);
  const [index, setIndex] = useState(ALL);
  const pending = (state.workplaceRequests ?? []).filter((r) => r.status === "pending");

  const rows = useMemo(
    () =>
      work
        .map((w) => {
          const cycle = state.screens[cycleKey(w.client.id)] as CycleState | undefined;
          const total = Object.values(w.counts).reduce((a, b) => a + b, 0);
          const closed = cycle?.closure?.closedAt;
          const status = closed ? `Closed · ${cycle?.closure?.score ?? "–"}%` : !total || w.counts.start === total ? "Set-up" : "Active";
          return { w, status, index: shortName(w.framework?.name ?? w.client.frameworks[0] ?? "") };
        })
        .sort((a, b) => a.w.entity.name.localeCompare(b.w.entity.name) || b.w.workplace.year - a.w.workplace.year),
    [work, state.screens],
  );
  const indices = [...new Set(rows.map((r) => r.index))].sort();
  const shown = rows.filter((r) => (entity === ALL || r.w.entity.id === entity) && (index === ALL || r.index === index));
  const entities = [...new Map(rows.map((r) => [r.w.entity.id, r.w.entity.name])).entries()];
  const cols = "1.6fr 1fr 1.8fr 0.9fr 1.1fr";

  return (
    <AppShell search="Search workspaces">
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Platform Admin</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Workspaces and access</h1>
          </div>
          <JLink variant="primary" href="/workplaces/new">
            + New workspace
          </JLink>
        </div>

        {pending.length > 0 && (
          <Panel className="flex flex-wrap items-center justify-between gap-3 border-[#F0DDB0] bg-[#FFF8EA] px-6 py-4">
            <span className="text-sm">
              <b>
                {pending.length} workspace request{pending.length === 1 ? "" : "s"}
              </b>{" "}
              from Index Owners: {pending.map((r) => `${r.entityName} · ${r.year} (${r.byName})`).join(", ")}
            </span>
            <JLink size="sm" variant="primary" href="/workplaces/new">
              Create from request
            </JLink>
          </Panel>
        )}

        <Panel className="flex flex-col py-[18px]">
          <PanelHead
            className="px-[22px] pb-3"
            title={`All workspaces · ${rows.length}`}
            aside={
              <span className="flex gap-2">
                <select aria-label="Entity" value={entity} onChange={(e) => setEntity(e.target.value)} className={cx(inputClass, "h-10")}>
                  <option value={ALL}>All entities</option>
                  {entities.map(([id, n]) => (
                    <option key={id} value={id}>
                      {n}
                    </option>
                  ))}
                </select>
                <select aria-label="Index" value={index} onChange={(e) => setIndex(e.target.value)} className={cx(inputClass, "h-10")}>
                  <option value={ALL}>All indices</option>
                  {indices.map((i) => (
                    <option key={i}>{i}</option>
                  ))}
                </select>
              </span>
            }
          />
          <Table label="Workspaces" cols={cols} head={["Entity", "Index · cycle", "Index Owners", "Status", "Actions"]}>
            {shown.map(({ w, status, index }) => (
              <Row key={w.client.id} cols={cols}>
                <Link href={clientHref(w.client.id)} className="font-bold text-j-ink no-underline hover:text-cx hover:underline">
                  {w.entity.name}
                </Link>
                <span>
                  {index} · {w.workplace.year}
                </span>
                <span className="text-[13px]">{w.owners.map((o) => o.name).join(", ") || <i className="text-j-bad">No Index Owner</i>}</span>
                <Pill tone={status === "Active" ? "ok" : status === "Set-up" ? "warn" : "gray"}>{status}</Pill>
                <span className="flex flex-wrap gap-1.5">
                  <JLink size="sm" variant="primary" href={clientHref(w.client.id)}>
                    Open
                  </JLink>
                  {!status.startsWith("Closed") && (
                    <JLink size="sm" href={clientHref(w.client.id, "/people")}>
                      Access
                    </JLink>
                  )}
                </span>
              </Row>
            ))}
          </Table>
        </Panel>

      </JMain>
    </AppShell>
  );
}
