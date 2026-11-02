// Consultant portfolio (dummy data). Demo Advisory Co. serves these client entities; only
// Demo Entity has a full workspace behind it, the others carry portfolio metadata only.

export type Model = "managed" | "co" | "draft";
export type Flag = "active" | "attn" | "draft";
export type Tone = "ok" | "warn" | "late" | "draft";

export interface Client {
  id: string;
  ini: string;
  name: string;
  nameAr?: string;
  sub: string;
  /** Logo colour pair index into LOGO. */
  logo: number;
  frameworks: string[];
  /** Completion %, null before activation. */
  pct: number | null;
  next: string;
  nextTone: Tone;
  flag: Flag;
}

export interface Engagement {
  clientId: string;
  index: string;
  model: Model;
  ready: number | null;
  delta: string;
  milestone: string;
  milestoneLate: boolean;
  term: string;
  termState: "ok" | "soon" | "pend";
  lead: string;
}

export const LOGO: [string, string][] = [
  ["#E7F3ED", "#0E5A45"],
  ["#E0ECF8", "#1E4E8C"],
  ["#FDE9D9", "#9A3412"],
  ["#F3E8F7", "#7A2E8C"],
  ["#EEEDFD", "#4F46E5"],
  ["#FFF4DF", "#8A4B00"],
];

export const CONSULTANT = { initials: "SR", name: "Sami R.", role: "Engagement Lead", firm: "Demo Advisory Co." };

/** The one client with a full workspace in the prototype. */
export const DEMO_CLIENT_ID = "demo-entity";

export const CLIENTS: Client[] = [
  { id: "demo-entity", ini: "DE", name: "Demo Entity", nameAr: "الجهة التجريبية", sub: "Authority", logo: 0, frameworks: ["Qiyas 2026"], pct: 72, next: "Verification · 9 d", nextTone: "ok", flag: "active" },
  { id: "demo-ministry", ini: "DM", name: "Demo Ministry of Services", sub: "Ministry", logo: 1, frameworks: ["Qiyas 2026", "NCA ECC"], pct: 81, next: "Self-assess · 21 d", nextTone: "ok", flag: "active" },
  { id: "demo-commission", ini: "DC", name: "Demo Commission", sub: "Commission", logo: 2, frameworks: ["Qiyas 2026"], pct: 58, next: "Evidence due · 3 d", nextTone: "late", flag: "attn" },
  { id: "demo-health", ini: "DH", name: "Demo Health Cluster", sub: "Cluster", logo: 4, frameworks: ["NDMO"], pct: 52, next: "Gap report · 5 d", nextTone: "warn", flag: "attn" },
  { id: "demo-university", ini: "DU", name: "Demo University", sub: "University", logo: 3, frameworks: ["Qiyas 2026"], pct: 77, next: "Verification · 9 d", nextTone: "ok", flag: "active" },
  { id: "demo-ports", ini: "PA", name: "Demo Ports Authority", sub: "Authority", logo: 4, frameworks: ["Qiyas 2026"], pct: 69, next: "Feedback · 16 d", nextTone: "ok", flag: "active" },
  { id: "demo-water", ini: "WA", name: "Demo Water Agency", sub: "Agency", logo: 0, frameworks: ["NDMO"], pct: 52, next: "Gap report · 5 d", nextTone: "warn", flag: "attn" },
  { id: "demo-skills", ini: "SF", name: "Demo Skills Fund", nameAr: "صندوق المهارات التجريبي", sub: "Draft · waiting for client activation", logo: 5, frameworks: ["Qiyas 2026"], pct: null, next: "Draft", nextTone: "draft", flag: "draft" },
];

export const ENGAGEMENTS: Engagement[] = [
  { clientId: "demo-entity", index: "Qiyas", model: "managed", ready: 72, delta: "+6.8", milestone: "Verification · 9 d", milestoneLate: false, term: "214 d left", termState: "ok", lead: "SR" },
  { clientId: "demo-ministry", index: "Qiyas", model: "co", ready: 81, delta: "+3.1", milestone: "Verification · 9 d", milestoneLate: false, term: "41 d left", termState: "soon", lead: "LA" },
  { clientId: "demo-ministry", index: "NCA ECC", model: "managed", ready: 64, delta: "new", milestone: "Self-assess · 21 d", milestoneLate: false, term: "41 d left", termState: "soon", lead: "LA" },
  { clientId: "demo-health", index: "Qiyas", model: "managed", ready: 58, delta: "−1.4", milestone: "Evidence due · 3 d", milestoneLate: true, term: "160 d left", termState: "ok", lead: "MK" },
  { clientId: "demo-university", index: "Qiyas", model: "co", ready: 77, delta: "+4.0", milestone: "Verification · 9 d", milestoneLate: false, term: "300 d left", termState: "ok", lead: "SR" },
  { clientId: "demo-ports", index: "Qiyas", model: "managed", ready: 69, delta: "+2.2", milestone: "Feedback · 16 d", milestoneLate: false, term: "98 d left", termState: "ok", lead: "MK" },
  { clientId: "demo-water", index: "NDMO", model: "co", ready: 52, delta: "new", milestone: "Gap report · 5 d", milestoneLate: true, term: "120 d left", termState: "ok", lead: "LA" },
  { clientId: "demo-skills", index: "Qiyas", model: "draft", ready: null, delta: "—", milestone: "Draft expires · 47 d", milestoneLate: false, term: "Pending approval", termState: "pend", lead: "SR" },
];

export function getClient(id: string) {
  return CLIENTS.find((c) => c.id === id);
}

/** Completion colour: green ≥ 70, amber ≥ 55, red below, grey before activation. */
export function completionColor(pct: number | null) {
  return pct == null ? "#C9D1CD" : pct >= 70 ? "#1F9D6E" : pct >= 55 ? "#E0A100" : "#D9442E";
}

/** Readiness colour on the portfolio table: green ≥ 85, amber ≥ 60, red below. */
export function readyColor(pct: number | null) {
  return pct == null ? "#C9D1CD" : pct >= 85 ? "#1F9D6E" : pct >= 60 ? "#E0A100" : "#D9442E";
}

export const clientHref = (id: string, path = "") => `/clients/${id}${path}`;
