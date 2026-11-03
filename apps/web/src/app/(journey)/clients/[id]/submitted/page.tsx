"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/journey/icon";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Avatar, JButton, JLink, Panel, PanelHead } from "@/components/journey/ui";
import { SUBMISSION_DEADLINE, daysBetween } from "@/lib/workspace/data";
import { clientHref } from "@/lib/journey/portfolio";
import { useJourney, useScreenState } from "@/lib/journey/store";
import { NO_SUBMISSION, submissionKey, type SubmissionState } from "@/lib/journey/submission";
import { useClientWork } from "@/lib/journey/use-work";
import { initials } from "@/lib/journey/work";

// 14 · Submitted. Portal receipt, what went in, the sign-off trail and what comes next.

export default function SubmittedPage() {
  const { client, ws, framework } = useClientWork();
  const fwName = framework?.name ?? client.frameworks[0];
  const { log } = useJourney();
  const [s] = useScreenState<SubmissionState>(submissionKey(client.id, framework?.id), NO_SUBMISSION);
  const [sent, setSent] = useScreenState<boolean>(`submitted.${client.id}.report`, false);
  const c = (p: string) => clientHref(client.id, p);

  if (!s.submittedAt) {
    return (
      <ClientShell>
        <JMain>
          <Panel className="flex flex-col items-start gap-3 p-[26px]">
            <h1 className="m-0 text-2xl">Not submitted yet</h1>
            <p className="m-0 text-sm text-j-ink-3">The receipt appears here once the pack is signed off and the upload is recorded.</p>
            <JLink href={c("/submission")} variant="primary">
              Open submission pack
            </JLink>
          </Panel>
        </JMain>
      </ClientShell>
    );
  }

  const f = s.frozen ?? { total: ws.ctx.reqs.length, accepted: 0, files: 0 };
  const early = daysBetween(ws.ctx.today, SUBMISSION_DEADLINE);
  const signer = s.signedBy ?? "Index owner";
  const uploader = s.uploader ? `${signer} (delegated)` : signer;
  const trail: [string, string, string, string][] = [
    [initials(signer), "me", "Reviews completed", signer],
    [initials(signer), "me", "Pack and cover letter signed off", signer],
    [initials(signer), "me", "Uploaded 12 of 12 batches to DGA portal", uploader],
    ["DGA", "sys", `Receipt ${s.receipt} issued`, "DGA portal"],
  ];
  const TONE: Record<string, [string, string]> = { me: ["#E0ECF8", "#1E4E8C"], cl: ["#E7F3ED", "#0E5A45"], sys: ["#F5F7F6", "#47534D"] };
  const next: { t: string; sub: string; icon: IconName; bg: string; fg: string; href: string }[] = [
    { t: "Prepare for verification", sub: "Open evidence register in read-only mode", icon: "rev", bg: "#EAF1FA", fg: "#1E4E8C", href: c("/evidence") },
    { t: "Watch for DGA queries", sub: "Clarifications during verification", icon: "cla", bg: "#EEEDFD", fg: "#4F46E5", href: c("/requirements?view=cla") },
    { t: "Workplace report", sub: "Submission summary and score outlook", icon: "file", bg: "#E7F3ED", fg: "#0E5A45", href: `/dashboards/${client.id}` },
    { t: "Back to workplaces", sub: "Every workplace you run", icon: "grid", bg: "#F5F7F6", fg: "#33413B", href: "/workplaces" },
  ];

  const downloadReceipt = () => {
    const text = [`DGA portal receipt ${s.receipt}`, `${client.name} · ${fwName}`, `Submitted ${s.submittedAt} by ${uploader}`, `Requirements: ${f.total}`, `Evidence files: ${f.files}`].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${s.receipt}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ClientShell>
      <JMain>
        <section className="flex flex-wrap items-center gap-5 rounded-[20px] bg-cx-deep p-[26px] text-white">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-j-ok">
            <Icon name="check" size={28} strokeWidth={2.6} />
          </span>
          <span className="flex-[1_1_320px]">
            <span className="text-[11px] font-semibold tracking-[0.08em] text-cx-line">SUBMITTED TO DGA</span>
            <br />
            <b className="text-2xl">
              {client.name} · {fwName}
            </b>
            <br />
            <span className="text-sm text-cx-line">
              {s.submittedAt} · uploaded by {uploader} · {early} days before close
            </span>
          </span>
          <span className="flex flex-col rounded-xl bg-white/10 px-4 py-3">
            <span className="text-xs text-cx-line">Portal receipt</span>
            <b className="font-mono text-lg">{s.receipt}</b>
          </span>
          <span className="flex flex-wrap gap-2">
            <JButton onClick={downloadReceipt}>Download receipt</JButton>
            <JButton
              variant="outline"
              disabled={sent}
              onClick={() => {
                setSent(() => true);
                log(`Submission report sent to management · ${client.name}`);
              }}
            >
              {sent ? "Report sent" : "Send report to management"}
            </JButton>
          </span>
        </section>

        <section className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
          {[
            ["Requirements submitted", String(f.total), "Across all axes", "text-j-muted"],
            ["Evidence files", f.files.toLocaleString("en-US"), "12 batches · 3.2 GB", "text-j-muted"],
            ["Completion", `${Math.round((f.accepted / f.total) * 100)}%`, f.accepted === f.total ? "All accepted" : `${f.accepted} accepted`, f.accepted === f.total ? "text-brand" : "text-[#8A4B00]"],
            ["Verification opens", "1 Dec", "In 13 days", "text-[#8A4B00]"],
          ].map(([l, v, sub, ink]) => (
            <Panel key={l} className="p-[18px]">
              <span className="text-[13px] text-j-muted">{l}</span>
              <br />
              <b className="text-[26px]">{v}</b>
              <br />
              <span className={`text-xs font-semibold ${ink}`}>{sub}</span>
            </Panel>
          ))}
        </section>

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="flex min-w-0 flex-[3_1_480px] flex-col p-[22px]">
            <h2 className="m-0 mb-4 text-base">Trail</h2>
            {trail.map(([av, k, what, who], i) => (
              <div key={what} className="flex gap-3 pb-4">
                <span className="flex flex-col items-center">
                  <Avatar initials={av} size={32} bg={TONE[k][0]} fg={TONE[k][1]} />
                  {i < trail.length - 1 && <span className="mt-1 w-px flex-auto bg-j-line" />}
                </span>
                <span className="text-sm">
                  <b>{what}</b>
                  <br />
                  <span className="text-xs text-j-muted">{who}</span>
                </span>
              </div>
            ))}
          </Panel>
          <Panel className="flex min-w-0 flex-[2_1_340px] flex-col gap-2 p-[22px]">
            <PanelHead title="Next" className="mb-1" />
            {next.map((n) => (
              <Link key={n.t} href={n.href} className="flex items-center gap-3 rounded-xl border border-j-line-soft p-3 text-j-ink no-underline hover:border-cx-line hover:text-j-ink">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl" style={{ background: n.bg, color: n.fg }}>
                  <Icon name={n.icon} size={18} />
                </span>
                <span className="flex-auto text-sm">
                  <b>{n.t}</b>
                  <br />
                  <span className="text-xs text-j-muted">{n.sub}</span>
                </span>
                <Icon name="chevR" size={16} className="text-j-muted" />
              </Link>
            ))}
          </Panel>
        </div>
      </JMain>
    </ClientShell>
  );
}
