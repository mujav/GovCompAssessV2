"use client";

import { useRef, useState } from "react";
import { cx } from "@/components/ui";
import { TEMPLATE_CSV, initialsOf, mergePeople, personId, readPeopleFile, type EntityPerson } from "@/lib/journey/people";
import { Icon } from "./icon";
import { Avatar, JButton, Pill, Segmented, inputClass } from "./ui";

const AV: [string, string][] = [
  ["#FDECEA", "#B42318"],
  ["#FFF4DF", "#8A4B00"],
  ["#EAF1FA", "#1E4E8C"],
  ["#E7F3ED", "#0E5A45"],
];
const ROLES = ["Index Owner", "Approver", "Executive sponsor", "DGA liaison officer", "SPOC", "Control Owner"];
const EMPTY = { name: "", email: "", department: "", title: "" };

/**
 * The entity's people: typed in one by one or imported from Excel/CSV. Requirements can be
 * assigned only to people on this list. Used by onboarding and by the entity profile.
 */
export function PeopleEditor({ people, onChange, onLog }: { people: EntityPerson[]; onChange: (next: EntityPerson[]) => void; onLog?: (text: string) => void }) {
  const [draft, setDraft] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);
  const [report, setReport] = useState<{ ok: boolean; text: string; skipped?: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const departments = [...new Set(people.map((p) => p.department).filter(Boolean))].sort();
  const users = people.filter((p) => p.access === "user").length;
  const emailOk = !draft.email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim());

  const set = (id: string, patch: Partial<EntityPerson>) => onChange(people.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const importFile = async (f: File) => {
    setBusy(true);
    try {
      const r = await readPeopleFile(f);
      const m = mergePeople(people, r.people);
      if (r.people.length) onChange(m.list);
      setReport({
        ok: r.people.length > 0,
        text: r.people.length ? `${f.name}: ${m.added} added, ${m.updated} updated${r.skipped.length ? `, ${r.skipped.length} rows skipped` : ""}.` : `${f.name}: no people imported.`,
        skipped: r.skipped.map((s) => `Row ${s.row}: ${s.reason}`),
      });
      if (r.people.length) onLog?.(`Imported ${m.added + m.updated} people from ${f.name}`);
    } catch {
      setReport({ ok: false, text: `${f.name} could not be read. Use .xlsx, .xls or .csv.` });
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob(["﻿" + TEMPLATE_CSV], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "stakeholders-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="me-auto text-xs text-j-muted">
          {people.length} people · {users} get a user account · {departments.length} departments
        </span>
        <input
          ref={file}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="sr-only"
          aria-label="Import people from Excel or CSV"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void importFile(f);
          }}
        />
        <JButton size="sm" onClick={() => file.current?.click()} disabled={busy}>
          <Icon name="download" size={14} />
          {busy ? "Reading…" : "Import Excel / CSV"}
        </JButton>
        <JButton size="sm" variant="ghost" onClick={downloadTemplate}>
          Download template
        </JButton>
      </div>
      {report && (
        <div role="status" className={cx("flex flex-col gap-1 rounded-xl px-3.5 py-2.5 text-[13px]", report.ok ? "bg-[#E7F3ED] text-[#0E5A45]" : "bg-j-warn-soft text-[#8A4B00]")}>
          <b>{report.text}</b>
          {report.skipped?.slice(0, 5).map((s) => (
            <span key={s}>{s}</span>
          ))}
          {!report.ok && <span>Columns: Name, Email, Department, Title, Roles, Access. Download the template for an example.</span>}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {people.map((p, i) => (
          <div key={p.id} className="flex flex-col gap-2 rounded-[14px] border border-j-line px-3.5 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Avatar initials={initialsOf(p.name)} bg={AV[i % 4][0]} fg={AV[i % 4][1]} size={36} />
              <span className="flex min-w-0 flex-auto flex-col gap-1">
                <b className="text-sm">
                  {p.name}
                  {p.title && <span className="font-normal text-j-muted"> · {p.title}</span>}
                </b>
                <span className="text-xs text-j-muted">
                  {[p.department || "No department", p.email || "No email"].join(" · ")}
                </span>
                {p.roles.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {p.roles.map((r) => (
                      <Pill key={r} round={false} className="py-0.5 text-[11px]">
                        {r}
                      </Pill>
                    ))}
                  </span>
                )}
              </span>
              <Segmented
                size="sm"
                label={`Access type for ${p.name}`}
                value={p.access}
                options={[
                  { value: "contact", label: "Contact" },
                  { value: "user", label: "User" },
                ]}
                onChange={(v) => set(p.id, { access: v })}
              />
              <JButton size="sm" variant="ghost" onClick={() => setEditing(editing === p.id ? null : p.id)} aria-label={`Edit ${p.name}`}>
                Edit
              </JButton>
              <JButton size="sm" variant="ghost" className="text-j-bad" onClick={() => onChange(people.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.name}`}>
                Remove
              </JButton>
            </div>
            {editing === p.id && (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-2 border-t border-j-line-soft pt-2">
                {(
                  [
                    ["name", "Name"],
                    ["email", "Work email"],
                    ["department", "Department"],
                    ["title", "Job title"],
                  ] as const
                ).map(([k, l]) => (
                  <label key={k} className="flex flex-col gap-1 text-xs font-semibold">
                    {l}
                    <input value={p[k]} onChange={(e) => set(p.id, { [k]: e.target.value })} list={k === "department" ? "people-departments" : undefined} className={cx(inputClass, "h-10 font-normal")} />
                  </label>
                ))}
                <fieldset className="col-span-full m-0 flex flex-wrap gap-1.5 border-0 p-0">
                  <legend className="mb-1 text-xs font-semibold">Platform roles</legend>
                  {ROLES.map((r) => {
                    const on = p.roles.includes(r);
                    return (
                      <button
                        key={r}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set(p.id, { roles: on ? p.roles.filter((x) => x !== r) : [...p.roles, r] })}
                        className={cx("h-8 cursor-pointer rounded-lg border px-2.5 text-xs font-semibold", on ? "border-cx bg-cx-soft text-cx" : "border-j-line bg-white text-j-ink-2")}
                      >
                        {r}
                      </button>
                    );
                  })}
                </fieldset>
              </div>
            )}
          </div>
        ))}
        {people.length === 0 && <p className="m-0 rounded-[14px] border border-dashed border-j-line px-3.5 py-4 text-sm text-j-muted">No people yet. Add them below or import the client&apos;s staff list.</p>}
      </div>

      <form
        className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] items-end gap-2 rounded-[14px] bg-j-canvas p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.name.trim() || !emailOk) return;
          const m = mergePeople(people, [{ id: personId(), name: draft.name.trim(), email: draft.email.trim(), department: draft.department.trim(), title: draft.title.trim(), roles: [], access: draft.email.trim() ? "user" : "contact" }]);
          onChange(m.list);
          setDraft(EMPTY);
        }}
      >
        {(
          [
            ["name", "Name"],
            ["email", "Work email"],
            ["department", "Department"],
            ["title", "Job title"],
          ] as const
        ).map(([k, l]) => (
          <label key={k} className="flex flex-col gap-1 text-xs font-semibold">
            {l}
            <input
              value={draft[k]}
              onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
              list={k === "department" ? "people-departments" : undefined}
              aria-invalid={k === "email" && !emailOk}
              className={cx(inputClass, "h-10 bg-white font-normal", k === "email" && !emailOk && "border-j-bad")}
            />
          </label>
        ))}
        <JButton type="submit" variant="outline" size="lg" disabled={!draft.name.trim() || !emailOk}>
          + Add person
        </JButton>
        <datalist id="people-departments">
          {departments.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
      </form>
    </div>
  );
}
