"use client";

import { useState } from "react";
import { inputClass, JButton, Panel } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { reqLabel } from "@/lib/cycle/model";
import type { EvidenceFile, EvidenceState } from "@/lib/journey/evidence";

export type ViewerFile = EvidenceFile & { req: string; spec?: string };

/**
 * Page-by-page reader for a control's evidence files, shared by the Index Owner's review and the
 * Control Owner's response screen. Where the AI assessor cited a page, the citation jumps to it;
 * the AI's run is the Index Owner's, so the Control Owner's screen turns citations off.
 */
export function EvidenceViewer({ files, stateOf, empty, citations = true }: { files: ViewerFile[]; stateOf: (req: string) => EvidenceState; empty: string; citations?: boolean }) {
  const [fileSel, setFileSel] = useState("");
  const [page, setPage] = useState(1);
  const viewing = files.find((f) => f.id === fileSel) ?? files[0];
  if (!viewing)
    return (
      <Panel className="p-[22px]">
        <p className="m-0 text-sm text-j-muted">{empty}</p>
      </Panel>
    );
  const at = Math.min(page, viewing.pages.length);
  const run = stateOf(viewing.req).run;
  const cites = (citations && run?.criteria.flatMap((x) => x.citations.filter((q) => q.evidence_id === viewing.id).map((q) => ({ ...q, verdict: x.verdict })))) || [];
  return (
    <Panel className="flex flex-col gap-2.5 p-[22px]">
      <select aria-label="Evidence file" value={viewing.id} onChange={(e) => (setFileSel(e.target.value), setPage(1))} className={cx(inputClass, "h-10")}>
        {files.map((f) => (
          <option key={f.id} value={f.id}>
            {reqLabel(f.req)} · {f.spec ?? f.id} {f.name}
          </option>
        ))}
      </select>
      <span className="flex items-center justify-between text-xs text-j-muted">
        <span>
          {viewing.name} · page {at} of {viewing.pages.length}
        </span>
        <span className="flex gap-1">
          <JButton size="sm" variant="ghost" aria-label="Previous page" onClick={() => setPage(Math.max(1, at - 1))}>
            ‹
          </JButton>
          <JButton size="sm" variant="ghost" aria-label="Next page" onClick={() => setPage(Math.min(viewing.pages.length, at + 1))}>
            ›
          </JButton>
        </span>
      </span>
      <pre className="m-0 max-h-[360px] overflow-auto rounded-xl bg-j-canvas p-3 font-sans text-[13px] leading-6 whitespace-pre-wrap" dir="auto" data-no-translate>
        {viewing.pages[at - 1]?.text}
      </pre>
      {cites.length > 0 && (
        <div className="flex flex-col gap-1 text-[13px]">
          {cites.map((q, i) => (
            <button key={i} type="button" onClick={() => setPage(q.page)} className="cursor-pointer border-0 bg-transparent p-0 text-start text-j-ai">
              AI: page {q.page} – {q.verdict.replace("_", " ")} · “{q.quote.slice(0, 120)}”
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}
