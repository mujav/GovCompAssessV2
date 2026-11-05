"use client";

import { useState } from "react";
import { Icon } from "@/components/journey/icon";
import { AppShell, JMain } from "@/components/journey/shell";
import { Avatar, Field, JButton, Panel, Pill, inputClass, type PillTone } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { ROLES, ROLE_OF, type AccessRequest, type Role } from "@/lib/auth/accounts";
import { useAuth } from "@/lib/auth/store";
import { shortName } from "@/lib/journey/frameworks";
import { useJourney } from "@/lib/journey/store";
import { useWorkplaces, type WorkplaceView } from "@/lib/journey/use-workplaces";
import { initials } from "@/lib/journey/work";

// Platform admin: approve or reject access requests, decide each user's role, and give index
// owners their workplaces.

type Tab = "requests" | "users";

const ROLE_TONE: Record<Role, PillTone> = { admin: "dark", owner: "cx", control: "ok", viewer: "ai" };

const wpLabel = (v: WorkplaceView) => `${v.entity.name} · ${v.framework ? shortName(v.framework.name) : v.workplace.frameworkId} · ${v.workplace.year}`;

export default function AccessPage() {
  const { users, requests, user: me, updateUser } = useAuth();
  const { log } = useJourney();
  const views = useWorkplaces();
  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");
  const [tab, setTab] = useState<Tab>(pending.length ? "requests" : "users");
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | Role>("all");

  const shown = users
    .filter((u) => role === "all" || u.role === role)
    .filter((u) => `${u.name} ${u.email} ${u.department ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => ROLES.findIndex((r) => r.key === a.role) - ROLES.findIndex((r) => r.key === b.role) || a.name.localeCompare(b.name));

  return (
    <AppShell search="Search people">
      <JMain max={1200}>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-j-muted">Administration</span>
          <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Access &amp; users</h1>
        </div>

        <section aria-label="Roles" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
          {ROLES.map((r) => (
            <div key={r.key} className="flex flex-col gap-1.5 rounded-2xl border border-[#E3E8EF] bg-white p-4">
              <span className="flex items-center justify-between">
                <Pill tone={ROLE_TONE[r.key]}>{r.label}</Pill>
                <b className="text-lg">{users.filter((u) => u.role === r.key && u.active).length}</b>
              </span>
              <span className="text-xs leading-[18px] text-j-ink-3">{r.about}</span>
            </div>
          ))}
        </section>

        <div role="tablist" aria-label="Access" className="flex gap-1 border-b border-j-line">
          {(
            [
              ["requests", "Access requests", pending.length],
              ["users", "Users", users.length],
            ] as const
          ).map(([k, l, n]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cx("inline-flex h-11 cursor-pointer items-center gap-1.5 border-0 border-b-2 bg-transparent px-3.5 text-sm", tab === k ? "border-cx font-bold text-cx" : "border-transparent font-medium text-j-ink-3")}
            >
              {l}
              <span className={cx("rounded-full px-1.5 text-[11px] font-bold", k === "requests" && n ? "bg-[#C2410C] text-white" : "bg-j-canvas text-j-ink-3")}>{n}</span>
            </button>
          ))}
        </div>

        {tab === "requests" && (
          <div className="flex flex-col gap-3.5">
            {pending.map((r) => (
              <RequestCard key={r.id} r={r} views={views} onDone={(text) => log(text)} />
            ))}
            {pending.length === 0 && (
              <Panel className="p-[22px] text-sm text-j-muted">No requests waiting. New requests from the sign-in page appear here.</Panel>
            )}
            {decided.length > 0 && (
              <Panel className="flex flex-col p-0">
                <h2 className="m-0 px-[22px] pt-[18px] pb-2 text-base">Decided</h2>
                {decided.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 border-t border-j-line-soft px-[22px] py-3 text-sm">
                    <Avatar initials={initials(r.name)} size={30} />
                    <span className="min-w-[200px] flex-auto">
                      <b>{r.name}</b> · <span className="text-j-muted">{r.email}</span>
                      <br />
                      <span className="text-xs text-j-muted">
                        {r.organisation} · {r.decidedAt} by {r.decidedBy ?? "admin"}
                        {r.note ? ` · “${r.note}”` : ""}
                      </span>
                    </span>
                    {r.status === "approved" ? <Pill tone="ok">Approved · {ROLE_OF[r.role ?? "control"].label}</Pill> : <Pill tone="bad">Rejected</Pill>}
                  </div>
                ))}
              </Panel>
            )}
          </div>
        )}

        {tab === "users" && (
          <Panel className="flex flex-col p-0">
            <div className="flex flex-wrap items-center gap-2 px-[22px] pt-[18px] pb-3">
              <label className="flex h-10 flex-[0_1_320px] items-center gap-2 rounded-[10px] border border-j-line bg-white px-3 text-j-muted">
                <Icon name="search" size={16} />
                <span className="sr-only">Filter users</span>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or department" className="min-w-0 flex-auto border-0 bg-transparent text-sm text-j-ink outline-none" />
              </label>
              <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value as typeof role)} className={cx(inputClass, "h-10")}>
                <option value="all">All roles</option>
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <div role="table" aria-label="Users" className="min-w-[860px] text-sm">
                <div role="row" className="grid grid-cols-[2fr_1.2fr_1.6fr_0.7fr] gap-3 border-y border-j-line px-[22px] py-2.5 text-xs font-semibold text-j-muted">
                  {["User", "Role", "Scope", "Access"].map((h) => (
                    <span key={h} role="columnheader">
                      {h}
                    </span>
                  ))}
                </div>
                {shown.map((u) => {
                  const self = u.id === me?.id;
                  const owned = views.filter((v) => v.workplace.ownerIds.includes(u.id));
                  return (
                    <div key={u.id} role="row" className={cx("grid grid-cols-[2fr_1.2fr_1.6fr_0.7fr] items-center gap-3 border-b border-j-line-soft px-[22px] py-3", !u.active && "opacity-60")}>
                      <span role="cell" className="flex min-w-0 items-center gap-2.5">
                        <Avatar initials={initials(u.name)} size={32} />
                        <span className="min-w-0 leading-[18px]">
                          <b className="block truncate">
                            {u.name}
                            {self && <span className="font-normal text-j-muted"> (you)</span>}
                          </b>
                          <span className="block truncate text-xs text-j-muted">{u.email}</span>
                        </span>
                      </span>
                      <span role="cell">
                        <select
                          aria-label={`Role of ${u.name}`}
                          value={u.role}
                          disabled={self}
                          title={self ? "You cannot change your own role" : undefined}
                          onChange={(e) => {
                            const next = e.target.value as Role;
                            updateUser(u.id, (d) => {
                              d.role = next;
                              if (next !== "control") delete d.entityId;
                            });
                            log(`${u.name} is now ${ROLE_OF[next].label}`);
                          }}
                          className={cx(inputClass, "h-9 w-full")}
                        >
                          {ROLES.map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </span>
                      <span role="cell" className="min-w-0 text-[13px] text-j-ink-2">
                        {u.role === "control" ? (
                          <EntityPicker value={u.entityId} department={u.department} onChange={(entityId, department) => updateUser(u.id, (d) => ((d.entityId = entityId || undefined), (d.department = department || undefined)))} />
                        ) : u.role === "owner" ? (
                          <span className="block truncate" title={owned.map(wpLabel).join("\n")}>
                            {owned.length ? `${owned.length} workspace${owned.length === 1 ? "" : "s"}: ${owned.map((v) => v.entity.name).join(", ")}` : "No workspaces yet"}
                          </span>
                        ) : u.role === "admin" ? (
                          "Whole platform"
                        ) : (
                          "Dashboards and reports"
                        )}
                      </span>
                      <span role="cell">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={u.active}
                          aria-label={`${u.name} can sign in`}
                          disabled={self}
                          onClick={() => {
                            updateUser(u.id, (d) => void (d.active = !u.active));
                            log(`${u.name} ${u.active ? "switched off" : "switched on"}`);
                          }}
                          className={cx("flex h-6 w-11 flex-none cursor-pointer items-center rounded-full border-0 p-0.5 disabled:cursor-not-allowed disabled:opacity-50", u.active ? "justify-end bg-cx" : "justify-start bg-j-field")}
                        >
                          <span className="h-5 w-5 rounded-full bg-white" />
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="m-0 px-[22px] py-3 text-xs text-j-muted">Index Owners get their workspaces under Workspaces › New workspace, or when their request is approved.</p>
          </Panel>
        )}
      </JMain>
    </AppShell>
  );
}

function EntityPicker({ value, department, onChange }: { value?: string; department?: string; onChange: (entityId: string, department: string) => void }) {
  const { clients } = useJourney();
  return (
    <span className="flex gap-1.5">
      <select aria-label="Entity" value={value ?? ""} onChange={(e) => onChange(e.target.value, department ?? "")} className={cx(inputClass, "h-9 min-w-0 flex-auto")}>
        <option value="">Any entity</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <input aria-label="Department" placeholder="Department" defaultValue={department ?? ""} onBlur={(e) => e.target.value !== (department ?? "") && onChange(value ?? "", e.target.value.trim())} className={cx(inputClass, "h-9 w-[130px]")} />
    </span>
  );
}

function RequestCard({ r, views, onDone }: { r: AccessRequest; views: WorkplaceView[]; onDone: (text: string) => void }) {
  const { approve, reject } = useAuth();
  const { clients, saveWorkplace } = useJourney();
  // A request from someone at an entity on the platform is most likely a control owner there.
  const match = clients.find((c) => c.name.toLowerCase() === r.organisation.toLowerCase());
  const [role, setRole] = useState<Role>("control");
  const [entityId, setEntityId] = useState(match?.id ?? "");
  const [department, setDepartment] = useState("");
  const [owns, setOwns] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  return (
    <Panel className="flex flex-col gap-4 p-[22px]">
      <div className="flex flex-wrap items-start gap-3">
        <Avatar initials={initials(r.name)} size={40} />
        <span className="min-w-[220px] flex-auto text-sm leading-5">
          <b className="text-base">{r.name}</b>
          <br />
          <span className="text-j-ink-2">{r.email}</span>
          <br />
          <span className="text-xs text-j-muted">
            {r.title ? `${r.title} · ` : ""}
            {r.organisation} · requested {r.at}
          </span>
        </span>
        <Pill tone="warn">Waiting</Pill>
      </div>
      {r.reason && <p className="m-0 rounded-xl bg-j-canvas px-3.5 py-2.5 text-sm text-j-ink-2">“{r.reason}”</p>}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
            {ROLES.map((x) => (
              <option key={x.key} value={x.key}>
                {x.label}
              </option>
            ))}
          </select>
        </Field>
        {role === "control" && (
          <>
            <Field label="Entity">
              <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className={inputClass}>
                <option value="">Choose the entity…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Department">
              <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. IT Operations" className={inputClass} />
            </Field>
          </>
        )}
      </div>
      {role === "owner" && (
        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-[13px] font-semibold text-j-ink-2">Workspaces to run</legend>
          <div className="flex flex-wrap gap-1.5">
            {views.map((v) => {
              const on = owns.includes(v.workplace.id);
              return (
                <button
                  key={v.workplace.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setOwns(on ? owns.filter((x) => x !== v.workplace.id) : [...owns, v.workplace.id])}
                  className={cx("h-8 cursor-pointer rounded-full border px-3 text-xs font-semibold", on ? "border-cx bg-cx text-white" : "border-j-line bg-white text-j-ink-2")}
                >
                  {wpLabel(v)}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <p className="m-0 text-xs text-j-muted">{ROLE_OF[role].about}</p>

      {rejecting ? (
        <div className="flex flex-wrap items-center gap-2">
          <input autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional, kept on record)" className={cx(inputClass, "min-w-[260px] flex-auto")} />
          <JButton
            variant="dark"
            onClick={() => {
              reject(r.id, note);
              onDone(`Access request rejected · ${r.name}`);
            }}
          >
            Reject request
          </JButton>
          <JButton variant="ghost" onClick={() => setRejecting(false)}>
            Cancel
          </JButton>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <JButton
            variant="primary"
            disabled={role === "control" && !entityId}
            title={role === "control" && !entityId ? "Choose the Control Owner's entity" : undefined}
            onClick={() => {
              const id = approve(r.id, { role, entityId, department });
              for (const v of views.filter((x) => owns.includes(x.workplace.id))) saveWorkplace({ ...v.workplace, ownerIds: [...v.workplace.ownerIds, id] });
              onDone(`Access approved · ${r.name} as ${ROLE_OF[role].label}`);
            }}
          >
            <Icon name="check" size={15} />
            Approve as {ROLE_OF[role].label}
          </JButton>
          <JButton onClick={() => setRejecting(true)}>Reject</JButton>
        </div>
      )}
    </Panel>
  );
}
