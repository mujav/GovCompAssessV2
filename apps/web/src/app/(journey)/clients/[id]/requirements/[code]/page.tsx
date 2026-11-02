"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Avatar, JButton, JLink, Panel, PanelHead, Pill, type PillTone } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { CLARIFICATIONS, addDays, shortDate, type WsRequirement } from "@/lib/workspace/data";
import { PEOPLE } from "@/lib/journey/frameworks";
import { clientHref } from "@/lib/journey/portfolio";
import { useScreenState } from "@/lib/journey/store";
import { useClientWork } from "@/lib/journey/use-work";
import { RESULT, STAGES, codeKey, initials, isReturned, stageOf } from "@/lib/journey/work";

// 09 · Requirement workspace. Draft the response, check the AI assessment, make the L1
// decision and chase the SPOC — all for one requirement.

type Tab = "req" | "ev" | "rev" | "hand" | "rem" | "cla" | "act";
type Mark = "met" | "gap" | "part";
const MARK: Record<Mark, [string, PillTone]> = { met: ["Met", "ok"], gap: ["Gap", "bad"], part: ["Partly", "warn"] };

const CRITERIA = ["Defined and approved by the right authority", "In place across the entity", "Evidence shows it in use this cycle", "Reviewed and improved on a schedule"];

/** Criterion marks implied by the requirement's current assessment. */
function marksFor(r: WsRequirement): Mark[] {
  if (r.status === "comp" || r.status === "na") return ["met", "met", "met", "met"];
  if (r.status === "part") return ["met", "met", "gap", "part"];
  if (r.status === "non") return ["met", "gap", "gap", "part"];
  return ["part", "gap", "gap", "gap"];
}

const DECISIONS = ["Ready · send to client", "Needs more evidence", "Return to SPOC"] as const;
const DECISION_CTA = ["Send to client", "Request evidence", "Return to SPOC"];

interface ReqScreen {
  draft?: string;
  note?: string;
  dec: number;
  requests: { t: string; sent: string; done: boolean; reminded: boolean }[];
  remProposed: boolean;
  claApplied: boolean;
  activity: { what: string; when: string }[];
}

export default function RequirementWorkspacePage() {
  const { code } = useParams<{ code: string }>();
  const { client, ws, framework, reqs, overlay, move, ret, assign, log } = useClientWork();
  const r = reqs.find((x) => x.code === code);
  const [tab, setTab] = useState<Tab>("rev");
  const [s, set] = useScreenState<ReqScreen>(`req.${client.id}.${code}`, { dec: 1, requests: [], remProposed: false, claApplied: false, activity: [] });
  const c = (p: string) => clientHref(client.id, p);

  const sorted = useMemo(() => [...reqs].sort((a, b) => codeKey(a.code).localeCompare(codeKey(b.code))), [reqs]);
  if (!r) {
    return (
      <ClientShell>
        <JMain>
          <h1 className="m-0 text-2xl">
            Requirement {code} is not in {framework?.name ?? "this framework"}
          </h1>
          <JLink href={c("/requirements")}>Back to requirements</JLink>
        </JMain>
      </ClientShell>
    );
  }

  const idx = sorted.findIndex((x) => x.code === r.code);
  const prev = sorted[idx - 1];
  const next = sorted[idx + 1];
  const stage = stageOf(r, overlay);
  const stageIdx = STAGES.findIndex((x) => x.key === stage);
  const returned = isReturned(r, overlay);
  const marks = marksFor(r);
  const gaps = marks.filter((m) => m !== "met").length;
  const confidence = 98 - gaps * 6;
  const cla = CLARIFICATIONS.find((x) => x.affects.includes(r.code));
  const axis = [...new Set(reqs.map((x) => x.domain))].indexOf(r.domain) + 1;
  const [res, rbg, rfg] = RESULT[r.status];
  const owner = r.owner || "Unassigned";
  const evidence = [
    ...Array.from({ length: r.evidence.valid }, (_, i) => ({ id: `EV-${1900 + ((codeKey(r.code).length * 37 + i * 53) % 400)}`, t: `${CRITERIA[i % 4].split(" ")[0]} record ${i + 1}`, meta: `${4 + i * 3} pages · Oct 2026`, ok: true })),
    ...Array.from({ length: r.evidence.invalid }, (_, i) => ({ id: `EV-${1700 + i}`, t: "Prior-cycle sample", meta: "3 pages · Mar 2025", ok: false })),
  ];
  const missing = Math.max(0, r.evidence.expected - r.evidence.valid);
  const requests = s.requests.length
    ? s.requests
    : missing > 0 && r.owner
      ? Array.from({ length: missing }, (_, i) => ({ t: `${CRITERIA[2 + (i % 2)]} · ${r.title.split(":")[0]}`, sent: "5 d ago", done: false, reminded: false }))
      : [];

  const act = (what: string) =>
    set((d) => {
      d.activity.unshift({ what, when: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) });
    });

  const decide = () => {
    if (s.dec === 0) {
      move([r.code], "cli", `L1 approved ${r.code} and sent to ${client.name}`);
      act("L1 approved · sent to client");
    } else if (s.dec === 1) {
      ws.createDraft("evidence-request", [r.code]);
      move([r.code], "prog");
      act("Requested more evidence");
      log(`Evidence request drafted for ${r.code}`);
    } else {
      ret([r.code], `Returned ${r.code} to ${owner}`);
      act(`Returned to ${owner}`);
    }
  };

  const tabs: [Tab, string, number?][] = [
    ["req", "Requirement"],
    ["ev", "Evidence", evidence.length],
    ["rev", "Review", stage === "rev" ? 1 : undefined],
    ["hand", "Hand-offs", requests.filter((h) => !h.done).length || undefined],
    ["rem", "Remediation", gaps ? 1 : undefined],
    ["cla", "Clarifications", cla ? 1 : undefined],
    ["act", "Activity"],
  ];

  const nextAction = stage === "rev" ? "Complete L1 review" : stage === "cli" ? "Waiting for client" : stage === "acc" ? "Accepted" : stage === "start" ? "Start draft" : "Continue draft";
  const activity = [
    ...s.activity.map((a) => ({ av: "SR", tone: "me", what: a.what, who: "Sami R.", when: `Today, ${a.when}` })),
    { av: "AI", tone: "ai", what: `AI check: ${gaps ? "not ready to accept" : "ready to accept"} · ${confidence}%`, who: "Platform", when: "Today, 09:40" },
    ...(r.evidence.valid ? [{ av: initials(owner), tone: "cl", what: `Uploaded ${r.evidence.valid} evidence files`, who: owner, when: "Yesterday" }] : []),
    { av: "SR", tone: "me", what: "Drafted response", who: "Sami R.", when: "9 d ago" },
    { av: "SR", tone: "me", what: `Assigned to ${r.department}`, who: "Sami R.", when: "12 d ago" },
  ];
  const ACT_TONE: Record<string, [string, string]> = { me: ["#EAF1FA", "#1E4E8C"], cl: ["#E7F3ED", "#0E5A45"], ai: ["#EEEDFD", "#4F46E5"] };

  return (
    <ClientShell>
      <JMain>
        <div className="flex flex-wrap items-center justify-between gap-3 text-[13px]">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-j-muted">
            <Link href={c("/requirements")} className="font-semibold text-cx">
              Requirements
            </Link>
            <span>›</span>
            <span>
              {framework?.live.levels[0]?.en ?? "Axis"} {axis} · {r.domain}
            </span>
            <span>›</span>
            <b className="font-mono text-j-ink">{r.code}</b>
          </nav>
          <span className="flex gap-1.5">
            {prev && (
              <JLink size="sm" href={c(`/requirements/${prev.code}`)}>
                ‹ {prev.code}
              </JLink>
            )}
            {next && (
              <JLink size="sm" href={c(`/requirements/${next.code}`)}>
                {next.code} ›
              </JLink>
            )}
          </span>
        </div>

        <Panel className="flex flex-col gap-5 p-[22px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <span className="flex flex-wrap gap-1.5">
                <Pill tone="dark" round={false} className="font-mono">
                  {r.code}
                </Pill>
                <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: rbg, color: rfg }}>
                  Last result · DGA 2025: {res}
                </span>
                {r.weight === "high" && <Pill tone="bad">Mandatory</Pill>}
                {returned && stage !== "acc" && <Pill tone="bad">Returned by client</Pill>}
              </span>
              <h1 className="m-0 text-[26px] leading-[34px] font-bold tracking-[-0.01em]">{r.title}</h1>
              <span className="flex flex-wrap items-center gap-2 text-[13px] text-j-ink-2">
                <Avatar initials={initials(r.owner)} size={26} bg={r.owner ? undefined : "#FDECEA"} fg={r.owner ? undefined : "#B42318"} />
                <label className="sr-only" htmlFor="req-owner">
                  Owner
                </label>
                <select
                  id="req-owner"
                  value={r.owner}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    assign([r.code], e.target.value, r.due > ws.ctx.today ? r.due : addDays(ws.ctx.today, 14));
                    act(`Assigned to ${e.target.value}`);
                    log(`Assigned ${r.code} to ${e.target.value}`);
                  }}
                  className={cx("h-8 cursor-pointer rounded-lg border border-j-line bg-white px-2 text-[13px]", r.owner ? "text-j-ink" : "font-semibold text-j-bad")}
                >
                  {!r.owner && <option value="">Assign an owner…</option>}
                  {r.owner && !PEOPLE.some((p) => p.name === r.owner) && <option value={r.owner}>{r.owner}</option>}
                  {PEOPLE.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} · {p.dept}
                    </option>
                  ))}
                </select>
                {r.department && <span>{r.department} · SPOC</span>}
                <span>· due {shortDate(r.due)}</span>
              </span>
            </div>
            <div className="flex flex-col items-end gap-2">
              <JButton variant="primary" disabled={stage === "cli" || stage === "acc"} onClick={() => setTab(stage === "rev" ? "rev" : "req")}>
                {nextAction}
              </JButton>
              <span className="text-xs text-j-muted">
                Submission pack: <b className="text-j-ink">{stage === "acc" ? "included" : "not yet · needs client acceptance"}</b>
              </span>
            </div>
          </div>
          <ol aria-label="Stage" className="m-0 grid list-none grid-cols-5 gap-1.5 p-0">
            {STAGES.map((st, i) => (
              <li key={st.key} aria-current={i === stageIdx ? "step" : undefined} className="flex flex-col gap-1.5">
                <span className="h-1.5 rounded-[3px]" style={{ background: i < stageIdx ? "#1E4E8C" : i === stageIdx ? "#3A6FB8" : "#E6EBE8" }} />
                <span className={cx("text-xs", i === stageIdx ? "font-bold text-cx" : i < stageIdx ? "text-j-ink" : "text-j-muted")}>{st.label}</span>
              </li>
            ))}
          </ol>
        </Panel>

        <div role="tablist" aria-label="Requirement" className="flex gap-1 overflow-x-auto border-b border-j-line">
          {tabs.map(([k, l, n]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cx("inline-flex h-11 cursor-pointer items-center gap-1.5 whitespace-nowrap border-0 border-b-2 bg-transparent px-3.5 text-sm", tab === k ? "border-cx font-bold text-cx" : "border-transparent font-medium text-j-ink-3")}
            >
              {l}
              {n != null && <span className={cx("rounded-full px-1.5 text-[11px] font-bold", tab === k ? "bg-cx-soft text-cx" : "bg-j-canvas text-j-ink-3")}>{n}</span>}
            </button>
          ))}
        </div>

        {tab === "req" && (
          <div className="flex flex-wrap items-start gap-3.5">
            <Panel className="flex min-w-0 flex-[2_1_520px] flex-col gap-3 p-[22px]">
              <PanelHead title="Official requirement" aside={<span className="text-xs text-j-muted" dir="auto">{framework ? `${framework.name} · v${framework.version}` : client.frameworks[0]}</span>} />
              {r.text || r.evidenceText ? (
                <div className="flex flex-col gap-2 text-sm leading-6" dir="auto">
                  {r.text && <p className="m-0 whitespace-pre-line">{r.text}</p>}
                  {r.evidenceText && (
                    <p className="m-0 whitespace-pre-line text-j-ink-2">
                      <b>Evidence required:</b> {r.evidenceText}
                    </p>
                  )}
                </div>
              ) : (
                <p className="m-0 text-sm leading-6">
                  The entity demonstrates that &ldquo;{r.title.split(":")[0].toLowerCase()}&rdquo; is {r.title.split(": ")[1] ?? "in place"}, with evidence from the current cycle for each criterion.
                </p>
              )}
              <h2 className="m-0 mt-2 text-base">Response draft</h2>
              <textarea
                aria-label="Response draft"
                rows={6}
                value={s.draft ?? `${r.department ? `${r.department} owns this requirement.` : "No department owns this requirement yet."} ${r.evidence.valid} of ${r.evidence.expected} expected evidence items are linked; ${missing ? `${missing} more requested from ${owner}.` : "the set is complete."}`}
                onChange={(e) => set((d) => void (d.draft = e.target.value))}
                className="rounded-xl border border-j-line p-3 font-sans text-sm leading-6 text-j-ink"
              />
              <span className="flex gap-2">
                <JButton
                  size="sm"
                  variant="primary"
                  disabled={stage !== "start" && stage !== "prog"}
                  onClick={() => {
                    move([r.code], "rev", `Response for ${r.code} ready for L1 review`);
                    act("Draft submitted for L1 review");
                    setTab("rev");
                  }}
                >
                  Submit for L1 review
                </JButton>
              </span>
            </Panel>
            <Panel className="flex min-w-0 flex-[1_1_300px] flex-col gap-2 p-[22px]">
              <h2 className="m-0 mb-1 text-base">Criteria</h2>
              {CRITERIA.map((t, i) => (
                <div key={t} className="flex items-center gap-2.5 border-b border-j-line-soft py-2 text-sm last:border-0">
                  <span className="font-mono text-xs text-j-muted">C{i + 1}</span>
                  <span className="flex-auto">{t}</span>
                  <Pill tone={MARK[marks[i]][1]}>{MARK[marks[i]][0]}</Pill>
                </div>
              ))}
            </Panel>
          </div>
        )}

        {tab === "ev" && (
          <Panel className="flex flex-col gap-2 p-[22px]">
            <PanelHead
              title="Linked evidence"
              aside={
                <span className="flex gap-2">
                  <JLink size="sm" href={c("/evidence")}>
                    Link from library
                  </JLink>
                  <JButton size="sm" variant="outline" onClick={() => setTab("hand")}>
                    Request from SPOC
                  </JButton>
                </span>
              }
            />
            {evidence.map((e) => (
              <div key={e.id} className="flex items-center gap-3 border-b border-j-line-soft py-3 last:border-0">
                <span className="flex h-10 w-9 items-center justify-center rounded-lg bg-j-bad-soft text-[10px] font-bold text-j-bad">PDF</span>
                <span className="flex-auto text-sm">
                  <b>{e.t}</b>
                  <br />
                  <span className="text-xs text-j-muted">
                    <span className="font-mono">{e.id}</span> · {e.meta}
                  </span>
                </span>
                <Pill tone={e.ok ? "ok" : "warn"}>{e.ok ? "Valid" : "Wrong period"}</Pill>
              </div>
            ))}
            {evidence.length === 0 && <p className="m-0 text-sm text-j-muted">No evidence linked yet.</p>}
          </Panel>
        )}

        {tab === "rev" && (
          <div className="flex flex-wrap items-start gap-3.5">
            <Panel className="flex min-w-0 flex-[2_1_520px] flex-col gap-2 p-[22px]">
              <PanelHead title="AI check" aside={<Pill tone={gaps ? "warn" : "ok"}>{gaps ? "Not ready to accept" : "Ready to accept"} · {confidence}%</Pill>} />
              <p className="m-0 text-xs text-j-muted">AI recommends; you decide. Nothing changes until you record a decision.</p>
              {CRITERIA.map((t, i) => (
                <div key={t} className="flex items-start gap-3 border-b border-j-line-soft py-3 last:border-0">
                  <span className="pt-0.5 font-mono text-xs text-j-muted">C{i + 1}</span>
                  <span className="flex-auto text-sm">
                    <b>{t}</b>
                    <br />
                    <span className="text-[13px] text-j-ink-3">
                      {marks[i] === "met" ? "Evidence covers this criterion." : marks[i] === "part" ? "Partly covered; the record is incomplete." : "No current-cycle evidence for this criterion."}
                    </span>
                    {evidence[i] && (
                      <>
                        <br />
                        <Link href={c("/evidence")} className="font-mono text-xs text-j-ai">
                          {evidence[i].id} · p.{i + 2}
                        </Link>
                      </>
                    )}
                  </span>
                  <Pill tone={MARK[marks[i]][1]}>{MARK[marks[i]][0]}</Pill>
                </div>
              ))}
            </Panel>
            <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5">
              <Panel className="flex flex-col gap-3 p-[22px]">
                <h2 className="m-0 text-base">Your L1 decision</h2>
                {stage === "rev" ? (
                  <>
                    <div role="radiogroup" aria-label="L1 decision" className="flex flex-col gap-1.5">
                      {DECISIONS.map((l, i) => {
                        const on = s.dec === i;
                        return (
                          <button
                            key={l}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => set((d) => void (d.dec = i))}
                            className={cx("flex h-11 cursor-pointer items-center gap-2.5 rounded-xl border-[1.5px] px-3 text-left text-sm font-semibold text-j-ink", on ? "border-cx bg-cx-tint" : "border-j-line bg-white")}
                          >
                            <span className={cx("h-4 w-4 rounded-full border-[1.5px]", on ? "border-cx bg-cx shadow-[inset_0_0_0_3px_#fff]" : "border-j-field bg-white")} />
                            {l}
                          </button>
                        );
                      })}
                    </div>
                    <textarea
                      aria-label="Note"
                      placeholder="Note for the record"
                      rows={3}
                      value={s.note ?? ""}
                      onChange={(e) => set((d) => void (d.note = e.target.value))}
                      className="rounded-xl border border-j-line p-3 font-sans text-sm text-j-ink"
                    />
                    <JButton variant="primary" onClick={decide}>
                      {DECISION_CTA[s.dec]}
                    </JButton>
                  </>
                ) : (
                  <p className="m-0 text-sm text-j-ink-3">
                    {stage === "cli" ? "L1 done. Waiting for the client to accept." : stage === "acc" ? "Accepted by the client." : "Not in review yet. Submit the draft for L1 first."}
                  </p>
                )}
              </Panel>
              <Panel className="flex flex-col gap-2.5 p-[22px]">
                <h2 className="m-0 text-base">Approval chain</h2>
                {[
                  ["AI", "AI check", "Done", `${confidence}%`, "ai", true],
                  ["SR", "L1", "You", stage === "rev" ? "Now" : stageIdx > 2 ? "Done" : "—", "cx", stage === "rev"],
                  ["NA", "Client", "Noura A.", stage === "cli" ? "Now" : stage === "acc" ? "Done" : "Next", "gray", stage === "cli"],
                  ["HS", "Final", "Huda S.", stage === "acc" ? "Done" : "—", "gray", false],
                ].map(([av, l, who, st, tone, now]) => (
                  <div key={l as string} className={cx("flex items-center gap-2.5 rounded-xl border px-2.5 py-2 text-sm", now ? "border-cx" : "border-transparent")}>
                    <Avatar initials={av as string} size={28} bg={tone === "ai" ? "#EEEDFD" : tone === "cx" ? "#EAF1FA" : "#F5F7F6"} fg={tone === "ai" ? "#4F46E5" : tone === "cx" ? "#1E4E8C" : "#47534D"} />
                    <span className="flex-auto">
                      <b>{l}</b> · {who}
                    </span>
                    <span className="text-xs font-semibold text-j-muted">{st}</span>
                  </div>
                ))}
              </Panel>
            </aside>
          </div>
        )}

        {tab === "hand" && (
          <Panel className="flex flex-col gap-2 p-[22px]">
            <PanelHead
              title="Requests"
              aside={
                <JButton
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    set((d) => {
                      d.requests = [...requests, { t: `Additional evidence · ${r.title.split(":")[0]}`, sent: "just now", done: false, reminded: false }];
                    });
                    act(`Requested evidence from ${owner}`);
                    log(`Evidence requested from ${owner} for ${r.code}`);
                  }}
                >
                  New request
                </JButton>
              }
            />
            {requests.map((h, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-j-line-soft py-3 last:border-0">
                <Avatar initials={initials(r.owner)} />
                <span className="flex-auto text-sm">
                  <b>{h.t}</b>
                  <br />
                  <span className="text-xs text-j-muted">
                    {owner} · SPOC · sent {h.sent}
                  </span>
                </span>
                <Pill tone={h.done ? "ok" : h.reminded ? "cx" : "bad"}>{h.done ? "Answered" : h.reminded ? "Reminded" : "Overdue"}</Pill>
                {!h.done && (
                  <JButton
                    size="sm"
                    disabled={h.reminded}
                    onClick={() => {
                      set((d) => {
                        d.requests = requests.map((x, j) => (j === i ? { ...x, reminded: true } : x));
                      });
                      log(`Reminder sent to ${owner} for ${r.code}`);
                    }}
                  >
                    Remind
                  </JButton>
                )}
              </div>
            ))}
            {requests.length === 0 && <p className="m-0 text-sm text-j-muted">No open requests.</p>}
          </Panel>
        )}

        {tab === "rem" && (
          <Panel className="flex flex-col gap-4 p-[22px]">
            <PanelHead title="Gap and fix" aside={<Pill tone={gaps ? (s.remProposed ? "cx" : "warn") : "ok"}>{gaps ? (s.remProposed ? "Proposed to client" : "Open") : "No gap"}</Pill>} />
            {gaps ? (
              <>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3 text-sm">
                  {[
                    ["Gap", `${gaps} of 4 criteria not fully met`],
                    ["Fix", `Produce current-cycle records for ${CRITERIA[marks.indexOf("gap") === -1 ? 3 : marks.indexOf("gap")].toLowerCase()}`],
                    ["Owner", `${owner} · ${r.department}`],
                    ["Target", `${shortDate(addDays(r.due, 7))} · before cycle deadline`],
                  ].map(([k, v]) => (
                    <span key={k} className="rounded-xl bg-j-canvas p-3">
                      <span className="text-xs text-j-muted">{k}</span>
                      <br />
                      <b>{v}</b>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <JLink size="sm" href={c("/outbox")}>
                    Open Outbox
                  </JLink>
                  <JButton
                    size="sm"
                    variant="primary"
                    disabled={s.remProposed}
                    onClick={() => {
                      ws.createDraft("remediation", [r.code]);
                      set((d) => void (d.remProposed = true));
                      act("Proposed remediation to client");
                      log(`Remediation proposed for ${r.code}`);
                    }}
                  >
                    Propose to client
                  </JButton>
                </div>
              </>
            ) : (
              <p className="m-0 text-sm text-j-muted">All criteria are met. Nothing to fix.</p>
            )}
          </Panel>
        )}

        {tab === "cla" && (
          <Panel className="flex flex-col gap-3 p-[22px]">
            {cla ? (
              <>
                <PanelHead
                  title={
                    <>
                      <span className="font-mono">{cla.id}</span> · {cla.title}
                    </>
                  }
                  aside={<Pill tone={s.claApplied ? "ok" : "ai"}>{s.claApplied ? "Applied" : "Answered · not applied"}</Pill>}
                />
                <p className="m-0 text-sm">
                  <b>DGA answer:</b> evidence must be dated in the current cycle, even for unchanged items.
                </p>
                <span className="text-[13px] text-j-muted">Affects {cla.affects.length} requirements</span>
                <div className="flex gap-2">
                  <JButton
                    size="sm"
                    variant="primary"
                    disabled={s.claApplied}
                    onClick={() => {
                      set((d) => void (d.claApplied = true));
                      act(`Applied ${cla.id}`);
                      log(`Applied ${cla.id} to ${r.code}`);
                    }}
                  >
                    Apply to this requirement
                  </JButton>
                  <JLink size="sm" href={c("/clarifications")}>
                    All clarifications
                  </JLink>
                </div>
              </>
            ) : (
              <p className="m-0 text-sm text-j-muted">
                No clarification affects this requirement. <Link href={c("/clarifications")}>Ask the DGA</Link>
              </p>
            )}
          </Panel>
        )}

        {tab === "act" && (
          <Panel className="flex flex-col p-[22px]">
            {activity.map((a, i) => (
              <div key={i} className="flex gap-3 pb-4">
                <span className="flex flex-col items-center">
                  <Avatar initials={a.av} size={30} bg={ACT_TONE[a.tone][0]} fg={ACT_TONE[a.tone][1]} />
                  {i < activity.length - 1 && <span className="mt-1 w-px flex-auto bg-j-line" />}
                </span>
                <span className="text-sm">
                  <b>{a.what}</b>
                  <br />
                  <span className="text-xs text-j-muted">
                    {a.who} · {a.when}
                  </span>
                </span>
              </div>
            ))}
          </Panel>
        )}
      </JMain>
    </ClientShell>
  );
}
