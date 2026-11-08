"use client";

import { useCurrentClient } from "./shell";
import { Avatar, Bar, JButton, Panel, PanelHead, Pill, type PillTone } from "./ui";
import { cx } from "@/components/ui";
import { useJourney, useScreenState } from "@/lib/journey/store";

// Engagement section of the entity profile: contract lifecycle, deliverables, the
// consultant/client split and the client's access grant.

const LIFE: [string, string][] = [
  ["Draft", "2 Jun"],
  ["Client signed", "9 Jun"],
  ["Active", "since 10 Jun"],
  ["Closing", "handover"],
  ["Closed", "revoked"],
];

interface Deliverable {
  name: string;
  pct: number;
  due: string;
  late: boolean;
  av: string;
}

const DELIVERABLES: Deliverable[] = [
  { name: "Gap assessment", pct: 100, due: "Done 30 Jun", late: false, av: "SR" },
  { name: "Evidence pack", pct: 100, due: "Done 15 Sep", late: false, av: "MK" },
  { name: "Submission pack", pct: 64, due: "Due 20 Nov", late: false, av: "SR" },
  { name: "Remediation plan", pct: 40, due: "Due 10 Nov", late: true, av: "YT" },
  { name: "Cycle closure report", pct: 0, due: "Due Jan 2027", late: false, av: "SR" },
];

const WHO: Record<string, [string, PillTone]> = { P: ["Consultant", "cx"], E: ["Client", "ok"], B: ["Both", "ai"] };
const SPLIT: [string, string][] = [
  ["Request evidence", "P"],
  ["Supply evidence", "E"],
  ["AI assessment", "P"],
  ["L1 review", "P"],
  ["Final acceptance", "E"],
  ["DGA submission", "E"],
  ["Clarification drafts", "P"],
  ["Remediation delivery", "B"],
];

const TEAM = [
  { av: "SR", name: "Sami R.", role: "Lead" },
  { av: "MK", name: "Mohammed K.", role: "Consultant" },
  { av: "YT", name: "Yasser T.", role: "Consultant" },
  { av: "RN", name: "Rana N.", role: "Quality reviewer" },
];

const ATTEST: [string, string][] = [
  ["NDA", "ECC 4-1"],
  ["Data removal", "ECC 4-1"],
  ["Incident comms", "ECC 4-1"],
  ["Client policies", "ECC 4-1-2"],
  ["Risk assessed", "ECC 4-1-3"],
  ["In-Kingdom", "ECC 4-1-3-2"],
  ["No COI", "Conflict of interest"],
  ["PDPL DPA", "PDPL processor"],
];

interface EngState {
  stage: number;
  renewal: boolean;
  confirmHandover: boolean;
  done: string[];
}

export function EngagementBody() {
  const client = useCurrentClient();
  const { log } = useJourney();
  const [s, set] = useScreenState<EngState>(`engagement.${client.id}`, { stage: 2, renewal: false, confirmHandover: false, done: [] });
  const dels = DELIVERABLES.map((d) => (s.done.includes(d.name) ? { ...d, pct: 100, due: "Done today", late: false } : d));
  const doneCount = dels.filter((d) => d.pct === 100).length;
  const daysLeft = 214;

  return (
    <div className="flex flex-col gap-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[13px] text-j-muted">ENG-0142 · CT-2025-087</span>
            <h2 className="m-0 text-xl">Engagement · {client.frameworks.join(" + ")}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {s.stage >= 3 ? (
              <Pill tone="warn">Handover started</Pill>
            ) : s.confirmHandover ? (
              <span className="flex items-center gap-2 rounded-xl border border-[#F0DDB0] bg-[#FFF8EA] px-3 py-1.5 text-[13px]">
                Start handover? Access ends when it closes.
                <JButton
                  size="sm"
                  variant="dark"
                  onClick={() => {
                    set((d) => {
                      d.stage = 3;
                      d.confirmHandover = false;
                    });
                    log(`Handover started · ${client.name}`);
                  }}
                >
                  Confirm
                </JButton>
                <JButton size="sm" variant="ghost" onClick={() => set((d) => void (d.confirmHandover = false))}>
                  Cancel
                </JButton>
              </span>
            ) : (
              <JButton onClick={() => set((d) => void (d.confirmHandover = true))}>Start handover</JButton>
            )}
            {s.renewal ? (
              <Pill tone="cx">Renewal requested from Noura A.</Pill>
            ) : (
              <JButton
                variant="primary"
                onClick={() => {
                  set((d) => void (d.renewal = true));
                  log(`Renewal requested · ${client.name}`);
                }}
              >
                Request renewal
              </JButton>
            )}
          </div>
        </div>

        <ol aria-label="Lifecycle" className="m-0 flex list-none flex-wrap gap-0 rounded-[20px] border border-j-line bg-white p-[18px]">
          {LIFE.map(([label, date], i) => {
            const done = i < s.stage;
            const on = i === s.stage;
            return (
              <li key={label} aria-current={on ? "step" : undefined} className="flex min-w-[160px] flex-1 items-center gap-2.5">
                <span className={cx("flex h-8 w-8 flex-none items-center justify-center rounded-full text-[13px] font-bold", done ? "bg-cx text-white" : on ? "bg-cx-soft text-cx" : "bg-[#F5F7F9] text-j-muted")}>
                  {done ? "✓" : i + 1}
                </span>
                <span className="flex flex-col leading-[17px]">
                  <b className={cx("text-sm", on ? "text-cx" : "text-j-ink")}>{label}</b>
                  <span className="text-xs text-j-muted">{date}</span>
                </span>
                {i < 4 && <span className={cx("mx-2 h-0.5 flex-auto", done ? "bg-cx" : "bg-[#E3E8EF]")} />}
              </li>
            );
          })}
        </ol>

        <div className="flex flex-wrap gap-3.5">
          <div className="flex min-w-0 flex-[2_1_560px] flex-col [&>:last-child]:flex-auto gap-3.5">
            <Panel className="flex flex-col gap-3 p-[22px]">
              <PanelHead
                title="Deliverables"
                aside={
                  <span className="text-[13px] text-j-muted">
                    <b className="text-j-ink">{doneCount}</b> of {dels.length} done
                  </span>
                }
              />
              {dels.map((d) => {
                const done = d.pct === 100;
                return (
                  <div key={d.name} className="flex items-center gap-3 border-b border-j-line-soft pb-3 last:border-0 last:pb-0">
                    <span className={cx("flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold text-brand", done ? "bg-[#E7F3ED]" : "bg-[#F5F7F9]")}>{done ? "✓" : ""}</span>
                    <span className="flex min-w-0 flex-auto flex-col gap-1.5">
                      <span className="flex justify-between gap-2 text-sm">
                        <b>{d.name}</b>
                        <span className={cx("text-xs", d.late ? "font-semibold text-j-bad" : "text-j-muted")}>{d.due}</span>
                      </span>
                      <Bar pct={d.pct} color={done ? "#1F9D6E" : "#1E4E8C"} />
                    </span>
                    {!done && d.pct > 0 && (
                      <JButton
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          set((x) => void x.done.push(d.name));
                          log(`Deliverable delivered · ${d.name}`);
                        }}
                      >
                        Mark delivered
                      </JButton>
                    )}
                    <Avatar initials={d.av} size={28} />
                  </div>
                );
              })}
            </Panel>
            <Panel className="flex flex-col gap-3 p-[22px]">
              <h2 className="m-0 text-base">Who does what</h2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
                {SPLIT.map(([task, k]) => (
                  <div key={task} className="flex items-center justify-between gap-2 rounded-xl border border-j-line-soft px-3 py-2.5 text-sm">
                    <span>{task}</span>
                    <Pill tone={WHO[k][1]}>{WHO[k][0]}</Pill>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <aside className="flex min-w-0 flex-[1_1_300px] flex-col [&>:last-child]:flex-auto gap-3.5">
            <section className="flex flex-col gap-3 rounded-[20px] bg-cx-deep p-[22px] text-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold tracking-[0.06em] text-cx-line">CLIENT ACCESS</span>
                <Pill tone={s.stage >= 3 ? "warn" : "ok"}>{s.stage >= 3 ? "Closing" : "Active"}</Pill>
              </div>
              <div className="flex items-baseline gap-2">
                <b className="text-[40px] leading-[44px]">{daysLeft}</b>
                <span className="text-sm text-cx-line">days left</span>
              </div>
              <Bar pct={(daysLeft / 365) * 100} color="#FFFFFF" track="#2A3F5E" />
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                {[
                  ["Scope", "Qiyas 2026 · C1–C2"],
                  ["Data level", "Up to Restricted"],
                  ["Final acceptance", "Client only"],
                  ["Approved by", "Noura A."],
                ].map(([k, v]) => (
                  <span key={k}>
                    <span className="text-cx-line">{k}</span>
                    <br />
                    <b>{v}</b>
                  </span>
                ))}
              </div>
            </section>
            <Panel className="flex flex-col gap-2.5 p-[22px]">
              <h2 className="m-0 text-base">Team</h2>
              {TEAM.map((t) => (
                <div key={t.av} className="flex items-center gap-2.5 text-sm">
                  <Avatar initials={t.av} />
                  <b className="flex-auto">{t.name}</b>
                  <span className="text-[13px] text-j-muted">{t.role}</span>
                </div>
              ))}
            </Panel>
            <Panel className="flex flex-col gap-3 p-[22px]">
              <PanelHead title="NCA ECC 4-1 checks" aside={<Pill tone="ok">8 / 8</Pill>} />
              <div className="flex flex-wrap gap-1.5">
                {ATTEST.map(([l, ref]) => (
                  <span key={l} title={ref} className="rounded-lg bg-[#E7F3ED] px-2.5 py-1 text-xs font-semibold text-brand">
                    ✓ {l}
                  </span>
                ))}
              </div>
            </Panel>
          </aside>
        </div>
    </div>
  );
}
