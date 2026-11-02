// Acceptance policy evaluation. AI recommends; only human stages can accept a result,
// and the number of stages is whatever the policy configures.

import type { AcceptancePolicy } from "@/lib/admin/types";

export interface Scenario {
  id: string;
  label: string;
  aiStatus: string;
  /** Stage-1 reviewer changes the AI result to this status. */
  overrideTo?: string;
  /** 1-based stage whose reviewer rejects. */
  rejectAtStage?: number;
}

export const SCENARIOS: Scenario[] = [
  { id: "override", label: "5.11.2-2 · AI Non-compliant · reviewer overrides to Partial", aiStatus: "Non-compliant", overrideTo: "Partial" },
  { id: "agree", label: "1.1.1-1 · AI Compliant · no override", aiStatus: "Compliant" },
  { id: "reject", label: "6.2.1-3 · AI Partial · stage 2 rejects", aiStatus: "Partial", rejectAtStage: 2 },
];

export type StepTone = "ai" | "neutral" | "warn" | "good" | "bad";

export interface SimStep {
  text: string;
  tone: StepTone;
}

export function simulate(policy: AcceptancePolicy, scenario: Scenario): SimStep[] {
  const steps: SimStep[] = [{ text: `AI Assessed (${scenario.aiStatus}) → routed to stage 1 · recommendation only`, tone: "ai" }];
  let status = scenario.aiStatus;
  let overridePending = false;

  for (const [i, stage] of policy.stages.entries()) {
    const n = i + 1;
    if (scenario.rejectAtStage === n) {
      steps.push({ text: `Stage ${n} · ${stage.name}: rejects → ${stage.onReject}`, tone: "bad" });
      return steps;
    }
    if (n === 1 && scenario.overrideTo) {
      const approvals = stage.mode === "parallel" ? `${stage.minApprovals - 1} of ${stage.poolSize} approve, 1 overrides` : "reviewer overrides";
      steps.push({ text: `Stage 1 · ${stage.name}: ${approvals} to ${scenario.overrideTo}`, tone: "neutral" });
      status = scenario.overrideTo;
      if (policy.materialOverrideEscalates) {
        steps.push({ text: "Override is material → Override Pending Approval", tone: "warn" });
        overridePending = true;
      }
      continue;
    }
    const isLast = n === policy.stages.length;
    const who = stage.mode === "parallel" ? `${stage.minApprovals} of ${stage.poolSize} approve` : "approves";
    const what = overridePending ? "the override" : "";
    overridePending = false;
    steps.push({
      text: `Stage ${n} · ${stage.name}: ${who}${what ? ` ${what}` : ""}${isLast ? ` → Accepted (${status})` : ""}`,
      tone: isLast ? "good" : "neutral",
    });
  }
  if (policy.stages.length === 0) steps.push({ text: "No human stage configured: result cannot be accepted", tone: "bad" });
  return steps;
}

export interface PolicyCheck {
  ok: boolean;
  text: string;
}

export function validatePolicy(policy: AcceptancePolicy): PolicyCheck[] {
  const stages = policy.stages;
  const hasStage = stages.length > 0;
  const finalLast = hasStage && stages[stages.length - 1].mode === "final" && stages.filter((s) => s.mode === "final").length === 1;
  const quorumOk = stages.every((s) => s.minApprovals >= 1 && s.minApprovals <= Math.max(1, s.poolSize));
  const independent = stages.every((s, i) => i === 0 || s.independence.trim() !== "");
  const sla = stages.reduce((sum, s) => sum + s.slaDays, 0);
  return [
    { ok: hasStage, text: hasStage ? "AI never satisfies a human stage" : "At least one human stage is required" },
    { ok: finalLast, text: finalLast ? "Exactly one final stage, placed last" : "The last stage must be the only final stage" },
    { ok: quorumOk, text: quorumOk ? "Approvals required fit each reviewer pool" : "Approvals required exceed a stage's pool" },
    { ok: independent, text: independent ? "No person fills two stages (independence set)" : "Set an independence rule on every later stage" },
    { ok: sla > 0 && sla <= 20, text: `SLA chain totals ${sla} working day${sla === 1 ? "" : "s"}${sla > 20 ? " (over the 20-day limit)" : ""}` },
  ];
}
