"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { FrameworkSwitcher } from "@/components/journey/framework-switcher";
import { Icon } from "@/components/journey/icon";
import { useDraftSender } from "@/components/journey/draft-drawer";
import { ClientShell, JMain } from "@/components/journey/shell";
import { LevelCellView } from "@/components/journey/levels";
import { Avatar, JButton, Panel, inputClass } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { SUBMISSION_DEADLINE, addDays, daysBetween, shortDate } from "@/lib/workspace/data";
import { clientHref } from "@/lib/journey/portfolio";
import { nextClarificationId, useClarifications, type Clarification } from "@/lib/journey/use-clarifications";
import { levelText, otherLevels } from "@/lib/journey/levels";
import { useIndexLevels } from "@/lib/journey/use-levels";
import { useClientWork, useEntityFrameworks } from "@/lib/journey/use-work";
import { RESULT, STAGES, STAGE_OF, codeKey, initials, isReturned, stageOf, type Stage } from "@/lib/journey/work";

// 08 · Requirements. Every requirement with its owner, last DGA result and stage; select
// rows to request evidence, assign or accept the reviewed ones in one go.

type SortKey = "num" | "owner" | "result" | "status" | "updated";
const RESULT_ORDER = { non: 0, part: 1, comp: 2, na: 3, nas: 4 };
const STAGE_ORDER: Record<Stage, number> = { start: 0, prog: 1, rev: 2, acc: 3 };
const PAGE = 12;
const COLS = "grid-cols-[36px_1.1fr_1.1fr_1.6fr_1.6fr_1.4fr_1.2fr_1.1fr_0.8fr]";


function updatedLabel(days: number) {
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : days > 60 ? "—" : `${days} d ago`;
}

// Filters, paging and the selection belong to one framework, so switching starts afresh.
export default function RequirementsPage() {
  const { current } = useEntityFrameworks();
  return <RequirementsView key={current?.id ?? "none"} />;
}

function RequirementsView() {
  const params = useSearchParams();
  const { client, ws, framework, workspace, reqs, overlay, move, assign, people } = useClientWork();
  const { send, drawer } = useDraftSender();
  const [stage, setStage] = useState<Stage | null>((params.get("stage") as Stage) || null);
  const [onlyReturned, setOnlyReturned] = useState(params.get("returned") === "1");
  // Clarifications live on their requirements; this filter lists every requirement a question touches.
  const [onlyCla, setOnlyCla] = useState(params.get("view") === "cla");
  const [clar, setClar] = useClarifications(client.id, framework, workspace, reqs, ws);
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const claByCode = useMemo(() => {
    const m = new Map<string, Clarification[]>();
    for (const x of clar.list)
      for (const cd of x.affects) {
        if (x.status === "done" || x.appliedTo?.includes(cd)) continue;
        m.set(cd, [...(m.get(cd) ?? []), x]);
      }
    return m;
  }, [clar.list]);
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
  const levels = useIndexLevels(framework, workspace, reqs, client.id);
  const today = ws.ctx.today;
  const domains = useMemo(() => [...new Set(reqs.map((r) => r.domain))], [reqs]);
  // The top hierarchy level carries the framework's own name: Axis for Qiyas, Domain for NCA ECC.
  const topLevel = framework?.live.levels[0]?.en ?? "Axis";

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
        if (onlyCla && !claByCode.has(r.code)) return false;
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
  }, [reqs, overlay, stage, onlyReturned, onlyCla, claByCode, axis, owner, result, q, sort, dir, today]);

  const counts = useMemo(() => {
    const c: Record<Stage, number> = { start: 0, prog: 0, rev: 0, acc: 0 };
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
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [[...levels.labels.filter((_, i) => i !== levels.rowLevel), `${levels.labels[levels.rowLevel]} code`, "Title", "Department", "Owner", "Last result", "Stage", "Due"].map(q).join(",")];
    for (const { r, s } of rows) lines.push([...otherLevels(levels, r.code, r.title).map((x) => levelText(x.cell)), r.code, r.title, r.department, r.owner, RESULT[r.status][0], STAGE_OF[s].label, r.due].map(q).join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${client.id}-${framework?.short.replace(/\s+/g, "-").toLowerCase() ?? "requirements"}-requirements.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ClientShell>
      <JMain>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Requirements</h1>
            <FrameworkSwitcher />
            <span className="inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-j-line bg-white px-3 text-[13px] font-semibold" dir="auto">
              {framework ? `${framework.name} v${framework.version}` : client.frameworks[0]} · {reqs.length}
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
                className="flex cursor-pointer flex-col items-start gap-1 rounded-2xl border-[1.5px] bg-white px-4 py-3 text-start text-j-ink"
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
          <select aria-label={topLevel} value={axis} onChange={(e) => (setAxis(e.target.value), reset())} className={cx(inputClass, "h-10")}>
            <option value="all">All</option>
            {domains.map((d, i) => (
              <option key={d} value={d}>
                {topLevel} {i + 1} · {d}
              </option>
            ))}
          </select>
          <select aria-label="Owner" value={owner} onChange={(e) => (setOwner(e.target.value), reset())} className={cx(inputClass, "h-10")}>
            <option value="all">All owners</option>
            <option value="none">Unassigned</option>
            {people.map((p) => (
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
          <button
            type="button"
            aria-pressed={onlyCla}
            onClick={() => (setOnlyCla(!onlyCla), reset())}
            className={cx("h-10 cursor-pointer rounded-[10px] border px-3 text-[13px] font-semibold", onlyCla ? "border-j-ai bg-[#EEEDFD] text-j-ai" : "border-j-line bg-white text-j-ink-2")}
          >
            Clarifications · {claByCode.size}
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
            <div role="table" aria-label="Requirements" className="min-w-[1280px] text-sm">
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
                {levels.labels.map((l, i) =>
                  i === levels.rowLevel ? (
                    <span key={l} role="columnheader" aria-sort={sort === "num" ? (dir === 1 ? "ascending" : "descending") : "none"}>
                      <button type="button" onClick={() => headSort("num")} className={cx("cursor-pointer border-0 bg-transparent p-0 text-xs", sort === "num" ? "font-bold text-j-ink" : "font-semibold text-j-muted")}>
                        {l} <span aria-hidden="true">{sort === "num" ? (dir === 1 ? "↑" : "↓") : ""}</span>
                      </button>
                    </span>
                  ) : (
                    <span key={l} role="columnheader">
                      {l}
                    </span>
                  ),
                )}
                {(
                  [
                    ["owner", "Owner"],
                    ["result", `Last result · ${framework?.authority ?? "DGA"} 2025`],
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
                    {levels.pathOf(r.code, r.title).map((cell, i) =>
                      i === levels.rowLevel ? (
                    <span key={i} role="cell" className="flex min-w-0 flex-col">
                      <Link href={clientHref(client.id, `/requirements/${r.code}`)} className="font-mono text-[13px] font-semibold text-cx">
                        {r.code}
                      </Link>
                      <span className="truncate">{r.title}</span>
                      {claByCode.get(r.code)?.map((x) => (
                        <span key={x.id} className="truncate text-xs text-j-ai">
                          {x.id} · {x.status === "ans" ? "answered, not applied" : x.status === "sub" ? "awaiting answer" : "draft question"}
                        </span>
                      ))}
                    </span>
                      ) : (
                        <span key={i} role="cell" className="min-w-0">
                          <LevelCellView cell={cell} />
                        </span>
                      ),
                    )}
                    <span role="cell" className="flex min-w-0 items-center gap-2">
                      <Avatar initials={initials(r.owner)} size={28} bg={r.owner ? "#E0ECF8" : "#FDECEA"} fg={r.owner ? "#1E4E8C" : "#B42318"} />
                      <span className="flex min-w-0 flex-col">
                        <select
                          aria-label={`Owner of ${r.code}`}
                          value={r.owner}
                          onChange={(e) => {
                            if (!e.target.value) return;
                            assign([r.code], e.target.value, r.due > today ? r.due : addDays(today, 14));
                            flash(`Assigned ${r.code} to ${e.target.value}`);
                          }}
                          className={cx("max-w-full cursor-pointer truncate rounded-md border-0 bg-transparent p-0 text-[13px] hover:underline", r.owner ? "text-j-ink" : "font-semibold text-j-bad")}
                        >
                          {!r.owner && <option value="">Assign…</option>}
                          {!people.some((p) => p.name === r.owner) && r.owner && <option value={r.owner}>{r.owner}</option>}
                          {people.map((p) => (
                            <option key={p.name} value={p.name}>
                              {p.name}{p.department ? ` · ${p.department}` : ""}
                            </option>
                          ))}
                        </select>
                        {r.owner && <span className="truncate text-xs text-j-muted">{r.department}</span>}
                      </span>
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
              {rows.length ? `${cur * PAGE + 1}–${Math.min(rows.length, cur * PAGE + PAGE)}` : 0} of {rows.length} ·{" "}
              {people.length ? (
                "pick an owner on a row, or tick several rows to assign them together"
              ) : (
                <>
                  no people to assign yet ·{" "}
                  <Link href={clientHref(client.id, "/360?tab=people")} className="font-semibold text-cx">
                    add the client&apos;s people
                  </Link>
                </>
              )}
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

        {asking && (
          <Panel className="flex flex-col gap-2.5 p-[18px]">
            <b className="text-sm">
              Question to {framework?.authority ?? "the regulator"} about {sel.length ? `${sel.length} selected requirement${sel.length > 1 ? "s" : ""}` : "these requirements"}
            </b>
            <textarea
              aria-label="Question for the regulator"
              rows={3}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              dir="auto"
              className="rounded-xl border border-j-line p-3 font-sans text-sm text-j-ink"
            />
            <span className="flex gap-2">
              <JButton
                size="sm"
                variant="primary"
                disabled={!question.trim() || !sel.length}
                onClick={() => {
                  const id = nextClarificationId(clar.list);
                  setClar((d) => void d.list.unshift({ id, status: "draft", q: question.trim(), affects: [...sel], when: "Draft · client sends" }));
                  flash(`Question ${id} saved on ${sel.length} requirements.`);
                  setQuestion("");
                  setAsking(false);
                }}
              >
                Save question
              </JButton>
              <JButton size="sm" variant="ghost" onClick={() => setAsking(false)}>
                Cancel
              </JButton>
            </span>
          </Panel>
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
                  {people.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}{p.department ? ` · ${p.department}` : ""}
                    </option>
                  ))}
                </select>
                <JButton
                  size="sm"
                  variant="primary"
                  disabled={!assignTo}
                  onClick={() => {
                    assign(sel, assignTo!, addDays(today, 14));
                    flash(`Assigned ${sel.length} requirements to ${assignTo}`);
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
                    const n = sel.length;
                    send("evidence-request", sel, () => flash(`Evidence request sent for ${n} requirements.`));
                  }}
                >
                  Request evidence
                </JButton>
                <JButton size="sm" onClick={() => setAssignTo("")}>
                  Assign
                </JButton>
                <JButton size="sm" onClick={() => setAsking(true)}>
                  Ask the regulator
                </JButton>
                <JButton
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    // Only submitted requirements can be accepted; the rest stay with their control owner.
                    const ok = sel.filter((c) => {
                      const r = reqs.find((x) => x.code === c)!;
                      return stageOf(r, overlay) === "rev";
                    });
                    move(ok, "acc", `Accepted ${ok.length} requirements · ${client.name}`);
                    flash(ok.length ? `Accepted ${ok.length} requirements.${ok.length < sel.length ? ` ${sel.length - ok.length} not in review were left as they are.` : ""}` : "None of the selected requirements are in review yet.");
                  }}
                >
                  Accept reviewed
                </JButton>
              </>
            )}
            <button type="button" onClick={() => setSel([])} aria-label="Clear selection" className="h-[34px] w-[34px] cursor-pointer rounded-lg border-0 bg-white/10 text-white">
              ×
            </button>
          </div>
        )}
      </JMain>
    {drawer}
    </ClientShell>
  );
}
