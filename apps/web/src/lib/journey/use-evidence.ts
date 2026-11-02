"use client";

import { useState } from "react";
import { AssessorUnavailable, EMPTY_EVIDENCE, assessInput, evidenceKey, readEvidenceFile, requestAssessment, type EvidenceFile, type EvidenceState } from "./evidence";
import type { ClientRequirement } from "./frameworks";
import { useJourney, useScreenState } from "./store";

/** Evidence uploaded on one requirement, read in the browser and assessed by the AI assessor as soon as it is in. */
export function useRequirementEvidence(clientId: string, frameworkId: string, r: ClientRequirement | undefined) {
  const { log } = useJourney();
  const [ev, setEv] = useScreenState<EvidenceState>(evidenceKey(clientId, frameworkId, r?.code ?? "-"), EMPTY_EVIDENCE);
  const [busy, setBusy] = useState<null | "reading" | "assessing">(null);
  const readable = ev.files.filter((f) => !f.error);
  // The verdict is out of date when files were added or removed after it was made.
  const stale = !!ev.run && (ev.run.fileIds.length !== readable.length || readable.some((f) => !ev.run!.fileIds.includes(f.id)));

  const assess = async (files: EvidenceFile[] = ev.files) => {
    if (!r) return;
    const ok = files.filter((f) => !f.error);
    if (!ok.length) return;
    setBusy("assessing");
    try {
      const run = await requestAssessment(assessInput(r, ok));
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
    await assess([...ev.files, ...read]);
  };

  const remove = (id: string) => setEv((d) => void (d.files = d.files.filter((f) => f.id !== id)));

  return { ev, readable, stale, busy, upload, assess, remove };
}
