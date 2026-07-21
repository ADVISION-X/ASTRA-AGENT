type LocalizationClientRuntimeInput = {
  supportedLocales: readonly string[];
  defaultLocale: string;
  cookieName: string;
  searchParamName: string;
  zhCopy: Readonly<Record<string, string>>;
};

export const renderLocalizationClientRuntime = (input: LocalizationClientRuntimeInput): string => `
const GRASSEYE_SUPPORTED_LOCALES = ${JSON.stringify(input.supportedLocales)};
const GRASSEYE_DEFAULT_LOCALE = ${JSON.stringify(input.defaultLocale)};
const GRASSEYE_LOCALE_COOKIE = ${JSON.stringify(input.cookieName)};
const GRASSEYE_LOCALE_PARAM = ${JSON.stringify(input.searchParamName)};
const GRASSEYE_ZH_COPY = ${JSON.stringify(input.zhCopy)};
const grasseyeOriginalText = new WeakMap();
const grasseyeOriginalAttrs = new WeakMap();
let grasseyeLocaleObserver = null;
const resolveGrassEyeLocale = (input) => GRASSEYE_SUPPORTED_LOCALES.includes(input) ? input : GRASSEYE_DEFAULT_LOCALE;
const readGrassEyeCookieLocale = () => document.cookie.split(";").map((item) => item.trim()).find((item) => item.startsWith(GRASSEYE_LOCALE_COOKIE + "="))?.split("=")[1] || "";
const readGrassEyeInitialLocale = () => {
  const explicit = new URLSearchParams(window.location.search).get(GRASSEYE_LOCALE_PARAM);
  return resolveGrassEyeLocale(explicit || readGrassEyeCookieLocale() || GRASSEYE_DEFAULT_LOCALE);
};
const writeGrassEyeLocaleCookie = (locale) => {
  document.cookie = GRASSEYE_LOCALE_COOKIE + "=" + locale + "; Max-Age=31536000; Path=/; SameSite=Lax";
};
const translateGrassEyeText = (value, locale) => {
  if (locale !== "zh") return value;
  const trimmed = String(value || "").trim();
  if (!trimmed) return value;
  return GRASSEYE_ZH_COPY[trimmed] || value;
};
const translateGrassEyeNode = (node, locale) => {
  if (node.nodeType === Node.TEXT_NODE) {
    if (!grasseyeOriginalText.has(node)) grasseyeOriginalText.set(node, node.textContent || "");
    node.textContent = translateGrassEyeText(grasseyeOriginalText.get(node), locale);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE || node.closest("script,style,pre,code")) return;
  const attrs = ["aria-label", "title", "placeholder", "value"];
  let original = grasseyeOriginalAttrs.get(node);
  if (!original) {
    original = {};
    for (const attr of attrs) if (node.hasAttribute(attr)) original[attr] = node.getAttribute(attr) || "";
    grasseyeOriginalAttrs.set(node, original);
  }
  for (const attr of attrs) {
    if (original[attr] !== undefined) node.setAttribute(attr, translateGrassEyeText(original[attr], locale));
  }
  for (const child of node.childNodes) translateGrassEyeNode(child, locale);
};
const applyGrassEyeLocale = (localeInput) => {
  const locale = resolveGrassEyeLocale(localeInput);
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  document.body.dataset.locale = locale;
  if (grasseyeLocaleObserver) grasseyeLocaleObserver.disconnect();
  translateGrassEyeNode(document.body, locale);
  document.querySelectorAll("[data-locale-choice]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.localeChoice === locale));
  });
  grasseyeLocaleObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) translateGrassEyeNode(node, locale);
    }
  });
  grasseyeLocaleObserver.observe(document.body, { childList: true, subtree: true });
};
const switchGrassEyeLocale = (locale) => {
  const next = resolveGrassEyeLocale(locale);
  writeGrassEyeLocaleCookie(next);
  applyGrassEyeLocale(next);
};
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-locale-choice]").forEach((button) => {
    button.addEventListener("click", () => switchGrassEyeLocale(button.dataset.localeChoice));
  });
  applyGrassEyeLocale(readGrassEyeInitialLocale());
});
`;
