// A workplace is one entity working through one index for one review year, run by its index
// owners. Every client page is scoped to a workplace: the URL carries the workplace id, and
// the workplace's view of its entity (below) keeps the entity's details with the workplace's
// id, so everything a page stores is kept per workplace.

import { shortName } from "./frameworks";
import type { Client, Engagement } from "./portfolio";

export interface Workplace {
  id: string;
  entityId: string;
  frameworkId: string;
  /** Review year, e.g. 2026. */
  year: number;
  /** Index owners (user ids) responsible for the workplace. */
  ownerIds: string[];
  createdAt?: string;
}

/** Entity as a workplace page sees it: the entity's details, the workplace's id and its one index. */
export type WorkplaceClient = Client & { entityId: string; workplaceId: string; year: number; frameworkId: string };

export const CURRENT_YEAR = 2026;

const LEAD_OWNER: Record<string, string> = { SR: "u-sami", MK: "u-mohammed", LA: "u-layla" };

/**
 * One workplace per engagement. An entity's first workplace keeps the entity id, so work
 * recorded before workplaces existed stays where it was.
 */
export function workplacesFromEngagements(engagements: Engagement[]): Workplace[] {
  const seen = new Set<string>();
  return engagements
    .filter((e) => e.frameworkId)
    .map((e) => {
      const first = !seen.has(e.clientId);
      seen.add(e.clientId);
      const owner = LEAD_OWNER[e.lead];
      return {
        id: first ? e.clientId : `${e.clientId}--${e.frameworkId!.replace(/^fw-/, "")}-${CURRENT_YEAR}`,
        entityId: e.clientId,
        frameworkId: e.frameworkId!,
        year: CURRENT_YEAR,
        ownerIds: owner ? [owner] : [],
      };
    });
}

/** Engagement-derived workplaces with the admin's changes and additions on top. */
export function mergeWorkplaces(derived: Workplace[], saved: Record<string, Workplace> | undefined): Workplace[] {
  const out = derived.map((w) => saved?.[w.id] ?? w);
  for (const w of Object.values(saved ?? {})) if (!out.some((x) => x.id === w.id)) out.push(w);
  return out;
}

export function workplaceClient(w: Workplace, entity: Client, frameworkName: string): WorkplaceClient {
  return {
    ...entity,
    id: w.id,
    entityId: entity.id,
    workplaceId: w.id,
    year: w.year,
    frameworkId: w.frameworkId,
    frameworkIds: [w.frameworkId],
    frameworks: [frameworkName],
  };
}

/** "Qiyas · 2026" */
export const workplaceLabel = (frameworkName: string, year: number) => `${shortName(frameworkName)} · ${year}`;

export function newWorkplaceId(entityId: string, frameworkId: string, year: number, taken: string[]) {
  const base = `${entityId}--${frameworkId.replace(/^fw-/, "")}-${year}`;
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
  return id;
}

/** An entity can hold the same index only once per review year. */
export function duplicateOf(list: Workplace[], entityId: string, frameworkId: string, year: number) {
  return list.find((w) => w.entityId === entityId && w.frameworkId === frameworkId && w.year === year);
}

/** An index owner's request for a new workplace; the platform admin creates it or declines. */
export interface WorkplaceRequest {
  id: string;
  /** Entity on the platform, or a name typed by the index owner. */
  entityId?: string;
  entityName: string;
  frameworkId: string;
  year: number;
  reason: string;
  byId: string;
  byName: string;
  at: string;
  status: "pending" | "created" | "declined";
  workplaceId?: string;
}

/** Where a workplace stands, from its requirement stages and submission. */
export function phaseOf(counts: Record<"start" | "prog" | "rev" | "acc", number>, submitted: boolean) {
  const total = counts.start + counts.prog + counts.rev + counts.acc;
  if (submitted) return "Submitted";
  if (!total || counts.start === total) return "Planning";
  if (counts.acc === total) return "Ready to submit";
  if (counts.rev > 0) return "Internal review";
  return "Responses in progress";
}
