// Consultant view of the workspace records: where each requirement sits in the consultant's
// pipeline, derived from its work and review state, plus the moves the consultant makes.

import type { ComplianceStatus } from "@/lib/admin/types";
import type { WsRequirement } from "@/lib/workspace/data";

export type Stage = "start" | "prog" | "rev" | "cli" | "acc";

export const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "start", label: "Not started", color: "#C9D1CD" },
  { key: "prog", label: "In progress", color: "#E0A100" },
  { key: "rev", label: "In review", color: "#3A6FB8" },
  { key: "cli", label: "With client", color: "#7E8FD9" },
  { key: "acc", label: "Accepted", color: "#1F9D6E" },
];

export const STAGE_OF: Record<Stage, (typeof STAGES)[number]> = Object.fromEntries(STAGES.map((s) => [s.key, s])) as never;

/** Consultant moves recorded on top of the base records. */
export interface WorkOverlay {
  /** Stage set by the consultant (L1 approve, send to client, client accept). */
  stage: Record<string, Stage>;
  /** Requirements the client returned; cleared when the consultant re-sends. */
  returned: string[];
}

export const EMPTY_OVERLAY: WorkOverlay = { stage: {}, returned: [] };

/** Base stage from the shared records, before any consultant move. */
export function baseStage(r: WsRequirement): Stage {
  if (r.review === "accepted" || r.work === "closed" || r.work === "sub" || r.work === "ready") return "acc";
  if (r.work === "none" || r.work === "start") return "start";
  if (r.review === "l2" || r.review === "override") return "cli";
  if (r.work === "review" || r.work === "evsub" || r.review === "l1") return "rev";
  return "prog";
}

export function stageOf(r: WsRequirement, o: WorkOverlay): Stage {
  return o.stage[r.code] ?? baseStage(r);
}

export function isReturned(r: WsRequirement, o: WorkOverlay) {
  return o.returned.includes(r.code) || (r.work === "returned" && !(r.code in o.stage));
}

export function stageCounts(reqs: WsRequirement[], o: WorkOverlay): Record<Stage, number> {
  const out: Record<Stage, number> = { start: 0, prog: 0, rev: 0, cli: 0, acc: 0 };
  for (const r of reqs) out[stageOf(r, o)] += 1;
  return out;
}

/** Overview pipeline: the five stages with "Waiting on SPOC" and "Returned" split out. */
export function pipelineBands(reqs: WsRequirement[], o: WorkOverlay) {
  const bands = { start: 0, draft: 0, spoc: 0, rev: 0, cli: 0, acc: 0, ret: 0 };
  for (const r of reqs) {
    const s = stageOf(r, o);
    if (isReturned(r, o) && s !== "acc") bands.ret += 1;
    else if (s === "prog") bands[r.work === "update" || r.work === "prog" ? "spoc" : "draft"] += 1;
    else bands[s] += 1;
  }
  return bands;
}

/** Last DGA result shown beside each requirement (2025 cycle). */
export const RESULT: Record<ComplianceStatus, [string, string, string]> = {
  comp: ["Compliant", "#E7F3ED", "#0E5A45"],
  part: ["Partial", "#FFF4DF", "#8A4B00"],
  non: ["Non-compliant", "#FDECEA", "#B42318"],
  na: ["Not applicable", "#EDF0F5", "#3E4B63"],
  nas: ["New in 2026", "#F5F7F6", "#5E6B65"],
};

/** Natural sort key for codes like 5.11.2-2. */
export function codeKey(code: string) {
  return code
    .split(/[.-]/)
    .map((x) => x.padStart(3, "0"))
    .join(".");
}

export function initials(name: string) {
  return name
    ? name
        .split(/\s+/)
        .map((s) => s[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";
}
