// Framework library: every framework or index in the platform with its versions and dates,
// and the duplicate rules that stop the same framework being added twice. A framework is a
// duplicate when one of its source documents was already imported (same SHA-256), or when
// its name matches an existing framework once case, Arabic letter variants, punctuation and
// version or year tokens are ignored.

import type { FrameworkPackage, FrameworkVersion } from "./types";

export function dateStamp(d = new Date()) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const VERSION_WORDS = /\b(?:v|ver|version|rev|issue|edition)\s*\.?\s*\d+(?:\.\d+)*\b|(?:الإصدار|الاصدار|إصدار|اصدار|النسخة|نسخة)\s*\d+(?:\.\d+)*|\b\d+(?:\.\d+)+\b|\b(?:19|20)\d{2}\b/giu;

/** Name reduced to what identifies the framework: no case, diacritics, letter variants, versions, years or punctuation. */
export function nameKey(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(VERSION_WORDS, " ")
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similar(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const ta = new Set(a.split(" "));
  const tb = new Set(b.split(" "));
  const shared = [...ta].filter((t) => tb.has(t)).length;
  // Near-identical wording ("Qiyas 2026" vs "Qiyas", "NCA ECC" vs "NCA ECC controls") counts as the same framework.
  return shared / Math.max(ta.size, tb.size) >= 0.8 || (Math.min(ta.size, tb.size) >= 2 && shared === Math.min(ta.size, tb.size));
}

/** Versions saved before full hashes were kept carry only the short form "4cfb…1afc" from the import job. */
function hashMatches(stored: string, full: string) {
  if (stored === full) return true;
  const [head, tail] = stored.split("…");
  return tail !== undefined && head.length >= 4 && full.startsWith(head) && full.endsWith(tail);
}

export interface LibraryVersion {
  version: string;
  status: "live" | "draft" | "in review" | "superseded";
  effective: string;
  createdAt?: string;
  publishedAt?: string;
  supersededAt?: string;
  nodes: number;
  fileHashes: string[];
}

/** All versions of a framework, newest first. */
export function versionsOf(pkg: FrameworkPackage): LibraryVersion[] {
  const out: LibraryVersion[] = [];
  const add = (v: FrameworkVersion, status: LibraryVersion["status"]) =>
    out.push({
      version: v.version,
      status,
      effective: v.effective,
      createdAt: v.createdAt,
      publishedAt: v.publishedAt,
      nodes: v.requirements?.length ?? 0,
      fileHashes: v.fileHashes ?? (v.importJob?.hash.includes("…") ? [v.importJob.hash] : []),
    });
  if (pkg.draft) add(pkg.draft, pkg.pendingCr ? "in review" : "draft");
  if (pkg.live) add(pkg.live, "live");
  for (const h of pkg.history ?? []) out.push({ ...h, status: "superseded", fileHashes: h.fileHashes ?? [] });
  return out;
}

export interface Duplicate {
  pkgId: string;
  name: string;
  version?: string;
  reason: "same_file" | "same_name" | "same_version";
  message: string;
}

const current = (p: FrameworkPackage) => (p.draft ?? p.live)!;

/** First matching framework for a document that is about to be added, by file then by name. */
export function findDuplicate(frameworks: FrameworkPackage[], probe: { name?: string; hashes?: string[]; exceptId?: string }): Duplicate | null {
  const hashes = new Set((probe.hashes ?? []).filter(Boolean));
  if (hashes.size) {
    for (const p of frameworks) {
      if (p.id === probe.exceptId) continue;
      const hit = versionsOf(p).find((v) => v.fileHashes.some((h) => [...hashes].some((x) => hashMatches(h, x))));
      if (hit)
        return {
          pkgId: p.id,
          name: current(p).name,
          version: hit.version,
          reason: "same_file",
          message: `This document is already in the library as ${current(p).name} v${hit.version} (${hit.status}${hit.publishedAt ? `, published ${hit.publishedAt}` : hit.createdAt ? `, added ${hit.createdAt}` : ""}).`,
        };
    }
  }
  const key = nameKey(probe.name ?? "");
  if (key) {
    for (const p of frameworks) {
      if (p.id === probe.exceptId) continue;
      const names = [p.live?.name, p.draft?.name].filter((n): n is string => !!n);
      if (names.some((n) => similar(nameKey(n), key)))
        return {
          pkgId: p.id,
          name: current(p).name,
          version: current(p).version,
          reason: "same_name",
          message: `${current(p).name} is already in the library (v${current(p).version}). Add this document as a new version of it instead.`,
        };
    }
  }
  return null;
}

/** The same file must not come back as a later version of the same framework either. */
export function findVersionClash(pkg: FrameworkPackage, probe: { version?: string; hashes?: string[] }): Duplicate | null {
  const hashes = new Set((probe.hashes ?? []).filter(Boolean));
  const name = current(pkg).name;
  for (const v of versionsOf(pkg)) {
    if (v.fileHashes.some((h) => [...hashes].some((x) => hashMatches(h, x))))
      return { pkgId: pkg.id, name, version: v.version, reason: "same_file", message: `This document is already ${name} v${v.version} (${v.status}). Upload the changed document instead.` };
    if (probe.version && v.version.trim() === probe.version.trim() && v.status !== "draft")
      return { pkgId: pkg.id, name, version: v.version, reason: "same_version", message: `${name} already has a v${v.version} (${v.status}).` };
  }
  return null;
}

/** Before a framework draft goes live: record the outgoing live version in the history and date the new one. */
export function retireLive(pkg: FrameworkPackage, today = dateStamp()) {
  if (pkg.live)
    (pkg.history ??= []).unshift({
      version: pkg.live.version,
      effective: pkg.live.effective,
      publishedAt: pkg.live.publishedAt,
      supersededAt: today,
      nodes: pkg.live.requirements?.length ?? 0,
      fileHashes: pkg.live.fileHashes,
    });
  if (pkg.draft) pkg.draft.publishedAt = today;
}
