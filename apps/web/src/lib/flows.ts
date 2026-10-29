import { readFileSync } from "node:fs";
import { join } from "node:path";

// Flow boards imported from the design canvas by scripts/import-flows.mjs.
export const FLOWS = [
  { slug: "journey", code: "F1", title: "End-to-end journey (swimlanes)", width: 2536 },
  { slug: "ia", code: "F0", title: "Information architecture", width: 1600 },
  { slug: "evidence-ai", code: "F2", title: "Evidence → AI assessment pipeline", width: 1712 },
  { slug: "acceptance", code: "F3", title: "Human acceptance state machine", width: 1764 },
  { slug: "actions", code: "F4", title: "Action, reminder & escalation", width: 2160 },
  { slug: "config", code: "F5", title: "Configuration lifecycle", width: 1600 },
] as const;

export type FlowSlug = (typeof FLOWS)[number]["slug"];

export function getFlow(slug: string) {
  return FLOWS.find((f) => f.slug === slug);
}

/** Static markup from our own design canvas; read at build time only. */
export function readFlowHtml(slug: FlowSlug): string {
  return readFileSync(join(process.cwd(), "src/content/flows", `${slug}.html`), "utf8");
}
