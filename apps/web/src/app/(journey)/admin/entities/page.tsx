"use client";

import { useState } from "react";
import { AppShell, JMain } from "@/components/journey/shell";
import { Field, inputClass, JButton, JLink, Panel, PanelHead, Pill } from "@/components/journey/ui";
import { Drawer } from "@/components/overlay";
import { Modal, Row, Table, useToast } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { useAuth } from "@/lib/auth/store";
import { recordAudit } from "@/lib/audit";
import { LOGO, type Client, type Engagement } from "@/lib/journey/portfolio";
import { useJourney } from "@/lib/journey/store";
import { useWorkplaces } from "@/lib/journey/use-workplaces";
import { entityMeta, usePlatform } from "@/lib/cycle/use-cycle";
import type { AnnexList, EntityMeta, Sector } from "@/lib/cycle/platform";

const ALL = "all";
const SECTORS: Sector[] = ["Ministry", "Authority", "Agency", "Municipality"];
const LISTS: AnnexList[] = ["A", "B", "C"];

// S19 · Platform Admin: the government entities on the platform. Sector and annex list
// decide which controls apply when a workspace is created.

export default function EntitiesPage() {
  const { clients, update } = useJourney();
  const views = useWorkplaces();
  const { platform, setPlatform } = usePlatform();
  const { user } = useAuth();
  const { say, toast } = useToast();
  const [q, setQ] = useState("");
  const [sector, setSector] = useState(ALL);
  const [annex, setAnnex] = useState(ALL);
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = clients.map((c) => ({ c, m: entityMeta(platform, c), ws: views.filter((v) => v.entity.id === c.id) }));
  const shown = rows.filter((r) => (!q || `${r.c.name} ${r.m.nameAr ?? ""}`.toLowerCase().includes(q.toLowerCase())) && (sector === ALL || r.m.sector === sector) && (annex === ALL || r.m.annex === annex));
  const current = rows.find((r) => r.c.id === sel);
  const audit = (action: string, before?: string, after?: string) => recordAudit({ user: user?.name ?? "", role: "Platform Admin", type: "Settings", action, before, after });
  const cols = "2fr 1fr 0.8fr 1.4fr 0.7fr";

  const saveMeta = (id: string, m: EntityMeta) => setPlatform((d) => void (d.entities[id] = { ...d.entities[id], ...m }));

  return (
    <AppShell search="Search entities">
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Platform Admin</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Entities</h1>
            <p className="m-0 max-w-[760px] text-sm text-j-ink-3">Government entities served on the platform. Sector and annex list drive which controls apply when a workspace is created.</p>
          </div>
          <JButton variant="primary" onClick={() => setAdding(true)}>
            + Add entity
          </JButton>
        </div>
        <Panel className="flex flex-col py-[18px]">
          <PanelHead
            className="px-[22px] pb-3"
            title={`${clients.length} entities`}
            aside={
              <span className="flex flex-wrap gap-2">
                <input aria-label="Search" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputClass, "h-10 w-[200px]")} />
                <select aria-label="Sector" value={sector} onChange={(e) => setSector(e.target.value)} className={cx(inputClass, "h-10")}>
                  <option value={ALL}>All sectors</option>
                  {SECTORS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <select aria-label="Annex list" value={annex} onChange={(e) => setAnnex(e.target.value)} className={cx(inputClass, "h-10")}>
                  <option value={ALL}>All lists</option>
                  {LISTS.map((l) => (
                    <option key={l} value={l}>
                      List {l}
                    </option>
                  ))}
                </select>
              </span>
            }
          />
          <Table label="Entities" cols={cols} head={["Entity", "Sector", "Annex list", "Workspaces", "Status"]}>
            {shown.map(({ c, m, ws }) => (
              <Row key={c.id} cols={cols} onClick={() => setSel(c.id)} selected={sel === c.id}>
                <span className="flex items-center gap-2.5">
                  {m.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.logo} alt="" className="h-8 w-8 rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[11px] font-bold" style={{ background: LOGO[c.logo]?.[0], color: LOGO[c.logo]?.[1] }}>
                      {c.ini}
                    </span>
                  )}
                  <span className="min-w-0">
                    <b className="block truncate">{c.name}</b>
                    <span className="block truncate text-xs text-j-muted" dir="rtl">
                      {m.nameAr}
                    </span>
                  </span>
                </span>
                <span>{m.sector}</span>
                <span>List {m.annex}</span>
                <span className="text-[13px]">{ws.map((v) => `${v.framework?.short ?? v.client.frameworks[0]} ${v.workplace.year}`).join(", ") || "–"}</span>
                <Pill tone={m.status === "Inactive" ? "gray" : "ok"}>{m.status ?? "Active"}</Pill>
              </Row>
            ))}
          </Table>
        </Panel>
      </JMain>

      {current && (
        <EntityDrawer
          key={current.c.id}
          c={current.c}
          m={current.m}
          ws={current.ws.map((v) => ({ id: v.client.id, label: `${v.framework?.short ?? v.client.frameworks[0]} ${v.workplace.year}` }))}
          onClose={() => setSel(null)}
          onSave={(m) => {
            if (m.annex !== current.m.annex) audit(`Changed annex list of ${current.c.name}`, `List ${current.m.annex}`, `List ${m.annex}`);
            else audit(`Updated entity ${current.c.name}`);
            saveMeta(current.c.id, m);
            say(m.annex !== current.m.annex ? `Saved. Index Owners of ${current.ws.length} workspaces are asked to confirm new not-applicable items.` : "Entity saved");
            setSel(null);
          }}
        />
      )}
      <AddEntity
        open={adding}
        onClose={() => setAdding(false)}
        taken={clients.map((c) => c.id)}
        onAdd={(name, m) => {
          const id = `ent-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}`;
          const ini = name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
          const client: Client = { id, ini, name, nameAr: m.nameAr, sub: m.sector ?? "Agency", logo: clients.length % LOGO.length, frameworks: [], frameworkIds: [], pct: 0, next: "No workspace yet", nextTone: "ok", flag: "active" };
          const engagement: Engagement = { clientId: id, index: "", model: "co", ready: 0, delta: "new", milestone: "No workspace yet", milestoneLate: false, term: "", termState: "ok", lead: "" };
          update((s) => void s.added.push({ client, engagement }));
          saveMeta(id, m);
          audit(`Added entity ${name}`, undefined, `${m.sector} · List ${m.annex}`);
          say(`${name} added. Create its first workspace from Workspaces and access.`);
          setAdding(false);
        }}
      />
      {toast}
    </AppShell>
  );
}

function LogoDrop({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-j-line px-4 py-3 text-sm">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="Entity logo" className="h-10 w-10 rounded-lg object-cover" />
      ) : null}
      <span>
        Drop the entity logo here or <b className="text-cx">browse</b>
      </span>
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f || f.size > 400_000) return;
          const r = new FileReader();
          r.onload = () => onChange(String(r.result));
          r.readAsDataURL(f);
        }}
      />
    </label>
  );
}

function MetaFields({ m, set }: { m: EntityMeta; set: (m: EntityMeta) => void }) {
  return (
    <>
      <Field label="Name (Arabic)">
        <input dir="rtl" data-no-translate value={m.nameAr ?? ""} onChange={(e) => set({ ...m, nameAr: e.target.value })} className={inputClass} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Sector">
          <select value={m.sector} onChange={(e) => set({ ...m, sector: e.target.value as Sector })} className={inputClass}>
            {SECTORS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Annex list">
          <select value={m.annex} onChange={(e) => set({ ...m, annex: e.target.value as AnnexList })} className={inputClass}>
            {LISTS.map((l) => (
              <option key={l} value={l}>
                List {l}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Primary contact (email)">
        <input type="email" value={m.contact ?? ""} onChange={(e) => set({ ...m, contact: e.target.value })} className={inputClass} />
      </Field>
      <LogoDrop value={m.logo} onChange={(logo) => set({ ...m, logo })} />
    </>
  );
}

function EntityDrawer({ c, m: initial, ws, onClose, onSave }: { c: Client; m: EntityMeta; ws: { id: string; label: string }[]; onClose: () => void; onSave: (m: EntityMeta) => void }) {
  const [m, setM] = useState<EntityMeta>(initial);
  return (
    <Drawer
      open
      onClose={onClose}
      eyebrow="Entity"
      title={c.name}
      footer={
        <>
          <JButton onClick={() => setM({ ...m, status: m.status === "Inactive" ? "Active" : "Inactive" })}>{m.status === "Inactive" ? "Reactivate" : "Deactivate"}</JButton>
          <JButton variant="primary" onClick={() => onSave(m)}>
            Save changes
          </JButton>
        </>
      }
    >
      <MetaFields m={m} set={setM} />
      {m.annex !== initial.annex && <p className="m-0 rounded-xl bg-j-warn-soft px-3 py-2 text-[13px]">Changing the annex list re-checks applicability in active workspaces; Index Owners are asked to confirm any new not-applicable items.</p>}
      <div className="flex flex-col gap-1.5">
        <b className="text-[13px]">Workspaces</b>
        {ws.map((w) => (
          <span key={w.id} className="text-sm">
            {w.label}
          </span>
        ))}
        {!ws.length && <span className="text-sm text-j-muted">No workspace yet.</span>}
        <JLink size="sm" variant="outline" href={`/workplaces/new?entity=${c.id}`} className="self-start">
          + New workspace for this entity
        </JLink>
      </div>
    </Drawer>
  );
}

function AddEntity({ open, onClose, onAdd, taken }: { open: boolean; onClose: () => void; onAdd: (name: string, m: EntityMeta) => void; taken: string[] }) {
  const [name, setName] = useState("");
  const [m, setM] = useState<EntityMeta>({ sector: "Agency", annex: "C" });
  const id = `ent-${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}`;
  const dup = taken.includes(id);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add entity"
      footer={
        <>
          <JButton onClick={onClose}>Cancel</JButton>
          <JButton
            variant="primary"
            disabled={!name.trim() || dup}
            onClick={() => {
              onAdd(name.trim(), m);
              setName("");
              setM({ sector: "Agency", annex: "C" });
            }}
          >
            Save entity
          </JButton>
        </>
      }
    >
      <Field label="Name (English)">
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      {dup && <p className="m-0 text-sm text-j-bad">An entity with this name is already on the platform.</p>}
      <MetaFields m={m} set={setM} />
    </Modal>
  );
}
