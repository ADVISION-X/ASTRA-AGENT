import type { CommanderConsoleViewModel } from "../../types.js";
import { localizeCommanderText } from "../../locale.js";
import { escapeHtml, joinHtml, renderCard, renderStatusPill } from "../../render-utils.js";
import {
  buildHumanStepDetail,
  buildHumanStepLabel,
  formatElapsed,
  formatHealthStatus,
  formatRuntimeState,
  getActiveTaskTemplate,
  getRuntimeTone,
} from "../../view-helpers.js";

function renderMissionMetrics(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return `<div class="cc-mission-grid">
      <article class="cc-info-tile">
        <span>${escapeHtml(t("已运行时间", "Elapsed"))}</span>
        <strong>${escapeHtml(formatElapsed(viewModel))}</strong>
      </article>
      <article class="cc-info-tile">
        <span>${escapeHtml(t("当前处理数量", "Processed"))}</span>
        <strong>${escapeHtml(String(viewModel.rawSnapshot.runtime.totalSeenCount))}</strong>
      </article>
      <article class="cc-info-tile">
        <span>${escapeHtml(t("当前正在做什么", "Current action"))}</span>
        <strong>${escapeHtml(buildHumanStepLabel(viewModel))}</strong>
      </article>
      <article class="cc-info-tile">
        <span>${escapeHtml(t("健康状态", "Health"))}</span>
        <strong>${escapeHtml(formatHealthStatus(viewModel))}</strong>
      </article>
    </div>`;
}

function renderProofPreview(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return `<div class="cc-proof-preview">
      ${viewModel.runtimeProofTimeline.slice(0, 3).map((entry, index) => `<article class="cc-proof-item">
        <div>
          <strong>${escapeHtml(entry.message)}</strong>
          <p class="cc-note">${escapeHtml(entry.createdAt)} · ${escapeHtml(entry.status)}</p>
        </div>
        <button type="button" class="cc-inline-button" data-inspect-kind="round" data-inspect-id="${escapeHtml(`${entry.step}-${index}`)}">${escapeHtml(t("检查", "Inspect"))}</button>
      </article>`).join("")}
    </div>`;
}

export function renderMissionCockpit(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const taskTemplate = getActiveTaskTemplate(viewModel);
  const body = `<div class="cc-stack">
    <div class="cc-mission-hero">
      <div>
        <p class="cc-eyebrow">${escapeHtml(t("当前任务", "Current Task"))}</p>
        <h4>${escapeHtml(taskTemplate?.displayName ?? t("尚未启动任务", "No task started yet"))}</h4>
        <p class="cc-note">${escapeHtml(viewModel.rawSnapshot.mission.humanGoal || taskTemplate?.description || t("选择任务模板后即可开始。", "Select a task template to begin."))}</p>
      </div>
      ${renderStatusPill(formatRuntimeState(viewModel), getRuntimeTone(viewModel))}
    </div>
    ${renderMissionMetrics(viewModel)}
    <article class="cc-current-step-card">
      <h5>${escapeHtml(t("当前步骤", "Current Step"))}</h5>
      <strong>${escapeHtml(buildHumanStepLabel(viewModel))}</strong>
      <p class="cc-note">${escapeHtml(buildHumanStepDetail(viewModel))}</p>
    </article>
    ${renderProofPreview(viewModel)}
  </div>`;

  return joinHtml([
    `<div class="cc-span-7" id="mission-cockpit">`,
    renderCard(t("Mission Cockpit", "Mission Cockpit"), t("三秒看懂状态", "State Clarity"), body),
    `</div>`,
  ]);
}