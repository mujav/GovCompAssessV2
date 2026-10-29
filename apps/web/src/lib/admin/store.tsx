"use client";

// Client-side Admin Studio store (dummy data, persisted to localStorage).
// Lifecycle per configuration object: live → draft → change request → approve (publish) | reject.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { diffConfig } from "./diff";
import { impactFor } from "./impact";
import { createSeed } from "./seed";
import type { AdminState, ChangeRequest, ConfigKind, FrameworkVersion, Versioned } from "./types";

export const STORAGE_KEY = "ci-admin-studio-v2";

type Action = { type: "replace"; state: AdminState } | { type: "mutate"; fn: (s: AdminState) => void };

function reducer(state: AdminState, action: Action): AdminState {
  if (action.type === "replace") return action.state;
  const next = structuredClone(state);
  action.fn(next);
  return next;
}

export function stamp(d = new Date()) {
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} ${time}`;
}

export function slot(s: AdminState, kind: ConfigKind, id: string): Versioned<unknown> | undefined {
  switch (kind) {
    case "framework":
      return s.frameworks.find((f) => f.id === id);
    case "scoring":
      return s.scoring.id === id ? s.scoring : undefined;
    case "acceptance":
      return s.policies.find((p) => p.id === id);
    case "rule":
      return s.rules.find((r) => r.id === id);
  }
}

export function versionLabel(kind: ConfigKind, v: unknown): string {
  if (!v) return "—";
  return kind === "framework" ? `v${(v as FrameworkVersion).version}` : `v${(v as { version: number }).version}`;
}

function bump(kind: ConfigKind, v: unknown): unknown {
  const copy = structuredClone(v) as Record<string, unknown>;
  if (kind === "framework") {
    const parts = String(copy.version).split(".");
    const last = Number(parts[parts.length - 1]);
    parts[parts.length - 1] = String(Number.isFinite(last) ? last + 1 : 1);
    copy.version = parts.join(".");
  } else {
    copy.version = Number(copy.version) + 1;
  }
  return copy;
}

const KIND_LABEL: Record<ConfigKind, string> = {
  framework: "Framework",
  scoring: "Scoring scheme",
  acceptance: "Acceptance policy",
  rule: "Rule",
};

function displayName(kind: ConfigKind, id: string, v: unknown) {
  return kind === "framework" ? (v as FrameworkVersion).name : id;
}

export type Result = { ok: true; id?: string } | { ok: false; error: string };

interface AdminApi {
  state: AdminState;
  hydrated: boolean;
  user: AdminState["users"][number];
  setUser: (id: string) => void;
  reset: () => void;
  /** Clone the live version into an editable draft with the next version number. */
  startDraft: (kind: ConfigKind, id: string) => void;
  discardDraft: (kind: ConfigKind, id: string) => void;
  /** Edit a draft in place; ignored while the draft is waiting on a change request. */
  editDraft: <T>(kind: ConfigKind, id: string, fn: (draft: T) => void) => void;
  submit: (kind: ConfigKind, id: string) => Result;
  decide: (crId: string, decision: "approve" | "reject", comment: string, effectiveFrom?: string) => Result;
  log: (text: string) => void;
  /** Generic mutation for create/rename operations. */
  update: (fn: (s: AdminState) => void) => void;
}

const AdminContext = createContext<AdminApi | null>(null);

function pushAudit(s: AdminState, who: string, text: string) {
  s.seq += 1;
  s.audit.unshift({ id: `ev-${s.seq}`, at: stamp(), who, text });
}

export function AdminProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createSeed);
  const hydrated = useRef(false);

  // Load after mount so server and first client render match.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "replace", state: JSON.parse(raw) as AdminState });
    } catch {
      // Corrupt or blocked storage: keep the seed.
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable (private mode): state stays in memory.
    }
  }, [state]);

  const mutate = useCallback((fn: (s: AdminState) => void) => dispatch({ type: "mutate", fn }), []);
  const user = state.users.find((u) => u.id === state.currentUserId) ?? state.users[0];

  const api = useMemo<AdminApi>(() => {
    const who = (s: AdminState) => s.users.find((u) => u.id === s.currentUserId)?.name ?? "Unknown";
    return {
      state,
      hydrated: hydrated.current,
      user,
      setUser: (id) => mutate((s) => void (s.currentUserId = id)),
      reset: () => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        dispatch({ type: "replace", state: createSeed() });
      },
      update: mutate,
      log: (text) => mutate((s) => pushAudit(s, who(s), text)),
      startDraft: (kind, id) =>
        mutate((s) => {
          const v = slot(s, kind, id);
          if (!v || v.draft || !v.live) return;
          v.draft = bump(kind, v.live);
          pushAudit(s, who(s), `Draft ${displayName(kind, id, v.draft)} ${versionLabel(kind, v.draft)} created from published ${versionLabel(kind, v.live)}.`);
        }),
      discardDraft: (kind, id) =>
        mutate((s) => {
          const v = slot(s, kind, id);
          if (!v?.draft || v.pendingCr) return;
          pushAudit(s, who(s), `Discarded draft ${displayName(kind, id, v.draft)} ${versionLabel(kind, v.draft)}.`);
          v.draft = undefined;
        }),
      editDraft: (kind, id, fn) =>
        mutate((s) => {
          const v = slot(s, kind, id);
          if (!v?.draft || v.pendingCr) return;
          fn(v.draft as never);
        }),
      submit: (kind, id) => {
        const v = slot(state, kind, id);
        if (!v?.draft) return { ok: false, error: "There is no draft to submit." };
        if (v.pendingCr) return { ok: false, error: `Already submitted as ${v.pendingCr}.` };
        const diff = diffConfig(kind, v.live, v.draft);
        if (v.live && !diff.some((d) => d.changed)) return { ok: false, error: "The draft is identical to the live version." };
        const crId = `CR-${state.seq + 1}`;
        const material = kind !== "rule" && diff.some((d) => d.changed && d.label !== "Arabic labels" && d.label !== "Name");
        mutate((s) => {
          s.seq += 1;
          const target = slot(s, kind, id)!;
          const cr: ChangeRequest = {
            id: crId,
            kind,
            targetId: id,
            title: `${KIND_LABEL[kind]} ${displayName(kind, id, target.draft)} ${versionLabel(kind, target.live)} → ${versionLabel(kind, target.draft)}`,
            authorId: s.currentUserId,
            submittedAt: stamp(),
            status: "awaiting",
            material,
            diff,
            impact: impactFor(kind, target.live, target.draft),
          };
          s.changeRequests.unshift(cr);
          target.pendingCr = crId;
          pushAudit(s, who(s), `Submitted ${crId} for approval${material ? " (material change)" : ""}.`);
        });
        return { ok: true, id: crId };
      },
      decide: (crId, decision, comment, effectiveFrom) => {
        const cr = state.changeRequests.find((c) => c.id === crId);
        if (!cr || cr.status !== "awaiting") return { ok: false, error: "This change request is not awaiting a decision." };
        if (cr.authorId === state.currentUserId) return { ok: false, error: "Four-eyes rule: the author cannot decide their own change." };
        if (!user.canApprove) return { ok: false, error: `${user.role} does not hold "approve configuration change".` };
        if (!comment.trim()) return { ok: false, error: "A comment is required." };
        mutate((s) => {
          const c = s.changeRequests.find((x) => x.id === crId)!;
          const target = slot(s, c.kind, c.targetId);
          c.status = decision === "approve" ? "published" : "rejected";
          c.decidedBy = who(s);
          c.decidedAt = stamp();
          c.comment = comment.trim();
          c.effectiveFrom = effectiveFrom;
          if (target) {
            target.pendingCr = undefined;
            if (decision === "approve") {
              target.live = target.draft;
              target.draft = undefined;
            }
          }
          pushAudit(
            s,
            who(s),
            decision === "approve"
              ? `Approved and published ${crId}${effectiveFrom ? `, effective ${effectiveFrom}` : ""}.`
              : `Rejected ${crId}: ${comment.trim()}`,
          );
        });
        return { ok: true };
      },
    };
  }, [state, user, mutate]);

  return <AdminContext.Provider value={api}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside <AdminProvider>");
  return ctx;
}

/** The version a screen should show: the draft when there is one, else live. */
export function working<T>(v: Versioned<T>): { value: T | undefined; isDraft: boolean; locked: boolean } {
  return { value: v.draft ?? v.live, isDraft: !!v.draft, locked: !v.draft || !!v.pendingCr };
}
