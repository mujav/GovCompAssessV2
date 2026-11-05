"use client";

// Platform audit trail: every sign-in, grant, standard and plan change, review decision, AI
// run and export. Entries are append-only; each carries a hash chained to the one before, so
// an edited or removed entry breaks the chain. Kept in the browser like the rest of the
// prototype, outside the React stores so the auth store can record sign-ins too.

import { useSyncExternalStore } from "react";

export type AuditType = "Sign-in" | "Grant" | "Standard" | "Plan" | "Review" | "AI run" | "Export" | "Settings" | "Cycle";

export interface AuditEntry {
  id: string;
  /** ISO timestamp. */
  at: string;
  user: string;
  role?: string;
  type: AuditType;
  action: string;
  /** Workspace label, e.g. "Demo Entity · Qiyas 2026". */
  workspace?: string;
  before?: string;
  after?: string;
  from?: string;
  hash: string;
}

const KEY = "ci-audit-v1";

/** FNV-1a over the previous hash and the entry, hex. */
function chain(prev: string, e: Omit<AuditEntry, "hash">) {
  const s = `${prev}|${e.id}|${e.at}|${e.user}|${e.type}|${e.action}|${e.workspace ?? ""}|${e.before ?? ""}|${e.after ?? ""}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, "0");
}

const SEED: Omit<AuditEntry, "hash" | "id">[] = [
  { at: "2026-10-01T08:02:00Z", user: "Aisha M.", role: "Platform Admin", type: "Grant", action: "Created workspace and granted Index Owner Sami R.", workspace: "Demo Entity · Qiyas 2026", after: "Index Owner: Sami R." },
  { at: "2026-10-01T09:15:00Z", user: "Sami R.", role: "Index Owner", type: "Standard", action: "Published the workspace standard", workspace: "Demo Entity · Qiyas 2026", after: "Edition 1.2" },
  { at: "2026-10-14T10:40:00Z", user: "Aisha M.", role: "Platform Admin", type: "Plan", action: "Marked a control not applicable", workspace: "Demo Entity · Qiyas 2026", before: "Applicable", after: "Not applicable · entity outside annex list" },
  { at: "2026-10-21T12:05:00Z", user: "Sami R.", role: "Index Owner", type: "Plan", action: "Moved deadline of 2 controls", workspace: "Demo Entity · Qiyas 2026", before: "2026-11-02", after: "2026-11-09" },
  { at: "2026-10-27T07:00:00Z", user: "AI · Delay and Attention Monitor", type: "AI run", action: "Daily attention scan", workspace: "Demo Entity · Qiyas 2026", after: "7 overdue · 3 at risk · 1 stale" },
  { at: "2026-10-28T08:31:00Z", user: "Sami R.", role: "Index Owner", type: "Sign-in", action: "Signed in", from: "10.20.4.17 · Chrome" },
];

function seed(): AuditEntry[] {
  const out: AuditEntry[] = [];
  SEED.forEach((e, i) => {
    const entry = { ...e, id: `A-${2900 + i}` };
    out.unshift({ ...entry, hash: chain(out[0]?.hash ?? "0", entry) });
  });
  return out;
}

let cache: AuditEntry[] | null = null;
const listeners = new Set<() => void>();

function load(): AuditEntry[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as AuditEntry[]) : seed();
  } catch {
    cache = seed();
  }
  return cache;
}

const EMPTY: AuditEntry[] = [];

/** Appends an entry; newest first. */
export function recordAudit(e: Omit<AuditEntry, "id" | "at" | "hash" | "from"> & { from?: string }) {
  const list = load();
  const entry = { ...e, id: `A-${2900 + list.length}`, at: new Date().toISOString(), from: e.from ?? browserLabel() };
  cache = [{ ...entry, hash: chain(list[0]?.hash ?? "0", entry) }, ...list];
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Storage unavailable: the entry stays for this session.
  }
  listeners.forEach((l) => l());
}

/** True when every entry's hash still matches its content and the entry before it. */
export function chainIntact(list: AuditEntry[]) {
  for (let i = list.length - 1; i >= 0; i--) {
    const { hash, ...rest } = list[i];
    if (chain(list[i + 1]?.hash ?? "0", rest) !== hash) return false;
  }
  return true;
}

function browserLabel() {
  if (typeof navigator === "undefined") return undefined;
  const ua = navigator.userAgent;
  const b = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `This device · ${b}`;
}

export function useAuditTrail(): AuditEntry[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    load,
    () => EMPTY,
  );
}
