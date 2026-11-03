"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/journey/icon";
import { AppShell, JMain } from "@/components/journey/shell";
import { Avatar, Field, JButton, Panel, PanelHead, Pill, inputClass } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { useAdmin } from "@/lib/admin/store";
import { useAuth } from "@/lib/auth/store";
import { shortName } from "@/lib/journey/frameworks";
import { clientHref, type Client, type Engagement } from "@/lib/journey/portfolio";
import { DEFAULT_FACTS, PROFILE_KEY } from "@/lib/journey/profile";
import { useJourney } from "@/lib/journey/store";
import { useWorkplaces } from "@/lib/journey/use-workplaces";
import { CURRENT_YEAR, duplicateOf, newWorkplaceId, type Workplace, type WorkplaceRequest } from "@/lib/journey/workplaces";
import { initials } from "@/lib/journey/work";

// Platform admin: open a workplace (one entity, one index, one review year) and choose its
// index owners. Below, the owners of every existing workplace can be changed.

/** Government entities from the reference list that are not on the platform yet. */
const REFERENCE: { id: string; ini: string; name: string; nameAr: string; type: string; parent: string; domain: string; logo: number }[] = [
  { id: "demo-housing", ini: "HA", name: "Demo Housing Authority", nameAr: "هيئة الإسكان التجريبية", type: "Authority", parent: "Demo Ministry of Services", domain: "housing.example.sa", logo: 1 },
  { id: "demo-tourism", ini: "TB", name: "Demo Tourism Board", nameAr: "مجلس السياحة التجريبي", type: "Board", parent: "Demo Ministry of Culture", domain: "tourism.example.sa", logo: 3 },
  { id: "demo-stats", ini: "SA", name: "Demo Statistics Agency", nameAr: "وكالة الإحصاء التجريبية", type: "Agency", parent: "Demo Ministry of Planning", domain: "stats.example.sa", logo: 4 },
];

const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];

export default function NewWorkplacePage() {
  const router = useRouter();
  const { clients, workplaces, saveWorkplace, update, log, state } = useJourney();
  const { state: admin } = useAdmin();
  const { users } = useAuth();
  const views = useWorkplaces();
  const owners = users.filter((u) => u.role === "owner" && u.active);
  const library = admin.frameworks.filter((f) => f.live).sort((a, b) => a.live!.name.localeCompare(b.live!.name));
  const newEntities = REFERENCE.filter((r) => !clients.some((c) => c.id === r.id));

  const [entityId, setEntityId] = useState(clients[0]?.id ?? "");
  const [frameworkId, setFrameworkId] = useState(library[0]?.id ?? "");
  const [year, setYear] = useState(CURRENT_YEAR);
  const [ownerIds, setOwnerIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [fromReq, setFromReq] = useState<string>();
  const requests = (state.workplaceRequests ?? []).filter((r) => r.status === "pending");

  const prefill = (r: WorkplaceRequest) => {
    const ref = REFERENCE.find((x) => x.name.toLowerCase() === r.entityName.toLowerCase());
    setEntityId(r.entityId ?? ref?.id ?? entityId);
    setFrameworkId(r.frameworkId);
    setYear(r.year);
    setOwnerIds([r.byId]);
    setFromReq(r.id);
    setError(r.entityId || ref ? "" : `"${r.entityName}" is not on the platform or the reference list; pick the entity it means.`);
  };

  const decide = (id: string, status: WorkplaceRequest["status"], workplaceId?: string) =>
    update((s) => {
      const r = s.workplaceRequests?.find((x) => x.id === id);
      if (r) Object.assign(r, { status, workplaceId });
    });

  const dup = duplicateOf(workplaces, entityId, frameworkId, year);
  const entityName = clients.find((c) => c.id === entityId)?.name ?? REFERENCE.find((r) => r.id === entityId)?.name ?? "";
  const fw = library.find((f) => f.id === frameworkId)?.live;
  const sorted = useMemo(() => [...views].sort((a, b) => a.entity.name.localeCompare(b.entity.name) || b.workplace.year - a.workplace.year), [views]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);

  function create() {
    if (!entityId || !frameworkId || !fw) return setError("Choose an entity and an index.");
    if (dup) return setError(`${entityName} already has ${shortName(fw.name)} for ${year}.`);
    if (!ownerIds.length) return setError("Choose at least one index owner.");
    const ref = REFERENCE.find((r) => r.id === entityId);
    let id: string;
    if (ref && !clients.some((c) => c.id === ref.id)) {
      // A new entity joins the platform with this workplace as its first.
      const client: Client = { id: ref.id, ini: ref.ini, name: ref.name, nameAr: ref.nameAr, sub: ref.type, logo: ref.logo, frameworks: [fw.name], frameworkIds: [frameworkId], pct: 0, next: "Kickoff", nextTone: "ok", flag: "active" };
      const engagement: Engagement = { clientId: ref.id, index: shortName(fw.name), frameworkId, model: "co", ready: 0, delta: "new", milestone: "Kickoff", milestoneLate: false, term: "12 months", termState: "ok", lead: "" };
      update((s) => {
        s.added.push({ client, engagement });
        s.screens[PROFILE_KEY(ref.id)] = { name: ref.name, nameAr: ref.nameAr, type: ref.type, parent: ref.parent, domain: ref.domain, facts: structuredClone(DEFAULT_FACTS) };
      });
      id = ref.id;
    } else {
      id = newWorkplaceId(entityId, frameworkId, year, workplaces.map((w) => w.id));
    }
    const w: Workplace = { id, entityId, frameworkId, year, ownerIds, createdAt: new Date().toISOString() };
    saveWorkplace(w);
    if (fromReq) decide(fromReq, "created", id);
    log(`Workplace opened: ${entityName} · ${shortName(fw.name)} · ${year}`);
    router.push(clientHref(id));
  }

  return (
    <AppShell search="Search workplaces">
      <JMain max={1100}>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-j-muted">Workplaces</span>
          <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">New workplace</h1>
          <p className="m-0 max-w-[640px] text-sm text-j-ink-3">A workplace is one entity working through one index for one review year. Its index owners run it; the entity&apos;s control owners work the requirements they are assigned.</p>
        </div>

        {requests.length > 0 && (
          <Panel className="flex flex-col p-0">
            <PanelHead title="Requests from index owners" aside={<Pill tone="warn">{requests.length} waiting</Pill>} className="px-[22px] pt-[18px] pb-3" />
            {requests.map((r) => (
              <div key={r.id} className={cx("flex flex-wrap items-center gap-3 border-t border-j-line-soft px-[22px] py-3", fromReq === r.id && "bg-cx-tint")}>
                <Avatar initials={initials(r.byName)} size={30} />
                <span className="min-w-[240px] flex-auto text-sm">
                  <b>{r.entityName}</b> · {shortName(library.find((f) => f.id === r.frameworkId)?.live?.name ?? r.frameworkId)} · {r.year}
                  <br />
                  <span className="text-xs text-j-muted">
                    {r.byName} · {r.at}
                    {r.reason ? ` · “${r.reason}”` : ""}
                  </span>
                </span>
                <JButton size="sm" variant="primary" onClick={() => prefill(r)}>
                  Fill the form
                </JButton>
                <JButton
                  size="sm"
                  onClick={() => {
                    decide(r.id, "declined");
                    if (fromReq === r.id) setFromReq(undefined);
                    log(`Declined workplace request from ${r.byName} · ${r.entityName}`);
                  }}
                >
                  Decline
                </JButton>
              </div>
            ))}
          </Panel>
        )}

        <Panel className="flex flex-col gap-5 p-[22px]">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
            <Field label="Entity">
              <select value={entityId} onChange={(e) => (setEntityId(e.target.value), setError(""))} className={inputClass}>
                <optgroup label="On the platform">
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
                {newEntities.length > 0 && (
                  <optgroup label="New entity from the reference list">
                    {newEntities.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </Field>
            <Field label="Index">
              <select value={frameworkId} onChange={(e) => (setFrameworkId(e.target.value), setError(""))} className={inputClass}>
                {library.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.live!.name} · v{f.live!.version}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Review year">
              <select value={year} onChange={(e) => (setYear(Number(e.target.value)), setError(""))} className={inputClass}>
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-2 text-[13px] font-semibold text-j-ink-2">Index owners</legend>
            <div className="flex flex-wrap gap-2">
              {owners.map((u) => {
                const on = ownerIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => (setOwnerIds(toggle(ownerIds, u.id)), setError(""))}
                    className={cx("flex h-11 cursor-pointer items-center gap-2 rounded-xl border-[1.5px] px-3 text-sm font-semibold", on ? "border-cx bg-cx-tint text-cx" : "border-j-line bg-white text-j-ink")}
                  >
                    <Avatar initials={initials(u.name)} size={26} />
                    {u.name}
                    {on && <Icon name="check" size={14} />}
                  </button>
                );
              })}
              {owners.length === 0 && <span className="text-sm text-j-muted">No index owners yet. Approve an access request with the Index owner role first.</span>}
            </div>
          </fieldset>
          {dup && (
            <p className="m-0 rounded-xl bg-[#FFF4DF] px-3.5 py-2.5 text-[13px] font-semibold text-[#8A4B00]">
              {entityName} already has this index for {year}. Choose another index or year.
            </p>
          )}
          {error && !dup && (
            <p role="alert" className="m-0 rounded-xl bg-j-bad-soft px-3.5 py-2.5 text-[13px] font-semibold text-j-bad">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <JButton variant="primary" onClick={create} disabled={!!dup}>
              <Icon name="plus" size={15} />
              Open workplace
            </JButton>
            {fw && (
              <span className="text-[13px] text-j-muted">
                {entityName} · {shortName(fw.name)} · {year} · {(fw.requirements ?? []).filter((r) => r.level === (fw.levels.find((l) => l.assessed === "accepted")?.id ?? fw.levels.at(-1)?.id)).length || "—"} requirements
              </span>
            )}
          </div>
        </Panel>

        <Panel className="flex flex-col p-0">
          <PanelHead title="Index owners of every workplace" aside={<span className="text-xs text-j-muted">{views.length} workplaces</span>} className="px-[22px] pt-[18px] pb-3" />
          {sorted.map((v) => (
            <div key={v.workplace.id} className="flex flex-wrap items-center gap-3 border-t border-j-line-soft px-[22px] py-3">
              <span className="min-w-[220px] flex-auto text-sm">
                <b>{v.entity.name}</b>
                <br />
                <span className="text-xs text-j-muted">
                  {v.framework ? shortName(v.framework.name) : v.workplace.frameworkId} · {v.workplace.year}
                </span>
              </span>
              <span className="flex flex-wrap gap-1.5">
                {owners.map((u) => {
                  const on = v.workplace.ownerIds.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      aria-pressed={on}
                      aria-label={`${u.name} owns ${v.entity.name} ${v.workplace.year}`}
                      onClick={() => {
                        saveWorkplace({ ...v.workplace, ownerIds: toggle(v.workplace.ownerIds, u.id) });
                        log(`${on ? "Removed" : "Added"} ${u.name} as index owner · ${v.entity.name} ${v.workplace.year}`);
                      }}
                      className={cx("h-8 cursor-pointer rounded-full border px-3 text-xs font-semibold", on ? "border-cx bg-cx text-white" : "border-j-line bg-white text-j-ink-3 hover:text-j-ink")}
                    >
                      {u.name}
                    </button>
                  );
                })}
                {!v.workplace.ownerIds.length && <Pill tone="bad">No owner</Pill>}
              </span>
            </div>
          ))}
        </Panel>
      </JMain>
    </AppShell>
  );
}
