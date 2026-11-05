"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { ClientShell, JMain } from "@/components/journey/shell";
import { inputClass, JButton, Panel, PanelHead, Pill, Segmented } from "@/components/journey/ui";
import { AiBox, ClosedBanner, fmtWhen, StageBadge, useToast } from "@/components/cycle/ui";
import { Comments } from "@/components/cycle/comments";
import { EvidenceViewer } from "@/components/cycle/evidence-viewer";
import { FeedbackNote } from "@/components/cycle/ai-feedback";
import { cx } from "@/components/ui";
import { useAuth } from "@/lib/auth/store";
import { clientHref } from "@/lib/journey/portfolio";
import { reqLabel, selfCheck } from "@/lib/cycle/model";
import { defaultSpecs, useCycle, type EvidenceSpec } from "@/lib/cycle/use-cycle";
import { useControlEvidence } from "@/lib/cycle/use-control-evidence";
import { useMyControls } from "@/lib/cycle/use-my-controls";
import { daysBetween, TODAY } from "@/lib/workspace/data";

const mb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);

function rules(s: EvidenceSpec) {
  return [s.approval && "Approval required", s.format !== "Any" ? s.format : "PDF, Office, images", "max 30 MB", s.pageRef && "page reference needed if over 20 pages", s.minSamples && `at least ${s.minSamples} samples`, `issued within ${s.freshness} months`, s.govVerified && "verified by the governing body – no upload"].filter(Boolean).join(" · ");
}

export default function ControlResponsePage() {
  const { code: raw } = useParams<{ code: string }>();
  const code = decodeURIComponent(raw);
  const cy = useCycle();
  const { client, cycle, setCycle, closed, ai, me } = cy;
  const { user } = useAuth();
  const c = cy.control(code);
  const ev = useControlEvidence(client.id, cy.fwId, cy.label, me);
  const { say, toast } = useToast();
  const [filter, setFilter] = useState<"action" | "all">("action");
  const [check, setCheck] = useState<ReturnType<typeof selfCheck> | null>(null);
  const [saved, setSaved] = useState("");
  const [tab, setTab] = useState<"response" | "viewer">("response");
  const mineAll = useMyControls();
  const area = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const uploadFor = useRef<{ req: string; spec: string; replaces?: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const mine = !!c && !!user && (user.role !== "control" || c.owner === user.name || c.contributors.includes(user.name));
  if (!c || !mine)
    return (
      <ClientShell>
        <JMain>
          <h1 className="m-0 text-2xl">{c ? `Control ${code} is not assigned to you` : `Control ${code} is not in this workspace`}</h1>
          <Link href="/my-requirements">← Home</Link>
        </JMain>
      </ClientShell>
    );

  const specs = cycle.standard.controls[c.code]?.specs ?? defaultSpecs(c);
  const live = c.reqs.filter((r) => r.status !== "na");
  const returns = cycle.reviews[c.code]?.returns ?? 0;
  const left = daysBetween(TODAY, c.due);
  const response = cycle.responses[c.code];
  const instruction = cycle.plan[c.code]?.instruction;
  const reqNotes = live.filter((r) => cycle.notes[r.code] || cycle.reqInstructions[r.code]);
  const needs = live.filter((r) => r.stage === "returned" || cycle.notes[r.code] || (r.stage !== "accepted" && ev.stateOf(r.code).feedback) || (r.stage !== "accepted" && specs.filter((s) => s.req === r.code && !s.govVerified).some((s) => !filesFor(s).length)));
  const shown = filter === "action" ? needs : live;
  const editable = !closed && c.stage !== "accepted" && c.stage !== "submitted" && c.stage !== "review";

  function filesFor(s: EvidenceSpec) {
    return ev.filesOf(s.req).filter((f) => cycle.fileSpec[f.id] === s.id || (!cycle.fileSpec[f.id] && specs.find((x) => x.req === s.req)?.id === s.id));
  }

  const save = (text: string) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      cy.saveResponse(c.code, text);
      setSaved(new Date().toISOString());
    }, 700);
  };

  const insert = (token: string) => {
    const el = area.current;
    if (!el) return;
    const at = el.selectionStart ?? el.value.length;
    el.value = `${el.value.slice(0, at)}${token}${el.value.slice(el.selectionEnd ?? at)}`;
    el.focus();
    el.selectionStart = el.selectionEnd = at + token.length;
    save(el.value);
  };

  const pick = (req: string, spec: string, replaces?: string) => {
    uploadFor.current = { req, spec, replaces };
    fileInput.current?.click();
  };

  const onFiles = async (list: FileList | null) => {
    const t = uploadFor.current;
    if (!t || !list?.length) return;
    const read = await ev.upload(t.req, [...list], t.replaces);
    setCycle((d) => {
      for (const f of read) d.fileSpec[f.id] = t.spec;
      d.activity[c.code] = new Date().toISOString();
    });
    if (c.reqs.find((r) => r.code === t.req)?.stage === "not") cy.move([t.req], "prog");
    say(`${read.length} file${read.length === 1 ? "" : "s"} attached to ${t.spec}`);
    if (fileInput.current) fileInput.current.value = "";
  };

  const runCheck = () => {
    const files = live.flatMap((r) => ev.filesOf(r.code).filter((f) => !f.error && !ev.replacedOf(r.code).has(f.id)).map((f) => ({ id: cycle.fileSpec[f.id] ?? f.id, name: f.name, pages: f.pages.length })));
    const missing = specs.filter((s) => !s.govVerified && !filesFor(s).length && live.some((r) => r.code === s.req && r.stage !== "accepted"));
    setCheck([...missing.map((s) => ({ ok: false, ref: s.id, text: `No file uploaded for ${s.title.toLowerCase()}.` })), ...selfCheck(files, response?.text ?? "")]);
  };

  const owner = user?.role === "control";
  const ready = specs.filter((s) => s.govVerified || filesFor(s).length || live.some((r) => r.code === s.req && r.stage === "accepted")).length;
  const lastReturn = cycle.followUps.find((f) => f.control === c.code && f.kind === "Return");
  const openMine = mineAll.filter((m) => m.workspaceId === client.id && m.c.stage !== "accepted").sort((a, b) => a.c.due.localeCompare(b.c.due));
  const pos = openMine.findIndex((m) => m.c.code === c.code);
  const next = pos >= 0 ? openMine[pos + 1] : undefined;
  const files = live.flatMap((r) => ev.filesOf(r.code).filter((f) => !f.error && !ev.replacedOf(r.code).has(f.id)).map((f) => ({ ...f, req: r.code, spec: cycle.fileSpec[f.id] })));

  return (
    <ClientShell search="Search my controls">
      <JMain>
        <span className="text-sm text-j-muted">
          <Link href={owner ? "/my-requirements" : clientHref(client.id, "/review")}>← {owner ? "Home" : "Review hub"}</Link>
          {pos >= 0 && ` · ${pos + 1} of ${openMine.length} open controls`} · {c.department}
          {next && (
            <>
              {" · "}
              <Link href={next.href}>Next: {next.c.code} →</Link>
            </>
          )}
        </span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">
              Dimension {c.dimension} › {c.domainName.startsWith("Domain") ? c.domainName : `Domain ${c.domain} ${c.domainName}`}
            </span>
            <h1 className="m-0 text-[26px] leading-8 font-bold">
              <span className="font-mono">{c.code}</span> {c.title}
            </h1>
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <StageBadge stage={c.stage} />
              {returns > 0 && <Pill tone="orange">Returned · version {returns + 1}</Pill>}
              <Pill tone={left < 0 && c.stage !== "accepted" ? "bad" : left <= 3 && c.stage !== "accepted" ? "warn" : "gray"}>
                Due {c.due}
                {c.stage !== "accepted" && ` · ${left < 0 ? `${-left} days late` : `${left} days`}`}
              </Pill>
              <span>
                Evidence <b>{ready} / {specs.length}</b> · requirements met <b>{c.met} / {live.length}</b> · <b>{needs.length}</b> need action
              </span>
            </span>
          </div>
          <div className="flex gap-2">
            {ai.agents.selfCheck && (
              <JButton disabled={!editable} onClick={runCheck}>
                {check ? "Check again" : "Check my evidence"}
              </JButton>
            )}
            <JButton
              variant="primary"
              disabled={!editable || !response?.text?.trim()}
              title={!response?.text?.trim() ? "Write the control response first" : undefined}
              onClick={() => {
                cy.submit(c.code);
                say(`Control ${c.code} submitted to the Index Owner`);
              }}
            >
              Submit to Index Owner
            </JButton>
          </div>
        </div>
        <ClosedBanner show={closed} />
        {c.stage === "accepted" && <p className="m-0 rounded-xl bg-[#E7F3ED] px-4 py-3 text-sm font-semibold text-[#0E5A45]">Accepted by your Index Owner{cycle.reviews[c.code]?.acceptedAt ? ` ${cycle.reviews[c.code]!.acceptedAt}` : ""} · {c.met} / {live.length} requirements met</p>}
        {(c.stage === "submitted" || c.stage === "review") && <p className="m-0 rounded-xl bg-cx-tint px-4 py-3 text-sm">Submitted. Your Index Owner reviews it next; editing opens again if they return it. You can still reply in the comments.</p>}
        {c.stage === "returned" && (
          <p className="m-0 rounded-xl bg-[#FFF1E8] px-4 py-3 text-sm">
            <b>Returned by {lastReturn?.by ?? "your Index Owner"}.</b> {lastReturn?.text ?? "Fix the requirements marked below, then submit again."}
          </p>
        )}
        {(c.stage === "not" || c.stage === "draft") && !closed && <p className="m-0 rounded-xl bg-j-canvas px-4 py-3 text-sm">Upload the required evidence, mark each requirement and write the control response, then submit it to your Index Owner.</p>}

        {(instruction || reqNotes.some((r) => cycle.reqInstructions[r.code])) && (
          <Panel className="flex flex-col gap-1.5 bg-cx-tint p-[18px]">
            <b className="text-sm">Instructions from your Index Owner</b>
            {instruction && (
              <span className="text-sm">
                <b>Control:</b> {instruction}
              </span>
            )}
            {reqNotes
              .filter((r) => cycle.reqInstructions[r.code])
              .map((r) => (
                <span key={r.code} className="text-sm">
                  <b>{reqLabel(r.code)}:</b> {cycle.reqInstructions[r.code]}
                </span>
              ))}
          </Panel>
        )}

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="flex min-w-0 flex-[1_1_380px] flex-col gap-1 p-[22px]">
            <PanelHead
              title="Requirements · your evidence"
              aside={<Segmented size="sm" label="Requirements shown" value={filter} onChange={setFilter} options={[{ value: "action", label: `Needs action · ${needs.length}` }, { value: "all", label: `All ${live.length}` }]} />}
            />
            <input ref={fileInput} type="file" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
            {shown.map((r) => {
              const note = cycle.notes[r.code];
              const claim = cycle.claims?.[r.code];
              return (
                <div key={r.code} className="flex flex-col gap-1.5 border-b border-j-line-soft py-3 last:border-0">
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <b>
                      {reqLabel(r.code)} · {r.title}
                    </b>
                    {r.stage === "accepted" ? <Pill tone="ok">Accepted</Pill> : note || r.stage === "returned" ? <Pill tone="orange">Needs correction</Pill> : <StageBadge stage={r.stage} />}
                  </span>
                  {note && (
                    <span className="rounded-xl bg-[#FFF1E8] px-3 py-2 text-[13px]">
                      <b className="text-xs tracking-[0.04em]">INDEX OWNER</b>
                      <br />
                      {note}
                    </span>
                  )}
                  {ev.stateOf(r.code).feedback && <FeedbackNote feedback={ev.stateOf(r.code).feedback!} />}
                  {specs
                    .filter((s) => s.req === r.code)
                    .map((s) => {
                      const fs = filesFor(s);
                      const replaced = ev.replacedOf(r.code);
                      const current = fs.filter((f) => !replaced.has(f.id));
                      return (
                        <div key={s.id} className="flex flex-col gap-1 rounded-xl bg-j-canvas px-3 py-2.5 text-[13px]">
                          <span className="flex flex-wrap items-center gap-2">
                            <b className="font-mono text-xs">{s.id}</b> · {s.title}
                            <span className="flex-auto" />
                            {!s.govVerified && editable && r.stage !== "accepted" && (
                              <JButton size="sm" variant="outline" disabled={!!ev.busy} onClick={() => pick(r.code, s.id, current[0]?.id)}>
                                {current.length ? "Upload new version" : "Upload"}
                              </JButton>
                            )}
                          </span>
                          <span className="text-xs text-j-muted">{rules(s)}</span>
                          {fs.map((f, i) => (
                            <span key={f.id} className={cx("flex flex-wrap items-center gap-2 text-xs", replaced.has(f.id) && "text-j-muted line-through")}>
                              v{i + 1} {f.name} · {mb(f.size)}
                              {f.error && <span className="text-j-bad no-underline">· {f.error}</span>}
                              {replaced.has(f.id) ? " – replaced" : (
                                <>
                                  {!editable && cycle.fileRefs?.[f.id] && <span>· Reference: {cycle.fileRefs[f.id]}</span>}
                                  {editable && (
                                    <input
                                      aria-label={`Reference for ${f.name}`}
                                      placeholder="Reference, e.g. p.3 or sheet Register"
                                      defaultValue={cycle.fileRefs?.[f.id] ?? ""}
                                      onBlur={(e) => setCycle((d) => void ((d.fileRefs ??= {})[f.id] = e.target.value))}
                                      className={cx(inputClass, "h-7 w-[220px] text-xs")}
                                    />
                                  )}
                                </>
                              )}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  {r.stage !== "accepted" && <Claim value={claim} disabled={!editable} onChange={(v) => setCycle((d) => void ((d.claims ??= {})[r.code] = v))} />}
                </div>
              );
            })}
            {!shown.length && <p className="m-0 py-3 text-sm text-j-muted">Nothing needs action. Every requirement has its evidence.</p>}
          </Panel>

          <div className="flex min-w-0 flex-[1.4_1_460px] flex-col gap-3.5">
            <Segmented label="Response or evidence" value={tab} onChange={setTab} options={[{ value: "response", label: "Response" }, { value: "viewer", label: `Evidence viewer · ${files.length}` }]} />
            {tab === "response" ? (
              <Panel className="flex flex-col gap-2 p-[22px]">
                <PanelHead title="Control response" aside={<span className="text-xs text-j-muted">{saved || response ? `Saved ${fmtWhen(saved || response!.savedAt)}` : "Not saved yet"}</span>} />
                <span className="flex flex-wrap gap-1.5">
                  <JButton size="sm" variant="ghost" disabled={!editable} onClick={() => insert("**bold**")}>
                    <b>B</b>
                  </JButton>
                  <JButton size="sm" variant="ghost" disabled={!editable} onClick={() => insert("\n• ")}>
                    • List
                  </JButton>
                  <select
                    aria-label="Insert evidence reference"
                    disabled={!editable}
                    value=""
                    onChange={(e) => e.target.value && insert(` [${e.target.value} · p.]`)}
                    className="h-[34px] rounded-[10px] border border-cx-line bg-white px-2 text-[13px] font-semibold text-cx"
                  >
                    <option value="">+ Insert evidence reference</option>
                    {specs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.id} · {s.title}
                      </option>
                    ))}
                  </select>
                </span>
                <textarea
                  ref={area}
                  aria-label="Control response"
                  rows={12}
                  disabled={!editable}
                  defaultValue={response?.text ?? ""}
                  onChange={(e) => save(e.target.value)}
                  placeholder="The entity established… [E1 · p.3]"
                  className="rounded-xl border border-j-line p-3 font-sans text-sm leading-6"
                />
                {response?.editedBy && <span className="text-xs text-j-muted">Edited by {response.editedBy}</span>}
              </Panel>
            ) : (
              <EvidenceViewer files={files} stateOf={ev.stateOf} citations={false} empty="No evidence uploaded on this control yet. Upload files against each required item on the left." />
            )}

            {check && (
              <AiBox title={`Self-check · ${check.filter((x) => !x.ok).length} to fix`} only="only you see this">
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[13px]">
                  {check.map((x, i) => (
                    <li key={i} className="flex gap-2">
                      <b className={x.ok ? "text-[#0E5A45]" : "text-[#8A4B00]"}>{x.ok ? "✓" : "!"}</b>
                      <span>
                        {x.ref && <b className="font-mono text-xs">{x.ref} </b>}
                        {x.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </AiBox>
            )}
            <Comments cy={cy} code={c.code} />
          </div>
        </div>
      </JMain>
      {toast}
    </ClientShell>
  );
}

/** The Control Owner's own reading of a requirement, styled like the Index Owner's decision. */
function Claim({ value, onChange, disabled }: { value?: "met" | "not" | "na"; onChange: (v: "met" | "not" | "na") => void; disabled?: boolean }) {
  return (
    <span role="radiogroup" aria-label="Your assessment" className="flex flex-wrap items-center gap-1.5">
      {(["met", "not", "na"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          disabled={disabled}
          onClick={() => onChange(v)}
          className={cx(
            "h-8 cursor-pointer rounded-lg border px-3 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60",
            value === v ? (v === "met" ? "border-[#1F9D6E] bg-[#E7F3ED] text-[#0E5A45]" : v === "not" ? "border-[#B42318] bg-[#FDECEA] text-[#B42318]" : "border-cx bg-cx-tint text-cx") : "border-j-line bg-white text-j-ink-2",
          )}
        >
          {v === "met" ? "Met" : v === "not" ? "Not met" : "N/A requested"}
        </button>
      ))}
    </span>
  );
}
