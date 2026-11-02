"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/journey/icon";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Avatar, JButton, JLink, Panel, Pill, inputClass, type PillTone } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { clientHref } from "@/lib/journey/portfolio";
import { useScreenState } from "@/lib/journey/store";
import { useClientWork } from "@/lib/journey/use-work";
import { STAGE_OF, stageOf } from "@/lib/journey/work";

// 12 · Clarifications. Questions to the DGA, their answers, and the effect of applying an
// answer to the requirements it touches. Applying is a preview first, then one confirm.

type Status = "ans" | "sub" | "draft" | "done";
const STATUS: Record<Status, [string, PillTone, string]> = {
  ans: ["Answered", "cx", "#2F6FB0"],
  sub: ["Awaiting DGA", "warn", "#E0A100"],
  draft: ["Draft", "draft", "#C9D1CD"],
  done: ["Applied", "ok", "#1F9D6E"],
};

interface Cl {
  id: string;
  status: Status;
  q: string;
  affects: string[];
  when: string;
  said?: string;
  meaning?: string;
}

export default function ClarificationsPage() {
  const { client, ws, reqs, overlay, move, log } = useClientWork();
  const c = (p: string) => clientHref(client.id, p);
  const base = ws.ctx.clarifications[0];
  const pick = (n: number, from: number) => reqs.slice(from, from + n).map((r) => r.code);
  const seed: Cl[] = [
    {
      id: base.id,
      status: "ans",
      q: "Is a prior-cycle sample valid for unchanged integrations?",
      affects: base.affects,
      when: "24 Oct",
      said: "يجب أن يكون النموذج التطبيقي من الدورة الحالية، ولا يُقبل نموذج الدورة السابقة.",
      meaning: base.title + ", even for unchanged systems.",
    },
    { id: "CL-015", status: "sub", q: "Does a staging transaction count?", affects: pick(2, 40), when: "8 days waiting" },
    { id: "CL-016", status: "draft", q: "Is 5.7.1 not applicable for shared hosting?", affects: pick(1, 120), when: "AI draft" },
    { id: "CL-012", status: "done", q: "Approval level for the data policy", affects: pick(3, 200), when: "2 Oct", said: "تكفي موافقة رئيس الجهة.", meaning: "Approval by the head of the entity is enough." },
  ];
  const [s, set] = useScreenState<{ list: Cl[]; sel: number }>(`clar.${client.id}`, { list: seed, sel: 0 });
  const [preview, setPreview] = useState(false);
  const [asking, setAsking] = useState(false);
  const [q, setQ] = useState("");
  const [codes, setCodes] = useState("");
  const cur = s.list[s.sel] ?? s.list[0];

  const impact = cur.affects.map((code) => {
    const r = reqs.find((x) => x.code === code);
    const st = r ? stageOf(r, overlay) : "start";
    const reopen = st === "acc" || st === "cli";
    return { code, st, reopen, title: r?.title ?? code };
  });
  const reopenN = impact.filter((i) => i.reopen).length;

  const apply = () => {
    const re = impact.filter((i) => i.reopen).map((i) => i.code);
    const flag = impact.filter((i) => !i.reopen && i.st !== "rev").map((i) => i.code);
    move(re, "prog");
    move(flag, "rev");
    if (re.length) ws.createDraft("evidence-request", re);
    set((d) => void (d.list[d.sel].status = "done"));
    log(`Applied ${cur.id}: ${re.length} reopened, ${flag.length} flagged for review`);
    setPreview(false);
  };

  return (
    <ClientShell>
      <JMain>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Clarifications</h1>
          <JButton variant="primary" onClick={() => setAsking(true)}>
            <Icon name="cla" size={15} />
            Ask the DGA
          </JButton>
        </div>

        {asking && (
          <Panel className="flex flex-col gap-3 p-[22px]">
            <h2 className="m-0 text-base">New question for the DGA</h2>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
              Question
              <input value={q} onChange={(e) => setQ(e.target.value)} className={inputClass} placeholder="What do you need the DGA to confirm?" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
              Affected requirements
              <input value={codes} onChange={(e) => setCodes(e.target.value)} className={cx(inputClass, "font-mono")} placeholder="e.g. 5.11.2-2, 5.3.1-1" />
            </label>
            <div className="flex gap-2">
              <JButton
                variant="primary"
                disabled={!q.trim()}
                onClick={() => {
                  const affects = codes
                    .split(/[\s,]+/)
                    .map((x) => x.trim())
                    .filter((x) => reqs.some((r) => r.code === x));
                  set((d) => {
                    d.list.unshift({ id: `CL-0${17 + d.list.length - 4}`, status: "draft", q: q.trim(), affects, when: "Draft · client sends" });
                    d.sel = 0;
                  });
                  log(`Drafted clarification: ${q.trim()}`);
                  setQ("");
                  setCodes("");
                  setAsking(false);
                }}
              >
                Save draft
              </JButton>
              <JButton variant="ghost" onClick={() => setAsking(false)}>
                Cancel
              </JButton>
            </div>
          </Panel>
        )}

        <div className="flex flex-wrap items-start gap-3.5">
          <section aria-label="Register" className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
            {s.list.map((x, i) => {
              const on = s.sel === i;
              const [label, , dot] = STATUS[x.status];
              return (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    set((d) => void (d.sel = i));
                    setPreview(false);
                  }}
                  className={cx("flex cursor-pointer flex-col gap-1.5 rounded-2xl border-[1.5px] bg-white p-4 text-left text-j-ink", on ? "border-cx" : "border-j-line")}
                >
                  <span className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-mono font-semibold">{x.id}</span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-j-ink-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
                      {label}
                    </span>
                  </span>
                  <span className="text-sm font-semibold">{x.q}</span>
                  <span className="text-xs text-j-muted">
                    {x.affects.length} affected · {x.when}
                  </span>
                </button>
              );
            })}
          </section>

          <Panel aria-label="Detail" className="flex min-w-0 flex-[2_1_560px] flex-col gap-4 p-[22px]">
            <div className="flex flex-col gap-2">
              <span className="flex gap-1.5">
                <Pill tone="dark" round={false} className="font-mono">
                  {cur.id}
                </Pill>
                <Pill tone={STATUS[cur.status][1]}>{cur.status === "ans" ? "Answered · not applied" : STATUS[cur.status][0]}</Pill>
              </span>
              <h2 className="m-0 text-xl">{cur.q}</h2>
              <span className="flex items-center gap-2 text-[13px] text-j-muted">
                <Avatar initials="FK" size={24} />
                {cur.said ? `Asked 11 Oct · answered ${cur.when}` : cur.when}
              </span>
            </div>

            {cur.said ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                <div className="flex flex-col gap-2 rounded-xl bg-j-canvas p-4">
                  <span className="flex justify-between text-[13px]">
                    <b>DGA said</b>
                    <a href="#original" className="text-cx">
                      Original ↗
                    </a>
                  </span>
                  <p lang="ar" dir="rtl" className="m-0 font-arabic text-sm leading-6">
                    {cur.said}
                  </p>
                </div>
                <div className="flex flex-col gap-2 rounded-xl border border-cx-line bg-cx-tint p-4">
                  <span className="flex justify-between text-[13px]">
                    <b>Our interpretation</b>
                    <span className="inline-flex items-center gap-1 font-semibold text-brand">
                      <Icon name="check" size={12} />
                      Approved
                    </span>
                  </span>
                  <p className="m-0 text-sm leading-6">{cur.meaning}</p>
                </div>
              </div>
            ) : (
              <p className="m-0 rounded-xl bg-j-canvas p-4 text-sm text-j-ink-3">
                {cur.status === "draft" ? "Draft question. The client sends it to the DGA from their workspace." : "Sent to the DGA. Nothing changes until an answer arrives."}
              </p>
            )}

            {cur.affects.length > 0 && (
              <div className="flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="m-0 text-sm">Impact · {cur.affects.length} requirements</h3>
                  <span className="flex gap-3 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-j-bad">
                      <span className="h-2 w-2 rounded-full bg-j-bad-mark" />
                      Reopens
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-j-ai">
                      <span className="h-2 w-2 rounded-full bg-j-ai" />
                      Flags review
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
                  {impact.map((i) => (
                    <Link
                      key={i.code}
                      href={c(`/requirements/${i.code}`)}
                      title={i.title}
                      className={cx("flex flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-j-ink no-underline hover:text-j-ink", preview ? (i.reopen ? "border-j-bad-mark bg-j-bad-soft" : "border-j-ai bg-j-ai-soft") : "border-j-line")}
                    >
                      <span className="font-mono text-[13px] font-semibold">{i.code}</span>
                      <span className="text-xs text-j-muted">{STAGE_OF[i.st].label}</span>
                      <span className={cx("text-xs font-semibold", i.reopen ? "text-j-bad" : "text-j-ai")}>{i.reopen ? "Reopens" : "Flags review"}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {cur.status === "ans" && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-j-line-soft pt-4">
                <span className="text-sm">
                  <b>{reopenN} reopen</b> · {reopenN} update requests
                </span>
                <div className="flex gap-2">
                  <JLink href="/studio/frameworks">Update guidance</JLink>
                  {preview ? (
                    <>
                      <JButton variant="ghost" onClick={() => setPreview(false)}>
                        Cancel
                      </JButton>
                      <JButton variant="primary" onClick={apply}>
                        Confirm and apply
                      </JButton>
                    </>
                  ) : (
                    <JButton variant="primary" onClick={() => setPreview(true)}>
                      Preview &amp; apply
                    </JButton>
                  )}
                </div>
              </div>
            )}
            {cur.status === "done" && (
              <p className="m-0 flex items-center gap-2 rounded-xl bg-[#E7F3ED] px-4 py-3 text-sm font-semibold text-brand">
                <Icon name="check" size={15} />
                Applied. Affected requirements were reopened or flagged for review.
              </p>
            )}
          </Panel>
        </div>
      </JMain>
    </ClientShell>
  );
}
