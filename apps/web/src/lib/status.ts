// Shared status vocabulary. Compliance status and work status are two independent
// dimensions (blueprint §15.2), so they get separate maps and separate visuals.

export type Tone = { bg: string; fg: string };

export type ComplianceKey = "comp" | "part" | "non" | "nas" | "na";

export const COMPLIANCE: Record<ComplianceKey, Tone & { label: string }> = {
  comp: { bg: "#E3F1EA", fg: "#11603F", label: "Compliant" },
  part: { bg: "#FBEFD9", fg: "#8A4B00", label: "Partial" },
  non: { bg: "#FBE4E1", fg: "#A3261B", label: "Non-compliant" },
  nas: { bg: "#ECEEEC", fg: "#4A5550", label: "Not assessed" },
  na: { bg: "#E8ECF3", fg: "#3E4B63", label: "Not applicable" },
};

export type WorkKey =
  | "none"
  | "update"
  | "prog"
  | "returned"
  | "review"
  | "ready"
  | "sub"
  | "obs"
  | "closed"
  | "start"
  | "evsub";

// Dot color for the outlined work-status tag.
export const WORK_DOT: Record<WorkKey, string> = {
  none: "#A3261B",
  update: "#C27B12",
  prog: "#3F6FB5",
  returned: "#C27B12",
  review: "#3F37A8",
  ready: "#2E8B6A",
  sub: "#0E5A45",
  obs: "#A3261B",
  closed: "#7D8C85",
  start: "#B9C2BD",
  evsub: "#3F6FB5",
};

export type ToneKey = "ok" | "warn" | "bad" | "gray" | "ai" | "na" | "brand";

export const TONE: Record<ToneKey, Tone> = {
  ok: { bg: "#E3F1EA", fg: "#11603F" },
  warn: { bg: "#FBEFD9", fg: "#8A4B00" },
  bad: { bg: "#FBE4E1", fg: "#A3261B" },
  gray: { bg: "#ECEEEC", fg: "#4A5550" },
  ai: { bg: "#EEEDFB", fg: "#3F37A8" },
  na: { bg: "#E8ECF3", fg: "#3E4B63" },
  brand: { bg: "#E2EFE9", fg: "#0E5A45" },
};

// RAG thresholds: green ≥ 85, amber 60–84.99, red < 60.
export function ragColor(pct: number): string {
  return pct >= 85 ? "#2E8B6A" : pct >= 60 ? "#D08A1C" : "#C4412F";
}

export function ragText(pct: number): string {
  return pct >= 85 ? "#11603F" : pct >= 60 ? "#8A4B00" : "#A3261B";
}
