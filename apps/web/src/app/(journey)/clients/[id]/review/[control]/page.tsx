"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Field, inputClass, JButton, JLink, Panel, PanelHead, Pill, Segmented } from "@/components/journey/ui";
import { AiBox, ClosedBanner, fmtWhen, LevelPill, Modal, TierPill, useToast } from "@/components/cycle/ui";
import { Comments } from "@/components/cycle/comments";
import { EvidenceViewer } from "@/components/cycle/evidence-viewer";
import { ShareFeedback } from "@/components/cycle/ai-feedback";
import { cx } from "@/components/ui";
import { clientHref } from "@/lib/journey/portfolio";
import { findingsOf, reqLabel, responseGaps, verdictOf, type AiVerdict } from "@/lib/cycle/model";
import { defaultSpecs, useCycle } from "@/lib/cycle/use-cycle";
import { useControlEvidence } from "@/lib/cycle/use-control-evidence";
import { criteriaFor, feedbackFrom, type EvidenceFile, type EvidenceState } from "@/lib/journey/evidence";

const capitalize = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const VERDICT_TONE: Record<AiVerdict, "ok" | "warn" | "bad" | "ai"> = { satisfied: "ok", partly: "warn", "not evidenced": "bad", "check page": "ai" };

export default function ReviewConsolePage() {
  const { control: raw } = useParams<{ control: string }>();
  const code = decodeURIComponent(raw);
  const cy = useCycle();
  const { client, cycle, setCycle, runs, closed, ai, me, reqs: allReqs } = cy;
  const c = cy.control(code);
  const ev = useControlEvidence(client.id, cy.fwId, cy.label, me);
  const { say, toast } = useToast();
  const [tab, setTab] = useState<"response" | "viewer">("response");
  const [returning, setReturning] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [dismissed, setDismissed] = useState<string[]>([]);

  const specs = useMemo(() => (c ? (cycle.standard.controls[c.code]?.specs ?? defaultSpecs(c)) : []), [c, cycle.standard.controls]);
  if (!c)
    return (
      <ClientShell>
        <JMain>
          <h1 className="m-0 text-2xl">Control {code} is not in this workspace</h1>
          <Link href={clientHref(client.id, "/review")}>← Review hub</Link>
        </JMain>
      </ClientShell>
    );

  const review = cycle.reviews[c.code] ?? { decisions: {}, returns: 0 };
  const live = c.reqs.filter((r) => r.status !== "na");
  const verdict = (code: string) => verdictOf(live.find((r) => r.code === code)!, runs[code]);
  // A decision defaults to what the AI found until the Index Owner sets one.
  const decision = (code: string) => review.decisions[code] ?? (live.find((r) => r.code === code)?.stage === "accepted" ? "met" : verdict(code) === "satisfied" ? "met" : undefined);
  const met = live.filter((r) => decision(r.code) === "met").length;
  const pct = live.length ? Math.round((met / live.length) * 100) : 0;
  const open = live.filter((r) => verdict(r.code) !== "satisfied");
  const clean = live.filter((r) => verdict(r.code) === "satisfied");
  const queue = cy.controls.filter((x) => x.applicable && (x.stage === "submitted" || x.stage === "review"));
  const pos = queue.findIndex((x) => x.code === c.code);
  const response = cycle.responses[c.code];
  const files = live.flatMap((r) => ev.filesOf(r.code).filter((f) => !f.error).map((f) => ({ ...f, req: r.code, spec: cycle.fileSpec[f.id] })));
  const fileIds = Object.fromEntries(live.map((r) => [r.code, specs.filter((s) => s.req === r.code).map((s) => s.id)]));
  const gaps = ai.agents.advisor ? responseGaps(c, response?.text ?? "", fileIds, ai.behavior.advisor.skipAccepted).filter((g) => !dismissed.includes(g.req)) : [];
  const findings = ai.agents.review ? findingsOf(c, runs).filter((f) => !dismissed.includes(`f:${f.req}`)) : [];
  // Decisions open once the owner submits and close when the control is accepted or back with its owner.
  const decidable = !closed && (c.stage === "submitted" || c.stage === "review");
  // The AI assessor runs on demand, per requirement, once the owner has submitted the evidence.
  const assessable = !closed && (c.stage === "submitted" || c.stage === "review" || c.stage === "accepted");
  const aiFor = (code: string) => (
    <ReqAi
      files={ev.filesOf(code).filter((f) => !f.error && !ev.replacedOf(code).has(f.id))}
      state={ev.stateOf(code)}
      owner={c.owner}
      enabled={assessable && ai.agents.review}
      busy={ev.busy === `assess:${code}`}
      blocked={!!ev.busy}
      draft={(run) => feedbackFrom(run, criteriaFor(fullReq(code)))}
      onAssess={() => void ev.assess(fullReq(code)).then((ok) => ok && say(`AI assessed ${reqLabel(code)}`))}
      onShare={(text, edited) => (ev.share(code, text, edited), say(`Feedback on ${reqLabel(code)} shared with ${c.owner}`))}
    />
  );
  const fullReq = (code: string) => allReqs.find((r) => r.code === code)!;

  const markAll = () => setCycle((d) => void clean.forEach((r) => ((d.reviews[c.code] ??= { decisions: {}, returns: 0 }).decisions[r.code] = "met")));
  const accept = () => {
    setCycle((d) => {
      const rv = (d.reviews[c.code] ??= { decisions: {}, returns: 0 });
      for (const r of live) rv.decisions[r.code] ??= decision(r.code) ?? "not";
    });
    cy.accept(c.code);
    say(`Control ${c.code} accepted · ${met}/${live.length} met`);
  };

  const reassess = async () => {
    const targets = live.filter((r) => ev.filesOf(r.code).some((f) => !f.error));
    if (!targets.length) {
      say("No readable evidence files on this control; findings come from the evidence register.");
      return;
    }
    let n = 0;
    for (const r of targets) if (await ev.assess(fullReq(r.code), instruction)) n++;
    setCycle((d) => void (d.aiRuns[c.code] = (d.aiRuns[c.code] ?? 1) + 1));
    if (n) say(`Re-assessed ${n} requirement${n === 1 ? "" : "s"} of ${c.code}`);
  };

  return (
    <ClientShell search="Search controls">
      <JMain>
        <span className="text-sm text-j-muted">
          <Link href={clientHref(client.id, "/review")}>← Review hub</Link>
          {pos >= 0 && ` · ${pos + 1} of ${queue.length} in queue`} · submitted by {c.owner || "–"} · {c.department}
        </span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">
              Dimension {c.dimension} › Domain {c.domain}
            </span>
            <h1 className="m-0 text-[26px] leading-8 font-bold">
              <span className="font-mono">{c.code}</span> {c.title}
            </h1>
            <span className="flex flex-wrap items-center gap-2 text-sm">
              If decided as now
              <b>
                {met} / {live.length} met · {pct}%
              </b>
              {c.previous && (
                <span className="text-xs text-j-muted">
                  Previous result: <TierPill tier={c.previous} />
                </span>
              )}
            </span>
          </div>
          <div className="flex gap-2">
            {c.owner && <JLink href={`/messages?w=${encodeURIComponent(client.id)}&o=${encodeURIComponent(c.owner)}&c=${encodeURIComponent(c.code)}`}>Message {c.owner}</JLink>}
            <JButton disabled={!decidable} onClick={() => setReturning(true)}>
              Return to owner
            </JButton>
            <JButton variant="primary" disabled={!decidable} onClick={accept}>
              Accept control
            </JButton>
          </div>
        </div>
        <ClosedBanner show={closed} />
        {c.stage === "accepted" && <p className="m-0 rounded-xl bg-[#E7F3ED] px-4 py-3 text-sm font-semibold text-[#0E5A45]">Accepted {review.acceptedAt ?? ""} · {met} / {live.length} requirements met</p>}
        {(c.stage === "not" || c.stage === "draft") && <p className="m-0 rounded-xl bg-j-canvas px-4 py-3 text-sm">The Control Owner has not submitted this control yet. You can read it, but decisions open once it is submitted.</p>}
        {c.stage === "returned" && <p className="m-0 rounded-xl bg-[#FFF1E8] px-4 py-3 text-sm">Returned to {c.owner}. Decisions open again when they resubmit.</p>}

        <div className="flex flex-wrap gap-3.5">
          <Panel className="flex min-w-0 flex-[1_1_380px] flex-col gap-1 p-[22px]">
            <PanelHead title="Requirements · your decision" />
            {open.map((r) => {
              const v = verdict(r.code);
              const fs = ev.filesOf(r.code).filter((f) => !f.error);
              const d = decision(r.code);
              return (
                <div key={r.code} className="flex flex-col gap-1.5 border-b border-j-line-soft py-3 last:border-0">
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <b>
                      {reqLabel(r.code)} · {r.title}
                    </b>
                    <Pill tone={VERDICT_TONE[v]}>
                      {runs[r.code] ? "AI" : "Register"}: {v}
                    </Pill>
                  </span>
                  <span className="text-xs text-j-ink-3">
                    {fs.length ? fs.map((f) => `${cycle.fileSpec[f.id] ?? f.id} ${f.name}`).join(" · ") : `${r.evidence.valid} of ${r.evidence.expected} evidence items in the register`}
                  </span>
                  {aiFor(r.code)}
                  <Decide value={d} disabled={!decidable} onChange={(v) => cy.decide(c.code, r.code, v)} />
                </div>
              );
            })}
            {clean.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 py-3 text-sm">
                <span className="flex-auto">
                  <b>{clean.map((r) => reqLabel(r.code)).join(", ")}</b> <Pill tone="ok">Satisfied</Pill>
                  <br />
                  <span className="text-xs text-j-ink-3">
                    {clean.length} requirements · {clean.reduce((a, r) => a + r.evidence.valid, 0)} evidence items
                  </span>
                </span>
                <JButton size="sm" variant="outline" disabled={!decidable} onClick={markAll}>
                  Mark all {clean.length} met
                </JButton>
                {clean
                  .filter((r) => ev.filesOf(r.code).some((f) => !f.error))
                  .map((r) => (
                    <div key={r.code} className="flex w-full flex-col gap-1.5 border-t border-j-line-soft pt-2">
                      <span className="text-xs text-j-ink-3">
                        <b className="text-j-ink">{reqLabel(r.code)}</b> ·{" "}
                        {ev
                          .filesOf(r.code)
                          .filter((f) => !f.error)
                          .map((f) => `${cycle.fileSpec[f.id] ?? f.id} ${f.name}`)
                          .join(" · ")}
                      </span>
                      {aiFor(r.code)}
                    </div>
                  ))}
              </div>
            )}
          </Panel>

          <div className="flex min-w-0 flex-[1.4_1_460px] flex-col [&>:last-child]:flex-auto gap-3.5">
            <Segmented label="Response or evidence" value={tab} onChange={setTab} options={[{ value: "response", label: "Response" }, { value: "viewer", label: "Evidence viewer" }]} />
            {tab === "response" ? (
              <>
                <Panel className="flex flex-col gap-2 p-[22px]">
                  <PanelHead title="Response" aside={<span className="text-xs text-j-muted">You can edit the owner&apos;s response</span>} />
                  <textarea
                    aria-label="Control response"
                    rows={10}
                    disabled={closed}
                    defaultValue={response?.text ?? ""}
                    key={response?.savedAt ?? "empty"}
                    placeholder="The Control Owner has not written a response yet."
                    onBlur={(e) => e.target.value !== (response?.text ?? "") && cy.saveResponse(c.code, e.target.value)}
                    className="rounded-xl border border-j-line p-3 font-sans text-sm leading-6"
                  />
                  {response && (
                    <span className="text-xs text-j-muted">
                      Saved {fmtWhen(response.savedAt)} · by {response.by}
                      {response.editedBy && ` · edited by ${response.editedBy}`}
                    </span>
                  )}
                </Panel>
                {gaps.length > 0 && (
                  <AiBox title={`AI suggestion · ${gaps.length} improvement${gaps.length === 1 ? "" : "s"}`} only="only you see this">
                    {gaps.map((g) => {
                      const add = ` ${reqLabel(g.req)} is evidenced by ${g.ids.join(", ")}.`;
                      return (
                        <div key={g.req} className="flex flex-col gap-1.5 border-t border-[#DAD7FB] pt-2 text-sm first:border-0 first:pt-0">
                          <span>
                            {reqLabel(g.req)} has required evidence ({g.ids.join(", ")}) the response never cites. Add a reference so the regulator can find it.
                          </span>
                          <span className="flex gap-1.5">
                            <JButton size="sm" variant="outline" disabled={closed} onClick={() => (cy.saveResponse(c.code, `${response?.text ?? ""}${add}`), say("Suggestion applied to the response"))}>
                              Apply
                            </JButton>
                            <JButton size="sm" variant="ghost" disabled={closed} onClick={() => cy.saveResponse(c.code, `${response?.text ?? ""}${add} [edit]`)}>
                              Edit first
                            </JButton>
                            <JButton size="sm" variant="ghost" onClick={() => setDismissed([...dismissed, g.req])}>
                              Dismiss
                            </JButton>
                          </span>
                        </div>
                      );
                    })}
                  </AiBox>
                )}
              </>
            ) : (
              <EvidenceViewer files={files} stateOf={ev.stateOf} empty={`No evidence files were uploaded on this control yet; the register shows ${c.evidence.uploaded} of ${c.evidence.expected} items.`} />
            )}

            {ai.agents.review && (
              <AiBox title="AI findings" only="Index Owner only">
                {findings.length ? (
                  findings.map((f) => (
                    <div key={f.req + f.text} className="flex items-start gap-2 text-sm">
                      <LevelPill level={f.level} />
                      <span className="flex-auto">{f.text}</span>
                      <JButton size="sm" variant="ghost" onClick={() => (setTab("response"), cy.comment(c.code, `Note on ${reqLabel(f.req)}: ${f.text}`))}>
                        Edit
                      </JButton>
                      <JButton size="sm" variant="ghost" onClick={() => setDismissed([...dismissed, `f:${f.req}`])}>
                        Dismiss
                      </JButton>
                    </div>
                  ))
                ) : (
                  <span className="text-sm">No findings – every requirement has supporting evidence.</span>
                )}
                <Field label="Re-assess with instruction">
                  <textarea rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="For R1, the approval date is on page 2 of the plan. Re-check it falls within the period the standard allows." className="rounded-xl border border-[#DAD7FB] bg-white p-3 font-sans text-sm font-normal" />
                </Field>
                <span className="flex flex-wrap items-center gap-2">
                  <JButton size="sm" variant="primary" disabled={closed || !!ev.busy} onClick={() => void reassess()}>
                    {ev.busy?.startsWith("assess") ? "Re-assessing…" : "Re-assess this control"}
                  </JButton>
                  <span className="text-xs text-[#4F46E5]">
                    Run {cycle.aiRuns[c.code] ?? 1} of {cycle.aiRuns[c.code] ?? 1}
                    {(cycle.aiRuns[c.code] ?? 1) > 1 && " · previous run kept for comparison"}
                  </span>
                </span>
                {ev.error && <span className="text-[13px] text-j-bad">{ev.error}</span>}
              </AiBox>
            )}
            <Comments cy={cy} code={c.code} />
          </div>
        </div>
      </JMain>
      <ReturnDialog
        open={returning}
        onClose={() => setReturning(false)}
        reqs={live.filter((r) => decision(r.code) !== "met").map((r) => ({ code: r.code, title: r.title, hint: capitalize(findingsOf(c, runs).find((f) => f.req === r.code)?.text.replace(/^R\d+: /, "") ?? "") }))}
        owner={c.owner}
        onSend={(notes, msg) => {
          // Requirements marked met (or met by default from the AI) are kept as met; the ones with a note go back.
          setCycle((d) => {
            const rv = (d.reviews[c.code] ??= { decisions: {}, returns: 0 });
            for (const r of live) if (decision(r.code) === "met" && !notes[r.code]) rv.decisions[r.code] = "met";
            for (const k of Object.keys(notes)) rv.decisions[k] = "not";
          });
          cy.returnControl(c.code, notes, msg, live.filter((r) => decision(r.code) === "met" && !notes[r.code]).map((r) => r.code));
          setReturning(false);
          const n = Object.keys(notes).length;
          say(`Returned ${c.code} to ${c.owner} with ${n} item${n === 1 ? "" : "s"} to fix`);
        }}
      />
      {toast}
    </ClientShell>
  );
}

function Decide({ value, onChange, disabled }: { value?: "met" | "not"; onChange: (v: "met" | "not") => void; disabled?: boolean }) {
  return (
    <span role="radiogroup" aria-label="Decision" className="flex gap-1.5">
      {(["met", "not"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={cx(
            "h-8 cursor-pointer rounded-lg border px-3 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60",
            value === v ? (v === "met" ? "border-[#1F9D6E] bg-[#E7F3ED] text-[#0E5A45]" : "border-[#B42318] bg-[#FDECEA] text-[#B42318]") : "border-j-line bg-white text-j-ink-2",
          )}
        >
          {v === "met" ? "Met" : "Not met"}
        </button>
      ))}
    </span>
  );
}

function ReturnDialog({ open, onClose, reqs, owner, onSend }: { open: boolean; onClose: () => void; reqs: { code: string; title: string; hint: string }[]; owner: string; onSend: (notes: Record<string, string>, msg: string) => void }) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const filled = Object.fromEntries(reqs.map((r) => [r.code, notes[r.code] ?? r.hint]).filter(([, v]) => v.trim()));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Return to owner"
      sub={`${owner} gets the requirements below back with your note on each. Requirements you marked met are accepted.`}
      wide
      footer={
        <>
          <JButton onClick={onClose}>Cancel</JButton>
          <JButton variant="primary" disabled={!Object.keys(filled).length} onClick={() => onSend(filled, msg.trim() || `${Object.keys(filled).length} items need correction before this control can be accepted.`)}>
            Return to owner
          </JButton>
        </>
      }
    >
      {reqs.map((r) => (
        <Field key={r.code} label={`${reqLabel(r.code)} · ${r.title.split(":")[0]}`}>
          <input value={notes[r.code] ?? r.hint} onChange={(e) => setNotes({ ...notes, [r.code]: e.target.value })} placeholder="What needs correction" className={inputClass} />
        </Field>
      ))}
      {!reqs.length && <p className="m-0 text-sm">Every requirement is marked met. Mark the ones that need work as not met first.</p>}
      <Field label="Message to the owner">
        <textarea rows={2} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="One item left: the plan must be the approved, signed version. Can you get it by Monday?" className="rounded-xl border border-j-line p-3 font-sans text-sm font-normal" />
      </Field>
    </Modal>
  );
}

/** On-demand AI assessment under a requirement's attachments, and the feedback the Index Owner can share. */
function ReqAi({ files, state, owner, enabled, busy, blocked, draft, onAssess, onShare }: { files: EvidenceFile[]; state: EvidenceState; owner: string; enabled: boolean; busy: boolean; blocked: boolean; draft: (run: NonNullable<EvidenceState["run"]>) => string; onAssess: () => void; onShare: (text: string, edited: boolean) => void }) {
  if (!files.length) return null;
  const run = state.run;
  const stale = !!run && (run.fileIds.length !== files.length || files.some((f) => !run.fileIds.includes(f.id)));
  return (
    <div className="flex flex-col gap-2">
      <span className="flex flex-wrap items-center gap-2">
        <JButton size="sm" variant="outline" disabled={!enabled || blocked} title={enabled ? undefined : "Opens once the Control Owner submits the evidence"} onClick={onAssess}>
          {busy ? "Assessing…" : run && !stale ? "Assess again with AI" : run ? "Re-assess with the current files" : "Assess with AI"}
        </JButton>
        {run && (
          <span className="text-xs text-j-ai">
            {run.recommendation} · {Math.round(run.confidence * 100)}% · {run.at}
            {stale && <b className="text-[#8A4B00]"> · files changed since</b>}
          </span>
        )}
      </span>
      {run && (
        <AiBox title="AI assessment" only="Index Owner only">
          <ShareFeedback key={run.runId} draft={draft(run)} shared={state.feedback?.runId === run.runId ? state.feedback : undefined} owner={owner} disabled={stale} onShare={onShare} />
        </AiBox>
      )}
    </div>
  );
}
