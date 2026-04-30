import type { CommanderAppViewModel } from "../commander-app.types.js";
import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderStatusPill } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { renderDeveloperToggle } from "./DeveloperToggle.js";
import { buildHumanStepLabel, formatRuntimeState, getActiveTaskTemplate, getRuntimeTone } from "../view-helpers.js";

export function renderCompactStatusBar(viewModel: CommanderConsoleViewModel, appViewModel: CommanderAppViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const taskTemplate = getActiveTaskTemplate(viewModel);
  const runtimeTone = getRuntimeTone(viewModel);

  return `<header class="cc-compact-status" data-compact-status data-viewport-min="${appViewModel.viewportGate.minWidth}" data-viewport-max="${appViewModel.viewportGate.maxWidth}">
    <div class="cc-status-top-row">
      <div class="cc-status-brand">
        <span class="cc-status-app-name">${escapeHtml(t("GrassEye Commander", "GrassEye Commander"))}</span>
        ${renderStatusPill(formatRuntimeState(viewModel), runtimeTone)}
      </div>
      <div class="cc-status-actions">
        ${renderDeveloperToggle(t("开发者", "Developer"))}
        <button type="button" class="cc-button cc-button-danger cc-button-tight" data-command-action="emergency-stop">${escapeHtml(t("急停", "E-Stop"))}</button>
      </div>
    </div>
    <div class="cc-status-metrics">
      <div class="cc-status-metric"><span>${escapeHtml(t("任务", "Task"))}</span><strong>${escapeHtml(taskTemplate?.displayName ?? t("未选择", "Unselected"))}</strong></div>
      <div class="cc-status-metric"><span>${escapeHtml(t("当前动作", "Current Action"))}</span><strong>${escapeHtml(buildHumanStepLabel(viewModel))}</strong></div>
      <div class="cc-status-metric"><span>${escapeHtml(t("已处理", "Processed"))}</span><strong>${escapeHtml(String(viewModel.rawSnapshot.runtime.totalSeenCount))}</strong></div>
    </div>
  </header>`;
}