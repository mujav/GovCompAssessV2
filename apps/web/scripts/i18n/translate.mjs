// Translates scripts/i18n/strings.json into Arabic with Claude and writes the dictionary the
// product uses at runtime (src/lib/i18n/ar.json). Keys already translated are kept, so
// re-running only translates new strings. Needs ANTHROPIC_API_KEY (apps/web/.env).
//
//   node --env-file=.env scripts/i18n/translate.mjs
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";

const STRINGS = new URL("./strings.json", import.meta.url);
const OUT = new URL("../../src/lib/i18n/ar.json", import.meta.url);
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";
const BATCH = 110;
const CONCURRENCY = 6;

const SYSTEM = `You translate the user interface of a Saudi government compliance-assessment platform (a consultant portal for DGA Qiyas, NCA ECC and NDMO frameworks) from English into Arabic.

Write formal, concise Modern Standard Arabic as used in Saudi government digital services. Interface labels stay short (buttons are verbs in the imperative: "حفظ", "إرسال", "إضافة جهة").

Use this glossary consistently:
requirement = المتطلب · requirements = المتطلبات · standard = المعيار · axis = المحور · perspective = المنظور · criterion = البند · control = الضابط · domain = المجال · framework = الإطار · index = المؤشر · entity = الجهة · client = العميل · evidence = الشواهد · evidence library = مكتبة الشواهد · assessment = التقييم · AI assessor = المقيّم الذكي · clarification = الاستيضاح · submission = التقديم · submission pack = حزمة التقديم · consultant = المستشار · engagement = الارتباط · stakeholder = صاحب المصلحة · people = الأشخاص · owner = المسؤول · department = الإدارة · SPOC = ضابط الاتصال · L1 review = مراجعة المستوى الأول · change request = طلب تغيير · draft = مسودة · published/live = منشور · version = الإصدار · weight = الوزن · compliant = ملتزم · partial = التزام جزئي · non-compliant = غير ملتزم · not applicable = لا ينطبق · portfolio = المحفظة · overview = نظرة عامة · my work = أعمالي · follow-ups = المتابعات · Studio = الاستوديو · kickoff = الانطلاق · cycle = الدورة · due = الاستحقاق · overdue = متأخر · upload = رفع · dashboard = لوحة المعلومات.

Keep unchanged: codes and identifiers (5.1.2-3, CR-041, ECC 4-1, ENG-0142, SHA-256), file names, emails, URLs, acronyms (DGA, NCA, ECC, NDMO, SDAIA, PDPL, AI, CSV, PDF, MFA, SSO), and person names written in Latin letters. Write Qiyas as قياس. Keep numbers as Western digits. Keep symbols such as · → ✓ × and emoji as they are.

Strings with {0}, {1}… are templates: keep every placeholder exactly once, and move it to where Arabic grammar needs it. A placeholder is usually a number, a name or a code; agree the words around it sensibly (for counts use a form that reads correctly for any number, e.g. "{0} متطلبات" or "عدد المتطلبات: {0}").

Some strings are fragments of a sentence split by code (for example "of", "to the", "get a user account"); use the context line to translate them so the full sentence reads naturally in Arabic. If a string is not natural language (a technical token, a file extension, a key), return it unchanged.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: {
    items: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["i", "ar"], properties: { i: { type: "integer" }, ar: { type: "string" } } },
    },
  },
};

const strings = JSON.parse(readFileSync(STRINGS, "utf8"));
const done = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const todo = strings.filter((s) => !(s.key in done));
console.log(`${strings.length} strings, ${todo.length} to translate`);

const client = new Anthropic();
const batches = [];
for (let i = 0; i < todo.length; i += BATCH) batches.push(todo.slice(i, i + BATCH));

const placeholders = (s) => (s.match(/\{\d+\}/g) ?? []).sort().join(",");

async function run(batch, n) {
  const body = batch.map((s, i) => `<s i="${i}" kind="${s.kind}">\n<en>${s.key}</en>\n<context>${s.context}</context>\n</s>`).join("\n");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await client.messages
        .stream({
          model: MODEL,
          max_tokens: 32000,
          system: SYSTEM,
          output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
          messages: [{ role: "user", content: `Translate each <en> string. Return one item per string with its index.\n\n${body}` }],
        })
        .finalMessage();
      const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
      const { items } = JSON.parse(text);
      let bad = 0;
      for (const { i, ar } of items) {
        const s = batch[i];
        if (!s || !ar?.trim()) continue;
        if (placeholders(s.key) !== placeholders(ar)) {
          bad++;
          continue;
        }
        done[s.key] = ar.trim();
      }
      console.log(`batch ${n + 1}/${batches.length}: ${items.length} translated${bad ? `, ${bad} rejected (placeholders)` : ""}`);
      return;
    } catch (e) {
      console.log(`batch ${n + 1} attempt ${attempt + 1} failed: ${e.message}`);
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
}

let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < batches.length) {
      const n = next++;
      await run(batches[n], n);
      // Save as we go so an interrupted run keeps its progress.
      writeFileSync(OUT, JSON.stringify(Object.fromEntries(Object.entries(done).sort(([a], [b]) => a.localeCompare(b))), null, 1));
    }
  }),
);
const missing = strings.filter((s) => !(s.key in done)).length;
console.log(`done: ${Object.keys(done).length} in the dictionary, ${missing} missing`);
