"use client";

import { useMemo } from "react";
import { useCurrentClient } from "@/components/journey/shell";
import { useAdmin } from "@/lib/admin/store";
import { SUBMISSION_DEADLINE, type WsRequirement } from "@/lib/workspace/data";
import { useWorkspace } from "@/lib/workspace/store";
import { assignmentKey, entityFrameworks, libraryRequirements, usesWorkspaceRecords, withAssignments, WORKSPACE_FRAMEWORK_ID, type ClientRequirement, type EntityFramework } from "./frameworks";
import { evidenceKey, type EvidenceState } from "./evidence";
import { DEMO_DIRECTORY, PEOPLE_KEY, type EntityPerson } from "./people";
import { useJourney, useScreenState } from "./store";
import { useControlOwners, type WorkplaceView } from "./use-workplaces";
import { useAuth } from "@/lib/auth/store";
import type { Workplace, WorkplaceClient } from "./workplaces";
import type { StoredUser } from "@/lib/auth/accounts";
import { controlKey, oneOwnerPerControl } from "@/lib/cycle/model";
import { EMPTY_OVERLAY, stageCounts, stageOf, isReturned, type EvidenceSignal, type Stage, type WorkOverlay } from "./work";

export const ALL = "all";

/** The entity's frameworks and which one the client pages show. "all" is only offered by the overview. */
export function useEntityFrameworks() {
  const client = useCurrentClient();
  const { state } = useAdmin();
  const frameworks = useMemo(() => entityFrameworks(client, state.frameworks), [client, state.frameworks]);
  const [choice, setChoice] = useScreenState<{ id: string }>(`framework.${client.id}`, { id: "" });
  const chosen = choice.id;
  const valid = chosen === ALL || frameworks.some((f) => f.id === chosen);
  const active = valid && chosen ? chosen : frameworks.length > 1 ? ALL : (frameworks[0]?.id ?? "");
  /** The framework single-framework pages show: the active one, or the first when "all" is active. */
  const current: EntityFramework | undefined = frameworks.find((f) => f.id === active) ?? frameworks[0];
  return { frameworks, active, current, setActive: (id: string) => setChoice((d) => void (d.id = id)) };
}

/** The entity's people (from onboarding or Entity 360); seeded demo clients start from the demo directory. */
export function useEntityPeople() {
  const client = useCurrentClient();
  const { state } = useJourney();
  const onboarded = state.added.some((a) => a.client.id === client.entityId);
  return useScreenState<EntityPerson[]>(PEOPLE_KEY(client.entityId), onboarded ? [] : DEMO_DIRECTORY);
}

/** Control owners of the workplace's entity, as the people requirements are assigned to. */
export function useAssignees(): EntityPerson[] {
  const client = useCurrentClient();
  const owners = useControlOwners(client.entityId);
  return useMemo(() => owners.map(asPerson), [owners]);
}

const asPerson = (u: StoredUser): EntityPerson => ({ id: u.id, name: u.name, email: u.email, department: u.department ?? "", title: u.title ?? "", roles: ["Control Owner"], access: "user" });

/**
 * Seeded workplaces on the workspace framework share the demo records; a workplace the admin
 * added and every newly onboarded entity start from the library.
 */
export function startsFresh(client: WorkplaceClient, workplace: Workplace | undefined, added: { client: { id: string } }[]) {
  return !!workplace?.createdAt || added.some((a) => a.client.id === client.entityId);
}

/** Assignments of library requirements: an entity's first workplace keeps the original per-framework keys. */
const assignScope = (client: WorkplaceClient, fwId: string) => (client.id === client.entityId ? fwId : `${client.id}|${fwId}`);

// The workspace framework keeps its original slice so earlier moves are not lost.
const overlayKey = (clientId: string, fwId: string) => (fwId === WORKSPACE_FRAMEWORK_ID ? `work.${clientId}` : `work.${clientId}.${fwId}`);

/** One framework's requirement list for an entity: the shared workspace records, or fresh items from the library. */
export function frameworkRequirements(
  framework: EntityFramework | undefined,
  workspace: boolean,
  wsReqs: WsRequirement[],
  assignments: Record<string, { owner: string; due: string }> = {},
  people: EntityPerson[] = [],
  scope = framework?.id ?? "",
): ClientRequirement[] {
  const library = framework ? libraryRequirements(framework.live) : [];
  if (!workspace) return framework ? withAssignments(scope, library, assignments, people) : library;
  // Workspace records carry the work state and the standard's own wording.
  const fwId = framework?.id ?? WORKSPACE_FRAMEWORK_ID;
  return wsReqs.filter((r) => (r.frameworkId ?? WORKSPACE_FRAMEWORK_ID) === fwId);
}

export type WorkRequirement = ClientRequirement & { upload?: EvidenceSignal };

/** Requirements the Index Owner added in the workspace's standard builder, as fresh work items. */
function withTailoring(reqs: ClientRequirement[], cycle: unknown, assignments: Record<string, { owner: string; due: string }>, scope: string, workspace: boolean): ClientRequirement[] {
  const added = (cycle as { standard?: { added?: Record<string, { title: string; dimension: string }> } } | undefined)?.standard?.added;
  if (!added) return reqs;
  const extra = Object.entries(added)
    .filter(([code]) => !reqs.some((r) => r.code === code))
    .map(([code, a]): ClientRequirement => {
      const as = assignments[workspace ? code : assignmentKey(scope, code)];
      return { code, title: a.title, domain: a.dimension, weight: "med", status: "nas", mandatoryFail: false, department: "", owner: as?.owner ?? "", work: "none", due: as?.due ?? SUBMISSION_DEADLINE, review: "none", evidence: { expected: 1, valid: 0, invalid: 0 } };
    });
  return [...reqs, ...extra];
}

/** Drops requirements of controls the Index Owner marked not applicable in this workspace. */
/** Every requirement belongs to its control's one Control Owner. */
function withControlOwners<R extends WorkRequirement>(reqs: R[], cycle: unknown): R[] {
  return oneOwnerPerControl(reqs, (cycle as { plan?: Record<string, { owner?: string; department?: string }> } | undefined)?.plan);
}

/** Drops requirements the Index Owner marked not applicable in this workspace, on their own or with their whole control. */
function withoutNa<R extends { code: string }>(reqs: R[], cycle: unknown): R[] {
  const plan = (cycle as { plan?: Record<string, { na?: unknown }> } | undefined)?.plan;
  if (!plan) return reqs;
  return reqs.filter((r) => !plan[controlKey(r)]?.na && !plan[r.code]?.na);
}

/** Requirements the Index Owner marked not applicable on their own read as N/A on every screen; their control stays. */
function withReqNa<R extends { code: string; status: string }>(reqs: R[], cycle: unknown): R[] {
  const plan = (cycle as { plan?: Record<string, { na?: unknown }> } | undefined)?.plan;
  if (!plan) return reqs;
  return reqs.map((r) => (r.code !== controlKey(r) && plan[r.code]?.na ? { ...r, status: "na" } : r));
}

/** Files uploaded on each requirement count as received evidence everywhere the requirement is shown, and move its stage on. */
function withUploads(reqs: ClientRequirement[], clientId: string, fwId: string, screens: Record<string, unknown>): WorkRequirement[] {
  return reqs.map((r) => {
    const ev = screens[evidenceKey(clientId, fwId, r.code)] as EvidenceState | undefined;
    const ids = (ev?.files ?? []).filter((f) => !f.error).map((f) => f.id);
    if (!ids.length && !ev?.run) return r;
    const run = ev?.run;
    const assessed = !!run && ids.length > 0 && run.fileIds.length === ids.length && ids.every((id) => run.fileIds.includes(id));
    const upload: EvidenceSignal = { files: ids.length, assessed, sig: `${ids.join(",")}|${run?.runId ?? ""}` };
    const n = ids.length;
    return { ...r, upload, evidence: n ? { ...r.evidence, valid: r.evidence.valid + n, expected: Math.max(r.evidence.expected, r.evidence.valid + n) } : r.evidence };
  });
}

/** Every framework of the entity with its requirements and stage moves, for the all-frameworks overview. */
export function useAllFrameworkWork() {
  const client = useCurrentClient();
  const ws = useWorkspace();
  const { state } = useJourney();
  const { frameworks } = useEntityFrameworks();
  const people = useAssignees();
  const { workplaces } = useJourney();
  const fresh = startsFresh(client, workplaces.find((w) => w.id === client.id), state.added);
  return useMemo(
    () =>
      frameworks.map((f) => {
        const workspace = usesWorkspaceRecords(f.id, fresh);
        return { framework: f, workspace, reqs: withControlOwners(withUploads(frameworkRequirements(f, workspace, ws.ctx.reqs, ws.state.assignments, people, assignScope(client, f.id)), client.id, f.id, state.screens), state.screens[`cycle.${client.id}`]), overlay: (state.screens[overlayKey(client.id, f.id)] as WorkOverlay | undefined) ?? EMPTY_OVERLAY };
      }),
    [frameworks, fresh, ws.ctx.reqs, ws.state.assignments, people, state.screens, client],
  );
}

/** Requirements and the consultant's stage moves for one framework of one entity. */
export function useFrameworkWork(framework: EntityFramework | undefined) {
  const client = useCurrentClient();
  const ws = useWorkspace();
  const { state, log, workplaces, update } = useJourney();
  const fwId = framework?.id ?? WORKSPACE_FRAMEWORK_ID;
  const workspace = usesWorkspaceRecords(fwId, startsFresh(client, workplaces.find((w) => w.id === client.id), state.added));
  const people = useAssignees();
  const [overlay, setOverlay] = useScreenState<WorkOverlay>(overlayKey(client.id, fwId), EMPTY_OVERLAY);
  const scope = assignScope(client, fwId);
  const reqs = useMemo(
    () => withReqNa(withControlOwners(withUploads(withTailoring(frameworkRequirements(framework, workspace, ws.ctx.reqs, ws.state.assignments, people, scope), state.screens[`cycle.${client.id}`], ws.state.assignments, scope, workspace), client.id, fwId, state.screens), state.screens[`cycle.${client.id}`]), state.screens[`cycle.${client.id}`]),
    [framework, workspace, ws.ctx.reqs, ws.state.assignments, people, scope, client.id, fwId, state.screens],
  );

  // A closed cycle is read-only: nothing moves, nothing is reassigned.
  // A year closes with its last cycle (one closure only, before workspaces had cycles).
  const saved = state.screens[`cycle.${client.id}`] as { closure?: { closedAt?: string }; cycles?: { closure?: { closedAt?: string } }[] } | undefined;
  const closed = saved?.cycles?.length ? saved.cycles.every((p) => !!p.closure?.closedAt) : !!saved?.closure?.closedAt;

  /** Assigns requirements to a Control Owner (their department follows), due on the given date. A control has one owner, so its other requirements go with them. */
  const assign = (codes: string[], person: string, due: string) => {
    if (closed) return;
    const controls = new Set(codes.map((c) => controlKey(reqs.find((r) => r.code === c) ?? { code: c })));
    const all = [...new Set([...codes, ...reqs.filter((r) => controls.has(controlKey(r))).map((r) => r.code)])];
    for (const c of all) ws.assign(workspace ? c : assignmentKey(scope, c), person, due);
    // An owner set in the plan would override the assignment, so it follows too.
    update((s) => {
      const plan = (s.screens[`cycle.${client.id}`] as { plan?: Record<string, { owner?: string; department?: string }> } | undefined)?.plan;
      for (const k of controls) {
        if (!plan?.[k]?.owner) continue;
        delete plan[k].owner;
        delete plan[k].department;
      }
    });
  };

  // A move holds against the evidence as it stands now; only evidence that changes afterwards moves it on.
  const remember = (o: WorkOverlay, codes: string[]) => {
    o.seen ??= {};
    for (const c of codes) o.seen[c] = reqs.find((x) => x.code === c)?.upload?.sig ?? "";
  };

  const move = (codes: string[], to: Stage, text?: string) => {
    if (!codes.length || closed) return;
    setOverlay((o) => {
      for (const c of codes) o.stage[c] = to;
      o.returned = o.returned.filter((c) => !codes.includes(c));
      remember(o, codes);
    });
    if (text) log(text);
  };

  const ret = (codes: string[], text?: string) => {
    if (closed) return;
    setOverlay((o) => {
      for (const c of codes) {
        o.stage[c] = "prog";
        if (!o.returned.includes(c)) o.returned.push(c);
      }
      remember(o, codes);
    });
    if (text) log(text);
  };

  return {
    client,
    ws,
    framework,
    /** True when the list comes from the shared workspace records (with evidence, issues and reviews). */
    workspace,
    reqs,
    overlay,
    stage: (code: string) => {
      const r = reqs.find((x) => x.code === code);
      return r ? stageOf(r, overlay) : "start";
    },
    returned: (code: string) => {
      const r = reqs.find((x) => x.code === code);
      return r ? isReturned(r, overlay) : false;
    },
    move,
    ret,
    assign,
    people,
    log,
    /** The cycle was closed; the workspace is read-only. */
    closed,
  };
}

/** Workspace records for the client in the URL and its active framework, with the consultant's moves applied. */
export function useClientWork() {
  const { current } = useEntityFrameworks();
  return useFrameworkWork(current);
}

/** Requirements and stage moves of every workplace the user can see, for landing pages and dashboards. */
export function useWorkplacesWork(views: WorkplaceView[]) {
  const ws = useWorkspace();
  const { state } = useJourney();
  const { users } = useAuth();
  return useMemo(
    () =>
      views.map((v) => {
        const fwId = v.framework?.id ?? v.workplace.frameworkId;
        const workspace = usesWorkspaceRecords(fwId, startsFresh(v.client, v.workplace, state.added));
        const people = users.filter((u) => u.role === "control" && (!u.entityId || u.entityId === v.workplace.entityId)).map(asPerson);
        const scope = assignScope(v.client, fwId);
        const cycle = state.screens[`cycle.${v.client.id}`];
        const reqs = withControlOwners(withoutNa(withUploads(withTailoring(frameworkRequirements(v.framework, workspace, ws.ctx.reqs, ws.state.assignments, people, scope), cycle, ws.state.assignments, scope, workspace), v.client.id, fwId, state.screens), cycle), cycle);
        const overlay = (state.screens[overlayKey(v.client.id, fwId)] as WorkOverlay | undefined) ?? EMPTY_OVERLAY;
        return { ...v, workspace, reqs, overlay, counts: stageCounts(reqs, overlay) };
      }),
    [views, ws.ctx.reqs, ws.state.assignments, users, state.added, state.screens],
  );
}
