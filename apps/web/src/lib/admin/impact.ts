// Impact analysis attached to change requests: what publishing the draft would change.

import { compareSchemes } from "@/lib/engine/scoring";
import { testRule } from "@/lib/engine/rules";
import { DEMO_TODAY, SAMPLE_ACTIONS, SAMPLE_REQUIREMENTS } from "./sample-data";
import type { AcceptancePolicy, AutomationRule, ConfigKind, FrameworkVersion, ScoringScheme } from "./types";

export function impactFor(kind: ConfigKind, before: unknown, after: unknown): string[] {
  switch (kind) {
    case "scoring": {
      if (!before) return ["First version: no live results to compare"];
      const c = compareSchemes(SAMPLE_REQUIREMENTS, before as ScoringScheme, after as ScoringScheme);
      const domains = c.domains.filter((d) => d.before !== d.after);
      return [
        `${c.changedRequirements.length} requirements change result · ${domains.length} domain score${domains.length === 1 ? "" : "s"} move`,
        `Readiness ${c.before.pct}% → ${c.after.pct}%`,
        "Accepted results keep the live version until re-accepted; history is never recalculated",
      ];
    }
    case "acceptance": {
      const b = before as AcceptancePolicy | undefined;
      const a = after as AcceptancePolicy;
      return [
        `Review chain ${b ? b.stages.length : 0} → ${a.stages.length} stages`,
        `SLA chain ${b ? b.stages.reduce((s, x) => s + x.slaDays, 0) : 0} → ${a.stages.reduce((s, x) => s + x.slaDays, 0)} working days`,
        "In-flight reviews finish under the policy version they started with",
      ];
    }
    case "rule": {
      const b = before as AutomationRule | undefined;
      const a = after as AutomationRule;
      const nb = b ? testRule(b, SAMPLE_ACTIONS, DEMO_TODAY).matches.length : 0;
      const na = testRule(a, SAMPLE_ACTIONS, DEMO_TODAY).matches.length;
      return [`Matches on today's data: ${nb} → ${na}`, "Recommends only; external communication still needs approval"];
    }
    case "framework": {
      const a = after as FrameworkVersion;
      return [
        `${a.levels.length} hierarchy levels: ${a.levels.map((l) => l.en).join(" › ")}`,
        a.importJob ? `${a.importJob.valid} requirements import · ${a.importJob.changed}` : "No requirements import attached",
        "Versions in use by a cycle stay locked; the new version applies from its effective date",
      ];
    }
  }
}
