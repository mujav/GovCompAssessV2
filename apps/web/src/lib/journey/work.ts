// Where each requirement sits in its workplace's pipeline, derived from its work and review
// state and its evidence, plus the moves the index owner makes. There is one review layer:
// the control owner submits, the index owner accepts or returns.

import type { ComplianceStatus } from "@/lib/admin/types";
import type { WsRequirement } from "@/lib/workspace/data";

export type Stage = "start" | "prog" | "rev" | "acc";

export const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "start", label: "Not started", color: "#C9D1CD" },
  { key: "prog", label: "In progress", color: "#E0A100" },
  { key: "rev", label: "In review", color: "#3A6FB8" },
  { key: "acc", label: "Accepted", color: "#1F9D6E" },
];

export const STAGE_OF: Record<Stage, (typeof STAGES)[number]> = Object.fromEntries(STAGES.map((s) => [s.key, s])) as never;

const RANK: Record<Stage, number> = { start: 0, prog: 1, rev: 2, acc: 3 };
const later = (a: Stage, b: Stage) => (RANK[b] > RANK[a] ? b : a);

/** What the uploaded evidence says about a requirement: files in hand, and whether the AI assessor has reviewed all of them. */
export interface EvidenceSignal {
  files: number;
  assessed: boolean;
  /** Changes whenever a file is added or removed or a new assessment runs. */
  sig: string;
}

/** Requirement as the stage model sees it: the shared record plus its uploaded evidence. */
export type StagedRequirement = WsRequirement & { upload?: EvidenceSignal };

/** Lowest stage the evidence justifies: files uploaded → in progress; all of them assessed by AI → ready for L1 review. */
export function evidenceStage(u: EvidenceSignal | undefined): Stage | undefined {
  if (!u || !u.files) return undefined;
  return u.assessed ? "rev" : "prog";
}

/** Consultant moves recorded on top of the base records. */
export interface WorkOverlay {
  /** Stage set by the index owner (accept, return) or the control owner (submit for review). */
  stage: Record<string, Stage>;
  /** Requirements the client returned; cleared when the consultant re-sends. */
  returned: string[];
  /** Evidence signature when the consultant last moved each requirement. Newer evidence can move it on again. */
  seen?: Record<string, string>;
}

export const EMPTY_OVERLAY: WorkOverlay = { stage: {}, returned: [] };

/** Base stage from the shared records, before any consultant move. */
export function baseStage(r: WsRequirement): Stage {
  if (r.review === "accepted" || r.work === "closed" || r.work === "sub" || r.work === "ready") return "acc";
  if (r.work === "none" || r.work === "start") return "start";
  // Records approved under the earlier two-layer review count as accepted.
  if (r.review === "l2" || r.review === "override") return "acc";
  if (r.work === "review" || r.work === "evsub" || r.review === "l1") return "rev";
  return "prog";
}

/**
 * Where the requirement sits now. A consultant move holds until new evidence arrives after it;
 * evidence only ever moves a requirement forward, never back.
 */
export function stageOf(r: StagedRequirement, o: WorkOverlay): Stage {
  const floor = evidenceStage(r.upload);
  // Moves saved as "with client" under the earlier two-layer review were index-owner approvals.
  const saved = o.stage[r.code] as Stage | "cli" | undefined;
  const moved: Stage | undefined = saved === "cli" ? "acc" : saved;
  if (moved) return floor && r.upload!.sig !== (o.seen?.[r.code] ?? "") ? later(moved, floor) : moved;
  return floor ? later(baseStage(r), floor) : baseStage(r);
}

/** Returned by the client and not yet back in review. */
export function isReturned(r: StagedRequirement, o: WorkOverlay) {
  if (RANK[stageOf(r, o)] >= RANK.rev) return false;
  return o.returned.includes(r.code) || (r.work === "returned" && !(r.code in o.stage));
}

export function stageCounts(reqs: StagedRequirement[], o: WorkOverlay): Record<Stage, number> {
  const out: Record<Stage, number> = { start: 0, prog: 0, rev: 0, acc: 0 };
  for (const r of reqs) out[stageOf(r, o)] += 1;
  return out;
}

/** Overview pipeline: the five stages with "Waiting on SPOC" and "Returned" split out. */
export function pipelineBands(reqs: StagedRequirement[], o: WorkOverlay) {
  const bands = { start: 0, draft: 0, spoc: 0, rev: 0, acc: 0, ret: 0 };
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
