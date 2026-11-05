import { indexLevels, type IndexLevels, type LevelCell } from "./levels";
import { STAGES, codeKey, isReturned, stageOf, type Stage, type StagedRequirement, type WorkOverlay } from "./work";

// The workspace report, worked out once and shared by the screen and every export (PDF,
// PowerPoint, Excel). The executive report reads the totals; the detailed report gives each
// Control Owner a page of their own.

export const UNASSIGNED = "Unassigned";

export interface ReportRow {
  code: string;
  title: string;
  domain: string;
  owner: string;
  stage: Stage;
  stageLabel: string;
  due: string;
  overdue: boolean;
  returned: boolean;
  files: number;
  expected: number;
  /** The index's four levels for this row, top first. */
  path: LevelCell[];
}

export type StageCounts = Record<Stage, number>;

export interface OwnerReport {
  name: string;
  email?: string;
  department?: string;
  total: number;
  counts: StageCounts;
  pct: number;
  open: number;
  overdue: number;
  returned: number;
  rows: ReportRow[];
}

export interface DomainReport {
  name: string;
  total: number;
  counts: StageCounts;
  pct: number;
}

export interface WorkspaceReport {
  entity: string;
  index: string;
  year: number;
  indexOwners: string[];
  today: string;
  total: number;
  counts: StageCounts;
  pct: number;
  overdue: number;
  returned: number;
  domains: DomainReport[];
  /** Most late first, then most open; Unassigned last. */
  owners: OwnerReport[];
  late: ReportRow[];
  rows: ReportRow[];
  /** Names of the index's four levels, and the one rows sit at. */
  levels: string[];
  rowLevel: number;
}

export interface ReportInput {
  entity: string;
  index: string;
  year: number;
  indexOwners: string[];
  today: string;
  reqs: StagedRequirement[];
  overlay: WorkOverlay;
  /** Known Control Owners, matched to requirements by name. */
  people?: { name: string; email?: string; department?: string }[];
  /** The index's levels; without them each row's path is read off its code. */
  levels?: IndexLevels;
}

const pctOf = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0);

function countStages(rows: ReportRow[]): StageCounts {
  const out: StageCounts = { start: 0, prog: 0, rev: 0, acc: 0 };
  for (const r of rows) out[r.stage] += 1;
  return out;
}

const byCode = (a: ReportRow, b: ReportRow) => codeKey(a.code).localeCompare(codeKey(b.code));

export function buildReport(input: ReportInput): WorkspaceReport {
  const { reqs, overlay, today } = input;
  const levels = input.levels ?? indexLevels({});
  const rows: ReportRow[] = reqs
    .map((r) => {
      const stage = stageOf(r, overlay);
      return {
        code: r.code,
        title: r.title,
        domain: r.domain,
        owner: r.owner || UNASSIGNED,
        stage,
        stageLabel: STAGES.find((s) => s.key === stage)!.label,
        due: r.due,
        overdue: stage !== "acc" && r.due < today,
        returned: isReturned(r, overlay),
        files: r.upload?.files ?? 0,
        expected: r.evidence.expected,
        path: levels.pathOf(r.code, r.title),
      };
    })
    .sort(byCode);

  const domains = [...new Set(rows.map((r) => r.domain))].map((name) => {
    const list = rows.filter((r) => r.domain === name);
    const counts = countStages(list);
    return { name, total: list.length, counts, pct: pctOf(counts.acc, list.length) };
  });

  const owners = [...new Set(rows.map((r) => r.owner))]
    .map((name): OwnerReport => {
      const list = rows.filter((r) => r.owner === name);
      const counts = countStages(list);
      const person = input.people?.find((p) => p.name === name);
      const department = name === UNASSIGNED ? undefined : person?.department ?? mostCommon(reqs.filter((r) => (r.owner || UNASSIGNED) === name).map((r) => r.department));
      return {
        name,
        email: person?.email,
        department,
        total: list.length,
        counts,
        pct: pctOf(counts.acc, list.length),
        open: list.length - counts.acc,
        overdue: list.filter((r) => r.overdue).length,
        returned: list.filter((r) => r.returned).length,
        // Open work first, the latest due date last.
        rows: [...list].sort((a, b) => Number(a.stage === "acc") - Number(b.stage === "acc") || a.due.localeCompare(b.due) || byCode(a, b)),
      };
    })
    .sort((a, b) => Number(a.name === UNASSIGNED) - Number(b.name === UNASSIGNED) || b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name));

  const counts = countStages(rows);
  const late = rows.filter((r) => r.overdue).sort((a, b) => a.due.localeCompare(b.due) || byCode(a, b));
  return {
    entity: input.entity,
    index: input.index,
    year: input.year,
    indexOwners: input.indexOwners,
    today,
    total: rows.length,
    counts,
    pct: pctOf(counts.acc, rows.length),
    overdue: late.length,
    returned: rows.filter((r) => r.returned).length,
    domains,
    owners,
    late,
    rows,
    levels: levels.labels,
    rowLevel: levels.rowLevel,
  };
}

function mostCommon(list: string[]) {
  const n = new Map<string, number>();
  for (const x of list) if (x) n.set(x, (n.get(x) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** File name for an export: "Entity – Index 2026 – Detailed report". */
export function reportFileName(r: WorkspaceReport, kind: "executive" | "detailed") {
  const base = `${r.entity} - ${r.index} ${r.year} - ${kind === "executive" ? "Executive" : "Detailed"} report`;
  return base.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}

/** The row's three context levels with their labels: every level but the one the row sits at. */
export const contextLevels = (r: WorkspaceReport, row: ReportRow) => row.path.map((cell, i) => ({ label: r.levels[i], cell, i })).filter((x) => x.i !== r.rowLevel);
