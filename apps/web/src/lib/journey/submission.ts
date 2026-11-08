// Submission pack state for one client and framework, shared by screens 13 (pack) and 14 (submitted).

export interface SubmissionState {
  requested: boolean;
  signed: boolean;
  /** Index owner who signed the pack off. */
  signedBy?: string;
  /** 0 = the index owner uploads, 1 = someone else uploads under a delegation letter. */
  uploader: 0 | 1;
  submittedAt?: string;
  receipt?: string;
  /** Requirement counts frozen at submission. */
  frozen?: { total: number; accepted: number; files: number };
}

export const NO_SUBMISSION: SubmissionState = { requested: false, signed: false, uploader: 0 };

/** The workspace framework (Qiyas) keeps the original per-client key; other frameworks get their own, and cycles after the first theirs. */
export const submissionKey = (clientId: string, frameworkId?: string, cycle = 1) =>
  `${!frameworkId || frameworkId === "fw-qiyas" ? `submission.${clientId}` : `submission.${clientId}.${frameworkId}`}${cycle > 1 ? `.c${cycle}` : ""}`;
