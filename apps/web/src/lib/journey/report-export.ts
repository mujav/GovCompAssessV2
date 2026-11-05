"use client";

import { STAGES } from "./work";
import { UNASSIGNED, reportFileName, type OwnerReport, type ReportRow, type WorkspaceReport } from "./report";

// Downloads of the workspace report. Excel and PowerPoint are built from the report data, so
// they stay editable; the PDF is a picture of the pages on screen, one page per report page.
// The libraries load only when someone exports.

export type ReportKind = "executive" | "detailed";
export type ExportFormat = "pdf" | "pptx" | "xlsx";

const STAGE_KEYS = STAGES.map((s) => s.key);
const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
const pct = (n: number) => `${n}%`;

// ---------- Excel ----------

const ROW_HEAD = ["Code", "Requirement", "Domain", "Control Owner", "Stage", "Due", "Overdue", "Returned", "Evidence files", "Evidence expected"];
const rowCells = (r: ReportRow) => [r.code, r.title, r.domain, r.owner, r.stageLabel, r.due, r.overdue ? "Yes" : "", r.returned ? "Yes" : "", r.files, r.expected];
const ROW_COLS = [12, 60, 30, 22, 14, 12, 9, 9, 13, 16].map((wch) => ({ wch }));
const OWNER_HEAD = ["Control Owner", "Department", "Email", "Assigned", ...STAGES.map((s) => s.label), "Accepted %", "Overdue", "Returned"];
const ownerCells = (o: OwnerReport) => [o.name, o.department ?? "", o.email ?? "", o.total, ...STAGE_KEYS.map((k) => o.counts[k]), o.pct, o.overdue, o.returned];

/** Excel sheet names: 31 characters, none of []:*?/\, unique in the book. */
function sheetName(name: string, taken: Set<string>) {
  const base = name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 28) || "Sheet";
  let out = base;
  for (let i = 2; taken.has(out.toLowerCase()); i++) out = `${base} ${i}`;
  taken.add(out.toLowerCase());
  return out;
}

async function exportExcel(r: WorkspaceReport, kind: ReportKind) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const taken = new Set<string>();
  const add = (name: string, rows: (string | number)[][], cols?: { wch: number }[]) => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    if (cols) ws["!cols"] = cols;
    XLSX.utils.book_append_sheet(wb, ws, sheetName(name, taken));
  };
  const head = [
    [`${r.entity} · ${r.index} ${r.year}`],
    [kind === "executive" ? "Executive report" : "Detailed report", `As of ${r.today}`],
    ["Index Owners", r.indexOwners.join(", ") || "none"],
    [],
  ];

  add(
    "Summary",
    [
      ...head,
      ["Requirements", r.total],
      ["Accepted %", r.pct],
      ...STAGES.map((s) => [s.label, r.counts[s.key]]),
      ["Overdue", r.overdue],
      ["Returned to Control Owners", r.returned],
    ],
    [{ wch: 28 }, { wch: 40 }],
  );

  if (kind === "executive") {
    add("By domain", [["Domain", "Requirements", ...STAGES.map((s) => s.label), "Accepted %"], ...r.domains.map((d) => [d.name, d.total, ...STAGE_KEYS.map((k) => d.counts[k]), d.pct])], [{ wch: 40 }, ...Array(6).fill({ wch: 13 })]);
    add("Control Owners", [OWNER_HEAD, ...r.owners.map(ownerCells)], [{ wch: 24 }, { wch: 24 }, { wch: 26 }, ...Array(8).fill({ wch: 12 })]);
    add("Overdue", [ROW_HEAD, ...r.late.map(rowCells)], ROW_COLS);
  } else {
    add("Control Owners", [OWNER_HEAD, ...r.owners.map(ownerCells)], [{ wch: 24 }, { wch: 24 }, { wch: 26 }, ...Array(8).fill({ wch: 12 })]);
    for (const o of r.owners) {
      add(
        o.name,
        [
          [o.name],
          [[o.department, o.email].filter(Boolean).join(" · ")],
          [`${o.total} assigned · ${o.pct}% accepted · ${o.overdue} overdue · ${o.returned} returned`],
          [],
          ROW_HEAD,
          ...o.rows.map(rowCells),
        ],
        ROW_COLS,
      );
    }
    add("All requirements", [ROW_HEAD, ...r.rows.map(rowCells)], ROW_COLS);
  }
  XLSX.writeFile(wb, `${reportFileName(r, kind)}.xlsx`);
}

// ---------- PowerPoint ----------

const INK = "101C17";
const MUTED = "5B6B64";
const CX = "1E4E8C";
const LINE = "E3E8EF";
const BAD = "B42318";
const FONT = "Arial";
const hex = (c: string) => c.replace("#", "").toUpperCase();
const W = 13.333;

type Pptx = InstanceType<typeof import("pptxgenjs").default>;
type Slide = ReturnType<Pptx["addSlide"]>;
type Cell = { text: string; options?: Record<string, unknown> };

const cell = (text: string | number, options: Record<string, unknown> = {}): Cell => {
  const t = String(text);
  return { text: t, options: hasArabic(t) ? { rtlMode: true, align: "right", ...options } : options };
};
const headRow = (labels: string[]) => labels.map((l) => cell(l, { bold: true, color: MUTED, fill: { color: "F4F6F8" } }));

function frame(s: Slide, r: WorkspaceReport, title: string, sub?: string) {
  s.background = { color: "FFFFFF" };
  s.addShape("rect", { x: 0, y: 0, w: W, h: 0.12, fill: { color: CX }, line: { color: CX } });
  s.addText(`${r.entity} · ${r.index} ${r.year}`, { x: 0.5, y: 0.3, w: 9, h: 0.3, fontSize: 11, color: MUTED, fontFace: FONT });
  s.addText(title, { x: 0.5, y: 0.6, w: 12.3, h: 0.6, fontSize: 24, bold: true, color: INK, fontFace: FONT, rtlMode: hasArabic(title) });
  if (sub) s.addText(sub, { x: 0.5, y: 1.15, w: 12.3, h: 0.35, fontSize: 12, color: MUTED, fontFace: FONT });
  s.addText(`As of ${r.today}`, { x: 9.8, y: 0.3, w: 3, h: 0.3, fontSize: 10, color: MUTED, align: "right", fontFace: FONT });
}

function kpis(s: Slide, items: [string, string | number, boolean?][], y: number) {
  const w = (W - 1 - (items.length - 1) * 0.2) / items.length;
  items.forEach(([label, value, bad], i) => {
    const x = 0.5 + i * (w + 0.2);
    s.addShape("roundRect", { x, y, w, h: 1, fill: { color: "FFFFFF" }, line: { color: LINE, width: 1 }, rectRadius: 0.08 });
    s.addText(String(value), { x: x + 0.15, y: y + 0.1, w: w - 0.3, h: 0.5, fontSize: 22, bold: true, color: bad ? BAD : INK, fontFace: FONT });
    s.addText(label, { x: x + 0.15, y: y + 0.58, w: w - 0.3, h: 0.3, fontSize: 11, color: MUTED, fontFace: FONT });
  });
}

function table(s: Slide, rows: Cell[][], y: number, colW: number[]) {
  s.addTable(rows as never, { x: 0.5, y, w: W - 1, colW, fontSize: 10, fontFace: FONT, color: INK, border: { type: "solid", pt: 0.5, color: LINE }, valign: "middle", rowH: 0.3 });
}

const chunk = <T,>(list: T[], n: number) => Array.from({ length: Math.max(1, Math.ceil(list.length / n)) }, (_, i) => list.slice(i * n, i * n + n));

const reqRow = (x: ReportRow, withOwner: boolean) => [
  cell(x.code),
  cell(x.title),
  ...(withOwner ? [cell(x.owner)] : [cell(x.domain)]),
  cell(x.stageLabel),
  cell(x.due, x.overdue ? { color: BAD, bold: true } : {}),
  cell(`${x.files} / ${x.expected}`),
  cell([x.overdue && "Overdue", x.returned && "Returned"].filter(Boolean).join(", "), { color: BAD }),
];

async function exportPptx(r: WorkspaceReport, kind: ReportKind) {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = reportFileName(r, kind);
  const colors = STAGES.map((s) => hex(s.color));

  // Cover
  const cover = pptx.addSlide();
  cover.background = { color: CX };
  cover.addText(kind === "executive" ? "Executive report" : "Detailed report", { x: 0.8, y: 2.2, w: 11.7, h: 0.5, fontSize: 18, color: "C9D8EC", fontFace: FONT });
  cover.addText(r.entity, { x: 0.8, y: 2.8, w: 11.7, h: 1, fontSize: 40, bold: true, color: "FFFFFF", fontFace: FONT, rtlMode: hasArabic(r.entity) });
  cover.addText(`${r.index} · ${r.year}`, { x: 0.8, y: 3.8, w: 11.7, h: 0.5, fontSize: 20, color: "FFFFFF", fontFace: FONT });
  cover.addText(`Index Owners: ${r.indexOwners.join(", ") || "none"} · As of ${r.today}`, { x: 0.8, y: 6.4, w: 11.7, h: 0.4, fontSize: 12, color: "C9D8EC", fontFace: FONT });

  // Summary: the same on both reports.
  const sum = pptx.addSlide();
  frame(sum, r, "Where the workspace stands", `${r.counts.acc} of ${r.total} requirements accepted`);
  kpis(sum, [["Accepted", pct(r.pct)], ...STAGES.filter((s) => s.key !== "acc").map((s): [string, number] => [s.label, r.counts[s.key]]), ["Overdue", r.overdue, r.overdue > 0], ["Returned", r.returned, r.returned > 0]], 1.7);
  sum.addChart(pptx.ChartType.doughnut, [{ name: "Stage", labels: STAGES.map((s) => s.label), values: STAGE_KEYS.map((k) => r.counts[k]) }], {
    x: 0.5, y: 3, w: 5.5, h: 4.1, holeSize: 58, chartColors: colors, showLegend: true, legendPos: "r", legendFontSize: 11, dataLabelColor: "FFFFFF", showValue: true, showPercent: false,
  });
  if (r.domains.length) {
    // Bar charts draw the first category at the bottom; reverse so the list reads top-down.
    const domains = [...r.domains].reverse();
    sum.addChart(pptx.ChartType.bar, STAGES.map((s) => ({ name: s.label, labels: domains.map((d) => d.name), values: domains.map((d) => d.counts[s.key]) })), {
      x: 6.3, y: 3, w: 6.5, h: 4.1, barDir: "bar", barGrouping: "percentStacked", chartColors: colors, showLegend: false, catAxisLabelFontSize: 9, valAxisLabelFontSize: 9, showTitle: true, title: "By domain", titleFontSize: 12,
    });
  }

  if (kind === "executive") {
    for (const [i, part] of chunk(r.domains, 14).entries()) {
      const s = pptx.addSlide();
      frame(s, r, `By domain${i ? " (continued)" : ""}`);
      table(s, [headRow(["Domain", "Requirements", ...STAGES.map((x) => x.label), "Accepted"]), ...part.map((d) => [cell(d.name), cell(d.total), ...STAGE_KEYS.map((k) => cell(d.counts[k])), cell(pct(d.pct), { bold: true })])], 1.6, [4.8, 1.3, 1.25, 1.25, 1.25, 1.25, 1.23]);
    }
    for (const [i, part] of chunk(r.owners, 14).entries()) {
      const s = pptx.addSlide();
      frame(s, r, `Control Owners${i ? " (continued)" : ""}`, "Most overdue first");
      table(s, [headRow(["Control Owner", "Department", "Assigned", "Open", "Accepted", "Overdue", "Returned"]), ...part.map((o) => [cell(o.name), cell(o.department ?? ""), cell(o.total), cell(o.open), cell(pct(o.pct)), cell(o.overdue, o.overdue ? { color: BAD, bold: true } : {}), cell(o.returned)])], 1.6, [3, 3.33, 1.2, 1.2, 1.2, 1.2, 1.2]);
    }
    for (const [i, part] of chunk(r.late, 14).entries()) {
      const s = pptx.addSlide();
      frame(s, r, `Overdue · ${r.late.length}${i ? " (continued)" : ""}`);
      if (!part.length) s.addText("Nothing overdue.", { x: 0.5, y: 1.7, w: 8, h: 0.4, fontSize: 14, color: MUTED, fontFace: FONT });
      else table(s, [headRow(["Code", "Requirement", "Control Owner", "Stage", "Due", "Evidence", "Flags"]), ...part.map((x) => reqRow(x, true))], 1.6, [1.1, 5.1, 2, 1.2, 1.1, 0.9, 0.93]);
    }
  } else {
    for (const [i, part] of chunk(r.owners, 14).entries()) {
      const s = pptx.addSlide();
      frame(s, r, `Control Owners${i ? " (continued)" : ""}`, `${r.owners.length} pages follow, one per Control Owner`);
      table(s, [headRow(["Control Owner", "Department", "Assigned", ...STAGES.map((x) => x.label), "Overdue", "Returned"]), ...part.map((o) => [cell(o.name), cell(o.department ?? ""), cell(o.total), ...STAGE_KEYS.map((k) => cell(o.counts[k])), cell(o.overdue, o.overdue ? { color: BAD, bold: true } : {}), cell(o.returned)])], 1.6, [2.4, 2.53, 0.9, 1, 1, 1, 1, 0.75, 0.75]);
    }
    for (const o of r.owners) {
      for (const [i, part] of chunk(o.rows, 11).entries()) {
        const s = pptx.addSlide();
        frame(s, r, `${o.name}${i ? " (continued)" : ""}`, [o.name === UNASSIGNED ? "Requirements nobody owns yet" : o.department, o.email].filter(Boolean).join(" · "));
        kpis(s, [["Assigned", o.total], ["Accepted", pct(o.pct)], ["In review", o.counts.rev], ["In progress", o.counts.prog], ["Not started", o.counts.start], ["Overdue", o.overdue, o.overdue > 0], ["Returned", o.returned, o.returned > 0]], 1.6);
        table(s, [headRow(["Code", "Requirement", "Domain", "Stage", "Due", "Evidence", "Flags"]), ...part.map((x) => reqRow(x, false))], 2.85, [1.1, 5, 2.4, 1.1, 1, 0.9, 0.83]);
      }
    }
  }
  await pptx.writeFile({ fileName: `${reportFileName(r, kind)}.pptx`, compression: true });
}

// ---------- PDF ----------

const PDF_WIDTH = 1180;

/** Each `[data-report-page]` inside `root` starts a new A4 landscape page; a tall one runs onto further pages. */
async function exportPdf(r: WorkspaceReport, kind: ReportKind, root: HTMLElement) {
  const [{ jsPDF }, { toCanvas }] = await Promise.all([import("jspdf"), import("html-to-image")]);
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4", compress: true });
  const margin = 10;
  const pageW = pdf.internal.pageSize.getWidth() - margin * 2;
  const pageH = pdf.internal.pageSize.getHeight() - margin * 2;
  const pages = [...root.querySelectorAll<HTMLElement>("[data-report-page]")];
  let first = true;
  for (const el of pages) {
    // Lay every page out at one desktop width, so the PDF looks the same from any window and
    // wide tables are not cut off by their scroll box.
    const before = el.style.cssText;
    el.style.width = `${PDF_WIDTH}px`;
    el.style.maxWidth = "none";
    await new Promise((r) => setTimeout(r));
    const canvas = await toCanvas(el, { pixelRatio: 1.6, backgroundColor: "#ffffff" }).finally(() => (el.style.cssText = before));
    const mmPerPx = Math.min(pageW / canvas.width, 1);
    const slice = Math.floor(pageH / mmPerPx);
    for (let y = 0; y < canvas.height; y += slice) {
      const h = Math.min(slice, canvas.height - y);
      const part = document.createElement("canvas");
      part.width = canvas.width;
      part.height = h;
      part.getContext("2d")!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(part.toDataURL("image/jpeg", 0.85), "JPEG", margin, margin, canvas.width * mmPerPx, h * mmPerPx);
    }
  }
  pdf.save(`${reportFileName(r, kind)}.pdf`);
}

export async function exportReport(format: ExportFormat, r: WorkspaceReport, kind: ReportKind, root: HTMLElement | null) {
  if (format === "xlsx") return exportExcel(r, kind);
  if (format === "pptx") return exportPptx(r, kind);
  if (root) return exportPdf(r, kind, root);
}
