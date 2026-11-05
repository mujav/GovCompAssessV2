"use client";

import { useMemo } from "react";
import type { CycleRequirement } from "@/lib/cycle/model";
import type { EntityFramework } from "./frameworks";
import { workspaceLevels } from "./levels";
import { useJourney } from "./store";

/** The four index levels for a workspace's requirement rows, with names the Index Owner gave what they added. */
export function useIndexLevels(framework: EntityFramework | undefined, workspace: boolean, reqs: CycleRequirement[], clientId: string) {
  const { state } = useJourney();
  const renames = (state.screens[`cycle.${clientId}`] as { standard?: { names?: Record<string, string> } } | undefined)?.standard?.names;
  return useMemo(() => workspaceLevels(framework, workspace, reqs, renames), [framework, workspace, reqs, renames]);
}
