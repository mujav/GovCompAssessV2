// The frameworks an entity is enrolled in, taken from the Framework Builder library, and the
// requirement list the consultant works through for each. One framework is active per entity
// at a time (the overview can also show all of them); every client page follows that choice.

import type { FrameworkPackage, FrameworkRequirement, FrameworkVersion } from "@/lib/admin/types";
import { nameKey } from "@/lib/admin/library";
import { SUBMISSION_DEADLINE, type WsRequirement } from "@/lib/workspace/data";
import type { EntityPerson } from "./people";
import type { Client } from "./portfolio";

/** The framework the shared demo workspace records belong to. */
export const WORKSPACE_FRAMEWORK_ID = "fw-qiyas";

export interface EntityFramework {
  id: string;
  name: string;
  /** Short label for tabs and pills, e.g. "Qiyas" or "NCA ECC". */
  short: string;
  version: string;
  authority: string;
  live: FrameworkVersion;
}

/** A requirement in the consultant's list; library-sourced ones carry the official wording. */
export type ClientRequirement = WsRequirement & { text?: string; evidenceText?: string };

export function shortName(name: string) {
  const words = name.replace(/\b(19|20)\d{2}\b/g, "").replace(/\bData Management Standards\b/i, "").trim().split(/\s+/);
  return words.slice(0, 2).join(" ") || name;
}

/** Live library frameworks an entity is enrolled in, in enrolment order. Unpublished or unknown ones are skipped. */
export function entityFrameworks(client: Client, library: FrameworkPackage[]): EntityFramework[] {
  const ids = client.frameworkIds?.length
    ? client.frameworkIds
    : client.frameworks.map((n) => library.find((f) => [f.live?.name, f.draft?.name].some((x) => x && nameKey(x) === nameKey(n)))?.id).filter((x): x is string => !!x);
  return [...new Set(ids)].flatMap((id) => {
    const pkg = library.find((f) => f.id === id);
    if (!pkg?.live) return [];
    return [{ id, name: pkg.live.name, short: shortName(pkg.live.name), version: pkg.live.version, authority: pkg.live.authority, live: pkg.live }];
  });
}

/** Assignments of library-framework requirements are stored per framework so equal codes never clash. */
export const assignmentKey = (frameworkId: string, code: string) => `${frameworkId}:${code}`;

/** Owner, department and due date from the consultant's assignments, for requirements that come from the library. */
export function withAssignments(frameworkId: string, reqs: ClientRequirement[], assignments: Record<string, { owner: string; due: string }>, people: EntityPerson[]): ClientRequirement[] {
  return reqs.map((r) => {
    const a = assignments[assignmentKey(frameworkId, r.code)];
    return a ? { ...r, owner: a.owner, due: a.due, department: people.find((p) => p.name === a.owner)?.department ?? r.department } : r;
  });
}

/** Frameworks the seeded demo records cover: Qiyas V5.0 and NCA ECC-2:2024. */
export const RECORD_FRAMEWORKS = [WORKSPACE_FRAMEWORK_ID, "fw-nca"];

/** Seeded clients share the demo records for Qiyas and NCA ECC; a newly onboarded entity and every other framework start from the library. */
export function usesWorkspaceRecords(frameworkId: string, onboarded: boolean) {
  return RECORD_FRAMEWORKS.includes(frameworkId) && !onboarded;
}

/** Requirements at the level a framework is assessed at, as fresh work items (nothing started yet). */
export function libraryRequirements(v: FrameworkVersion): ClientRequirement[] {
  const reqs = v.requirements ?? [];
  const accepted = v.levels.find((l) => l.assessed === "accepted")?.id ?? v.levels.at(-1)?.id;
  const byCode = new Map(reqs.map((r) => [r.code, r]));
  const top = (r: FrameworkRequirement) => {
    let cur = r;
    for (let guard = 0; cur.parent && byCode.has(cur.parent) && guard < 20; guard++) cur = byCode.get(cur.parent)!;
    return cur;
  };
  const kids = (code: string) => reqs.filter((r) => r.parent === code);
  return reqs
    .filter((r) => r.level === accepted)
    .map((r) => {
      const children = kids(r.code);
      const evidence = [r.evidence ?? r.evidenceAr, ...children.map((c) => c.evidence ?? c.evidenceAr)].filter(Boolean).join("\n");
      const weight = r.weight === "high" || r.weight === "low" ? r.weight : "med";
      return {
        code: r.code,
        // Rows are assessed at the control level: each is its own control.
        controlCode: r.code,
        domainCode: r.parent ?? r.code,
        dimensionCode: top(r).code,
        domain: top(r).title || top(r).titleAr || top(r).code,
        weight,
        status: "nas" as const,
        mandatoryFail: false,
        title: r.title || r.titleAr || (r.text ?? "").slice(0, 120) || r.code,
        department: "",
        owner: "",
        work: "none" as const,
        due: SUBMISSION_DEADLINE,
        review: "none" as const,
        evidence: { expected: Math.max(1, children.length || (r.evidence ? 1 : 0)), valid: 0, invalid: 0 },
        text: [r.text ?? r.textAr, ...children.map((c) => `${c.code} ${c.title || c.titleAr || c.text || ""}`.trim())].filter(Boolean).join("\n"),
        evidenceText: evidence || undefined,
      };
    });
}
