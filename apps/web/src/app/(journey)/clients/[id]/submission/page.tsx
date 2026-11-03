"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/journey/icon";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Avatar, Bar, JButton, Panel, PanelHead, Pill, Segmented, type PillTone } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { SUBMISSION_DEADLINE, daysBetween, shortDate } from "@/lib/workspace/data";
import { clientHref } from "@/lib/journey/portfolio";
import { useScreenState } from "@/lib/journey/store";
import { NO_SUBMISSION, submissionKey, type SubmissionState } from "@/lib/journey/submission";
import { useClientWork } from "@/lib/journey/use-work";
import { initials, stageCounts, stageOf } from "@/lib/journey/work";
import { useAuth } from "@/lib/auth/store";

// 13 · Submission pack. Gates, blockers and contents of the pack; the index owner signs it off
// and records the portal upload. Nothing is submitted without that sign-off.

export default function SubmissionPage() {
  const router = useRouter();
  const { client, ws, framework, workspace, reqs, overlay, log } = useClientWork();
  const { user } = useAuth();
  const me = user?.name ?? "Index owner";
  const [s, set] = useScreenState<SubmissionState>(submissionKey(client.id, framework?.id), NO_SUBMISSION);
  const [confirm, setConfirm] = useState(false);
  const c = (p: string) => clientHref(client.id, p);
  const today = ws.ctx.today;
  const daysLeft = daysBetween(today, SUBMISSION_DEADLINE);

  const m = useMemo(() => {
    const total = reqs.length;
    const n = stageCounts(reqs, overlay);
    const submitted = n.rev + n.acc;
    const expected = reqs.reduce((a, r) => a + r.evidence.expected, 0);
    const valid = reqs.reduce((a, r) => a + r.evidence.valid, 0);
    const mandatory = reqs.filter((r) => r.weight === "high" && r.status !== "na");
    const mandatoryOk = mandatory.filter((r) => r.evidence.valid >= r.evidence.expected && !r.mandatoryFail);
    const mandatoryMissing = mandatory.filter((r) => !mandatoryOk.includes(r));
    const cla = workspace ? ws.ctx.clarifications.length : 0;
    const pct = (a: number, b: number) => (b ? (a / b) * 100 : 100);
    const notAccepted = total - n.acc;
    const gate = (l: string, v: string, pct: number, ok: boolean) => ({ l, v, pct, ok });
    const gates = [
      gate("Accepted", `${n.acc} / ${total}`, pct(n.acc, total), n.acc === total),
      gate("Submitted by control owners", `${submitted} / ${total}`, pct(submitted, total), submitted === total),
      gate("Evidence valid", `${Math.round(pct(valid, expected))}%`, pct(valid, expected), pct(valid, expected) >= 95),
      gate("Mandatory items", `${mandatoryOk.length} / ${mandatory.length}`, pct(mandatoryOk.length, mandatory.length), mandatoryOk.length === mandatory.length),
      gate("Clarifications applied", `${cla} / ${cla}`, 100, true),
    ];
    const blockers: { t: string; sub: string; c: string; cta: string; href: string }[] = [];
    if (notAccepted) blockers.push({ t: `${notAccepted} requirements not yet accepted`, sub: `${n.rev} waiting for your review`, c: "#D9442E", cta: "My work", href: c("/work") });
    if (mandatoryMissing.length)
      blockers.push({ t: `${mandatoryMissing.length} mandatory items missing evidence`, sub: mandatoryMissing.slice(0, 3).map((r) => r.code).join(" · ") + (mandatoryMissing.length > 3 ? " …" : ""), c: "#D9442E", cta: "Evidence", href: c("/evidence") });
    if (n.rev) blockers.push({ t: `${n.rev} reviews open`, sub: "Oldest 4 days", c: "#E0A100", cta: "Reviews", href: c("/work") });
    const narratives = reqs.filter((r) => stageOf(r, overlay) !== "start").length;
    if (narratives < total) blockers.push({ t: `${total - narratives} Arabic narratives not drafted`, sub: "Needed for the DGA template", c: "#E0A100", cta: "Requirements", href: c("/requirements?stage=start") });
    const files = valid * 4 + 20;
    const pack: { ext: string; t: string; sub: string; st: [string, PillTone] }[] = [
      { ext: "XLS", t: "Self-assessment workbook", sub: `${total} rows · DGA template 2026`, st: n.acc === total ? ["Ready", "ok"] : ["Building", "cx"] },
      { ext: "PDF", t: "Evidence index", sub: `${files.toLocaleString("en-US")} files · cross-referenced`, st: ["Ready", "ok"] },
      { ext: "DOC", t: "Narratives · Arabic", sub: `${narratives} of ${total}`, st: narratives === total ? ["Ready", "ok"] : ["Building", "cx"] },
      { ext: "ZIP", t: "Evidence batches", sub: "12 batches · 3.2 GB", st: ["Ready", "ok"] },
      { ext: "PDF", t: "Cover letter", sub: "Signed by the index owner", st: s.signed ? ["Ready", "ok"] : ["Waiting", "warn"] },
    ];
    return { total, n, gates, blockers, pack, files };
  }, [reqs, overlay, ws, s.signed, client.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cur = s.submittedAt ? 5 : s.signed ? 3 : m.n.acc === m.total ? 2 : 1;
  const steps: [string, string][] = [
    ["Prepare pack", "Index owner"],
    ["Reviews complete", "Index owner"],
    ["Sign-off", "Index owner"],
    ["Portal upload", s.uploader === 0 ? "Index owner" : "Delegated"],
    ["Submitted", "DGA receipt"],
  ];
  const EXT: Record<string, [string, string]> = { XLS: ["#E7F3ED", "#0E5A45"], PDF: ["#FDECEA", "#B42318"], DOC: ["#EAF1FA", "#1E4E8C"], ZIP: ["#F5F7F6", "#33413B"] };

  const record = () => {
    const now = new Date();
    set((d) => {
      d.submittedAt = `${now.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
      d.receipt = `QY26-${client.ini}-${String(4800 + (now.getMinutes() * 7 + now.getSeconds()) % 200).padStart(6, "0")}`;
      d.frozen = { total: m.total, accepted: m.n.acc, files: m.files };
    });
    log(`Submission recorded for ${client.name}`);
    router.push(c("/submitted"));
  };

  return (
    <ClientShell>
      <JMain>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Submission pack</h1>
            <Pill tone="warn">
              Portal closes {shortDate(SUBMISSION_DEADLINE)} · {daysLeft} d
            </Pill>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <JButton onClick={() => window.print()}>Preview pack</JButton>
            {s.signed ? (
              <JButton variant="primary" disabled aria-disabled="true">
                <Icon name="check" size={15} />
                Signed off
              </JButton>
            ) : confirm ? (
              <span className="flex flex-wrap items-center gap-2 rounded-xl border border-[#F0DDB0] bg-[#FFF8EA] px-3 py-1.5 text-[13px]">
                {m.blockers.length ? `${m.blockers.length} blockers are still open. Sign off anyway?` : "Sign off the pack for submission?"}
                <JButton
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    set((d) => {
                      d.requested = true;
                      d.signed = true;
                      d.signedBy = me;
                    });
                    setConfirm(false);
                    log(`${me} signed off the ${client.name} pack`);
                  }}
                >
                  Sign off
                </JButton>
                <JButton size="sm" variant="ghost" onClick={() => setConfirm(false)}>
                  Cancel
                </JButton>
              </span>
            ) : (
              <JButton variant="primary" onClick={() => setConfirm(true)}>
                <Icon name="check" size={15} />
                Sign off the pack
              </JButton>
            )}
          </div>
        </div>

        <ol aria-label="Submission steps" className="m-0 flex list-none flex-wrap rounded-[20px] border border-j-line bg-white p-[18px]">
          {steps.map(([l, who], i) => {
            const done = i < cur;
            const on = i === cur;
            return (
              <li key={l} aria-current={on ? "step" : undefined} className="flex min-w-[150px] flex-1 items-center gap-2.5 py-1">
                <span className={cx("flex h-8 w-8 flex-none items-center justify-center rounded-full text-[13px] font-bold", done ? "bg-cx text-white" : on ? "bg-cx-soft text-cx" : "bg-j-canvas text-j-muted")}>{done ? "✓" : i + 1}</span>
                <span className="text-sm leading-[17px]">
                  <b className={on ? "text-cx" : "text-j-ink"}>{l}</b>
                  <br />
                  <span className="text-xs text-j-muted">{who}</span>
                </span>
                {i < steps.length - 1 && <span className={cx("mx-2 h-0.5 flex-auto", done ? "bg-cx" : "bg-j-line")} />}
              </li>
            );
          })}
        </ol>

        <section className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-2.5">
          {m.gates.map((g) => (
            <div key={g.l} className={cx("flex flex-col gap-2 rounded-2xl border bg-white p-4", g.ok ? "border-j-line" : "border-[#F0DDB0]")}>
              <span className="flex items-center justify-between text-[13px] text-j-ink-2">
                {g.l}
                <span className={cx("flex h-5 w-5 items-center justify-center rounded-full text-white", g.ok ? "bg-j-ok" : "bg-j-warn")}>
                  <Icon name={g.ok ? "check" : "flag"} size={11} strokeWidth={2.6} />
                </span>
              </span>
              <b className="text-[22px]">{g.v}</b>
              <Bar pct={g.pct} color={g.ok ? "#1F9D6E" : "#E0A100"} />
            </div>
          ))}
        </section>

        <div className="flex flex-wrap items-start gap-3.5">
          <div className="flex min-w-0 flex-[2_1_560px] flex-col gap-3.5">
            <Panel className="flex flex-col gap-1 p-[22px]">
              <PanelHead title="Blockers" aside={<Pill tone={m.blockers.length ? "bad" : "ok"}>{m.blockers.length}</Pill>} className="mb-2" />
              {m.blockers.map((b) => (
                <div key={b.t} className="flex items-center gap-3 border-b border-j-line-soft py-3 last:border-0">
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: b.c }} />
                  <span className="flex-auto text-sm">
                    <b>{b.t}</b>
                    <br />
                    <span className="font-mono text-xs text-j-muted">{b.sub}</span>
                  </span>
                  <Link href={b.href} className="text-[13px] font-semibold text-cx">
                    {b.cta} →
                  </Link>
                </div>
              ))}
              {m.blockers.length === 0 && <p className="m-0 text-sm text-j-muted">No blockers. The pack is ready for sign-off.</p>}
            </Panel>
            <Panel className="flex flex-col gap-1 p-[22px]">
              <h2 className="m-0 mb-2 text-base">Pack contents</h2>
              {m.pack.map((p) => (
                <div key={p.t} className="flex items-center gap-3 border-b border-j-line-soft py-3 last:border-0">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg text-[10px] font-bold" style={{ background: EXT[p.ext][0], color: EXT[p.ext][1] }}>
                    {p.ext}
                  </span>
                  <span className="flex-auto text-sm">
                    <b>{p.t}</b>
                    <br />
                    <span className="text-xs text-j-muted">{p.sub}</span>
                  </span>
                  <Pill tone={p.st[1]}>{p.st[0]}</Pill>
                </div>
              ))}
            </Panel>
          </div>

          <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5">
            <Panel className="flex flex-col gap-3 p-[22px]">
              <PanelHead title="Sign-off" aside={<Pill tone={s.signed ? "ok" : "gray"}>{s.signed ? "Signed" : "Not signed"}</Pill>} />
              <div className="flex items-center gap-2.5 text-sm">
                <Avatar initials={initials(s.signedBy ?? me)} />
                <span className="flex-auto">
                  <b>{s.signedBy ?? me}</b>
                  <br />
                  <span className="text-xs text-j-muted">Index owner</span>
                </span>
                <span className={cx("text-xs font-semibold", s.signed ? "text-brand" : "text-j-muted")}>{s.signed ? "Signed" : "—"}</span>
              </div>
              <span className="text-xs text-j-muted">The index owner&apos;s review is the only review layer; signing off confirms the pack is ready for the portal.</span>
            </Panel>
            <Panel className="flex flex-col gap-3 p-[22px]">
              <h2 className="m-0 text-base">Portal upload</h2>
              <Segmented
                label="Uploaded by"
                value={String(s.uploader) as "0" | "1"}
                options={[
                  { value: "0", label: "Index owner uploads" },
                  { value: "1", label: "Delegated upload" },
                ]}
                onChange={(v) => set((d) => void (d.uploader = v === "1" ? 1 : 0))}
              />
              <span className="flex justify-between text-sm">
                <span className="text-j-muted">Batches</span>
                <b>{s.submittedAt ? "12" : "0"} / 12 · 3.2 GB</b>
              </span>
              <span className="flex justify-between text-sm">
                <span className="text-j-muted">Delegation letter</span>
                <b className={s.uploader ? "text-brand" : "text-j-muted"}>{s.uploader ? "Signed · 2 Nov" : "Not needed"}</b>
              </span>
              <JButton variant="primary" disabled={!s.signed} onClick={record} title={s.signed ? undefined : "Needs sign-off first"}>
                Record submission
              </JButton>
              {!s.signed && <span className="text-xs text-j-muted">Available after sign-off.</span>}
              {s.submittedAt && (
                <Link href={c("/submitted")} className="text-[13px] font-semibold text-cx">
                  View receipt →
                </Link>
              )}
            </Panel>
          </aside>
        </div>
      </JMain>
    </ClientShell>
  );
}
