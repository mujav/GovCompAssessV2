"use client";

import { Fragment, useMemo, useState } from "react";
import { ClientShell, JMain } from "@/components/journey/shell";
import { inputClass, JButton, Panel, PanelHead } from "@/components/journey/ui";
import { downloadCsv, Row, Table, TierPill } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import type { Control } from "@/lib/cycle/model";
import { useCycle } from "@/lib/cycle/use-cycle";
import { PRIOR_CYCLE } from "@/lib/workspace/data";
import { recordAudit } from "@/lib/audit";

const ALL = "all";
const pct = (met: number, total: number) => (total ? Math.round((met / total) * 100) : null);

/** Red → amber → green for a compliance rate. */
function heat(v: number | null) {
  if (v == null) return { background: "#F5F7F6", color: "#9AA5A0" };
  if (v >= 85) return { background: "#CDEBDD", color: "#0E5A45" };
  if (v >= 70) return { background: "#E6F2DA", color: "#3B6B1E" };
  if (v >= 50) return { background: "#FFF1CF", color: "#8A4B00" };
  return { background: "#FBD9D3", color: "#B42318" };
}

/** Share of last cycle's results that were fully compliant, as a rate. */
function previousRate(controls: Control[]) {
  const rs = controls.flatMap((c) => c.reqs.map((r) => r.status)).filter((s) => s === "comp" || s === "part" || s === "non");
  return rs.length ? Math.round((rs.filter((s) => s === "comp").length / rs.length) * 100) : null;
}

export default function AnalyticsPage() {
  const cy = useCycle();
  const { controls, cycle, summary, client, label, me, role } = cy;
  const [dim, setDim] = useState(ALL);
  const [dept, setDept] = useState(ALL);
  const [owner, setOwner] = useState(ALL);
  const [open, setOpen] = useState<string[]>([]);

  const live = controls.filter((c) => c.applicable);
  const dims = [...new Map(live.map((c) => [c.dimension, c.dimensionName])).entries()];
  const depts = [...new Set(live.map((c) => c.department).filter(Boolean))].sort();
  const owners = [...new Set(live.map((c) => c.owner).filter(Boolean))].sort();
  const rows = live.filter((c) => (dim === ALL || c.dimension === dim) && (dept === ALL || c.department === dept) && (owner === ALL || c.owner === owner));

  // Requirements count towards the department that owns them.
  const cell = (d: string, k: string) => {
    let met = 0;
    let total = 0;
    for (const c of rows)
      if (c.dimension === k)
        for (const r of c.reqs)
          if (r.status !== "na" && r.department === d) {
            total++;
            if (r.stage === "accepted" && cycle.reviews[c.code]?.decisions[r.code] !== "not") met++;
          }
    return pct(met, total);
  };

  const tree = useMemo(() => {
    const byDim = new Map<string, Control[]>();
    for (const c of rows) byDim.set(c.dimension, [...(byDim.get(c.dimension) ?? []), c]);
    return [...byDim.entries()].map(([k, list]) => {
      const byDom = new Map<string, Control[]>();
      for (const c of list) byDom.set(c.domain, [...(byDom.get(c.domain) ?? []), c]);
      return { key: k, name: list[0].dimensionName, list, domains: [...byDom.entries()].map(([d, l]) => ({ key: d, name: l[0].domainName, list: l })) };
    });
  }, [rows]);

  const agg = (list: Control[]) => {
    const met = list.reduce((a, c) => a + c.met, 0);
    const total = list.reduce((a, c) => a + c.total, 0);
    return {
      met,
      total,
      rate: pct(met, total),
      prev: previousRate(list),
      depts: [...new Set(list.map((c) => c.department).filter(Boolean))].join(", "),
      owners: [...new Set(list.map((c) => c.owner).filter(Boolean))].join(", "),
    };
  };

  const byOwner = owners
    .map((o) => {
      const mine = rows.filter((c) => c.owner === o);
      const reqs = mine.reduce((a, c) => a + c.total, 0);
      const accepted = mine.filter((c) => c.stage === "accepted");
      const ftr = accepted.length ? Math.round((accepted.filter((c) => !(cycle.reviews[c.code]?.returns ?? 0) && !c.reqs.some((r) => r.work === "returned")).length / accepted.length) * 100) : null;
      return {
        o,
        dept: mine[0]?.department ?? "",
        reqs,
        submitted: mine.reduce((a, c) => a + c.submitted, 0),
        met: mine.reduce((a, c) => a + c.met, 0),
        notMet: mine.reduce((a, c) => a + c.reqs.filter((r) => r.stage === "returned" || cycle.reviews[c.code]?.decisions[r.code] === "not").length, 0),
        ftr,
      };
    })
    .filter((x) => x.reqs);

  const prior = client.id === client.entityId && client.frameworkId === "fw-qiyas" ? PRIOR_CYCLE.at(-1)! : null;
  const lastNon = live.filter((c) => c.previous === "Non");
  const nowFull = lastNon.filter((c) => c.stage === "accepted" && c.met === c.total);
  const toggle = (k: string) => setOpen(open.includes(k) ? open.filter((x) => x !== k) : [...open, k]);

  const exportCsv = () => {
    downloadCsv(`analytics-${client.id}.csv`, [
      ["Control", "Title", "Dimension", "Domain", "Department", "Owner", "Requirements met", "Requirements", "Compliance rate", "Previous result"],
      ...rows.map((c) => [c.code, c.title, c.dimensionName, c.domain, c.department, c.owner, c.met, c.total, `${pct(c.met, c.total) ?? 0}%`, c.previous ?? "–"]),
    ]);
    recordAudit({ user: me, role, type: "Export", action: "Exported analytics CSV", workspace: label, after: `${rows.length} controls` });
  };

  const cols = "2.4fr 0.9fr 0.8fr 0.8fr 1.5fr 1.5fr";

  return (
    <ClientShell search="Search controls">
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Analytics · {label}</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Where compliance is won and lost</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Dimension" value={dim} onChange={(e) => setDim(e.target.value)} className={cx(inputClass, "h-10")}>
              <option value={ALL}>All dimensions</option>
              {dims.map(([k, n]) => (
                <option key={k} value={k}>
                  {k} {n}
                </option>
              ))}
            </select>
            <select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} className={cx(inputClass, "h-10")}>
              <option value={ALL}>All departments</option>
              {depts.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} className={cx(inputClass, "h-10")}>
              <option value={ALL}>All owners</option>
              {owners.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
            <JButton onClick={exportCsv}>Export</JButton>
          </div>
        </div>

        <Panel className="flex flex-col gap-3 p-[22px]">
          <PanelHead
            title="Compliance rate · department × dimension"
            aside={
              <span className="flex items-center gap-1.5 text-xs text-j-muted">
                0% <span className="h-2 w-24 rounded-full" style={{ background: "linear-gradient(90deg,#FBD9D3,#FFF1CF,#E6F2DA,#CDEBDD)" }} /> 100%
              </span>
            }
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-separate border-spacing-1 text-[13px]">
              <thead>
                <tr>
                  <th className="text-start font-semibold text-j-muted" />
                  {dims.filter(([k]) => dim === ALL || k === dim).map(([k, n]) => (
                    <th key={k} className="max-w-[110px] px-1 text-start align-bottom text-xs font-semibold text-j-ink-2">
                      {k} {n}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {depts.filter((d) => dept === ALL || d === dept).map((d) => (
                  <tr key={d}>
                    <th className="pe-2 text-start font-semibold whitespace-nowrap">{d}</th>
                    {dims.filter(([k]) => dim === ALL || k === dim).map(([k]) => {
                      const v = cell(d, k);
                      return (
                        <td key={k} className="h-10 rounded-lg text-center font-semibold" style={heat(v)}>
                          {v == null ? "–" : `${v}%`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="py-[18px]">
          <PanelHead className="px-[22px] pb-2" title="Drill-down · dimension › domain › control" />
          <Table label="Drill-down" cols={cols} min={900} head={["Item", "Requirements met", "Compliance rate", "Previous result", "Owning department", "Owner"]}>
            {tree.map((t) => {
              const a = agg(t.list);
              const on = open.includes(t.key);
              return (
                <Fragment key={t.key}>
                  <Row cols={cols} onClick={() => toggle(t.key)} className="font-semibold">
                    <span>
                      {on ? "▾" : "▸"} {t.key} {t.name}
                    </span>
                    <span>
                      {a.met} / {a.total}
                    </span>
                    <span>{a.rate ?? 0}%</span>
                    <span>{a.prev == null ? "–" : `${a.prev}%`}</span>
                    <span className="truncate font-normal">{a.depts}</span>
                    <span className="truncate font-normal">{a.owners}</span>
                  </Row>
                  {on &&
                    t.domains.map((d) => {
                      const b = agg(d.list);
                      const dk = `${t.key}/${d.key}`;
                      const dOn = open.includes(dk);
                      return (
                        <Fragment key={dk}>
                          <Row cols={cols} onClick={() => toggle(dk)} className="bg-j-canvas/60">
                            <span className="ps-4 font-semibold">
                              {dOn ? "▾" : "▸"} {d.name.startsWith("Domain") ? d.name : `${d.key} ${d.name}`}
                            </span>
                            <span>
                              {b.met} / {b.total}
                            </span>
                            <span>{b.rate ?? 0}%</span>
                            <span>{b.prev == null ? "–" : `${b.prev}%`}</span>
                            <span className="truncate">{b.depts}</span>
                            <span className="truncate">{b.owners}</span>
                          </Row>
                          {dOn &&
                            d.list.map((c) => (
                              <Row key={c.code} cols={cols}>
                                <span className="ps-9">
                                  <span className="font-mono text-xs">{c.code}</span> {c.title}
                                </span>
                                <span>
                                  {c.met} / {c.total}
                                </span>
                                <span>{pct(c.met, c.total) ?? 0}%</span>
                                <span>
                                  <TierPill tier={c.previous} />
                                </span>
                                <span className="truncate">{c.department}</span>
                                <span className="truncate">{c.owner || "Unassigned"}</span>
                              </Row>
                            ))}
                        </Fragment>
                      );
                    })}
                </Fragment>
              );
            })}
          </Table>
        </Panel>

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="min-w-0 flex-[1.6_1_520px] py-[18px]">
            <PanelHead className="px-[22px] pb-2" title="Requirements by owner" />
            <Table label="Requirements by owner" min={600} cols="1.8fr 0.6fr 0.8fr 0.6fr 0.7fr 0.9fr" head={["Owner", "Req.", "Submitted", "Met", "Not met", "First-time right"]}>
              {byOwner.map((x) => (
                <Row key={x.o} cols="1.8fr 0.6fr 0.8fr 0.6fr 0.7fr 0.9fr">
                  <span>
                    <b>{x.o}</b> <span className="text-xs text-j-muted">· {x.dept}</span>
                  </span>
                  <span>{x.reqs}</span>
                  <span>{x.submitted}</span>
                  <span>{x.met}</span>
                  <span className={cx(x.notMet > 0 && "font-semibold text-[#B2461F]")}>{x.notMet}</span>
                  <span>{x.ftr == null ? "–" : `${x.ftr}%`}</span>
                </Row>
              ))}
            </Table>
          </Panel>
          <Panel className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 p-[22px]">
            <PanelHead title="This cycle vs previous official score" />
            {[
              ["Previous official score", prior == null ? null : prior, "#9AA5A0"],
              ["This cycle – confirmed", summary.rate, "#1E4E8C"],
              ["Target", summary.dates.target, "#1F9D6E"],
            ].map(([l, v, color]) => (
              <div key={l as string} className="flex flex-col gap-1 text-sm">
                <span className="flex justify-between">
                  <span>{l}</span>
                  <b>{v == null ? "–" : `${v}%`}</b>
                </span>
                <span className="block h-2 overflow-hidden rounded-full bg-j-canvas">
                  <span className="block h-full rounded-full" style={{ width: `${Number(v ?? 0)}%`, background: color as string }} />
                </span>
              </div>
            ))}
            <p className="m-0 text-[13px] text-j-ink-3">
              {nowFull.length} of last cycle&apos;s {lastNon.length} non-compliant controls are now accepted with every requirement met.
            </p>
          </Panel>
        </div>
      </JMain>
    </ClientShell>
  );
}
