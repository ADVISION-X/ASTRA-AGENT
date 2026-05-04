import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderStatusPill } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { getActiveTaskTemplate } from "../view-helpers.js";

function localizeSafetyLevel(viewModel: CommanderConsoleViewModel, safetyLevel: string): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  switch (safetyLevel.trim().toLowerCase()) {
    case "guarded autopilot":
      return t("守护自动执行", "Guarded Autopilot");
    case "review-first":
      return t("先审后跑", "Review First");
    case "execution blocked":
      return t("禁止直接执行", "Execution Blocked");
    default:
      return safetyLevel;
  }
}

export function renderTaskTemplateLauncherModule(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const selectedTemplate = getActiveTaskTemplate(viewModel)?.taskTemplateId ?? viewModel.commandDraft.taskTemplateId;
  if (viewModel.taskTemplates.length === 0) {
    return `<section class="cc-home-section" data-home-launcher>
    <div class="cc-section-copy">
      <p class="cc-section-title">${escapeHtml(t("还没有可启动任务", "No Runnable Tasks"))}</p>
      <p class="cc-note">${escapeHtml(t("还没有可启动任务。请先去地图工坊输入需求，生成并激活地图。", "No runnable task is available. Go to Map Lab, describe the need, generate a map, and activate it first."))}</p>
    </div>
    <div class="cc-inline-actions">
      <button type="button" class="cc-button cc-button-primary" data-nav-page="map-lab">${escapeHtml(t("进入地图工坊", "Open Map Lab"))}</button>
    </div>
  </section>`;
  }

  return `<section class="cc-home-section" data-home-launcher>
    <div class="cc-section-copy">
      <p class="cc-section-title">${escapeHtml(t("任务模板", "Task Templates"))}</p>
      <p class="cc-note">${escapeHtml(t("只选任务，不碰系统字段。", "Choose the task only. System fields stay out of normal mode."))}</p>
    </div>
    <div class="cc-template-list">
      ${viewModel.taskTemplates.map((template) => {
        const selected = template.taskTemplateId === selectedTemplate;
        const disabled = template.availability !== "ready";
        return `<label class="cc-template-chip${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}" data-task-template-card="${escapeHtml(template.taskTemplateId)}">
          <input class="cc-task-template-input" type="radio" name="taskTemplateId" value="${escapeHtml(template.taskTemplateId)}"${selected ? " checked" : ""}${disabled ? " disabled" : ""} />
          <div class="cc-template-chip-main">
            <div>
              <strong>${escapeHtml(template.displayName)}</strong>
              <small>${escapeHtml(localizeSafetyLevel(viewModel, template.safetyLevel))}</small>
            </div>
            ${renderStatusPill(disabled ? t("不可用", "Blocked") : t("可启动", "Ready"), disabled ? "attention" : "ok")}
          </div>
          <p>${escapeHtml(template.description)}</p>
        </label>`;
      }).join("")}
    </div>
    <p class="cc-home-selected-copy" data-selected-task-description>${escapeHtml(getActiveTaskTemplate(viewModel)?.description ?? t("请选择一个任务模板。", "Select a task template."))}</p>
    <label class="cc-field">
      <span>${escapeHtml(t("本次目标", "Goal"))}</span>
      <textarea id="cc-human-goal" name="humanGoal" rows="3">${escapeHtml(getActiveTaskTemplate(viewModel)?.defaultHumanGoal ?? "")}</textarea>
    </label>
  </section>`;
}
