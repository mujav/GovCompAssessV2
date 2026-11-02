"use client";

import { useCurrentClient } from "@/components/journey/shell";
import { useWorkspace } from "@/lib/workspace/store";
import { useJourney, useScreenState } from "./store";
import { EMPTY_OVERLAY, stageOf, isReturned, type Stage, type WorkOverlay } from "./work";

/** Workspace records for the client in the URL, with the consultant's moves applied. */
export function useClientWork() {
  const client = useCurrentClient();
  const ws = useWorkspace();
  const { log } = useJourney();
  const [overlay, setOverlay] = useScreenState<WorkOverlay>(`work.${client.id}`, EMPTY_OVERLAY);

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
    reqs: ws.ctx.reqs,
    overlay,
    stage: (code: string) => {
      const r = ws.ctx.reqs.find((x) => x.code === code);
      return r ? stageOf(r, overlay) : "start";
    },
    returned: (code: string) => {
      const r = ws.ctx.reqs.find((x) => x.code === code);
      return r ? isReturned(r, overlay) : false;
    },
    move,
    ret,
    log,
  };
}
