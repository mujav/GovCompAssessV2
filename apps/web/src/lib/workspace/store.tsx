"use client";

// Client-side workspace store (dummy data, persisted to localStorage). Holds what users do on
// the Command Center: filters, saved views, assignments and drafts awaiting a human decision.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { STORAGE_KEY as ADMIN_KEY } from "@/lib/admin/store";
import { createSeed } from "@/lib/admin/seed";
import type { AdminState, ScoringScheme } from "@/lib/admin/types";
import { applyAssignments, NO_FILTERS, type Assignments, type Context, type DraftKind, type Filters } from "@/lib/engine/metrics";
import { CLARIFICATIONS, EVIDENCE_ISSUES, TODAY, WS_ACTIONS, WS_REQUIREMENTS, type ReviewStage } from "./data";
import { composeDraft, DRAFT_LABEL, type Draft } from "./drafts";

const STORAGE_KEY = "ci-workspace-v1";

export const CURRENT_USER = "Noura A.";

export interface SavedView {
  id: string;
  name: string;
  filters: Filters;
}

export interface WsState {
  filters: Filters;
  views: SavedView[];
  assignments: Assignments;
  /** Accepted results sent back for review (re-review flags). */
  reviewOverrides: Record<string, ReviewStage>;
  /** Extra reminders sent per action id. */
  reminders: Record<string, number>;
  /** Evidence files returned to their owners. */
  returned: string[];
  drafts: Draft[];
  dismissed: string[];
  readNotes: string[];
  log: { id: string; at: string; text: string }[];
  seq: number;
}

function createState(): WsState {
  return {
    filters: NO_FILTERS,
    views: [{ id: "view-hc", name: "Human Capital follow-up", filters: { ...NO_FILTERS, department: "Human Capital" } }],
    assignments: {},
    reviewOverrides: {},
    reminders: {},
    returned: [],
    drafts: [],
    dismissed: [],
    readNotes: [],
    log: [],
    seq: 0,
  };
}

type Action = { type: "replace"; state: WsState } | { type: "mutate"; fn: (s: WsState) => void };

function reducer(state: WsState, action: Action): WsState {
  if (action.type === "replace") return action.state;
  const next = structuredClone(state);
  action.fn(next);
  return next;
}

function stamp(d = new Date()) {
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function pushLog(s: WsState, text: string) {
  s.seq += 1;
  s.log.unshift({ id: `log-${s.seq}`, at: stamp(), text });
}

/** Base records with this user's changes applied, before any filter. */
export function buildContext(s: WsState, scheme: ScoringScheme): Context {
  const reqs = applyAssignments(WS_REQUIREMENTS, s.assignments).map((r) =>
    s.reviewOverrides[r.code] ? { ...r, review: s.reviewOverrides[r.code] } : r,
  );
  return {
    reqs,
    actions: WS_ACTIONS.map((a) => {
      const owner = s.assignments[a.code];
      return { ...a, reminders: a.reminders + (s.reminders[a.id] ?? 0), ...(owner && { owner: owner.owner, due: owner.due }) };
    }),
    issues: EVIDENCE_ISSUES.filter((i) => !s.returned.includes(i.id)),
    clarifications: CLARIFICATIONS,
    scheme,
    today: TODAY,
  };
}

/** The scoring scheme published in Admin Studio (falls back to the seed). */
function readPublishedScheme(): ScoringScheme {
  const seed = createSeed().scoring.live as ScoringScheme;
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    if (raw) return ((JSON.parse(raw) as AdminState).scoring.live as ScoringScheme) ?? seed;
  } catch {
    // Unreadable admin state: use the seed scheme.
  }
  return seed;
}

interface WorkspaceApi {
  state: WsState;
  ctx: Context;
  setFilters: (f: Partial<Filters>) => void;
  saveView: (name: string) => void;
  deleteView: (id: string) => void;
  assign: (code: string, owner: string, due: string) => void;
  /** Prepare a draft from records (in `scope`, default all) and return its id. */
  createDraft: (kind: DraftKind, codes: string[], insightId?: string, scope?: Context) => string;
  editDraft: (id: string, patch: Partial<Pick<Draft, "title" | "recipients" | "body">>) => void;
  decideDraft: (id: string, decision: "approve" | "discard") => void;
  dismissInsight: (id: string) => void;
  restoreInsights: () => void;
  markRead: (ids: string[]) => void;
  reset: () => void;
}

const WorkspaceContext = createContext<WorkspaceApi | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createState);
  const [scheme, setScheme] = useState<ScoringScheme>(() => createSeed().scoring.live as ScoringScheme);
  const hydrated = useRef(false);

  // Load after mount so server and first client render match.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "replace", state: { ...createState(), ...(JSON.parse(raw) as WsState) } });
    } catch {
      // Corrupt or blocked storage: keep the defaults.
    }
    setScheme(readPublishedScheme());
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

  const mutate = useCallback((fn: (s: WsState) => void) => dispatch({ type: "mutate", fn }), []);
  const ctx = useMemo(() => buildContext(state, scheme), [state, scheme]);

  const api = useMemo<WorkspaceApi>(
    () => ({
      state,
      ctx,
      setFilters: (f) => mutate((s) => void (s.filters = { ...s.filters, ...f })),
      saveView: (name) =>
        mutate((s) => {
          s.seq += 1;
          s.views.push({ id: `view-${s.seq}`, name, filters: s.filters });
          pushLog(s, `Saved view "${name}".`);
        }),
      deleteView: (id) => mutate((s) => void (s.views = s.views.filter((v) => v.id !== id))),
      assign: (code, owner, due) =>
        mutate((s) => {
          s.assignments[code] = { owner, due };
          pushLog(s, `Assigned ${code} to ${owner}, due ${due}.`);
        }),
      createDraft: (kind, codes, insightId, scope = ctx) => {
        const id = `DR-${state.seq + 1}`;
        const content = composeDraft(kind, codes, scope);
        mutate((s) => {
          s.seq += 1;
          s.drafts.unshift({ id, kind, codes, insightId, createdAt: stamp(), status: "draft", ...content });
        });
        return id;
      },
      editDraft: (id, patch) =>
        mutate((s) => {
          const d = s.drafts.find((x) => x.id === id);
          if (d?.status === "draft") Object.assign(d, patch);
        }),
      decideDraft: (id, decision) =>
        mutate((s) => {
          const d = s.drafts.find((x) => x.id === id);
          if (!d || d.status !== "draft") return;
          d.status = decision === "approve" ? "approved" : "discarded";
          d.decidedBy = CURRENT_USER;
          d.decidedAt = stamp();
          if (decision === "discard") return pushLog(s, `Discarded ${DRAFT_LABEL[d.kind].toLowerCase()} ${d.id}.`);
          applyEffect(s, d);
          if (d.insightId && !s.dismissed.includes(d.insightId)) s.dismissed.push(d.insightId);
          pushLog(s, `Approved ${DRAFT_LABEL[d.kind].toLowerCase()} ${d.id}: ${d.title}.`);
        }),
      dismissInsight: (id) => mutate((s) => void (s.dismissed.includes(id) || s.dismissed.push(id))),
      restoreInsights: () => mutate((s) => void (s.dismissed = [])),
      markRead: (ids) => mutate((s) => void (s.readNotes = [...new Set([...s.readNotes, ...ids])])),
      reset: () => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        dispatch({ type: "replace", state: createState() });
      },
    }),
    [state, ctx, mutate],
  );

  return <WorkspaceContext.Provider value={api}>{children}</WorkspaceContext.Provider>;
}

/** Record-level consequences of an approved draft. */
function applyEffect(s: WsState, d: Draft) {
  if (d.kind === "reminder") {
    for (const a of WS_ACTIONS.filter((x) => d.codes.includes(x.code))) s.reminders[a.id] = (s.reminders[a.id] ?? 0) + 1;
  }
  if (d.kind === "re-review") for (const code of d.codes) s.reviewOverrides[code] = "l1";
  if (d.kind === "return") for (const i of EVIDENCE_ISSUES.filter((x) => d.codes.includes(x.code))) s.returned.push(i.id);
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}
