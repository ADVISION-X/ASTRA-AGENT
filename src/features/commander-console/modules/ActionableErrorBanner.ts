import { localizeCommanderText } from "../locale.js";
import { escapeHtml } from "../render-utils.js";
import type { ActionableErrorView } from "../view-helpers.js";
import type { Locale } from "../../../lib/localization/dictionaries.js";

export function renderActionableErrorBanner(locale: Locale, errors: ActionableErrorView[]): string {
  const t = (zh: string, en: string) => localizeCommanderText(locale, zh, en);
  const error = errors.find((item) => item.tone !== "ok");
  if (!error) {
    return "";
  }

  return `<section class="cc-error-banner cc-tone-${error.tone}" data-error-banner>
    <div>
      <strong>${escapeHtml(error.title)}</strong>
      <p>${escapeHtml(error.whatHappened)}</p>
      <small>${escapeHtml(error.nextAction)}</small>
    </div>
    <div class="cc-inline-actions">
      <button type="button" class="cc-button cc-button-tight" data-open-error-inspect>${escapeHtml(t("查看详情", "Inspect"))}</button>
      <button type="button" class="cc-button cc-button-tight" data-nav-page="review">${escapeHtml(t("去复核", "Go Review"))}</button>
    </div>
  </section>`;
}