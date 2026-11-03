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
import { controlsOf, cycleKey, entityMeta, seededCycle, usePlatform, type CycleControl, type CycleState } from "./use-cycle";

export interface MyControl {
  c: CycleControl;
  cycle: CycleState;
  workspaceId: string;
  workspace: string;
  frameworkId: string;
  owned: boolean;
  href: string;
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
      return (controlsOf(w.reqs, w.overlay, cycle, w.framework?.live.requirements, annex) as CycleControl[])
        .filter((c) => c.applicable && (c.owner === user.name || c.contributors.includes(user.name)))
        .map((c) => ({
          c,
          cycle,
          workspaceId: w.client.id,
          workspace: `${w.entity.name} · ${workplaceLabel(w.framework?.name ?? w.client.frameworks[0] ?? "", w.workplace.year)}`,
          frameworkId: w.framework?.id ?? w.workplace.frameworkId,
          owned: c.owner === user.name,
          href: clientHref(w.client.id, `/controls/${encodeURIComponent(c.code)}`),
        }));
    });
  }, [user, work, state.screens, platform]);
}

/** Messages for a person: follow-ups sent to them and comments on their controls by others. */
export function messagesFor(mine: MyControl[], name: string) {
  return mine
    .flatMap((m) => [
      ...m.cycle.followUps.filter((f) => f.to === name && f.control === m.c.code).map((f) => ({ id: f.id, at: f.at, from: f.by, kind: f.kind as string, text: f.text, m })),
      ...(m.cycle.comments[m.c.code] ?? []).filter((x) => x.by !== name).map((x) => ({ id: x.id, at: x.at, from: x.by, kind: "Comment", text: x.text, m })),
    ])
    .sort((a, b) => b.at.localeCompare(a.at));
}
