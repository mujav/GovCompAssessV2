// Imports the static flow boards from the Claude Design canvas (design/canvas/*.dc.html)
// into src/content/flows/*.html. The boards have no templating, so the markup is copied
// verbatim; only canvas links are rewritten to app routes and the <helmet> block is dropped.
//
// Run from apps/web:  node scripts/import-flows.mjs

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const canvasDir = join(here, "../../../design/canvas");
const outDir = join(here, "../src/content/flows");

// Board file → slug used under /flows/<slug>. Keep in sync with src/lib/flows.ts.
const BOARDS = {
  "IA.dc.html": "ia",
  "Main.dc.html": "journey",
  "Flow-Evidence-AI.dc.html": "evidence-ai",
  "Flow-Acceptance.dc.html": "acceptance",
  "Flow-Actions.dc.html": "actions",
  "Flow-Config.dc.html": "config",
};

// Canvas screen → app route.
const ROUTES = {
  "Command-Center.dc.html": "/command-center",
  "Requirements.dc.html": "/requirements",
  "Requirement-Detail.dc.html": "/requirements/5.11.2-2",
  "Evidence.dc.html": "/evidence",
  "Review-Workspace.dc.html": "/reviews",
  "Action-Center.dc.html": "/actions",
  "Remediation.dc.html": "/remediation",
  "Departments.dc.html": "/departments",
  "Submission.dc.html": "/submission",
  "Clarifications.dc.html": "/clarifications",
  "Comparisons.dc.html": "/comparisons",
  "Arabic-SPOC.dc.html": "/spoc",
  "Admin-Frameworks.dc.html": "/admin/frameworks",
  "Admin-Scoring.dc.html": "/admin/scoring",
  "Admin-Acceptance.dc.html": "/admin/acceptance",
  "Admin-Automation.dc.html": "/admin/automation",
  "Admin-History.dc.html": "/admin/history",
  ...Object.fromEntries(Object.entries(BOARDS).map(([file, slug]) => [file, `/flows/${slug}`])),
};

mkdirSync(outDir, { recursive: true });

for (const [file, slug] of Object.entries(BOARDS)) {
  const src = readFileSync(join(canvasDir, file), "utf8");
  const body = src.match(/<x-dc>([\s\S]*?)<\/x-dc>/);
  if (!body) throw new Error(`${file}: no <x-dc> block`);
  let html = body[1].replace(/<helmet>[\s\S]*?<\/helmet>/, "").trim();
  if (/<script|\{\{|<sc-/i.test(html)) throw new Error(`${file}: expected static markup`);
  html = html.replace(/href="([A-Za-z0-9-]+\.dc\.html)"/g, (m, target) => {
    const route = ROUTES[target];
    if (!route) throw new Error(`${file}: no route for ${target}`);
    return `href="${route}"`;
  });
  // next/font serves hashed family names, so point the boards at the app's font variables.
  html = html
    .replace(/'IBM Plex Sans Arabic'/g, "var(--font-plex-arabic)")
    .replace(/'IBM Plex Sans'/g, "var(--font-plex-sans)")
    .replace(/'IBM Plex Mono'/g, "var(--font-plex-mono)");
  writeFileSync(join(outDir, `${slug}.html`), html + "\n");
  console.log(`${file} → src/content/flows/${slug}.html (${html.length} chars)`);
}
