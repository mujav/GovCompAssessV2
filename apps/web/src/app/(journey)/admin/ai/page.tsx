"use client";

import { useEffect, useState } from "react";
import { AppShell, JMain } from "@/components/journey/shell";
import { Icon } from "@/components/journey/icon";
import { Field, inputClass, JButton, Panel, PanelHead, Pill, Segmented } from "@/components/journey/ui";
import { Modal, Row, Switch, Table, useToast } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { useAuth } from "@/lib/auth/store";
import { recordAudit } from "@/lib/audit";
import { usePlatform } from "@/lib/cycle/use-cycle";
import { MAX_INSTRUCTION_CHARS, policyBlock } from "@/lib/assessor/policy";
import { AGENTS, agentPolicy, DEFAULT_BEHAVIOR, DEFAULT_GUARDRAILS, type AgentKey, type AiSettings, type Guardrail } from "@/lib/cycle/platform";

type Status = { configured: boolean; model: string; fastModel: string; ok?: boolean; ms?: number; error?: string };

// S16 · Platform Admin: model connection, guardrails, the agents and how they behave, review
// thresholds and data handling. Every workspace follows these settings.

export default function AiSettingsPage() {
  const { platform, setPlatform } = usePlatform();
  const { user } = useAuth();
  const { say, toast } = useToast();
  const [s, setS] = useState<AiSettings>(platform.ai);
  const [status, setStatus] = useState<Status | null>(null);
  const [testing, setTesting] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [configuring, setConfiguring] = useState<AgentKey | null>(null);
  const dirty = JSON.stringify(s) !== JSON.stringify(platform.ai);

  useEffect(() => setS(platform.ai), [platform.ai]);

  const test = async () => {
    setTesting(true);
    try {
      const r = (await (await fetch("/api/ai/status")).json()) as Status;
      setStatus(r);
      if (r.ok) setS((x) => ({ ...x, testedAt: new Date().toISOString() }));
    } catch {
      setStatus({ configured: false, model: "", fastModel: "", error: "The server did not answer." });
    } finally {
      setTesting(false);
    }
  };

  const save = () => {
    const changed = AGENTS.filter((a) => s.agents[a.key] !== platform.ai.agents[a.key]).map((a) => `${a.name} ${s.agents[a.key] ? "on" : "off"}`);
    const behavior = AGENTS.filter((a) => JSON.stringify(s.behavior[a.key]) !== JSON.stringify(platform.ai.behavior[a.key])).map((a) => `${a.name} behaviour changed`);
    const rails = JSON.stringify(s.guardrails) !== JSON.stringify(platform.ai.guardrails) ? [`guardrails: ${s.guardrails.filter((g) => g.on).length} of ${s.guardrails.length} on`] : [];
    setPlatform((d) => void (d.ai = s));
    recordAudit({ user: user?.name ?? "", role: "Platform Admin", type: "Settings", action: "Saved AI settings", after: [...changed, ...behavior, ...rails, `confidence ${s.thresholds.confidence}%`, `cap $${s.cap}`].join(" · ") });
    setEditing(null);
    say("AI settings saved");
  };
  const t = s.thresholds;
  const setRail = (id: string, patch: Partial<Guardrail>) => setS({ ...s, guardrails: s.guardrails.map((g) => (g.id === id ? { ...g, ...patch } : g)) });
  const addRail = () => {
    const id = `g-${Date.now()}`;
    setS({ ...s, guardrails: [...s.guardrails, { id, title: "", detail: "", on: true, custom: true }] });
    setEditing(id);
  };
  const open = AGENTS.find((a) => a.key === configuring);
  const spendPct = Math.min(100, Math.round((s.spend / s.cap) * 100));

  return (
    <AppShell search="Search settings">
      <JMain max={1240}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Platform Admin</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">AI settings</h1>
          </div>
          <span className="flex items-center gap-2">
            {dirty && <Pill tone="warn">Unsaved changes</Pill>}
            <JButton variant="primary" disabled={!dirty} onClick={save}>
              Save settings
            </JButton>
          </span>
        </div>

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="flex min-w-0 flex-[1.4_1_480px] flex-col gap-3 p-[22px]">
            <PanelHead title="Model connection" />
            <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
              <Field label="Provider">
                <select value={s.provider} onChange={(e) => setS({ ...s, provider: e.target.value as AiSettings["provider"] })} className={inputClass}>
                  <option>Anthropic</option>
                  <option disabled>OpenAI · not connected</option>
                  <option disabled>Azure OpenAI · not connected</option>
                </select>
              </Field>
              <Field label="Model tier">
                <span className="flex flex-col rounded-[10px] border border-j-line px-3 py-2 text-sm font-normal">
                  <span>Standard model (set in .env): {status?.model ?? "ANTHROPIC_MODEL"}</span>
                  <span>Fast model (set in .env): {status?.fastModel ?? "ANTHROPIC_FAST_MODEL"}</span>
                </span>
              </Field>
            </div>
            <Field label="API key">
              <span className="flex flex-wrap items-center gap-2">
                <span className="flex h-11 min-w-[220px] flex-auto items-center rounded-[10px] border border-j-line bg-j-canvas px-3 text-sm font-normal text-j-ink-3">
                  Kept on the server as ANTHROPIC_API_KEY; never sent to the browser.
                </span>
                <JButton disabled={testing} onClick={() => void test()}>
                  {testing ? "Testing…" : "Test connection"}
                </JButton>
              </span>
            </Field>
            {status && (
              <p className={cx("m-0 text-sm", status.ok ? "text-[#0E5A45]" : "text-j-bad")}>
                {!status.configured ? "Not connected · ANTHROPIC_API_KEY is missing on the server." : status.ok ? `Connected · response in ${status.ms} ms · just now` : `Connection failed · ${status.error}`}
              </p>
            )}
            {!status && s.testedAt && <p className="m-0 text-sm text-j-ink-3">Connected · last checked {new Date(s.testedAt).toLocaleString("en-GB")}</p>}
            <div className="flex flex-wrap gap-3">
              <span className="flex min-w-[150px] flex-col rounded-xl bg-j-canvas px-3.5 py-2.5">
                <span className="text-xs text-j-muted">Runs this month</span>
                <b className="text-xl">{s.runs.toLocaleString("en-GB")}</b>
              </span>
              <span className="flex min-w-[220px] flex-auto flex-col gap-1 rounded-xl bg-j-canvas px-3.5 py-2.5">
                <span className="text-xs text-j-muted">Spend vs cap</span>
                <b className="text-xl">
                  ${s.spend} / ${s.cap}
                </b>
                <span className="block h-1.5 overflow-hidden rounded-full bg-white">
                  <span className="block h-full rounded-full" style={{ width: `${spendPct}%`, background: spendPct > 85 ? "#B42318" : "#1E4E8C" }} />
                </span>
              </span>
              <Field label="Monthly cap (USD)" className="min-w-[150px]">
                <input type="number" min={0} value={s.cap} onChange={(e) => setS({ ...s, cap: Number(e.target.value) })} className={inputClass} />
              </Field>
            </div>
          </Panel>
        </div>

        <Panel className="flex flex-col gap-1 p-[22px]">
          <PanelHead
            title="Guardrails"
            aside={
              <span className="flex gap-2">
                <JButton size="sm" variant="ghost" onClick={() => (setS({ ...s, guardrails: DEFAULT_GUARDRAILS }), setEditing(null))}>
                  Restore defaults
                </JButton>
                <JButton size="sm" variant="outline" onClick={addRail}>
                  + Add guardrail
                </JButton>
              </span>
            }
          />
          <p className="m-0 pb-2 text-[13px] text-j-ink-3">Guardrails you can edit are sent to the Evidence Review and Standard Parser agents on every run. They can make an agent stricter, never looser. Locked ones are built into the platform.</p>
          {s.guardrails.map((g) => (
            <div key={g.id} className={cx("flex flex-wrap items-center gap-3 border-t border-j-line-soft py-2.5", !g.on && "opacity-60")}>
              <span className="flex w-11 shrink-0 justify-center">{g.locked ? <span title="Built into the platform" className="text-j-muted"><Icon name="lock" size={16} /></span> : <Switch label={g.title || "New guardrail"} on={g.on} onChange={(v) => setRail(g.id, { on: v })} />}</span>
              {editing === g.id ? (
                <span className="flex min-w-[260px] flex-auto flex-col gap-1.5">
                  <input aria-label="Guardrail name" maxLength={80} value={g.title} placeholder="Name, e.g. Check the signatory" onChange={(e) => setRail(g.id, { title: e.target.value })} className={cx(inputClass, "h-9")} />
                  <textarea aria-label="What the guardrail requires" maxLength={500} rows={2} dir="auto" value={g.detail} placeholder="What the agent must do, e.g. Name who signed each approved document" onChange={(e) => setRail(g.id, { detail: e.target.value })} className="rounded-[10px] border border-j-line p-2.5 font-sans text-sm" />
                </span>
              ) : (
                <span className="min-w-[260px] flex-auto text-sm">
                  <b>{g.title || "Unnamed guardrail"}</b>
                  {g.locked && <span className="ms-2 text-xs text-j-muted">Always on</span>}
                  <br />
                  <span className="text-[13px] text-j-ink-3" dir="auto">
                    {g.detail || "No wording yet"}
                  </span>
                </span>
              )}
              {!g.locked && (
                <span className="flex gap-1.5">
                  <JButton size="sm" variant="ghost" onClick={() => setEditing(editing === g.id ? null : g.id)}>
                    {editing === g.id ? "Done" : "Edit"}
                  </JButton>
                  {g.custom && (
                    <JButton size="sm" variant="ghost" onClick={() => setS({ ...s, guardrails: s.guardrails.filter((x) => x.id !== g.id) })}>
                      Remove
                    </JButton>
                  )}
                </span>
              )}
            </div>
          ))}
        </Panel>

        <Panel className="flex flex-col py-[18px]">
          <PanelHead className="px-[22px] pb-1" title="Agents" />
          <Table label="Agents" min={1020} cols="1.3fr 2.2fr 1fr 0.95fr 1.1fr 1fr 60px" head={["Agent", "What it does", "Who sees the output", "Runs on", "Runs when", "Behaviour", "On"]}>
            {AGENTS.map((a) => (
              <Row key={a.key} cols="1.3fr 2.2fr 1fr 0.95fr 1.1fr 1fr 60px" className={cx(!s.agents[a.key] && "opacity-60")}>
                <b>{a.name}</b>
                <span className="text-[13px] text-j-ink-3">{a.does}</span>
                <span>{a.who}</span>
                {a.runs === "model" ? (
                  <select aria-label={`Model for ${a.name}`} value={s.models[a.key]} onChange={(e) => setS({ ...s, models: { ...s.models, [a.key]: e.target.value as "Standard" | "Fast" } })} className="h-8 rounded-lg border border-j-line px-1.5 text-[13px]">
                    <option>Standard</option>
                    <option>Fast</option>
                  </select>
                ) : (
                  <span className="text-[13px] text-j-ink-3">Built-in rules</span>
                )}
                <span className="text-[13px]">{a.when}</span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <JButton size="sm" variant="outline" onClick={() => setConfiguring(a.key)}>
                    Configure
                  </JButton>
                  {JSON.stringify(s.behavior[a.key]) !== JSON.stringify(DEFAULT_BEHAVIOR[a.key]) && <Pill tone="cx">Customised</Pill>}
                </span>
                <Switch label={a.name} on={s.agents[a.key]} onChange={(v) => setS({ ...s, agents: { ...s.agents, [a.key]: v } })} />
              </Row>
            ))}
          </Table>
        </Panel>

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="flex min-w-0 flex-[1.2_1_420px] flex-col gap-3 p-[22px]">
            <PanelHead title="Review thresholds" />
            <Field label="Show findings above confidence">
              <span className="flex gap-1.5">
                {[60, 70, 80].map((v) => (
                  <button key={v} type="button" aria-pressed={t.confidence === v} onClick={() => setS({ ...s, thresholds: { ...t, confidence: v } })} className={cx("h-9 cursor-pointer rounded-lg border px-3 text-sm font-semibold", t.confidence === v ? "border-cx bg-cx-tint text-cx" : "border-j-line bg-white")}>
                    {v}%
                  </button>
                ))}
              </span>
            </Field>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
              <Field label="Stale after (days without activity)">
                <input type="number" min={1} value={t.staleDays} onChange={(e) => setS({ ...s, thresholds: { ...t, staleDays: Number(e.target.value) } })} className={inputClass} />
              </Field>
              <Field label="At risk when deadline within (days)">
                <input type="number" min={1} value={t.atRiskDays} onChange={(e) => setS({ ...s, thresholds: { ...t, atRiskDays: Number(e.target.value) } })} className={inputClass} />
              </Field>
              <Field label="Escalate to department head after overdue (days)">
                <input type="number" min={1} value={t.escalateDays} onChange={(e) => setS({ ...s, thresholds: { ...t, escalateDays: Number(e.target.value) } })} className={inputClass} />
              </Field>
            </div>
            <div className="flex flex-col gap-1.5">
              <b className="text-[13px]">Criticality order</b>
              {s.criticality.map((c, i) => (
                <span key={c} className="flex items-center gap-2 rounded-lg bg-j-canvas px-3 py-1.5 text-sm">
                  <span className="text-xs text-j-muted">{i + 1}</span>
                  <span className="flex-auto">{c}</span>
                  <JButton size="sm" variant="ghost" aria-label={`Move ${c} up`} disabled={!i} onClick={() => setS({ ...s, criticality: s.criticality.map((x, j) => (j === i - 1 ? c : j === i ? s.criticality[i - 1] : x)) })}>
                    ↑
                  </JButton>
                </span>
              ))}
            </div>
          </Panel>
          <Panel className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 p-[22px]">
            <PanelHead title="Data handling" />
            {(
              [
                ["noTraining", "No training on customer data", "Provider zero-retention endpoint"],
                ["mask", "Mask personal data before sending", "National ID, phone and email numbers are masked"],
                ["web", "Allow outside web lookups", "Off: agents use only the standard and uploaded files"],
              ] as const
            ).map(([k, l, d]) => (
              <span key={k} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  <b>{l}</b>
                  <br />
                  <span className="text-xs text-j-muted">{d}</span>
                </span>
                <Switch label={l} on={s.data[k]} onChange={(v) => setS({ ...s, data: { ...s.data, [k]: v } })} />
              </span>
            ))}
            <Field label="Keep AI run logs for (days)">
              <input type="number" min={1} value={s.data.keepDays} onChange={(e) => setS({ ...s, data: { ...s.data, keepDays: Number(e.target.value) } })} className={inputClass} />
            </Field>
          </Panel>
        </div>
      </JMain>
      {open && <AgentDialog agent={open} s={s} onChange={setS} onClose={() => setConfiguring(null)} />}
      {toast}
    </AppShell>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="flex items-center justify-between gap-3 text-sm">
      <span>
        <b>{label}</b>
        {hint && (
          <>
            <br />
            <span className="text-xs text-j-muted">{hint}</span>
          </>
        )}
      </span>
      <Switch label={label} on={on} onChange={onChange} />
    </span>
  );
}

/** How one agent behaves. The change joins the page's draft and takes effect on Save settings. */
function AgentDialog({ agent, s, onChange, onClose }: { agent: (typeof AGENTS)[number]; s: AiSettings; onChange: (v: AiSettings) => void; onClose: () => void }) {
  const b = s.behavior;
  const set = <K extends AgentKey>(key: K, patch: Partial<AiSettings["behavior"][K]>) => onChange({ ...s, behavior: { ...b, [key]: { ...b[key], ...patch } } });
  const instructions = (key: "review" | "parser", hint: string) => (
    <Field label="Instructions for this agent">
      <textarea rows={6} dir="auto" maxLength={MAX_INSTRUCTION_CHARS} value={b[key].instructions} placeholder={hint} onChange={(e) => set(key, { instructions: e.target.value } as never)} className="rounded-xl border border-j-line p-3 font-sans text-sm font-normal" />
    </Field>
  );
  const added = agent.runs === "model" ? policyBlock(agentPolicy(s, agent.key as "review" | "parser")) : "";
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={agent.name}
      sub={agent.runs === "model" ? "This agent uses the AI model. What you write here is added to its instructions on every run." : "This agent runs on built-in rules and does not call the AI model, so it has options rather than written instructions."}
      footer={
        <>
          <JButton variant="ghost" onClick={() => onChange({ ...s, behavior: { ...b, [agent.key]: DEFAULT_BEHAVIOR[agent.key] } })}>
            Restore defaults
          </JButton>
          <JButton variant="primary" onClick={onClose}>
            Done
          </JButton>
        </>
      }
    >
      {agent.key === "review" && (
        <>
          <Field label="How strictly to judge">
            <Segmented size="sm" label="How strictly to judge" value={b.review.strictness} onChange={(v) => set("review", { strictness: v })} options={[{ value: "balanced", label: "Balanced" }, { value: "strict", label: "Strict" }]} />
            <span className="text-xs font-normal text-j-muted">{b.review.strictness === "strict" ? "An expectation counts as met only when the evidence states it explicitly." : "Clearly equivalent wording in the evidence can meet an expectation."}</span>
          </Field>
          <Field label="Write its explanations in">
            <select value={b.review.language} onChange={(e) => set("review", { language: e.target.value as typeof b.review.language })} className={inputClass}>
              <option value="auto">Decided by the agent</option>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </Field>
          {instructions("review", "e.g. For approved documents, name who signed and check the signature date falls within the reporting period.")}
        </>
      )}
      {agent.key === "parser" && instructions("parser", "e.g. Keep Arabic requirement text exactly as written. Treat annexes as references, not requirements.")}
      {agent.key === "selfCheck" && (
        <>
          <Field label="Ask for a page reference on files longer than (pages)">
            <input type="number" min={1} value={b.selfCheck.pageRefOver} onChange={(e) => set("selfCheck", { pageRefOver: Math.max(1, Number(e.target.value)) })} className={inputClass} />
          </Field>
          <Toggle label="Flag files that look like drafts" hint="The file name says draft or مسودة" on={b.selfCheck.flagDrafts} onChange={(v) => set("selfCheck", { flagDrafts: v })} />
          <Toggle label="Flag files from earlier years" hint="The file name points to 2024 or before" on={b.selfCheck.flagOldYears} onChange={(v) => set("selfCheck", { flagOldYears: v })} />
        </>
      )}
      {agent.key === "advisor" && <Toggle label="Skip requirements already accepted" hint="Suggest references only where the requirement is still open" on={b.advisor.skipAccepted} onChange={(v) => set("advisor", { skipAccepted: v })} />}
      {agent.key === "remediation" && (
        <Field label="Actions shown under Act today on the dashboard">
          <input type="number" min={1} max={20} value={b.remediation.maxActions} onChange={(e) => set("remediation", { maxActions: Math.min(20, Math.max(1, Number(e.target.value))) })} className={inputClass} />
        </Field>
      )}
      {agent.key === "monitor" && (
        <>
          <Toggle label="Overdue controls" on={b.monitor.overdue} onChange={(v) => set("monitor", { overdue: v })} />
          <Toggle label="Controls returned twice or more" on={b.monitor.returnedTwice} onChange={(v) => set("monitor", { returnedTwice: v })} />
          <Toggle label="At-risk controls" hint="Deadline close and under half of the evidence uploaded" on={b.monitor.atRisk} onChange={(v) => set("monitor", { atRisk: v })} />
          <Toggle label="Stale controls" hint="No activity for the days set under Review thresholds" on={b.monitor.stale} onChange={(v) => set("monitor", { stale: v })} />
        </>
      )}
      {added && (
        <details className="text-[13px]">
          <summary className="cursor-pointer font-semibold">What is added to the agent&apos;s instructions</summary>
          <pre className="m-0 mt-1.5 max-h-[220px] overflow-auto rounded-xl bg-j-canvas p-3 font-sans text-xs leading-5 whitespace-pre-wrap" dir="auto" data-no-translate>
            {added.trim()}
          </pre>
        </details>
      )}
    </Modal>
  );
}
