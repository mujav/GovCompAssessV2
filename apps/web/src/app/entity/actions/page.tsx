"use client";

import { useState } from "react";
import { Main, PageHeader } from "@/components/workspace-shell";
import { Button, Card, TabBar } from "@/components/ui";

const T = {
  esc: ["ESCALATE", "#FBE4E1", "#A3261B"],
  req: ["REQUEST EVIDENCE", "#E2EFE9", "#0E5A45"],
  upd: ["REQUEST UPDATE", "#FBEFD9", "#8A4B00"],
  ret: ["RETURN", "#FBEFD9", "#8A4B00"],
  rem: ["REMINDER", "#ECEEEC", "#33403A"],
  cla: ["CLARIFICATION", "#E8ECF3", "#3E4B63"],
  ini: ["INITIATIVE", "#EEEDFB", "#3F37A8"],
} as const;

const actions: [keyof typeof T, string, string, string, string][] = [
  ["esc", "Rule ESC-02", "Due now", "Escalate Human Capital: 7 overdue actions", "4 requirements · −3.1 pts · 2 reminders each"],
  ["req", "AI briefing", "Due 04 Nov", "Request integration samples for 5.11.2-2", "IT Operations · Faisal K. · 3 missing items pre-filled"],
  ["ret", "Validation failed", "Today", "Return 4 files for correction", "Wrong period ×2, missing signature, unreadable scan · bulk preview"],
  ["upd", "DGA clarification CL-014", "Due 08 Nov", "Request current-cycle samples for 4 accepted items", "Will reopen acceptance on response"],
  ["rem", "Rule REM-01", "Due 03 Nov", "Remind Strategy & Performance (2.2.3-4)", "Reminder 1 of 2 · committee minutes"],
  ["cla", "Reviewer", "Draft", "Ask DGA whether a staging sample is acceptable", "Affects 5.11.2-2, 5.11.1-1"],
  ["ini", "Gap analysis", "Proposal", "Convert 4.1.2 into a digital skills initiative", "Structural gap · 3 requirements · sponsor needed"],
];

const CATALOG = [
  "Request evidence",
  "Request update",
  "Return for correction",
  "Send reminder",
  "Assign remediation",
  "Escalate",
  "Request clarification",
  "Schedule review",
  "Create initiative",
  "Close action",
  "Prepare submission",
  "Executive update",
];

const TABS = [
  { label: "Recommended", count: 9 },
  { label: "Awaiting my approval", count: 4 },
  { label: "Open", count: 141 },
  { label: "Overdue", count: 23, countTone: "bad" as const },
  { label: "Sent & interactions" },
];

const EN_DRAFT = `Seven Qiyas remediation actions owned by Human Capital are overdue by an average of 12 days, with no update after two reminders.

Together they affect 4 requirements in the Human capital domain (projected impact −3.1 points) and two of them block submission on 20 Nov.

Decision requested: nominate an accountable owner for ACT-118 and ACT-121 and confirm revised dates by 03 Nov, or approve converting 4.1.2 into a funded initiative.`;

const AR_DRAFT = `تأخرت سبعة إجراءات تصحيحية لمؤشر قياس تابعة لإدارة رأس المال البشري بمتوسط ١٢ يومًا دون أي تحديث بعد تذكيرين.

تؤثر هذه الإجراءات على ٤ متطلبات في محور رأس المال البشري (أثر متوقع −٣٫١ نقطة)، ويعيق اثنان منها التسليم في ٢٠ نوفمبر.

القرار المطلوب: تسمية مسؤول للإجراءين ACT-118 و ACT-121 وتأكيد المواعيد المعدّلة قبل ٣ نوفمبر.`;

const inputCls = "h-11 rounded-lg border border-field px-2.5 text-sm font-normal";

export default function ActionCenterPage() {
  const [tab, setTab] = useState(0);
  const [sel, setSel] = useState(0);
  const [lang, setLang] = useState<"en" | "ar">("en");
  const en = lang === "en";

  return (
    <>
      <PageHeader
        crumb="Workspace / Action Center"
        title="Action Center"
        actions={
          <>
            <Button>Log interaction</Button>
            <Button variant="primary" className="px-4">
              New action ▾
            </Button>
          </>
        }
      />
      <Main wide className="pt-5">
        <TabBar label="Action views" tabs={TABS} active={tab} onSelect={setTab} className="border-b border-line" />

        <div className="flex flex-wrap items-start gap-4">
          <section aria-label="Recommended actions" className="flex min-w-0 flex-[1_1_400px] flex-col gap-2">
            {actions.map(([t, trigger, due, title, meta], i) => (
              <button
                key={title}
                type="button"
                onClick={() => setSel(i)}
                className="flex cursor-pointer flex-col gap-1.5 rounded-xl bg-white px-4 py-3.5 text-left text-ink"
                style={{ border: sel === i ? "2px solid #0E5A45" : "1px solid #DCE2DE" }}
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md px-2 py-0.5 text-[11px] font-bold tracking-[0.04em]" style={{ background: T[t][1], color: T[t][2] }}>
                    {T[t][0]}
                  </span>
                  <span className="rounded-md border border-field px-2 py-0.5 text-[11px] text-ink-2">{trigger}</span>
                  <span className="ml-auto text-[11px] text-muted">{due}</span>
                </span>
                <span className="text-sm leading-5 font-semibold">{title}</span>
                <span className="text-xs leading-[18px] text-muted">{meta}</span>
              </button>
            ))}
          </section>

          <section aria-label="Draft preview" className="flex min-w-0 flex-[999_1_520px] flex-col overflow-hidden rounded-[14px] border border-line bg-white">
            <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-line-soft px-5 py-4">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-bad-soft px-2 py-0.5 text-[11px] font-bold tracking-[0.04em] text-bad">ESCALATE</span>
                  <span className="text-xs font-semibold text-ai">Drafted by AI · needs your approval</span>
                </div>
                <h2 className="m-0 text-lg leading-[26px] font-semibold">Escalation pack · Human Capital overdue remediation</h2>
                <div className="text-xs text-muted">Rule ESC-02 matched 7 actions: overdue, no update, 2 reminders each · ACT-118, ACT-121, ACT-124 +4</div>
              </div>
              <div role="group" aria-label="Draft language" className="flex overflow-hidden rounded-lg border border-field">
                <button
                  type="button"
                  onClick={() => setLang("en")}
                  aria-pressed={en}
                  className="h-10 cursor-pointer border-0 px-3.5 text-[13px]"
                  style={{ background: en ? "#0E5A45" : "#FFFFFF", color: en ? "#FFFFFF" : "#14211C" }}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLang("ar")}
                  aria-pressed={!en}
                  lang="ar"
                  className="h-10 cursor-pointer border-0 px-3.5 text-[13px]"
                  style={{ background: en ? "#FFFFFF" : "#0E5A45", color: en ? "#14211C" : "#FFFFFF" }}
                >
                  العربية
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3 border-b border-line-soft px-5 py-4 text-[13px]">
              <label className="flex flex-col gap-1 font-semibold">
                To
                <input type="text" defaultValue="Executive Director, Human Capital" className={inputCls} />
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                Copy
                <input type="text" defaultValue="Assessment Manager · Department SPOC" className={inputCls} />
              </label>
              <label className="flex flex-col gap-1 font-semibold">
                Decision requested by
                <input type="text" defaultValue="03 Nov 2026" className={inputCls} />
              </label>
            </div>

            <div className="flex flex-col gap-2.5 px-5 py-4">
              {en ? (
                <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  Message
                  <textarea rows={9} defaultValue={EN_DRAFT} className="resize-y rounded-lg border border-field p-3 text-sm leading-[22px] font-normal" />
                </label>
              ) : (
                <label lang="ar" dir="rtl" className="flex flex-col gap-1.5 text-[13px] font-semibold">
                  نص الرسالة
                  <textarea rows={9} dir="rtl" defaultValue={AR_DRAFT} className="resize-y rounded-lg border border-field p-3 text-[15px] leading-[26px] font-normal" />
                </label>
              )}
              <div className="flex flex-col gap-1.5 rounded-[10px] bg-surface-2 px-3.5 py-3 text-[13px] leading-5">
                <b>Attached pack (generated from records)</b>
                <span>• Action history: created 18 Sep, reminders 14 Oct and 25 Oct, no response logged</span>
                <span>• Impact: 4 requirements, −3.1 pts, 2 submission blockers (calculation v3, 09:40)</span>
                <span>• Interaction log: 2 meetings, 1 attended</span>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap items-center justify-between gap-2.5 border-t border-line-soft bg-[#FAFBFA] px-5 py-3.5">
              <span className="flex-[1_1_260px] text-xs leading-[18px] text-muted">
                You can approve: Assessment Manager holds &ldquo;approve escalation&rdquo;. Nothing is sent until you confirm; the send is logged as an
                interaction.
              </span>
              <div className="flex flex-wrap gap-2">
                <Button>Dismiss with reason</Button>
                <Button>Schedule review instead</Button>
                <Button variant="primary" className="px-4">
                  Approve and send
                </Button>
              </div>
            </div>
          </section>
        </div>

        <Card className="flex flex-col gap-2.5 px-5 py-4">
          <h2 className="m-0 text-[15px] font-semibold">Start an action</h2>
          <div className="flex flex-wrap gap-2">
            {CATALOG.map((c) => (
              <Button key={c} size="md">
                {c}
              </Button>
            ))}
          </div>
          <div className="text-xs text-muted">
            Catalog, required fields and approval rules come from Admin Studio › Action Catalog. Buttons you cannot use are hidden by role.
          </div>
        </Card>
      </Main>
    </>
  );
}
