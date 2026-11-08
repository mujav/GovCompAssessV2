"use client";

import { useState } from "react";
import { AssessorUnavailable, EMPTY_EVIDENCE, assessInput, evidenceKey, readEvidenceFile, requestAssessment, type EvidenceFile, type EvidenceState } from "./evidence";
import type { ClientRequirement } from "./frameworks";
import { useJourney, useScreenState } from "./store";
import { usePlatform } from "@/lib/cycle/use-cycle";
import { agentPolicy, maskPersonal } from "@/lib/cycle/platform";

/** Evidence uploaded on one requirement, read in the browser. The Index Owner runs the AI assessor on demand. */
export function useRequirementEvidence(clientId: string, frameworkId: string, r: ClientRequirement | undefined) {
  const { log } = useJourney();
  const [ev, setEv] = useScreenState<EvidenceState>(evidenceKey(clientId, frameworkId, r?.code ?? "-"), EMPTY_EVIDENCE);
  const [busy, setBusy] = useState<null | "reading" | "assessing">(null);
  const { platform } = usePlatform();
  const readable = ev.files.filter((f) => !f.error);
  // The verdict is out of date when files were added or removed after it was made.
  const stale = !!ev.run && (ev.run.fileIds.length !== readable.length || readable.some((f) => !ev.run!.fileIds.includes(f.id)));

  const assess = async (files: EvidenceFile[] = ev.files) => {
    if (!r) return;
    const ok = files.filter((f) => !f.error);
    if (!ok.length) return;
    // AI settings: the Evidence Review agent can be switched off, and personal data is masked before sending.
    if (!platform.ai.agents.review) return setEv((d) => void (d.error = "The Evidence Review agent is off in AI settings. The files are saved."));
    setBusy("assessing");
    try {
      const input = assessInput(r, ok);
      if (platform.ai.data.mask) input.evidence = input.evidence.map((d) => ({ ...d, pages: d.pages.map((p) => ({ ...p, text: maskPersonal(p.text) })) }));
      const run = await requestAssessment(input, agentPolicy(platform.ai, "review"));
      setEv((d) => {
        d.run = { ...run, at: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }), fileIds: ok.map((f) => f.id) };
        delete d.error;
      });
      log(`AI assessor reviewed ${ok.length} file${ok.length > 1 ? "s" : ""} for ${r.code}: ${run.recommendation}`);
    } catch (e) {
      const text = e instanceof AssessorUnavailable ? `${e.message} The files are saved; assess them once the key is set.` : e instanceof Error ? e.message : "The assessment failed.";
      setEv((d) => void (d.error = text));
    } finally {
      setBusy(null);
    }
  };

  const upload = async (list: File[]) => {
    if (!r || !list.length) return;
    setBusy("reading");
    const read = await Promise.all(list.map(readEvidenceFile));
    setEv((d) => void d.files.push(...read));
    log(`Uploaded ${read.length} evidence file${read.length > 1 ? "s" : ""} to ${r.code}`);
    setBusy(null);
  };

  const remove = (id: string) => setEv((d) => void (d.files = d.files.filter((f) => f.id !== id)));

  /** Shares the AI feedback with the Control Owner, as generated or edited by the Index Owner. */
  const share = (text: string, edited: boolean, by: string) => {
    if (!r || !ev.run) return;
    const runId = ev.run.runId;
    setEv((d) => void (d.feedback = { text, by, edited, runId, at: new Date().toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) }));
    log(`${by} shared AI feedback on ${r.code} with the Control Owner${edited ? " after editing it" : ""}`);
  };

  return { ev, readable, stale, busy, upload, assess, remove, share };
}
