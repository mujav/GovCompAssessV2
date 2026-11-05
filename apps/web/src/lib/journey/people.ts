// The client's people: stakeholders captured at onboarding (typed in or imported from a
// spreadsheet) and the only names requirements can be assigned to. One list per entity,
// read by onboarding, Entity 360 and every assignment picker.

import { DEPARTMENTS } from "@/lib/workspace/data";

export interface EntityPerson {
  id: string;
  name: string;
  email: string;
  department: string;
  /** Job title, e.g. "IT head". */
  title: string;
  /** Platform roles, e.g. "Index owner", "SPOC". */
  roles: string[];
  /** A user gets a sign-in invitation; a contact is listed only. */
  access: "user" | "contact";
}

export const PEOPLE_KEY = (clientId: string) => `people.${clientId}`;

let seq = 0;
export const personId = () => `p-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((s) => s[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

/** The demo directory the seeded clients start from (they have no onboarding record). */
export const DEMO_DIRECTORY: EntityPerson[] = Object.values(DEPARTMENTS).flatMap((d) =>
  d.people.map((name, i) => ({ id: `demo-${name}`, name, email: "", department: d.name, title: i === 0 ? "Department SPOC" : "Control Owner", roles: i === 0 ? ["SPOC"] : [], access: "user" as const })),
);

/** People shaped like the onboarding wizard stored them before details and departments existed. */
export function normalizePerson(p: Partial<EntityPerson> & { av?: string; user?: boolean }): EntityPerson {
  return {
    id: p.id ?? personId(),
    name: (p.name ?? "").trim(),
    email: (p.email ?? "").trim(),
    department: (p.department ?? "").trim(),
    title: (p.title ?? "").trim(),
    roles: p.roles ?? [],
    access: p.access ?? (p.user ? "user" : "contact"),
  };
}

/* ---------- Spreadsheet import ---------- */

const HEADERS: [keyof EntityPerson | "roles", RegExp][] = [
  ["name", /^(full ?name|name|person|employee|الاسم|الاسم الكامل)$/i],
  ["email", /^(e-?mail|work e-?mail|email address|البريد|البريد الإلكتروني)$/i],
  ["department", /^(department|dept|unit|division|sector|الإدارة|القسم|الوحدة)$/i],
  ["title", /^(title|job title|position|المسمى|المسمى الوظيفي|المنصب)$/i],
  ["roles", /^(roles?|platform roles?|responsibilit(y|ies)|الدور|الأدوار)$/i],
  ["access", /^(access|account|user|type|نوع الحساب|الصلاحية)$/i],
];

export const TEMPLATE_HEADERS = ["Name", "Email", "Department", "Title", "Roles", "Access"];
export const TEMPLATE_CSV = [
  TEMPLATE_HEADERS.join(","),
  'Abdullah M.,abdullah@entity.gov.sa,Strategy & Performance,Director of strategy,"Index Owner; Approver",User',
  "Hessa B.,hessa@entity.gov.sa,IT Operations,IT head,SPOC,User",
  "Turki Q.,,Human Capital,HR head,,Contact",
].join("\n");

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export interface PeopleImport {
  people: EntityPerson[];
  skipped: { row: number; reason: string }[];
}

/** Reads rows from a sheet (first row with a Name column is the header). Unknown columns are ignored. */
export function parsePeopleRows(rows: unknown[][]): PeopleImport {
  const cells = rows.map((r) => r.map((c) => String(c ?? "").trim()));
  const headerAt = cells.findIndex((r) => r.some((c) => HEADERS[0][1].test(c)));
  if (headerAt < 0) return { people: [], skipped: [{ row: 1, reason: "No Name column found. Use the template's headers." }] };
  const col = new Map<string, number>();
  cells[headerAt].forEach((h, i) => {
    const hit = HEADERS.find(([, re]) => re.test(h));
    if (hit && !col.has(hit[0])) col.set(hit[0], i);
  });
  const get = (r: string[], k: string) => (col.has(k) ? (r[col.get(k)!] ?? "") : "");
  const people: EntityPerson[] = [];
  const skipped: PeopleImport["skipped"] = [];
  cells.slice(headerAt + 1).forEach((r, i) => {
    const row = headerAt + i + 2;
    if (r.every((c) => !c)) return;
    const name = get(r, "name");
    const email = get(r, "email");
    if (!name) return void skipped.push({ row, reason: "No name" });
    if (email && !isEmail(email)) return void skipped.push({ row, reason: `"${email}" is not an email address` });
    const access = get(r, "access").toLowerCase();
    people.push({
      id: personId(),
      name,
      email,
      department: get(r, "department"),
      title: get(r, "title"),
      roles: get(r, "roles")
        .split(/[;,|،]/)
        .map((x) => x.trim())
        .filter(Boolean),
      access: /^(contact|no|n|false|0|جهة اتصال|لا)$/.test(access) ? "contact" : access ? "user" : email ? "user" : "contact",
    });
  });
  return { people, skipped };
}

/** Adds imported people to a list; someone already there (same email, or same name without email) is updated, not duplicated. */
export function mergePeople(list: EntityPerson[], incoming: EntityPerson[]): { list: EntityPerson[]; added: number; updated: number } {
  const out = [...list];
  let added = 0;
  let updated = 0;
  const same = (a: EntityPerson, b: EntityPerson) => (a.email && b.email ? a.email.toLowerCase() === b.email.toLowerCase() : a.name.toLowerCase() === b.name.toLowerCase());
  for (const p of incoming) {
    const i = out.findIndex((x) => same(x, p));
    if (i < 0) {
      out.push(p);
      added++;
    } else {
      const cur = out[i];
      out[i] = { ...cur, email: p.email || cur.email, department: p.department || cur.department, title: p.title || cur.title, roles: p.roles.length ? p.roles : cur.roles, access: p.access };
      updated++;
    }
  }
  return { list: out, added, updated };
}

/** Reads an uploaded .xlsx/.xls/.csv file in the browser. */
export async function readPeopleFile(file: File): Promise<PeopleImport> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return parsePeopleRows(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false }));
}
