"use client";

import { useMemo, useRef, useState } from "react";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Field, inputClass, JButton, JLink, Panel, PanelHead, Pill } from "@/components/journey/ui";
import { ClosedBanner, Modal, useToast } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { useAuth } from "@/lib/auth/store";
import { useAdmin } from "@/lib/admin/store";
import { controlOf, reqLabel, sortByCode } from "@/lib/cycle/model";
import { defaultSpecs, useCycle, type ControlTailoring, type CycleControl, type DocType, type EvidenceSpec, type StandardState } from "@/lib/cycle/use-cycle";
const DOC_TYPES: DocType[] = ["Approved document", "Report", "Samples", "Screenshot", "Link"];

export default function StandardPage() {
  const cy = useCycle();
  const { controls, cycle, setCycle, framework, closed, me } = cy;
  const { user } = useAuth();
  const { state: admin } = useAdmin();
  const { say, toast } = useToast();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>(controls[0]?.code ?? "");
  const [spec, setSpec] = useState<{ control: string; spec: EvidenceSpec; isNew: boolean } | null>(null);
  const [adding, setAdding] = useState<null | { kind: "domain" | "control" | "requirement"; parent: string }>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const st = cycle.standard;

  const tailor = (code: string) => st.controls[code] ?? {};
  const specsOf = (c: CycleControl) => tailor(c.code).specs ?? defaultSpecs(c);
  const edit = (fn: (s: StandardState) => void) =>
    setCycle((d) => {
      fn(d.standard);
      d.standard.draftChanges = (d.standard.draftChanges ?? 0) + 1;
    });
  const editControl = (code: string, fn: (t: ControlTailoring) => void) => edit((s) => void fn((s.controls[code] ??= {})));

  const tree = useMemo(() => {
    const dims = new Map<string, { name: string; domains: Map<string, { name: string; controls: CycleControl[] }> }>();
    for (const c of sortByCode(controls)) {
      const d = dims.get(c.dimension) ?? { name: c.dimensionName, domains: new Map() };
      const dom = d.domains.get(c.domain) ?? { name: c.domainName, controls: [] };
      dom.controls.push(c);
      d.domains.set(c.domain, dom);
      dims.set(c.dimension, d);
    }
    return [...dims.entries()];
  }, [controls]);

  const counts = useMemo(() => {
    const domains = new Set(controls.map((c) => c.domain));
    const reqs = controls.reduce((a, c) => a + c.reqs.length, 0);
    const ev = controls.reduce((a, c) => a + specsOf(c).length, 0);
    const noEv = controls.reduce((a, c) => a + c.reqs.filter((r) => !specsOf(c).some((s) => s.req === r.code)).length, 0);
    const na = controls.filter((c) => !c.applicable).length;
    return { dims: tree.length, domains: domains.size, controls: controls.length, reqs, ev, noEv, na };
  }, [controls, tree, st]); // eslint-disable-line react-hooks/exhaustive-deps

  const c = controls.find((x) => x.code === selected) ?? controls[0];
  const libVersion = admin.frameworks.find((f) => f.id === framework?.id)?.live?.version;
  const newEdition = libVersion && st.edition && libVersion !== st.edition;
  const filtered = (x: CycleControl) => !q || `${x.code} ${x.title}`.toLowerCase().includes(q.toLowerCase());

  const publish = () => {
    const version = (st.published?.version ?? 0) + 1;
    setCycle((d) => {
      d.standard.published = { version, at: new Date().toISOString().slice(0, 10), by: me };
      d.standard.draftChanges = 0;
    });
    cy.audit("Standard", `Published the workspace standard (version ${version})`, { after: `${counts.controls} controls · ${counts.reqs} requirements · ${counts.ev} required evidence` });
    say(`Standard published · version ${version}`);
  };

  const importExcel = async (file: File) => {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]]);
    let n = 0;
    const byControl = new Map<string, EvidenceSpec[]>();
    for (const r of rows) {
      const req = String(r["Requirement"] ?? r["Requirement code"] ?? r["code"] ?? "").trim();
      const title = String(r["Evidence"] ?? r["Required evidence"] ?? r["title"] ?? "").trim();
      const ctl = controls.find((x) => x.code === controlOf(req));
      if (!req || !title || !ctl) continue;
      const list = byControl.get(ctl.code) ?? [...specsOf(ctl)];
      list.push({
        id: `E${list.length + 1}`,
        req,
        title,
        docType: (DOC_TYPES.find((t) => t.toLowerCase() === String(r["Document type"] ?? "").toLowerCase()) ?? "Approved document") as DocType,
        freshness: Number(r["Freshness"] ?? 12) || 12,
        minSamples: Number(r["Minimum samples"] ?? 0) || 0,
        format: (["PDF", "Excel"].includes(String(r["Format"])) ? r["Format"] : "Any") as EvidenceSpec["format"],
        approval: /^(y|yes|true|1)$/i.test(String(r["Approval"] ?? "")),
        pageRef: /^(y|yes|true|1)$/i.test(String(r["Page reference"] ?? "")),
        govVerified: false,
      });
      byControl.set(ctl.code, list);
      n++;
    }
    for (const [code, list] of byControl) editControl(code, (t) => void (t.specs = list));
    say(n ? `Imported ${n} required evidence items into ${byControl.size} controls` : "No rows matched. Use the columns Requirement, Evidence, Document type, Freshness, Minimum samples, Format, Approval, Page reference.");
  };

  return (
    <ClientShell search="Search the standard">
      <JMain max={1440}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-j-muted">Standard</span>
            <h1 className="m-0 text-[26px] leading-8 font-bold" dir="auto">
              {framework?.name ?? cy.workspace}
            </h1>
            <span className="text-sm text-j-ink-3" dir="rtl">
              {framework?.live.levels.map((l) => l.ar).filter(Boolean).join(" · ")}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {st.draftChanges > 0 && <Pill tone="warn">{st.draftChanges} unpublished changes</Pill>}
            {st.published && (
              <Pill tone="ok">
                Version {st.published.version} · {st.published.at}
              </Pill>
            )}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => e.target.files?.[0] && void importExcel(e.target.files[0])} />
            <JButton disabled={closed} onClick={() => fileRef.current?.click()}>
              Import Excel
            </JButton>
            {user?.role === "admin" ? (
              <JLink href="/studio/frameworks">Parse PDF with AI</JLink>
            ) : (
              <JButton disabled title="The Standard Parser drafts new editions in the Standard library (Platform Admin).">
                Parse PDF with AI
              </JButton>
            )}
            <JButton variant="primary" disabled={closed || !st.draftChanges} onClick={publish}>
              Publish
            </JButton>
          </div>
        </div>
        <ClosedBanner show={closed} />
        {newEdition && (
          <p className="m-0 flex flex-wrap items-center gap-3 rounded-xl bg-cx-tint px-4 py-3 text-sm">
            Edition {libVersion} of this standard is published in the library; this workspace uses edition {st.edition}.
            <JButton
              size="sm"
              variant="primary"
              disabled={closed}
              onClick={() => {
                edit((s) => void (s.edition = libVersion));
                cy.audit("Standard", `Adopted library edition ${libVersion}`, { before: st.edition, after: libVersion });
                say(`Edition ${libVersion} adopted. Your tailoring is kept.`);
              }}
            >
              Adopt edition {libVersion}
            </JButton>
            <JLink size="sm" href="/studio/history" className={cx(user?.role !== "admin" && "hidden")}>
              Review change log
            </JLink>
          </p>
        )}

        <section className="flex flex-wrap gap-2.5">
          {[
            ["Dimensions", counts.dims, "منظور"],
            ["Domains", counts.domains, "محور"],
            ["Controls", counts.controls, "معيار"],
            ["Requirements", counts.reqs, "متطلب"],
            ["Required evidence", counts.ev, "مستند إثبات"],
          ].map(([l, n, ar]) => (
            <span key={l as string} className="flex min-w-[130px] flex-[1_1_130px] flex-col rounded-[14px] border border-j-line bg-white px-3.5 py-2.5">
              <span className="text-xs text-j-muted">{l}</span>
              <b className="text-xl">{n}</b>
              <span className="text-xs text-j-muted" dir="rtl" data-no-translate>
                {ar}
              </span>
            </span>
          ))}
          <span className={cx("flex min-w-[220px] flex-[2_1_220px] flex-col rounded-[14px] px-3.5 py-2.5", counts.noEv ? "bg-j-warn-soft" : "bg-[#E7F3ED]")}>
            <span className="text-xs text-j-muted">Checks</span>
            <b className="text-sm">
              {counts.noEv} requirements without evidence · {counts.na} not applicable
            </b>
          </span>
        </section>

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="flex min-w-0 flex-[1_1_320px] flex-col gap-2 p-[18px] lg:max-w-[420px]">
            <input aria-label="Search the standard" placeholder="Search the standard" value={q} onChange={(e) => setQ(e.target.value)} className={cx(inputClass, "h-10")} />
            <div className="flex max-h-[720px] flex-col overflow-y-auto text-sm">
              {tree.map(([dk, d]) => {
                const dOpen = open.includes(dk) || !!q;
                return (
                  <div key={dk} className="flex flex-col">
                    <button type="button" onClick={() => setOpen(open.includes(dk) ? open.filter((x) => x !== dk) : [...open, dk])} className="flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-2 text-start font-semibold hover:bg-j-canvas">
                      <span className="w-3">{dOpen ? "▾" : "▸"}</span>
                      <span className="flex-auto">
                        {dk} {d.name}
                      </span>
                      <span className="text-xs font-normal text-j-muted">{d.domains.size} domains</span>
                    </button>
                    {dOpen &&
                      [...d.domains.entries()].map(([mk, m]) => {
                        const list = m.controls.filter(filtered);
                        if (!list.length) return null;
                        const mOpen = open.includes(mk) || !!q;
                        return (
                          <div key={mk} className="flex flex-col ps-4">
                            <button type="button" onClick={() => setOpen(open.includes(mk) ? open.filter((x) => x !== mk) : [...open, mk])} className="flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-1.5 text-start hover:bg-j-canvas">
                              <span className="w-3">{mOpen ? "▾" : "▸"}</span>
                              <span className="flex-auto font-semibold">{m.name.startsWith("Domain") ? m.name : `${mk} ${m.name}`}</span>
                              <span className="text-xs text-j-muted">{m.controls.length} controls</span>
                            </button>
                            {mOpen &&
                              list.map((x) => {
                                const gaps = x.reqs.filter((r) => !specsOf(x).some((s) => s.req === r.code)).length;
                                return (
                                  <button
                                    key={x.code}
                                    type="button"
                                    onClick={() => setSelected(x.code)}
                                    className={cx("ms-5 flex cursor-pointer items-center gap-2 rounded-lg border-0 px-2 py-1.5 text-start", x.code === c?.code ? "bg-cx-soft text-cx" : "bg-transparent hover:bg-j-canvas", !x.applicable && "text-j-muted")}
                                  >
                                    <span className="flex-auto">
                                      <span className="font-mono text-xs">{x.code}</span> {x.title}
                                    </span>
                                    <span className="text-xs text-j-muted">
                                      {x.reqs.length} req{gaps ? ` · ${gaps} gap` : ""}
                                      {!x.applicable ? " · N/A" : ""}
                                    </span>
                                  </button>
                                );
                              })}
                            {mOpen && !closed && (
                              <button type="button" onClick={() => setAdding({ kind: "control", parent: mk })} className="ms-5 cursor-pointer self-start border-0 bg-transparent px-2 py-1 text-xs font-semibold text-cx">
                                + Control
                              </button>
                            )}
                          </div>
                        );
                      })}
                    {dOpen && !closed && (
                      <button type="button" onClick={() => setAdding({ kind: "domain", parent: dk })} className="ms-4 cursor-pointer self-start border-0 bg-transparent px-2 py-1 text-xs font-semibold text-cx">
                        + Domain
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>

          {c && (
            <div className="flex min-w-0 flex-[2.2_1_560px] flex-col gap-3.5">
              <Panel className="flex flex-col gap-3 p-[22px]">
                <span className="text-xs text-j-muted">
                  Dimension {c.dimension} › Domain {c.domain} › Control
                </span>
                <input
                  aria-label="Control title"
                  disabled={closed}
                  defaultValue={c.title}
                  key={`t-${c.code}`}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== c.title && edit((s) => void ((s.names ??= {})[c.code] = e.target.value.trim()))}
                  className="rounded-lg border border-transparent px-1 text-xl font-bold hover:border-j-line"
                />
                <input
                  aria-label="Arabic title"
                  dir="rtl"
                  data-no-translate
                  disabled={closed}
                  defaultValue={tailor(c.code).titleAr ?? ""}
                  key={`ar-${c.code}`}
                  placeholder="العنوان بالعربية"
                  onBlur={(e) => e.target.value !== (tailor(c.code).titleAr ?? "") && editControl(c.code, (t) => void (t.titleAr = e.target.value))}
                  className="rounded-lg border border-transparent px-1 text-base text-j-ink-2 hover:border-j-line"
                />
                <span className="flex flex-wrap gap-1.5">
                  <Pill tone={c.applicable ? "ok" : "gray"}>{c.applicable ? "Applicable" : "Not applicable"}</Pill>
                  <Pill>
                    {c.reqs.length} requirements · {specsOf(c).length} evidence
                  </Pill>
                </span>
                <Field label="Objective">
                  <textarea
                    rows={2}
                    disabled={closed}
                    key={`o-${c.code}`}
                    defaultValue={tailor(c.code).objective ?? ""}
                    placeholder="What the control establishes, e.g. the components and governance of the system, roles and responsibilities."
                    onBlur={(e) => e.target.value !== (tailor(c.code).objective ?? "") && editControl(c.code, (t) => void (t.objective = e.target.value))}
                    className="rounded-xl border border-j-line p-3 font-sans text-sm font-normal"
                  />
                </Field>
              </Panel>

              <Panel className="flex flex-col gap-1 p-[22px]">
                <PanelHead
                  title="Requirements and required evidence"
                  aside={
                    !closed && (
                      <JButton size="sm" variant="outline" onClick={() => setAdding({ kind: "requirement", parent: c.code })}>
                        + Requirement
                      </JButton>
                    )
                  }
                />
                {c.reqs.map((r) => {
                  const list = specsOf(c).filter((s) => s.req === r.code);
                  return (
                    <div key={r.code} className="flex flex-col gap-1.5 border-b border-j-line-soft py-3 last:border-0">
                      <span className="flex flex-wrap items-center gap-2 text-sm">
                        <b className="font-mono text-xs">{reqLabel(r.code)}</b>
                        <span className="flex-auto">{r.title}</span>
                        {!list.length && <Pill tone="warn">No evidence</Pill>}
                      </span>
                      {list.map((s) => (
                        <button key={s.id} type="button" disabled={closed} onClick={() => setSpec({ control: c.code, spec: s, isNew: false })} className="ms-6 flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border-0 bg-j-canvas px-2.5 py-1.5 text-start text-[13px] hover:bg-cx-tint">
                          <b className="font-mono text-xs">{s.id}</b>
                          <span className="flex-auto">· {s.title}</span>
                          <span className="text-xs text-j-muted">
                            {s.docType} · {s.freshness} months{s.approval ? " · approval" : ""}
                            {s.pageRef ? " · page ref" : ""}
                            {s.minSamples ? ` · ${s.minSamples} samples` : ""}
                            {s.govVerified ? " · verified by the governing body" : ""}
                          </span>
                        </button>
                      ))}
                      {!closed && (
                        <button
                          type="button"
                          onClick={() => setSpec({ control: c.code, isNew: true, spec: { id: `E${specsOf(c).length + 1}`, req: r.code, title: "", docType: "Approved document", freshness: 12, minSamples: 0, format: "Any", approval: false, pageRef: false, govVerified: false } })}
                          className="ms-6 cursor-pointer self-start border-0 bg-transparent p-0 text-xs font-semibold text-cx"
                        >
                          + Required evidence
                        </button>
                      )}
                    </div>
                  );
                })}
              </Panel>

              <div className="flex flex-wrap items-start gap-3.5">
                <Panel className="flex min-w-0 flex-[1_1_300px] flex-col gap-2 p-[22px]">
                  <PanelHead title="Applicability of this control" />
                  <Applicability key={c.code} control={c} reason={cycle.plan[c.code]?.na?.reason} closed={closed} onChange={(na) => (cy.updatePlan([c.code], { na }, na ? "Not applicable in this workspace" : "Applicable again", 0), say(na ? `${c.code} is not applicable in this workspace` : `${c.code} is applicable again`))} />
                </Panel>
              </div>

              <Panel className="flex flex-col gap-2 p-[22px]">
                <PanelHead title="References" />
                {(tailor(c.code).references ?? []).map((r, i) => (
                  <span key={i} className="flex items-center gap-2 text-sm">
                    <span className="flex-auto">{r}</span>
                    {!closed && (
                      <JButton size="sm" variant="ghost" aria-label={`Remove ${r}`} onClick={() => editControl(c.code, (t) => void (t.references = (t.references ?? []).filter((_, j) => j !== i)))}>
                        ✕
                      </JButton>
                    )}
                  </span>
                ))}
                {!closed && (
                  <input
                    aria-label="Add reference"
                    placeholder="Add a reference, e.g. DGA circular 2044 (1443/12/28) – press Enter"
                    onKeyDown={(e) => {
                      const v = (e.target as HTMLInputElement).value.trim();
                      if (e.key === "Enter" && v) {
                        editControl(c.code, (t) => void (t.references = [...(t.references ?? []), v]));
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                    className={cx(inputClass, "h-10")}
                  />
                )}
              </Panel>
            </div>
          )}
        </div>
      </JMain>

      {spec && (
        <SpecDialog
          value={spec.spec}
          isNew={spec.isNew}
          onClose={() => setSpec(null)}
          onSave={(v) => {
            const ctl = controls.find((x) => x.code === spec.control)!;
            const list = specsOf(ctl);
            editControl(spec.control, (t) => void (t.specs = spec.isNew ? [...list, v] : list.map((s) => (s.id === v.id ? v : s))));
            setSpec(null);
          }}
          onRemove={
            spec.isNew
              ? undefined
              : () => {
                  const ctl = controls.find((x) => x.code === spec.control)!;
                  editControl(spec.control, (t) => void (t.specs = specsOf(ctl).filter((s) => s.id !== spec.spec.id)));
                  setSpec(null);
                }
          }
        />
      )}
      {adding && (
        <AddDialog
          kind={adding.kind}
          parent={adding.parent}
          controls={controls}
          onClose={() => setAdding(null)}
          onAdd={(code, title, reqTitle, groupCode) => {
            const ctl = controls.find((x) => x.code === controlOf(code));
            const dimension = ctl?.reqs[0]?.domain ?? controls.find((x) => x.dimension === code.split(".")[0])?.reqs[0]?.domain ?? "";
            edit((s) => {
              (s.added ??= {})[code] = { title: reqTitle, dimension };
              if (groupCode) (s.names ??= {})[groupCode] = title;
              if (adding.kind === "domain") s.names![controlOf(code)] = reqTitle.split(":")[0];
            });
            if (adding.kind !== "requirement") setSelected(controlOf(code));
            say(`${adding.kind === "requirement" ? "Requirement" : adding.kind === "control" ? "Control" : "Domain"} ${groupCode ?? code} added. Publish to make it live.`);
            setAdding(null);
          }}
        />
      )}
      {toast}
    </ClientShell>
  );
}

function Applicability({ control, reason, closed, onChange }: { control: CycleControl; reason?: string; closed: boolean; onChange: (na: string | null) => void }) {
  const [na, setNa] = useState(!control.applicable);
  const [why, setWhy] = useState(reason ?? "");
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name={`app-${control.code}`} disabled={closed} checked={!na} onChange={() => (setNa(false), !control.applicable && onChange(null))} /> Applicable
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name={`app-${control.code}`} disabled={closed} checked={na} onChange={() => setNa(true)} /> Not applicable
      </label>
      {na && (
        <span className="flex flex-col gap-1.5 ps-6">
          <input aria-label="Reason" disabled={closed} value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Reason, e.g. the entity does not run this service" className={cx(inputClass, "h-10")} />
          <JButton size="sm" variant="primary" className="self-start" disabled={closed || !why.trim() || (!control.applicable && why.trim() === (reason ?? ""))} onClick={() => onChange(why.trim())}>
            {control.applicable ? "Mark not applicable" : "Update reason"}
          </JButton>
        </span>
      )}
    </>
  );
}

function SpecDialog({ value, isNew, onClose, onSave, onRemove }: { value: EvidenceSpec; isNew: boolean; onClose: () => void; onSave: (v: EvidenceSpec) => void; onRemove?: () => void }) {
  const [v, setV] = useState(value);
  const check = (k: "approval" | "pageRef" | "govVerified", l: string) => (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.checked })} /> {l}
    </label>
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? "Required evidence" : `${v.id} · required evidence`}
      sub={`For ${reqLabel(v.req)} (${v.req})`}
      footer={
        <>
          {onRemove && (
            <JButton variant="ghost" onClick={onRemove}>
              Remove
            </JButton>
          )}
          <JButton onClick={onClose}>Cancel</JButton>
          <JButton variant="primary" disabled={!v.title.trim()} onClick={() => onSave({ ...v, title: v.title.trim() })}>
            Save and close
          </JButton>
        </>
      }
    >
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <Field label="Code">
          <input value={v.id} onChange={(e) => setV({ ...v, id: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Required evidence">
          <input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="Approved committee charter" className={inputClass} />
        </Field>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Field label="Document type">
          <select value={v.docType} onChange={(e) => setV({ ...v, docType: e.target.value as DocType })} className={inputClass}>
            {DOC_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Freshness (months)">
          <input type="number" min={0} value={v.freshness} onChange={(e) => setV({ ...v, freshness: Number(e.target.value) })} className={inputClass} />
        </Field>
        <Field label="Minimum samples">
          <input type="number" min={0} value={v.minSamples} onChange={(e) => setV({ ...v, minSamples: Number(e.target.value) })} className={inputClass} />
        </Field>
        <Field label="Format">
          <select value={v.format} onChange={(e) => setV({ ...v, format: e.target.value as EvidenceSpec["format"] })} className={inputClass}>
            <option>Any</option>
            <option>PDF</option>
            <option>Excel</option>
          </select>
        </Field>
      </div>
      {check("approval", "Approval or signature required")}
      {check("pageRef", "Page or section reference required (documents over 20 pages)")}
      {check("govVerified", "Verified by the governing body – no upload")}
    </Modal>
  );
}

function AddDialog({ kind, parent, controls, onClose, onAdd }: { kind: "domain" | "control" | "requirement"; parent: string; controls: CycleControl[]; onClose: () => void; onAdd: (reqCode: string, groupTitle: string, reqTitle: string, groupCode?: string) => void }) {
  const next = (prefix: string, taken: string[]) => {
    let n = 1;
    while (taken.includes(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  };
  const code =
    kind === "requirement"
      ? next(`${parent}-`, controls.find((c) => c.code === parent)?.reqs.map((r) => r.code) ?? [])
      : kind === "control"
        ? next(`${parent}.`, controls.filter((c) => c.domain === parent).map((c) => c.code))
        : next(`${parent}.`, [...new Set(controls.filter((c) => c.dimension === parent).map((c) => c.domain))]);
  const [title, setTitle] = useState("");
  const [req, setReq] = useState("");
  return (
    <Modal
      open
      onClose={onClose}
      title={kind === "requirement" ? `Add requirement to ${parent}` : kind === "control" ? `Add control to domain ${parent}` : `Add domain to dimension ${parent}`}
      sub={`New code ${kind === "requirement" ? code : kind === "control" ? code : `${code} (first control ${code}.1)`}`}
      footer={
        <>
          <JButton onClick={onClose}>Cancel</JButton>
          <JButton
            variant="primary"
            disabled={!(kind === "requirement" ? req.trim() : title.trim() && req.trim())}
            onClick={() => {
              if (kind === "requirement") onAdd(code, "", req.trim());
              else if (kind === "control") onAdd(`${code}-1`, title.trim(), `${title.trim()}: ${req.trim()}`, code);
              else onAdd(`${code}.1-1`, title.trim(), `${req.trim()}`, code);
            }}
          >
            Add
          </JButton>
        </>
      }
    >
      {kind !== "requirement" && (
        <Field label={kind === "control" ? "Control title" : "Domain title"}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>
      )}
      <Field label={kind === "domain" ? "First control title" : kind === "control" ? "First requirement" : "Requirement"}>
        <input value={req} onChange={(e) => setReq(e.target.value)} className={inputClass} />
      </Field>
    </Modal>
  );
}
