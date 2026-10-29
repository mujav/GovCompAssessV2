import Link from "next/link";
import { Main, PageHeader } from "@/components/workspace-shell";
import { Button, Card, CardHeader, GridRow, GridTable } from "@/components/ui";

const APPLICABLE = 338;

const gates: [string, number, string][] = [
  ["Evidence validated", 241, "#3F6FB5"],
  ["Internal QA passed", 226, "#3F6FB5"],
  ["Summary page ready", 214, "#3F6FB5"],
  ["Human acceptance complete", 205, "#0E5A45"],
  ["Portal-ready (AR + EN descriptions)", 198, "#0E5A45"],
  ["Uploaded to portal", 0, "#0E5A45"],
];

const BT = {
  acc: ["Acceptance incomplete", "#EEEDFB", "#3F37A8"],
  cla: ["Pending clarification", "#E8ECF3", "#3E4B63"],
  ev: ["Evidence invalid", "#FBE4E1", "#A3261B"],
  sum: ["Summary page missing", "#FBEFD9", "#8A4B00"],
  own: ["Unassigned", "#FBE4E1", "#A3261B"],
} as const;

const blockers: [string, keyof typeof BT, string, string, string, string][] = [
  ["5.11.2-2", "ev", "Samples missing for 3 of 4 integrations", "IT Operations", "12 d", "Escalate"],
  ["4.1.2-1", "ev", "Plan unapproved; returned 3 times", "Human Capital", "19 d", "Convert to initiative"],
  ["6.2.1-3", "acc", "Override awaiting L2 approval", "Noura A.", "2 d", "Review now"],
  ["5.11.1-1", "cla", "CL-014 response changes sample rule", "DGA", "9 d", "Apply clarification"],
  ["3.4.1-1", "sum", "Summary page lacks page references", "Digital Transformation", "4 d", "Request update"],
  ["4.3.1-1", "own", "No owner after ownership SLA", "Assessment Admin", "6 d", "Assign owner"],
];

const pack: [string, string, number][] = [
  ["Evidence index", "241 / 338", 71],
  ["Summary pages with page refs", "214 / 338", 63],
  ["Portal descriptions, Arabic", "198 / 338", 59],
  ["Portal descriptions, English", "205 / 338", 61],
  ["File format and size checks", "689 / 701", 98],
  ["Version and date checks", "663 / 701", 95],
];

const waiting = [
  { label: "Departments", n: 46, href: "/departments" },
  { label: "Internal reviewers / QA", n: 57, href: "/reviews" },
  { label: "Authority clarifications", n: 3, href: "/clarifications" },
  { label: "Unassigned", n: 5, href: "/requirements", bad: true },
];

const BL_COLS = "0.9fr 1.8fr 1.2fr 0.6fr 1fr";

export default function SubmissionPage() {
  return (
    <>
      <PageHeader
        crumb="Workspace / Submission"
        title="Submission Control Tower"
        actions={
          <>
            <Button>Preview evidence index</Button>
            <Button variant="primary" className="px-4">
              Prepare submission pack · 198 items
            </Button>
          </>
        }
      />
      <Main wide>
        <section className="flex flex-wrap items-center justify-between gap-6 rounded-2xl bg-nav px-6 py-[22px] text-[#E4ECE8]">
          <div className="flex flex-col gap-1">
            <div className="text-xs font-semibold tracking-[0.08em] text-[#8FD3B5]">PORTAL CLOSES 20 NOV 2026, 23:59</div>
            <div className="text-[44px] leading-[52px] font-bold text-white">23 days</div>
            <div className="text-[13px] text-[#B5C6BE]">Needed pace: 6.1 requirements ready per day · current pace 4.4</div>
          </div>
          <div className="grid grid-cols-[repeat(3,minmax(120px,1fr))] gap-5">
            <div>
              <div className="text-xs text-[#B5C6BE]">Ready vs applicable</div>
              <div className="text-[26px] font-bold text-white">
                198 <span className="text-[15px] text-[#B5C6BE]">/ 338</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-[#B5C6BE]">Evidence validated</div>
              <div className="text-[26px] font-bold text-white">
                612 <span className="text-[15px] text-[#B5C6BE]">/ 862</span>
              </div>
            </div>
            <div>
              <div className="text-xs text-[#B5C6BE]">Critical blockers</div>
              <div className="text-[26px] font-bold text-[#F4A99C]">8</div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-start gap-4">
          <Card className="flex min-w-0 flex-[999_1_520px] flex-col gap-3 p-5">
            <CardHeader title="Readiness gates" aside="Each requirement must pass every gate, in order · denominator 338" />
            {gates.map(([label, n, color]) => (
              <div key={label} className="grid grid-cols-[minmax(0,220px)_minmax(0,1fr)_90px] items-center gap-3 text-[13px]">
                <span>{label}</span>
                <span className="block h-3.5 overflow-hidden rounded-[7px] bg-line-soft">
                  <span className="block h-3.5 rounded-[7px]" style={{ width: `${Math.round((n / APPLICABLE) * 1000) / 10}%`, background: color }} />
                </span>
                <span className="text-right font-mono text-xs">
                  <b>{n}</b> / {APPLICABLE}
                </span>
              </div>
            ))}
            <div className="rounded-lg bg-warn-soft px-3 py-2.5 text-xs leading-[18px] text-warn">
              7 requirements have validated evidence but incomplete human acceptance. They are excluded from the pack until their acceptance
              policy evaluates complete.
            </div>
          </Card>

          <Card className="flex min-w-0 flex-[1_1_320px] flex-col gap-2.5 p-5">
            <h2 className="m-0 text-base font-semibold">Waiting on</h2>
            {waiting.map((w) => (
              <Link
                key={w.label}
                href={w.href}
                className="flex min-h-11 items-center justify-between rounded-lg px-3 text-sm no-underline"
                style={{ background: w.bad ? "#FBE4E1" : "#F7F8F6", color: w.bad ? "#A3261B" : "#14211C" }}
              >
                {w.label} <b>{w.n}</b>
              </Link>
            ))}
          </Card>
        </div>

        <div className="flex flex-wrap items-start gap-4">
          <Card className="min-w-0 flex-[999_1_560px] overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5">
              <h2 className="m-0 text-base font-semibold">Critical blockers</h2>
              <span className="text-xs text-muted">8 · score-impacting</span>
            </div>
            <GridTable label="Critical blockers" columns={BL_COLS} minWidth={680} headers={["Requirement", "Blocker", "Waiting on", "Age", "Action"]} headerClassName="gap-2.5">
              {blockers.map(([code, t, detail, who, age, action]) => (
                <GridRow key={code} columns={BL_COLS} className="gap-2.5">
                  <span role="cell">
                    <Link href={`/requirements/${code}`} className="font-mono text-xs font-semibold">
                      {code}
                    </Link>
                  </span>
                  <span role="cell" className="leading-[18px]">
                    <span className="rounded px-1.5 py-px text-[11px] font-semibold" style={{ background: BT[t][1], color: BT[t][2] }}>
                      {BT[t][0]}
                    </span>
                    <br />
                    {detail}
                  </span>
                  <span role="cell">{who}</span>
                  <span role="cell" className="font-mono text-xs">
                    {age}
                  </span>
                  <span role="cell">
                    <Link href="/actions" className="font-semibold">
                      {action}
                    </Link>
                  </span>
                </GridRow>
              ))}
            </GridTable>
          </Card>

          <Card className="flex min-w-0 flex-[1_1_320px] flex-col gap-3 p-5">
            <h2 className="m-0 text-base font-semibold">Submission pack</h2>
            {pack.map(([label, v, w]) => (
              <div key={label} className="flex flex-col gap-1 text-[13px]">
                <div className="flex justify-between gap-2">
                  <span>{label}</span>
                  <span className="font-mono text-xs">{v}</span>
                </div>
                <span className="block h-1.5 overflow-hidden rounded-[3px] bg-line-soft">
                  <span className="block h-1.5 bg-brand" style={{ width: `${w}%` }} />
                </span>
              </div>
            ))}
            <div className="flex flex-col gap-1 border-t border-line-soft pt-3 text-[13px] leading-5">
              <div>
                <b>Portal upload</b> · 0 / 12 batches · not started
              </div>
              <div>
                <b>Final QA sign-off</b> · Compliance Lead · locked until all gates pass
              </div>
            </div>
          </Card>
        </div>
      </Main>
    </>
  );
}
