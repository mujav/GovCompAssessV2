"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/journey/icon";
import { cx } from "@/components/ui";

// 01 · Sign in. Demo Advisory consultants use company SSO and land on the entity chooser.

type Lang = "en" | "ar";

const T = {
  en: {
    brand: "Compliance Intelligence",
    brandSub: "by Demo Advisory Co.",
    hero: "Every framework, standard and index. One workspace.",
    trust: ["Hosted in Saudi Arabia", "NCA CCC aligned", "PDPL ready"],
    signIn: "Sign in",
    lead: "Demo Advisory consultants sign in with company SSO. Your entities load after sign-in.",
    ssoBtn: "Sign in with Demo Advisory SSO",
    noLic: "No access yet?",
    reqLic: "Ask your engagement lead",
    cancel: "← Cancel",
    redir: "Opening company sign-in",
    hs: ["Demo Advisory recognised", "Signing in with company SSO", "Loading your entities"],
    simulate: "Continue (simulate return)",
    notOpen: "Nothing opened?",
    retry: "Try again",
    help: "Help",
    privacy: "Privacy",
    a11y: "Accessibility",
  },
  ar: {
    brand: "ذكاء الامتثال",
    brandSub: "من شركة الاستشارات التجريبية",
    hero: "كل إطار ومعيار ومؤشر. في مساحة عمل واحدة.",
    trust: ["مستضافة في المملكة", "متوافقة مع ضوابط الحوسبة السحابية", "جاهزة لنظام حماية البيانات"],
    signIn: "تسجيل الدخول",
    lead: "يسجّل مستشارو الشركة الدخول عبر الدخول الموحد. تظهر الجهات بعد تسجيل الدخول.",
    ssoBtn: "الدخول الموحد للشركة",
    noLic: "لا تملك وصولًا بعد؟",
    reqLic: "اطلب من قائد الارتباط",
    cancel: "إلغاء →",
    redir: "جارٍ فتح تسجيل الدخول للشركة",
    hs: ["تم التعرف على الشركة", "تسجيل الدخول الموحد", "تحميل الجهات"],
    simulate: "متابعة (محاكاة العودة)",
    notOpen: "لم يُفتح شيء؟",
    retry: "حاول مجددًا",
    help: "المساعدة",
    privacy: "الخصوصية",
    a11y: "إمكانية الوصول",
  },
};

export default function LoginPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [step, setStep] = useState<"identify" | "redirect">("identify");
  const t = T[lang];
  const en = lang === "en";


  return (
    <div dir={en ? "ltr" : "rtl"} lang={lang} className={cx("flex min-h-screen flex-wrap bg-white text-j-ink", !en && "font-arabic")}>
      <section
        aria-label={t.brand}
        className="relative box-border flex min-h-[360px] flex-[1_1_560px] flex-col gap-8 overflow-hidden bg-cx-deep px-14 py-11 text-[#E3EAF4]"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-[300px] -end-[260px] h-[720px] w-[720px] rounded-full border-[90px] border-[#1B3354] opacity-55" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-[120px] -end-20 h-[380px] w-[380px] rounded-full border-[50px] border-[#1B3354] opacity-80" />
        <div className="relative flex items-center gap-3">
          <span className="flex h-[42px] w-[42px] items-center justify-center rounded-xl bg-mark text-white">
            <Icon name="shield" size={20} />
          </span>
          <span className="leading-5">
            <b className="text-base text-white">{t.brand}</b>
            <br />
            <span className="text-[13px] text-[#B9CCE6]">{t.brandSub}</span>
          </span>
        </div>
        <h1 className="relative m-0 mt-auto max-w-[540px] text-[46px] leading-[56px] font-bold tracking-[-0.02em] text-white">{t.hero}</h1>
        <div className="relative flex flex-wrap gap-2">
          {t.trust.map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5 rounded-full border border-[#2A4468] px-3 py-1.5 text-xs font-semibold">
              <Icon name="check" size={13} />
              {b}
            </span>
          ))}
        </div>
      </section>

      <section className="box-border flex flex-[1_1_520px] flex-col px-10 py-7">
        <div className="flex justify-end">
          <div role="group" aria-label="Language" className="flex rounded-[10px] bg-[#F2F5F3] p-[3px]">
            {(["en", "ar"] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                lang={l}
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className={cx("h-[34px] cursor-pointer rounded-lg border-0 px-3.5 text-[13px] font-semibold text-j-ink", lang === l ? "bg-white" : "bg-transparent", l === "ar" ? "font-arabic" : "font-sans")}
              >
                {l === "en" ? "English" : "العربية"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-auto items-center justify-center py-7">
          <div className="w-full max-w-[400px]">
            {step === "identify" ? (
              <div className="flex flex-col gap-5">
                <h2 className="m-0 mb-1.5 text-[32px] leading-10 font-bold tracking-[-0.01em]">{t.signIn}</h2>
                <p className="m-0 text-[15px] leading-6 text-j-ink-3">{t.lead}</p>
                <button
                  type="button"
                  onClick={() => setStep("redirect")}
                  className="flex h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border-0 bg-cx text-base font-semibold text-white hover:bg-cx-strong"
                >
                  <Icon name="key" size={18} />
                  {t.ssoBtn}
                </button>
                <div className="flex justify-center gap-2 text-[13px] text-j-muted">
                  {t.noLic}{" "}
                  <a href="#" className="font-semibold text-cx">
                    {t.reqLic}
                  </a>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-[22px]">
                <button
                  type="button"
                  onClick={() => setStep("identify")}
                  className="h-9 cursor-pointer self-start rounded-lg border-0 bg-[#F2F5F3] px-3 text-[13px] font-semibold text-j-ink-2"
                >
                  {t.cancel}
                </button>
                <div className="flex items-center gap-3.5">
                  <span className="relative flex h-14 w-14 flex-none items-center justify-center">
                    <span aria-hidden="true" className="absolute inset-0 animate-spin rounded-full border-[3px] border-cx-soft border-t-cx" />
                    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-cx font-sans text-xs font-bold text-white">DA</span>
                  </span>
                  <h2 className="m-0 text-[26px] leading-[34px] font-bold">{t.redir}</h2>
                </div>
                <ol className="m-0 flex list-none flex-col overflow-hidden rounded-[14px] border border-j-line p-0">
                  {t.hs.map((l, i) => (
                    <li key={l} className="flex min-h-[52px] items-center gap-3 border-b border-j-line-soft px-4 text-sm last:border-0">
                      <span className={cx("flex h-6 w-6 flex-none items-center justify-center rounded-full text-white", i < 2 ? "bg-cx" : "bg-j-field")}>
                        <Icon name={i === 0 ? "check" : i === 1 ? "clock" : "more"} size={13} strokeWidth={2.4} />
                      </span>
                      <span className={cx("flex-auto", i < 2 ? "font-semibold text-j-ink" : "text-j-muted")}>{l}</span>
                    </li>
                  ))}
                </ol>
                <Link href="/portfolio?view=cards" className="flex h-[52px] items-center justify-center rounded-xl bg-cx text-[15px] font-semibold text-white no-underline hover:bg-cx-strong hover:text-white">
                  {t.simulate}
                </Link>
                <span className="text-center text-[13px] text-j-muted">
                  {t.notOpen}{" "}
                  <button type="button" onClick={() => setStep("identify")} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-cx underline">
                    {t.retry}
                  </button>
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-[13px]">
          {[t.help, t.privacy, t.a11y].map((l) => (
            <a key={l} href="#" className="text-j-ink-3 no-underline">
              {l}
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
