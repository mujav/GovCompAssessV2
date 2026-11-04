"use client";

import { useEffect, useState } from "react";
import { AppShell, JMain } from "@/components/journey/shell";
import { Field, inputClass, JButton, Panel, PanelHead, Pill } from "@/components/journey/ui";
import { Row, Switch, Table, useToast } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { useAuth } from "@/lib/auth/store";
import { recordAudit } from "@/lib/audit";
import { usePlatform } from "@/lib/cycle/use-cycle";
import { AGENTS, GUARDRAILS, type AiSettings } from "@/lib/cycle/platform";

type Status = { configured: boolean; model: string; fastModel: string; ok?: boolean; ms?: number; error?: string };

// S16 · Platform Admin: model connection, the agents and what they may do, review
// thresholds and data handling. Every workspace follows these settings.

export default function AiSettingsPage() {
  const { platform, setPlatform } = usePlatform();
  const { user } = useAuth();
  const { say, toast } = useToast();
  const [s, setS] = useState<AiSettings>(platform.ai);
  const [status, setStatus] = useState<Status | null>(null);
  const [testing, setTesting] = useState(false);
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
    setPlatform((d) => void (d.ai = s));
    recordAudit({ user: user?.name ?? "", role: "Platform Admin", type: "Settings", action: "Saved AI settings", after: [...changed, `confidence ${s.thresholds.confidence}%`, `cap $${s.cap}`].join(" · ") });
    say("AI settings saved");
  };
  const t = s.thresholds;
  const spendPct = Math.min(100, Math.round((s.spend / s.cap) * 100));

  return (
    <AppShell search="Search settings">
      <JMain max={1240}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Platform Admin</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">AI settings</h1>
          </div>
          <JButton variant="primary" disabled={!dirty} onClick={save}>
            Save settings
          </JButton>
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
          <Panel className="flex min-w-0 flex-[1_1_320px] flex-col gap-2 p-[22px]">
            <PanelHead title="Guardrails" aside={<span className="text-xs text-j-muted">fixed for the MVP</span>} />
            {GUARDRAILS.map(([g, d]) => (
              <span key={g} className="flex gap-2 text-sm">
                <b className="text-[#0E5A45]">✓</b>
                <span>
                  <b>{g}</b>
                  <br />
                  <span className="text-[13px] text-j-ink-3">{d}</span>
                </span>
              </span>
            ))}
          </Panel>
        </div>

        <Panel className="flex flex-col py-[18px]">
          <PanelHead className="px-[22px] pb-1" title="Agents" />
          <Table label="Agents" min={900} cols="1.3fr 2.4fr 1fr 0.9fr 1.2fr 60px" head={["Agent", "What it does", "Who sees the output", "Model", "Runs when", "On"]}>
            {AGENTS.map((a) => (
              <Row key={a.key} cols="1.3fr 2.4fr 1fr 0.9fr 1.2fr 60px" className={cx(!s.agents[a.key] && "opacity-60")}>
                <b>{a.name}</b>
                <span className="text-[13px] text-j-ink-3">{a.does}</span>
                <span>{a.who}</span>
                <select aria-label={`Model for ${a.name}`} value={s.models[a.key]} onChange={(e) => setS({ ...s, models: { ...s.models, [a.key]: e.target.value as "Standard" | "Fast" } })} className="h-8 rounded-lg border border-j-line px-1.5 text-[13px]">
                  <option>Standard</option>
                  <option>Fast</option>
                </select>
                <span className="text-[13px]">{a.when}</span>
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
            {dirty && <Pill tone="warn">Unsaved changes</Pill>}
          </Panel>
        </div>
      </JMain>
      {toast}
    </AppShell>
  );
}
