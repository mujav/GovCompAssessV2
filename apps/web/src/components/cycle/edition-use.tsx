"use client";

import { useAdmin } from "@/lib/admin/store";
import { useAuth } from "@/lib/auth/store";
import { recordAudit } from "@/lib/audit";
import { useJourney } from "@/lib/journey/store";
import { useWorkplaces } from "@/lib/journey/use-workplaces";
import { cycleKey, type CycleState } from "@/lib/cycle/use-cycle";
import { JButton, Panel, PanelHead, Pill } from "@/components/journey/ui";
import { Row, Table } from "./ui";

// S21 · Standard library: how an edition reaches a workspace, and which workspaces use each
// edition. Sits above the editions list of the library.

const STEPS: [string, string, string][] = [
  ["1 · Platform Admin · here", "Maintain and publish the edition", "Levels, controls, requirements, required evidence and applicability rules (all entities or annex lists A/B/C)."],
  ["2 · On workspace creation", "Copied into the workspace", "Applicability rules run against the entity's sector and annex list, pre-flagging not-applicable controls and requirements."],
  ["3 · Index Owner · Standard", "Tailor for the entity", "Confirm or add exemptions with proof, add special instructions. Library changes reach workspaces only as a new edition the Index Owner accepts."],
];

export function EditionUse() {
  const { state } = useAdmin();
  const { state: journey } = useJourney();
  const { user } = useAuth();
  const views = useWorkplaces();
  const cols = "1.8fr 1.6fr 2fr 0.8fr 0.9fr";

  const exportExcel = async (id: string) => {
    const pkg = state.frameworks.find((f) => f.id === id)?.live;
    if (!pkg) return;
    const XLSX = await import("xlsx");
    const levels = Object.fromEntries(pkg.levels.map((l) => [l.id, l.en]));
    const rows = (pkg.requirements ?? []).map((r) => ({ Code: r.code, Level: levels[r.level] ?? r.level, Parent: r.parent ?? "", Title: r.title, Text: r.text ?? "", "Required evidence": r.evidence ?? "" }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Standard");
    XLSX.writeFile(wb, `${pkg.name.replace(/[^\w]+/g, "-")}-${pkg.version}.xlsx`);
    recordAudit({ user: user?.name ?? "", role: "Platform Admin", type: "Export", action: `Exported ${pkg.name} edition ${pkg.version} to Excel`, after: `${rows.length} rows` });
  };

  return (
    <>
      <section className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
        {STEPS.map(([eyebrow, title, text]) => (
          <div key={eyebrow} className="flex flex-col gap-1 rounded-[16px] border border-j-line bg-white px-4 py-3.5">
            <span className="text-xs font-semibold text-j-muted">{eyebrow}</span>
            <b className="text-sm">{title}</b>
            <span className="text-[13px] text-j-ink-3">{text}</span>
          </div>
        ))}
      </section>
      <Panel className="flex flex-col py-[18px]">
        <PanelHead className="px-[22px] pb-2" title="Editions" />
        <Table label="Editions" min={900} cols={cols} head={["Index · edition", "Structure", "Used by", "Status", ""]}>
          {state.frameworks
            .filter((f) => f.live)
            .map((f) => {
              const v = f.live!;
              const using = views.filter((w) => w.workplace.frameworkId === f.id);
              const behind = using.filter((w) => {
                const ed = (journey.screens[cycleKey(w.client.id)] as CycleState | undefined)?.standard.edition;
                return ed && ed !== v.version;
              });
              return (
                <Row key={f.id} cols={cols}>
                  <span>
                    <b dir="auto">{v.name}</b>
                    <span className="block text-xs text-j-muted">
                      Edition {v.version} · {v.authority}
                    </span>
                  </span>
                  <span className="text-[13px]">
                    Levels: {v.levels.map((l) => l.en).join(" › ")}
                    <span className="block text-xs text-j-muted">{v.requirements?.length ?? 0} nodes</span>
                  </span>
                  <span className="text-[13px]">
                    {using.length ? using.map((w) => `${w.entity.name} ${w.workplace.year}`).join(", ") : "No workspace yet"}
                    {behind.length > 0 && <span className="block text-xs text-[#8A4B00]">{behind.length} on an earlier edition – their Index Owner decides whether to adopt it</span>}
                  </span>
                  <Pill tone="ok">Published</Pill>
                  <JButton size="sm" onClick={() => void exportExcel(f.id)}>
                    Export Excel
                  </JButton>
                </Row>
              );
            })}
        </Table>
        <p className="m-0 px-[22px] pt-2 text-xs text-j-muted">Published editions are locked. To correct one, create a new edition: workspaces see it as an update with a change log, and their Index Owner decides whether to adopt it.</p>
      </Panel>
    </>
  );
}
