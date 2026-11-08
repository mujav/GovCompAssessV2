"use client";

import { useAdmin } from "@/lib/admin/store";
import { useAuth } from "@/lib/auth/store";
import { recordAudit } from "@/lib/audit";
import { useJourney } from "@/lib/journey/store";
import { useWorkplaces } from "@/lib/journey/use-workplaces";
import { cycleKey, type CycleState } from "@/lib/cycle/use-cycle";
import { JButton, Panel, PanelHead, Pill } from "@/components/journey/ui";
import { Row, Table } from "./ui";

// S21 · Standard library: which workspaces use each edition. Sits above the editions list of
// the library.

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
  );
}
