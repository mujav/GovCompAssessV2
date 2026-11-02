"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Icon } from "@/components/journey/icon";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Avatar, JButton, Panel, inputClass } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { DEPARTMENTS, SUBMISSION_DEADLINE, addDays, daysBetween, shortDate } from "@/lib/workspace/data";
import { clientHref } from "@/lib/journey/portfolio";
import { useClientWork } from "@/lib/journey/use-work";
import { RESULT, STAGES, STAGE_OF, codeKey, initials, isReturned, stageOf, type Stage } from "@/lib/journey/work";

// 08 · Requirements. Every requirement with its owner, last DGA result and stage; select
// rows to request evidence, assign or send to the client in one go.

type SortKey = "num" | "owner" | "result" | "status" | "updated";
const RESULT_ORDER = { non: 0, part: 1, comp: 2, na: 3, nas: 4 };
const STAGE_ORDER: Record<Stage, number> = { start: 0, prog: 1, rev: 2, cli: 3, acc: 4 };
const PAGE = 12;
const COLS = "grid-cols-[36px_2.6fr_1.4fr_1.2fr_1.1fr_0.8fr]";

const PEOPLE = Object.values(DEPARTMENTS).flatMap((d) => d.people.map((p) => ({ name: p, dept: d.name })));

function updatedLabel(days: number) {
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : days > 60 ? "—" : `${days} d ago`;
}

export default function RequirementsPage() {
  const params = useSearchParams();
  const { client, ws, reqs, overlay, move } = useClientWork();
  const [stage, setStage] = useState<Stage | null>((params.get("stage") as Stage) || null);
  const [onlyReturned, setOnlyReturned] = useState(params.get("returned") === "1");
  const [q, setQ] = useState("");
  const [axis, setAxis] = useState("all");
  const [owner, setOwner] = useState("all");
  const [result, setResult] = useState("all");
  const [sort, setSort] = useState<SortKey>("num");
  const [dir, setDir] = useState(1);
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState<string[]>([]);
  const [assignTo, setAssignTo] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const today = ws.ctx.today;
  const domains = useMemo(() => [...new Set(reqs.map((r) => r.domain))], [reqs]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = reqs
      .map((r) => {
        // How long since the record last moved: done items settled before their due date.
        const s = stageOf(r, overlay);
        const upd = s === "acc" ? Math.max(1, daysBetween(r.due, today)) : Math.abs(daysBetween(r.due, today)) % 14;
        return { r, s, ret: isReturned(r, overlay), upd };
      })
      .filter(({ r, s, ret }) => {
        if (stage && s !== stage) return false;
        if (onlyReturned && !ret) return false;
        if (axis !== "all" && r.domain !== axis) return false;
        if (owner !== "all" && (owner === "none" ? r.owner !== "" : r.owner !== owner)) return false;
        if (result !== "all" && r.status !== result) return false;
        return !term || r.code.includes(term) || r.title.toLowerCase().includes(term);
      });
    const key = {
      num: (x: (typeof list)[number]) => codeKey(x.r.code),
      owner: (x: (typeof list)[number]) => x.r.department,
      result: (x: (typeof list)[number]) => RESULT_ORDER[x.r.status],
      status: (x: (typeof list)[number]) => STAGE_ORDER[x.s],
      updated: (x: (typeof list)[number]) => x.upd,
    }[sort];
    return list.sort((a, b) => {
      const ka = key(a);
      const kb = key(b);
      return (ka < kb ? -1 : ka > kb ? 1 : codeKey(a.r.code).localeCompare(codeKey(b.r.code))) * dir;
    });
  }, [reqs, overlay, stage, onlyReturned, axis, owner, result, q, sort, dir, today]);

  const counts = useMemo(() => {
    const c: Record<Stage, number> = { start: 0, prog: 0, rev: 0, cli: 0, acc: 0 };
    for (const r of reqs) c[stageOf(r, overlay)] += 1;
    return c;
  }, [reqs, overlay]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const shown = rows.slice(cur * PAGE, cur * PAGE + PAGE);
  const daysLeft = daysBetween(today, SUBMISSION_DEADLINE);
  const reset = () => setPage(0);

  const flash = (t: string) => {
    setToast(t);
    setSel([]);
    window.setTimeout(() => setToast(""), 4000);
  };

  const headSort = (k: SortKey) => {
    if (sort === k) setDir(-dir);
    else {
      setSort(k);
      setDir(1);
    }
  };

  const exportCsv = () => {
    const lines = [["Code", "Title", "Department", "Owner", "Last result", "Stage", "Due"].join(",")];
    for (const { r, s } of rows) lines.push([r.code, `"${r.title}"`, r.department, r.owner, RESULT[r.status][0], STAGE_OF[s].label, r.due].join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${client.id}-requirements.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ClientShell>
      <JMain>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Requirements</h1>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-j-line bg-white px-3 text-[13px] font-semibold">
              {client.frameworks[0]} · {reqs.length}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#8A4B00]">
              <Icon name="clock" size={14} />
              Cycle deadline {shortDate(SUBMISSION_DEADLINE)} · {daysLeft} d
            </span>
          </div>
          <JButton onClick={exportCsv}>
            <Icon name="download" size={15} />
            Export
          </JButton>
        </div>

        <section aria-label="Status summary" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
          {STAGES.map((s) => {
            const on = stage === s.key;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setStage(on ? null : s.key);
                  reset();
                }}
                className="flex cursor-pointer flex-col items-start gap-1 rounded-2xl border-[1.5px] bg-white px-4 py-3 text-left text-j-ink"
                style={{ borderColor: on ? s.color : "#E6EBE8" }}
              >
                <span className="inline-flex items-center gap-1.5 text-[13px] text-j-ink-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <b className="text-[22px]">{counts[s.key]}</b>
              </button>
            );
          })}
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <label className="flex h-10 flex-[1_1_260px] items-center gap-2 rounded-[10px] border border-j-line bg-white px-3 text-j-muted">
            <Icon name="search" size={16} />
            <span className="sr-only">Search</span>
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                reset();
              }}
              placeholder="Search by number or title"
              className="min-w-0 flex-auto border-0 bg-transparent text-sm text-j-ink outline-none"
            />
          </label>
          <select aria-label="Axis" value={axis} onChange={(e) => (setAxis(e.target.value), reset())} className={cx(inputClass, "h-10")}>
            <option value="all">All axes</option>
            {domains.map((d, i) => (
              <option key={d} value={d}>
                Axis {i + 1} · {d}
              </option>
            ))}
          </select>
          <select aria-label="Owner" value={owner} onChange={(e) => (setOwner(e.target.value), reset())} className={cx(inputClass, "h-10")}>
            <option value="all">All owners</option>
            <option value="none">Unassigned</option>
            {PEOPLE.map((p) => (
              <option key={p.name} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          <select aria-label="Last result" value={result} onChange={(e) => (setResult(e.target.value), reset())} className={cx(inputClass, "h-10")}>
            <option value="all">Any last result</option>
            {Object.entries(RESULT).map(([k, [l]]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-pressed={onlyReturned}
            onClick={() => (setOnlyReturned(!onlyReturned), reset())}
            className={cx("h-10 cursor-pointer rounded-[10px] border px-3 text-[13px] font-semibold", onlyReturned ? "border-j-bad-mark bg-j-bad-soft text-j-bad" : "border-j-line bg-white text-j-ink-2")}
          >
            Returned
          </button>
          <label className="flex items-center gap-2 text-[13px] text-j-muted">
            Sort
            <select aria-label="Sort by" value={sort} onChange={(e) => (setSort(e.target.value as SortKey), setDir(1))} className={cx(inputClass, "h-10")}>
              <option value="num">Number</option>
              <option value="status">Status</option>
              <option value="result">Last result</option>
              <option value="owner">Owner</option>
              <option value="updated">Last updated</option>
            </select>
          </label>
        </div>

        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <div role="table" aria-label="Requirements" className="min-w-[960px] text-sm">
              <div role="row" className={cx("grid items-center gap-3 border-b border-j-line px-[18px] py-2.5 text-xs font-semibold text-j-muted", COLS)}>
                <span role="columnheader">
                  <input
                    type="checkbox"
                    aria-label="Select page"
                    checked={shown.length > 0 && shown.every((x) => sel.includes(x.r.code))}
                    onChange={(e) => setSel(e.target.checked ? [...new Set([...sel, ...shown.map((x) => x.r.code)])] : sel.filter((c) => !shown.some((x) => x.r.code === c)))}
                    className="h-4 w-4 accent-[#1E4E8C]"
                  />
                </span>
                {(
                  [
                    ["num", "Requirement"],
                    ["owner", "Owner"],
                    ["result", "Last result · DGA 2025"],
                    ["status", "Status"],
                    ["updated", "Updated"],
                  ] as [SortKey, string][]
                ).map(([k, l]) => (
                  <span key={k} role="columnheader" aria-sort={sort === k ? (dir === 1 ? "ascending" : "descending") : "none"}>
                    <button type="button" onClick={() => headSort(k)} className={cx("cursor-pointer border-0 bg-transparent p-0 text-xs", sort === k ? "font-bold text-j-ink" : "font-semibold text-j-muted")}>
                      {l} <span aria-hidden="true">{sort === k ? (dir === 1 ? "↑" : "↓") : ""}</span>
                    </button>
                  </span>
                ))}
              </div>
              {shown.map(({ r, s, ret, upd }) => {
                const on = sel.includes(r.code);
                const [res, rbg, rfg] = RESULT[r.status];
                return (
                  <div key={r.code} role="row" className={cx("grid items-center gap-3 border-b border-j-line-soft px-[18px] py-3", COLS, on ? "bg-cx-tint" : "bg-white")}>
                    <span role="cell">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setSel(on ? sel.filter((c) => c !== r.code) : [...sel, r.code])}
                        aria-label={`Select ${r.code}`}
                        className="h-4 w-4 accent-[#1E4E8C]"
                      />
                    </span>
                    <span role="cell" className="flex min-w-0 flex-col">
                      <Link href={clientHref(client.id, `/requirements/${r.code}`)} className="font-mono text-[13px] font-semibold text-cx">
                        {r.code}
                      </Link>
                      <span className="truncate">{r.title}</span>
                    </span>
                    <span role="cell" className="flex min-w-0 items-center gap-2">
                      <Avatar initials={initials(r.owner)} size={28} bg={r.owner ? "#E0ECF8" : "#FDECEA"} fg={r.owner ? "#1E4E8C" : "#B42318"} />
                      <span className={cx("truncate text-[13px]", !r.owner && "font-semibold text-j-bad")}>{r.owner ? r.department : "Unassigned"}</span>
                    </span>
                    <span role="cell">
                      <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: rbg, color: rfg }}>
                        {res}
                      </span>
                    </span>
                    <span role="cell" className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 text-[13px]">
                        <span className="h-2 w-2 rounded-full" style={{ background: STAGE_OF[s].color }} />
                        {STAGE_OF[s].label}
                      </span>
                      {ret && s !== "acc" && (
                        <span title="Returned by client" className="rounded-md bg-j-bad-soft px-1.5 py-0.5 text-[11px] font-semibold text-j-bad">
                          Returned
                        </span>
                      )}
                    </span>
                    <span role="cell" className="text-[13px] text-j-muted">
                      {updatedLabel(upd)}
                    </span>
                  </div>
                );
              })}
              {shown.length === 0 && <p className="m-0 px-[18px] py-8 text-center text-sm text-j-muted">No requirements match these filters.</p>}
            </div>
          </div>
          <div className="flex items-center justify-between px-[18px] py-3 text-[13px] text-j-muted">
            <span>
              {rows.length ? `${cur * PAGE + 1}–${Math.min(rows.length, cur * PAGE + PAGE)}` : 0} of {rows.length}
            </span>
            <span className="flex gap-1.5">
              <JButton size="sm" aria-label="Previous page" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
                ‹
              </JButton>
              <JButton size="sm" aria-label="Next page" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
                ›
              </JButton>
            </span>
          </div>
        </Panel>

        {toast && (
          <p role="status" className="m-0 flex items-center gap-2 rounded-xl bg-[#E7F3ED] px-4 py-3 text-sm font-semibold text-brand">
            <Icon name="check" size={15} />
            {toast}
          </p>
        )}

        {sel.length > 0 && (
          <div role="region" aria-label="Bulk actions" className="sticky bottom-4 flex flex-wrap items-center gap-2 rounded-2xl bg-j-ink px-4 py-3 text-white shadow-[0_8px_30px_rgba(16,28,23,0.25)]">
            <b className="text-sm">{sel.length} selected</b>
            <span className="flex-auto" />
            {assignTo !== null ? (
              <>
                <label className="sr-only" htmlFor="assign-to">
                  Assign to
                </label>
                <select id="assign-to" value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="h-[34px] rounded-lg border-0 px-2 text-[13px] text-j-ink">
                  <option value="">Choose a person</option>
                  {PEOPLE.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} · {p.dept}
                    </option>
                  ))}
                </select>
                <JButton
                  size="sm"
                  variant="primary"
                  disabled={!assignTo}
                  onClick={() => {
                    for (const c of sel) ws.assign(c, assignTo!, addDays(today, 14));
                    flash(`Assigned ${sel.length} requirements to ${assignTo}.`);
                    setAssignTo(null);
                  }}
                >
                  Assign
                </JButton>
                <JButton size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setAssignTo(null)}>
                  Cancel
                </JButton>
              </>
            ) : (
              <>
                <JButton
                  size="sm"
                  onClick={() => {
                    ws.createDraft("evidence-request", sel);
                    flash(`Evidence request drafted for ${sel.length} requirements. Review it in Outbox before it is sent.`);
                  }}
                >
                  Request evidence
                </JButton>
                <JButton size="sm" onClick={() => setAssignTo("")}>
                  Assign
                </JButton>
                <JButton
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    const ok = sel.filter((c) => {
                      const r = reqs.find((x) => x.code === c)!;
                      return stageOf(r, overlay) !== "acc";
                    });
                    move(ok, "cli", `Sent ${ok.length} requirements to ${client.name} for acceptance`);
                    flash(`Sent ${ok.length} requirements to the client for acceptance.`);
                  }}
                >
                  Send to client
                </JButton>
              </>
            )}
            <button type="button" onClick={() => setSel([])} aria-label="Clear selection" className="h-[34px] w-[34px] cursor-pointer rounded-lg border-0 bg-white/10 text-white">
              ×
            </button>
          </div>
        )}
      </JMain>
    </ClientShell>
  );
}
