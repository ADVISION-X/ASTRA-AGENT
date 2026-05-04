import { localizeCommanderText } from "../locale.js";
import { escapeHtml } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { getActiveTaskTemplate } from "../view-helpers.js";

export function renderRunLimitMiniForm(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const selectedTemplate = getActiveTaskTemplate(viewModel);
  if (!selectedTemplate) {
    return `<section class="cc-home-section" data-run-limit-form>
    <div class="cc-section-copy">
      <p class="cc-section-title">${escapeHtml(t("运行限制", "Run Limits"))}</p>
      <p class="cc-note">${escapeHtml(t("选择任务后才会显示本次分钟和轮次限制。", "Run-limit inputs appear after a task is selected."))}</p>
    </div>
  </section>`;
  }

  return `<section class="cc-home-section" data-run-limit-form>
    <div class="cc-section-copy">
      <p class="cc-section-title">${escapeHtml(t("运行限制", "Run Limits"))}</p>
      <p class="cc-note">${escapeHtml(t(`默认最多运行 ${selectedTemplate.defaultRunLimit.maxMinutes} 分钟 / ${selectedTemplate.defaultRunLimit.maxRounds} 轮。`, `Default limit: ${selectedTemplate.defaultRunLimit.maxMinutes} minutes / ${selectedTemplate.defaultRunLimit.maxRounds} rounds.`))}</p>
    </div>
    <details class="cc-advanced-panel">
      <summary>${escapeHtml(t("本次限制", "This Run"))}</summary>
      <div class="cc-run-limit-grid">
        <label class="cc-field">
          <span>${escapeHtml(t("最多分钟", "Max minutes"))}</span>
          <input id="cc-max-minutes" name="maxMinutes" type="number" min="1" max="${escapeHtml(String(selectedTemplate.maxAllowedRunLimit.maxMinutes))}" value="${escapeHtml(String(selectedTemplate.defaultRunLimit.maxMinutes))}" />
        </label>
        <label class="cc-field">
          <span>${escapeHtml(t("最多轮次", "Max rounds"))}</span>
          <input id="cc-max-rounds" name="maxRounds" type="number" min="1" max="${escapeHtml(String(selectedTemplate.maxAllowedRunLimit.maxRounds))}" value="${escapeHtml(String(selectedTemplate.defaultRunLimit.maxRounds))}" />
        </label>
      </div>
    </details>
  </section>`;
}
