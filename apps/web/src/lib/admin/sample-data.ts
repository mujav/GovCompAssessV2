// Deterministic dummy records the Admin Studio previews and tests run against.
// Not real Qiyas data: counts are shaped like the pilot (350 requirements, 6 domains).

import type { ActionRecord, ComplianceStatus } from "./types";

export interface SampleRequirement {
  code: string;
  domain: string;
  weight: "high" | "med" | "low";
  /** Status the reviewer accepted before any blocking rule is applied. */
  status: ComplianceStatus;
  /** A mandatory criterion is not satisfied. */
  mandatoryFail: boolean;
}

// Small seeded PRNG so previews are stable between renders and test runs.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DOMAINS: { name: string; prefix: number; applicable: number; na: number; mix: [number, number, number, number] }[] = [
  // mix = share of compliant, partial, non-compliant, not assessed
  { name: "Strategy & governance", prefix: 1, applicable: 52, na: 2, mix: [0.7, 0.2, 0.04, 0.06] },
  { name: "Digital services", prefix: 3, applicable: 69, na: 2, mix: [0.52, 0.28, 0.08, 0.12] },
  { name: "Technology & integration", prefix: 5, applicable: 62, na: 3, mix: [0.45, 0.27, 0.13, 0.15] },
  { name: "Human capital", prefix: 4, applicable: 43, na: 1, mix: [0.4, 0.28, 0.2, 0.12] },
  { name: "Data & analytics", prefix: 2, applicable: 53, na: 2, mix: [0.6, 0.2, 0.08, 0.12] },
  { name: "Beneficiary experience", prefix: 6, applicable: 59, na: 2, mix: [0.75, 0.15, 0.03, 0.07] },
];

function pick<T>(r: number, items: [T, number][]): T {
  let acc = 0;
  for (const [item, share] of items) {
    acc += share;
    if (r < acc) return item;
  }
  return items[items.length - 1][0];
}

export function sampleRequirements(): SampleRequirement[] {
  const rand = mulberry32(2026);
  const out: SampleRequirement[] = [];
  for (const d of DOMAINS) {
    for (let i = 0; i < d.applicable + d.na; i++) {
      const std = Math.floor(i / 4) + 1;
      const code = `${d.prefix}.${(std % 9) + 1}.${Math.floor(std / 9) + 1}-${(i % 4) + 1}`;
      const weight = pick(rand(), [["high", 0.3], ["med", 0.5], ["low", 0.2]] as [SampleRequirement["weight"], number][]);
      const [c, p, n] = d.mix;
      const status: ComplianceStatus =
        i >= d.applicable ? "na" : pick(rand(), [["comp", c], ["part", p], ["non", n], ["nas", 1]] as [ComplianceStatus, number][]);
      // About a third of partial results hide a failed mandatory criterion.
      const mandatoryFail = status === "part" && rand() < 0.33;
      out.push({ code, domain: d.name, weight, status, mandatoryFail });
    }
  }
  return out;
}

export const SAMPLE_REQUIREMENTS = sampleRequirements();

/** Reference date for the demo cycle, so rule tests are reproducible. */
export const DEMO_TODAY = "2026-10-28";

export const SAMPLE_ACTIONS: ActionRecord[] = [
  { id: "ACT-118", requirement: "4.1.2-1 Approved digital capability plan", department: "Human Capital", work_status: "No update", due_date: "2026-10-09", reminders_sent: 2, priority: "Critical" },
  { id: "ACT-121", requirement: "4.3.1-1 Digital skills training tracked", department: "Human Capital", work_status: "No update", due_date: "2026-10-14", reminders_sent: 2, priority: "High" },
  { id: "ACT-124", requirement: "4.2.2-1 Succession plan for digital roles", department: "Human Capital", work_status: "No update", due_date: "2026-10-17", reminders_sent: 3, priority: "High" },
  { id: "ACT-102", requirement: "5.11.2-2 End-to-end integration samples", department: "IT Operations", work_status: "No update", due_date: "2026-10-16", reminders_sent: 2, priority: "Critical" },
  { id: "ACT-127", requirement: "4.1.1-2 Digital roles in org structure", department: "Human Capital", work_status: "No update", due_date: "2026-10-20", reminders_sent: 2, priority: "High" },
  { id: "ACT-131", requirement: "5.3.1-1 Architecture repository current", department: "IT Operations", work_status: "No update", due_date: "2026-10-21", reminders_sent: 2, priority: "High" },
  { id: "ACT-133", requirement: "4.3.2-2 Training needs analysis", department: "Human Capital", work_status: "No update", due_date: "2026-10-22", reminders_sent: 2, priority: "Critical" },
  { id: "ACT-109", requirement: "3.2.4-1 Service-level KPIs published", department: "Digital Transformation", work_status: "No update", due_date: "2026-10-19", reminders_sent: 2, priority: "Medium" },
  { id: "ACT-115", requirement: "6.2.1-3 Feedback closes the loop", department: "Customer Experience", work_status: "No update", due_date: "2026-10-23", reminders_sent: 2, priority: "Low" },
  { id: "ACT-140", requirement: "2.2.3-4 Committee meets quarterly", department: "Strategy & Performance", work_status: "No update", due_date: "2026-10-25", reminders_sent: 1, priority: "High" },
  { id: "ACT-142", requirement: "5.11.1-1 Integration register approved", department: "IT Operations", work_status: "No update", due_date: "2026-10-24", reminders_sent: 1, priority: "Critical" },
  { id: "ACT-145", requirement: "4.2.1-1 Digital competency framework", department: "Human Capital", work_status: "No update", due_date: "2026-10-26", reminders_sent: 1, priority: "High" },
  { id: "ACT-150", requirement: "3.4.1-1 Digital services catalogue", department: "Digital Transformation", work_status: "In progress", due_date: "2026-11-03", reminders_sent: 0, priority: "High" },
  { id: "ACT-152", requirement: "1.3.2-2 Governance committee charter", department: "Legal & Governance", work_status: "Evidence submitted", due_date: "2026-10-20", reminders_sent: 1, priority: "Medium" },
];
