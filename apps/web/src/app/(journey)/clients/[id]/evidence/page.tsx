"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/journey/icon";
import { useDraftSender } from "@/components/journey/draft-drawer";
import { ClientShell, JMain } from "@/components/journey/shell";
import { Avatar, Bar, JButton, Panel, PanelHead, Pill, type PillTone } from "@/components/journey/ui";
import { cx } from "@/components/ui";
import { clientHref } from "@/lib/journey/portfolio";
import { libraryKey, requirementUploads, type LibraryUpload } from "@/lib/journey/evidence";
import { useJourney, useScreenState } from "@/lib/journey/store";
import { useClientWork } from "@/lib/journey/use-work";
import { codeKey, initials } from "@/lib/journey/work";

// 11 · Evidence library. One register for every file, its validity and the requirements it
// supports. Uploads are classified and mapped by AI; the consultant confirms each link.

const TYPE: Record<string, [string, string]> = {
  PDF: ["#FDECEA", "#B42318"],
  DOC: ["#E0ECF8", "#1E4E8C"],
  XLS: ["#E7F3ED", "#0E5A45"],
  IMG: ["#F3E8F7", "#7A2E8C"],
  PPT: ["#FDE9D9", "#9A3412"],
  ZIP: ["#F5F7F6", "#47534D"],
};

const PROBLEM: Record<string, [string, PillTone]> = {
  "Covers the wrong reporting period": ["Wrong period", "warn"],
  "Approval signature missing": ["No signature", "bad"],
  "Scan is unreadable": ["Unreadable", "bad"],
  "Document is a draft, not the approved version": ["Outdated", "warn"],
};

function typeOf(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "PDF";
  if (["doc", "docx", "txt", "md"].includes(ext)) return "DOC";
  if (["xls", "xlsx", "csv"].includes(ext)) return "XLS";
  if (["png", "jpg", "jpeg", "gif", "webp", "heic"].includes(ext)) return "IMG";
  if (["ppt", "pptx"].includes(ext)) return "PPT";
  return "ZIP";
}

type Upload = LibraryUpload;
const RECO: Record<string, PillTone> = { Compliant: "ok", Partial: "warn", "Non-compliant": "bad", "Insufficient evidence": "gray" };

interface Doc {
  id: string;
  type: string;
  name: string;
  lang: string;
  owner: string;
  dept: string;
  codes: string[];
  valid: [string, PillTone];
  issue?: string;
}

export default function EvidencePage() {
  const { client, ws, framework, workspace, reqs, log } = useClientWork();
  const { send, drawer } = useDraftSender();
  // Uploads are mapped to one framework's requirements, so each framework keeps its own list.
  const [uploads, setUploads] = useScreenState<Upload[]>(libraryKey(client.id, framework?.id, workspace), []);
  // Files uploaded on requirement pages belong to the same library.
  const { state: journey } = useJourney();
  const onRequirements = useMemo(() => (framework ? requirementUploads(journey.screens, client.id, framework.id) : []), [journey.screens, client.id, framework]);
  const [picked, setPicked] = useState(0);
  const [filter, setFilter] = useState<"all" | "fix" | "ok">("all");
  const [toast, setToast] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const c = (p: string) => clientHref(client.id, p);

  const m = useMemo(() => {
    const expected = reqs.reduce((a, r) => a + r.evidence.expected, 0);
    const valid = reqs.reduce((a, r) => a + r.evidence.valid, 0);
    const invalid = reqs.reduce((a, r) => a + r.evidence.invalid, 0);
    // File-validation issues belong to the shared workspace records only.
    const issues = workspace ? ws.ctx.issues.filter((i) => reqs.some((r) => r.code === i.code)) : [];
    const returned = workspace ? ws.state.returned.length : 0;
    const pending = uploads.filter((u) => !u.linked).length;
    const linkedUploads = uploads.filter((u) => u.linked).length;
    const missing = Math.max(0, expected - valid - invalid - linkedUploads);
    const docs: Doc[] = [
      ...onRequirements.map(({ code, file, run }) => {
        const r = reqs.find((x) => x.code === code);
        return {
          id: file.id,
          type: typeOf(file.name),
          name: file.name,
          lang: "—",
          owner: r?.owner || "Sami R.",
          dept: r?.department || "Uploaded on the requirement",
          codes: [code],
          valid: (run ? [`AI: ${run.recommendation}`, RECO[run.recommendation] ?? "gray"] : ["Uploaded · not assessed", "cx"]) as [string, PillTone],
        };
      }),
      ...uploads
        .filter((u) => u.linked)
        .map((u) => ({ id: u.id, type: typeOf(u.name), name: u.name, lang: "EN", owner: "Sami R.", dept: "Demo Advisory", codes: u.suggested, valid: ["Valid", "ok"] as [string, PillTone] })),
      ...issues.map((i) => {
        const r = reqs.find((x) => x.code === i.code)!;
        const back = ws.state.returned.includes(i.id);
        return {
          id: i.id,
          type: ["PDF", "XLS", "IMG", "DOC"][Number(i.id.slice(-1)) % 4],
          name: `${r.title.split(":")[0]} record`,
          lang: Number(i.id.slice(-1)) % 3 === 0 ? "AR" : "EN",
          owner: r.owner,
          dept: r.department,
          codes: [r.code],
          valid: back ? (["Returned to owner", "cx"] as [string, PillTone]) : PROBLEM[i.problem],
          issue: i.problem,
        };
      }),
      ...reqs
        .filter((r) => r.evidence.valid > 0)
        .sort((a, b) => codeKey(a.code).localeCompare(codeKey(b.code)))
        .slice(0, 12)
        .map((r, i) => ({
          id: `EV-${1700 + i * 17}`,
          type: ["PDF", "DOC", "PPT", "PDF"][i % 4],
          name: `${r.title.split(":")[0]} · approved`,
          lang: i % 3 === 0 ? "AR/EN" : "EN",
          owner: r.owner,
          dept: r.department,
          codes: [r.code, ...(i % 2 ? [] : [reqs[(i * 7) % reqs.length].code])],
          valid: ["Valid", "ok"] as [string, PillTone],
        })),
    ];
    return { expected, valid: valid + linkedUploads, invalid, returned, pending, missing, docs };
  }, [reqs, ws, uploads, workspace, onRequirements]);

  // Simulated pipeline: upload → OCR → classify → map. Ticks while any upload is processing.
  const processing = uploads.some((u) => u.pct < 100);
  useEffect(() => {
    if (!processing) return;
    const t = window.setInterval(() => {
      setUploads((list) => {
        for (const u of list) {
          if (u.pct >= 100) continue;
          u.pct = Math.min(100, u.pct + 20);
          if (u.pct === 100) {
            const words = u.name.toLowerCase().split(/[^a-z؀-ۿ]+/).filter((w) => w.length > 3);
            const hits = reqs.filter((r) => words.some((w) => r.title.toLowerCase().includes(w))).slice(0, 2);
            u.suggested = (hits.length ? hits : reqs.length ? [reqs[(u.size + u.name.length) % reqs.length]] : []).map((r) => r.code);
          }
        }
      });
    }, 600);
    return () => window.clearInterval(t);
  }, [processing, reqs, setUploads]);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const now = Date.now();
    setUploads((list) => {
      Array.from(files).forEach((f, i) => list.unshift({ id: `EV-U${(now + i) % 100000}`, name: f.name, size: f.size, pct: 0, suggested: [], linked: false }));
    });
    log(`Uploaded ${files.length} evidence file${files.length > 1 ? "s" : ""} to ${client.name}`);
  };

  const shown = m.docs.filter((d) => filter === "all" || (filter === "ok" ? d.valid[1] === "ok" : d.valid[1] !== "ok"));
  const doc = shown[Math.min(picked, shown.length - 1)];
  const segs = [
    { l: "Valid", n: m.valid, c: "#1F9D6E" },
    { l: "Need fixes", n: m.invalid, c: "#E0A100" },
    { l: "Pending", n: m.pending, c: "#8B85F0" },
    { l: "Missing", n: m.missing, c: "#C9D1CD" },
  ];

  return (
    <ClientShell>
      <JMain>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="m-0 text-[30px] leading-9 font-bold tracking-[-0.02em]">Evidence</h1>
          <div className="flex gap-2">
            <JButton onClick={() => setToast("Register import needs a CSV with file, owner and requirement columns.")}>Import register</JButton>
            <JButton variant="primary" onClick={() => input.current?.click()}>
              <Icon name="upload" size={15} />
              Upload
            </JButton>
          </div>
        </div>
        <input ref={input} type="file" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} aria-label="Upload evidence files" />

        <Panel aria-label="Evidence health" className="flex flex-col gap-3.5 p-[22px]">
          <PanelHead
            title="Health"
            aside={
              <span className="text-[13px] text-j-muted">
                <b className="text-j-ink">{m.valid + m.invalid + m.pending}</b> of {m.expected} expected received
              </span>
            }
          />
          <div role="img" aria-label={segs.map((s) => `${s.n} ${s.l.toLowerCase()}`).join(", ")} className="flex h-3.5 gap-[3px] overflow-hidden rounded-lg">
            {segs
              .filter((s) => s.n > 0)
              .map((s) => (
                <span key={s.l} style={{ flex: s.n, background: s.c }} />
              ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {segs.map((s) => (
              <button
                key={s.l}
                type="button"
                onClick={() => setFilter(s.l === "Valid" ? "ok" : s.l === "Need fixes" ? "fix" : "all")}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-j-line bg-white px-3 text-[13px] text-j-ink-2"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.c }} />
                {s.l}
                <b className="text-j-ink">{s.n}</b>
              </button>
            ))}
            {m.returned > 0 && <Pill tone="cx">{m.returned} returned to owners</Pill>}
          </div>
        </Panel>

        {toast && (
          <p role="status" className="m-0 flex items-center gap-2 rounded-xl bg-cx-soft px-4 py-3 text-sm font-semibold text-cx">
            <Icon name="check" size={15} />
            {toast}
          </p>
        )}

        <div className="flex flex-wrap items-start gap-3.5">
          <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-3.5">
            <Panel className="flex flex-col gap-2.5 p-[18px]">
              <button
                type="button"
                onClick={() => input.current?.click()}
                onDragOver={(e) => (e.preventDefault(), setDrag(true))}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={cx("flex min-h-[72px] cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-sm", drag ? "border-cx bg-cx-soft" : "border-cx-line bg-cx-tint")}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-cx text-white">
                  <Icon name="upload" size={18} />
                </span>
                <span>
                  <b>Drop files</b> <span className="text-j-muted">or browse · PDF, Office, images</span>
                </span>
              </button>
              {uploads
                .filter((u) => !u.linked)
                .map((u) => {
                  const step = u.pct < 40 ? "OCR" : u.pct < 100 ? "Classifying" : `Mapped · ${u.suggested.length}`;
                  return (
                    <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-j-line-soft px-3 py-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg text-[10px] font-bold" style={{ background: TYPE[typeOf(u.name)][0], color: TYPE[typeOf(u.name)][1] }}>
                        {typeOf(u.name)}
                      </span>
                      <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-1.5">
                        <span className="flex justify-between gap-2 text-[13px]">
                          <span className="truncate font-semibold">{u.name}</span>
                          <span className={cx("font-semibold", u.pct < 100 ? "text-j-ai" : "text-brand")}>{step}</span>
                        </span>
                        <Bar pct={u.pct} color={u.pct < 100 ? "#4F46E5" : "#1F9D6E"} height={4} />
                      </span>
                      {u.pct === 100 && (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-j-muted">AI suggests</span>
                          {u.suggested.map((s) => (
                            <Link key={s} href={c(`/requirements/${s}`)} className="rounded-md bg-j-ai-soft px-1.5 py-0.5 font-mono text-xs text-j-ai no-underline">
                              {s}
                            </Link>
                          ))}
                          <JButton
                            size="sm"
                            variant="primary"
                            onClick={() => {
                              setUploads((l) => void (l.find((x) => x.id === u.id)!.linked = true));
                              log(`Linked ${u.name} to ${u.suggested.join(", ")}`);
                            }}
                          >
                            Confirm link
                          </JButton>
                          <JButton size="sm" variant="ghost" onClick={() => setUploads((l) => void l.splice(l.findIndex((x) => x.id === u.id), 1))}>
                            Discard
                          </JButton>
                        </span>
                      )}
                    </div>
                  );
                })}
            </Panel>

            <Panel className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-[22px] py-4">
                <h2 className="m-0 text-base">Register</h2>
                <select aria-label="Filter register" value={filter} onChange={(e) => (setFilter(e.target.value as typeof filter), setPicked(0))} className="h-9 rounded-[10px] border border-j-line bg-white px-2.5 text-[13px]">
                  <option value="all">All files</option>
                  <option value="fix">Need fixes</option>
                  <option value="ok">Valid</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <div role="table" aria-label="Evidence register" className="min-w-[640px] text-sm">
                  {shown.map((d, i) => (
                    <div key={d.id} role="row" className={cx("grid grid-cols-[2.4fr_1.4fr_0.5fr_1fr] items-center gap-3 border-t border-j-line-soft px-[22px] py-2.5", doc?.id === d.id ? "bg-[#F2F8F5]" : "bg-white")}>
                      <span role="cell" className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[10px] font-bold" style={{ background: TYPE[d.type][0], color: TYPE[d.type][1] }}>
                          {d.type}
                        </span>
                        <button type="button" onClick={() => setPicked(i)} className="flex min-w-0 cursor-pointer flex-col border-0 bg-transparent p-0 text-start text-j-ink">
                          <span className="truncate font-semibold">{d.name}</span>
                          <span className="text-xs text-j-muted">
                            <span className="font-mono">{d.id}</span> · {d.lang}
                          </span>
                        </button>
                      </span>
                      <span role="cell" className="flex min-w-0 items-center gap-2">
                        <Avatar initials={initials(d.owner)} size={26} />
                        <span className="truncate text-[13px]">{d.dept}</span>
                      </span>
                      <span role="cell" title="Linked requirements" className="inline-flex items-center gap-1 text-[13px] text-j-muted">
                        <Icon name="link" size={13} />
                        {d.codes.length}
                      </span>
                      <span role="cell">
                        <Pill tone={d.valid[1]}>{d.valid[0]}</Pill>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>

          {doc && (
            <aside aria-label="Preview" className="sticky top-4 flex min-w-0 flex-[2_1_340px] flex-col gap-3 rounded-[20px] border border-j-line bg-white p-[18px]">
              <div className="flex items-start justify-between gap-2">
                <span className="flex flex-col">
                  <b>{doc.name}</b>
                  <span className="font-mono text-xs text-j-muted">{doc.id} · p.1</span>
                </span>
                <Pill tone={doc.valid[1]}>{doc.valid[0]}</Pill>
              </div>
              <div className="flex flex-col gap-2 rounded-xl bg-j-canvas p-5">
                {[90, 70, 84, 0, 62, 76].map((w, i) =>
                  w ? (
                    <span key={i} className="block h-2 rounded bg-[#DDE3E0]" style={{ width: `${w}%` }} />
                  ) : (
                    <span key={i} className="rounded-lg border-s-[3px] border-j-ai bg-j-ai-soft px-3 py-2 text-[13px] text-j-ink-2">
                      {doc.issue ? `Flagged: ${doc.issue.toLowerCase()}.` : "Passage matches the requirement criteria."}
                    </span>
                  ),
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Pill>OCR 97%</Pill>
                <Pill>{doc.lang}</Pill>
                <Pill tone="ai" className="cursor-help">
                  <span title="Instruction-like text inside the file was treated as data and ignored.">
                    <Icon name="shield" size={12} /> Safe
                  </span>
                </Pill>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                <span className="text-j-muted">Supports</span>
                {doc.codes.map((s) => (
                  <Link key={s} href={c(`/requirements/${s}`)} className="rounded-md bg-cx-soft px-1.5 py-0.5 font-mono text-xs text-cx no-underline">
                    {s}
                  </Link>
                ))}
              </div>
              <div className="flex gap-2">
                {doc.issue && !ws.state.returned.includes(doc.id) && (
                  <JButton
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      send("return", doc.codes, () => setToast(`${doc.id} returned to ${doc.owner || "the owner"}.`));
                    }}
                  >
                    Request update
                  </JButton>
                )}
                <JButton size="sm" onClick={() => setToast(`${doc.id} is linked to ${doc.codes.join(", ")}.`)}>
                  Link
                </JButton>
              </div>
            </aside>
          )}
        </div>
      </JMain>
    {drawer}
    </ClientShell>
  );
}
