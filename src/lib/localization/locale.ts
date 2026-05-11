import { defaultLocale, supportedLocales, type Locale } from "./dictionaries.js";

function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && supportedLocales.includes(value as Locale);
}

function parseLocale(value: unknown): Locale {
  return isSupportedLocale(value) ? value : defaultLocale;
}

export function getLocaleFromRequestUrl(url: URL): Locale {
  return parseLocale(url.searchParams.get("lang"));
}