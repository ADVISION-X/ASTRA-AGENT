import type { CommanderConsoleViewModel } from "../../types.js";
import { localizeCommanderText } from "../../locale.js";
import { escapeHtml, joinHtml, renderCard, renderStatusPill } from "../../render-utils.js";
import { formatRuntimeState, getActiveTaskTemplate, getRuntimeTone } from "../../view-helpers.js";

function renderTemplateCard(viewModel: CommanderConsoleViewModel, templateId: string | null): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return viewModel.taskTemplates.map((template) => {
    const selected = template.taskTemplateId === templateId;
    const disabled = template.availability === "disabled";
    return `<label class="cc-task-template-card${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}" data-task-template-card="${escapeHtml(template.taskTemplateId)}">
      <input class="cc-task-template-input" type="radio" name="taskTemplateId" value="${escapeHtml(template.taskTemplateId)}"${selected ? " checked" : ""}${disabled ? " disabled" : ""} />
      <div class="cc-task-template-header">
        <div>
          <div class="cc-task-template-title-row">
            <h4>${escapeHtml(template.displayName)}</h4>
            ${template.recommended ? `<span class="cc-recommended-badge">${escapeHtml(t("推荐", "Recommended"))}</span>` : ""}
          </div>
          <p class="cc-note">${escapeHtml(template.description)}</p>
        </div>
        ${renderStatusPill(disabled ? t("暂不可用", "Not Ready") : t("可直接启动", "Ready to Start"), disabled ? "attention" : "ok")}
      </div>
      <div class="cc-task-template-meta">
        <span>${escapeHtml(template.taskCategory)}</span>
        <span>${escapeHtml(template.safetyLevel)}</span>
        <span>${escapeHtml(t(`默认 ${template.defaultRunLimit.maxMinutes} 分钟 / ${template.defaultRunLimit.maxRounds} 条`, `${template.defaultRunLimit.maxMinutes} min / ${template.defaultRunLimit.maxRounds} items by default`))}</span>
      </div>
      <ul class="cc-capability-list">
        ${template.userVisibleCapabilities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>
      ${template.disabledReason ? `<p class="cc-note">${escapeHtml(template.disabledReason)}</p>` : ""}
    </label>`;
  }).join("");
}

export function renderTaskTemplateLauncher(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const selectedTemplate = getActiveTaskTemplate(viewModel);
  const runtimeStatus = viewModel.rawSnapshot.runtime.runtimeStatus;
  const launchLocked = runtimeStatus === "running" || runtimeStatus === "paused" || runtimeStatus === "review_required";

  return joinHtml([
    `<div class="cc-span-7">`,
    renderCard(
      t("Task Template Launcher", "Task Template Launcher"),
      t("普通模式", "Normal Mode"),
      `<form class="cc-stack" data-start-mission-form>
        <div class="cc-launch-copy">
          <p class="cc-launch-heading">${escapeHtml(t("请选择你要让 GrassEye 做什么", "Choose what you want GrassEye to do"))}</p>
          <p class="cc-note">${escapeHtml(t("普通用户只需要选择任务模板，再确认运行时长和最多处理数量。内部地图、平台和档案都留在开发者模式。", "Normal users only choose a task template, then confirm run time and max items. Internal maps, platform targets, and profiles stay in developer mode."))}</p>
        </div>
        <div class="cc-task-template-grid">${renderTemplateCard(viewModel, selectedTemplate?.taskTemplateId ?? viewModel.commandDraft.taskTemplateId)}</div>
        <div class="cc-launch-settings">
          <div class="cc-field">
            <label for="cc-max-minutes">${escapeHtml(t("运行时长", "Run duration"))}</label>
            <input id="cc-max-minutes" name="maxMinutes" type="number" min="1" max="${escapeHtml(String(selectedTemplate?.maxAllowedRunLimit.maxMinutes ?? 45))}" value="${escapeHtml(String(selectedTemplate?.defaultRunLimit.maxMinutes ?? viewModel.commandDraft.maxMinutes))}" />
          </div>
          <div class="cc-field">
            <label for="cc-max-rounds">${escapeHtml(t("最多处理数量", "Max items"))}</label>
            <input id="cc-max-rounds" name="maxRounds" type="number" min="1" max="${escapeHtml(String(selectedTemplate?.maxAllowedRunLimit.maxRounds ?? 6))}" value="${escapeHtml(String(selectedTemplate?.defaultRunLimit.maxRounds ?? viewModel.commandDraft.maxRounds))}" />
          </div>
        </div>
        <div class="cc-launch-summary" data-selected-task-description>${escapeHtml(selectedTemplate?.description ?? t("请先选择一个任务模板。", "Select a task template first."))}</div>
        <div class="cc-launch-safety-strip">
          <span>${escapeHtml(t("当前状态", "Current state"))}</span>
          ${renderStatusPill(formatRuntimeState(viewModel), getRuntimeTone(viewModel))}
          <span class="cc-note">${escapeHtml(t("默认不会无限运行。危险策略默认关闭。", "Runs are bounded by default. Dangerous strategies stay off by default."))}</span>
        </div>
        <div class="cc-action-row">
          <button type="submit" class="cc-button cc-button-primary"${launchLocked ? ' disabled="disabled"' : ""}>${escapeHtml(t("开始任务", "Start Task"))}</button>
          <button type="button" class="cc-button" data-scroll-target="mission-cockpit">${escapeHtml(t("查看当前任务", "See Mission Cockpit"))}</button>
          <button type="button" class="cc-button" data-mode-toggle>${escapeHtml(t("打开开发者模式", "Open Developer Mode"))}</button>
        </div>
      </form>`,
    ),
    `</div>`,
  ]);
}