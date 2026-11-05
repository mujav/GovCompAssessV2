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

/** The workspace framework (Qiyas) keeps the original per-client key; other frameworks get their own. */
export const submissionKey = (clientId: string, frameworkId?: string) => (!frameworkId || frameworkId === "fw-qiyas" ? `submission.${clientId}` : `submission.${clientId}.${frameworkId}`);
