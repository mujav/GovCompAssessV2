"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/components/journey/icon";
import { cx } from "@/components/ui";
import { DEMO_PASSWORD, ROLES, SEED_USERS, homeFor, type Role } from "@/lib/auth/accounts";
import { useAuth } from "@/lib/auth/store";
import { readLocale, setLocale } from "@/lib/i18n/locale";
import { useScreenState } from "@/lib/journey/store";
import { DEFAULT_PLATFORM, PLATFORM_KEY, type PlatformState } from "@/lib/cycle/platform";

// S00 · Sign in with email and password. People without an account request access; the
// platform admin approves or rejects the request and decides the role.

type Lang = "en" | "ar";

const T = {
  en: {
    brand: "Compliance Workspace",
    brandSub: "EY · For authorised users only",
    hero: "Prepare every national index submission in one place.",
    heroSub: "Plan the cycle, collect evidence for every requirement, review it with AI support, and track readiness by dimension, department and owner.",
    trust: ["Hosted in Saudi Arabia", "NCA CCC aligned", "PDPL ready"],
    signIn: "Sign in",
    lead: "Use the account your administrator invited.",
    forgot: "Forgot password?",
    remember: "Keep me signed in on this device",
    access: "You will see only the workspaces you were granted. Ask your Index Owner or the platform administrator for access to another entity or index.",
    forgotTitle: "Reset your password",
    forgotLead: "Enter your work email. The platform administrator is asked to send you a reset link.",
    forgotSend: "Ask for a reset link",
    forgotSent: "If an account exists for this email, the platform administrator has been asked to reset it. You will get a link by email.",
    email: "Work email",
    password: "Password",
    submit: "Sign in",
    busy: "Signing in…",
    noAccess: "Don't have access?",
    request: "Request access",
    reqTitle: "Request access",
    reqLead: "The Platform Admin reviews every request and decides your role. You can sign in once it is approved.",
    name: "Full name",
    org: "Organisation",
    jobTitle: "Job title",
    reason: "Why you need access",
    choose: "Choose a password",
    confirm: "Confirm password",
    hint: "At least 8 characters, with letters and a number.",
    send: "Send request",
    sending: "Sending…",
    mismatch: "The passwords do not match.",
    sent: "Request sent",
    sentLead: "The Platform Admin will review it. You will be able to sign in with this email once it is approved.",
    back: "← Back to sign in",
    haveAccess: "Already have access?",
    demo: "Demo accounts",
    demoLead: "Every demo account uses the password",
    help: "Help",
    privacy: "Privacy",
    a11y: "Accessibility",
  },
  ar: {
    brand: "مساحة الامتثال",
    brandSub: "EY · للمستخدمين المصرّح لهم فقط",
    hero: "جهّز مشاركتك في جميع المؤشرات الوطنية من مكان واحد.",
    heroSub: "خطّط للدورة، واجمع مستندات الإثبات لكل متطلب، وراجعها بمساندة الذكاء الاصطناعي، وتابع الجاهزية حسب المنظور والإدارة والمسؤول.",
    trust: ["مستضافة في المملكة", "متوافقة مع ضوابط الحوسبة السحابية", "جاهزة لنظام حماية البيانات"],
    signIn: "تسجيل الدخول",
    lead: "استخدم الحساب الذي دعاك إليه المسؤول.",
    forgot: "نسيت كلمة المرور؟",
    remember: "تذكرني على هذا الجهاز",
    access: "ستظهر لك فقط مساحات العمل المصرّح لك بها. اطلب من مالك المؤشر أو مسؤول المنصة صلاحية الوصول إلى جهة أو مؤشر آخر.",
    forgotTitle: "إعادة تعيين كلمة المرور",
    forgotLead: "أدخل بريد العمل، وسيُطلب من مسؤول المنصة إرسال رابط إعادة التعيين إليك.",
    forgotSend: "اطلب رابط إعادة التعيين",
    forgotSent: "إذا كان هناك حساب بهذا البريد فقد طُلب من مسؤول المنصة إعادة تعيينه، وسيصلك رابط بالبريد.",
    email: "البريد الإلكتروني للعمل",
    password: "كلمة المرور",
    submit: "دخول",
    busy: "جارٍ تسجيل الدخول…",
    noAccess: "لا تملك وصولًا؟",
    request: "اطلب الوصول",
    reqTitle: "طلب الوصول",
    reqLead: "يراجع مسؤول المنصة كل طلب ويحدد دورك. يمكنك تسجيل الدخول بعد الموافقة.",
    name: "الاسم الكامل",
    org: "الجهة",
    jobTitle: "المسمى الوظيفي",
    reason: "سبب الحاجة إلى الوصول",
    choose: "اختر كلمة مرور",
    confirm: "تأكيد كلمة المرور",
    hint: "ثمانية أحرف على الأقل، تتضمن حروفًا ورقمًا.",
    send: "إرسال الطلب",
    sending: "جارٍ الإرسال…",
    mismatch: "كلمتا المرور غير متطابقتين.",
    sent: "تم إرسال الطلب",
    sentLead: "سيراجعه مسؤول المنصة. يمكنك تسجيل الدخول بهذا البريد بعد الموافقة.",
    back: "العودة إلى تسجيل الدخول →",
    haveAccess: "لديك وصول بالفعل؟",
    demo: "حسابات تجريبية",
    demoLead: "كل الحسابات التجريبية تستخدم كلمة المرور",
    help: "المساعدة",
    privacy: "الخصوصية",
    a11y: "إمكانية الوصول",
  },
};

const ROLE_AR: Record<Role, string> = { admin: "مسؤول المنصة", owner: "مالك المؤشر", control: "مالك المعيار", viewer: "مستعرض الإدارة" };

/** One demo account per role, so each view can be tried. */
const DEMO = ROLES.map((r) => SEED_USERS.find((u) => u.role === r.key)!).filter(Boolean);

const field = "h-12 w-full rounded-xl border border-j-line bg-white px-3.5 text-[15px] text-j-ink outline-none focus:border-cx";

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-j-ink-2">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-j-muted">{hint}</span>}
    </label>
  );
}

export default function LoginPage() {
  // The page carries its own wording in both languages and follows the app-wide setting.
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => setLang(readLocale()), []);
  const t = T[lang];
  const en = lang === "en";
  const router = useRouter();
  const { ready, user, signIn, requestAccess } = useAuth();
  const [mode, setMode] = useState<"signin" | "request" | "sent" | "forgot" | "forgotSent">("signin");
  const [remember, setRemember] = useState(true);
  const [, setPlatform] = useScreenState<PlatformState>(PLATFORM_KEY, DEFAULT_PLATFORM);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [req, setReq] = useState({ name: "", email: "", organisation: "", title: "", reason: "", password: "", confirm: "" });

  // Someone already signed in goes straight to their home.
  useEffect(() => {
    if (ready && user) router.replace(homeFor(user.role));
  }, [ready, user, router]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await signIn(email, password, remember);
    setBusy(false);
    if (res.ok) router.push(res.home);
    else setError(res.error);
  };

  const sendRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (req.password !== req.confirm) return setError(t.mismatch);
    setBusy(true);
    setError("");
    const problem = await requestAccess(req);
    setBusy(false);
    if (problem) setError(problem);
    else {
      setEmail(req.email);
      setMode("sent");
    }
  };

  const switchTo = (m: typeof mode) => {
    setMode(m);
    setError("");
  };

  return (
    <div data-no-translate dir={en ? "ltr" : "rtl"} lang={lang} className={cx("flex min-h-screen flex-wrap bg-white text-j-ink", !en && "font-arabic")}>
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
        <p className="relative m-0 -mt-4 max-w-[520px] text-base leading-7 text-[#B9CCE6]">{t.heroSub}</p>
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
                onClick={() => l !== lang && setLocale(l)}
                className={cx("h-[34px] cursor-pointer rounded-lg border-0 px-3.5 text-[13px] font-semibold text-j-ink", lang === l ? "bg-white" : "bg-transparent", l === "ar" ? "font-arabic" : "font-sans")}
              >
                {l === "en" ? "English" : "العربية"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-auto items-center justify-center py-7">
          <div className="w-full max-w-[420px]">
            {mode === "signin" && (
              <form onSubmit={submit} className="flex flex-col gap-4">
                <h2 className="m-0 text-[32px] leading-10 font-bold tracking-[-0.01em]">{t.signIn}</h2>
                <p className="m-0 text-[15px] leading-6 text-j-ink-3">{t.lead}</p>
                <Field label={t.email}>
                  <input type="email" required autoComplete="username" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
                </Field>
                <Field label={t.password}>
                  <input type="password" required autoComplete="current-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <label className="flex items-center gap-2 text-j-ink-2">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    {t.remember}
                  </label>
                  <button type="button" onClick={() => switchTo("forgot")} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-cx">
                    {t.forgot}
                  </button>
                </div>
                {error && (
                  <p role="alert" className="m-0 rounded-xl bg-j-bad-soft px-3.5 py-2.5 text-[13px] font-semibold text-j-bad">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={busy} className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border-0 bg-cx text-base font-semibold text-white hover:bg-cx-strong disabled:opacity-60">
                  <Icon name="key" size={18} />
                  {busy ? t.busy : t.submit}
                </button>
                <p className="m-0 rounded-xl bg-j-canvas px-3.5 py-2.5 text-[13px] leading-5 text-j-ink-3">{t.access}</p>
                <div className="flex justify-center gap-2 text-[13px] text-j-muted">
                  {t.noAccess}
                  <button type="button" onClick={() => switchTo("request")} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-cx">
                    {t.request}
                  </button>
                </div>
                <details className="rounded-xl border border-j-line px-4 py-3 text-[13px]">
                  <summary className="cursor-pointer font-semibold text-j-ink-2">{t.demo}</summary>
                  <p className="m-0 mt-2 text-j-muted">
                    {t.demoLead} <code dir="ltr" className="font-mono text-j-ink">{DEMO_PASSWORD}</code>
                  </p>
                  <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0">
                    {DEMO.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setEmail(u.email);
                            setPassword(DEMO_PASSWORD);
                            setError("");
                          }}
                          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border-0 bg-j-canvas px-3 py-2 text-start text-[13px] text-j-ink hover:bg-cx-tint"
                        >
                          <b>{en ? ROLES.find((r) => r.key === u.role)!.label : ROLE_AR[u.role]}</b>
                          <span dir="ltr" className="font-mono text-xs text-j-muted">
                            {u.email}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </details>
              </form>
            )}

            {mode === "request" && (
              <form onSubmit={sendRequest} className="flex flex-col gap-3.5">
                <button type="button" onClick={() => switchTo("signin")} className="h-9 cursor-pointer self-start rounded-lg border-0 bg-[#F2F5F3] px-3 text-[13px] font-semibold text-j-ink-2">
                  {t.back}
                </button>
                <h2 className="m-0 text-[28px] leading-9 font-bold tracking-[-0.01em]">{t.reqTitle}</h2>
                <p className="m-0 text-sm leading-6 text-j-ink-3">{t.reqLead}</p>
                <Field label={t.name}>
                  <input required autoComplete="name" value={req.name} onChange={(e) => setReq({ ...req, name: e.target.value })} className={field} />
                </Field>
                <Field label={t.email}>
                  <input type="email" required autoComplete="email" dir="ltr" value={req.email} onChange={(e) => setReq({ ...req, email: e.target.value })} className={field} />
                </Field>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
                  <Field label={t.org}>
                    <input required autoComplete="organization" value={req.organisation} onChange={(e) => setReq({ ...req, organisation: e.target.value })} className={field} />
                  </Field>
                  <Field label={t.jobTitle}>
                    <input autoComplete="organization-title" value={req.title} onChange={(e) => setReq({ ...req, title: e.target.value })} className={field} />
                  </Field>
                </div>
                <Field label={t.reason}>
                  <textarea rows={2} value={req.reason} onChange={(e) => setReq({ ...req, reason: e.target.value })} className={cx(field, "h-auto py-2.5")} />
                </Field>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3.5">
                  <Field label={t.choose}>
                    <input type="password" required autoComplete="new-password" dir="ltr" value={req.password} onChange={(e) => setReq({ ...req, password: e.target.value })} className={field} />
                  </Field>
                  <Field label={t.confirm}>
                    <input type="password" required autoComplete="new-password" dir="ltr" value={req.confirm} onChange={(e) => setReq({ ...req, confirm: e.target.value })} className={field} />
                  </Field>
                </div>
                <span className="text-xs text-j-muted">{t.hint}</span>
                {error && (
                  <p role="alert" className="m-0 rounded-xl bg-j-bad-soft px-3.5 py-2.5 text-[13px] font-semibold text-j-bad">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={busy} className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-cx text-base font-semibold text-white hover:bg-cx-strong disabled:opacity-60">
                  <Icon name="send" size={17} />
                  {busy ? t.sending : t.send}
                </button>
                <div className="flex justify-center gap-2 text-[13px] text-j-muted">
                  {t.haveAccess}
                  <button type="button" onClick={() => switchTo("signin")} className="cursor-pointer border-0 bg-transparent p-0 text-[13px] font-semibold text-cx">
                    {t.signIn}
                  </button>
                </div>
              </form>
            )}

            {mode === "forgot" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const at = new Date().toISOString();
                  // The request reaches the Platform Admin under Users; nothing tells whether the email has an account.
                  setPlatform((d) => void (d.resets = [...(d.resets ?? []).filter((r) => r.email !== email.trim().toLowerCase()), { email: email.trim().toLowerCase(), at }]));
                  switchTo("forgotSent");
                }}
                className="flex flex-col gap-4"
              >
                <h2 className="m-0 text-[28px] leading-9 font-bold">{t.forgotTitle}</h2>
                <p className="m-0 text-[15px] leading-6 text-j-ink-3">{t.forgotLead}</p>
                <Field label={t.email}>
                  <input type="email" required autoComplete="username" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
                </Field>
                <button type="submit" className="h-[52px] w-full cursor-pointer rounded-xl border-0 bg-cx text-base font-semibold text-white hover:bg-cx-strong">
                  {t.forgotSend}
                </button>
                <button type="button" onClick={() => switchTo("signin")} className="cursor-pointer self-center border-0 bg-transparent p-0 text-[13px] font-semibold text-cx">
                  {t.back}
                </button>
              </form>
            )}

            {mode === "forgotSent" && (
              <div role="status" className="flex flex-col items-start gap-4">
                <h2 className="m-0 text-[28px] leading-9 font-bold">{t.forgotTitle}</h2>
                <p className="m-0 text-[15px] leading-6 text-j-ink-3">{t.forgotSent}</p>
                <button type="button" onClick={() => switchTo("signin")} className="h-11 cursor-pointer rounded-xl border-0 bg-cx px-5 text-sm font-semibold text-white hover:bg-cx-strong">
                  {t.back}
                </button>
              </div>
            )}

            {mode === "sent" && (
              <div role="status" className="flex flex-col items-start gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E7F3ED] text-brand">
                  <Icon name="check" size={26} strokeWidth={2.4} />
                </span>
                <h2 className="m-0 text-[28px] leading-9 font-bold">{t.sent}</h2>
                <p className="m-0 text-[15px] leading-6 text-j-ink-3">{t.sentLead}</p>
                <button type="button" onClick={() => switchTo("signin")} className="h-11 cursor-pointer rounded-xl border-0 bg-cx px-5 text-sm font-semibold text-white hover:bg-cx-strong">
                  {t.back}
                </button>
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
