"use client";

// Evidence files of every requirement in a control, kept in the same per-requirement slices
// the requirement page uses, so an upload or AI run here shows there too.

import { useState } from "react";
import { recordAudit } from "@/lib/audit";
import { AssessorUnavailable, assessInput, evidenceKey, readEvidenceFile, requestAssessment, type EvidenceFile, type EvidenceState } from "@/lib/journey/evidence";
import type { ClientRequirement } from "@/lib/journey/frameworks";
import { useJourney } from "@/lib/journey/store";
import { usePlatform } from "./use-cycle";
import { maskPersonal } from "./platform";

type Run = NonNullable<EvidenceState["run"]>;

export function useControlEvidence(clientId: string, fwId: string, workspace: string, user: string) {
  const { state, update, log } = useJourney();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { platform } = usePlatform();
  const key = (code: string) => evidenceKey(clientId, fwId, code);
  const stateOf = (code: string) => (state.screens[key(code)] as EvidenceState | undefined) ?? { files: [] };
  const filesOf = (code: string) => stateOf(code).files;
  const previous = (code: string) => (state.screens[`${key(code)}.previous`] as Run | undefined) ?? undefined;

  /** Reads and attaches files to a requirement; `replaces` marks an earlier version as replaced. */
  const upload = async (code: string, list: File[], replaces?: string): Promise<EvidenceFile[]> => {
    if (!list.length) return [];
    setBusy(`upload:${code}`);
    const read = await Promise.all(list.map(readEvidenceFile));
    update((s) => {
      const st = ((s.screens[key(code)] as EvidenceState | undefined) ?? { files: [] }) as EvidenceState & { replaced?: Record<string, string> };
      st.files = [...st.files, ...read];
      if (replaces) (st.replaced ??= {})[replaces] = read[0].id;
      s.screens[key(code)] = st;
    });
    log(`Uploaded ${read.length} evidence file${read.length > 1 ? "s" : ""} to ${code}`);
    setBusy(null);
    return read;
  };

  /** Runs the AI assessor on a requirement's readable files, keeping the previous run for comparison. */
  const assess = async (r: ClientRequirement, instruction?: string) => {
    const files = filesOf(r.code).filter((f) => !f.error && !replacedOf(r.code).has(f.id));
    if (!files.length) return false;
    if (!platform.ai.agents.review) {
      setError("The Evidence Review agent is off in AI settings.");
      return false;
    }
    setBusy(`assess:${r.code}`);
    setError("");
    try {
      const input = assessInput(r, files);
      if (instruction?.trim()) input.implementation = `${input.implementation}\nIndex Owner instruction: ${instruction.trim()}`;
      if (platform.ai.data.mask) input.evidence = input.evidence.map((d) => ({ ...d, pages: d.pages.map((p) => ({ ...p, text: maskPersonal(p.text) })) }));
      const run = await requestAssessment(input);
      update((s) => {
        const st = (s.screens[key(r.code)] as EvidenceState | undefined) ?? { files: [] };
        if (st.run) s.screens[`${key(r.code)}.previous`] = st.run;
        st.run = { ...run, at: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }), fileIds: files.map((f) => f.id) };
        s.screens[key(r.code)] = st;
      });
      recordAudit({ user: "AI · Evidence Review", type: "AI run", action: `Assessed ${r.code}${instruction ? " with an Index Owner instruction" : ""} for ${user}`, workspace, after: run.recommendation });
      return true;
    } catch (e) {
      setError(e instanceof AssessorUnavailable ? `${e.message} The files are kept; re-assess once the AI connection is set.` : e instanceof Error ? e.message : "The assessment failed.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** Shares a requirement's AI feedback with its Control Owner, as generated or edited. */
  const share = (code: string, text: string, edited: boolean) => {
    const run = stateOf(code).run;
    if (!run) return;
    update((s) => {
      const st = (s.screens[key(code)] as EvidenceState | undefined) ?? { files: [] };
      st.feedback = { text, by: user, edited, runId: run.runId, at: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) };
      s.screens[key(code)] = st;
    });
    recordAudit({ user, type: "Review", action: `Shared AI feedback on ${code} with the Control Owner${edited ? " (edited)" : " (as generated)"}`, workspace, after: text.slice(0, 120) });
  };

  const replacedOf = (code: string) => new Set(Object.keys((stateOf(code) as EvidenceState & { replaced?: Record<string, string> }).replaced ?? {}));

  return { filesOf, stateOf, previous, upload, assess, share, replacedOf, busy, error };
}
