"use client";

import { useState } from "react";
import { Drawer } from "@/components/overlay";
import { cx } from "@/components/ui";
import { useAdmin } from "@/lib/admin/store";
import { entityFrameworks, shortName } from "@/lib/journey/frameworks";
import { PROFILE_KEY, defaultProfile, type EntityProfile } from "@/lib/journey/profile";
import { useJourney } from "@/lib/journey/store";
import { useCurrentClient } from "./shell";
import { JButton, Pill, inputClass } from "./ui";

/** Edits the entity after onboarding: identity, profile facts and the frameworks it is managed for. */
export function EntityEditor({ open, onClose, onPeople }: { open: boolean; onClose: () => void; onPeople: () => void }) {
  const client = useCurrentClient();
  const { state, log, update } = useJourney();
  const { state: admin } = useAdmin();
  const onboarded = state.added.some((a) => a.client.id === client.id);
  const saved = state.screens[PROFILE_KEY(client.id)] as EntityProfile | undefined;
  const start = (): EntityProfile => {
    const base = saved ? structuredClone(saved) : defaultProfile(client, onboarded);
    const fws = entityFrameworks(client, admin.frameworks);
    return { ...base, frameworkIds: base.frameworkIds ?? fws.map((f) => f.id), frameworkNames: base.frameworkNames ?? fws.map((f) => f.name) };
  };
  const [p, setP] = useState<EntityProfile>(start);
  const [newFact, setNewFact] = useState("");
  const library = admin.frameworks.filter((f) => f.live);
  const ids = p.frameworkIds ?? [];
  const removed = entityFrameworks(client, admin.frameworks).filter((f) => !ids.includes(f.id));
  const valid = p.name.trim() && ids.length > 0;

  const save = () => {
    if (!valid) return;
    const names = ids.map((id) => admin.frameworks.find((f) => f.id === id)?.live?.name ?? id);
    const next: EntityProfile = { ...p, frameworkNames: names, facts: p.facts.filter(([k]) => k.trim()) };
    update((s) => void (s.screens[PROFILE_KEY(client.id)] = next));
    log(`Updated the profile of ${next.name.trim()}`);
    onClose();
  };

  const field = (k: "name" | "nameAr" | "type" | "parent" | "domain", label: string, rtl = false) => (
    <label key={k} className="flex flex-col gap-1.5 text-[13px] font-semibold">
      {label}
      <input value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} dir={rtl ? "rtl" : undefined} className={cx(inputClass, rtl && "font-arabic", k === "name" && !p.name.trim() && "border-j-bad")} />
    </label>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow="Entity profile"
      title={`Edit ${client.name}`}
      footer={
        <>
          <JButton onClick={onClose}>Cancel</JButton>
          <JButton variant="primary" onClick={save} disabled={!valid}>
            Save changes
          </JButton>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3">
          <h3 className="m-0 text-sm">Identity</h3>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
            {field("name", "Name (English)")}
            {field("nameAr", "الاسم (عربي)", true)}
            {field("type", "Entity type")}
            {field("parent", "Parent body")}
            {field("domain", "Official domain")}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-sm">Profile facts</h3>
          {p.facts.map(([k, v], i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={k}
                aria-label={`Fact ${i + 1} label`}
                onChange={(e) => setP({ ...p, facts: p.facts.map((f, j) => (j === i ? [e.target.value, f[1]] : f)) })}
                className={cx(inputClass, "w-44 flex-none")}
              />
              <input
                value={v}
                aria-label={`${k || `Fact ${i + 1}`} value`}
                onChange={(e) => setP({ ...p, facts: p.facts.map((f, j) => (j === i ? [f[0], e.target.value] : f)) })}
                className={cx(inputClass, "min-w-0 flex-auto")}
              />
              <JButton size="sm" variant="ghost" aria-label={`Remove ${k || "fact"}`} onClick={() => setP({ ...p, facts: p.facts.filter((_, j) => j !== i) })}>
                ×
              </JButton>
            </div>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newFact.trim()) return;
              setP({ ...p, facts: [...p.facts, [newFact.trim(), ""]] });
              setNewFact("");
            }}
          >
            <input value={newFact} onChange={(e) => setNewFact(e.target.value)} placeholder="New fact, e.g. Annual budget" aria-label="New fact label" className={cx(inputClass, "min-w-0 flex-auto")} />
            <JButton type="submit" size="sm" disabled={!newFact.trim()}>
              + Add fact
            </JButton>
          </form>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="m-0 text-sm">Frameworks managed for this entity</h3>
          {library.map((f) => {
            const on = ids.includes(f.id);
            return (
              <label key={f.id} className={cx("flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm", on ? "border-cx bg-cx-soft" : "border-j-line")}>
                <input type="checkbox" checked={on} onChange={() => setP({ ...p, frameworkIds: on ? ids.filter((x) => x !== f.id) : [...ids, f.id] })} className="h-4 w-4 accent-[#1E4E8C]" />
                <span className="flex-auto" dir="auto">
                  <b>{f.live!.name}</b> <span className="text-j-muted">· v{f.live!.version} · {f.live!.authority}</span>
                </span>
                {on && !entityFrameworks(client, admin.frameworks).some((x) => x.id === f.id) && <Pill tone="cx">New engagement</Pill>}
              </label>
            );
          })}
          {ids.length === 0 && <p className="m-0 text-[13px] text-j-bad">Keep at least one framework.</p>}
          {removed.length > 0 && (
            <p className="m-0 rounded-xl bg-j-warn-soft px-3 py-2 text-[13px] text-[#8A4B00]">
              Removing {removed.map((f) => shortName(f.name)).join(", ")} ends its engagement. Work already done on it is kept and comes back if you add it again.
            </p>
          )}
        </section>

        <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-j-canvas px-3.5 py-3 text-sm">
          <span>Stakeholders and people are edited on the People tab.</span>
          <JButton
            size="sm"
            onClick={() => {
              onClose();
              onPeople();
            }}
          >
            Edit people
          </JButton>
        </section>
      </div>
    </Drawer>
  );
}
