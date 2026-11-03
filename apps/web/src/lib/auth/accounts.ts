// Platform accounts: who can sign in, with which role, and the access requests the platform
// admin approves or rejects. Pure data and rules; the provider in ./store.tsx persists them.
//
// The prototype keeps accounts in the browser like the rest of its data. Passwords are only
// ever stored as salted SHA-256 hashes; a real deployment replaces this module with a server.

import { DEPARTMENTS } from "@/lib/workspace/data";

export type Role = "admin" | "owner" | "control" | "viewer";

export const ROLES: { key: Role; label: string; short: string; about: string }[] = [
  { key: "admin", label: "Platform Admin", short: "Platform Admin", about: "Creates workspaces and grants Index Owners, keeps entities, users, the standard library, AI settings and the audit trail." },
  { key: "owner", label: "Index Owner", short: "Index Owner", about: "Runs their workspaces: tailors the standard, plans the cycle, adds Control Owners and viewers, reviews every control and closes the cycle." },
  { key: "control", label: "Control Owner", short: "Control Owner", about: "Writes one response per control they own and attaches the evidence each requirement asks for." },
  { key: "viewer", label: "Management Viewer", short: "Viewer", about: "Sees the dashboard, analytics and reports of the workspaces they were granted." },
];

export const ROLE_OF: Record<Role, (typeof ROLES)[number]> = Object.fromEntries(ROLES.map((r) => [r.key, r])) as never;

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Organisation the user belongs to; control owners only see requirements of this entity. */
  entityId?: string;
  department?: string;
  title?: string;
  /** Salted hash; seeded demo accounts have none and use DEMO_PASSWORD. */
  passwordHash?: string;
  active: boolean;
  since: string;
  /** Invited and has not signed in yet. */
  invited?: boolean;
  /** ISO time of the last sign-in. */
  lastActive?: string;
  /** Management Viewers granted only some workspaces; absent means every workspace. */
  workspaceIds?: string[];
  /** Signs in with a second factor. */
  mfa?: boolean;
}

export type RequestStatus = "pending" | "approved" | "rejected";

export interface AccessRequest {
  id: string;
  name: string;
  email: string;
  organisation: string;
  title: string;
  reason: string;
  /** Hash of the password chosen when requesting; becomes the account's password on approval. */
  passwordHash: string;
  /** Salt the hash was made with (the request id); kept so the new account can verify it. */
  salt: string;
  at: string;
  status: RequestStatus;
  decidedBy?: string;
  decidedAt?: string;
  /** Role given on approval, or why it was rejected. */
  role?: Role;
  note?: string;
}

/** Password of every seeded demo account (see the README's demo section). */
export const DEMO_PASSWORD = "Demo@2026";
export const DEMO_DOMAIN = "demo.sa";

export const normEmail = (e: string) => e.trim().toLowerCase();
export const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

/** Salted SHA-256, hex. */
export async function hashPassword(salt: string, password: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${password}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Users carry their own salt: the user id, or the request id for accounts made from a request. */
export interface StoredUser extends User {
  salt?: string;
}

export async function checkPassword(u: StoredUser, password: string) {
  const expected = u.passwordHash ?? (await hashPassword(u.id, DEMO_PASSWORD));
  return (await hashPassword(u.salt ?? u.id, password)) === expected;
}

export function passwordProblem(p: string): string | undefined {
  if (p.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return "Use letters and at least one number.";
  return undefined;
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");

/** Demo accounts: one admin, three index owners, a management viewer and Demo Entity's control owners. */
export const SEED_USERS: StoredUser[] = [
  { id: "u-admin", name: "Aisha M.", email: `admin@${DEMO_DOMAIN}`, role: "admin", title: "Platform administrator", active: true, since: "Jan 2026" },
  { id: "u-sami", name: "Sami R.", email: `sami.r@${DEMO_DOMAIN}`, role: "owner", title: "Index Owner", active: true, since: "Jan 2026" },
  { id: "u-mohammed", name: "Mohammed K.", email: `mohammed.k@${DEMO_DOMAIN}`, role: "owner", title: "Index Owner", active: true, since: "Feb 2026" },
  { id: "u-layla", name: "Layla A.", email: `layla.a@${DEMO_DOMAIN}`, role: "owner", title: "Index Owner", active: true, since: "Mar 2026" },
  { id: "u-huda", name: "Huda S.", email: `huda.s@${DEMO_DOMAIN}`, role: "viewer", title: "Executive director", active: true, since: "Mar 2026", workspaceIds: ["demo-entity", "demo-ministry"] },
  ...Object.values(DEPARTMENTS).flatMap((d) =>
    d.people.map((name, i) => ({
      id: `u-${slug(name)}`,
      name,
      email: `${slug(name)}@${DEMO_DOMAIN}`,
      role: "control" as const,
      entityId: "demo-entity",
      department: d.name,
      title: i === 0 ? "Department lead" : "Contributor",
      active: true,
      since: "Apr 2026",
    })),
  ),
];

export const SEED_REQUESTS: AccessRequest[] = [
  {
    id: "rq-seed-1",
    name: "Nawaf H.",
    email: "nawaf.h@housing.example.sa",
    organisation: "Demo Housing Authority",
    title: "Transformation lead",
    reason: "I will own the Qiyas controls for digital services.",
    passwordHash: "",
    salt: "rq-seed-1",
    at: "01 Nov 10:12",
    status: "pending",
  },
];

/** Where each role lands after signing in. */
export function homeFor(role: Role) {
  return role === "admin" ? "/admin/workspaces" : role === "owner" ? "/workplaces" : role === "control" ? "/my-requirements" : "/dashboards";
}

/** Control Owner pages: their home, controls, evidence and messages, and the controls and requirements they answer. */
const CONTROL_AREAS = ["my-requirements", "my-controls", "my-evidence", "messages"];

/** Route areas each role may open. Platform Admins open everything. */
export function canOpen(role: Role, path: string) {
  if (role === "admin") return true;
  const area = path.split("/")[1] ?? "";
  if (area === "login" || area === "") return true;
  if (role === "owner") return (area === "workplaces" && !path.startsWith("/workplaces/new")) || area === "clients" || area === "dashboards";
  if (role === "control") return CONTROL_AREAS.includes(area) || /^\/clients\/[^/]+\/(requirements|controls)\/[^/]+$/.test(path);
  // Management Viewers see the dashboard, analytics and reports of a workspace.
  return area === "dashboards" || /^\/clients\/[^/]+(\/analytics)?$/.test(path);
}

/** Index owners and admins run a workplace; control owners only work their own requirements. */
export const canManage = (role: Role | undefined) => role === "admin" || role === "owner";
