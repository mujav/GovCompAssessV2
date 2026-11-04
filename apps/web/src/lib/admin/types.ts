// Admin Studio configuration model. Everything here is framework-neutral: Qiyas is
// only seed data. Each configurable object has a published (live) version and at most
// one draft; drafts change official results only after a four-eyes approval.

export type ComplianceStatus = "comp" | "part" | "non" | "nas" | "na";

export interface Versioned<T> {
  id: string;
  live?: T;
  draft?: T;
  /** Change request the draft is waiting on; the draft is read-only while set. */
  pendingCr?: string;
}

/* ---------- Users ---------- */

export interface AdminUser {
  id: string;
  name: string;
  role: string;
  /** Holds "approve configuration change". */
  canApprove: boolean;
}

/* ---------- Framework package ---------- */

export type LevelAssessment = "rollup" | "accepted" | "ai_reviewer";

export interface HierarchyLevel {
  id: string;
  en: string;
  ar: string;
  pattern: string;
  assessed: LevelAssessment;
}

export interface ImportJob {
  file: string;
  tab: string;
  rows: number;
  uploadedBy: string;
  hash: string;
  valid: number;
  warnings: { row: number; field: string; message: string }[];
  changed: string;
  errors: number;
}

/** One node of the framework tree (any level), as published with the version. */
export interface FrameworkRequirement {
  code: string;
  /** HierarchyLevel.id this node sits at. */
  level: string;
  /** Code of the parent node; absent for top-level nodes. */
  parent?: string;
  title: string;
  text?: string;
  /** "high" | "med" | "low" or a numeric weight as written in the source. */
  weight?: string;
  evidence?: string;
  /** Where the node came from, e.g. "qiyas.xlsx · 03_Requirements · row 14". */
  source?: string;
}

export interface FrameworkVersion {
  name: string;
  version: string;
  authority: string;
  effective: string;
  scoringNote: string;
  levels: HierarchyLevel[];
  importJob?: ImportJob;
  requirements?: FrameworkRequirement[];
  /** "none" when the framework publishes no weights and every requirement counts equally. */
  weighting?: "weighted" | "none";
  /** Full SHA-256 of the source documents, so the same file cannot be added twice. */
  fileHashes?: string[];
  /** Date the version was created (draft) and went live, e.g. "02 Nov 2026". */
  createdAt?: string;
  publishedAt?: string;
}

/** A version that was live before the current one. */
export interface FrameworkVersionRecord {
  version: string;
  effective: string;
  publishedAt?: string;
  supersededAt: string;
  nodes: number;
  fileHashes?: string[];
}

export interface FrameworkPackage extends Versioned<FrameworkVersion> {
  /** Assessment cycles using the live version; used versions are immutable. */
  usedByCycles: number;
  /** Earlier live versions, newest first. */
  history?: FrameworkVersionRecord[];
}

/* ---------- Scoring ---------- */

export type ScoringMethod = "binary" | "three" | "maturity" | "points";
export type NaTreatment = "exclude" | "redistribute" | "authority";
export type BlockingCap = "non" | "part" | "off";

export interface ScoringScheme {
  code: string;
  version: number;
  method: ScoringMethod;
  /** Points per status for three-level and custom point scales (0–1). */
  points: Record<Exclude<ComplianceStatus, "na">, number>;
  blockingCap: BlockingCap;
  naTreatment: NaTreatment;
  rounding: 0 | 1 | 2;
  weights: { high: number; med: number; low: number };
  green: number;
  amber: number;
  target: number;
  overrideDelta: number;
}

/* ---------- Acceptance ---------- */

export type StageMode = "single" | "parallel" | "final";

export interface ReviewStage {
  id: string;
  mode: StageMode;
  name: string;
  reviewers: string;
  minApprovals: number;
  poolSize: number;
  onReject: string;
  slaDays: number;
  independence: string;
  rights: string[];
}

export interface AcceptancePolicy {
  code: string;
  version: number;
  name: string;
  scope: string;
  stages: ReviewStage[];
  rationaleRequired: boolean;
  materialOverrideEscalates: boolean;
  allowBulk: boolean;
  reopenOnEvidence: boolean;
  reopenOnClarification: boolean;
  reopenOnConfig: boolean;
}

/* ---------- Automation ---------- */

export type RuleField = "work_status" | "due_date" | "reminders_sent" | "priority" | "department";
export type RuleOp = "=" | "≠" | "<" | ">" | "≥" | "≤" | "in";

export interface RuleCondition {
  id: string;
  field: RuleField;
  op: RuleOp;
  value: string;
}

export interface AutomationRule {
  code: string;
  version: number;
  name: string;
  summary: string;
  trigger: string;
  time: string;
  conditions: RuleCondition[];
  actions: string[];
}

/** Operational record the rules run against (dummy data). */
export interface ActionRecord {
  id: string;
  requirement: string;
  department: string;
  work_status: string;
  due_date: string;
  reminders_sent: number;
  priority: "Low" | "Medium" | "High" | "Critical";
}

/* ---------- Governance ---------- */

export type ConfigKind = "framework" | "scoring" | "acceptance" | "rule";
export type CrStatus = "awaiting" | "published" | "rejected";

export interface DiffRow {
  label: string;
  before: string;
  after: string;
  changed: boolean;
}

export interface ChangeRequest {
  id: string;
  kind: ConfigKind;
  targetId: string;
  title: string;
  authorId: string;
  submittedAt: string;
  status: CrStatus;
  material: boolean;
  diff: DiffRow[];
  impact: string[];
  decidedBy?: string;
  decidedAt?: string;
  comment?: string;
  effectiveFrom?: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  who: string;
  text: string;
}

export interface AdminState {
  currentUserId: string;
  users: AdminUser[];
  frameworks: FrameworkPackage[];
  /** Seeded standards the admin deleted, so loading saved state does not add them back. */
  deletedFrameworks?: string[];
  scoring: Versioned<ScoringScheme>;
  policies: Versioned<AcceptancePolicy>[];
  rules: Versioned<AutomationRule>[];
  changeRequests: ChangeRequest[];
  audit: AuditEvent[];
  seq: number;
}
