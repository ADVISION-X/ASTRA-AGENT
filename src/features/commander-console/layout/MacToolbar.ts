import type { CommanderAppViewModel } from "../commander-app.types.js";
import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderStatusPill } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { buildHumanStepLabel, canEmergencyStopMission, formatRuntimeState, getActiveTaskTemplate, getRuntimeTone } from "../view-helpers.js";
import { renderDeveloperToggle } from "./DeveloperToggle.js";

export function renderMacToolbar(viewModel: CommanderConsoleViewModel, appViewModel: CommanderAppViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const activeTaskTemplate = getActiveTaskTemplate(viewModel);
  const runtimeTone = getRuntimeTone(viewModel);
  const canEmergencyStop = canEmergencyStopMission(viewModel);

  return `<section class="cc-mac-toolbar" data-toolbar data-viewport-min="${appViewModel.viewportGate.minWidth}" data-viewport-max="${appViewModel.viewportGate.maxWidth}">
    <div class="cc-toolbar-primary">
      <div class="cc-toolbar-title-copy">
        <p class="cc-eyebrow">${escapeHtml(t("当前任务", "Current Task"))}</p>
        <h1>${escapeHtml(activeTaskTemplate?.displayName ?? t("尚未选择任务", "No task selected"))}</h1>
      </div>
      <div class="cc-toolbar-runtime-pill">${renderStatusPill(formatRuntimeState(viewModel), runtimeTone)}</div>
    </div>
    <div class="cc-toolbar-metrics">
      <div class="cc-toolbar-metric"><span>${escapeHtml(t("当前动作", "Current Action"))}</span><strong>${escapeHtml(buildHumanStepLabel(viewModel))}</strong></div>
      <div class="cc-toolbar-metric"><span>${escapeHtml(t("已处理", "Processed"))}</span><strong>${escapeHtml(String(viewModel.rawSnapshot.runtime.totalSeenCount))}</strong></div>
      <div class="cc-toolbar-metric"><span>${escapeHtml(t("待复核", "Pending Review"))}</span><strong>${escapeHtml(String(viewModel.reviewQueueSummary.pendingCount))}</strong></div>
    </div>
    <div class="cc-toolbar-actions">
      ${renderDeveloperToggle(t("开发者模式", "Developer Mode"))}
      <button type="button" class="cc-button cc-button-danger cc-button-tight" data-command-action="emergency-stop"${canEmergencyStop ? "" : ' disabled="disabled"'}>${escapeHtml(t("急停", "E-Stop"))}</button>
    </div>
  </section>`;
}