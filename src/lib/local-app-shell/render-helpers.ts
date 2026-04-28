import type { Locale } from "../localization/dictionaries.js";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function sanitizeDisplayText(value: string, hiddenPathLabel: string): string {
  return value
    .replace(/\/Users\/[^\s<]+/g, hiddenPathLabel)
    .replace(/\/var\/folders\/[^\s<]+/g, hiddenPathLabel)
    .replace(/[A-Za-z]:\\[^\s<]+/g, hiddenPathLabel);
}

export function buildLocaleHref(requestUrl: URL, locale: Locale): string {
  const nextUrl = new URL(requestUrl.toString());
  nextUrl.searchParams.set("lang", locale);
  const query = nextUrl.searchParams.toString();
  return `${nextUrl.pathname}${query.length > 0 ? `?${query}` : ""}`;
}

export function safeJsonScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
