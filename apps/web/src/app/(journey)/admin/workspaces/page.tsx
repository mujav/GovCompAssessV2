"use client";

import { useMemo, useState } from "react";
import { AppShell, JMain } from "@/components/journey/shell";
import { inputClass, JButton, JLink, Panel, PanelHead, Pill } from "@/components/journey/ui";
import { Row, Table, useToast } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { ROLES } from "@/lib/auth/accounts";
import { useAuth } from "@/lib/auth/store";
import { recordAudit } from "@/lib/audit";
import { shortName } from "@/lib/journey/frameworks";
import { clientHref } from "@/lib/journey/portfolio";
import { useJourney } from "@/lib/journey/store";
import { useWorkplacesWork } from "@/lib/journey/use-work";
import { useWorkplaces } from "@/lib/journey/use-workplaces";
import { workplaceLabel } from "@/lib/journey/workplaces";
import { cycleKey, type CycleState } from "@/lib/cycle/use-cycle";

const ALL = "all";

// S02 · Platform Admin: every workspace, its Index Owners and status, and the grants.

export default function AdminWorkspacesPage() {
  const views = useWorkplaces();
  const work = useWorkplacesWork(views);
  const { users, user } = useAuth();
  const { state, saveWorkplace } = useJourney();
  const { say, toast } = useToast();
  const [entity, setEntity] = useState(ALL);
  const [index, setIndex] = useState(ALL);
  const [grantUser, setGrantUser] = useState("");
  const [grantWs, setGrantWs] = useState("");
  const pending = (state.workplaceRequests ?? []).filter((r) => r.status === "pending");
  const owners = users.filter((u) => u.role === "owner" && u.active);

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
  const cols = "1.6fr 1fr 1.8fr 0.9fr 0.8fr";

  const grant = () => {
    const v = views.find((x) => x.client.id === grantWs);
    const u = users.find((x) => x.id === grantUser);
    if (!v || !u) return;
    saveWorkplace({ ...v.workplace, ownerIds: [...new Set([...v.workplace.ownerIds, u.id])] });
    recordAudit({ user: user?.name ?? "", role: "Platform Admin", type: "Grant", action: `Granted Index Owner ${u.name}`, workspace: `${v.entity.name} · ${workplaceLabel(v.framework?.name ?? "", v.workplace.year)}`, after: "Index Owner" });
    say(`${u.name} is now Index Owner of ${v.entity.name} · ${workplaceLabel(v.framework?.name ?? "", v.workplace.year)}`);
    setGrantUser("");
  };

  return (
    <AppShell search="Search workspaces">
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Platform Admin</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Workspaces and access</h1>
            <p className="m-0 max-w-[760px] text-sm text-j-ink-3">Grant Index Owners access to one entity and one index at a time. Index Owners then add their own Control Owners and viewers.</p>
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
                <b>{w.entity.name}</b>
                <span>
                  {index} · {w.workplace.year}
                </span>
                <span className="text-[13px]">{w.owners.map((o) => o.name).join(", ") || <i className="text-j-bad">No Index Owner</i>}</span>
                <Pill tone={status === "Active" ? "ok" : status === "Set-up" ? "warn" : "gray"}>{status}</Pill>
                <JLink size="sm" href={status.startsWith("Closed") ? clientHref(w.client.id) : clientHref(w.client.id, "/people")}>
                  {status.startsWith("Closed") ? "View" : "Manage"}
                </JLink>
              </Row>
            ))}
          </Table>
        </Panel>

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="flex min-w-0 flex-[1_1_420px] flex-col gap-3 p-[22px]">
            <PanelHead title="Add an Index Owner to an existing workspace" />
            <div className="flex flex-wrap gap-2">
              <select aria-label="User" value={grantUser} onChange={(e) => setGrantUser(e.target.value)} className={cx(inputClass, "min-w-[200px] flex-auto")}>
                <option value="">User…</option>
                {owners.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.email}
                  </option>
                ))}
              </select>
              <select aria-label="Workspace" value={grantWs} onChange={(e) => setGrantWs(e.target.value)} className={cx(inputClass, "min-w-[220px] flex-auto")}>
                <option value="">Workspace…</option>
                {rows.map(({ w, index }) => (
                  <option key={w.client.id} value={w.client.id}>
                    {w.entity.name} · {index} {w.workplace.year}
                  </option>
                ))}
              </select>
              <JButton variant="primary" disabled={!grantUser || !grantWs} onClick={grant}>
                Add
              </JButton>
            </div>
            <p className="m-0 text-xs text-j-muted">To give someone the Index Owner role first, change their role under Users.</p>
          </Panel>
          <Panel className="flex min-w-0 flex-[1_1_420px] flex-col gap-2 p-[22px]">
            <PanelHead title="Who can see what" />
            {ROLES.map((r) => {
              const n = users.filter((u) => u.role === r.key && u.active);
              return (
                <div key={r.key} className="flex flex-col gap-0.5 border-b border-j-line-soft py-2 text-sm last:border-0">
                  <span className="flex justify-between">
                    <b>{r.label}</b>
                    <span className="text-xs text-j-muted">{n.length} active</span>
                  </span>
                  <span className="text-[13px] text-j-ink-3">{r.about}</span>
                  {r.key === "owner" && (
                    <span className="text-xs text-j-muted">
                      {owners.map((o) => `${o.name} · ${o.email} · ${views.filter((v) => v.workplace.ownerIds.includes(o.id)).length} workspaces`).join(" | ")}
                    </span>
                  )}
                </div>
              );
            })}
          </Panel>
        </div>
      </JMain>
      {toast}
    </AppShell>
  );
}
