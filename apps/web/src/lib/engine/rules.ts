// Trigger-condition-action rules. Rules only recommend; external communication always
// needs an authorized human (platform guardrail, not configurable).

import type { ActionRecord, AutomationRule, RuleCondition, RuleField, RuleOp } from "@/lib/admin/types";

export const RULE_FIELDS: { field: RuleField; label: string; ops: RuleOp[] }[] = [
  { field: "work_status", label: "work_status", ops: ["=", "≠"] },
  { field: "due_date", label: "due_date", ops: ["<", ">", "≤", "≥"] },
  { field: "reminders_sent", label: "reminders_sent", ops: ["=", "≠", "<", ">", "≤", "≥"] },
  { field: "priority", label: "priority", ops: ["=", "≠", "in"] },
  { field: "department", label: "department", ops: ["=", "≠", "in"] },
];

function compare(a: number | string, op: RuleOp, b: number | string): boolean {
  switch (op) {
    case "=":
      return a === b;
    case "≠":
      return a !== b;
    case "<":
      return a < b;
    case ">":
      return a > b;
    case "≤":
      return a <= b;
    case "≥":
      return a >= b;
    default:
      return false;
  }
}

function list(value: string) {
  return value
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

/** Resolves "today", "today-7" and "today+3" to ISO dates. */
export function resolveDate(value: string, today: string): string {
  const m = value.trim().match(/^today(?:\s*([+-])\s*(\d+))?$/i);
  if (!m) return value.trim();
  const d = new Date(`${today}T00:00:00Z`);
  if (m[1]) d.setUTCDate(d.getUTCDate() + (m[1] === "-" ? -1 : 1) * Number(m[2]));
  return d.toISOString().slice(0, 10);
}

export function conditionMatches(c: RuleCondition, r: ActionRecord, today: string): boolean {
  if (c.op === "in") return list(c.value).includes(String(r[c.field]).toLowerCase());
  switch (c.field) {
    case "reminders_sent": {
      const n = Number(c.value);
      return Number.isFinite(n) && compare(r.reminders_sent, c.op, n);
    }
    case "due_date":
      return compare(r.due_date, c.op, resolveDate(c.value, today));
    default:
      return compare(String(r[c.field]).toLowerCase(), c.op, c.value.trim().toLowerCase());
  }
}

export function daysOverdue(r: ActionRecord, today: string) {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${r.due_date}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

export interface RuleTestResult {
  matches: ActionRecord[];
  /** Records failing exactly one condition: useful when tuning thresholds. */
  nearMisses: { record: ActionRecord; failed: RuleCondition }[];
}

export function testRule(rule: AutomationRule, records: ActionRecord[], today: string): RuleTestResult {
  const matches: ActionRecord[] = [];
  const nearMisses: RuleTestResult["nearMisses"] = [];
  for (const r of records) {
    const failed = rule.conditions.filter((c) => !conditionMatches(c, r, today));
    if (failed.length === 0) matches.push(r);
    else if (failed.length === 1 && rule.conditions.length > 1) nearMisses.push({ record: r, failed: failed[0] });
  }
  return { matches, nearMisses };
}

export function validateRule(rule: AutomationRule): { ok: boolean; text: string }[] {
  const hasConds = rule.conditions.length > 0;
  const valuesOk = rule.conditions.every((c) => c.value.trim() !== "" && (c.field !== "reminders_sent" || Number.isFinite(Number(c.value))));
  const opsOk = rule.conditions.every((c) => RULE_FIELDS.find((f) => f.field === c.field)?.ops.includes(c.op));
  return [
    { ok: hasConds, text: hasConds ? "Has at least one condition" : "Add at least one condition" },
    { ok: valuesOk, text: valuesOk ? "Every condition has a valid value" : "Fill every condition value (reminders must be a number)" },
    { ok: opsOk, text: opsOk ? "Operators fit their fields" : "An operator does not apply to its field" },
  ];
}
