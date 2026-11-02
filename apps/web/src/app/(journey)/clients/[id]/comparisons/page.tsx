"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Panel, PanelHead, Ring } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { readiness } from "@/lib/engine/metrics";
import { PRIOR_CYCLE } from "@/lib/workspace/data";
import { clientHref } from "@/lib/journey/portfolio";
import { useClientWork } from "@/lib/journey/use-work";

// 16 · Comparisons. The same entity across frameworks, and this cycle against the last.

const ragColor = (p: number) => (p >= 85 ? "#1F9D6E" : p >= 60 ? "#E0A100" : "#D9442E");
const ragInk = (p: number) => (p >= 85 ? "#0E5A45" : p >= 60 ? "#8A4B00" : "#B42318");

function cell(open: number, mapped: number): [string, string, string] {
  if (!mapped) return ["—", "#F5F7F6", "#5E6B65"];
  const r = open / mapped;
  return [`${open}/${mapped}`, ...(r > 0.4 ? ["#FAD6D0", "#8C1D12"] : r > 0.15 ? ["#FFF0CC", "#6B3F05"] : ["#DDF0E6", "#0B4A38"])] as [string, string, string];
}

const THEMES: [string, [number, number][], boolean][] = [
  ["Governance & policy", [[4, 38], [2, 14], [5, 22], [1, 9]], false],
  ["Data management", [[9, 24], [3, 8], [21, 48], [2, 6]], true],
  ["Integration", [[11, 29], [4, 11], [0, 0], [1, 4]], false],
  ["Awareness & training", [[8, 17], [6, 9], [3, 7], [2, 5]], true],
  ["Service KPIs", [[7, 33], [0, 0], [2, 9], [1, 6]], false],
  ["Access & identity", [[2, 12], [7, 18], [1, 4], [3, 11]], false],
];

const FW_TONE: Record<string, [string, string]> = { Qiyas: ["#E7F3ED", "#0E5A45"], NCA: ["#E0ECF8", "#1E4E8C"], SDAIA: ["#EEEDFD", "#4F46E5"], ISO: ["#FDE9D9", "#9A3412"] };
const REUSE: [string, [string, number][]][] = [
  ["Integration policy", [["Qiyas", 3], ["NCA", 2], ["ISO", 1]]],
  ["Strategy board approval", [["Qiyas", 4], ["SDAIA", 1]]],
  ["Data classification policy", [["Qiyas", 2], ["NCA", 3], ["SDAIA", 6]]],
  ["Awareness campaign report", [["Qiyas", 1], ["NCA", 2], ["ISO", 1]]],
];

const MAP_TONE: Record<string, [string, string]> = { Unchanged: ["#EEF1EF", "#47534D"], Changed: ["#FFF4DF", "#8A4B00"], Merged: ["#E0ECF8", "#1E4E8C"], New: ["#EEEDFD", "#4F46E5"], Removed: ["#FDECEA", "#B42318"] };

export default function ComparisonsPage() {
  const { client, ws, reqs } = useClientWork();
  const [view, setView] = useState<"fw" | "cy">("fw");
  const c = (p: string) => clientHref(client.id, p);
  const qiyas = readiness(ws.ctx).projected.pct;
  const prior = PRIOR_CYCLE[PRIOR_CYCLE.length - 1];

  const movement = useMemo(() => {
    // Against 2025: compliant now = improved or unchanged; new requirements have no prior result.
    let improved = 0, same = 0, declined = 0, fresh = 0;
    for (const r of reqs) {
      if (r.status === "nas") fresh += 1;
      else if (r.status === "comp" && r.weight === "high") improved += 1;
      else if (r.status === "non") declined += 1;
      else same += 1;
    }
    return [
      ["Improved", improved, "#1F9D6E"],
      ["Unchanged", same, "#C9D1CD"],
      ["Declined", declined, "#D9442E"],
      ["New or changed", fresh, "#8B85F0"],
    ] as [string, number, string][];
  }, [reqs]);

  const sample = reqs.slice(0, 3).map((r) => r.code);
  const maps: [string, string, string, string][] = [
    [sample[0], sample[0], "Unchanged", "DGA 2025 Partial · AI: not ready"],
    [sample[1], sample[1], "Changed", "DGA 2025 Compliant · re-check"],
    [`${sample[2]}/-2`, sample[2], "Merged", "Evidence carried forward"],
    ["—", "4.3.2-2", "New", "No DGA result yet"],
    ["6.4.2-1", "—", "Removed", "Out of scoring"],
  ];

  const fws: [string, string, string, number, string][] = [
    ["Qiyas 2026", "QY", `${qiyas.toFixed(1)}%`, qiyas, "Weighted, 3-level"],
    ["NCA ECC", "NCA", "2.9 / 5", 58, "Maturity 0–5"],
    ["SDAIA Data", "SD", "64%", 64, "Binary"],
    ["ISO 27001", "ISO", "81%", 81, "Internal audit"],
  ];

  return (
    <ClientShell>
      <JMain>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Comparisons</h1>
          <div role="tablist" aria-label="Comparison type" className="flex rounded-[10px] bg-white p-[3px] ring-1 ring-j-line">
            {(
              [
                ["fw", "Frameworks"],
                ["cy", "2025 → 2026"],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={view === k}
                onClick={() => setView(k)}
                className={cx("h-[34px] cursor-pointer rounded-lg border-0 px-3.5 text-[13px] font-semibold", view === k ? "bg-j-ink text-white" : "bg-transparent text-j-ink-3")}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {view === "fw" ? (
          <>
            <section aria-label="Framework completion" className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
              {fws.map(([name, short, score, pct, scale]) => (
                <article key={name} className="flex items-center gap-3.5 rounded-[20px] border border-j-line bg-white p-[18px]">
                  <Ring pct={pct} color={ragColor(pct)} size={64} thickness={7} label={`${name} ${score}`}>
                    <span className="text-[11px] font-bold">{short}</span>
                  </Ring>
                  <span className="flex flex-col text-sm">
                    <b>{name}</b>
                    <b className="text-xl" style={{ color: ragInk(pct) }}>
                      {score}
                    </b>
                    <span className="text-xs text-j-muted">{scale}</span>
                  </span>
                </article>
              ))}
            </section>
            <div className="flex flex-wrap items-start gap-3.5">
              <Panel className="flex min-w-0 flex-[3_1_560px] flex-col gap-3.5 p-[22px]">
                <PanelHead title="Shared control themes" aside={<span title="Open gaps out of mapped controls" className="text-xs text-j-muted">open / mapped ⓘ</span>} />
                <div className="overflow-x-auto">
                  <div role="table" aria-label="Themes by framework" className="grid min-w-[560px] grid-cols-[1.8fr_repeat(4,1fr)] gap-1.5 text-[13px]">
                    {["", "Qiyas", "NCA", "SDAIA", "ISO"].map((h, i) => (
                      <span key={i} role="columnheader" className="text-center text-xs font-semibold text-j-muted">
                        {h}
                      </span>
                    ))}
                    {THEMES.map(([name, cells, wide]) => (
                      <div key={name} role="row" className="contents">
                        <span role="rowheader" className="flex items-center gap-1.5 font-semibold">
                          {name}
                          {wide && <span title="Weak across frameworks" className="h-2 w-2 rounded-full bg-j-bad-mark" />}
                        </span>
                        {cells.map(([o, m], i) => {
                          const [v, bg, fg] = cell(o, m);
                          return (
                            <span key={i} role="cell" className="rounded-lg py-2 text-center font-semibold" style={{ background: bg, color: fg }}>
                              {v}
                            </span>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </Panel>
              <Panel className="flex min-w-0 flex-[2_1_320px] flex-col gap-2 p-[22px]">
                <h2 className="m-0 mb-1 text-base">Reusable evidence</h2>
                {REUSE.map(([name, uses]) => (
                  <Link key={name} href={c("/evidence")} className="flex flex-col gap-1.5 rounded-xl border border-j-line-soft p-3 text-j-ink no-underline hover:border-cx-line hover:text-j-ink">
                    <span className="text-sm font-semibold">{name}</span>
                    <span className="flex flex-wrap gap-1">
                      {uses.map(([fw, n]) => (
                        <span key={fw} className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: FW_TONE[fw][0], color: FW_TONE[fw][1] }}>
                          {fw} ×{n}
                        </span>
                      ))}
                    </span>
                  </Link>
                ))}
              </Panel>
            </div>
          </>
        ) : (
          <>
            <section aria-label="Changes" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
              {[
                [String(reqs.length), "Requirements (was 328)", "text-j-ink"],
                ["278", "Unchanged", "text-j-ink"],
                ["37", "Wording changed", "text-[#8A4B00]"],
                ["31", "New", "text-j-ai"],
                ["9", "Removed", "text-j-bad"],
              ].map(([n, l, ink]) => (
                <div key={l} className="rounded-2xl border border-j-line bg-white p-4">
                  <b className={cx("text-[26px]", ink)}>{n}</b>
                  <br />
                  <span className="text-[13px] text-j-muted">{l}</span>
                </div>
              ))}
            </section>
            <Panel className="flex flex-col gap-3 p-[22px]">
              <PanelHead
                title="Outcome movement"
                aside={
                  <span className="text-sm">
                    <b>{prior}%</b> → <b className="text-cx">{qiyas.toFixed(1)}%</b>
                  </span>
                }
              />
              <div role="img" aria-label={movement.map(([l, n]) => `${n} ${l.toLowerCase()}`).join(", ")} className="flex h-9 gap-[3px] overflow-hidden rounded-xl text-xs font-bold text-white">
                {movement.map(([l, n, col]) =>
                  n ? (
                    <span key={l} className="flex items-center justify-center" style={{ flex: n, background: col, color: l === "Unchanged" ? "#33413B" : "#FFFFFF" }}>
                      {n}
                    </span>
                  ) : null,
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-xs text-j-muted">
                {movement.map(([l, , col]) => (
                  <span key={l} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: col }} />
                    {l}
                  </span>
                ))}
                <span className="font-semibold text-[#8A4B00]">↻ 6 repeat observations</span>
              </div>
            </Panel>
            <Panel className="flex flex-col p-[22px]">
              <h2 className="m-0 mb-2 text-base">Mapping</h2>
              {maps.map(([o, n, type, move]) => (
                <div key={type} className="grid grid-cols-[1fr_24px_1fr_1fr_2fr] items-center gap-3 border-b border-j-line-soft py-3 text-sm last:border-0">
                  <span className="font-mono text-j-muted">{o}</span>
                  <span aria-hidden="true" className="text-j-muted">
                    →
                  </span>
                  {n === "—" ? <b className="font-mono">—</b> : <Link href={c(`/requirements/${n}`)} className="font-mono font-semibold">{n}</Link>}
                  <span>
                    <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: MAP_TONE[type][0], color: MAP_TONE[type][1] }}>
                      {type}
                    </span>
                  </span>
                  <span className="text-[13px] text-j-ink-3">{move}</span>
                </div>
              ))}
            </Panel>
          </>
        )}
      </JMain>
    </ClientShell>
  );
}
