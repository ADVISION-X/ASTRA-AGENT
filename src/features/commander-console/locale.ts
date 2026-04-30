import type { Locale } from "../../lib/localization/dictionaries.js";

export function localizeCommanderText(locale: Locale, zh: string, en: string): string {
  return locale === "zh" ? zh : en;
}