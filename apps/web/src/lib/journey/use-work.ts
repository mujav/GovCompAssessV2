"use client";

import { useMemo } from "react";
import { useCurrentClient } from "@/components/journey/shell";
import { useAdmin } from "@/lib/admin/store";
import type { WsRequirement } from "@/lib/workspace/data";
import { useWorkspace } from "@/lib/workspace/store";
import { assignmentKey, entityFrameworks, libraryRequirements, usesWorkspaceRecords, withAssignments, WORKSPACE_FRAMEWORK_ID, type ClientRequirement, type EntityFramework } from "./frameworks";
import { evidenceKey, type EvidenceState } from "./evidence";
import { DEMO_DIRECTORY, PEOPLE_KEY, type EntityPerson } from "./people";
import { useJourney, useScreenState } from "./store";
import { useControlOwners, type WorkplaceView } from "./use-workplaces";
import { useAuth } from "@/lib/auth/store";
import type { Workplace, WorkplaceClient } from "./workplaces";
import type { StoredUser } from "@/lib/auth/accounts";
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

const asPerson = (u: StoredUser): EntityPerson => ({ id: u.id, name: u.name, email: u.email, department: u.department ?? "", title: u.title ?? "", roles: ["Control owner"], access: "user" });

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
  // Workspace records carry the work state; the library adds the official wording where codes match.
  const wording = new Map(library.map((r) => [r.code, r]));
  return wsReqs.map((r) => ({ ...r, text: wording.get(r.code)?.text, evidenceText: wording.get(r.code)?.evidenceText }));
}

export type WorkRequirement = ClientRequirement & { upload?: EvidenceSignal };

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
        return { framework: f, workspace, reqs: withUploads(frameworkRequirements(f, workspace, ws.ctx.reqs, ws.state.assignments, people, assignScope(client, f.id)), client.id, f.id, state.screens), overlay: (state.screens[overlayKey(client.id, f.id)] as WorkOverlay | undefined) ?? EMPTY_OVERLAY };
      }),
    [frameworks, fresh, ws.ctx.reqs, ws.state.assignments, people, state.screens, client],
  );
}

/** Requirements and the consultant's stage moves for one framework of one entity. */
export function useFrameworkWork(framework: EntityFramework | undefined) {
  const client = useCurrentClient();
  const ws = useWorkspace();
  const { state, log, workplaces } = useJourney();
  const fwId = framework?.id ?? WORKSPACE_FRAMEWORK_ID;
  const workspace = usesWorkspaceRecords(fwId, startsFresh(client, workplaces.find((w) => w.id === client.id), state.added));
  const people = useAssignees();
  const [overlay, setOverlay] = useScreenState<WorkOverlay>(overlayKey(client.id, fwId), EMPTY_OVERLAY);
  const scope = assignScope(client, fwId);
  const reqs = useMemo(
    () => withUploads(frameworkRequirements(framework, workspace, ws.ctx.reqs, ws.state.assignments, people, scope), client.id, fwId, state.screens),
    [framework, workspace, ws.ctx.reqs, ws.state.assignments, people, scope, client.id, fwId, state.screens],
  );

  /** Assigns requirements to a control owner (their department follows), due on the given date. */
  const assign = (codes: string[], person: string, due: string) => {
    for (const c of codes) ws.assign(workspace ? c : assignmentKey(scope, c), person, due);
  };

  // A move holds against the evidence as it stands now; only evidence that changes afterwards moves it on.
  const remember = (o: WorkOverlay, codes: string[]) => {
    o.seen ??= {};
    for (const c of codes) o.seen[c] = reqs.find((x) => x.code === c)?.upload?.sig ?? "";
  };

  const move = (codes: string[], to: Stage, text?: string) => {
    if (!codes.length) return;
    setOverlay((o) => {
      for (const c of codes) o.stage[c] = to;
      o.returned = o.returned.filter((c) => !codes.includes(c));
      remember(o, codes);
    });
    if (text) log(text);
  };

  const ret = (codes: string[], text?: string) => {
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
        const reqs = withUploads(frameworkRequirements(v.framework, workspace, ws.ctx.reqs, ws.state.assignments, people, assignScope(v.client, fwId)), v.client.id, fwId, state.screens);
        const overlay = (state.screens[overlayKey(v.client.id, fwId)] as WorkOverlay | undefined) ?? EMPTY_OVERLAY;
        return { ...v, reqs, overlay, counts: stageCounts(reqs, overlay) };
      }),
    [views, ws.ctx.reqs, ws.state.assignments, users, state.added, state.screens],
  );
}
