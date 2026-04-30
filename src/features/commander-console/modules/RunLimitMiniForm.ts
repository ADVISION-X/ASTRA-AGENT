import { localizeCommanderText } from "../locale.js";
import { escapeHtml } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { getActiveTaskTemplate } from "../view-helpers.js";

export function renderRunLimitMiniForm(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const selectedTemplate = getActiveTaskTemplate(viewModel);

  return `<section class="cc-home-section" data-run-limit-form>
    <div class="cc-section-copy">
      <p class="cc-section-title">${escapeHtml(t("运行限制", "Run Limits"))}</p>
      <p class="cc-note">${escapeHtml(t("默认有边界，不会无限跑。", "Runs are bounded by default."))}</p>
    </div>
    <div class="cc-run-limit-grid">
      <label class="cc-field">
        <span>${escapeHtml(t("分钟", "Minutes"))}</span>
        <input id="cc-max-minutes" name="maxMinutes" type="number" min="1" max="${escapeHtml(String(selectedTemplate?.maxAllowedRunLimit.maxMinutes ?? 45))}" value="${escapeHtml(String(selectedTemplate?.defaultRunLimit.maxMinutes ?? viewModel.commandDraft.maxMinutes))}" />
      </label>
      <label class="cc-field">
        <span>${escapeHtml(t("数量", "Items"))}</span>
        <input id="cc-max-rounds" name="maxRounds" type="number" min="1" max="${escapeHtml(String(selectedTemplate?.maxAllowedRunLimit.maxRounds ?? 6))}" value="${escapeHtml(String(selectedTemplate?.defaultRunLimit.maxRounds ?? viewModel.commandDraft.maxRounds))}" />
      </label>
    </div>
  </section>`;
}