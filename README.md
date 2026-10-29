# GovCompAssessV2

Prototype of a configurable government compliance assessment platform ("Compliance Intelligence"). Qiyas 2026 (DGA Basic Digital Transformation Standards) is the first framework pack; the screens are built to be framework-neutral.

## Layout

- `apps/web`: Next.js 15 (App Router) + TypeScript + Tailwind CSS v4. UI prototype with mock data, no backend yet.
- `design/canvas`: source of the Claude Design canvas the UI implements (flows, workspace screens, Admin Studio).

## Run

Requires Node.js 20+.

```bash
cd apps/web
npm install
npm run dev
```

Open http://localhost:3000. It redirects to the Command Center.

## Screens

| Area | Routes |
| --- | --- |
| Workspace | `/command-center`, `/requirements`, `/requirements/[code]`, `/evidence`, `/reviews`, `/actions`, `/remediation`, `/clarifications`, `/submission` |
| Insights | `/departments`, `/comparisons` |
| Department SPOC (Arabic, RTL) | `/spoc` |
| Admin Studio | `/admin/frameworks`, `/admin/scoring`, `/admin/acceptance`, `/admin/automation`, `/admin/history` |
| Flows & architecture | `/flows/journey`, `/flows/ia`, `/flows/evidence-ai`, `/flows/acceptance`, `/flows/actions`, `/flows/config` |

Design tokens (colors, fonts) live in `apps/web/src/app/globals.css`. Shared UI is in `apps/web/src/components`. Compliance status and work status are kept as separate vocabularies in `apps/web/src/lib/status.ts`.

The flow boards are static diagrams. They are imported verbatim from the canvas by `node scripts/import-flows.mjs` (run in `apps/web`) into `src/content/flows/`.
