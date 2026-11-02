"use client";

import { useMemo } from "react";
import { useCurrentClient } from "@/components/journey/shell";
import { useAdmin } from "@/lib/admin/store";
import type { WsRequirement } from "@/lib/workspace/data";
import { useWorkspace } from "@/lib/workspace/store";
import { assignmentKey, entityFrameworks, libraryRequirements, usesWorkspaceRecords, withAssignments, WORKSPACE_FRAMEWORK_ID, type ClientRequirement, type EntityFramework } from "./frameworks";
import { DEMO_DIRECTORY, PEOPLE_KEY, type EntityPerson } from "./people";
import { useJourney, useScreenState } from "./store";
import { EMPTY_OVERLAY, stageOf, isReturned, type Stage, type WorkOverlay } from "./work";

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
  const onboarded = state.added.some((a) => a.client.id === client.id);
  return useScreenState<EntityPerson[]>(PEOPLE_KEY(client.id), onboarded ? [] : DEMO_DIRECTORY);
}

// The workspace framework keeps its original slice so earlier moves are not lost.
const overlayKey = (clientId: string, fwId: string) => (fwId === WORKSPACE_FRAMEWORK_ID ? `work.${clientId}` : `work.${clientId}.${fwId}`);

/** One framework's requirement list for an entity: the shared workspace records, or fresh items from the library. */
export function frameworkRequirements(
  framework: EntityFramework | undefined,
  workspace: boolean,
  wsReqs: WsRequirement[],
  assignments: Record<string, { owner: string; due: string }> = {},
  people: EntityPerson[] = [],
): ClientRequirement[] {
  const library = framework ? libraryRequirements(framework.live) : [];
  if (!workspace) return framework ? withAssignments(framework.id, library, assignments, people) : library;
  // Workspace records carry the work state; the library adds the official wording where codes match.
  const wording = new Map(library.map((r) => [r.code, r]));
  return wsReqs.map((r) => ({ ...r, text: wording.get(r.code)?.text, evidenceText: wording.get(r.code)?.evidenceText }));
}

/** Every framework of the entity with its requirements and stage moves, for the all-frameworks overview. */
export function useAllFrameworkWork() {
  const client = useCurrentClient();
  const ws = useWorkspace();
  const { state } = useJourney();
  const { frameworks } = useEntityFrameworks();
  const [people] = useEntityPeople();
  const onboarded = state.added.some((a) => a.client.id === client.id);
  return useMemo(
    () =>
      frameworks.map((f) => {
        const workspace = usesWorkspaceRecords(f.id, onboarded);
        return { framework: f, workspace, reqs: frameworkRequirements(f, workspace, ws.ctx.reqs, ws.state.assignments, people), overlay: (state.screens[overlayKey(client.id, f.id)] as WorkOverlay | undefined) ?? EMPTY_OVERLAY };
      }),
    [frameworks, onboarded, ws.ctx.reqs, ws.state.assignments, people, state.screens, client.id],
  );
}

/** Requirements and the consultant's stage moves for one framework of one entity. */
export function useFrameworkWork(framework: EntityFramework | undefined) {
  const client = useCurrentClient();
  const ws = useWorkspace();
  const { state, log } = useJourney();
  const onboarded = state.added.some((a) => a.client.id === client.id);
  const fwId = framework?.id ?? WORKSPACE_FRAMEWORK_ID;
  const workspace = usesWorkspaceRecords(fwId, onboarded);
  const [people] = useEntityPeople();
  const [overlay, setOverlay] = useScreenState<WorkOverlay>(overlayKey(client.id, fwId), EMPTY_OVERLAY);
  const reqs = useMemo(() => frameworkRequirements(framework, workspace, ws.ctx.reqs, ws.state.assignments, people), [framework, workspace, ws.ctx.reqs, ws.state.assignments, people]);

  /** Assigns requirements to a person (their department follows), due in the given date. */
  const assign = (codes: string[], person: string, due: string) => {
    for (const c of codes) ws.assign(workspace ? c : assignmentKey(fwId, c), person, due);
  };

  const move = (codes: string[], to: Stage, text?: string) => {
    if (!codes.length) return;
    setOverlay((o) => {
      for (const c of codes) o.stage[c] = to;
      o.returned = o.returned.filter((c) => !codes.includes(c));
    });
    if (text) log(text);
  };

  const ret = (codes: string[], text?: string) => {
    setOverlay((o) => {
      for (const c of codes) {
        o.stage[c] = "prog";
        if (!o.returned.includes(c)) o.returned.push(c);
      }
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
