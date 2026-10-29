import Link from "next/link";
import { Main, PageHeader } from "@/components/workspace-shell";
import { ButtonLink, Card, GridRow, GridTable, StackedBar } from "@/components/ui";

const fws = [
  { name: "Qiyas 2026", auth: "DGA", score: "72.4%", scale: "Compliant / partial / non · weighted", count: "350 requirements" },
  { name: "NCA ECC", auth: "NCA", score: "2.9 / 5", scale: "Maturity 0–5 · minimum by domain", count: "114 controls" },
  { name: "SDAIA Data Mgmt", auth: "SDAIA", score: "64%", scale: "Binary per specification", count: "191 specifications" },
  { name: "ISO 27001:2022", auth: "Internal", score: "81%", scale: "Implemented / partly / not", count: "93 Annex A controls" },
];

// Cell tint by share of mapped controls with open gaps.
function cell(open: number, mapped: number) {
  if (mapped === 0) return { v: "—", bg: "#F7F8F6", fg: "#56625C" };
  const r = open / mapped;
  return {
    v: `${open} / ${mapped}`,
    bg: r > 0.4 ? "#FBE4E1" : r > 0.15 ? "#FBEFD9" : "#E3F1EA",
    fg: r > 0.4 ? "#A3261B" : r > 0.15 ? "#8A4B00" : "#11603F",
  };
}

const themes: [string, [number, number][], string, boolean?][] = [
  ["Governance & policy approval", [[4, 38], [2, 14], [5, 22], [1, 9]], "Mostly covered"],
  ["Data management & classification", [[9, 24], [3, 8], [21, 48], [2, 6]], "Enterprise-wide weakness", true],
  ["Integration & architecture", [[11, 29], [4, 11], [0, 0], [1, 4]], "Qiyas-specific gap"],
  ["Awareness & training", [[8, 17], [6, 9], [3, 7], [2, 5]], "Enterprise-wide weakness", true],
  ["Service management & KPIs", [[7, 33], [0, 0], [2, 9], [1, 6]], "Mostly covered"],
  ["Capability & skills", [[6, 13], [2, 4], [1, 3], [1, 3]], "Needs initiative"],
];

const reuse = [
  { id: "EV-1702", name: "Integration policy", uses: "3 Qiyas · 2 NCA ECC · 1 ISO" },
  { id: "EV-1811", name: "Digital strategy board approval", uses: "4 Qiyas · 1 SDAIA" },
  { id: "EV-1650", name: "Data classification policy", uses: "2 Qiyas · 3 NCA ECC · 6 SDAIA" },
  { id: "EV-1907", name: "Awareness campaign report", uses: "1 Qiyas · 2 NCA ECC · 1 ISO" },
];

const changes: [string, string, string?][] = [
  ["Requirements", "328 → 350"],
  ["Unchanged", "278"],
  ["Wording changed", "37", "#8A4B00"],
  ["New", "31", "#3F37A8"],
  ["Merged", "4"],
  ["Removed", "9"],
];

const maps = [
  { old: "5.11.2-2", new: "5.11.2-2", type: "Unchanged", prior: "Partial", now: "AI: Non-compliant", note: "Repeat observation risk" },
  { old: "3.4.1-1", new: "3.4.1-1", type: "Wording changed", prior: "Compliant", now: "Partial", note: "Now requires approved 2026 version" },
  { old: "2.3.1-1 + 2.3.1-2", new: "2.3.1-1", type: "Merged", prior: "Compliant + partial", now: "Not assessed", note: "Evidence from both carried forward for review" },
  { old: "—", new: "4.3.2-2", type: "New", prior: "—", now: "Not assessed", note: "New implementation requirement" },
  { old: "6.4.2-1", new: "—", type: "Removed", prior: "Compliant", now: "—", note: "Excluded from 2026 scoring" },
];

const TH_COLS = "1.8fr repeat(4, minmax(0, 1fr)) 1.2fr";
const MAP_COLS = "0.9fr 0.9fr 1fr 1fr 1fr 1.4fr";

export default function ComparisonsPage() {
  return (
    <>
      <PageHeader
        crumb="Insights / Comparisons"
        title="Framework & cycle comparison"
        actions={
          <>
            <ButtonLink href="#frameworks" variant="primary">
              Across frameworks
            </ButtonLink>
            <ButtonLink href="#cycles">Qiyas 2025 → 2026</ButtonLink>
          </>
        }
      />
      <Main wide>
        <h2 id="frameworks" className="m-0 text-lg font-semibold">
          Across frameworks
        </h2>
        <section aria-label="Framework readiness" className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-3">
          {fws.map((f) => (
            <article key={f.name} className="flex flex-col gap-1.5 rounded-xl border border-line bg-white p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="m-0 text-[15px] font-semibold">{f.name}</h3>
                <span className="text-[11px] text-muted">{f.auth}</span>
              </div>
              <div className="text-[28px] leading-[34px] font-bold text-warn">{f.score}</div>
              <div className="text-xs text-ink-2">{f.scale}</div>
              <div className="font-mono text-xs text-muted">{f.count}</div>
            </article>
          ))}
        </section>

        <div className="flex flex-wrap items-start gap-4">
          <Card className="flex min-w-0 flex-[999_1_560px] flex-col gap-3 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="m-0 text-base font-semibold">Common control themes</h3>
              <span className="text-xs text-muted">gaps open / controls mapped</span>
            </div>
            <div className="overflow-x-auto">
              <div role="table" aria-label="Control themes by framework" className="min-w-[600px] text-[13px]">
                <div role="row" className="grid gap-2 border-b border-line py-2 text-xs font-semibold text-muted" style={{ gridTemplateColumns: TH_COLS }}>
                  {["Theme", "Qiyas", "NCA ECC", "SDAIA", "ISO 27001", "Read as"].map((h) => (
                    <span role="columnheader" key={h}>
                      {h}
                    </span>
                  ))}
                </div>
                {themes.map(([name, cells, read, wide]) => (
                  <div role="row" key={name} className="grid items-center gap-2 border-b border-line-soft py-2" style={{ gridTemplateColumns: TH_COLS }}>
                    <span role="cell">{name}</span>
                    {cells.map(([o, m], i) => {
                      const c = cell(o, m);
                      return (
                        <span role="cell" key={i}>
                          <span className="rounded px-1.5 py-0.5 font-mono text-xs" style={{ background: c.bg, color: c.fg }}>
                            {c.v}
                          </span>
                        </span>
                      );
                    })}
                    <span role="cell" className="text-xs font-semibold" style={{ color: wide ? "#A3261B" : "#33403A" }}>
                      {read}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="flex min-w-0 flex-[1_1_340px] flex-col gap-2.5 p-5">
            <h3 className="m-0 text-base font-semibold">Evidence reused across frameworks</h3>
            <div className="text-xs leading-[18px] text-muted">
              One approved document can support several controls; each framework still applies its own evidence rules and reviewer approval.
            </div>
            {reuse.map((r) => (
              <Link
                key={r.id}
                href="/evidence"
                className="flex flex-col gap-0.5 border-t border-line-soft py-2.5 text-[13px] leading-[18px] text-ink no-underline hover:text-ink"
              >
                <span>
                  <span className="font-mono text-xs text-muted">{r.id}</span> {r.name}
                </span>
                <span className="text-xs font-semibold text-brand">{r.uses}</span>
              </Link>
            ))}
          </Card>
        </div>

        <h2 id="cycles" className="mt-2 mb-0 text-lg font-semibold">
          Qiyas 2025 → 2026
        </h2>
        <section aria-label="Framework change summary" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
          {changes.map(([label, v, color]) => (
            <div key={label} className="rounded-xl border border-line bg-white p-3.5">
              <div className="text-xs text-muted">{label}</div>
              <div className="text-[22px] font-bold" style={{ color }}>
                {v}
              </div>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap items-start gap-4">
          <Card className="flex min-w-0 flex-[1_1_340px] flex-col gap-3 p-5">
            <h3 className="m-0 text-base font-semibold">Outcome movement</h3>
            <StackedBar
              height={24}
              radius={6}
              label="64 improved, 171 unchanged, 23 declined, 92 not comparable"
              parts={[
                { value: 64, color: "#2E8B6A" },
                { value: 171, color: "#B9C2BD" },
                { value: 23, color: "#C4412F" },
                { value: 92, color: "#B9B4EE" },
              ]}
            />
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <span>
                <b>64</b> improved
              </span>
              <span>
                <b>171</b> unchanged
              </span>
              <span className="text-bad">
                <b>23</b> declined
              </span>
              <span>
                <b>92</b> new or changed
              </span>
            </div>
            <div className="border-t border-line-soft pt-2.5 text-xs leading-[18px] text-muted">
              <b className="text-warn">6 recurring observations</b> repeat 2025 DGA wording. Score trend: 2025 final 65.6% → 2026 current 72.4%.
            </div>
          </Card>

          <Card className="min-w-0 flex-[999_1_560px] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5">
              <h3 className="m-0 text-base font-semibold">Requirement mapping</h3>
              <span className="text-xs text-muted">from tab 20_Cycle_Comparison</span>
            </div>
            <GridTable label="Requirement mapping" columns={MAP_COLS} minWidth={640} headers={["2025", "2026", "Mapping", "2025 result", "2026 now", "Note"]} headerClassName="gap-2.5">
              {maps.map((m) => (
                <GridRow key={m.old + m.new} columns={MAP_COLS} className="gap-2.5 text-xs">
                  <span role="cell" className="font-mono">
                    {m.old}
                  </span>
                  <span role="cell" className="font-mono font-semibold">
                    {m.new}
                  </span>
                  <span role="cell">{m.type}</span>
                  <span role="cell">{m.prior}</span>
                  <span role="cell">{m.now}</span>
                  <span role="cell" className="leading-4 text-muted">
                    {m.note}
                  </span>
                </GridRow>
              ))}
            </GridTable>
          </Card>
        </div>
      </Main>
    </>
  );
}
