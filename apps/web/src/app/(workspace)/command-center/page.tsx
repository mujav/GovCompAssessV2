"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Popover } from "@/components/overlay";
import { Avatar, LanguageLink, Main, PageHeader } from "@/components/workspace-shell";
import { AiTag, Button, Card, CardHeader, CompliancePill, cx, GridRow, GridTable, Meter, StackedBar, WorkTag } from "@/components/ui";
import {
  ALL,
  atRisk,
  domainReadiness,
  insights,
  kpis,
  nextStep,
  NO_FILTERS,
  opportunities,
  pipeline,
  readiness,
  scopeContext,
  statusMix,
  type DraftKind,
  type DueFilter,
  type Filters,
  type Tone,
} from "@/lib/engine/metrics";
import { effectiveStatus } from "@/lib/engine/scoring";
import { COMPLIANCE, type ComplianceKey, type WorkKey } from "@/lib/status";
import { daysBetween, DEPARTMENTS, EVIDENCE_ISSUES, PRIOR_CYCLE, shortDate, SUBMISSION_DEADLINE, TODAY, TREND_OFFSETS, WS_ACTIONS } from "@/lib/workspace/data";
import { useWorkspace } from "@/lib/workspace/store";
import { Panels, type Panel } from "./panels";

const SEV = { high: ["#FBE4E1", "#A3261B"], med: ["#FBEFD9", "#8A4B00"], info: ["#EEEDFB", "#3F37A8"] } as const;
const TONE_TEXT: Record<Tone, string> = { bad: "#A3261B", warn: "#8A4B00", neutral: "#33403A", good: "#11603F" };
const RAG = { green: "#2E8B6A", amber: "#D08A1C", red: "#C4412F" };

const MIX: { key: ComplianceKey; label: string; color: string }[] = [
  { key: "comp", label: "Compliant", color: "#2E8B6A" },
  { key: "part", label: "Partial", color: "#D08A1C" },
  { key: "non", label: "Non-compl.", color: "#C4412F" },
  { key: "nas", label: "Not assessed", color: "#B9C2BD" },
  { key: "na", label: "N/A", color: "#8796B0" },
];

const STAGE_TONE: Record<string, [string, string]> = {
  ai: ["#EEEDFB", "#3F37A8"],
  override: ["#FBEFD9", "#8A4B00"],
  accepted: ["#E3F1EA", "#11603F"],
};

const WORK_LABEL: Record<WorkKey, string> = {
  none: "No update",
  update: "Update required",
  prog: "In progress",
  returned: "Returned",
  review: "Under review",
  evsub: "Evidence submitted",
  start: "Not started",
  ready: "Ready",
  closed: "Closed",
  sub: "Submitted",
  obs: "Observation",
};

const DUE_LABEL: Record<DueFilter, string> = { any: "Any", overdue: "Overdue", "7d": "Next 7 days", "30d": "Next 30 days" };

const NOTES = [
  { id: "n1", text: "Huda B. returned evidence for 4.1.2-1", at: "09:12", href: "/evidence" },
  { id: "n2", text: "DGA published clarification CL-014", at: "08:40", href: "/clarifications" },
  { id: "n3", text: "Scoring scheme QY-2026 has a draft awaiting approval", at: "Yesterday", href: "/admin/scoring" },
  { id: "n4", text: "Rule ESC-02 matched new overdue actions", at: "Yesterday", href: "/actions" },
  { id: "n5", text: "Weekly snapshot 2026-W43 is ready", at: "Mon", href: "/comparisons" },
  { id: "n6", text: "14 reviews are waiting in your queue", at: "Mon", href: "/reviews" },
];

const RISK_COLS = "2.4fr 1.2fr 1fr 1.1fr 0.6fr 1fr";
const NUMBER_WORDS = ["Nothing needs", "One thing needs", "Two things need", "Three things need", "Four things need", "Five things need"];

const DOMAIN_OPTIONS = Object.keys(DEPARTMENTS);
const DEPT_OPTIONS = Object.values(DEPARTMENTS).map((d) => d.name);

export default function CommandCenterPage() {
  const ws = useWorkspace();
  const { state, ctx } = ws;
  const [panel, setPanel] = useState<Panel | null>(null);
  const filters = state.filters;

  const m = useMemo(() => {
    const scoped = scopeContext(ctx, filters);
    const ready = readiness(scoped);
    const trend = TREND_OFFSETS.map((o) => Math.round((ready.projected.pct + o) * 10) / 10);
    const delta = Math.round((trend[7] - trend[6]) * 10) / 10;
    return {
      scoped,
      ready,
      trend,
      delta,
      kpis: kpis(scoped),
      mix: statusMix(scoped),
      pipeline: pipeline(scoped),
      domains: domainReadiness(scoped),
      opps: opportunities(scoped),
      risks: atRisk(scoped),
      insights: insights(scoped, delta),
    };
  }, [ctx, filters]);

  const visible = m.insights.filter((i) => !state.dismissed.includes(i.id));
  const hidden = m.insights.length - visible.length;
  const pendingDrafts = state.drafts.filter((d) => d.status === "draft");
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const openRecords = (title: string, codes: string[], definition?: string) => setPanel({ type: "records", title, codes, definition });
  const draft = (kind: DraftKind, codes: string[], insightId?: string) => {
    if (kind === "assignment" && codes.length === 1) return setPanel({ type: "assign", code: codes[0] });
    const open = state.drafts.find((d) => d.status === "draft" && d.kind === kind && (insightId ? d.insightId === insightId : d.codes.join() === codes.join()));
    setPanel({ type: "draft", id: open?.id ?? ws.createDraft(kind, codes, insightId, m.scoped) });
  };
  const openDraftFor = (insightId: string) => state.drafts.find((d) => d.status === "draft" && d.insightId === insightId);

  return (
    <>
      <PageHeader
        crumb="Workspace / Command Center"
        title="Command Center"
        actions={
          <>
            <Search />
            <LanguageLink />
            <Notifications />
            <Avatar />
          </>
        }
      />
      <Main className="gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <ViewMenu />
            <FilterSelect label="Domain" value={filters.domain} options={DOMAIN_OPTIONS} onChange={(domain) => ws.setFilters({ domain })} />
            <FilterSelect label="Department" value={filters.department} options={DEPT_OPTIONS} onChange={(department) => ws.setFilters({ department })} />
            <FilterSelect
              label="Owner"
              value={filters.owner}
              options={[...new Set(ctx.reqs.map((r) => r.owner).filter(Boolean))].sort()}
              extra={[["", "Unassigned"]]}
              onChange={(owner) => ws.setFilters({ owner })}
            />
            <FilterSelect
              label="Due"
              value={filters.due}
              options={[]}
              extra={(["overdue", "7d", "30d"] as DueFilter[]).map((d) => [d, DUE_LABEL[d]])}
              allLabel="Any"
              allValue="any"
              onChange={(due) => ws.setFilters({ due: due as DueFilter })}
            />
            {filtered && (
              <Button variant="chip" size="sm" onClick={() => ws.setFilters(NO_FILTERS)}>
                Clear filters
              </Button>
            )}
            <span className="text-[13px] text-muted">
              Submission deadline in <b className="text-ink">{daysBetween(TODAY, SUBMISSION_DEADLINE)} days</b>
            </span>
          </div>
          <div className="flex gap-2">
            <SaveView />
            <Button className="font-medium" onClick={() => setPanel({ type: "drafts" })}>
              Drafts
              {pendingDrafts.length > 0 && (
                <span className="rounded-full bg-orange px-1.5 text-xs font-semibold text-white">{pendingDrafts.length}</span>
              )}
            </Button>
            <Button variant="primary" onClick={() => setPanel({ type: "draft", id: ws.createDraft("exec-update", [], undefined, m.scoped) })}>
              Generate executive update
            </Button>
          </div>
        </div>

        {/* AI briefing: insight → why → action */}
        <section aria-labelledby="brief-h" className="overflow-hidden rounded-[14px] border border-ai-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#DEDBF7] bg-ai-tint px-5 py-4">
            <div className="flex items-center gap-2.5">
              <AiTag />
              <h2 id="brief-h" className="m-0 text-[17px] leading-6 font-semibold">
                {NUMBER_WORDS[visible.length] ?? `${visible.length} things need`} attention today
              </h2>
            </div>
            <div className="text-[13px] text-[#4A4F6B]">
              Generated from accepted and in-flight records · prompt v1.4 · <Link href="/flows/evidence-ai">How this was built</Link>
              {hidden > 0 && (
                <>
                  {" · "}
                  <button type="button" onClick={ws.restoreInsights} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-ai underline">
                    Show {hidden} handled
                  </button>
                </>
              )}
            </div>
          </div>
          {visible.length === 0 && (
            <div className="border-b border-line-soft px-5 py-6 text-sm text-muted">
              Every briefing item for this view has been handled or dismissed.
            </div>
          )}
          {visible.map((it, i) => {
            const existing = openDraftFor(it.id);
            return (
              <div key={it.id} className="flex flex-wrap items-start justify-between gap-4 border-b border-line-soft px-5 py-4">
                <div className="flex min-w-0 flex-[1_1_520px] gap-3.5">
                  <span
                    className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[13px] font-bold"
                    style={{ background: SEV[it.sev][0], color: SEV[it.sev][1] }}
                  >
                    {i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="text-[15px] leading-[22px] font-semibold">{it.insight}</div>
                    <div className="text-[13px] leading-5 text-muted">
                      <b className="text-ink-2">Why:</b> {it.why}
                    </div>
                    <div className="font-mono text-xs text-muted">Sources: {sourceList(it.sources)}</div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => ws.dismissInsight(it.id)}
                    className="h-10 cursor-pointer border-0 bg-transparent px-2 text-[13px] text-muted hover:text-ink"
                  >
                    Dismiss
                  </button>
                  <Button size="md" onClick={() => openRecords(it.insight, it.codes)}>
                    {it.secondary}
                  </Button>
                  <Button variant="primary" size="md" onClick={() => draft(it.kind, it.codes, it.id)}>
                    {existing ? `Open draft ${existing.id}` : it.action}
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="bg-[#FAFAFE] px-5 py-3 text-xs leading-[18px] text-muted">
            AI summarizes, prioritizes and drafts. It cannot approve compliance, change an official score, send an escalation or
            submit to a regulator. Every action above opens as a draft for an authorized user.
          </div>
        </section>

        <section aria-label="Key indicators" className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          {m.kpis.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => openRecords(k.label, k.codes, k.definition)}
              className="flex cursor-pointer flex-col gap-1.5 rounded-xl border border-line bg-white p-4 text-left text-ink hover:border-field"
            >
              <span className="text-[13px] text-muted">{k.label}</span>
              <span className="text-[28px] leading-[34px] font-bold tracking-[-0.01em]">{k.value}</span>
              <span className="font-mono text-xs text-ink-2">{k.ratio}</span>
              <span className="text-xs font-semibold" style={{ color: TONE_TEXT[k.tone] }}>
                {k.note}
              </span>
            </button>
          ))}
        </section>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-4">
          <Card className="flex flex-col gap-3.5 p-5">
            <CardHeader title="Compliance status" aside={`${m.scoped.reqs.length} requirements · after blocking rules`} />
            <StackedBar
              height={28}
              radius={6}
              label={MIX.map((s) => `${m.mix[s.key].length} ${COMPLIANCE[s.key].label.toLowerCase()}`).join(", ")}
              parts={MIX.map((s) => ({ value: m.mix[s.key].length, color: s.color }))}
            />
            <div className="grid grid-cols-5 gap-2 text-xs leading-4">
              {MIX.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => openRecords(COMPLIANCE[s.key].label, m.mix[s.key])}
                  className="cursor-pointer rounded-md border-0 bg-transparent p-1 text-left text-xs text-ink hover:bg-surface-2"
                >
                  <span className="inline-block h-2 w-2 rounded-[2px]" style={{ background: s.color }} /> {s.label}
                  <br />
                  <b className="text-base">{m.mix[s.key].length}</b>
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2.5 border-t border-line-soft pt-3.5">
              <div className="flex justify-between text-[13px]">
                <b>Human acceptance pipeline</b>
                <span className="text-muted">{m.pipeline.reduce((n, p) => n + p.codes.length, 0)} assessed</span>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-xs leading-4">
                {m.pipeline.map((p) => {
                  const [bg, fg] = STAGE_TONE[p.stage] ?? ["#F1F4F2", "#33403A"];
                  return (
                    <button
                      key={p.stage}
                      type="button"
                      onClick={() => openRecords(p.label, p.codes)}
                      className="cursor-pointer rounded-lg border-0 p-2 text-left text-xs hover:brightness-95"
                      style={{ background: bg, color: fg }}
                    >
                      {p.label}
                      <br />
                      <b className="text-base">{p.codes.length}</b>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <CardHeader title="Readiness trend" aside="Weighted score, % · week of cycle" />
            <div className="flex flex-wrap gap-4 text-xs text-ink-2">
              <span>
                <span className="inline-block h-[3px] w-3.5 bg-brand align-middle" /> 2026 Cycle 1
              </span>
              <span>
                <span className="inline-block w-3.5 border-t-2 border-dashed border-[#8796B0] align-middle" /> 2025 Cycle 1
              </span>
              <span>
                <span className="inline-block w-3.5 border-t-2 border-dotted border-orange align-middle" /> Target {ctx.scheme.target}%
              </span>
            </div>
            <TrendChart current={m.trend} prior={PRIOR_CYCLE} target={ctx.scheme.target} />
            <div className="text-[13px] leading-5 text-ink-2">
              <b>{m.ready.projected.pct}%</b> projected now ({m.ready.official.pct}% officially accepted),{" "}
              {m.delta < 0 ? `down ${Math.abs(m.delta)}` : `up ${m.delta}`} pts this week. <Link href="/remediation">See drivers</Link>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] gap-4">
          <Card className="flex flex-col gap-3.5 p-5">
            <CardHeader
              title="Readiness by domain"
              aside={`Green ≥ ${ctx.scheme.green} · amber ${ctx.scheme.amber}–${ctx.scheme.green - 0.01} · red < ${ctx.scheme.amber}`}
            />
            {m.domains.map((d) => (
              <button
                key={d.domain}
                type="button"
                title={`Filter the Command Center to ${d.domain}`}
                onClick={() => ws.setFilters({ domain: filters.domain === d.domain ? ALL : d.domain })}
                className={cx(
                  "grid min-h-7 cursor-pointer grid-cols-[minmax(0,190px)_minmax(0,1fr)_110px] items-center gap-3 rounded-md border-0 bg-transparent px-1 text-left text-[13px] text-ink hover:bg-surface-2",
                  filters.domain === d.domain && "bg-brand-soft",
                )}
              >
                <span>{d.domain}</span>
                <Meter pct={d.pct} color={RAG[d.rag]} />
                <span className="text-right font-mono text-xs">
                  <b>{d.pct}%</b> · {d.numerator}/{d.denominator}
                </span>
              </button>
            ))}
            {m.domains.length === 0 && <p className="m-0 text-[13px] text-muted">No requirements match the current filters.</p>}
          </Card>

          <Card className="flex flex-col gap-3 p-5">
            <CardHeader title="Top score-impacting opportunities" aside={<Link href="/remediation" className="text-[13px]">Open matrix</Link>} />
            {m.opps.length === 0 && <p className="m-0 text-[13px] text-muted">No open requirements below compliant.</p>}
            {m.opps.map((o) => (
              <div key={o.code} className="flex items-center gap-3 border-t border-line-soft py-2.5">
                <span className="flex-[0_0_64px] font-mono text-sm font-semibold text-brand">+{o.impact}</span>
                <div className="min-w-0 flex-auto text-[13px] leading-[19px]">
                  <Link href={`/requirements/${o.code}`} className="font-semibold text-ink">
                    {o.code}
                  </Link>{" "}
                  {o.title}
                  <br />
                  <span className="text-muted">
                    {o.need} · effort {o.effort} · {o.owner || <b className="text-bad">unassigned</b>}
                  </span>
                </div>
                <Button size="md" className="flex-none" onClick={() => setPanel({ type: "assign", code: o.code })}>
                  {o.owner ? "Reassign" : "Assign"}
                </Button>
              </div>
            ))}
          </Card>
        </div>

        <Card className="flex flex-col gap-3 p-5">
          <CardHeader
            title="At risk before the deadline"
            aside={
              m.risks.length > 0 && (
                <button
                  type="button"
                  onClick={() => openRecords("At-risk requirements", m.risks.map((r) => r.code), "Open requirements below compliant, overdue or due within 14 days.")}
                  className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-brand underline"
                >
                  All {m.risks.length} at-risk requirements
                </button>
              )
            }
          />
          <GridTable
            label="At-risk requirements"
            columns={RISK_COLS}
            minWidth={860}
            headers={["Requirement", "Owner", "Compliance", "Work status", "Due", "Next action"]}
            headerClassName="bg-transparent px-2 py-2"
          >
            {m.risks.slice(0, 5).map((r) => {
              const step = nextStep(r);
              return (
                <GridRow key={r.code} columns={RISK_COLS} className="px-2">
                  <span role="cell">
                    <Link href={`/requirements/${r.code}`} className="font-mono font-semibold">
                      {r.code}
                    </Link>
                    <br />
                    <span className="text-ink-2">{r.title}</span>
                  </span>
                  <span role="cell">
                    {r.owner || <b className="text-bad">Unassigned</b>}
                    <br />
                    <span className="text-xs text-muted">{r.department}</span>
                  </span>
                  <span role="cell">
                    <CompliancePill status={effectiveStatus(r, ctx.scheme)} />
                  </span>
                  <span role="cell">
                    <WorkTag work={r.work}>{WORK_LABEL[r.work]}</WorkTag>
                  </span>
                  <span role="cell" className={cx("font-mono text-xs", r.due < ctx.today && "font-semibold text-bad")}>
                    {shortDate(r.due)}
                  </span>
                  <span role="cell">
                    {"href" in step ? (
                      <Link href={step.href} className="font-semibold">
                        {step.label}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => draft(step.kind, [r.code])}
                        className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-brand underline"
                      >
                        {step.label}
                      </button>
                    )}
                  </span>
                </GridRow>
              );
            })}
          </GridTable>
          {m.risks.length === 0 && <p className="m-0 text-[13px] text-muted">Nothing at risk for the current filters.</p>}
          <div className="text-xs text-muted">
            Metrics calculated {shortDate(ctx.today)} 2026 · scoring scheme {ctx.scheme.code} v{ctx.scheme.version} · filters:{" "}
            {describeFilters(filters)}. Every value opens its numerator, denominator and source records.
          </div>
        </Card>
      </Main>
      <Panels panel={panel} setPanel={setPanel} scope={m.scoped} />
    </>
  );
}

/* ---------- Toolbar pieces ---------- */

function FilterSelect({
  label,
  value,
  options,
  extra = [],
  allLabel = "All",
  allValue = ALL,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  extra?: [string, string][];
  allLabel?: string;
  allValue?: string;
  onChange: (v: string) => void;
}) {
  const active = value !== allValue;
  return (
    <label
      className={cx(
        "inline-flex h-9 items-center gap-1 rounded-full border pl-3 text-[13px]",
        active ? "border-brand bg-brand-soft font-semibold text-brand" : "border-field bg-white text-ink",
      )}
    >
      {label}:
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full max-w-[180px] cursor-pointer rounded-full border-0 bg-transparent pr-2 text-[13px] text-inherit"
      >
        <option value={allValue}>{allLabel}</option>
        {extra.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function ViewMenu() {
  const { state, setFilters, deleteView } = useWorkspace();
  const [open, setOpen] = useState(false);
  const current = state.views.find((v) => JSON.stringify(v.filters) === JSON.stringify(state.filters));
  const all = JSON.stringify(state.filters) === JSON.stringify(NO_FILTERS);
  return (
    <div className="relative">
      <Button variant="chip" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        <b>View</b> · {current?.name ?? (all ? "Executive" : "Custom")} ▾
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} align="left" className="w-[280px] py-1.5">
        <MenuItem
          active={all}
          onClick={() => {
            setFilters(NO_FILTERS);
            setOpen(false);
          }}
        >
          Executive · all requirements
        </MenuItem>
        {state.views.map((v) => (
          <div key={v.id} className="flex items-center">
            <MenuItem
              active={current?.id === v.id}
              onClick={() => {
                setFilters(v.filters);
                setOpen(false);
              }}
            >
              {v.name}
            </MenuItem>
            <button
              type="button"
              aria-label={`Delete view ${v.name}`}
              onClick={() => deleteView(v.id)}
              className="mr-2 h-8 w-8 flex-none cursor-pointer rounded-md border-0 bg-transparent text-muted hover:bg-surface-2 hover:text-bad"
            >
              ×
            </button>
          </div>
        ))}
      </Popover>
    </div>
  );
}

function MenuItem({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "flex-auto cursor-pointer border-0 bg-transparent px-3.5 py-2 text-left text-[13px] text-ink hover:bg-surface-2",
        active && "font-semibold text-brand",
      )}
    >
      {children}
    </button>
  );
}

function SaveView() {
  const { saveView } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <div className="relative">
      <Button className="font-medium" aria-expanded={open} onClick={() => setOpen(!open)}>
        Save view
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} className="w-[280px] p-3.5">
        <form
          className="flex flex-col gap-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            saveView(name.trim());
            setName("");
            setOpen(false);
          }}
        >
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            View name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. IT overdue items"
              className="h-10 rounded-lg border border-field px-3 text-sm font-normal"
            />
          </label>
          <span className="text-xs text-muted">Saves the current filters.</span>
          <Button variant="primary" size="md" type="submit" disabled={!name.trim()}>
            Save
          </Button>
        </form>
      </Popover>
    </div>
  );
}

function Search() {
  const { ctx } = useWorkspace();
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    if (query.length < 2) return [];
    const reqs = ctx.reqs
      .filter((r) => r.code.includes(query) || r.title.toLowerCase().includes(query))
      .slice(0, 6)
      .map((r) => ({ key: r.code, label: `${r.code} ${r.title}`, meta: "Requirement", href: `/requirements/${r.code}` }));
    const acts = WS_ACTIONS.filter((a) => a.id.toLowerCase().includes(query))
      .slice(0, 3)
      .map((a) => ({ key: a.id, label: `${a.id} · ${a.code}`, meta: "Action", href: "/actions" }));
    const evs = EVIDENCE_ISSUES.filter((e) => e.id.toLowerCase().includes(query))
      .slice(0, 3)
      .map((e) => ({ key: e.id, label: `${e.id} · ${e.problem}`, meta: "Evidence", href: "/evidence" }));
    return [...reqs, ...acts, ...evs];
  }, [ctx.reqs, query]);

  return (
    <div className="relative">
      <label className="flex">
        <span className="sr-only">Search</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search requirements, evidence, actions"
          className="box-border h-11 w-[300px] max-w-full rounded-lg border border-field bg-surface-2 px-3 text-sm"
        />
      </label>
      <Popover open={query.length >= 2} onClose={() => setQ("")} align="left" className="w-[360px] py-1.5">
        {results.length === 0 && <div className="px-3.5 py-2.5 text-[13px] text-muted">No matches for “{q.trim()}”.</div>}
        {results.map((r) => (
          <Link key={r.key} href={r.href} className="flex items-baseline justify-between gap-3 px-3.5 py-2 text-[13px] text-ink no-underline hover:bg-surface-2">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="flex-none text-xs text-muted">{r.meta}</span>
          </Link>
        ))}
      </Popover>
    </div>
  );
}

function Notifications() {
  const { state, markRead } = useWorkspace();
  const [open, setOpen] = useState(false);
  const unread = NOTES.filter((n) => !state.readNotes.includes(n.id));
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notifications, ${unread.length} unread`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-field bg-white text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-bad px-1 text-[11px] font-bold text-white">
            {unread.length}
          </span>
        )}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="w-[340px]">
        <div className="flex items-center justify-between border-b border-line-soft px-3.5 py-2.5">
          <b className="text-sm">Notifications</b>
          <button
            type="button"
            disabled={!unread.length}
            onClick={() => markRead(NOTES.map((n) => n.id))}
            className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-brand underline disabled:cursor-default disabled:text-muted disabled:no-underline"
          >
            Mark all read
          </button>
        </div>
        {NOTES.map((n) => {
          const isUnread = !state.readNotes.includes(n.id);
          return (
            <Link
              key={n.id}
              href={n.href}
              onClick={() => markRead([n.id])}
              className="flex items-start gap-2.5 border-b border-line-soft px-3.5 py-2.5 text-[13px] text-ink no-underline last:border-0 hover:bg-surface-2"
            >
              <span className={cx("mt-1.5 h-2 w-2 flex-none rounded-full", isUnread ? "bg-bad" : "bg-transparent")} />
              <span className={cx("flex-auto", isUnread && "font-semibold")}>{n.text}</span>
              <span className="flex-none text-xs text-muted">{n.at}</span>
            </Link>
          );
        })}
      </Popover>
    </div>
  );
}

/* ---------- Chart ---------- */

// Plot 40–90% across the 180px viewBox height.
const y = (pct: number) => Math.round(Math.max(0, Math.min(180, (90 - pct) * 3.6)) * 10) / 10;

function TrendChart({ current, prior, target }: { current: number[]; prior: number[]; target: number }) {
  const pts = (series: number[]) => series.map((v, i) => `${Math.round((i * 600) / (series.length - 1) * 10) / 10},${y(v)}`).join(" ");
  const last = current[current.length - 1];
  return (
    <div className="relative h-[200px]">
      <svg
        width="100%"
        height="180"
        viewBox="0 0 600 180"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Readiness moved from ${current[0]}% to ${last}% over ${current.length} weeks; last cycle ended at ${prior[prior.length - 1]}%; target ${target}%`}
        className="block"
      >
        <line x1="0" y1={y(target)} x2="600" y2={y(target)} stroke="#B4580A" strokeWidth="2" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={y(65)} x2="600" y2={y(65)} stroke="#EEF0EE" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <line x1="0" y1={y(50)} x2="600" y2={y(50)} stroke="#EEF0EE" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <polyline points={pts(prior)} fill="none" stroke="#8796B0" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        <polyline points={pts(current)} fill="none" stroke="#0E5A45" strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between font-mono text-[11px] text-muted">
        {current.map((v, i) => (
          <span key={i} title={`${v}%`}>
            W{i + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Helpers ---------- */

function sourceList(sources: string[]) {
  return sources.length > 4 ? `${sources.slice(0, 3).join(", ")} +${sources.length - 3}` : sources.join(", ");
}

function describeFilters(f: Filters) {
  const parts = [
    f.domain !== ALL && f.domain,
    f.department !== ALL && f.department,
    f.owner !== ALL && (f.owner || "unassigned"),
    f.due !== "any" && `due ${DUE_LABEL[f.due].toLowerCase()}`,
  ].filter(Boolean);
  return `Qiyas 2026, Cycle 1, ${parts.length ? parts.join(", ") : "all domains"}`;
}
