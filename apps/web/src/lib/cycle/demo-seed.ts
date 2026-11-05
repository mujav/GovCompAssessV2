// Review content seeded with the demo records: the Index Owner's notes on returned requirements,
// their return messages, the Control Owners' responses on submitted controls and a few comment
// threads. Every line is written from the requirement's own wording and the evidence its
// standard asks for: Arabic for Qiyas, which DGA publishes in Arabic, English for NCA ECC.

import { addDays, ECC_RECORDS, QIYAS_RECORDS, TODAY, type WsRequirement } from "@/lib/workspace/data";
import { baseStage } from "@/lib/journey/work";
import { hashUnit, reqLabel } from "./model";

const INDEX_OWNER = "Sami R.";

export interface DemoSeed {
  notes: Record<string, string>;
  responses: Record<string, { text: string; savedAt: string; by: string }>;
  comments: Record<string, { id: string; by: string; role: string; at: string; text: string }[]>;
  followUps: { id: string; control: string; to: string; text: string; at: string; by: string; kind: "Return" }[];
  returns: Record<string, number>;
}

const at = (daysAgo: number, hour = 10) => `${addDays(TODAY, -daysAgo)}T${String(hour).padStart(2, "0")}:15:00.000Z`;
const lines = (r: WsRequirement) => (r.evidenceText ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
/** First clause of a requirement, for quoting it back: "إعداد إستراتيجية … بحيث تشمل ما يأتي:" → "إعداد إستراتيجية …". */
const gist = (t: string, n = 90) => {
  const s = t.split(/[:،,؛;.]/)[0].trim();
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
};
const months = (item: string) => item.match(/\((\d+)\)\s*شهر/)?.[1];

function byControl(recs: WsRequirement[]) {
  const m = new Map<string, WsRequirement[]>();
  for (const r of recs) m.set(r.controlCode!, [...(m.get(r.controlCode!) ?? []), r]);
  return [...m.entries()];
}

/** Evidence ids as the control screens number them: E1, E2 … across the control's requirements in order. */
function firstIds(list: WsRequirement[]) {
  let n = 0;
  return new Map(list.map((r) => [r.code, `E${(n += Math.max(1, lines(r).length)) - Math.max(1, lines(r).length) + 1}`]));
}

const QIYAS = {
  note(r: WsRequirement) {
    const item = lines(r)[0];
    if (!item) return `أُعيد للتصحيح: لا يوجد مرفق يثبت «${gist(r.title)}». أرفق الوثيقة المعتمدة وأشر إلى الصفحة ذات العلاقة.`;
    const m = months(item);
    return hashUnit(`n:${r.code}`) < 0.5
      ? `أُعيد للتصحيح: المرفق لا يثبت المطلوب في «${gist(item, 110)}». أرفق النسخة المعتمدة${m ? ` بتاريخ اعتماد خلال (${m}) شهرًا` : ""} وأشر إلى صفحة الاعتماد.`
      : `أُعيد للتصحيح: الوثيقة المرفقة مسودة غير موقعة، والمعيار يطلب «${gist(item, 110)}». أرفق النسخة المعتمدة الموقعة.`;
  },
  returnMessage: (ctl: string, n: number) => `${n === 1 ? "متطلب واحد يحتاج" : `${n} متطلبات تحتاج`} إلى تصحيح قبل قبول المعيار ${ctl}. الملاحظات مدونة على كل متطلب.`,
  response(name: string, list: WsRequirement[]) {
    const ids = firstIds(list);
    const parts = list.map((r, i) => `${reqLabel(r.code)}: ${gist(r.title)} [${ids.get(r.code)} · ص.${2 + i}]`);
    return `حققت الجهة متطلبات المعيار «${name}» على النحو الآتي:\n• ${parts.join("\n• ")}`;
  },
  thread(owner: string, r: WsRequirement): [string, string] {
    const item = lines(r)[0] ?? gist(r.title);
    return [`بخصوص «${gist(item, 100)}»: لدينا مسودة بانتظار توقيع صاحب الصلاحية. هل نرفعها الآن أم ننتظر الاعتماد؟`, `انتظر الاعتماد يا ${owner.split(" ")[0]}؛ المعيار يطلب الوثيقة المعتمدة. ارفعها فور توقيعها وأشر إلى صفحة الاعتماد في ردك.`];
  },
};

const ECC = {
  note(r: WsRequirement) {
    const [, records] = lines(r);
    return hashUnit(`n:${r.code}`) < 0.5
      ? `Returned: the policy is attached, but nothing shows ${r.code === r.controlCode ? "the control" : `subcontrol ${r.code}`} is applied this cycle. Attach ${records ? records.charAt(0).toLowerCase() + records.slice(1) : "implementation records"}.`
      : `Returned: the document attached is a draft with no approval by the Authorized Official. Attach the approved version and reference the approval page.`;
  },
  returnMessage: (ctl: string, n: number) => `${n === 1 ? "One item needs" : `${n} items need`} correction before control ${ctl} can be accepted. Notes are on each requirement.`,
  response(_name: string, list: WsRequirement[]) {
    const ids = firstIds(list);
    const parts = list.map((r, i) => `${reqLabel(r.code)}: ${gist(r.title, 110)} [${ids.get(r.code)} · p.${3 + i}]`);
    return `The entity meets control ${list[0].controlCode} as follows:\n• ${parts.join("\n• ")}`;
  },
  thread(owner: string, r: WsRequirement): [string, string] {
    return [`For ${r.code}, the evidence sits in our SIEM and ticketing tool. Is an export of last quarter's records enough, or do you need screenshots?`, `An export is fine, ${owner.split(" ")[0]}, as long as it is dated within this cycle. Reference where ${r.code} is covered in the procedure as well.`];
  },
};

function seedFor(recs: WsRequirement[], w: typeof QIYAS, names: (ctl: string) => string, out: DemoSeed) {
  let threads = 0;
  for (const [ctl, list] of byControl(recs)) {
    const owner = list.find((r) => r.owner)?.owner ?? "";
    const returned = list.filter((r) => r.work === "returned");
    if (returned.length && owner) {
      for (const r of returned) out.notes[r.code] = w.note(r);
      out.returns[ctl] = 1;
      out.followUps.push({ id: `fu-seed-${ctl}`, control: ctl, to: owner, text: w.returnMessage(ctl, returned.length), at: at(2 + (threads % 4)), by: INDEX_OWNER, kind: "Return" });
    }
    // Submitted and accepted controls carry the owner's response.
    if (owner && list.every((r) => baseStage(r) === "rev" || baseStage(r) === "acc")) {
      out.responses[ctl] = { text: w.response(names(ctl), list), savedAt: at(6 + (list.length % 5)), by: owner };
    }
    // A few controls still in progress have a question to the Index Owner on them.
    const open = list.find((r) => baseStage(r) === "prog");
    if (open && owner && threads < 8 && hashUnit(`t:${ctl}`) < 0.4) {
      const [q, a] = w.thread(owner, open);
      out.comments[ctl] = [
        { id: `c-seed-${ctl}-1`, by: owner, role: "Control Owner", at: at(3, 9), text: q },
        { id: `c-seed-${ctl}-2`, by: INDEX_OWNER, role: "Index Owner", at: at(3, 13), text: a },
      ];
      threads++;
    }
  }
}

/** Seeded review content for both demo standards; codes never clash between them. */
export function demoSeed(names: (ctl: string) => string): DemoSeed {
  const out: DemoSeed = { notes: {}, responses: {}, comments: {}, followUps: [], returns: {} };
  seedFor(QIYAS_RECORDS, QIYAS, names, out);
  seedFor(ECC_RECORDS, ECC, names, out);
  out.followUps.sort((a, b) => b.at.localeCompare(a.at));
  return out;
}
