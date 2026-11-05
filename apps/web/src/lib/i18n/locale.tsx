"use client";

import { useEffect, useState } from "react";
import { startTranslating } from "./dom";
import type { Locale } from "./translate";

export const LOCALE_KEY = "ci-locale";

/** Runs before first paint (inline in <head>) so an Arabic page never flashes left-to-right. */
// The page stays hidden (i18n-pending) until it has been translated, so English never flashes.
export const LOCALE_BOOT = `try{if(localStorage.getItem("${LOCALE_KEY}")==="ar"){var h=document.documentElement;h.lang="ar";h.dir="rtl";h.classList.add("i18n-pending");setTimeout(function(){h.classList.remove("i18n-pending")},4000);}}catch(e){}`;

export function readLocale(): Locale {
  try {
    return localStorage.getItem(LOCALE_KEY) === "ar" ? "ar" : "en";
  } catch {
    return "en";
  }
}

/** Switches the interface language. The page reloads so every screen starts in the new language. */
export function setLocale(l: Locale) {
  try {
    localStorage.setItem(LOCALE_KEY, l);
  } catch {
    // Storage blocked: the switch lasts for this page only.
  }
  window.location.reload();
}

/** Turns on right-to-left layout and the Arabic translation for the whole app when Arabic is chosen. */
export function LocaleRoot() {
  useEffect(() => {
    if (readLocale() !== "ar") return;
    const h = document.documentElement;
    h.lang = "ar";
    h.dir = "rtl";
    let stop: (() => void) | undefined;
    let cancelled = false;
    // Translate only once React has hydrated everything (including Suspense sections),
    // otherwise React finds text it did not render and throws the page away.
    // A timer rather than animation frames: frames do not run in background tabs.
    const begin = () =>
      window.setTimeout(() => {
        if (cancelled) return;
        stop = startTranslating(document.body);
        h.classList.remove("i18n-pending");
      }, 30);
    if (document.readyState === "complete") begin();
    else window.addEventListener("load", begin, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", begin);
      stop?.();
    };
  }, []);
  return null;
}

/** The interface language, for showing data in one language only. English until the page has loaded. */
export function useLocale(): Locale {
  const [locale, set] = useState<Locale>("en");
  useEffect(() => set(readLocale()), []);
  return locale;
}

/** English / العربية switch. */
export function LanguageToggle({ className }: { className?: string }) {
  const [locale, set] = useState<Locale>("en");
  useEffect(() => set(readLocale()), []);
  const next: Locale = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      data-no-translate
      onClick={() => setLocale(next)}
      lang={next}
      aria-label={next === "ar" ? "التبديل إلى العربية" : "Switch to English"}
      className={
        className ??
        "inline-flex h-9 cursor-pointer items-center rounded-[10px] border border-j-line bg-white px-3 text-[13px] font-semibold text-j-ink hover:bg-j-canvas"
      }
    >
      {next === "ar" ? "العربية" : "English"}
    </button>
  );
}
