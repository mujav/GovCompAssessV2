// Submission pack state for one client, shared by screens 13 (pack) and 14 (submitted).

export interface SubmissionState {
  requested: boolean;
  signed: boolean;
  /** 0 = client uploads, 1 = consultant uploads under a delegation letter. */
  uploader: 0 | 1;
  submittedAt?: string;
  receipt?: string;
  /** Requirement counts frozen at submission. */
  frozen?: { total: number; accepted: number; files: number };
}

export const NO_SUBMISSION: SubmissionState = { requested: false, signed: false, uploader: 0 };

export const submissionKey = (clientId: string) => `submission.${clientId}`;
