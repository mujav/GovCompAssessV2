"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/journey/icon";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Chips, JButton, Panel, Pill, inputClass, type PillTone } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { clientHref } from "@/lib/journey/portfolio";
import { useClientWork } from "@/lib/journey/use-work";
import { APPROVE_EFFECT, DRAFT_LABEL, type Draft } from "@/lib/workspace/drafts";

// Outbox. Every request, reminder, return and escalation is drafted from the records first;
// nothing leaves the platform until a consultant reviews the wording and approves it.

type Filter = "draft" | "approved" | "discarded";
const STATUS: Record<Draft["status"], [string, PillTone]> = { draft: ["To review", "ai"], approved: ["Sent", "ok"], discarded: ["Discarded", "gray"] };

export default function OutboxPage() {
  const { client, ws, log } = useClientWork();
  const [filter, setFilter] = useState<Filter>("draft");
  const [picked, setPicked] = useState<string | null>(null);
  const c = (p: string) => clientHref(client.id, p);
  const drafts = [...ws.state.drafts].reverse();
  const count = (f: Filter) => drafts.filter((d) => d.status === f).length;
  const shown = drafts.filter((d) => d.status === filter);
  const cur = shown.find((d) => d.id === picked) ?? shown[0];
  const editable = cur?.status === "draft";

  const decide = (d: Draft, decision: "approve" | "discard") => {
    ws.decideDraft(d.id, decision);
    log(`${decision === "approve" ? "Sent" : "Discarded"} ${DRAFT_LABEL[d.kind].toLowerCase()} ${d.id} · ${client.name}`);
    setPicked(null);
  };

  return (
    <ClientShell>
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Nothing is sent until you approve it</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Outbox</h1>
          </div>
          <Chips
            label="Status"
            value={filter}
            onChange={(f) => (setFilter(f), setPicked(null))}
            options={[
              { value: "draft", label: "To review", n: count("draft") },
              { value: "approved", label: "Sent", n: count("approved") },
              { value: "discarded", label: "Discarded", n: count("discarded") },
            ]}
          />
        </div>

        {shown.length === 0 ? (
          <Panel className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-j-ai-soft text-j-ai">
              <Icon name="send" size={22} />
            </span>
            <b className="text-base">{filter === "draft" ? "Nothing waiting for review" : "Nothing here yet"}</b>
            <span className="max-w-[420px] text-sm text-j-muted">
              Drafts appear here when you request evidence, return a file, propose remediation or escalate from{" "}
              <Link href={c("/requirements")}>Requirements</Link>, <Link href={c("/evidence")}>Evidence</Link> or <Link href={c("/work")}>My work</Link>.
            </span>
          </Panel>
        ) : (
          <div className="flex flex-wrap items-start gap-3.5">
            <section aria-label="Drafts" className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
              {shown.map((d) => {
                const on = d.id === cur?.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPicked(d.id)}
                    className={cx("flex cursor-pointer flex-col gap-1.5 rounded-2xl border-[1.5px] bg-white p-4 text-left text-j-ink", on ? "border-cx" : "border-j-line hover:border-cx-line")}
                  >
                    <span className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-j-ai">{DRAFT_LABEL[d.kind]}</span>
                      <span className="font-mono text-j-muted">{d.id}</span>
                    </span>
                    <span className="text-sm font-semibold">{d.title}</span>
                    <span className="text-xs text-j-muted">
                      To {d.recipients} · {d.decidedAt ?? d.createdAt}
                    </span>
                  </button>
                );
              })}
            </section>

            {cur && (
              <Panel className="flex min-w-0 flex-[2_1_560px] flex-col gap-4 p-[22px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Pill tone="ai">{DRAFT_LABEL[cur.kind]}</Pill>
                    <Pill tone={STATUS[cur.status][1]}>{STATUS[cur.status][0]}</Pill>
                    {cur.decidedBy && (
                      <span className="text-xs text-j-muted">
                        by {cur.decidedBy} · {cur.decidedAt}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-xs text-j-muted">{cur.id}</span>
                </div>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  Subject
                  <input value={cur.title} disabled={!editable} onChange={(e) => ws.editDraft(cur.id, { title: e.target.value })} className={cx(inputClass, "disabled:bg-j-canvas")} />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  To
                  <input value={cur.recipients} disabled={!editable} onChange={(e) => ws.editDraft(cur.id, { recipients: e.target.value })} className={cx(inputClass, "disabled:bg-j-canvas")} />
                </label>
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  Message
                  <textarea
                    rows={10}
                    value={cur.body}
                    disabled={!editable}
                    onChange={(e) => ws.editDraft(cur.id, { body: e.target.value })}
                    className="rounded-xl border border-j-line p-3 font-sans text-sm leading-6 font-normal text-j-ink disabled:bg-j-canvas"
                  />
                </label>
                {cur.codes.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                    <span className="text-j-muted">Requirements</span>
                    {cur.codes.slice(0, 12).map((code) => (
                      <Link key={code} href={c(`/requirements/${code}`)} className="rounded-md bg-cx-soft px-1.5 py-0.5 font-mono text-xs text-cx no-underline">
                        {code}
                      </Link>
                    ))}
                    {cur.codes.length > 12 && <span className="text-xs text-j-muted">+{cur.codes.length - 12} more</span>}
                  </div>
                )}
                {editable && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-j-line-soft pt-4">
                    <span className="flex max-w-[460px] items-start gap-2 text-[13px] text-j-ink-3">
                      <Icon name="eye" size={15} className="mt-0.5 flex-none text-j-ai" />
                      {APPROVE_EFFECT[cur.kind]}
                    </span>
                    <span className="flex gap-2">
                      <JButton onClick={() => decide(cur, "discard")}>Discard</JButton>
                      <JButton variant="primary" onClick={() => decide(cur, "approve")}>
                        <Icon name="send" size={15} />
                        Approve and send
                      </JButton>
                    </span>
                  </div>
                )}
              </Panel>
            )}
          </div>
        )}
      </JMain>
    </ClientShell>
  );
}
