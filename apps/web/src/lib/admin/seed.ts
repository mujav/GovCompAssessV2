// Dummy Admin Studio configuration, shaped like the Qiyas pilot in the design canvas.

import { diffConfig } from "./diff";
import { impactFor } from "./impact";
import type {
  AcceptancePolicy,
  AdminState,
  AutomationRule,
  FrameworkVersion,
  HierarchyLevel,
  ReviewStage,
  ScoringScheme,
} from "./types";

const QIYAS_LEVELS: HierarchyLevel[] = [
  { id: "lv-1", en: "Axis", ar: "المحور", pattern: "#", assessed: "rollup" },
  { id: "lv-2", en: "Standard", ar: "المعيار", pattern: "#.#.#", assessed: "rollup" },
  { id: "lv-3", en: "Requirement", ar: "المتطلب", pattern: "#.#.#-#", assessed: "accepted" },
  { id: "lv-4", en: "Criterion", ar: "البند", pattern: "#.#.#-#-C#", assessed: "ai_reviewer" },
];

const qiyasLive: FrameworkVersion = {
  name: "Qiyas 2026",
  version: "1.2",
  authority: "DGA",
  effective: "01 Jan 2026",
  scoringNote: "Compliant / partial / non · weighted",
  levels: QIYAS_LEVELS,
};

const qiyasDraft: FrameworkVersion = {
  ...qiyasLive,
  version: "1.3",
  effective: "01 Dec 2026 · Cycle 2",
  levels: QIYAS_LEVELS.map((l) => (l.id === "lv-4" ? { ...l, ar: "المعيار الفرعي" } : l)),
  importJob: {
    file: "qiyas-2026.xlsx",
    tab: "03_Requirements",
    rows: 350,
    uploadedBy: "Majed F.",
    hash: "4b1e…90c2",
    valid: 348,
    warnings: [
      { row: 117, field: "weight", message: "Weight missing for 3.6.2-1" },
      { row: 284, field: "weight", message: "Weight missing for 5.14.1-3" },
    ],
    changed: "37 wording · 31 new",
    errors: 0,
  },
};

const scoringLive: ScoringScheme = {
  code: "QY-2026",
  version: 3,
  method: "three",
  points: { comp: 1, part: 0.5, non: 0, nas: 0 },
  blockingCap: "part",
  naTreatment: "exclude",
  rounding: 1,
  weights: { high: 1.5, med: 1, low: 0.5 },
  green: 85,
  amber: 60,
  target: 85,
  overrideDelta: 0.5,
};

const scoringDraft: ScoringScheme = { ...scoringLive, version: 4, blockingCap: "non", weights: { high: 2, med: 1, low: 0.5 } };

export const DEFAULT_RIGHTS = ["Approve", "Override", "Return", "Clarify", "Reject", "Escalate", "Accept", "Reject final"];

function stage(id: string, p: Partial<ReviewStage> & Pick<ReviewStage, "mode" | "name" | "reviewers">): ReviewStage {
  return { id, minApprovals: 1, poolSize: 1, onReject: "Return to evidence owner", slaDays: 3, independence: "", rights: ["Approve", "Return"], ...p };
}

const policyBase = { rationaleRequired: true, materialOverrideEscalates: true, allowBulk: false, reopenOnEvidence: true, reopenOnClarification: true, reopenOnConfig: true };

const stdPolicy: AcceptancePolicy = {
  code: "AP-QIYAS-STD",
  version: 2,
  name: "Standard entity",
  scope: "Qiyas 2026 · default",
  ...policyBase,
  stages: [
    stage("st-1", { mode: "single", name: "Domain SME", reviewers: "Pool: Qiyas SMEs", poolSize: 4, independence: "Not owner or submitter", rights: ["Approve", "Override", "Return", "Clarify"] }),
    stage("st-2", { mode: "single", name: "Assessment Manager", reviewers: "Named: Noura A.", onReject: "Back to stage 1", independence: "Not a stage 1 reviewer", rights: ["Approve", "Reject", "Escalate"] }),
    stage("st-3", { mode: "final", name: "Compliance Lead", reviewers: "Role: compliance lead", onReject: "Rejected Final", independence: "Not stages 1–2", rights: ["Accept", "Reject final", "Return"] }),
  ],
};

const critLive: AcceptancePolicy = {
  code: "AP-QIYAS-CRIT",
  version: 1,
  name: "Critical requirements",
  scope: "Qiyas 2026 · risk = critical",
  ...policyBase,
  stages: [
    stage("st-1", { mode: "single", name: "Domain SME", reviewers: "Pool: Qiyas SMEs", poolSize: 4, independence: "Not owner or submitter", rights: ["Approve", "Override", "Return"] }),
    stage("st-2", { mode: "final", name: "Compliance Lead", reviewers: "Named: Huda S.", onReject: "Rejected Final", independence: "Not stage 1", rights: ["Accept", "Reject final", "Return"] }),
  ],
};

const critDraft: AcceptancePolicy = {
  ...critLive,
  version: 2,
  stages: [
    stage("st-1", { mode: "parallel", name: "Two domain SMEs", reviewers: "Pool: Qiyas SMEs", minApprovals: 2, poolSize: 2, independence: "Not owner or submitter", rights: ["Approve", "Override", "Return", "Clarify"] }),
    stage("st-2", { mode: "single", name: "Control owner", reviewers: "Role: control owner", onReject: "Back to stage 1", independence: "Not a stage 1 reviewer", rights: ["Approve", "Reject", "Escalate"] }),
    stage("st-3", { mode: "final", name: "Compliance Lead", reviewers: "Named: Huda S.", onReject: "Rejected Final", independence: "Not stages 1–2", rights: ["Accept", "Reject final", "Return"] }),
  ],
};

const lowPolicy: AcceptancePolicy = {
  code: "AP-LOW-SAMPLED",
  version: 1,
  name: "Low risk, 10% sampled QA",
  scope: "Qiyas 2026 · risk = low",
  ...policyBase,
  allowBulk: true,
  stages: [
    stage("st-1", { mode: "single", name: "Reviewer", reviewers: "Pool: reviewers", poolSize: 6, rights: ["Approve", "Return"] }),
    stage("st-2", { mode: "final", name: "QA lead (10% sample)", reviewers: "Role: QA lead", onReject: "Back to stage 1", independence: "Not stage 1", rights: ["Accept", "Return"] }),
  ],
};

const ncaPolicy: AcceptancePolicy = {
  code: "AP-NCA-SEQ",
  version: 1,
  name: "Two sequential reviewers",
  scope: "NCA ECC 2024 · default",
  ...policyBase,
  stages: [
    stage("st-1", { mode: "single", name: "Cybersecurity SME", reviewers: "Pool: NCA SMEs", poolSize: 3, rights: ["Approve", "Override", "Return"] }),
    stage("st-2", { mode: "single", name: "Control owner", reviewers: "Role: control owner", onReject: "Back to stage 1", independence: "Not stage 1", rights: ["Approve", "Reject"] }),
    stage("st-3", { mode: "final", name: "CISO", reviewers: "Named: CISO", onReject: "Rejected Final", independence: "Not stages 1–2", rights: ["Accept", "Reject final"] }),
  ],
};

const RULE_ACTIONS_ESC = [
  "Create escalation recommendation with history pack → assign to Assessment Manager",
  "Flag requirement red on dashboards",
  "In-app alert to department SPOC",
];

function rule(code: string, version: number, name: string, summary: string, extra: Partial<AutomationRule> = {}): AutomationRule {
  return { code, version, name, summary, trigger: "Daily schedule", time: "07:00", conditions: [], actions: ["Create task"], ...extra };
}

const escLive = rule("ESC-02", 2, "Escalate silent overdue items", "Daily · recommends, never sends", {
  conditions: [
    { id: "c1", field: "work_status", op: "=", value: "No update" },
    { id: "c2", field: "due_date", op: "<", value: "today" },
    { id: "c3", field: "reminders_sent", op: "≥", value: "2" },
  ],
  actions: RULE_ACTIONS_ESC,
});

const escDraft: AutomationRule = {
  ...escLive,
  version: 3,
  conditions: [...escLive.conditions, { id: "c4", field: "priority", op: "in", value: "High, Critical" }],
};

const rules: AdminState["rules"] = [
  {
    id: "REM-01",
    live: rule("REM-01", 4, "Reminder cadence", "Due in 3 days, then every 4 days · max 2", {
      trigger: "Due date approaching",
      conditions: [
        { id: "c1", field: "due_date", op: "≤", value: "today+3" },
        { id: "c2", field: "reminders_sent", op: "<", value: "2" },
      ],
      actions: ["Recommend reminder to owner", "Log interaction"],
    }),
  },
  { id: "ESC-02", live: escLive, draft: escDraft, pendingCr: "CR-039" },
  { id: "EXP-01", live: rule("EXP-01", 2, "Evidence expiry watch", "Valid-to date within 30 days", { conditions: [{ id: "c1", field: "due_date", op: "≤", value: "today+30" }], actions: ["Flag evidence as expiring", "Recommend update request"] }) },
  { id: "OWN-01", live: rule("OWN-01", 1, "Ownership SLA", "Unassigned after 5 working days", { conditions: [{ id: "c1", field: "department", op: "=", value: "Unassigned" }], actions: ["Alert Assessment Admin", "Flag requirement amber"] }) },
  { id: "RTE-01", live: rule("RTE-01", 3, "Route reviews by domain", "Domain → SME pool", { trigger: "Status changed", conditions: [{ id: "c1", field: "work_status", op: "=", value: "Evidence submitted" }], actions: ["Assign reviewer from domain SME pool"] }) },
  { id: "CLA-01", live: rule("CLA-01", 1, "Clarification impact", "On response → flag affected items", { trigger: "Clarification received", conditions: [{ id: "c1", field: "priority", op: "in", value: "High, Critical" }], actions: ["Flag affected requirements for re-review"] }) },
];

export function createSeed(): AdminState {
  return {
    currentUserId: "u-majed",
    users: [
      { id: "u-majed", name: "Majed F.", role: "Framework Admin", canApprove: false },
      { id: "u-noura", name: "Noura A.", role: "Assessment Manager", canApprove: false },
      { id: "u-huda", name: "Huda S.", role: "Compliance Lead", canApprove: true },
    ],
    frameworks: [
      { id: "fw-qiyas", live: qiyasLive, draft: qiyasDraft, usedByCycles: 1 },
      {
        id: "fw-nca",
        usedByCycles: 1,
        live: {
          name: "NCA ECC",
          version: "2024",
          authority: "NCA",
          effective: "01 Mar 2024",
          scoringNote: "Maturity 0–5 · minimum by domain",
          levels: [
            { id: "lv-1", en: "Domain", ar: "المجال", pattern: "#", assessed: "rollup" },
            { id: "lv-2", en: "Subdomain", ar: "المجال الفرعي", pattern: "#-#", assessed: "rollup" },
            { id: "lv-3", en: "Control", ar: "الضابط", pattern: "#-#-#", assessed: "accepted" },
            { id: "lv-4", en: "Subcontrol", ar: "الضابط الفرعي", pattern: "#-#-#-#", assessed: "ai_reviewer" },
          ],
        },
      },
      {
        id: "fw-iso",
        usedByCycles: 0,
        draft: {
          name: "Internal ISO 27001",
          version: "0.1",
          authority: "Internal audit",
          effective: "—",
          scoringNote: "Binary scoring",
          levels: [
            { id: "lv-1", en: "Clause", ar: "البند", pattern: "#", assessed: "rollup" },
            { id: "lv-2", en: "Annex A control", ar: "ضابط الملحق أ", pattern: "A.#.#", assessed: "accepted" },
          ],
        },
      },
    ],
    scoring: { id: "QY-2026", live: scoringLive, draft: scoringDraft, pendingCr: "CR-041" },
    policies: [
      { id: "AP-QIYAS-STD", live: stdPolicy },
      { id: "AP-QIYAS-CRIT", live: critLive, draft: critDraft, pendingCr: "CR-040" },
      { id: "AP-LOW-SAMPLED", live: lowPolicy },
      { id: "AP-NCA-SEQ", live: ncaPolicy },
    ],
    rules,
    changeRequests: [
      { id: "CR-041", kind: "scoring", targetId: "QY-2026", title: "Scoring scheme QY-2026 v3 → v4", authorId: "u-majed", submittedAt: "27 Oct 16:20", status: "awaiting", material: true, diff: diffConfig("scoring", scoringLive, scoringDraft), impact: impactFor("scoring", scoringLive, scoringDraft) },
      { id: "CR-040", kind: "acceptance", targetId: "AP-QIYAS-CRIT", title: "Acceptance policy AP-QIYAS-CRIT v1 → v2", authorId: "u-majed", submittedAt: "27 Oct 14:05", status: "awaiting", material: true, diff: diffConfig("acceptance", critLive, critDraft), impact: impactFor("acceptance", critLive, critDraft) },
      { id: "CR-039", kind: "rule", targetId: "ESC-02", title: "Rule ESC-02 v2 → v3 adds priority condition", authorId: "u-noura", submittedAt: "28 Oct 08:41", status: "awaiting", material: false, diff: diffConfig("rule", escLive, escDraft), impact: impactFor("rule", escLive, escDraft) },
      { id: "CR-038", kind: "framework", targetId: "fw-qiyas", title: "Arabic labels for hierarchy levels", authorId: "u-noura", submittedAt: "21 Oct 10:12", status: "published", material: false, diff: [{ label: "Arabic labels", before: "—", after: "المحور › المعيار › المتطلب › البند", changed: true }], impact: ["Cosmetic: no assessment results change"], decidedBy: "Huda S.", decidedAt: "21 Oct 15:30" },
      { id: "CR-036", kind: "acceptance", targetId: "AP-QIYAS-STD", title: "Allow bulk approval for medium risk", authorId: "u-noura", submittedAt: "14 Oct 09:00", status: "rejected", material: true, diff: [{ label: "Override governance", before: "rationale, material escalates", after: "rationale, material escalates, bulk allowed", changed: true }], impact: ["Bulk approval would cover 118 medium-risk requirements"], decidedBy: "Huda S.", decidedAt: "14 Oct 13:20", comment: "Keep bulk approval off until the pilot gate on AI–human agreement is met." },
    ],
    audit: [
      { id: "ev-6", at: "28 Oct 09:12", who: "System", text: "Impact analysis recalculated on live data for CR-041." },
      { id: "ev-5", at: "28 Oct 08:41", who: "Noura A.", text: "Submitted CR-039 (ESC-02 v3) for approval." },
      { id: "ev-4", at: "27 Oct 16:20", who: "Majed F.", text: "Submitted CR-041 for approval (validation passed, 0 errors)." },
      { id: "ev-3", at: "27 Oct 14:05", who: "Majed F.", text: "Submitted CR-040 (AP-QIYAS-CRIT v2) for approval." },
      { id: "ev-2", at: "27 Oct 11:04", who: "Majed F.", text: "Draft QY-2026 v4 created from published v3." },
      { id: "ev-1", at: "02 Sep 08:30", who: "Huda S.", text: "Approved and published QY-2026 v3 (CR-022), effective Cycle 1." },
    ],
    // Next id is CR-042, continuing the seeded change requests.
    seq: 41,
  };
}
