import type { FrameworkRequirement, HierarchyLevel } from "@/lib/admin/types";
import { applyRenames, controlOf, dimensionOf, domainOf, namesFrom, type CycleRequirement } from "@/lib/cycle/model";
import type { EntityFramework } from "./frameworks";

// The four levels of an index for one requirement row, so every requirement table can show
// where a row sits: Perspective › Axis › Standard › Implementation requirement for Qiyas,
// Main domain › Subdomain › Control › Subcontrol for NCA ECC. The path follows each node's
// parents in the standard; rows that are not in it read the path off a Qiyas-style code, and
// without a standard the levels are Dimension › Domain › Control › Requirement.

export const DEFAULT_LEVELS = ["Dimension", "Domain", "Control", "Requirement"];

export interface LevelCell {
  code: string;
  name: string;
  /** Codes one level down, when the row is assessed above the index's last level. */
  below?: string[];
}

export interface IndexLevels {
  labels: string[];
  /** Level the rows sit at: the one the index is assessed at. The other three are context or detail. */
  rowLevel: number;
  pathOf: (code: string, title: string) => LevelCell[];
}

const nodeName = (n: FrameworkRequirement) => n.title || n.titleAr || (n.text ?? n.textAr ?? "").slice(0, 120) || n.code;

/**
 * Builds the four-level path for requirement codes. With the standard's own nodes the path
 * follows each node's parent; otherwise it is read off the code (4.1.2-1 → 4 › 4.1 › 4.1.2 › 4.1.2-1)
 * with names from `names`.
 */
export function indexLevels({ levels, nodes, names, rowLevel }: { levels?: HierarchyLevel[]; nodes?: FrameworkRequirement[]; names?: Map<string, string>; rowLevel?: number }): IndexLevels {
  const named = levels?.length === 4 ? levels : undefined;
  const tree = nodes?.length ? named : undefined;
  // The standard names the levels even when the rows are the workspace's own records.
  const labels = named ? named.map((l) => l.en) : DEFAULT_LEVELS;
  const byCode = new Map((tree ? nodes! : []).map((n) => [n.code, n]));
  const depth = (n: FrameworkRequirement) => tree!.findIndex((l) => l.id === n.level);
  const name = (code: string) => names?.get(code) ?? "";

  const pathOf = (code: string, title: string): LevelCell[] => {
    const node = byCode.get(code);
    if (node && depth(node) >= 0) {
      const out: LevelCell[] = labels.map(() => ({ code: "", name: "" }));
      for (let n: FrameworkRequirement | undefined = node, guard = 0; n && guard < 8; n = n.parent ? byCode.get(n.parent) : undefined, guard++) {
        const i = depth(n);
        if (i >= 0) out[i] = { code: n.code, name: n === node ? title || nodeName(n) : names?.get(n.code) ?? nodeName(n) };
      }
      const at = depth(node);
      if (at < 3) {
        const kids = nodes!.filter((k) => k.parent === code && depth(k) === at + 1).map((k) => k.code);
        out[at + 1] = { code: kids.length ? `${kids[0]}${kids.length > 1 ? ` … ${kids.at(-1)}` : ""}` : "", name: kids.length ? `${kids.length} ${labels[at + 1].toLowerCase()}${kids.length === 1 ? "" : "s"}` : "", below: kids };
      }
      return out;
    }
    const dim = dimensionOf(code);
    const dom = domainOf(code);
    const ctl = controlOf(code);
    return [
      { code: dim, name: name(dim) },
      { code: dom === dim ? "" : dom, name: dom === dim ? "" : name(dom) },
      { code: ctl === dom ? "" : ctl, name: ctl === dom ? "" : name(ctl) },
      { code, name: title },
    ];
  };
  const assessed = tree?.findIndex((l) => l.assessed === "accepted") ?? -1;
  return { labels, rowLevel: rowLevel ?? (assessed >= 0 ? assessed : 3), pathOf };
}

/** "P1 · Strategy" style text, for CSV and spreadsheet cells. */
export const levelText = (c: LevelCell) => [c.code, c.name].filter(Boolean).join(" · ");

/** The three levels other than the row's own, in index order, with their labels. */
export function otherLevels(l: IndexLevels, code: string, title: string) {
  return l.pathOf(code, title).map((cell, i) => ({ label: l.labels[i], cell, i })).filter((x) => x.i !== l.rowLevel);
}

/**
 * The levels for one workspace. Names follow the control screens: the standard's nodes, then the
 * requirement wording, then names the Index Owner gave what they added.
 */
export function workspaceLevels(framework: EntityFramework | undefined, workspace: boolean, reqs: CycleRequirement[], renames?: Record<string, string>) {
  const nodes = framework?.live.requirements;
  const names = applyRenames(namesFrom(nodes, reqs), renames, nodes);
  // Demo records are the standard's requirements (its last level); library rows sit at the level it is assessed at.
  return indexLevels({ levels: framework?.live.levels, nodes, names, rowLevel: workspace ? 3 : undefined });
}
