"use client";

// Client-side store for the consultant journey (dummy data, persisted to localStorage).
// Screens keep their own slices here so work done on one screen shows on the others.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { CLIENTS, ENGAGEMENTS, type Client, type Engagement } from "./portfolio";

const STORAGE_KEY = "ci-journey-v1";

export interface JourneyState {
  /** Clients onboarded in this demo, waiting for activation. */
  added: { client: Client; engagement: Engagement }[];
  /** Free-form per-screen state, keyed by screen. */
  screens: Record<string, unknown>;
  log: { at: string; text: string }[];
}

const initial = (): JourneyState => ({ added: [], screens: {}, log: [] });

type Action = { type: "replace"; state: JourneyState } | { type: "mutate"; fn: (s: JourneyState) => void };

function reducer(state: JourneyState, action: Action): JourneyState {
  if (action.type === "replace") return action.state;
  const next = structuredClone(state);
  action.fn(next);
  return next;
}

function stamp(d = new Date()) {
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

interface JourneyApi {
  state: JourneyState;
  clients: Client[];
  engagements: Engagement[];
  update: (fn: (s: JourneyState) => void) => void;
  log: (text: string) => void;
  reset: () => void;
}

const JourneyContext = createContext<JourneyApi | null>(null);

export function JourneyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const hydrated = useRef(false);

  // Load after mount so server and first client render match.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "replace", state: { ...initial(), ...(JSON.parse(raw) as JourneyState) } });
    } catch {
      // Corrupt or blocked storage: keep the defaults.
    }
    hydrated.current = true;
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable: state stays in memory.
    }
  }, [state]);

  const update = useCallback((fn: (s: JourneyState) => void) => dispatch({ type: "mutate", fn }), []);

  const api = useMemo<JourneyApi>(
    () => ({
      state,
      clients: [...CLIENTS, ...state.added.map((a) => a.client)],
      engagements: [...ENGAGEMENTS, ...state.added.map((a) => a.engagement)],
      update,
      log: (text) => update((s) => void s.log.unshift({ at: stamp(), text })),
      reset: () => {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
        dispatch({ type: "replace", state: initial() });
      },
    }),
    [state, update],
  );

  return <JourneyContext.Provider value={api}>{children}</JourneyContext.Provider>;
}

export function useJourney() {
  const ctx = useContext(JourneyContext);
  if (!ctx) throw new Error("useJourney must be used inside <JourneyProvider>");
  return ctx;
}

/** Per-screen state slice with a default, persisted with the rest of the journey. */
export function useScreenState<T>(key: string, fallback: T): [T, (fn: (draft: T) => void) => void] {
  const { state, update } = useJourney();
  const value = (state.screens[key] as T | undefined) ?? fallback;
  const set = useCallback(
    (fn: (draft: T) => void) =>
      update((s) => {
        const draft = (s.screens[key] as T | undefined) ?? structuredClone(fallback);
        fn(draft);
        s.screens[key] = draft;
      }),
    // `fallback` is a literal per call site; the key identifies the slice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, update],
  );
  return [value, set];
}
