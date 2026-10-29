import Link from "next/link";
import { GridRow, GridTable } from "@/components/ui";
import { COMPLIANCE, type ComplianceKey } from "@/lib/status";

// Department SPOC landing in Arabic, right-to-left. Same tokens as the workspace shell.

const AR_COMPLIANCE: Record<ComplianceKey, string> = {
  comp: "ممتثل",
  part: "ممتثل جزئيًا",
  non: "غير ممتثل",
  nas: "لم يُقيَّم",
  na: "لا ينطبق",
};

const NAV = [
  {
    heading: "مساحة العمل",
    items: [
      { href: "/spoc", label: "متطلباتي", badge: 12, current: true },
      { href: "/evidence", label: "الأدلة" },
      { href: "/actions", label: "الطلبات والتذكيرات" },
      { href: "/remediation", label: "الإجراءات التصحيحية" },
      { href: "/clarifications", label: "الاستيضاحات" },
    ],
  },
  { heading: "التحليلات", items: [{ href: "/departments", label: "أداء إدارتي" }] },
];

const summary: [string, number, string?, string?][] = [
  ["مسندة إلى إدارتي", 58],
  ["بحاجة إلى أدلة", 12, "#8A4B00", "#EDD6AA"],
  ["معادة للتصحيح", 4, "#8A4B00", "#EDD6AA"],
  ["متأخرة", 6, "#A3261B", "#EBC4BE"],
  ["قيد المراجعة", 9],
];

const rows: [string, string, ComplianceKey, string, string, string, boolean][] = [
  ["5.11.2-2", "الأنظمة المتكاملة تُظهر تبادل البيانات من طرف إلى طرف", "nas", "لا يوجد تحديث", "#A3261B", "4 نوفمبر", true],
  ["5.3.1-1", "تحديث مستودع البنية المؤسسية", "part", "معاد للتصحيح", "#C27B12", "7 نوفمبر", false],
  ["5.11.1-1", "سجل التكاملات محدّث ومعتمد", "comp", "بحاجة إلى تحديث", "#C27B12", "8 نوفمبر", false],
  ["5.2.4-1", "خطة استمرارية الأعمال للأنظمة الحرجة", "part", "تم تقديم الأدلة", "#3F6FB5", "10 نوفمبر", false],
  ["5.6.2-3", "مؤشرات توافر الخدمات الرقمية منشورة", "comp", "جاهز للتسليم", "#2E8B6A", "—", false],
  ["5.7.1-2", "ترتيبات الاستضافة ضمن الخدمات المشتركة", "na", "مغلق", "#7D8C85", "—", false],
];

const COLS = "0.8fr 2.6fr 1.2fr 1.3fr 0.8fr";

const btn = "inline-flex h-11 items-center rounded-lg px-3.5 text-sm no-underline";

export default function SpocPage() {
  return (
    <div dir="rtl" lang="ar" className="flex min-h-screen flex-wrap bg-canvas font-arabic text-ink">
      <nav aria-label="القائمة الرئيسية" className="box-border flex flex-[1_1_240px] flex-col gap-[18px] bg-nav px-3.5 py-5 text-[#E4ECE8] lg:max-w-[260px]">
        <div className="flex items-center gap-2.5 px-1.5">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] bg-mint text-base font-bold text-white">ذ</div>
          <div>
            <div className="text-[15px] font-semibold text-white">منصة ذكاء الامتثال</div>
            <div className="text-xs text-nav-muted">الجهة التجريبية · بيئة تجريبية</div>
          </div>
        </div>
        <button type="button" className="flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-[10px] border-0 bg-nav-2 px-3 py-2.5 text-right text-white">
          <span className="text-xs text-nav-muted">الإطار · الدورة</span>
          <span className="text-sm font-semibold">قياس 2026 · الدورة الأولى ▾</span>
        </button>
        {NAV.map((g) => (
          <div key={g.heading} className="flex flex-col gap-0.5">
            <div className="px-2.5 py-1 text-xs text-nav-muted">{g.heading}</div>
            {g.items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                aria-current={"current" in it ? "page" : undefined}
                className={
                  "current" in it
                    ? "flex min-h-11 items-center justify-between rounded-lg bg-nav-active px-2.5 text-[15px] font-semibold text-white no-underline hover:text-white"
                    : "flex min-h-11 items-center justify-between rounded-lg px-2.5 text-[15px] text-nav-text no-underline hover:bg-nav-2 hover:text-white"
                }
              >
                {it.label}
                {"badge" in it && <span className="rounded-full bg-mint px-[7px] py-px text-[11px] font-semibold text-white">{it.badge}</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="flex min-w-0 flex-[999_1_560px] flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-white px-8 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="text-[13px] text-muted">إدارة العمليات التقنية · منسق الإدارة: فيصل ك.</div>
            <h1 className="m-0 text-[26px] leading-9 font-bold">متطلباتي</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link href="/requirements" lang="en" dir="ltr" className={`${btn} border border-field bg-white font-sans text-ink hover:text-ink`}>
              English
            </Link>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#DCEDE5] text-[15px] font-semibold text-brand">ف</div>
          </div>
        </header>

        <main className="box-border flex w-full max-w-[1280px] flex-col gap-4 px-8 pb-12 pt-6">
          <section aria-label="ملخص" className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
            {summary.map(([label, n, color, border]) => (
              <div key={label} className="rounded-xl border bg-white px-4 py-3.5" style={{ borderColor: border ?? "#DCE2DE" }}>
                <div className="text-[13px] text-muted">{label}</div>
                <div className="text-[26px] font-bold" style={{ color }}>
                  {n}
                </div>
              </div>
            ))}
          </section>

          <h2 className="mt-2 mb-0 text-lg font-semibold">ما المطلوب منك الآن</h2>

          <article className="overflow-hidden rounded-[14px] border border-line bg-white">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
              <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-bold text-brand">طلب أدلة</span>
                  <span dir="ltr" className="font-mono text-[13px] font-semibold">
                    5.11.2-2
                  </span>
                </div>
                <h3 className="m-0 text-[17px] leading-7 font-semibold">الأنظمة المتكاملة تُظهر تبادل البيانات من طرف إلى طرف</h3>
              </div>
              <div className="text-left text-[13px] leading-5">
                <span className="font-bold text-bad">الموعد 4 نوفمبر · بعد 7 أيام</span>
                <br />
                <span className="text-muted">التذكير 2 من 2</span>
              </div>
            </div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4 px-5 py-4 text-sm leading-6">
              <div>
                <div className="mb-1 text-xs font-semibold text-muted">الأدلة المطلوبة بالتحديد</div>
                <ul className="m-0 pr-[18px] pl-0">
                  <li>
                    نموذج معاملة (سجل أو لقطة شاشة) لتكامل <span dir="ltr">ERP ↔ CRM</span>
                  </li>
                  <li>
                    نموذج معاملة لتكامل <span dir="ltr">ERP</span> مع نظام إدارة الوثائق
                  </li>
                  <li>
                    نموذج معاملة لتكامل <span dir="ltr">CRM</span> مع البوابة الإلكترونية
                  </li>
                </ul>
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-muted">شروط القبول</div>
                <ul className="m-0 pr-[18px] pl-0">
                  <li>
                    مؤرخة ضمن دورة 2026 (استيضاح <span dir="ltr">CL-014</span>)
                  </li>
                  <li>تُظهر النظام المصدر والهدف والواجهة</li>
                  <li>معتمدة من مدير الإدارة</li>
                </ul>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft bg-[#FAFBFA] px-5 py-3.5">
              <span className="text-xs text-muted">صاغ الذكاء الاصطناعي هذا الطلب واعتمدته نورة أ. قبل الإرسال</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={`${btn} cursor-pointer border border-field bg-white text-ink`}>
                  طلب تمديد
                </button>
                <Link href="/clarifications" className={`${btn} border border-field text-ink hover:text-ink`}>
                  طلب استيضاح
                </Link>
                <Link href="/evidence" className={`${btn} bg-brand px-4 font-semibold text-white hover:text-white`}>
                  رفع الأدلة
                </Link>
              </div>
            </div>
          </article>

          <article className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-warn-line bg-white px-5 py-4">
            <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-warn-soft px-2 py-0.5 text-xs font-bold text-warn">معاد للتصحيح · 2 من 3</span>
                <span dir="ltr" className="font-mono text-[13px] font-semibold">
                  5.3.1-1
                </span>
              </div>
              <h3 className="m-0 text-base leading-[26px] font-semibold">تحديث مستودع البنية المؤسسية</h3>
              <div className="text-sm leading-6 text-ink-2">
                <b>سبب الإعادة من المراجِع:</b> لقطة الشاشة مؤرخة 2025 ولا تُظهر تاريخ آخر تحديث للمستودع.
              </div>
            </div>
            <Link href="/evidence" className={`${btn} bg-brand px-4 font-semibold text-white hover:text-white`}>
              رفع نسخة محدّثة
            </Link>
          </article>

          <section className="overflow-hidden rounded-[14px] border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5">
              <h2 className="m-0 text-base font-semibold">جميع متطلبات الإدارة</h2>
              <span className="text-xs text-muted">حالة الامتثال وحالة العمل منفصلتان</span>
            </div>
            <GridTable label="متطلبات الإدارة" columns={COLS} minWidth={760} headers={["الرمز", "المتطلب", "حالة الامتثال", "حالة العمل", "الموعد"]}>
              {rows.map(([code, title, c, work, dot, due, late]) => (
                <GridRow key={code} columns={COLS} className="text-sm">
                  <span role="cell" dir="ltr" className="text-right font-mono text-xs font-semibold">
                    {code}
                  </span>
                  <span role="cell" className="leading-[22px]">
                    {title}
                  </span>
                  <span role="cell">
                    <span className="inline-block rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: COMPLIANCE[c].bg, color: COMPLIANCE[c].fg }}>
                      {AR_COMPLIANCE[c]}
                    </span>
                  </span>
                  <span role="cell">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-field px-2 py-px text-xs text-ink-2">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} />
                      {work}
                    </span>
                  </span>
                  <span role="cell" className="text-[13px]" style={{ color: late ? "#A3261B" : "#14211C" }}>
                    {due}
                  </span>
                </GridRow>
              ))}
            </GridTable>
          </section>
        </main>
      </div>
    </div>
  );
}
