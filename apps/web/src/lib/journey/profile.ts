// Entity profile edits made after onboarding: identity, profile facts and the frameworks
// the entity is managed for. Stored once per entity and applied wherever the entity is
// shown, so the portfolio, sidebar and workspace never disagree.

import type { Client, Engagement } from "./portfolio";

export interface EntityProfile {
  name: string;
  nameAr: string;
  type: string;
  parent: string;
  domain: string;
  facts: [string, string][];
  /** Library frameworks the entity is managed for, with their display names. */
  frameworkIds?: string[];
  frameworkNames?: string[];
}

export const PROFILE_KEY = (clientId: string) => `profile.${clientId}`;

export const DEFAULT_FACTS: [string, string][] = [
  ["Employees", ""],
  ["Beneficiaries", ""],
  ["Digital services", ""],
  ["Hosting", ""],
  ["Data level", ""],
];

/** Facts shown for the seeded demo entities, which were never onboarded through the wizard. */
const DEMO_FACTS: [string, string][] = [
  ["Employees", "1,000–5,000"],
  ["Beneficiaries", "≈ 2.1 M / yr"],
  ["Digital services", "38"],
  ["Hosting", "Gov cloud · in-Kingdom"],
  ["Data level", "Restricted"],
];

export function defaultProfile(client: Client, onboarded: boolean): EntityProfile {
  return {
    name: client.name,
    nameAr: client.nameAr ?? "",
    type: client.sub.split(" · ")[0],
    parent: "",
    domain: "",
    facts: structuredClone(onboarded ? DEFAULT_FACTS : DEMO_FACTS),
  };
}

/** The client as shown everywhere, with any profile edits applied. */
export function applyProfile(client: Client, p: EntityProfile | undefined): Client {
  if (!p) return client;
  const rest = client.sub.split(" · ").slice(1);
  return {
    ...client,
    name: p.name.trim() || client.name,
    nameAr: p.nameAr.trim() || undefined,
    sub: [p.type.trim() || client.sub.split(" · ")[0], ...rest].join(" · "),
    ...(p.frameworkIds && { frameworkIds: p.frameworkIds, frameworks: p.frameworkNames ?? client.frameworks }),
  };
}

/**
 * Engagements follow the entity's frameworks: one removed from the profile drops its
 * engagement, one added gets a new engagement on the same model and term as the others.
 */
export function engagementsFor(client: Client, base: Engagement[], p: EntityProfile | undefined, shortOf: (name: string) => string): Engagement[] {
  if (!p?.frameworkIds) return base;
  const kept = base.filter((e) => !e.frameworkId || p.frameworkIds!.includes(e.frameworkId));
  const template = base[0];
  const added = p.frameworkIds
    .filter((id) => !base.some((e) => e.frameworkId === id))
    .map((id): Engagement => {
      const name = p.frameworkNames?.[p.frameworkIds!.indexOf(id)] ?? id;
      return {
        clientId: client.id,
        index: shortOf(name),
        frameworkId: id,
        model: template?.model === "managed" ? "managed" : "co",
        ready: 0,
        delta: "new",
        milestone: "Kickoff · 7 d",
        milestoneLate: false,
        term: template?.term ?? "365 d left",
        termState: template?.termState ?? "ok",
        lead: template?.lead ?? "SR",
      };
    });
  return [...kept, ...added];
}
