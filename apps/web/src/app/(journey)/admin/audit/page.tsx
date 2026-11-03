"use client";

import { useState } from "react";
import { AppShell, JMain } from "@/components/journey/shell";
import { Field, inputClass, JButton, Panel, PanelHead, Pill } from "@/components/journey/ui";
import { downloadCsv, fmtWhen, Row, Table } from "@/components/cycle/ui";
import { cx } from "@/components/ui";
import { useAuth } from "@/lib/auth/store";
import { chainIntact, recordAudit, useAuditTrail, type AuditType } from "@/lib/audit";

const ALL = "all";
const TYPES: AuditType[] = ["Sign-in", "Grant", "Standard", "Plan", "Review", "AI run", "Export", "Settings", "Cycle"];

// S17 · Platform Admin: every sign-in, grant, standard and plan change, review decision, AI
// run and export. Entries are append-only and hash-chained.

export default function AuditPage() {
  const list = useAuditTrail();
  const { user } = useAuth();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [ws, setWs] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [who, setWho] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const workspaces = [...new Set(list.map((e) => e.workspace).filter(Boolean) as string[])].sort();
  const shown = list.filter(
    (e) =>
      (!from || e.at.slice(0, 10) >= from) &&
      (!to || e.at.slice(0, 10) <= to) &&
      (ws === ALL || e.workspace === ws) &&
      (type === ALL || e.type === type) &&
      (!who || `${e.user} ${e.action}`.toLowerCase().includes(who.toLowerCase())),
  );
  const current = list.find((e) => e.id === sel) ?? shown[0];
  const intact = chainIntact(list);
  const cols = "1fr 1.2fr 0.8fr 2.4fr 1.4fr";

  const exportCsv = () => {
    downloadCsv("audit-trail.csv", [["Id", "When", "User", "Role", "Type", "Action", "Workspace", "Before", "After", "From", "Hash"], ...shown.map((e) => [e.id, e.at, e.user, e.role ?? "", e.type, e.action, e.workspace ?? "", e.before ?? "", e.after ?? "", e.from ?? "", e.hash])]);
    recordAudit({ user: user?.name ?? "", role: "Platform Admin", type: "Export", action: "Exported the audit trail as CSV", after: `${shown.length} entries` });
  };

  return (
    <AppShell search="Search the audit trail">
      <JMain>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm text-j-muted">Platform Admin</span>
            <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Audit trail</h1>
            <p className="m-0 max-w-[820px] text-sm text-j-ink-3">Every sign-in, grant, standard and plan change, review decision, AI run and export. Entries cannot be edited or deleted.</p>
          </div>
          <span className="flex items-center gap-2">
            <Pill tone={intact ? "ok" : "bad"}>{intact ? "Hash chain intact" : "Hash chain broken"}</Pill>
            <JButton onClick={exportCsv}>Export CSV</JButton>
          </span>
        </div>

        <Panel className="flex flex-wrap items-end gap-3 p-[18px]">
          <Field label="From">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </Field>
          <Field label="To">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Workspace">
            <select value={ws} onChange={(e) => setWs(e.target.value)} className={inputClass}>
              <option value={ALL}>All workspaces</option>
              {workspaces.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </select>
          </Field>
          <Field label="Type">
            <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
              <option value={ALL}>All types</option>
              {TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="User" className="min-w-[200px] flex-auto">
            <input placeholder="Search" value={who} onChange={(e) => setWho(e.target.value)} className={inputClass} />
          </Field>
        </Panel>

        <div className="flex flex-wrap items-start gap-3.5">
          <Panel className="min-w-0 flex-[2_1_640px] py-[18px]">
            <PanelHead className="px-[22px] pb-2" title={`Showing ${shown.length} of ${list.length} events in the period`} />
            <Table label="Audit trail" cols={cols} head={["When", "User", "Type", "Action", "Workspace"]}>
              <div className="max-h-[620px] overflow-y-auto">
                {shown.map((e) => (
                  <Row key={e.id} cols={cols} onClick={() => setSel(e.id)} selected={current?.id === e.id}>
                    <span className="text-[13px]">{fmtWhen(e.at)}</span>
                    <span className="text-[13px]">{e.user}</span>
                    <Pill tone={e.type === "AI run" ? "ai" : e.type === "Review" ? "cx" : e.type === "Grant" ? "orange" : "gray"}>{e.type}</Pill>
                    <span className="text-[13px]">{e.action}</span>
                    <span className="truncate text-[13px] text-j-ink-3">{e.workspace ?? "–"}</span>
                  </Row>
                ))}
              </div>
            </Table>
          </Panel>
          {current && (
            <Panel className="flex min-w-0 flex-[1_1_300px] flex-col gap-2 p-[22px] text-sm">
              <PanelHead title={current.action} />
              <span>
                <b>When:</b> {new Date(current.at).toLocaleString("en-GB")}
              </span>
              <span>
                <b>By:</b> {current.user}
                {current.role && ` · ${current.role}`}
              </span>
              <span>
                <b>Workspace:</b> {current.workspace ?? "Platform"}
              </span>
              <span>
                <b>From:</b> {current.from ?? "–"}
              </span>
              {(current.before || current.after) && (
                <div className="grid grid-cols-2 gap-2">
                  <span className={cx("rounded-lg bg-[#FDECEA] px-2.5 py-2 text-[13px]", !current.before && "opacity-50")}>
                    <b className="block text-xs">Before</b>
                    {current.before ?? "–"}
                  </span>
                  <span className="rounded-lg bg-[#E7F3ED] px-2.5 py-2 text-[13px]">
                    <b className="block text-xs">After</b>
                    {current.after ?? "–"}
                  </span>
                </div>
              )}
              <span className="font-mono text-xs text-j-muted">
                Entry {current.id} · tamper-evident hash {current.hash}
              </span>
            </Panel>
          )}
        </div>
      </JMain>
    </AppShell>
  );
}
