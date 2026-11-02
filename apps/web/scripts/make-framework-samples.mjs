// Writes the Framework Builder demo files to public/samples/. Run with:
//   node scripts/make-framework-samples.mjs
// The Qiyas v1.3 workbook is derived from the seeded v1.2 tree so an import shows real
// added / changed / removed requirements against the live version.

import { mkdirSync, writeFileSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import * as XLSX from "xlsx";
import { QIYAS_V12_ROWS } from "../src/lib/admin/qiyas-base.ts";

const OUT = new URL("../public/samples/", import.meta.url);
mkdirSync(OUT, { recursive: true });
const out = (name, data) => writeFileSync(new URL(name, OUT), data);

/* ---------- Qiyas 2026 v1.3 (xlsx) ---------- */

const v13 = QIYAS_V12_ROWS.filter(([code]) => code !== "2.1.2-2").map((r) => [...r]);
const set = (code, patch) => Object.assign(v13.find((r) => r[0] === code), patch);
set("1.1.1-2", { 1: "Roadmap with initiatives, owners, budgets and timelines" });
set("3.2.1-2", { 2: "med", 3: "DR test report; recovery time results" });
const insertAfter = (code, row) => v13.splice(v13.findIndex((r) => r[0] === code) + 1, 0, row);
insertAfter("1.2.1-1", ["1.2.1-2", "Benefits realisation tracked for each initiative", "med", "Benefits register"]);
insertAfter("2.1.1-1", ["2.1.1-1-C1", "The catalogue is searchable by beneficiary type"]);
insertAfter("2.2.1-1", ["2.2.1-2", "Arabic and English interfaces available for every service", "", "Screenshots of both interfaces"]);
insertAfter("3.1.2-1", ["3.1.2-2", "Open data plan approved and refreshed every year", "", "Approved plan"]);

const sheet = [["Axis", "Standard", "Code", "Title", "Weight", "Evidence"]];
let axis = "";
let standard = "";
for (const [code, title, weight = "", evidence = ""] of v13) {
  const segs = code.match(/\d+/g).length;
  if (segs === 1) axis = `${code} - ${title}`;
  else if (segs === 3) standard = `${code} ${title}`;
  else {
    // Axis and standard only on the first row of each block, like merged cells.
    sheet.push([axis, standard, code, title, weight === "high" ? "High" : weight === "med" ? "Medium" : weight === "low" ? "Low" : "", evidence]);
    axis = "";
    standard = "";
  }
}
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([["Qiyas 2026 · requirements master · v1.3"], ["Issued by DGA. Sheet 03_Requirements holds one row per requirement or criterion."], ["Weights: High / Medium / Low."]]),
  "Read me",
);
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet), "03_Requirements");
out("qiyas-2026-v1.3.xlsx", XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));

/* ---------- Cybersecurity controls (csv, hierarchical columns, prefixed codes) ---------- */

const ecc = [
  ["ECC 1", "Cybersecurity Governance", "ECC 1-1", "Cybersecurity Strategy", "ECC 1-1-1", "Cybersecurity strategy", "A cybersecurity strategy is defined, documented and approved by the head of the entity."],
  ["", "", "", "", "ECC 1-1-2", "Strategy roadmap", "A roadmap implements the strategy, with initiatives reviewed at planned intervals."],
  ["", "", "ECC 1-2", "Cybersecurity Management", "ECC 1-2-1", "Cybersecurity function", "A cybersecurity function independent from IT is established and staffed."],
  ["", "", "", "", "ECC 1-2-2", "Steering committee", "A steering committee oversees cybersecurity programmes and risks."],
  ["", "", "ECC 1-3", "Policies and Procedures", "ECC 1-3-1", "Policy set", "Cybersecurity policies and procedures are documented, approved and communicated."],
  ["", "", "", "", "ECC 1-3-2", "Policy review", "Policies are reviewed at planned intervals or after significant change."],
  ["ECC 2", "Cybersecurity Defence", "ECC 2-1", "Asset Management", "ECC 2-1-1", "Asset inventory", "An inventory of information and technology assets is maintained."],
  ["", "", "", "", "ECC 2-1-2", "Asset classification", "Assets are classified and labelled according to their sensitivity."],
  ["", "", "ECC 2-2", "Identity and Access Management", "ECC 2-2-1", "Multi-factor authentication", "Multi-factor authentication is enforced for remote and privileged access."],
  ["", "", "", "", "ECC 2-2-2", "Access reviews", "User access rights are reviewed periodically and on role change."],
  ["", "", "", "", "", "Privileged access", "Privileged accounts are managed through a dedicated access solution."],
  ["", "", "ECC 2-3", "Vulnerability Management", "ECC 2-3-1", "Vulnerability scanning", "Systems are scanned for vulnerabilities and findings are remediated by risk."],
  ["", "", "", "", "ECC 2-3-1", "Vulnerability scanning", "Scanning covers internet-facing systems at least monthly."],
  ["ECC 3", "Cybersecurity Resilience", "ECC 3-1", "Business Continuity", "ECC 3-1-1", "Continuity planning", "Cybersecurity requirements are part of business continuity management."],
  ["", "", "", "", "ECC 3-1-2", "Continuity testing", "Continuity and recovery plans are tested at planned intervals."],
];
const csvCell = (c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
out(
  "nca-ecc-controls.csv",
  [["Domain Code", "Domain", "Subdomain Code", "Subdomain", "Control Code", "Control", "Control Description"], ...ecc].map((r) => r.map(csvCell).join(",")).join("\n") + "\n",
);

/* ---------- Data index (markdown) ---------- */

out(
  "national-data-index.md",
  `# National Data Index 2026

Self-assessment template. Each requirement lists its weight and expected evidence.

## Pillar 1: Data Governance

### Objective 1.1: Ownership and accountability

- 1.1.1 A chief data officer is appointed with a documented mandate.
  Weight: High
  Evidence: Appointment decision; mandate document
- 1.1.2 Data owners and stewards are named for every critical dataset.
  Weight: Medium
  Evidence:
  - Data ownership matrix
  - Steward role descriptions

### Objective 1.2: Policies

- 1.2.1 A data management policy is approved and published. (Weight: High)
- 1.2.2 The policy is reviewed every year.

## Pillar 2: Data Quality

### Objective 2.1: Quality management

- 2.1.1 Quality rules are defined for critical data elements.
  Weight: Medium
  The rules cover at least:
  1. completeness
  2. accuracy
  3. timeliness
- 2.1.2 Quality issues are logged and resolved within agreed times.
  Weight: Low

### Objective 2.3: Reference data

- 2.3.1 Reference data is managed in a single authoritative source.
  Weight: Medium
`,
);

/* ---------- AI ethics index (json) ---------- */

out(
  "ai-ethics-index.json",
  JSON.stringify(
    {
      framework: "AI Ethics Readiness Index",
      authority: "Internal",
      version: "1.0",
      levels: [
        { en: "Principle", ar: "المبدأ" },
        { en: "Practice", ar: "الممارسة" },
      ],
      principles: [
        {
          code: "AIE-1",
          title: "Fairness",
          practices: [
            { code: "AIE-1.1", title: "Bias testing before deployment", weight: "high", evidence: ["Bias test report"] },
            { code: "AIE-1.2", title: "Representative training data documented", weight: "med", evidence: ["Datasheet"] },
          ],
        },
        {
          code: "AIE-2",
          title: "Transparency",
          practices: [
            { code: "AIE-2.1", title: "Users are told when they interact with an AI system", weight: "high" },
            { code: "AIE-2.2", title: "Model cards published for production models", weight: "low", evidence: ["Model card"] },
          ],
        },
        {
          code: "AIE-3",
          title: "Accountability",
          practices: [{ code: "AIE-3.1", title: "A named owner signs off each AI use case", weight: "med" }],
        },
      ],
    },
    null,
    2,
  ) + "\n",
);

/* ---------- Digital services index (plain text) ---------- */

out(
  "digital-services-index.txt",
  `DIGITAL SERVICES MATURITY INDEX

Section 1: Service design
1.1 Services are designed around life events
1.1.1 Life events are mapped to services across entities [High]
1.1.2 Each life event has a journey owner [Medium]
1.2 User research
1.2.1 Usability testing runs before each major release [Medium]
Evidence: test plans; findings log

Section 2: Service delivery
2.1 Channels
2.1.1 Services are available on mobile without loss of function [High]
2.1.2 Assisted channels exist for users who cannot use digital channels
2.2.1 Service status is visible to the user at each step [Low]
`,
);

/* ---------- Privacy controls (docx) ---------- */

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const para = (text, style) => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}<w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
const cell = (text) => `<w:tc><w:tcPr><w:tcW w:w="3000" w:type="dxa"/></w:tcPr>${para(text)}</w:tc>`;
const table = (rows) => `<w:tbl><w:tblPr><w:tblW w:w="9000" w:type="dxa"/></w:tblPr>${rows.map((r) => `<w:tr>${r.map(cell).join("")}</w:tr>`).join("")}</w:tbl>`;
const body = [
  para("Personal Data Protection Controls", "Heading1"),
  para("Controls an entity applies when it processes personal data."),
  para("Domain PDP-1: Lawful processing", "Heading2"),
  para("PDP-1.1 A lawful basis is recorded for every processing activity. Weight: High"),
  para("PDP-1.2 Consent is captured, recorded and can be withdrawn."),
  para("Evidence: consent records; withdrawal procedure"),
  para("Domain PDP-2: Data subject rights", "Heading2"),
  table([
    ["Code", "Control", "Weight"],
    ["PDP-2.1", "Requests to access personal data are answered within 30 days", "High"],
    ["PDP-2.2", "Personal data can be corrected on request", "Medium"],
    ["PDP-2.3", "Erasure requests are assessed and logged", "Low"],
  ]),
].join("");
const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`;
const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style></w:styles>`;
out(
  "privacy-controls.docx",
  zip({
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/_rels/document.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    "word/document.xml": docXml,
    "word/styles.xml": stylesXml,
  }),
);

/* ---------- Cloud security standard (pdf) ---------- */

out(
  "cloud-security-standard.pdf",
  pdf([
    [
      "Cloud Security Standard 2026",
      "Issued for government entities that host workloads in the cloud.",
      "CSS-1 Governance",
      "CSS-1.1 A cloud security policy is approved and published High",
      "CSS-1.2 Cloud service providers are assessed before onboarding Medium",
      "Evidence: provider assessment reports",
      "CSS-2 Data protection",
      "CSS-2.1 Data is classified before it is moved to the cloud High",
      "CSS-2.2 Data at rest is encrypted with keys the entity controls High",
    ],
    [
      "CSS-2.3 Data residency requirements are met for classified data Medium",
      "CSS-3 Operations",
      "CSS-3.1 Cloud logs are retained and monitored centrally Medium",
      "CSS-3.2 Configuration baselines are enforced automatically",
      "CSS-3.2 Configuration baselines are enforced automatically Low",
    ],
  ]),
);

console.log("Samples written to public/samples/");

/* ---------- Minimal writers ---------- */

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const data = Buffer.from(content);
    const comp = deflateRawSync(data);
    const n = Buffer.from(name);
    const crc = crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0);
    head.writeUInt16LE(20, 4);
    head.writeUInt16LE(8, 8);
    head.writeUInt32LE(crc, 14);
    head.writeUInt32LE(comp.length, 18);
    head.writeUInt32LE(data.length, 22);
    head.writeUInt16LE(n.length, 26);
    local.push(head, n, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(8, 10);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(comp.length, 20);
    cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(n.length, 28);
    cen.writeUInt32LE(offset, 42);
    central.push(cen, n);
    offset += 30 + n.length + comp.length;
  }
  const cenBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(cenBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cenBuf, end]);
}

function pdf(pages) {
  const objs = [];
  const add = (s) => objs.push(s) && objs.length;
  const catalog = add("");
  const pagesId = add("");
  const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const kids = pages.map((lines) => {
    const ops = lines.map((l, i) => `BT /F1 ${i === 0 ? 14 : 11} Tf 56 ${780 - i * 22} Td (${l.replace(/[()\\]/g, "\\$&")}) Tj ET`).join("\n");
    const content = add(`<< /Length ${Buffer.byteLength(ops)} >>\nstream\n${ops}\nendstream`);
    return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);
  });
  objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let body = "%PDF-1.4\n";
  const offsets = objs.map((o, i) => {
    const at = Buffer.byteLength(body);
    body += `${i + 1} 0 obj\n${o}\nendobj\n`;
    return at;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  body += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}
