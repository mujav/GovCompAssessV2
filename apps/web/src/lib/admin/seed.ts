// Dummy Admin Studio configuration, shaped like the Qiyas pilot in the design canvas.

import { diffConfig } from "./diff";
import { impactFor } from "./impact";
import { ECC_LEVELS, ECC_REQUIREMENTS } from "./ecc-2024";
import { NDMO_LIVE } from "./library-seed";
import { QIYAS_V5_LEVELS, QIYAS_V5_REQUIREMENTS } from "./qiyas-v5";
import type {
  AcceptancePolicy,
  AdminState,
  AutomationRule,
  FrameworkVersion,
  ReviewStage,
  ScoringScheme,
} from "./types";

// The standards Qiyas measures, as DGA published them (Arabic only).
const qiyasLive: FrameworkVersion = {
  name: "Qiyas 2026",
  nameAr: "المعايير الأساسية للتحول الرقمي",
  version: "5.0",
  authority: "DGA",
  effective: "Apr 2026",
  scoringNote: "Full / partial / non-compliance per standard",
  weighting: "none",
  levels: QIYAS_V5_LEVELS,
  requirements: QIYAS_V5_REQUIREMENTS,
  createdAt: "Apr 2026",
  publishedAt: "Apr 2026",
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
    stage("st-2", { mode: "single", name: "Control Owner", reviewers: "Role: Control Owner", onReject: "Back to stage 1", independence: "Not stage 1", rights: ["Approve", "Reject"] }),
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
      { id: "u-majed", name: "Mohammed K.", role: "Studio editor", canApprove: false },
      { id: "u-noura", name: "Yasser T.", role: "Studio editor", canApprove: false },
      { id: "u-huda", name: "Sami R.", role: "Platform Admin", canApprove: true },
    ],
    frameworks: [
      {
        id: "fw-qiyas",
        live: qiyasLive,
        usedByCycles: 1,
      },
      {
        id: "fw-nca",
        usedByCycles: 1,
        history: [{ version: "2018", effective: "01 Oct 2018", publishedAt: "15 Sep 2018", supersededAt: "20 Feb 2024", nodes: 0 }],
        live: {
          name: "NCA ECC",
          nameAr: "الضوابط الأساسية للأمن السيبراني",
          version: "2024",
          authority: "NCA",
          effective: "01 Mar 2024",
          createdAt: "02 Feb 2024",
          publishedAt: "20 Feb 2024",
          scoringNote: "Maturity 0–5 · minimum by domain",
          weighting: "none",
          levels: ECC_LEVELS,
          requirements: ECC_REQUIREMENTS,
        },
      },
      { id: "fw-ndmo", usedByCycles: 2, live: NDMO_LIVE },
      {
        id: "fw-iso",
        usedByCycles: 0,
        draft: {
          name: "Internal ISO 27001",
          version: "0.1",
          authority: "Internal audit",
          effective: "—",
          createdAt: "14 Oct 2026",
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
      { id: "AP-QIYAS-CRIT", live: critLive },
      { id: "AP-LOW-SAMPLED", live: lowPolicy },
      { id: "AP-NCA-SEQ", live: ncaPolicy },
    ],
    rules,
    changeRequests: [
      { id: "CR-041", kind: "scoring", targetId: "QY-2026", title: "Scoring scheme QY-2026 v3 → v4", authorId: "u-majed", submittedAt: "27 Oct 16:20", status: "awaiting", material: true, diff: diffConfig("scoring", scoringLive, scoringDraft), impact: impactFor("scoring", scoringLive, scoringDraft) },
      { id: "CR-039", kind: "rule", targetId: "ESC-02", title: "Rule ESC-02 v2 → v3 adds priority condition", authorId: "u-noura", submittedAt: "28 Oct 08:41", status: "awaiting", material: false, diff: diffConfig("rule", escLive, escDraft), impact: impactFor("rule", escLive, escDraft) },
      { id: "CR-038", kind: "framework", targetId: "fw-qiyas", title: "Arabic labels for hierarchy levels", authorId: "u-noura", submittedAt: "21 Oct 10:12", status: "published", material: false, diff: [{ label: "Arabic labels", before: "—", after: "المحور › المعيار › المتطلب › البند", changed: true }], impact: ["Cosmetic: no assessment results change"], decidedBy: "Sami R.", decidedAt: "21 Oct 15:30" },
      { id: "CR-036", kind: "acceptance", targetId: "AP-QIYAS-STD", title: "Allow bulk approval for medium risk", authorId: "u-noura", submittedAt: "14 Oct 09:00", status: "rejected", material: true, diff: [{ label: "Override governance", before: "rationale, material escalates", after: "rationale, material escalates, bulk allowed", changed: true }], impact: ["Bulk approval would cover 118 medium-risk requirements"], decidedBy: "Sami R.", decidedAt: "14 Oct 13:20", comment: "Keep bulk approval off until the pilot gate on AI–human agreement is met." },
    ],
    audit: [
      { id: "ev-6", at: "28 Oct 09:12", who: "System", text: "Impact analysis recalculated on live data for CR-041." },
      { id: "ev-5", at: "28 Oct 08:41", who: "Yasser T.", text: "Submitted CR-039 (ESC-02 v3) for approval." },
      { id: "ev-4", at: "27 Oct 16:20", who: "Mohammed K.", text: "Submitted CR-041 for approval (validation passed, 0 errors)." },
      { id: "ev-2", at: "27 Oct 11:04", who: "Mohammed K.", text: "Draft QY-2026 v4 created from published v3." },
      { id: "ev-1", at: "02 Sep 08:30", who: "Sami R.", text: "Approved and published QY-2026 v3 (CR-022), effective Cycle 1." },
    ],
    // Next id is CR-042, continuing the seeded change requests.
    seq: 41,
  };
}
