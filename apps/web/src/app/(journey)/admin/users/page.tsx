"use client";

import { useState } from "react";
import { AppShell, JMain } from "@/components/journey/shell";
import {
  Avatar,
  Field,
  inputClass,
  JButton,
  JLink,
  Panel,
  PanelHead,
  Pill,
} from "@/components/journey/ui";
import { Drawer } from "@/components/overlay";
import {
  fmtWhen,
  Kpi,
  Modal,
  Row,
  Switch,
  Table,
  useToast,
} from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import {
  ROLE_OF,
  ROLES,
  type Role,
  type StoredUser,
} from "@/lib/auth/accounts";
import { useAuth } from "@/lib/auth/store";
import { recordAudit } from "@/lib/audit";
import { initialsOf } from "@/lib/journey/people";
import { useJourney } from "@/lib/journey/store";
import {
  useWorkplaces,
  type WorkplaceView,
} from "@/lib/journey/use-workplaces";
import { workplaceLabel } from "@/lib/journey/workplaces";
import { usePlatform } from "@/lib/cycle/use-cycle";

const ALL = "all";
const statusOf = (u: StoredUser) =>
  !u.active ? "Deactivated" : u.invited ? "Invited" : "Active";
const wsLabel = (v: WorkplaceView) =>
  `${v.entity.name} · ${workplaceLabel(v.framework?.name ?? v.client.frameworks[0] ?? "", v.workplace.year)}`;

/** Workspaces a user holds a role in, as the platform resolves it. */
function rolesOf(u: StoredUser, views: WorkplaceView[]) {
  if (u.role === "admin") return [];
  if (u.role === "owner")
    return views.filter((v) => v.workplace.ownerIds.includes(u.id));
  if (u.role === "control")
    return views.filter(
      (v) => !u.entityId || v.workplace.entityId === u.entityId,
    );
  return views.filter((v) => (u.workspaceIds ?? []).includes(v.client.id));
}

// S20 · Platform Admin: everyone with an account, their roles in each workspace and sign-in status.

export default function UsersPage() {
  const {
    users,
    user: me,
    requests,
    updateUser,
    invite,
    resetPassword,
  } = useAuth();
  const views = useWorkplaces();
  const { clients, saveWorkplace } = useJourney();
  const { platform, setPlatform } = usePlatform();
  const { say, toast } = useToast();
  const [q, setQ] = useState("");
  const [role, setRole] = useState(ALL);
  const [entity, setEntity] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [sel, setSel] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const pendingAccess = requests.filter((r) => r.status === "pending").length;
  const audit = (action: string, after?: string) =>
    recordAudit({
      user: me?.name ?? "",
      role: "Platform Admin",
      type: "Grant",
      action,
      after,
    });

  const orgOf = (u: StoredUser) =>
    u.entityId
      ? (clients.find((c) => c.id === u.entityId)?.name ?? u.entityId)
      : "EY";
  const shown = users.filter(
    (u) =>
      (!q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())) &&
      (role === ALL || u.role === role) &&
      (entity === ALL ||
        (entity === "ey" ? !u.entityId : u.entityId === entity)) &&
      (status === ALL || statusOf(u) === status),
  );
  const current = users.find((u) => u.id === sel);
  const cols = "2fr 1.2fr 1.8fr 0.9fr 0.8fr";

  return (
    <AppShell search="Search users">
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Platform Admin</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">
              Users
            </h1>
            <p className="m-0 max-w-[760px] text-sm text-j-ink-3">
              Everyone with an account, their roles in each workspace, and
              sign-in status. Index Owners add Control Owners and viewers inside
              their own workspaces.
            </p>
          </div>
          <span className="flex gap-2">
            <JLink href="/admin/access">
              Access requests
              {pendingAccess > 0 && <Pill tone="orange">{pendingAccess}</Pill>}
            </JLink>
            <JButton variant="primary" onClick={() => setInviting(true)}>
              + Invite user
            </JButton>
          </span>
        </div>

        {platform.resets.length > 0 && (
          <Panel className="flex flex-col gap-2 border-[#F0DDB0] bg-[#FFF8EA] px-6 py-4">
            <b className="text-sm">
              Password reset requests · {platform.resets.length}
            </b>
            {platform.resets.map((r) => {
              const u = users.find((x) => x.email === r.email);
              return (
                <span
                  key={r.email + r.at}
                  className="flex flex-wrap items-center gap-2 text-sm"
                >
                  <span className="flex-auto">
                    {r.email} · {fmtWhen(r.at)}{" "}
                    {!u && (
                      <i className="text-j-muted">
                        · no account with this email
                      </i>
                    )}
                  </span>
                  {u && (
                    <JButton
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        resetPassword(u.id);
                        setPlatform(
                          (d) =>
                            void (d.resets = d.resets.filter(
                              (x) => x.email !== r.email,
                            )),
                        );
                        audit(`Reset password for ${u.name}`);
                        say(`Reset link sent to ${u.email}`);
                      }}
                    >
                      Reset password
                    </JButton>
                  )}
                  <JButton
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setPlatform(
                        (d) =>
                          void (d.resets = d.resets.filter(
                            (x) => x.email !== r.email,
                          )),
                      )
                    }
                  >
                    Dismiss
                  </JButton>
                </span>
              );
            })}
          </Panel>
        )}

        <section className="flex flex-wrap gap-3">
          <Kpi
            label="Active users"
            value={users.filter((u) => statusOf(u) === "Active").length}
          />
          <Kpi
            label="Invited, not signed in"
            value={users.filter((u) => statusOf(u) === "Invited").length}
          />
          <Kpi
            label="Index Owners"
            value={users.filter((u) => u.role === "owner" && u.active).length}
          />
          <Kpi
            label="Deactivated"
            value={users.filter((u) => !u.active).length}
          />
        </section>

        <Panel className="flex flex-col py-[18px]">
          <PanelHead
            className="px-[22px] pb-3"
            title="User list"
            aside={
              <span className="flex flex-wrap gap-2">
                <input
                  aria-label="Search"
                  placeholder="Search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className={cx(inputClass, "h-10 w-[180px]")}
                />
                <select
                  aria-label="Role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className={cx(inputClass, "h-10")}
                >
                  <option value={ALL}>All roles</option>
                  {ROLES.map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Entity"
                  value={entity}
                  onChange={(e) => setEntity(e.target.value)}
                  className={cx(inputClass, "h-10")}
                >
                  <option value={ALL}>All entities</option>
                  <option value="ey">EY</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={cx(inputClass, "h-10")}
                >
                  <option value={ALL}>All statuses</option>
                  <option>Active</option>
                  <option>Invited</option>
                  <option>Deactivated</option>
                </select>
              </span>
            }
          />
          <Table
            label="Users"
            cols={cols}
            head={["Name", "Organisation", "Roles", "Last active", "Status"]}
          >
            {shown.map((u) => {
              const ws = rolesOf(u, views);
              const st = statusOf(u);
              return (
                <Row
                  key={u.id}
                  cols={cols}
                  onClick={() => setSel(u.id)}
                  selected={sel === u.id}
                  className={cx(!u.active && "opacity-60")}
                >
                  <span className="flex items-center gap-2.5">
                    <Avatar initials={initialsOf(u.name)} size={30} />
                    <span className="min-w-0">
                      <b className="block truncate">
                        {u.name}
                        {u.id === me?.id && " (you)"}
                      </b>
                      <span className="block truncate text-xs text-j-muted">
                        {u.email}
                      </span>
                    </span>
                  </span>
                  <span>{orgOf(u)}</span>
                  <span className="text-[13px]">
                    {ROLE_OF[u.role].label}
                    {u.role !== "admin" && (
                      <span className="text-j-muted">
                        {" "}
                        · {ws.length} workspace{ws.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
                  <span className="text-[13px]">
                    {u.lastActive ? fmtWhen(u.lastActive) : "–"}
                  </span>
                  <Pill
                    tone={
                      st === "Active"
                        ? "ok"
                        : st === "Invited"
                          ? "warn"
                          : "gray"
                    }
                  >
                    {st}
                  </Pill>
                </Row>
              );
            })}
          </Table>
        </Panel>
      </JMain>

      {current && (
        <UserDrawer
          key={current.id}
          u={current}
          self={current.id === me?.id}
          views={views}
          onClose={() => setSel(null)}
          onReset={() => (
            resetPassword(current.id),
            audit(`Reset password for ${current.name}`),
            say(`Reset link sent to ${current.email}`)
          )}
          onToggle={() => {
            updateUser(current.id, (u) => void (u.active = !u.active));
            audit(
              `${current.active ? "Deactivated" : "Reactivated"} ${current.name}`,
            );
          }}
          onSave={(f, grants) => {
            updateUser(current.id, (u) => {
              u.name = f.name;
              u.email = f.email;
              u.role = f.role;
              u.mfa = f.mfa;
              if (f.role === "viewer") u.workspaceIds = grants;
              if (f.role === "control") u.entityId = f.entityId || undefined;
            });
            if (f.role === "owner")
              for (const v of views) {
                const has = v.workplace.ownerIds.includes(current.id);
                const want = grants.includes(v.client.id);
                if (has !== want)
                  saveWorkplace({
                    ...v.workplace,
                    ownerIds: want
                      ? [...v.workplace.ownerIds, current.id]
                      : v.workplace.ownerIds.filter((x) => x !== current.id),
                  });
              }
            audit(
              `Updated ${f.name}`,
              `${ROLE_OF[f.role].label} · ${grants.length} workspaces`,
            );
            say(`${f.name} saved`);
            setSel(null);
          }}
        />
      )}
      <InviteUser
        open={inviting}
        onClose={() => setInviting(false)}
        views={views}
        entities={clients.map((c) => ({ id: c.id, name: c.name }))}
        onInvite={(f, ws) => {
          if (f.role === "viewer" && !ws.length)
            return "Choose at least one workspace this viewer can see.";
          const res = invite({
            name: f.name,
            email: f.email,
            role: f.role,
            entityId: f.role === "control" ? f.entityId : undefined,
            workspaceIds: f.role === "viewer" ? ws : undefined,
          });
          if ("error" in res) return res.error;
          if (f.role === "owner" && ws.length) {
            const v = views.find((x) => x.client.id === ws[0]);
            if (v)
              saveWorkplace({
                ...v.workplace,
                ownerIds: [...v.workplace.ownerIds, res.id],
              });
          }
          const granted = views
            .filter((v) => ws.includes(v.client.id))
            .map(wsLabel);
          audit(
            `Invited ${f.name} as ${ROLE_OF[f.role].label}`,
            granted.length ? granted.join(", ") : undefined,
          );
          say(`Invite sent to ${f.email}`);
          setInviting(false);
          return undefined;
        }}
      />
      {toast}
    </AppShell>
  );
}

type Form = {
  name: string;
  email: string;
  role: Role;
  mfa: boolean;
  entityId: string;
};

function UserDrawer({
  u,
  self,
  views,
  onClose,
  onSave,
  onReset,
  onToggle,
}: {
  u: StoredUser;
  self: boolean;
  views: WorkplaceView[];
  onClose: () => void;
  onSave: (f: Form, grants: string[]) => void;
  onReset: () => void;
  onToggle: () => void;
}) {
  const [f, setF] = useState<Form>({
    name: u.name,
    email: u.email,
    role: u.role,
    mfa: !!u.mfa,
    entityId: u.entityId ?? "",
  });
  const [grants, setGrants] = useState<string[]>(
    u.role === "owner"
      ? rolesOf(u, views).map((v) => v.client.id)
      : (u.workspaceIds ?? []),
  );
  const [add, setAdd] = useState("");
  const entities = [
    ...new Map(views.map((v) => [v.entity.id, v.entity.name])).entries(),
  ];
  const list =
    f.role === "control"
      ? views.filter((v) => !f.entityId || v.workplace.entityId === f.entityId)
      : views.filter((v) => grants.includes(v.client.id));
  const noViewerGrant = f.role === "viewer" && !grants.length;
  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow={`${statusOf(u)} · since ${u.since}`}
      title={u.name}
      footer={
        <>
          <JButton onClick={onReset}>Reset password</JButton>
          <JButton disabled={self} onClick={onToggle}>
            {u.active ? "Deactivate" : "Reactivate"}
          </JButton>
          <JButton
            variant="primary"
            disabled={noViewerGrant}
            title={noViewerGrant ? "Choose at least one workspace" : undefined}
            onClick={() => onSave(f, grants)}
          >
            Save
          </JButton>
        </>
      }
    >
      <Field label="Full name">
        <input
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          className={inputClass}
        />
      </Field>
      <Field label="Email">
        <input
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
          className={inputClass}
        />
      </Field>
      <span className="flex items-center justify-between gap-2 text-sm">
        <span>
          <b>Platform Admin</b>
          <br />
          <span className="text-xs text-j-muted">
            Can create workspaces and grant Index Owners
          </span>
        </span>
        <Switch
          label="Platform Admin"
          disabled={self}
          on={f.role === "admin"}
          onChange={(v) => setF({ ...f, role: v ? "admin" : "owner" })}
        />
      </span>
      {f.role !== "admin" && (
        <>
          <Field label="Role">
            <select
              value={f.role}
              onChange={(e) => setF({ ...f, role: e.target.value as Role })}
              className={inputClass}
            >
              <option value="owner">Index Owner</option>
              <option value="control">Control Owner</option>
              <option value="viewer">Management Viewer</option>
            </select>
          </Field>
          {f.role === "control" && (
            <Field label="Entity">
              <select
                value={f.entityId}
                onChange={(e) => setF({ ...f, entityId: e.target.value })}
                className={inputClass}
              >
                <option value="">Any entity</option>
                {entities.map(([id, n]) => (
                  <option key={id} value={id}>
                    {n}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {f.role === "viewer" ? (
            <WorkspacePicker
              views={views}
              value={grants}
              onChange={setGrants}
            />
          ) : (
            <div className="flex flex-col gap-1.5">
              <b className="text-[13px]">Workspace roles</b>
              {list.map((v) => (
                <span
                  key={v.client.id}
                  className="flex items-center gap-2 rounded-lg bg-j-canvas px-3 py-2 text-sm"
                >
                  <span className="flex-auto">{wsLabel(v)}</span>
                  <Pill>{ROLE_OF[f.role].label}</Pill>
                  {f.role !== "control" && (
                    <button
                      type="button"
                      onClick={() =>
                        setGrants(grants.filter((x) => x !== v.client.id))
                      }
                      className="cursor-pointer border-0 bg-transparent text-xs font-semibold text-j-ink-3"
                    >
                      Remove
                    </button>
                  )}
                </span>
              ))}
              {f.role !== "control" && (
                <span className="flex gap-2">
                  <select
                    aria-label="Workspace"
                    value={add}
                    onChange={(e) => setAdd(e.target.value)}
                    className={cx(inputClass, "h-10 min-w-0 flex-auto")}
                  >
                    <option value="">Workspace…</option>
                    {views
                      .filter((v) => !grants.includes(v.client.id))
                      .map((v) => (
                        <option key={v.client.id} value={v.client.id}>
                          {wsLabel(v)}
                        </option>
                      ))}
                  </select>
                  <JButton
                    disabled={!add}
                    onClick={() => (setGrants([...grants, add]), setAdd(""))}
                  >
                    Add
                  </JButton>
                </span>
              )}
            </div>
          )}
        </>
      )}
      <span className="flex items-center justify-between gap-2 text-sm">
        <span>
          <b>Two-factor sign-in (MFA)</b>
          <br />
          <span className="text-xs text-j-muted">
            Sign-in: {f.mfa ? "password + MFA" : "password"} ·{" "}
            {u.invited
              ? "invited, not signed in yet"
              : u.lastActive
                ? `last ${fmtWhen(u.lastActive)}`
                : "no sign-in recorded"}
          </span>
        </span>
        <Switch
          label="MFA"
          on={f.mfa}
          onChange={(v) => setF({ ...f, mfa: v })}
        />
      </span>
    </Drawer>
  );
}

function InviteUser({
  open,
  onClose,
  views,
  entities,
  onInvite,
}: {
  open: boolean;
  onClose: () => void;
  views: WorkplaceView[];
  entities: { id: string; name: string }[];
  onInvite: (f: Form, workspaces: string[]) => string | undefined;
}) {
  const [f, setF] = useState<Form>({
    name: "",
    email: "",
    role: "owner",
    mfa: true,
    entityId: "",
  });
  const [ws, setWs] = useState<string[]>([]);
  const [err, setErr] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite user"
      sub="They get an email invitation and set their password on first sign-in."
      footer={
        <>
          <JButton onClick={onClose}>Cancel</JButton>
          <JButton
            variant="primary"
            onClick={() => {
              const e = onInvite(f, ws);
              if (e) setErr(e);
              else {
                setF({
                  name: "",
                  email: "",
                  role: "owner",
                  mfa: true,
                  entityId: "",
                });
                setWs([]);
                setErr("");
              }
            }}
          >
            Send invite
          </JButton>
        </>
      }
    >
      <Field label="Full name">
        <input
          value={f.name}
          onChange={(e) => setF({ ...f, name: e.target.value })}
          className={inputClass}
        />
      </Field>
      <Field label="Email">
        <input
          type="email"
          value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })}
          className={inputClass}
        />
      </Field>
      <Field label="Role">
        <select
          value={f.role}
          onChange={(e) => setF({ ...f, role: e.target.value as Role })}
          className={inputClass}
        >
          {ROLES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
      </Field>
      {f.role === "control" ? (
        <Field label="Entity">
          <select
            value={f.entityId}
            onChange={(e) => setF({ ...f, entityId: e.target.value })}
            className={inputClass}
          >
            <option value="">Choose the entity…</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
      ) : f.role === "viewer" ? (
        <WorkspacePicker views={views} value={ws} onChange={setWs} />
      ) : (
        f.role !== "admin" && (
          <Field label="Workspace">
            <select
              value={ws[0] ?? ""}
              onChange={(e) => setWs(e.target.value ? [e.target.value] : [])}
              className={inputClass}
            >
              <option value="">Choose later…</option>
              {views.map((v) => (
                <option key={v.client.id} value={v.client.id}>
                  {wsLabel(v)}
                </option>
              ))}
            </select>
          </Field>
        )
      )}
      {err && <p className="m-0 text-sm text-j-bad">{err}</p>}
    </Modal>
  );
}

/** The workspaces a Management Viewer may see: only the ones ticked here, never all by default. */
function WorkspacePicker({
  views,
  value,
  onChange,
}: {
  views: WorkplaceView[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const shown = views.filter(
    (v) => !q || wsLabel(v).toLowerCase().includes(q.toLowerCase()),
  );
  const toggle = (id: string) =>
    onChange(
      value.includes(id) ? value.filter((x) => x !== id) : [...value, id],
    );
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className="mb-1.5 p-0 text-[13px] font-bold">
        Workspaces this viewer can see
      </legend>
      <span className="flex items-center gap-2">
        <input
          aria-label="Filter workspaces"
          placeholder="Filter workspaces"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={cx(inputClass, "h-9 min-w-0 flex-auto")}
        />
        <JButton
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange([...new Set([...value, ...shown.map((v) => v.client.id)])])
          }
        >
          Select all
        </JButton>
        <JButton
          size="sm"
          variant="ghost"
          disabled={!value.length}
          onClick={() => onChange([])}
        >
          Clear
        </JButton>
      </span>
      <div className="flex max-h-[240px] flex-col gap-1 overflow-y-auto rounded-[10px] border border-j-line p-1.5">
        {shown.map((v) => (
          <label
            key={v.client.id}
            className={cx(
              "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
              value.includes(v.client.id) ? "bg-j-canvas" : "hover:bg-j-canvas",
            )}
          >
            <input
              type="checkbox"
              checked={value.includes(v.client.id)}
              onChange={() => toggle(v.client.id)}
            />
            <span className="min-w-0 flex-auto truncate">{wsLabel(v)}</span>
          </label>
        ))}
        {!shown.length && (
          <span className="px-2.5 py-2 text-sm text-j-muted">
            No workspace matches.
          </span>
        )}
      </div>
      <span
        className={cx("text-xs", value.length ? "text-j-muted" : "text-j-bad")}
      >
        {value.length
          ? `${value.length} of ${views.length} workspaces selected. The viewer sees only these.`
          : "Choose at least one workspace."}
      </span>
    </fieldset>
  );
}
