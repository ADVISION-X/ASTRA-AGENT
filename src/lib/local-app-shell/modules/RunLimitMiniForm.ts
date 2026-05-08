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
      <p class="cc-note" data-app-run-limit-default-note>${escapeHtml(t(`当前 APP 默认值为 ${viewModel.appRunLimitSettings.defaultMaxMinutes} 分钟 / ${viewModel.appRunLimitSettings.defaultMaxRounds} 轮。`, `Current app defaults: ${viewModel.appRunLimitSettings.defaultMaxMinutes} minutes / ${viewModel.appRunLimitSettings.defaultMaxRounds} rounds.`))}</p>
    </div>
    <details class="cc-advanced-panel">
      <summary>${escapeHtml(t("本次限制", "This Run"))}</summary>
      <div class="cc-run-limit-grid">
        <label class="cc-field">
          <span>${escapeHtml(t("最多分钟", "Max minutes"))}</span>
          <input id="cc-max-minutes" name="maxMinutes" type="number" min="1" value="${escapeHtml(String(viewModel.commandDraft.maxMinutes))}" />
        </label>
        <label class="cc-field">
          <span>${escapeHtml(t("最多处理轮次", "Max processing rounds"))}</span>
          <input id="cc-max-rounds" name="maxRounds" type="number" min="1" value="${escapeHtml(String(viewModel.commandDraft.maxRounds))}" />
        </label>
      </div>
    </details>
  </section>`;
}
