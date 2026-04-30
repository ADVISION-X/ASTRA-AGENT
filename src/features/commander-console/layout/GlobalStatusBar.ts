import type { CommanderConsoleViewModel } from "../types.js";
import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderStatusPill } from "../render-utils.js";
import {
  buildHumanStepLabel,
  formatElapsed,
  formatHealthStatus,
  formatRuntimeState,
  getActiveTaskTemplate,
  getRuntimeTone,
} from "../view-helpers.js";

export function renderGlobalStatusBar(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const activeTask = getActiveTaskTemplate(viewModel);
  const runtimeTone = getRuntimeTone(viewModel);

  return `<section class="cc-topbar">
    <div class="cc-topbar-brand">
      <div class="cc-brand-lockup">
        <p class="cc-brand-name">GRASSEYE</p>
        <p class="cc-brand-sub">${escapeHtml(t("本地智能机器驾驶舱", "LOCAL MACHINE COCKPIT"))}</p>
      </div>
      <div class="cc-brand-copy">
        <p class="cc-eyebrow">${escapeHtml(t("总司令控制台", "Commander Console"))}</p>
        <h1>${escapeHtml(viewModel.appTitle)}</h1>
        <p>${escapeHtml(t("用户不需要理解地图、能力组或 proof，就能安全启动、暂停、停止并复核任务。", "Users can safely start, pause, stop, and review missions without understanding maps, ability groups, or proof internals."))}</p>
      </div>
    </div>
    <div class="cc-topbar-meters">
      ${[
        { label: t("状态", "State"), value: formatRuntimeState(viewModel), tone: runtimeTone },
        { label: t("当前任务", "Task"), value: activeTask?.displayName ?? t("未选择任务", "No task selected"), tone: activeTask ? "ok" : "attention" },
        { label: t("已运行时间", "Elapsed"), value: formatElapsed(viewModel), tone: "ok" },
        { label: t("当前处理数量", "Processed"), value: String(viewModel.rawSnapshot.runtime.totalSeenCount), tone: "ok" },
        { label: t("当前正在做什么", "Current Action"), value: buildHumanStepLabel(viewModel), tone: runtimeTone },
        { label: t("健康状态", "Health"), value: formatHealthStatus(viewModel), tone: runtimeTone },
      ].map((metric) => `
        <div class="cc-meter">
          <span class="cc-meter-key">${escapeHtml(metric.label)}</span>
          <span class="cc-meter-value cc-meter-${metric.tone}">${escapeHtml(metric.value)}</span>
        </div>
      `).join("")}
    </div>
    <div class="cc-topbar-controls">
      <div class="cc-badge-strip">
        ${renderStatusPill(formatRuntimeState(viewModel), runtimeTone)}
        ${renderStatusPill(t("急停全局可见", "Emergency stop always visible"), "blocked")}
      </div>
      <div class="cc-top-actions">
        <button type="button" class="cc-button" data-command-action="pause-mission">${escapeHtml(t("暂停", "Pause"))}</button>
        <button type="button" class="cc-button" data-command-action="resume-mission">${escapeHtml(t("继续", "Resume"))}</button>
        <button type="button" class="cc-button" data-command-action="stop-mission">${escapeHtml(t("停止", "Stop"))}</button>
        <button type="button" class="cc-button cc-button-danger" data-command-action="emergency-stop">${escapeHtml(t("急停", "E-Stop"))}</button>
      </div>
      <div class="cc-top-meta">
        <button type="button" class="cc-button" data-mode-toggle>${escapeHtml(t("开发者模式", "Developer Mode"))}</button>
        <a class="cc-action-link" href="?lang=en">${escapeHtml(t("英文", "EN"))}</a>
        <a class="cc-action-link" href="?lang=zh">${escapeHtml(t("中文", "中文"))}</a>
        <button type="button" class="cc-button" onclick="window.location.reload()">${escapeHtml(t("刷新", "Refresh"))}</button>
      </div>
    </div>
  </section>`;
}