"use client";

// Accounts, access requests and the signed-in user, persisted to localStorage.

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { recordAudit } from "@/lib/audit";
import { canOpen, checkPassword, hashPassword, homeFor, isEmail, normEmail, passwordProblem, ROLE_OF, SEED_REQUESTS, SEED_USERS, type AccessRequest, type Role, type StoredUser } from "./accounts";

const STORAGE_KEY = "ci-auth-v1";
/** Session kept only for this browser tab when "Keep me signed in" is off. */
const TAB_SESSION_KEY = "ci-auth-tab-session";

interface AuthState {
  users: StoredUser[];
  requests: AccessRequest[];
  session?: string;
  /** False when the user chose not to stay signed in on this device. */
  remember?: boolean;
}

const initial = (): AuthState => ({ users: structuredClone(SEED_USERS), requests: structuredClone(SEED_REQUESTS) });

type Action = { type: "replace"; state: AuthState } | { type: "mutate"; fn: (s: AuthState) => void };

function reducer(state: AuthState, action: Action): AuthState {
  if (action.type === "replace") return action.state;
  const next = structuredClone(state);
  action.fn(next);
  return next;
}

const stamp = () => {
  const d = new Date();
  return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

let seq = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}`;

export interface Approval {
  role: Role;
  entityId?: string;
  department?: string;
}

interface AuthApi {
  /** False until stored accounts are loaded; guards wait for it. */
  ready: boolean;
  user?: StoredUser;
  users: StoredUser[];
  requests: AccessRequest[];
  signIn: (email: string, password: string, remember?: boolean) => Promise<{ ok: true; home: string } | { ok: false; error: string }>;
  signOut: () => void;
  requestAccess: (r: { name: string; email: string; organisation: string; title: string; reason: string; password: string }) => Promise<string | undefined>;
  /** Creates the account and returns its id. */
  approve: (requestId: string, a: Approval) => string;
  reject: (requestId: string, note?: string) => void;
  updateUser: (id: string, fn: (u: StoredUser) => void) => void;
  /** Creates an invited account; returns an error message or the new id. */
  invite: (u: { name: string; email: string; role: Role; entityId?: string; department?: string; title?: string; workspaceIds?: string[] }) => { error: string } | { id: string };
  /** Puts the account back on the demo password and asks the user to set a new one. */
  resetPassword: (id: string) => void;
}

const AuthContext = createContext<AuthApi | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  const [ready, setReady] = useState(false);
  const hydrated = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as AuthState;
        // Demo accounts added in later versions join the saved ones.
        const users = [...saved.users, ...SEED_USERS.filter((u) => !saved.users.some((x) => x.id === u.id))];
        const tab = sessionStorage.getItem(TAB_SESSION_KEY) ?? undefined;
        dispatch({ type: "replace", state: { ...initial(), ...saved, users, session: saved.session ?? tab } });
      }
    } catch {
      // Corrupt or blocked storage: keep the demo accounts.
    }
    hydrated.current = true;
    setReady(true);
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      // Without "Keep me signed in" the session lives only as long as this tab.
      const { session, ...rest } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.remember === false ? rest : state));
      if (state.remember === false && session) sessionStorage.setItem(TAB_SESSION_KEY, session);
      else sessionStorage.removeItem(TAB_SESSION_KEY);
    } catch {
      // Storage unavailable: state stays in memory.
    }
  }, [state]);

  const update = useCallback((fn: (s: AuthState) => void) => dispatch({ type: "mutate", fn }), []);

  const api = useMemo<AuthApi>(() => {
    const user = state.users.find((u) => u.id === state.session && u.active);
    return {
      ready,
      user,
      users: state.users,
      requests: state.requests,
      async signIn(email, password, remember = true) {
        const u = state.users.find((x) => normEmail(x.email) === normEmail(email));
        const pending = state.requests.find((r) => normEmail(r.email) === normEmail(email) && r.status !== "approved");
        if (!u) {
          if (pending?.status === "pending") return { ok: false, error: "Your access request is waiting for the Platform Admin." };
          if (pending?.status === "rejected") return { ok: false, error: "Your access request was not approved. Contact the Platform Admin." };
          return { ok: false, error: "Email or password is not right." };
        }
        if (!(await checkPassword(u, password))) return { ok: false, error: "Email or password is not right." };
        if (!u.active) return { ok: false, error: "This account is switched off. Contact the Platform Admin." };
        update((s) => {
          s.session = u.id;
          s.remember = remember;
          const me = s.users.find((x) => x.id === u.id)!;
          me.invited = false;
          me.lastActive = new Date().toISOString();
        });
        recordAudit({ user: u.name, role: ROLE_OF[u.role].label, type: "Sign-in", action: remember ? "Signed in · kept signed in on this device" : "Signed in" });
        return { ok: true, home: homeFor(u.role) };
      },
      signOut: () => update((s) => void delete s.session),
      async requestAccess(r) {
        const email = normEmail(r.email);
        if (!r.name.trim()) return "Enter your name.";
        if (!isEmail(email)) return "Enter a valid work email.";
        if (!r.organisation.trim()) return "Enter your organisation.";
        const weak = passwordProblem(r.password);
        if (weak) return weak;
        if (state.users.some((u) => normEmail(u.email) === email)) return "This email already has an account. Sign in instead.";
        if (state.requests.some((x) => normEmail(x.email) === email && x.status === "pending")) return "A request for this email is already waiting for approval.";
        const id = newId("rq");
        const passwordHash = await hashPassword(id, r.password);
        update((s) =>
          void s.requests.unshift({ id, name: r.name.trim(), email, organisation: r.organisation.trim(), title: r.title.trim(), reason: r.reason.trim(), passwordHash, salt: id, at: stamp(), status: "pending" }),
        );
        return undefined;
      },
      approve(requestId, a) {
        const id = newId("u");
        update((s) => {
          const r = s.requests.find((x) => x.id === requestId);
          if (!r || r.status !== "pending") return;
          r.status = "approved";
          r.role = a.role;
          r.decidedAt = stamp();
          r.decidedBy = s.users.find((u) => u.id === s.session)?.name;
          s.users.push({
            id,
            name: r.name,
            email: r.email,
            role: a.role,
            entityId: a.role === "control" ? a.entityId : undefined,
            department: a.department || undefined,
            title: r.title || undefined,
            // A request without a password (seeded demo) signs in with the demo password.
            ...(r.passwordHash ? { passwordHash: r.passwordHash, salt: r.salt } : {}),
            active: true,
            since: new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
          });
        });
        return id;
      },
      reject(requestId, note) {
        update((s) => {
          const r = s.requests.find((x) => x.id === requestId);
          if (!r || r.status !== "pending") return;
          r.status = "rejected";
          r.note = note?.trim() || undefined;
          r.decidedAt = stamp();
          r.decidedBy = s.users.find((u) => u.id === s.session)?.name;
        });
      },
      updateUser: (id, fn) =>
        update((s) => {
          const u = s.users.find((x) => x.id === id);
          if (u) fn(u);
        }),
      invite(n) {
        const email = normEmail(n.email);
        if (!n.name.trim()) return { error: "Enter the full name." };
        if (!isEmail(email)) return { error: "Enter a valid work email." };
        if (state.users.some((u) => normEmail(u.email) === email)) return { error: "This email already has an account." };
        const id = newId("u");
        update((s) =>
          void s.users.push({
            id,
            name: n.name.trim(),
            email,
            role: n.role,
            entityId: n.entityId,
            department: n.department || undefined,
            title: n.title || undefined,
            workspaceIds: n.workspaceIds,
            invited: true,
            active: true,
            since: new Date().toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
          }),
        );
        return { id };
      },
      resetPassword: (id) =>
        update((s) => {
          const u = s.users.find((x) => x.id === id);
          if (!u) return;
          delete u.passwordHash;
          delete u.salt;
        }),
    };
  }, [state, ready, update]);

  return <AuthContext.Provider value={api}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** The signed-in user; sends anyone else to sign in, and a role to its own home when the page is not for it. */
export function useGuard() {
  const { ready, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = !!user && canOpen(user.role, pathname);
  useEffect(() => {
    if (!ready) return;
    if (!user) router.replace("/login");
    else if (!canOpen(user.role, pathname)) router.replace(homeFor(user.role));
  }, [ready, user, pathname, router]);
  return { ready: ready && allowed, user };
}

/** Renders the page only for a signed-in user allowed to open it. */
export function Guard({ children }: { children: ReactNode }) {
  const { ready } = useGuard();
  if (!ready) return <div className="min-h-screen bg-j-canvas" aria-busy="true" />;
  return <>{children}</>;
}
