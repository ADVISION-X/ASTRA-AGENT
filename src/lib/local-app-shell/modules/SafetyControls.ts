import { localizeCommanderText } from "../locale.js";
import { escapeHtml } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { canEmergencyStopMission, canPauseMission, canResumeMission, canStopMission } from "../view-helpers.js";

export function renderSafetyControls(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const canPause = canPauseMission(viewModel);
  const canResume = canResumeMission(viewModel);
  const canStop = canStopMission(viewModel);
  const canEmergencyStop = canEmergencyStopMission(viewModel);

  return `<section class="cc-home-section" data-safety-controls>
    <div class="cc-section-copy">
      <p class="cc-section-title">${escapeHtml(t("安全控制", "Safety Controls"))}</p>
      <p class="cc-note">${escapeHtml(t("急停保持全局可见；这里保留暂停、继续、停止。", "E-Stop stays global; pause, resume, and stop stay here."))}</p>
    </div>
    <div class="cc-inline-actions">
      <button type="button" class="cc-button cc-button-tight" data-command-action="pause-mission"${canPause ? "" : ' disabled="disabled"'}>${escapeHtml(t("暂停", "Pause"))}</button>
      <button type="button" class="cc-button cc-button-tight" data-command-action="resume-mission"${canResume ? "" : ' disabled="disabled"'}>${escapeHtml(t("继续", "Resume"))}</button>
      <button type="button" class="cc-button cc-button-tight" data-command-action="stop-mission"${canStop ? "" : ' disabled="disabled"'}>${escapeHtml(t("停止", "Stop"))}</button>
      <button type="button" class="cc-button cc-button-danger cc-button-tight" data-command-action="emergency-stop"${canEmergencyStop ? "" : ' disabled="disabled"'}>${escapeHtml(t("急停", "Emergency Stop"))}</button>
    </div>
  </section>`;
}
