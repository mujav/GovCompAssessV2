"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdmin, versionLabel, slot } from "@/lib/admin/store";
import type { ConfigKind } from "@/lib/admin/types";
import { Button, cx } from "./ui";

export type CheckItem = { ok: boolean; text: string };

/**
 * Lifecycle controls for one configuration object: shows live/draft/pending state and
 * offers Create draft, Discard and Submit. Submit is blocked while any check fails.
 */
export function DraftBar({ kind, id, checks = [] }: { kind: ConfigKind; id: string; checks?: CheckItem[] }) {
  const { state, startDraft, discardDraft, submit } = useAdmin();
  const [msg, setMsg] = useState<{ ok: boolean; text: string; cr?: string } | null>(null);
  const v = slot(state, kind, id);
  if (!v) return null;
  const failing = checks.filter((c) => !c.ok);

  const onSubmit = () => {
    if (failing.length) return setMsg({ ok: false, text: `Fix ${failing.length} validation issue${failing.length > 1 ? "s" : ""} first.` });
    const r = submit(kind, id);
    setMsg(r.ok ? { ok: true, text: `Submitted as ${r.id}.`, cr: r.id } : { ok: false, text: r.error });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!!v.live && <StatusPill tone="live">{versionLabel(kind, v.live)} live</StatusPill>}
      {!!v.draft && !v.pendingCr && <StatusPill tone="draft">Draft {versionLabel(kind, v.draft)}</StatusPill>}
      {v.pendingCr && (
        <Link href={`/admin/history?cr=${v.pendingCr}`} className="no-underline">
          <StatusPill tone="pending">
            {versionLabel(kind, v.draft)} awaiting approval · {v.pendingCr}
          </StatusPill>
        </Link>
      )}
      {!v.draft && !!v.live && (
        <Button variant="primary" onClick={() => startDraft(kind, id)}>
          Create draft
        </Button>
      )}
      {!!v.draft && !v.pendingCr && (
        <>
          {!!v.live && <Button onClick={() => (setMsg(null), discardDraft(kind, id))}>Discard draft</Button>}
          <Button variant="primary" className="px-4" onClick={onSubmit}>
            Submit for approval
          </Button>
        </>
      )}
      {msg && (
        <span role="status" className={cx("text-[13px] font-semibold", msg.ok ? "text-good" : "text-bad")}>
          {msg.text}{" "}
          {msg.cr && <Link href={`/admin/history?cr=${msg.cr}`}>Open</Link>}
        </span>
      )}
    </div>
  );
}

const PILL = {
  live: "bg-good-soft text-good",
  draft: "bg-warn-soft text-warn",
  pending: "bg-na-soft text-na-fg",
};

export function StatusPill({ tone, children }: { tone: keyof typeof PILL; children: React.ReactNode }) {
  return <span className={cx("rounded-full px-2.5 py-1 text-xs font-semibold", PILL[tone])}>{children}</span>;
}

/** Explains why a form is read-only. */
export function LockNote({ kind, id }: { kind: ConfigKind; id: string }) {
  const { state } = useAdmin();
  const v = slot(state, kind, id);
  if (!v) return null;
  if (v.pendingCr)
    return (
      <Note>
        Read-only while {v.pendingCr} awaits approval. A rejection returns the draft for editing.
      </Note>
    );
  if (!v.draft) return <Note>Showing the published version, which is immutable. Create a draft to make changes.</Note>;
  return null;
}

function Note({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-surface-2 px-3 py-2 text-xs leading-[18px] text-muted">{children}</div>;
}

export function Checks({ checks }: { checks: CheckItem[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[13px] leading-5">
      {checks.map((c) => (
        <li key={c.text} className={c.ok ? "text-good" : "text-bad"}>
          {c.ok ? "✓" : "✕"} {c.text}
        </li>
      ))}
    </ul>
  );
}
