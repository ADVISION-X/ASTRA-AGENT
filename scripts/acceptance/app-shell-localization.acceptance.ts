import assert from "node:assert/strict";
import { emitQualityProofObservation } from "../audit/shared/proof-observation.js";

import { renderAppShell } from "../../src/app/app-shell/app-shell.js";
import {
  appShellZhCopy,
  defaultAppShellLocale,
  supportedAppShellLocales,
} from "../../src/app/app-shell/localization.js";

const decodeHtml = (value: string): string => value
  .replaceAll("&amp;", "&")
  .replaceAll("&lt;", "<")
  .replaceAll("&gt;", ">")
  .replaceAll("&quot;", "\"")
  .replaceAll("&#39;", "'");

const isTranslatable = (value: string): boolean => {
  const text = decodeHtml(value).replace(/\s+/g, " ").trim();
  if (text.length <= 1) return false;
  if (!/[A-Za-z]/.test(text)) return false;
  if (/^[A-Z0-9_./:-]+$/.test(text)) return false;
  if (/^amazon\.[a-z.]+$/.test(text)) return false;
  if (/^(AE|SA|JP|US|UK|CSV|WebP|JPEG|PNG|MP4|PASS|WATCH|REJECT|INSUFFICIENT_DATA|zh-CN|en|ja|de|fr|1080p|720p|480p)$/.test(text)) return false;
  if (text.startsWith("http") || text.startsWith("/") || text.includes("${")) return false;
  return true;
};

const collectStaticCopy = (html: string): string[] => {
  const withoutCode = html
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<style[\s\S]*?<\/style>/g, "");
  const values = new Set<string>();
  for (const [, raw] of withoutCode.matchAll(/>([^<>]+)</g)) {
    const text = decodeHtml(raw ?? "").replace(/\s+/g, " ").trim();
    if (isTranslatable(text)) values.add(text);
  }
  for (const [, raw] of withoutCode.matchAll(/\s(?:aria-label|title|placeholder)="([^"]+)"/g)) {
    const text = decodeHtml(raw ?? "").replace(/\s+/g, " ").trim();
    if (isTranslatable(text)) values.add(text);
  }
  return [...values].sort();
};

const html = renderAppShell();
const zhCopy = appShellZhCopy as Record<string, string>;

assert.deepEqual(supportedAppShellLocales, ["zh", "en"]);
assert.equal(defaultAppShellLocale, "zh");
assert.equal(html.includes('<html lang="zh-CN">'), true);
assert.equal(html.includes("data-locale-toggle"), true);
assert.equal(html.includes('data-locale-choice="zh"'), true);
assert.equal(html.includes('data-locale-choice="en"'), true);
assert.equal(html.includes("renderAppShellLocalizationClient"), false, "Runtime should be inlined into the page, not left as a symbol name.");
assert.equal(html.includes("localStorage"), false, "Locale truth must not use localStorage.");

const missing = collectStaticCopy(html).filter((text) => zhCopy[text] === undefined);
assert.deepEqual(missing, [], `Missing App Shell Chinese translations: ${missing.join(" | ")}`);

for (const [english, chinese] of Object.entries(zhCopy)) {
  assert.notEqual(chinese.trim(), "", `${english} must have a non-empty Chinese translation.`);
  if (!["English", "GrassEye", "Telegram Web", "YouTube", "Facebook", "TikTok", "Gemini API", "WebP", "JPEG", "PNG", "MP4", "ID", "URL", "HTML", "AI", "PDF", "CSV", "SHA-256"].includes(english)) {
    assert.notEqual(chinese, english, `${english} must not map to itself.`);
  }
}

process.stdout.write("[ACCEPTANCE][app-shell-localization] PASS\n");
emitQualityProofObservation({ lawId: "LAW-APP-SHELL-UI-002-V1", evidenceMode: "exam.golden", clauses: ["forbidden:0","forbidden:1","forbidden:2","forbidden:3","forbidden:4","summary"], locator: "acceptance:app-shell-ui:localization-completeness", observedValue: "all translatable static Shell copy has non-empty Chinese mapping" });
