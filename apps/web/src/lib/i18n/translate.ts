// Arabic translation of the interface. The dictionary (ar.json) maps the English text the
// code renders to Arabic: plain strings, and templates with {0}, {1}… for text built around
// values. translateText() is pure and testable; the DOM translator in ./dom.ts applies it to
// the page in place, so every screen, label and demo record is covered without each
// component having to look strings up.

import AR from "./ar.json";

export type Locale = "en" | "ar";

const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const MONTHS: Record<string, string> = {
  Jan: "يناير",
  Feb: "فبراير",
  Mar: "مارس",
  Apr: "أبريل",
  May: "مايو",
  Jun: "يونيو",
  Jul: "يوليو",
  Aug: "أغسطس",
  Sep: "سبتمبر",
  Sept: "سبتمبر",
  Oct: "أكتوبر",
  Nov: "نوفمبر",
  Dec: "ديسمبر",
};

const ASPECT: Record<string, string> = { defined: "معرّف", "in place": "مطبّق", "in use": "مستخدم", reviewed: "تمت مراجعته" };

/** Short forms the code builds from numbers and dates (not worth a dictionary entry each). */
const RULES: [RegExp, (...m: string[]) => string][] = [
  [/^(\d+) d$/, (_, n) => `${n} يوم`],
  [/^(\d+) d left$/, (_, n) => `متبقٍ ${n} يوم`],
  [/^(\d+) d ago$/, (_, n) => `قبل ${n} يوم`],
  [/^(\d+)d$/, (_, n) => `${n} يوم`],
  [/^(\d+) mo$/, (_, n) => `${n} شهر`],
  [/^(\d+) months?$/, (_, n) => `${n} شهر`],
  [/^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)(?: (\d{4}))?$/, (_, d, m, y) => `${d} ${MONTHS[m]}${y ? ` ${y}` : ""}`],
  [/^(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec),? (\d{1,2}:\d{2})$/, (_, d, m, t) => `${d} ${MONTHS[m]}، ${t}`],
  [/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec) (\d{4})$/, (_, m, y) => `${MONTHS[m]} ${y}`],
  [/^v(\d[\w.]*)$/, (_, v) => `الإصدار ${v}`],
  [/^by (\d\d-\d\d)$/, (_, d) => `بحلول ${d}`],
  [/^(\d+) d late$/, (_, n) => `متأخر ${n} يوم`],
];

interface Pattern {
  re: RegExp;
  ar: string;
  /** Literal characters, so the most specific template wins. */
  weight: number;
}

function build(dict: Record<string, string>) {
  const exact = new Map<string, string>();
  const lower = new Map<string, string>();
  const patterns: Pattern[] = [];
  for (const [en, ar] of Object.entries(dict)) {
    if (!ar || ar === en) continue;
    if (/\{\d+\}/.test(en)) {
      const parts = en.split(/(\{\d+\})/);
      // Spaces next to values are optional: JSX sometimes drops them across line breaks.
      // Literal words match whole words only, so "in" never matches inside "Drafting".
      // Only where the key has a space: "day{1}" (a plural ending) continues the same word.
      const word = (p: string) => {
        const t = norm(p);
        if (!t) return "";
        const lead = /^\s/.test(p) && /^[A-Za-z]/.test(t) ? "(?<![A-Za-z])" : "";
        const trail = /\s$/.test(p) && /[A-Za-z]$/.test(t) ? "(?![A-Za-z])" : "";
        return lead + escape(t).replace(/ /g, "\\s*") + trail;
      };
      // A value never spans a " · " separator: those split a line into separate facts.
      const src = parts.map((p) => (/^\{\d+\}$/.test(p) ? "((?:(?! · ).)*?)" : word(p))).join("\\s*");
      const order = parts.filter((p) => /^\{\d+\}$/.test(p)).map((p) => Number(p.slice(1, -1)));
      const literal = parts.filter((p) => !/^\{\d+\}$/.test(p)).join("").replace(/\s/g, "").length;
      if (literal < 2) continue;
      try {
        // Captured groups appear in source order; map them back to their indexes.
        patterns.push({ re: new RegExp(`^${src}$`, "s"), ar: ar.replace(/\{(\d+)\}/g, (_, n) => `{#${order.indexOf(Number(n))}}`), weight: literal });
      } catch {
        // A malformed key never breaks the page.
      }
    } else {
      exact.set(norm(en), ar);
      lower.set(norm(en).toLowerCase(), ar);
    }
  }
  patterns.sort((a, b) => b.weight - a.weight);
  return { exact, lower, patterns };
}

let tables: ReturnType<typeof build> | null = null;
const getTables = () => (tables ??= build(AR as Record<string, string>));

/** Translates one rendered string to Arabic, or returns null when the dictionary has nothing for it. */
export function translateText(input: string, depth = 0): string | null {
  const s = norm(input);
  if (!s || !/[A-Za-z]/.test(s)) return null;
  const { exact, lower, patterns } = getTables();
  const hit = exact.get(s);
  if (hit) return hit;
  // Headings shown in capitals ("DEMO ENTITY") use the same entry.
  // Values the code changed the case of ("covers the wrong period") use the same entry.
  if (s === s.toUpperCase() || depth > 0) {
    const ci = lower.get(s.toLowerCase());
    if (ci) return ci;
  }
  // "<name> v1.2": the name as the dictionary knows it, then the version.
  const ver = s.match(/^(.+) v(\d[\w.]*)$/);
  if (ver && depth < 2) {
    const name = translateText(ver[1], depth + 1);
    if (name) return `${name} · الإصدار ${ver[2]}`;
  }
  for (const [re, fn] of RULES) {
    const m = s.match(re);
    if (m) return fn(...m);
  }
  if (depth > 2) return null;
  // Separators the code puts around a value (" · Strategy & Performance").
  const wrapped = s.match(/^([·•\-–—:,]\s*)(.+?)(\s*[·•:,])?$/);
  if (wrapped && (wrapped[1] || wrapped[3])) {
    const core = translateText(wrapped[2], depth + 1);
    if (core) return `${wrapped[1] ?? ""}${core}${wrapped[3] ?? ""}`;
  }
  // Demo requirement titles are "<topic>: <aspect>".
  const titled = s.match(/^(.+): (defined|in place|in use|reviewed)$/);
  if (titled) {
    const topic = translateText(titled[1], depth + 1);
    if (topic) return `${topic}: ${ASPECT[titled[2]]}`;
  }
  for (const p of patterns) {
    const m = s.match(p.re);
    if (!m) continue;
    // Values inside a template (a name, a status, a date) are translated when the dictionary knows them.
    return p.ar.replace(/\{#(\d+)\}/g, (_, i) => {
      const v = m[Number(i) + 1] ?? "";
      // English plural endings the code adds ("day{1}" → "days") have no place in Arabic.
      if (/^(s|es)$/.test(v)) return "";
      return translateText(v, depth + 1) ?? v;
    });
  }
  // "Label 12, Label 3" lists (chart descriptions).
  if (depth > 0 && s.includes(", ")) {
    const items = s.split(", ").map((x) => {
      const m = x.match(/^(.+?) (\d+(?:\.\d+)?%?)$/);
      if (m) return `${translateText(m[1], depth + 1) ?? m[1]} ${m[2]}`;
      const lead = x.match(/^(\d+(?:\.\d+)?%?) (.+)$/);
      if (lead) return `${lead[1]} ${translateText(lead[2], depth + 1) ?? lead[2]}`;
      return translateText(x, depth + 1) ?? x;
    });
    return items.join("، ");
  }
  // "A · B · C", "Axis › Standard" and "Qiyas + NCA ECC" lines are built from separately known parts.
  for (const sep of [" · ", " › ", " + ", " / "]) {
    if (!s.includes(sep)) continue;
    const parts = s.split(sep);
    const done = parts.map((p) => translateText(p, depth + 1));
    if (done.some(Boolean)) return parts.map((p, i) => done[i] ?? p).join(sep);
  }
  return null;
}
