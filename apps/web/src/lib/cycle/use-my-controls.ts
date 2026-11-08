"use client";

// The Control Owner's controls across every workspace of their entity, with each workspace's
// cycle state, for the home, my controls, evidence and messages pages.

import { useMemo } from "react";
import { useAuth } from "@/lib/auth/store";
import { useJourney } from "@/lib/journey/store";
import { clientHref } from "@/lib/journey/portfolio";
import { useWorkplacesWork } from "@/lib/journey/use-work";
import { useMyWorkplaces } from "@/lib/journey/use-workplaces";
import { workplaceLabel } from "@/lib/journey/workplaces";
import { workspaceLevels, type IndexLevels } from "@/lib/journey/levels";
import { controlsOf, cycleKey, entityMeta, seededCycle, usePlatform, type CycleControl, type CycleState } from "./use-cycle";
import { workspaceCycle, type CyclePeriod } from "./periods";

export interface MyControl {
  c: CycleControl;
  cycle: CycleState;
  workspaceId: string;
  workspace: string;
  frameworkId: string;
  href: string;
  /** The index's four levels for this workspace's requirements. */
  levels: IndexLevels;
  /** The workspace's cycle in progress, and "Cycle 1 of 2" when the standard runs more than one. */
  period: CyclePeriod;
  cycleText: string;
}

export function useMyControls() {
  const { user } = useAuth();
  const views = useMyWorkplaces();
  const work = useWorkplacesWork(views);
  const { state } = useJourney();
  const { platform } = usePlatform();
  return useMemo(() => {
    if (!user) return [] as MyControl[];
    return work.flatMap((w) => {
      const cycle = (state.screens[cycleKey(w.client.id)] as CycleState | undefined) ?? seededCycle();
      const annex = entityMeta(platform, { id: w.entity.id, sub: w.entity.sub }).annex;
      const levels = workspaceLevels(w.framework, w.workspace, w.reqs, cycle.standard.names);
      const cy = workspaceCycle(state.screens[cycleKey(w.client.id)], w.framework?.live.cycles);
      return (controlsOf(w.reqs, w.overlay, cycle, w.framework?.live.requirements, annex) as CycleControl[])
        .filter((c) => c.applicable && c.owner === user.name)
        .map((c) => ({
          c,
          cycle,
          workspaceId: w.client.id,
          workspace: `${w.entity.name} · ${workplaceLabel(w.framework?.name ?? w.client.frameworks[0] ?? "", w.workplace.year)}`,
          frameworkId: w.framework?.id ?? w.workplace.frameworkId,
          href: clientHref(w.client.id, `/controls/${encodeURIComponent(c.code)}`),
          levels,
          period: cy.period,
          cycleText: cy.label,
        }));
    });
  }, [user, work, state.screens, platform]);
}
