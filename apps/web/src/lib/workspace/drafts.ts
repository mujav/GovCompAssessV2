// Draft wording for Command Center actions. Drafts are prepared from records; nothing is
// sent, escalated or re-opened until an authorized user approves the draft.

import { atRisk, domainReadiness, kpis, opportunities, readiness, type Context, type DraftKind } from "@/lib/engine/metrics";
import { daysBetween, shortDate, SUBMISSION_DEADLINE } from "./data";

export interface Draft {
  id: string;
  kind: DraftKind;
  title: string;
  recipients: string;
  body: string;
  codes: string[];
  insightId?: string;
  createdAt: string;
  status: "draft" | "approved" | "discarded";
  decidedBy?: string;
  decidedAt?: string;
}

export const DRAFT_LABEL: Record<DraftKind, string> = {
  "evidence-request": "Evidence request",
  escalation: "Escalation",
  reminder: "Reminder",
  return: "Return for correction",
  "re-review": "Re-review flag",
  remediation: "Remediation plan",
  assignment: "Owner assignment",
  "exec-update": "Executive update",
};

/** What approving the draft does, shown next to the approve button. */
export const APPROVE_EFFECT: Record<DraftKind, string> = {
  "evidence-request": "Sends the request to each owner and logs it on the requirement.",
  escalation: "Sends the escalation to the department head under rule ESC-02.",
  reminder: "Sends the reminder and adds one to each action's reminder count.",
  return: "Returns the files to their owners; they leave the validation queue.",
  "re-review": "Moves the accepted results back to Pending L1. Official scores drop until re-accepted.",
  remediation: "Creates the plan as tracked remediation actions.",
  assignment: "Notifies the department to name an owner.",
  "exec-update": "Marks the update approved for distribution. Sending stays a manual step.",
};

export function composeDraft(kind: DraftKind, codes: string[], ctx: Context): Pick<Draft, "title" | "recipients" | "body"> {
  const reqs = ctx.reqs.filter((r) => codes.includes(r.code));
  const line = (code: string) => {
    const r = ctx.reqs.find((x) => x.code === code);
    return r ? `• ${r.code} ${r.title} (due ${shortDate(r.due)})` : `• ${code}`;
  };
  const people = unique(reqs.map((r) => r.owner || `${r.department} (no owner)`));
  const depts = unique(reqs.map((r) => r.department));

  switch (kind) {
    case "evidence-request":
      return {
        title: `Evidence request · ${codes.length} requirement${codes.length === 1 ? "" : "s"}`,
        recipients: people.join(", "),
        body: [
          "Hello,",
          "",
          "Please upload current-cycle evidence for the requirements below before their due date. Each one affects the entity's readiness score.",
          "",
          ...codes.map(line),
          "",
          "Reply in the workspace if anything is unclear and the compliance team will follow up.",
        ].join("\n"),
      };
    case "reminder":
      return {
        title: `Reminder · ${codes.join(", ")}`,
        recipients: people.join(", "),
        body: ["Hello,", "", "A reminder that the following item is still open:", "", ...codes.map(line), "", "Please post an update in the workspace."].join("\n"),
      };
    case "escalation": {
      const acts = ctx.actions.filter((a) => codes.includes(a.code) && a.status === "open");
      return {
        title: `Escalation · ${depts.join(", ")}`,
        recipients: depts.map((d) => `Head of ${d}`).join(", "),
        body: [
          `Dear Head of ${depts.join(" / ")},`,
          "",
          `${acts.length} remediation action${acts.length === 1 ? " is" : "s are"} past due after repeated reminders. Under escalation rule ESC-02 we are raising them with you:`,
          "",
          ...acts.map((a) => `• ${a.id} · ${a.code} · ${daysBetween(a.due, ctx.today)} days overdue · ${a.reminders} reminders`),
          "",
          `The submission deadline is ${shortDate(SUBMISSION_DEADLINE)}. Please confirm owners and new dates within 2 working days.`,
        ].join("\n"),
      };
    }
    case "return": {
      const issues = ctx.issues.filter((i) => codes.includes(i.code));
      return {
        title: `Return for correction · ${issues.length} file${issues.length === 1 ? "" : "s"}`,
        recipients: people.join(", "),
        body: [
          "Hello,",
          "",
          "The files below did not pass validation and are returned for correction:",
          "",
          ...issues.map((i) => `• ${i.id} for ${i.code}: ${i.problem}`),
          "",
          "Upload a corrected version against the same requirement.",
        ].join("\n"),
      };
    }
    case "re-review": {
      const cl = ctx.clarifications.find((c) => c.affects.some((x) => codes.includes(x)));
      return {
        title: `Re-review · ${cl?.id ?? "clarification"}`,
        recipients: "L1 reviewers",
        body: [
          `${cl ? `${cl.id}: ${cl.title}.` : "A clarification changed the expected evidence."} The accepted results below need re-review:`,
          "",
          ...codes.map(line),
        ].join("\n"),
      };
    }
    case "remediation": {
      const opps = opportunities(ctx, 10).filter((o) => codes.includes(o.code));
      return {
        title: `Remediation plan · ${opps.length} items`,
        recipients: unique(opps.map((o) => o.owner || "Unassigned")).join(", "),
        body: [
          "Proposed remediation, highest score impact first:",
          "",
          ...opps.map((o) => `• ${o.code} ${o.title}: +${o.impact} pts · ${o.need.toLowerCase()} · effort ${o.effort}`),
          "",
          "Owners confirm dates in the Action Center.",
        ].join("\n"),
      };
    }
    case "assignment":
      return {
        title: `Owner needed · ${codes.join(", ")}`,
        recipients: depts.map((d) => `Head of ${d}`).join(", "),
        body: ["Please name an owner for:", "", ...codes.map(line)].join("\n"),
      };
    case "exec-update":
      return { title: "Executive update", recipients: "Executive committee", body: executiveUpdate(ctx) };
  }
}

export function executiveUpdate(ctx: Context): string {
  const { projected, official } = readiness(ctx);
  const k = Object.fromEntries(kpis(ctx).map((x) => [x.id, x]));
  const weak = domainReadiness(ctx).filter((d) => d.rag !== "green").sort((a, b) => a.pct - b.pct);
  const risks = atRisk(ctx).slice(0, 3);
  const opps = opportunities(ctx, 3);
  return [
    `Qiyas 2026 · Cycle 1 readiness, ${shortDate(ctx.today)}`,
    "",
    `Projected readiness is ${projected.pct}% against the ${ctx.scheme.target}% target; ${official.pct}% is already accepted.`,
    `${daysBetween(ctx.today, SUBMISSION_DEADLINE)} days remain to submission.`,
    "",
    "Headlines",
    `• ${k.accepted.value} requirements accepted compliant (${k.accepted.note}).`,
    `• Evidence readiness ${k.evidence.value}, ${k.evidence.note}.`,
    `• ${k.overdue.value} overdue actions (${k.overdue.note}); ${k.blockers.value} critical blockers.`,
    "",
    "Domains below green",
    ...(weak.length ? weak.map((d) => `• ${d.domain}: ${d.pct}%`) : ["• None"]),
    "",
    "Most urgent",
    ...risks.map((r) => `• ${r.code} ${r.title}, ${r.department}, due ${shortDate(r.due)}`),
    "",
    "Biggest opportunities",
    ...opps.map((o) => `• ${o.code} ${o.title}: +${o.impact} pts`),
    "",
    `Scores calculated by scoring scheme ${ctx.scheme.code} v${ctx.scheme.version}. AI drafted this summary; figures come from the scoring engine.`,
  ].join("\n");
}

function unique<T>(xs: T[]) {
  return [...new Set(xs)];
}
