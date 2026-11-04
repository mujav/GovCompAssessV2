"use client";

import { useMemo, useState } from "react";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Avatar, Field, inputClass, JButton, Panel, PanelHead, Pill } from "@/components/journey/ui";
import { Drawer } from "@/components/overlay";
import { ClosedBanner, fmtWhen, Modal, Row, Table, useToast } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { ROLE_OF, type Role, type StoredUser } from "@/lib/auth/accounts";
import { useAuth } from "@/lib/auth/store";
import { useJourney } from "@/lib/journey/store";
import { initialsOf } from "@/lib/journey/people";
import { recordAudit } from "@/lib/audit";
import { useCycle } from "@/lib/cycle/use-cycle";
import { DEPARTMENTS } from "@/lib/workspace/data";

type Member = StoredUser & { workspaceRole: "control" | "viewer" };

const statusOf = (u: StoredUser) => (!u.active ? "Deactivated" : u.invited ? "Invited" : "Active");

export default function PeoplePage() {
  const cy = useCycle();
  const { client, controls, workplace, closed, label, me, role } = cy;
  const { user, users, updateUser, invite, resetPassword } = useAuth();
  const { saveWorkplace } = useJourney();
  const { say, toast } = useToast();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [addOwner, setAddOwner] = useState("");
  const admin = user?.role === "admin";

  const indexOwners = users.filter((u) => workplace?.ownerIds.includes(u.id));
  const members: Member[] = useMemo(
    () => [
      ...users.filter((u) => u.role === "control" && (!u.entityId || u.entityId === client.entityId)).map((u) => ({ ...u, workspaceRole: "control" as const })),
      ...users.filter((u) => u.role === "viewer" && !!u.workspaceIds?.includes(client.id)).map((u) => ({ ...u, workspaceRole: "viewer" as const })),
    ],
    [users, client.entityId, client.id],
  );
  const owned = (name: string) => controls.filter((c) => c.applicable && c.owner === name);
  const rows = members.filter((m) => !q || `${m.name} ${m.email} ${m.department ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const current = members.find((m) => m.id === sel);
  const departments = [...new Set([...Object.values(DEPARTMENTS).map((d) => d.name), ...members.map((m) => m.department).filter(Boolean) as string[]])].sort();
  const audit = (action: string, after?: string) => recordAudit({ user: me, role, type: "Grant", action, workspace: label, after });

  return (
    <ClientShell search="Search people">
      <JMain max={1240}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <Pill tone="cx" className="self-start">
              This workspace only
            </Pill>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">People and access</h1>
          </div>
          <JButton variant="primary" disabled={closed} onClick={() => setInviting(true)}>
            + Invite person
          </JButton>
        </div>
        <ClosedBanner show={closed} />

        <Panel className="flex flex-col gap-3 p-[22px]">
          <PanelHead title="Index Owners" aside={<span className="text-xs text-j-muted">Added and removed by the Platform Admin</span>} />
          <div className="flex flex-wrap gap-2.5">
            {indexOwners.map((u) => (
              <span key={u.id} className="flex items-center gap-2 rounded-xl border border-j-line px-3 py-2 text-sm">
                <Avatar initials={initialsOf(u.name)} size={28} />
                <b>{u.name}</b>
                <span className="text-xs text-j-muted">{u.email}</span>
                {admin && workplace && indexOwners.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove ${u.name}`}
                    onClick={() => {
                      saveWorkplace({ ...workplace, ownerIds: workplace.ownerIds.filter((x) => x !== u.id) });
                      audit(`Removed Index Owner ${u.name}`);
                    }}
                    className="cursor-pointer border-0 bg-transparent text-j-muted"
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
          {admin && workplace ? (
            <span className="flex flex-wrap gap-2">
              <select aria-label="Index Owner to add" value={addOwner} onChange={(e) => setAddOwner(e.target.value)} className={cx(inputClass, "h-10")}>
                <option value="">Choose an Index Owner…</option>
                {users.filter((u) => u.role === "owner" && u.active && !workplace.ownerIds.includes(u.id)).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.email}
                  </option>
                ))}
              </select>
              <JButton
                disabled={!addOwner}
                onClick={() => {
                  saveWorkplace({ ...workplace, ownerIds: [...workplace.ownerIds, addOwner] });
                  audit(`Added Index Owner ${users.find((u) => u.id === addOwner)?.name}`);
                  setAddOwner("");
                  say("Index Owner added");
                }}
              >
                + Add Index Owner
              </JButton>
            </span>
          ) : (
            <span className="text-xs text-j-muted">+ Add Index Owner · Platform Admin only</span>
          )}
        </Panel>

        <Panel className="flex flex-col py-[18px]">
          <PanelHead
            className="px-[22px] pb-3"
            title="Control Owners and viewers"
            aside={<input aria-label="Search people" placeholder="Search people" value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputClass, "h-10 w-[240px]")} />}
          />
          <Table label="People" cols="2fr 1.1fr 1.2fr 0.7fr 0.9fr" head={["Person", "Role", "Department", "Controls", "Status"]}>
            {rows.map((m) => {
              const st = statusOf(m);
              return (
                <Row key={m.id} cols="2fr 1.1fr 1.2fr 0.7fr 0.9fr" onClick={() => setSel(m.id)} selected={sel === m.id} className={cx(!m.active && "opacity-60")}>
                  <span className="flex items-center gap-2.5">
                    <Avatar initials={initialsOf(m.name)} size={30} />
                    <span className="min-w-0">
                      <b className="block truncate">{m.name}</b>
                      <span className="block truncate text-xs text-j-muted">{m.email}</span>
                    </span>
                  </span>
                  <span>{ROLE_OF[m.workspaceRole].label}</span>
                  <span>{m.department ?? "–"}</span>
                  <span>{m.workspaceRole === "control" ? owned(m.name).length : "–"}</span>
                  <Pill tone={st === "Active" ? "ok" : st === "Invited" ? "warn" : "gray"}>{st}</Pill>
                </Row>
              );
            })}
          </Table>
        </Panel>
      </JMain>

      <PersonDrawer
        key={current?.id}
        person={current}
        onClose={() => setSel(null)}
        departments={departments}
        controls={controls.filter((c) => c.applicable)}
        closed={closed}
        onSave={(changes, mapped) => {
          if (!current) return;
          updateUser(current.id, (u) => {
            u.name = changes.name;
            u.email = changes.email;
            u.department = changes.department || undefined;
            if (changes.role !== current.workspaceRole) {
              u.role = changes.role;
              if (changes.role === "viewer") u.workspaceIds = [...new Set([...(u.workspaceIds ?? []), client.id])];
            }
          });
          const was = owned(current.name).map((c) => c.code);
          const added = mapped.filter((c) => !was.includes(c));
          if (added.length) cy.updatePlan(added, { owner: changes.name }, `Mapped to ${changes.name} in People and access`, 1);
          audit(`Updated ${changes.name}'s access`, `${ROLE_OF[changes.role].label} · ${mapped.length} controls`);
          say(`Saved · ${changes.name} notified`);
        }}
        onResend={() => current && (audit(`Resent invite to ${current.name}`), say(`Invite resent to ${current.email}`))}
        onReset={() => current && (resetPassword(current.id), audit(`Reset password for ${current.name}`), say(`Reset link sent to ${current.email}`))}
        onDeactivate={() => {
          if (!current) return;
          updateUser(current.id, (u) => void (u.active = !u.active));
          audit(`${current.active ? "Deactivated" : "Reactivated"} ${current.name}`);
          say(`${current.name} ${current.active ? "deactivated" : "reactivated"}`);
        }}
        owned={current ? owned(current.name).map((c) => c.code) : []}
      />

      <InviteDialog
        open={inviting}
        onClose={() => setInviting(false)}
        departments={departments}
        controls={controls.filter((c) => c.applicable)}
        onInvite={(n, mapped) => {
          const res = invite({ name: n.name, email: n.email, role: n.role, entityId: n.role === "control" ? client.entityId : undefined, department: n.department, workspaceIds: n.role === "viewer" ? [client.id] : undefined });
          if ("error" in res) return res.error;
          if (mapped.length) cy.updatePlan(mapped, { owner: n.name.trim() }, `Mapped to ${n.name.trim()} on invitation`, 1);
          audit(`Invited ${n.name} as ${ROLE_OF[n.role].label}`, `${mapped.length} controls`);
          say(`Invite sent to ${n.email}`);
          setInviting(false);
          return undefined;
        }}
      />
      {toast}
    </ClientShell>
  );
}

type Changes = { name: string; email: string; role: "control" | "viewer"; department: string };

function ControlPicker({ controls, chosen, onChange }: { controls: { code: string; title: string; owner: string }[]; chosen: string[]; onChange: (v: string[]) => void }) {
  const [q, setQ] = useState("");
  const list = controls.filter((c) => !q || `${c.code} ${c.title}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">Mapped controls · {chosen.length}</span>
      <input aria-label="Search controls" placeholder="⌕ Search controls" value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputClass, "h-9")} />
      <div className="flex max-h-[240px] flex-col overflow-y-auto rounded-xl border border-j-line">
        {list.map((c) => (
          <label key={c.code} className="flex items-center gap-2 border-b border-j-line-soft px-3 py-2 text-[13px] last:border-0">
            <input type="checkbox" checked={chosen.includes(c.code)} onChange={(e) => onChange(e.target.checked ? [...chosen, c.code] : chosen.filter((x) => x !== c.code))} />
            <b className="font-mono text-xs">{c.code}</b>
            <span className="flex-auto truncate">{c.title}</span>
            <span className="text-xs text-j-muted">{c.owner}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function PersonDrawer({
  person,
  onClose,
  departments,
  controls,
  owned,
  closed,
  onSave,
  onResend,
  onReset,
  onDeactivate,
}: {
  person?: Member;
  onClose: () => void;
  departments: string[];
  controls: { code: string; title: string; owner: string }[];
  owned: string[];
  closed: boolean;
  onSave: (c: Changes, mapped: string[]) => void;
  onResend: () => void;
  onReset: () => void;
  onDeactivate: () => void;
}) {
  const [f, setF] = useState<Changes>({ name: person?.name ?? "", email: person?.email ?? "", role: person?.workspaceRole ?? "control", department: person?.department ?? "" });
  const [mapped, setMapped] = useState<string[]>(owned);
  return (
    <Drawer
      open={!!person}
      onClose={onClose}
      eyebrow={person ? `${statusOf(person)}${person.lastActive ? ` · last active ${fmtWhen(person.lastActive)}` : ""}` : ""}
      title={person?.name ?? ""}
      footer={
        <>
          {person?.invited && <JButton onClick={onResend}>Resend invite</JButton>}
          <JButton onClick={onReset}>Reset password</JButton>
          <JButton onClick={onDeactivate}>{person?.active ? "Deactivate" : "Reactivate"}</JButton>
          <JButton variant="primary" disabled={closed || !f.name.trim()} onClick={() => (onSave(f, mapped), onClose())}>
            Save changes
          </JButton>
        </>
      }
    >
      <Field label="Full name">
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Work email">
        <input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputClass} />
      </Field>
      <Field label="Role in this workspace">
        <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Changes["role"] })} className={inputClass}>
          <option value="control">Control Owner</option>
          <option value="viewer">Management Viewer</option>
          <option disabled>Index Owner – Platform Admin only</option>
        </select>
      </Field>
      <Field label="Department">
        <select value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} className={inputClass}>
          <option value="">No department</option>
          {departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </Field>
      {f.role === "control" && <ControlPicker controls={controls} chosen={mapped} onChange={setMapped} />}
    </Drawer>
  );
}

function InviteDialog({ open, onClose, departments, controls, onInvite }: { open: boolean; onClose: () => void; departments: string[]; controls: { code: string; title: string; owner: string }[]; onInvite: (n: { name: string; email: string; role: Role & ("control" | "viewer"); department: string }, mapped: string[]) => string | undefined }) {
  const [f, setF] = useState<{ name: string; email: string; role: "control" | "viewer"; department: string }>({ name: "", email: "", role: "control", department: departments[0] ?? "" });
  const [mapped, setMapped] = useState<string[]>([]);
  const [err, setErr] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite person"
      wide
      footer={
        <>
          <JButton onClick={onClose}>Cancel</JButton>
          <JButton
            variant="primary"
            onClick={() => {
              const e = onInvite(f, mapped);
              if (e) setErr(e);
              else {
                setF({ name: "", email: "", role: "control", department: departments[0] ?? "" });
                setMapped([]);
                setErr("");
              }
            }}
          >
            Send invite
          </JButton>
        </>
      }
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <Field label="Full name">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Work email">
          <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Role in this workspace">
          <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as "control" | "viewer" })} className={inputClass}>
            <option value="control">Control Owner</option>
            <option value="viewer">Management Viewer</option>
            <option disabled>Index Owner – Platform Admin only</option>
          </select>
        </Field>
        <Field label="Department">
          <select value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} className={inputClass}>
            {departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>
      </div>
      {f.role === "control" && <ControlPicker controls={controls} chosen={mapped} onChange={setMapped} />}
      {err && <p className="m-0 text-sm text-j-bad">{err}</p>}
    </Modal>
  );
}
