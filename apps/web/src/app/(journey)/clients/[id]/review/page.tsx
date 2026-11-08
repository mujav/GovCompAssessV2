"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Field, inputClass, JButton, JLink, Panel, PanelHead, Pill, Segmented } from "@/components/journey/ui";
import { AiBox, ClosedBanner, LevelPill, Modal, Row, Table, useToast } from "@/components/cycle/ui";
import { Icon } from "@/components/journey/icon";
import { cx } from "@/components/ui";
import { clientHref } from "@/lib/journey/portfolio";
import { attention, findingsOf, suggestRisks, verdictOf, type AttentionKind, type FindingLevel, type RiskItem } from "@/lib/cycle/model";
import { useCycle, type CycleControl } from "@/lib/cycle/use-cycle";
import { addDays, TODAY } from "@/lib/workspace/data";

const ALL = "all";

const GROUPS: { kind: AttentionKind; title: string }[] = [
  { kind: "overdue", title: "OVERDUE · past deadline and not accepted" },
  { kind: "atRisk", title: "AT RISK · likely to miss the deadline" },
  { kind: "stale", title: "STALE · no activity for 7+ days" },
  { kind: "returnedTwice", title: "RETURNED TWICE OR MORE" },
];

type Act = { kind: "follow" | "extend" | "reassign" | "call" | "risk"; c: CycleControl };

export default function ReviewHubPage() {
  const cy = useCycle();
  const { controls, cycle, runs, ai, closed, client } = cy;
  const { say, toast } = useToast();
  const [tab, setTab] = useState<"queue" | "attention" | "risks">("queue");
  const [act, setAct] = useState<Act | null>(null);
  const c = (p: string) => clientHref(client.id, p);

  const returns = useMemo(() => Object.fromEntries(Object.entries(cycle.reviews).map(([k, v]) => [k, v.returns])), [cycle.reviews]);
  const queue = controls.filter((x) => x.applicable && (x.stage === "submitted" || x.stage === "review"));
  const findings = useMemo(() => Object.fromEntries(queue.map((x) => [x.code, ai.agents.review ? findingsOf(x, runs) : []])), [queue, runs, ai.agents.review]);
  const att = useMemo(() => attention(controls, TODAY, ai.thresholds, returns, cycle.activity, ai.behavior.monitor), [controls, ai.behavior.monitor, ai.thresholds, returns, cycle.activity]);
  const critical = new Set(queue.filter((x) => findings[x.code]?.some((f) => f.level === "Critical")).map((x) => x.code));
  const overdue = att.filter((a) => a.kind === "overdue");
  const aiRisks = ai.agents.monitor ? suggestRisks(controls, new Set([...critical, ...overdue.map((a) => a.control.code)]), TODAY).filter((r) => !cycle.dismissed.includes(r.id)) : [];

  const sendAll = () => {
    const targets = att.filter((a) => a.kind === "overdue" || a.kind === "atRisk");
    for (const a of targets) cy.followUp(a.control.code, a.control.owner, draftFor(a.control, a.when));
    say(`Sent ${targets.length} follow-ups to ${new Set(targets.map((a) => a.control.owner)).size} owners`);
  };

  return (
    <ClientShell search="Search controls" workBadge={String(queue.length + att.length)}>
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Index Owner · {cy.label}</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Review hub</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <JLink size="sm" variant="ghost" href={c("/requirements")}>
              All requirements
            </JLink>
            <JLink size="sm" variant="ghost" href={c("/evidence")}>
              Evidence library
            </JLink>
            <JLink size="sm" variant="ghost" href={c("/work")}>
              Reminders and escalation
            </JLink>
            <JLink size="sm" variant="ghost" href={c("/submission")}>
              Submission pack
            </JLink>
            <JButton variant="primary" disabled={closed || !att.length} onClick={sendAll}>
              <Icon name="send" size={15} />
              Send all follow-ups
            </JButton>
          </div>
        </div>
        <ClosedBanner show={closed} />

        {(ai.agents.monitor || ai.agents.review) && <Briefing queue={queue} findings={findings} overdue={overdue.map((a) => a.control)} controls={controls} critical={critical} />}

        <Segmented
          label="Review hub sections"
          value={tab}
          onChange={setTab}
          options={[
            { value: "queue", label: `Review queue · ${queue.length}` },
            { value: "attention", label: `Attention · ${att.length}` },
            { value: "risks", label: `Risks and issues · ${cycle.risks.length + aiRisks.length}` },
          ]}
        />

        {tab === "queue" && <Queue cy={cy} queue={queue} findings={findings} />}

        {tab === "attention" && (
          <div className="flex flex-col gap-3.5">
            {!ai.agents.monitor && <p className="m-0 text-[13px] text-j-muted">The Delay and Attention Monitor is off in AI settings; follow-ups are not drafted for you.</p>}
            {GROUPS.map((g) => {
              const items = att.filter((a) => a.kind === g.kind);
              if (!items.length) return null;
              return (
                <Panel key={g.kind} className="flex flex-col py-2">
                  <h2 className="m-0 px-[22px] pt-3 pb-2 text-xs font-bold tracking-[0.06em] text-j-muted">
                    {g.title} · {items.length}
                  </h2>
                  {items.map((a) => (
                    <div key={a.control.code} className="flex flex-wrap items-center gap-3 border-t border-j-line-soft px-[22px] py-3 text-sm">
                      <span className="min-w-[260px] flex-[2_1_260px]">
                        <b className="font-mono text-xs">{a.control.code}</b> <b>{a.control.title}</b>
                        <br />
                        <span className="text-[13px] text-j-ink-3">{a.detail}</span>
                      </span>
                      <span className="min-w-[180px] flex-[1_1_180px] text-[13px] text-j-ink-2">
                        {a.control.department} · {a.control.owner || "Unassigned"}
                      </span>
                      <Pill tone={g.kind === "overdue" ? "bad" : g.kind === "atRisk" ? "warn" : "gray"}>{a.when}</Pill>
                      <span className="flex flex-wrap gap-1.5">
                        {g.kind !== "returnedTwice" ? (
                          <>
                            <JButton size="sm" variant="outline" disabled={closed} onClick={() => setAct({ kind: "follow", c: a.control })}>
                              Draft follow-up
                            </JButton>
                            {g.kind !== "stale" && (
                              <JButton size="sm" disabled={closed} onClick={() => setAct({ kind: "extend", c: a.control })}>
                                Extend
                              </JButton>
                            )}
                            {g.kind === "overdue" && (
                              <JButton size="sm" disabled={closed} onClick={() => setAct({ kind: "reassign", c: a.control })}>
                                Reassign
                              </JButton>
                            )}
                          </>
                        ) : (
                          <>
                            <JButton size="sm" variant="outline" disabled={closed} onClick={() => setAct({ kind: "call", c: a.control })}>
                              Book a call
                            </JButton>
                            <JButton size="sm" disabled={closed} onClick={() => setAct({ kind: "risk", c: a.control })}>
                              Log as risk
                            </JButton>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </Panel>
              );
            })}
            {!att.length && <Panel className="p-[22px] text-sm text-j-muted">Nothing overdue, at risk or stale. Every open control is on track.</Panel>}
          </div>
        )}

        {tab === "risks" && <Risks cy={cy} aiRisks={aiRisks} say={say} />}
      </JMain>
      <ActionDialog cy={cy} act={act} onClose={() => setAct(null)} say={say} />
      {toast}
    </ClientShell>
  );
}

const draftFor = (c: CycleControl, when: string) =>
  `Hello ${c.owner.split(" ")[0] || "team"}, control ${c.code} (${c.title}) is ${when.toLowerCase()}. ${c.evidence.uploaded} of ${c.evidence.expected} evidence items are uploaded. Can you share the remaining evidence and submit the response, or tell me what is blocking you?`;

function Briefing({ queue, findings, overdue, controls, critical }: { queue: CycleControl[]; findings: Record<string, ReturnType<typeof findingsOf>>; overdue: CycleControl[]; controls: CycleControl[]; critical: Set<string> }) {
  const reqs = controls.filter((c) => c.applicable).reduce((a, c) => a + c.total, 0) || 1;
  const passing = queue.reduce((a, c) => a + c.reqs.filter((r) => r.stage !== "accepted" && r.status !== "na" && verdictOf(r) === "satisfied").length, 0);
  const pts = Math.round((passing / reqs) * 1000) / 10;
  const crit = queue.filter((c) => critical.has(c.code));
  const byDept = new Map<string, number>();
  for (const c of overdue) byDept.set(c.department, (byDept.get(c.department) ?? 0) + 1);
  const worst = [...byDept.entries()].sort((a, b) => b[1] - a[1])[0];
  const late = [...overdue].sort((a, b) => a.due.localeCompare(b.due))[0];
  return (
    <AiBox title="AI executive briefing · since yesterday 16:00" only="Only you see this">
      <div className="flex flex-wrap gap-6 text-sm">
        <span>
          <b className="text-xl">{queue.length}</b> controls submitted or resubmitted
        </span>
        <span>
          <b className="text-xl">{crit.length}</b> with critical findings
        </span>
        <span>
          <b className="text-xl">{overdue.length}</b> controls overdue
        </span>
        <span>
          <b className="text-xl">+{pts} pts</b> compliance rate if today&apos;s queue passes
        </span>
      </div>
      {crit.length > 0 && (
        <p className="m-0 text-sm">
          <b>Key finding:</b> {`${crit.length} of the ${queue.length} submissions have critical findings – ${crit.slice(0, 3).map((c) => c.code).join(", ")}. They would drop to Non-compliant as submitted.`}{" "}
          <span className="text-j-ink-3">
            {crit[0].code} · {findings[crit[0].code]?.[0]?.text}
          </span>
        </p>
      )}
      {worst && (
        <p className="m-0 text-sm">
          <b>Delays:</b> {worst[1]} of the {overdue.length} overdue controls sit with {worst[0]}
          {late ? `; ${late.code} is the longest overdue.` : "."}
        </p>
      )}
      {(crit.length > 0 || worst) && (
        <p className="m-0 text-sm">
          <b>Suggested order:</b> {crit.length ? `review ${crit.slice(0, 2).map((c) => c.code).join(" and ")} first` : "clear the review queue"}
          {worst ? `, then send follow-ups to ${worst[0]}.` : "."}
        </p>
      )}
    </AiBox>
  );
}

function Queue({ cy, queue, findings }: { cy: ReturnType<typeof useCycle>; queue: CycleControl[]; findings: Record<string, ReturnType<typeof findingsOf>> }) {
  const { client, cycle, me, closed } = cy;
  const [dim, setDim] = useState(ALL);
  const [dom, setDom] = useState(ALL);
  const [dept, setDept] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [level, setLevel] = useState<FindingLevel | typeof ALL>(ALL);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(queue[0]?.code ?? null);
  const [pos, setPos] = useState(0);
  const dims = [...new Map(queue.map((c) => [c.dimension, c.dimensionName])).entries()];
  const doms = [...new Set(queue.filter((c) => dim === ALL || c.dimension === dim).map((c) => c.domain))];
  const depts = [...new Set(queue.map((c) => c.department))];
  const rows = queue.filter(
    (c) =>
      (dim === ALL || c.dimension === dim) &&
      (dom === ALL || c.domain === dom) &&
      (dept === ALL || c.department === dept) &&
      (status === ALL || (status === "re" ? (cycle.reviews[c.code]?.returns ?? 0) > 0 : !(cycle.reviews[c.code]?.returns ?? 0))) &&
      (level === ALL || findings[c.code]?.some((f) => f.level === level)) &&
      (!q || `${c.code} ${c.title} ${c.owner}`.toLowerCase().includes(q.toLowerCase())),
  );
  const cols = "2.4fr 1.2fr 1fr 0.8fr 1.2fr";
  return (
    <Panel className="flex flex-col gap-3 py-[18px]">
      <div className="flex flex-wrap gap-2 px-[22px]">
        <select aria-label="Dimension" value={dim} onChange={(e) => (setDim(e.target.value), setDom(ALL))} className={cx(inputClass, "h-10")}>
          <option value={ALL}>All dimensions</option>
          {dims.map(([k, n]) => (
            <option key={k} value={k}>
              {k} {n}
            </option>
          ))}
        </select>
        <select aria-label="Domain" value={dom} onChange={(e) => setDom(e.target.value)} className={cx(inputClass, "h-10")}>
          <option value={ALL}>All domains</option>
          {doms.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} className={cx(inputClass, "h-10")}>
          <option value={ALL}>All departments</option>
          {depts.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={cx(inputClass, "h-10")}>
          <option value={ALL}>All statuses</option>
          <option value="new">Newly submitted</option>
          <option value="re">Resubmitted</option>
        </select>
        <select aria-label="Finding level" value={level} onChange={(e) => setLevel(e.target.value as FindingLevel)} className={cx(inputClass, "h-10")}>
          <option value={ALL}>Any finding level</option>
          <option>Critical</option>
          <option>High</option>
          <option>Medium</option>
        </select>
        <input aria-label="Search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputClass, "h-10 min-w-[160px] flex-auto")} />
      </div>
      <Table label="Review queue" cols={cols} head={["Control", "Department", "Owner", "Req. met", "AI findings"]}>
        {rows.map((c) => {
          const f = findings[c.code] ?? [];
          const aiMet = c.reqs.filter((r) => r.status !== "na" && verdictOf(r, cy.runs[r.code]) === "satisfied").length;
          const isOpen = open === c.code;
          const reviewer = cycle.reviews[c.code]?.reviewer;
          return (
            <div key={c.code} className="border-b border-j-line-soft last:border-0">
              <Row cols={cols} onClick={() => (setOpen(isOpen ? null : c.code), setPos(0))} selected={isOpen} className="border-0">
                <span>
                  <b className="font-mono text-xs">{c.code}</b> {c.title}
                  {(cycle.reviews[c.code]?.returns ?? 0) > 0 && <Pill className="ms-2">Resubmitted</Pill>}
                </span>
                <span>{c.department}</span>
                <span>{c.owner}</span>
                <span>
                  {aiMet} / {c.total}
                </span>
                <span className="flex flex-wrap gap-1">
                  {f.length ? (["Critical", "High", "Medium"] as FindingLevel[]).map((l) => {
                    const n = f.filter((x) => x.level === l).length;
                    return n ? <LevelPill key={l} level={l} /> : null;
                  }) : <Pill tone="ok">Clean</Pill>}
                </span>
              </Row>
              {isOpen && (
                <div className="flex flex-col gap-2.5 bg-j-canvas px-[22px] py-3.5 text-sm">
                  <span className="text-xs text-j-muted">
                    Requirements met (AI) {aiMet} / {c.total} · Evidence items {c.evidence.uploaded} / {c.evidence.expected}
                    {reviewer && ` · Assigned to ${reviewer}`}
                  </span>
                  {f.length ? (
                    <div className="flex items-start gap-2">
                      <span className="flex flex-auto flex-col gap-1">
                        <b className="text-xs">
                          AI findings · {Math.min(pos, f.length - 1) + 1} of {f.length}
                        </b>
                        <span className="flex items-center gap-2">
                          <LevelPill level={f[Math.min(pos, f.length - 1)].level} />
                          {f[Math.min(pos, f.length - 1)].text}
                        </span>
                      </span>
                      <JButton size="sm" variant="ghost" aria-label="Previous finding" onClick={() => setPos(Math.max(0, pos - 1))}>
                        ‹
                      </JButton>
                      <JButton size="sm" variant="ghost" aria-label="Next finding" onClick={() => setPos(Math.min(f.length - 1, pos + 1))}>
                        ›
                      </JButton>
                    </div>
                  ) : (
                    <span>No findings – every requirement has supporting evidence.</span>
                  )}
                  <span className="flex gap-2">
                    <JLink size="sm" variant="primary" href={clientHref(client.id, `/review/${encodeURIComponent(c.code)}`)}>
                      Open full review
                    </JLink>
                    <JButton size="sm" disabled={closed || reviewer === me} onClick={() => cy.setCycle((d) => void ((d.reviews[c.code] ??= { decisions: {}, returns: 0 }).reviewer = me))}>
                      {reviewer === me ? "Assigned to you" : "Assign to me"}
                    </JButton>
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {!rows.length && <p className="m-0 px-[22px] py-4 text-sm text-j-muted">{queue.length ? "No control matches these filters." : "Nothing waiting for your review."}</p>}
      </Table>
    </Panel>
  );
}

function Risks({ cy, aiRisks, say }: { cy: ReturnType<typeof useCycle>; aiRisks: RiskItem[]; say: (t: string) => void }) {
  const { cycle, setCycle, closed, owners, me } = cy;
  const [adding, setAdding] = useState(false);
  const cols = "2.2fr 0.6fr 1.1fr 0.6fr 0.9fr 0.8fr 0.9fr";
  return (
    <Panel className="flex flex-col py-[18px]">
      <PanelHead
        className="px-[22px] pb-3"
        title="Risks and issues register"
        aside={
          <JButton size="sm" variant="primary" disabled={closed} onClick={() => setAdding(true)}>
            + Add risk or issue
          </JButton>
        }
      />
      <Table label="Risks and issues" cols={cols} head={["Item", "Type", "Linked controls", "Impact", "Owner", "Due", "Status"]}>
        {cycle.risks.map((r) => (
          <Row key={r.id} cols={cols}>
            <span>{r.title}</span>
            <span>{r.type}</span>
            <span className="font-mono text-xs">{r.controls.join(", ") || "–"}</span>
            <Pill tone={r.impact === "High" ? "bad" : r.impact === "Medium" ? "warn" : "gray"}>{r.impact}</Pill>
            <span>{r.owner || me}</span>
            <span>{r.due}</span>
            <select
              aria-label={`Status of ${r.title}`}
              disabled={closed}
              value={r.status}
              onChange={(e) => setCycle((d) => void (d.risks.find((x) => x.id === r.id)!.status = e.target.value as RiskItem["status"]))}
              className="h-8 rounded-lg border border-j-line bg-white px-1.5 text-[13px]"
            >
              <option>Open</option>
              <option>Mitigating</option>
              <option>Closed</option>
            </select>
          </Row>
        ))}
        {aiRisks.map((r) => (
          <Row key={r.id} cols={cols} className="bg-[#F7F6FE]">
            <span className="flex items-start gap-1.5">
              <Icon name="ai" size={14} />
              AI suggestion: {r.title}
            </span>
            <span>{r.type}</span>
            <span className="font-mono text-xs">{r.controls.join(", ")}</span>
            <span>–</span>
            <span>–</span>
            <span>–</span>
            <span className="flex gap-1">
              <JButton
                size="sm"
                variant="outline"
                disabled={closed}
                onClick={() => {
                  cy.addRisk({ ...r, owner: me });
                  setCycle((d) => void d.dismissed.push(r.id));
                  say("Risk added to the register");
                }}
              >
                Confirm
              </JButton>
              <JButton size="sm" variant="ghost" onClick={() => setCycle((d) => void d.dismissed.push(r.id))}>
                Dismiss
              </JButton>
            </span>
          </Row>
        ))}
        {!cycle.risks.length && !aiRisks.length && <p className="m-0 px-[22px] py-4 text-sm text-j-muted">No risks or issues logged.</p>}
      </Table>
      <RiskDialog open={adding} onClose={() => setAdding(false)} owners={owners.map((p) => p.name)} me={me} onSave={(r) => (cy.addRisk(r), say(`${r.type} added to the register`))} />
    </Panel>
  );
}

function RiskDialog({ open, onClose, onSave, owners, me, preset }: { open: boolean; onClose: () => void; onSave: (r: Omit<RiskItem, "id">) => void; owners: string[]; me: string; preset?: Partial<RiskItem> }) {
  const [title, setTitle] = useState(preset?.title ?? "");
  const [type, setType] = useState<RiskItem["type"]>(preset?.type ?? "Risk");
  const [controls, setControls] = useState(preset?.controls?.join(", ") ?? "");
  const [impact, setImpact] = useState<RiskItem["impact"]>("High");
  const [owner, setOwner] = useState(me);
  const [due, setDue] = useState(addDays(TODAY, 7));
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add risk or issue"
      footer={
        <>
          <JButton onClick={onClose}>Cancel</JButton>
          <JButton
            variant="primary"
            disabled={!title.trim()}
            onClick={() => {
              onSave({ title: title.trim(), type, controls: controls.split(/[,\s]+/).filter(Boolean), impact, owner, due, status: "Open" });
              onClose();
            }}
          >
            Add to register
          </JButton>
        </>
      }
    >
      <Field label="Item">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value as RiskItem["type"])} className={inputClass}>
            <option>Risk</option>
            <option>Issue</option>
          </select>
        </Field>
        <Field label="Impact">
          <select value={impact} onChange={(e) => setImpact(e.target.value as RiskItem["impact"])} className={inputClass}>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </Field>
        <Field label="Owner">
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass}>
            {[me, ...owners.filter((o) => o !== me)].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </Field>
        <Field label="Due">
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <Field label="Linked controls">
        <input value={controls} onChange={(e) => setControls(e.target.value)} placeholder="5.9.1, 5.9.3" className={inputClass} />
      </Field>
    </Modal>
  );
}

function ActionDialog({ cy, act, onClose, say }: { cy: ReturnType<typeof useCycle>; act: Act | null; onClose: () => void; say: (t: string) => void }) {
  const c = act?.c;
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [owner, setOwner] = useState("");
  const [reason, setReason] = useState("");
  const [at, setAt] = useState(`${addDays(TODAY, 1)}T10:00`);
  if (!act || !c) return null;
  if (act.kind === "risk")
    return (
      <RiskDialog
        open
        onClose={onClose}
        owners={cy.owners.map((p) => p.name)}
        me={cy.me}
        preset={{ title: `${c.code} ${c.title} returned ${cy.cycle.reviews[c.code]?.returns ?? 2} times`, type: "Issue", controls: [c.code] }}
        onSave={(r) => (cy.addRisk(r), say(`${c.code} logged as ${r.type.toLowerCase()}`))}
      />
    );
  const titles = { follow: `Follow up on ${c.code}`, extend: `Extend ${c.code}`, reassign: `Reassign ${c.code}`, call: `Book a call about ${c.code}` };
  const body = text || draftFor(c, c.due < TODAY ? "overdue" : "due soon");
  const done = () => {
    setText("");
    setDue("");
    setOwner("");
    setReason("");
    onClose();
  };
  const go = () => {
    if (act.kind === "follow") {
      cy.followUp(c.code, c.owner, body);
      say(`Follow-up sent to ${c.owner}`);
    } else if (act.kind === "extend") {
      cy.updatePlan([c.code], { due }, reason || "Extended from the review hub", 1);
      cy.followUp(c.code, c.owner, `Your deadline for ${c.code} has moved to ${due}. ${reason}`, "Deadline");
      say(`${c.code} extended to ${due}`);
    } else if (act.kind === "reassign") {
      cy.updatePlan([c.code], { owner }, reason || "Reassigned from the review hub", 2);
      cy.followUp(c.code, owner, `You now own control ${c.code} (${c.title}), due ${c.due}. ${reason}`, "Instruction");
      say(`${c.code} reassigned to ${owner}`);
    } else {
      cy.followUp(c.code, c.owner, `Call booked for ${at.replace("T", " ")} about ${c.code}: ${reason || "the returned items"}.`, "Call");
      say(`Call booked with ${c.owner}`);
    }
    done();
  };
  const ok = act.kind === "extend" ? !!due : act.kind === "reassign" ? !!owner : true;
  return (
    <Modal
      open
      onClose={done}
      title={titles[act.kind]}
      sub={`${c.title} · ${c.department} · ${c.owner || "Unassigned"} · due ${c.due}`}
      footer={
        <>
          <JButton onClick={done}>Cancel</JButton>
          <JButton variant="primary" disabled={!ok} onClick={go}>
            {act.kind === "follow" ? "Send follow-up" : act.kind === "call" ? "Book and notify" : "Save and notify"}
          </JButton>
        </>
      }
    >
      {act.kind === "follow" && (
        <Field label={cy.ai.agents.monitor ? "Drafted by AI – edit before sending" : "Message"}>
          <textarea rows={5} value={body} onChange={(e) => setText(e.target.value)} className="rounded-xl border border-j-line p-3 font-sans text-sm font-normal" />
        </Field>
      )}
      {act.kind === "extend" && (
        <Field label="New deadline">
          <input type="date" min={TODAY} value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
        </Field>
      )}
      {act.kind === "reassign" && (
        <Field label="New Control Owner">
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass}>
            <option value="">Choose a person…</option>
            {cy.owners.filter((p) => p.name !== c.owner).map((p) => (
              <option key={p.id} value={p.name}>
                {p.name} · {p.department}
              </option>
            ))}
          </select>
        </Field>
      )}
      {act.kind === "call" && (
        <Field label="When">
          <input type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} className={inputClass} />
        </Field>
      )}
      {act.kind !== "follow" && (
        <Field label={act.kind === "call" ? "Agenda" : "Reason"}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass} />
        </Field>
      )}
      <p className="m-0 text-xs text-j-muted">
        Recorded in the plan&apos;s change history and the audit trail. <Link href={clientHref(cy.client.id, `/review/${encodeURIComponent(c.code)}`)}>Open the control</Link>
      </p>
    </Modal>
  );
}
