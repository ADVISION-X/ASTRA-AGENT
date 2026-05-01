import type { Locale } from "../../localization/dictionaries.js";

import { localizeCommanderText } from "../locale.js";
import { escapeHtml } from "../render-utils.js";

export function renderMacTitleBar(title: string, subtitle: string, locale: Locale): string {
  const t = (zh: string, en: string) => localizeCommanderText(locale, zh, en);

  return `<header class="cc-mac-titlebar">
    <div class="cc-mac-window-controls" aria-hidden="true">
      <span class="cc-window-dot cc-window-dot-close"></span>
      <span class="cc-window-dot cc-window-dot-minimize"></span>
      <span class="cc-window-dot cc-window-dot-zoom"></span>
    </div>
    <div class="cc-mac-window-copy">
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(subtitle)}</span>
    </div>
    <div class="cc-locale-switch" role="group" aria-label="${escapeHtml(t("界面语言", "Interface language"))}">
      <button type="button" class="cc-locale-button${locale === "zh" ? " is-active" : ""}" data-locale-switch="zh" aria-pressed="${locale === "zh" ? "true" : "false"}">${escapeHtml(t("中文", "ZH"))}</button>
      <button type="button" class="cc-locale-button${locale === "en" ? " is-active" : ""}" data-locale-switch="en" aria-pressed="${locale === "en" ? "true" : "false"}">${escapeHtml(t("英文", "EN"))}</button>
    </div>
  </header>`;
}