"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PageHeader } from "@/components/workspace-shell";
import { Button } from "@/components/ui";
import { useAdmin } from "@/lib/admin/store";
import type { ChangeRequest, ConfigKind, CrStatus } from "@/lib/admin/types";

const S: Record<CrStatus, [string, string, string]> = {
  awaiting: ["AWAITING APPROVAL", "#FBEFD9", "#8A4B00"],
  published: ["PUBLISHED", "#E3F1EA", "#11603F"],
  rejected: ["REJECTED", "#FBE4E1", "#A3261B"],
};

const EDITOR: Record<ConfigKind, string> = {
  framework: "/admin/frameworks",
  scoring: "/admin/scoring",
  acceptance: "/admin/acceptance",
  rule: "/admin/automation",
};

export default function ConfigHistoryPage() {
  return (
    <Suspense>
      <ConfigHistory />
    </Suspense>
  );
}

function ConfigHistory() {
  const { state, user } = useAdmin();
  const params = useSearchParams();
  const [sel, setSel] = useState<string | null>(params.get("cr"));
  const [filter, setFilter] = useState<"all" | CrStatus>("all");

  const list = state.changeRequests.filter((c) => filter === "all" || c.status === filter);
  const cr = state.changeRequests.find((c) => c.id === sel) ?? list[0] ?? state.changeRequests[0];
  const authorName = (id: string) => state.users.find((u) => u.id === id)?.name ?? id;

  return (
    <>
      <PageHeader
        crumb="Admin Studio / Configuration history"
        title="Configuration history & approval"
        actions={
          <div className="flex items-center gap-2 text-[13px] text-muted">
            Acting as{" "}
            <b className="text-ink">
              {user.name} · {user.role}
            </b>
          </div>
        }
      />
      <main className="box-border flex w-full max-w-[1360px] flex-wrap items-start gap-4 px-8 pb-12 pt-6">
        <section aria-label="Change requests" className="flex min-w-0 flex-[1_1_300px] flex-col gap-2">
          <div role="group" aria-label="Filter change requests" className="flex flex-wrap gap-1.5">
            {(["all", "awaiting", "published", "rejected"] as const).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "chipActive" : "chip"} onClick={() => setFilter(f)} aria-pressed={filter === f}>
                {f === "all" ? "All" : f[0].toUpperCase() + f.slice(1)} ·{" "}
                {f === "all" ? state.changeRequests.length : state.changeRequests.filter((c) => c.status === f).length}
              </Button>
            ))}
          </div>
          {list.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSel(c.id)}
              aria-pressed={c.id === cr?.id}
              className="flex cursor-pointer flex-col gap-1 rounded-xl bg-white px-3.5 py-3 text-left text-ink"
              style={{ border: c.id === cr?.id ? "2px solid #0E5A45" : "1px solid #DCE2DE" }}
            >
              <span className="flex justify-between gap-2">
                <b className="font-mono text-xs">{c.id}</b>
                <span className="rounded px-1.5 py-px text-[11px] font-bold" style={{ background: S[c.status][1], color: S[c.status][2] }}>
                  {c.status === "awaiting" && c.authorId !== user.id && user.canApprove ? "AWAITING YOU" : S[c.status][0]}
                </span>
              </span>
              <span className="text-[13px] leading-[18px] font-semibold">{c.title}</span>
              <span className="text-xs text-muted">
                {authorName(c.authorId)} · {c.submittedAt} · {c.material ? "material" : "non-material"}
              </span>
            </button>
          ))}
          {list.length === 0 && <div className="py-4 text-[13px] text-muted">No change requests.</div>}
        </section>

        <section className="flex min-w-0 flex-[999_1_600px] flex-col gap-3.5">
          {cr && <CrDetail key={cr.id} cr={cr} authorName={authorName(cr.authorId)} />}

          <div className="flex flex-col gap-2 rounded-[14px] border border-line bg-white px-5 py-[18px]">
            <h3 className="m-0 text-[15px] font-semibold">Audit trail · immutable</h3>
            {state.audit.slice(0, 12).map((a) => (
              <div key={a.id} className="grid grid-cols-[110px_120px_minmax(0,1fr)] gap-2.5 border-t border-line-soft py-1.5 text-xs leading-[18px]">
                <span className="font-mono text-muted">{a.at}</span>
                <span>
                  <b>{a.who}</b>
                </span>
                <span>{a.text}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}

function CrDetail({ cr, authorName }: { cr: ChangeRequest; authorName: string }) {
  const { user, decide } = useAdmin();
  const [comment, setComment] = useState("");
  const [effective, setEffective] = useState("Qiyas 2026 · Cycle 2 · 01 Dec 2026");
  const [error, setError] = useState<string | null>(null);

  const isAuthor = cr.authorId === user.id;
  const onDecide = (d: "approve" | "reject") => {
    const r = decide(cr.id, d, comment, d === "approve" ? effective : undefined);
    setError(r.ok ? null : r.error);
  };

  return (
    <>
      <div className="overflow-hidden rounded-[14px] border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line-soft px-5 py-4">
          <div>
            <h2 className="m-0 text-[17px] font-semibold">
              {cr.id} · {cr.title}
            </h2>
            <div className="text-xs text-muted">
              Author {authorName} · submitted {cr.submittedAt} · <Link href={EDITOR[cr.kind]}>open in editor</Link>
            </div>
          </div>
          <div role="group" aria-label="Environment promotion" className="flex items-center gap-1 text-xs">
            <span className="rounded-md bg-good-soft px-2 py-1 font-semibold text-good">dev ✓</span>
            <span aria-hidden="true">→</span>
            <span className="rounded-md bg-good-soft px-2 py-1 font-semibold text-good">test ✓</span>
            <span aria-hidden="true">→</span>
            <span className={cr.status === "published" ? "rounded-md bg-good-soft px-2 py-1 font-semibold text-good" : "rounded-md border border-field px-2 py-1"}>
              prod {cr.status === "published" ? "✓" : "· on approval"}
            </span>
          </div>
        </div>
        <div role="table" aria-label="Changes between versions" className="text-[13px]">
          <div role="row" className="grid grid-cols-3 border-b border-line bg-surface-2 text-xs font-semibold text-muted">
            <span role="columnheader" className="px-4 py-2.5">
              Setting
            </span>
            <span role="columnheader" className="px-4 py-2.5">
              Live
            </span>
            <span role="columnheader" className="px-4 py-2.5">
              Proposed
            </span>
          </div>
          {cr.diff.map((d) => (
            <div role="row" key={d.label} className="grid grid-cols-3 border-b border-line-soft">
              <span role="cell" className="px-4 py-2.5 font-semibold">
                {d.label}
              </span>
              <span role="cell" className="px-4 py-2.5 font-mono text-xs leading-[18px]" style={{ background: d.changed ? "#FDF1EF" : "#FFFFFF" }}>
                {d.before}
              </span>
              <span role="cell" className="px-4 py-2.5 font-mono text-xs leading-[18px]" style={{ background: d.changed ? "#EEF7F2" : "#FFFFFF" }}>
                {d.after}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-start gap-3.5">
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2 rounded-[14px] border border-line bg-white p-[18px] text-[13px] leading-5">
          <h3 className="m-0 text-[15px] font-semibold">Impact analysis</h3>
          {cr.impact.map((i) => (
            <div key={i}>{i}</div>
          ))}
        </div>

        {cr.status === "awaiting" ? (
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2.5 rounded-[14px] border-2 border-brand bg-white p-[18px]">
            <h3 className="m-0 text-[15px] font-semibold">Your approval</h3>
            <div className="flex flex-col gap-1.5 text-[13px] leading-[19px]">
              <div className={isAuthor ? "text-bad" : "text-good"}>{isAuthor ? "✕ You are the author: four-eyes blocks approval" : "✓ You are not the author (four-eyes)"}</div>
              <div className={user.canApprove ? "text-good" : "text-bad"}>
                {user.canApprove ? "✓ You hold \"approve configuration change\"" : `✕ ${user.role} cannot approve configuration changes`}
              </div>
              {cr.material && <div className="text-warn">! Material change: published results keep their version until re-accepted.</div>}
            </div>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Comment (required)
              <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Reason for the decision" className="resize-y rounded-lg border border-field p-2.5 text-sm font-normal" />
            </label>
            <label className="flex flex-col gap-1 text-[13px] font-semibold">
              Effective from
              <input value={effective} onChange={(e) => setEffective(e.target.value)} className="h-11 rounded-lg border border-field px-2.5 text-sm font-normal" />
            </label>
            {error && (
              <div role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-[13px] text-bad">
                {error}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button className="text-bad hover:text-bad" onClick={() => onDecide("reject")}>
                Reject
              </Button>
              <Button variant="primary" className="px-4" onClick={() => onDecide("approve")}>
                Approve and publish
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-2 rounded-[14px] border border-line bg-white p-[18px] text-[13px] leading-5">
            <h3 className="m-0 text-[15px] font-semibold">Decision</h3>
            <div>
              <b style={{ color: S[cr.status][2] }}>{cr.status === "published" ? "Approved and published" : "Rejected"}</b> by {cr.decidedBy} · {cr.decidedAt}
            </div>
            {cr.effectiveFrom && <div>Effective from {cr.effectiveFrom}</div>}
            {cr.comment && <blockquote className="m-0 rounded-lg bg-surface-2 px-3 py-2 text-ink-2">{cr.comment}</blockquote>}
          </div>
        )}
      </div>
    </>
  );
}
