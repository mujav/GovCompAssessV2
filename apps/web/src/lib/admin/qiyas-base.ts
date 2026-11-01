// Requirements tree of the published Qiyas 2026 v1.2 package (dummy wording). Also read by
// scripts/make-framework-samples.mjs, which derives the v1.3 sample workbook from it, so
// importing that workbook shows real added / changed / removed requirements.

import type { FrameworkRequirement } from "./types";

type Row = [code: string, title: string, weight?: string, evidence?: string];

const LEVEL: Record<number, string> = { 1: "lv-1", 3: "lv-2", 4: "lv-3", 5: "lv-4" };

export const QIYAS_V12_ROWS: Row[] = [
  ["1", "Strategy & Governance"],
  ["1.1.1", "Digital transformation strategy"],
  ["1.1.1-1", "Approved digital transformation strategy aligned with the national digital government strategy", "high", "Approved strategy document; approval minutes"],
  ["1.1.1-1-C1", "The strategy is approved by the head of the entity"],
  ["1.1.1-1-C2", "The strategy is reviewed at least once a year"],
  ["1.1.1-2", "Roadmap with initiatives, owners and timelines", "med", "Roadmap; initiative charters"],
  ["1.1.1-2-C1", "Every initiative on the roadmap has a named owner"],
  ["1.1.2", "Digital governance"],
  ["1.1.2-1", "Digital transformation committee with a defined mandate", "high", "Committee charter; last four meeting minutes"],
  ["1.1.2-2", "Digital governance policies published internally", "med", "Policy register"],
  ["1.2.1", "Performance management"],
  ["1.2.1-1", "Digital transformation KPIs tracked every quarter", "med", "KPI dashboard export"],
  ["2", "Digital Services"],
  ["2.1.1", "Service catalogue"],
  ["2.1.1-1", "Unified service catalogue published on the entity portal", "high", "Portal link; catalogue extract"],
  ["2.1.1-2", "Each service lists its requirements, fees and service level", "med", "Service cards"],
  ["2.1.2", "Beneficiary experience"],
  ["2.1.2-1", "Beneficiary satisfaction measured for each digital service", "med", "Survey results"],
  ["2.1.2-2", "Complaints channel linked to service records", "low", "Complaints workflow screenshots"],
  ["2.2.1", "Accessibility"],
  ["2.2.1-1", "Digital services meet WCAG 2.1 level AA", "high", "Accessibility audit report"],
  ["3", "Data & Technology"],
  ["3.1.1", "Data management"],
  ["3.1.1-1", "Data management office established", "high", "Appointment decision; organisation chart"],
  ["3.1.1-2", "Data catalogue covers all critical datasets", "med", "Catalogue export"],
  ["3.1.2", "Open data"],
  ["3.1.2-1", "Open datasets published on the national open data portal", "low", "Portal links"],
  ["3.2.1", "Cloud and infrastructure"],
  ["3.2.1-1", "Cloud-first policy adopted", "med", "Approved policy"],
  ["3.2.1-2", "Disaster recovery plan tested every year", "high", "DR test report"],
];

function parentOf(code: string) {
  if (code.includes("-")) return code.slice(0, code.lastIndexOf("-"));
  return code.includes(".") ? code.split(".")[0] : undefined;
}

export const QIYAS_V12_REQUIREMENTS: FrameworkRequirement[] = QIYAS_V12_ROWS.map(([code, title, weight, evidence]) => {
  const r: FrameworkRequirement = { code, level: LEVEL[(code.match(/\d+/g) ?? []).length], title, source: "qiyas-2026-v1.2.xlsx" };
  const parent = parentOf(code);
  if (parent) r.parent = parent;
  if (weight) r.weight = weight;
  if (evidence) r.evidence = evidence;
  return r;
});
