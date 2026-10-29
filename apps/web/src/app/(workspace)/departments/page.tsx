import Link from "next/link";
import { Main, PageHeader } from "@/components/workspace-shell";
import { Button, GridRow, GridTable, StackedBar } from "@/components/ui";

type Dept = {
  name: string;
  spoc: string;
  assigned: number;
  high: number;
  comp: number;
  part: number;
  non: number;
  nas: number;
  exec: string;
  ev: string;
  act: string;
  actBad: boolean;
  eng: string;
  engBad: boolean;
  esc: boolean;
};

const depts: Dept[] = [
  { name: "Cybersecurity", spoc: "Yousef A.", assigned: 42, high: 9, comp: 6, part: 11, non: 5, nas: 20, exec: "20 not started · 18 new in 2026", ev: "31 / 88 received", act: "9 open · 1 overdue", actBad: false, eng: "Last update 4 days", engBad: false, esc: false },
  { name: "Human Capital", spoc: "Lama T.", assigned: 43, high: 11, comp: 16, part: 12, non: 9, nas: 4, exec: "7 returned · 5 no update", ev: "44 / 92 received · 9 invalid", act: "19 open · 7 overdue · 2 critical", actBad: true, eng: "Last update 15 days · 1/4 meetings", engBad: true, esc: true },
  { name: "IT Operations", spoc: "Faisal K.", assigned: 58, high: 16, comp: 27, part: 15, non: 8, nas: 6, exec: "4 returned · 3 no update", ev: "96 / 141 received", act: "24 open · 6 overdue", actBad: true, eng: "Last update 12 days · 2/4 meetings", engBad: true, esc: true },
  { name: "Digital Transformation", spoc: "Reem S.", assigned: 64, high: 18, comp: 38, part: 14, non: 4, nas: 5, exec: "41 complete · 12 in progress", ev: "118 / 140 received · 104 valid", act: "22 open · 3 overdue · 5 due this week", actBad: false, eng: "Last update 1 day · 4/4 meetings", engBad: false, esc: false },
  { name: "Strategy & Performance", spoc: "Omar H.", assigned: 52, high: 12, comp: 36, part: 9, non: 2, nas: 3, exec: "44 complete · 1 returned", ev: "121 / 130 received", act: "14 open · 2 overdue", actBad: false, eng: "Last update 2 days · 4/4 meetings", engBad: false, esc: false },
  { name: "Customer Experience", spoc: "Hind M.", assigned: 47, high: 8, comp: 33, part: 8, non: 2, nas: 2, exec: "39 complete · 2 under review", ev: "97 / 104 received · 1 duplicate", act: "11 open · 1 overdue", actBad: false, eng: "Last update 3 days · 3/4 meetings", engBad: false, esc: false },
  { name: "Legal & Governance", spoc: "Sara N.", assigned: 39, high: 6, comp: 30, part: 5, non: 1, nas: 2, exec: "35 complete", ev: "84 / 87 received", act: "6 open · 0 overdue", actBad: false, eng: "Last update 1 day · 4/4 meetings", engBad: false, esc: false },
];

const eng: [string, number, number, number, number, number, string][] = [
  ["Human Capital", 31, 48, 9.2, 2.6, 5, "1 / 4"],
  ["IT Operations", 38, 58, 6.8, 2.1, 3, "2 / 4"],
  ["Cybersecurity", 22, 64, 4.4, 1.5, 1, "3 / 4"],
  ["Digital Transformation", 41, 91, 2.1, 1.4, 2, "4 / 4"],
  ["Strategy & Performance", 29, 93, 1.8, 1.2, 0, "4 / 4"],
  ["Customer Experience", 24, 88, 2.6, 1.6, 0, "3 / 4"],
  ["Legal & Governance", 17, 100, 1.2, 1.1, 0, "4 / 4"],
];

const ENG_COLS = "1.6fr repeat(6, minmax(0, 1fr))";

// Readiness = (compliant + 0.5 × partial) / applicable, per the configured scoring scheme.
function readiness(d: Dept) {
  const applicable = d.comp + d.part + d.non + d.nas;
  return { applicable, pct: Math.round(((d.comp + d.part * 0.5) / applicable) * 1000) / 10 };
}

export default function DepartmentsPage() {
  return (
    <>
      <PageHeader
        crumb="Insights / Departments"
        title="Department performance"
        actions={
          <>
            <span className="text-[13px] text-muted">Sort by</span>
            <Button>Readiness, lowest first ▾</Button>
            <Button>Send department reports</Button>
          </>
        }
      />
      <Main wide className="gap-5">
        <section aria-label="Departments" className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-3.5">
          {depts.map((d) => {
            const { applicable, pct } = readiness(d);
            const ragFg = pct >= 85 ? "#11603F" : pct >= 60 ? "#8A4B00" : "#A3261B";
            return (
              <article
                key={d.name}
                className="flex flex-col gap-3 rounded-[14px] border bg-white p-[18px]"
                style={{ borderColor: pct < 60 ? "#EBC4BE" : "#DCE2DE" }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="m-0 text-base leading-[22px] font-semibold">{d.name}</h2>
                    <div className="text-xs text-muted">
                      SPOC {d.spoc} · {d.assigned} assigned · {applicable} applicable · {d.high} high-impact
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[22px] font-bold" style={{ color: ragFg }}>
                      {pct}%
                    </div>
                    <div className="text-[11px] text-muted">readiness</div>
                  </div>
                </div>
                <StackedBar
                  label={`${d.comp} compliant, ${d.part} partial, ${d.non} non-compliant, ${d.nas} not assessed`}
                  parts={[
                    { value: d.comp, color: "#2E8B6A" },
                    { value: d.part, color: "#D08A1C" },
                    { value: d.non, color: "#C4412F" },
                    { value: d.nas, color: "#B9C2BD" },
                  ]}
                />
                <div className="font-mono text-xs text-ink-2">
                  {d.comp} compliant · {d.part} partial · {d.non} non · {d.nas} not assessed
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs leading-[18px]">
                  <div className="rounded-lg bg-surface-2 px-2.5 py-2">
                    <b>Execution</b>
                    <br />
                    {d.exec}
                  </div>
                  <div className="rounded-lg bg-surface-2 px-2.5 py-2">
                    <b>Evidence</b>
                    <br />
                    {d.ev}
                  </div>
                  <div className="rounded-lg bg-surface-2 px-2.5 py-2">
                    <b>Actions</b>
                    <br />
                    <span style={{ color: d.actBad ? "#A3261B" : "#14211C" }}>{d.act}</span>
                  </div>
                  <div className="rounded-lg bg-surface-2 px-2.5 py-2">
                    <b>Engagement</b>
                    <br />
                    <span style={{ color: d.engBad ? "#A3261B" : "#14211C" }}>{d.eng}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Link href="/requirements" className="text-[13px] font-semibold">
                    Open {applicable} requirements
                  </Link>
                  {d.esc && (
                    <Link href="/actions" className="rounded-full bg-bad-soft px-2.5 py-1 text-xs font-semibold text-bad no-underline">
                      Escalation criteria met
                    </Link>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        <section className="overflow-hidden rounded-[14px] border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5">
            <h2 className="m-0 text-base font-semibold">Engagement &amp; responsiveness</h2>
            <span className="text-xs text-muted">From interaction log · cycle to date</span>
          </div>
          <GridTable
            label="Engagement by department"
            columns={ENG_COLS}
            minWidth={900}
            headers={["Department", "Requests sent", "Response rate", "Request → evidence", "Review loops", "No-update items", "Meetings attended"]}
          >
            {eng.map(([name, req, rate, days, loops, nu, meet]) => (
              <GridRow key={name} columns={ENG_COLS} className="font-mono text-xs">
                <span role="cell" className="font-sans text-[13px]">
                  {name}
                </span>
                <span role="cell">{req}</span>
                <span role="cell" style={{ color: rate < 60 ? "#A3261B" : "#14211C" }}>
                  {rate}%
                </span>
                <span role="cell">{days} d</span>
                <span role="cell">{loops}</span>
                <span role="cell" style={{ color: nu >= 5 ? "#A3261B" : "#14211C" }}>
                  {nu}
                </span>
                <span role="cell">{meet}</span>
              </GridRow>
            ))}
          </GridTable>
        </section>
      </Main>
    </>
  );
}
