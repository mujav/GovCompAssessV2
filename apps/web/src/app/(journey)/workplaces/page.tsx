"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@/components/journey/icon";
import { AppShell, JMain } from "@/components/journey/shell";
import { Avatar, Field, JButton, JLink, Panel, Pill, Ring, inputClass } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { useAdmin } from "@/lib/admin/store";
import { ROLE_OF } from "@/lib/auth/accounts";
import { useAuth } from "@/lib/auth/store";
import { shortName } from "@/lib/journey/frameworks";
import { clientHref } from "@/lib/journey/portfolio";
import { useJourney } from "@/lib/journey/store";
import { NO_SUBMISSION, submissionKey, type SubmissionState } from "@/lib/journey/submission";
import { useMyWorkplaces } from "@/lib/journey/use-workplaces";
import { useWorkplacesWork } from "@/lib/journey/use-work";
import { initials, stageOf } from "@/lib/journey/work";
import { CURRENT_YEAR, phaseOf, type WorkplaceRequest } from "@/lib/journey/workplaces";
import { PRIOR_CYCLE, SUBMISSION_DEADLINE, daysBetween } from "@/lib/workspace/data";
import { useWorkspace } from "@/lib/workspace/store";

// S01 · Workplaces. The index owner's landing page: only the workplaces the platform admin
// granted them, each one entity, one index and one review year. The platform admin sees every
// workplace here. Index owners ask the admin for a new workplace from the bottom of the page.

/** Index colours: the blue family for the first index, then distinct tints. */
const INDEX_TONE: [string, string][] = [
  ["#E0ECF8", "#1E4E8C"],
  ["#E7F3ED", "#0E5A45"],
  ["#EEEDFD", "#4F46E5"],
  ["#FDE9D9", "#9A3412"],
  ["#FFF4DF", "#8A4B00"],
];

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export default function WorkplacesPage() {
  const { user } = useAuth();
  const { state } = useJourney();
  const ws = useWorkspace();
  const views = useMyWorkplaces();
  const work = useWorkplacesWork(views);
  const [q, setQ] = useState("");
  const [index, setIndex] = useState("all");
  const admin = user?.role === "admin";
  const today = ws.ctx.today;
  const closing = daysBetween(today, SUBMISSION_DEADLINE);

  const indices = [...new Map(views.map((v) => [v.workplace.frameworkId, v.framework ? shortName(v.framework.name) : v.workplace.frameworkId])).entries()];
  const toneOf = (fwId: string) => INDEX_TONE[Math.max(0, indices.findIndex(([id]) => id === fwId)) % INDEX_TONE.length];

  const cards = useMemo(
    () =>
      work
        .filter((w) => index === "all" || w.workplace.frameworkId === index)
        .filter((w) => `${w.entity.name} ${w.framework?.name ?? ""} ${w.workplace.year}`.toLowerCase().includes(q.trim().toLowerCase()))
        .sort((a, b) => b.workplace.year - a.workplace.year || a.entity.name.localeCompare(b.entity.name))
        .map((w) => {
          const total = w.reqs.length;
          const assigned = w.reqs.filter((r) => r.owner).length;
          const submitted = !!((state.screens[submissionKey(w.client.id, w.framework?.id)] as SubmissionState | undefined) ?? NO_SUBMISSION).submittedAt;
          const overdue = w.reqs.filter((r) => r.due < today && stageOf(r, w.overlay) !== "acc").length;
          return {
            w,
            total,
            pct: total ? Math.round((w.counts.acc / total) * 100) : 0,
            plan: total ? Math.round((assigned / total) * 100) : 0,
            phase: phaseOf(w.counts, submitted),
            overdue,
            // Seeded Qiyas workplaces carry the 2025 result; new ones have none yet.
            prior: w.client.id === w.client.entityId && w.workplace.frameworkId === "fw-qiyas" ? `${PRIOR_CYCLE.at(-1)}%` : "–",
          };
        }),
    [work, index, q, state.screens, today],
  );

  return (
    <AppShell search="Search workplaces">
      <JMain max={1200}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-[640px] flex-col gap-2">
            <span className="text-xs font-semibold tracking-[0.06em] text-j-muted uppercase">
              {greeting()}, {user?.name.split(" ")[0]}
            </span>
            <h1 className="m-0 text-[34px] leading-10 font-semibold tracking-[-0.01em]">{admin ? "All workplaces" : "Your workplaces"}</h1>
            <p className="m-0 text-[15px] text-j-ink-3">
              {admin
                ? "Every workplace on the platform. Each one is a single entity, index and review year."
                : "You see only the workplaces the platform admin granted you. Each one is a single entity, index and review year."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <label className="flex h-[42px] w-[260px] items-center gap-2 rounded-[10px] border border-j-line bg-white px-3 text-j-muted">
              <Icon name="search" size={16} />
              <span className="sr-only">Search workplaces</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entity or index" className="min-w-0 flex-auto border-0 bg-transparent text-sm text-j-ink outline-none" />
            </label>
            <select aria-label="Index" value={index} onChange={(e) => setIndex(e.target.value)} className={cx(inputClass, "h-[42px]")}>
              <option value="all">All indices</option>
              {indices.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            {admin && (
              <JLink href="/workplaces/new" variant="primary" className="h-[42px]">
                <Icon name="plus" size={16} />
                New workplace
              </JLink>
            )}
          </div>
        </div>

        {views.length === 0 ? (
          <Panel className="flex flex-col items-start gap-2 p-[26px]">
            <h2 className="m-0 text-lg">No workplaces granted to you yet</h2>
            <p className="m-0 text-sm text-j-ink-3">Ask the platform admin for one below. It appears here as soon as it is created.</p>
          </Panel>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] items-stretch gap-5">
            {cards.map(({ w, total, pct, plan, phase, overdue, prior }) => {
              const [tbg, tfg] = toneOf(w.workplace.frameworkId);
              return (
                <Link
                  key={w.workplace.id}
                  href={clientHref(w.client.id)}
                  className="box-border flex h-full flex-col gap-[18px] rounded-2xl border border-j-line bg-white p-6 text-j-ink no-underline shadow-[0_1px_2px_rgba(16,28,46,0.05)] hover:border-cx hover:text-j-ink"
                >
                  <span className="flex justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-full px-2.5 py-[3px] text-xs font-semibold whitespace-nowrap" style={{ background: tbg, color: tfg }}>
                          {w.framework ? shortName(w.framework.name) : w.workplace.frameworkId} {w.workplace.year}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-j-canvas px-2.5 py-[3px] text-xs font-semibold text-j-ink-3">
                          {admin ? (w.owners.length ? w.owners.map((o) => o.name).join(", ") : "No index owner") : ROLE_OF.owner.label}
                        </span>
                      </span>
                      <b className="mt-3 block text-[19px] leading-6 font-semibold">{w.entity.name}</b>
                      <span className="mt-0.5 block text-sm text-j-ink-3">
                        Phase: {phase.toLowerCase()} · plan {plan}% ready
                      </span>
                    </span>
                    <Ring pct={pct} color={tfg} size={76} label={`Accepted ${pct} percent`}>
                      <b className="text-[17px]">{pct}%</b>
                    </Ring>
                  </span>
                  <span className="grid grid-cols-3 gap-3 border-t border-j-line-soft pt-4 text-[13px]">
                    <span>
                      <span className="block text-j-ink-3">Accepted</span>
                      <b className="mt-0.5 block text-base font-semibold">
                        {w.counts.acc} / {total}
                      </b>
                    </span>
                    <span>
                      <span className="block text-j-ink-3">Overdue</span>
                      <b className={cx("mt-0.5 block text-base font-semibold", overdue ? "text-[#B2461F]" : "")}>{overdue}</b>
                    </span>
                    <span>
                      <span className="block text-j-ink-3">{w.workplace.year < CURRENT_YEAR ? "Closed" : "Closing in"}</span>
                      <b className="mt-0.5 block text-base font-semibold">{w.workplace.year === CURRENT_YEAR ? `${closing} days` : w.workplace.year < CURRENT_YEAR ? "Archive" : "Next year"}</b>
                    </span>
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-2 border-t border-j-line-soft pt-3 text-[13px] text-j-ink-3">
                    Previous official score: {prior}
                    {w.counts.rev > 0 && <Pill tone="warn">{w.counts.rev} to review</Pill>}
                  </span>
                </Link>
              );
            })}
            {cards.length === 0 && <p className="m-0 text-sm text-j-muted">No workplace matches the search.</p>}
          </div>
        )}

        {admin ? <AdminRequests /> : <RequestWorkplace />}
      </JMain>
    </AppShell>
  );
}

/** Index owner: ask the platform admin for another workplace. */
function RequestWorkplace() {
  const { user } = useAuth();
  const { clients, state, update, log } = useJourney();
  const { state: studio } = useAdmin();
  const library = studio.frameworks.filter((f) => f.live);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [entity, setEntity] = useState("");
  const [frameworkId, setFrameworkId] = useState(library[0]?.id ?? "");
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [reason, setReason] = useState("");
  const mine = (state.workplaceRequests ?? []).filter((r) => r.byId === user?.id);

  const send = () => {
    if (!user || !entity.trim() || !frameworkId) return;
    const match = clients.find((c) => c.name.toLowerCase() === entity.trim().toLowerCase());
    const req: WorkplaceRequest = {
      id: `wr-${Date.now().toString(36)}`,
      entityId: match?.id,
      entityName: match?.name ?? entity.trim(),
      frameworkId,
      year: Number(year) || CURRENT_YEAR,
      reason: reason.trim(),
      byId: user.id,
      byName: user.name,
      at: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      status: "pending",
    };
    update((s) => void (s.workplaceRequests ??= []).unshift(req));
    log(`${user.name} requested a workplace: ${req.entityName} · ${year}`);
    setSent(true);
  };

  return (
    <>
      <Panel className="flex flex-wrap items-center justify-between gap-4 bg-[#FAFBFC] px-6 py-5">
        <p className="m-0 max-w-[760px] text-sm text-j-ink-3">Need another entity or index? Request a new workplace; the platform admin creates it and grants you access. Workplaces of past review years stay read-only and seed next year&apos;s workplace.</p>
        <JButton variant="primary" onClick={() => (setOpen(true), setSent(false))}>
          Request new workplace
        </JButton>
      </Panel>
      {open && (
        <Panel aria-labelledby="rq" className="flex flex-col gap-4 border-cx-line p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="rq" className="m-0 text-lg font-semibold">
                Request a new workplace
              </h2>
              <p className="m-0 mt-1 text-sm text-j-ink-3">Sent to the platform admin, who creates the workplace and grants you access as index owner.</p>
            </div>
            <JButton size="sm" onClick={() => setOpen(false)} aria-label="Close request form">
              ✕
            </JButton>
          </div>
          {sent ? (
            <p role="status" className="m-0 rounded-xl bg-cx-soft px-4 py-3.5 text-sm font-semibold text-cx">
              Request sent. The platform admin has been notified; the workplace appears here once it is created.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
                <Field label="Entity" className="col-span-2 max-sm:col-span-1">
                  <input list="wr-entities" value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="Type or pick an entity" className={inputClass} />
                  <datalist id="wr-entities">
                    {clients.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </Field>
                <Field label="Index">
                  <select value={frameworkId} onChange={(e) => setFrameworkId(e.target.value)} className={inputClass}>
                    {library.map((f) => (
                      <option key={f.id} value={f.id}>
                        {shortName(f.live!.name)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Review year">
                  <input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} className={inputClass} />
                </Field>
              </div>
              <Field label="Reason or engagement reference">
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={cx(inputClass, "h-auto py-2.5")} />
              </Field>
              <div className="flex justify-end gap-2.5">
                <JButton onClick={() => setOpen(false)}>Cancel</JButton>
                <JButton variant="primary" disabled={!entity.trim()} onClick={send}>
                  Send request
                </JButton>
              </div>
            </>
          )}
        </Panel>
      )}
      {mine.length > 0 && (
        <Panel className="flex flex-col p-0">
          <h2 className="m-0 px-6 pt-4 pb-2 text-sm font-semibold text-j-ink-3">Your requests</h2>
          {mine.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 border-t border-j-line-soft px-6 py-3 text-sm">
              <span className="flex-auto">
                <b>{r.entityName}</b> · {shortName(library.find((f) => f.id === r.frameworkId)?.live?.name ?? r.frameworkId)} {r.year}
                <span className="text-j-muted"> · sent {r.at}</span>
              </span>
              <Pill tone={r.status === "created" ? "ok" : r.status === "declined" ? "bad" : "warn"}>{r.status === "created" ? "Created" : r.status === "declined" ? "Declined" : "Waiting"}</Pill>
            </div>
          ))}
        </Panel>
      )}
    </>
  );
}

/** Platform admin: workplace requests from index owners, handled on the New workplace page. */
function AdminRequests() {
  const { state } = useJourney();
  const pending = (state.workplaceRequests ?? []).filter((r) => r.status === "pending");
  if (!pending.length) return null;
  return (
    <Panel className="flex flex-wrap items-center justify-between gap-4 border-[#F0DDB0] bg-[#FFF8EA] px-6 py-5">
      <span className="flex items-center gap-3 text-sm">
        <span className="flex -space-x-2">
          {pending.slice(0, 3).map((r) => (
            <Avatar key={r.id} initials={initials(r.byName)} size={30} className="ring-2 ring-[#FFF8EA]" />
          ))}
        </span>
        <span>
          <b>
            {pending.length} workplace request{pending.length === 1 ? "" : "s"}
          </b>{" "}
          from index owners waiting for you.
        </span>
      </span>
      <JLink href="/workplaces/new" variant="primary">
        Review requests
      </JLink>
    </Panel>
  );
}
