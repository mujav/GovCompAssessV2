// Requirement trees for the other published frameworks in the demo library (dummy wording,
// shaped like the real controls). Entities pick their frameworks from this library, so every
// framework a client is enrolled in has a requirement list to work through.

import type { FrameworkRequirement, FrameworkVersion, HierarchyLevel } from "./types";

type Row = [code: string, title: string, evidence?: string];

function tree(rows: Row[], levelOf: (code: string) => string, parentOf: (code: string) => string | undefined): FrameworkRequirement[] {
  return rows.map(([code, title, evidence]) => {
    const r: FrameworkRequirement = { code, level: levelOf(code), title };
    const parent = parentOf(code);
    if (parent) r.parent = parent;
    if (evidence) r.evidence = evidence;
    return r;
  });
}

const NCA_ROWS: Row[] = [
  ["1", "Cybersecurity Governance"],
  ["1-1", "Cybersecurity Strategy"],
  ["1-1-1", "A cybersecurity strategy is defined, documented and approved", "Approved cybersecurity strategy"],
  ["1-1-2", "A roadmap executes the cybersecurity strategy", "Roadmap with owners and dates"],
  ["1-2", "Cybersecurity Management"],
  ["1-2-1", "A cybersecurity function independent of IT is established", "Organisation chart; mandate"],
  ["1-2-2", "A cybersecurity steering committee oversees the programme", "Committee charter; minutes"],
  ["2", "Cybersecurity Defence"],
  ["2-1", "Asset Management"],
  ["2-1-1", "Information and technology assets are inventoried and classified", "Asset register"],
  ["2-2", "Identity and Access Management"],
  ["2-2-1", "Access is granted on least privilege and reviewed periodically", "Access policy; review records"],
  ["2-2-2", "Multi-factor authentication protects remote and privileged access", "MFA configuration evidence"],
  ["2-3", "Vulnerability Management"],
  ["2-3-1", "Vulnerabilities are scanned and remediated within set timelines", "Scan reports; remediation tracker"],
  ["3", "Cybersecurity Resilience"],
  ["3-1", "Business Continuity"],
  ["3-1-1", "Cybersecurity is part of the business continuity plan and tested", "BCP; test report"],
  ["4", "Third-Party and Cloud Cybersecurity"],
  ["4-1", "Third-Party Cybersecurity"],
  ["4-1-1", "Contracts with third parties carry cybersecurity requirements", "Contract clauses; NDA"],
  ["4-1-2", "Third-party risk is assessed before onboarding", "Risk assessment"],
];

const NCA_LEVELS: HierarchyLevel[] = [
  { id: "lv-1", en: "Domain", ar: "المجال", pattern: "#", assessed: "rollup" },
  { id: "lv-2", en: "Subdomain", ar: "المجال الفرعي", pattern: "#-#", assessed: "rollup" },
  { id: "lv-3", en: "Control", ar: "الضابط", pattern: "#-#-#", assessed: "accepted" },
  { id: "lv-4", en: "Subcontrol", ar: "الضابط الفرعي", pattern: "#-#-#-#", assessed: "ai_reviewer" },
];

export const NCA_REQUIREMENTS = tree(
  NCA_ROWS,
  (c) => `lv-${c.split("-").length}`,
  (c) => (c.includes("-") ? c.slice(0, c.lastIndexOf("-")) : undefined),
);

const NDMO_ROWS: Row[] = [
  ["DG", "Data Governance"],
  ["DG.1", "A data management and personal data protection strategy is approved", "Approved strategy"],
  ["DG.2", "A data management office with defined roles is established", "Office charter; role descriptions"],
  ["DG.3", "Data management policies are published and communicated", "Policy set; awareness records"],
  ["MCM", "Metadata and Data Catalog"],
  ["MCM.1", "A data catalog covers the entity's critical data assets", "Catalog extract"],
  ["MCM.2", "Business and technical metadata are maintained for catalogued assets", "Metadata standard; samples"],
  ["DQ", "Data Quality"],
  ["DQ.1", "Data quality rules are defined for critical data", "Data quality rules"],
  ["DQ.2", "Data quality is measured and issues are remediated", "Quality dashboard; issue log"],
  ["PDP", "Personal Data Protection"],
  ["PDP.1", "Personal data processing is recorded and has a lawful basis", "Record of processing"],
  ["PDP.2", "Data subject requests are handled within the legal timelines", "Request log"],
  ["OD", "Open Data"],
  ["OD.1", "Open datasets are identified, prioritised and published", "Open data plan; published datasets"],
];

const NDMO_LEVELS: HierarchyLevel[] = [
  { id: "lv-1", en: "Domain", ar: "المجال", pattern: "AA", assessed: "rollup" },
  { id: "lv-2", en: "Specification", ar: "المواصفة", pattern: "AA.#", assessed: "accepted" },
];

export const NDMO_LIVE: FrameworkVersion = {
  name: "NDMO Data Management Standards",
  version: "1.5",
  authority: "SDAIA · NDMO",
  effective: "01 Jan 2025",
  createdAt: "20 Nov 2024",
  publishedAt: "05 Dec 2024",
  scoringNote: "Compliance per specification",
  weighting: "none",
  levels: NDMO_LEVELS,
  requirements: tree(
    NDMO_ROWS,
    (c) => (c.includes(".") ? "lv-2" : "lv-1"),
    (c) => (c.includes(".") ? c.split(".")[0] : undefined),
  ),
};

export const NCA_LIVE_LEVELS = NCA_LEVELS;
