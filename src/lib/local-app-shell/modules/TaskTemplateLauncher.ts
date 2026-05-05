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

export function renderTaskTemplateLauncherModule(viewModel: CommanderConsoleViewModel, launchLocked = false): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const selectedTaskTemplate = getActiveTaskTemplate(viewModel);
  const selectedTemplate = selectedTaskTemplate?.taskTemplateId ?? viewModel.commandDraft.taskTemplateId;
  if (viewModel.taskTemplates.length === 0) {
    return `<section class="cc-start-empty" data-home-launcher>
    <div class="cc-section-copy">
      <p class="cc-section-title">${escapeHtml(t("还没有可启动任务", "No Runnable Tasks"))}</p>
      <p class="cc-note">${escapeHtml(t("还没有可启动任务。请先去地图工坊输入需求，生成并激活地图。", "No runnable task is available. Go to Map Lab, describe the need, generate a map, and activate it first."))}</p>
    </div>
    <div class="cc-inline-actions">
      <button type="button" class="cc-button cc-button-primary" data-nav-page="map-lab">${escapeHtml(t("进入地图工坊", "Open Map Lab"))}</button>
    </div>
  </section>`;
  }

  const platformFilters = Array.from(new Set(viewModel.taskTemplates
    .map((template) => template.taskCategory.trim())
    .filter((category) => category.length > 0)))
    .slice(0, 5);
  const selectedDefaultGoal = selectedTaskTemplate?.defaultHumanGoal ?? "";
  const selectedDefaultMinutes = selectedTaskTemplate?.defaultRunLimit.maxMinutes ?? viewModel.commandDraft.maxMinutes;
  const selectedDefaultRounds = selectedTaskTemplate?.defaultRunLimit.maxRounds ?? viewModel.commandDraft.maxRounds;

  return `<section class="cc-start-console" data-home-launcher>
    <div class="cc-start-library">
      <div class="cc-start-library-header">
        <div class="cc-section-copy">
          <p class="cc-section-title">${escapeHtml(t("地图库 / 任务模板", "Map Library / Task Templates"))}</p>
          <p class="cc-note">${escapeHtml(t("选择要执行的地图。列表内部滚动，可容纳几十个默认地图。", "Choose a map to run. The list scrolls internally and can hold dozens of defaults."))}</p>
        </div>
        <span class="cc-template-count">${escapeHtml(t(`${viewModel.taskTemplates.length} 个地图`, `${viewModel.taskTemplates.length} maps`))}</span>
      </div>
      <label class="cc-search-field">
        <span>${escapeHtml(t("搜索", "Search"))}</span>
        <input type="search" data-template-search placeholder="${escapeHtml(t("搜索地图、平台、用途...", "Search maps, platforms, uses..."))}" autocomplete="off" />
      </label>
      <div class="cc-filter-strip" data-template-filter-strip>
        <button type="button" class="cc-filter-chip is-active" data-template-filter="all">${escapeHtml(t("全部", "All"))}</button>
        ${platformFilters.map((category) => `<button type="button" class="cc-filter-chip" data-template-filter="${escapeHtml(category.toLowerCase())}">${escapeHtml(category)}</button>`).join("")}
        <button type="button" class="cc-filter-chip" data-template-filter="recommended">${escapeHtml(t("推荐", "Recommended"))}</button>
        <button type="button" class="cc-filter-chip" data-template-filter="ready">${escapeHtml(t("可启动", "Ready"))}</button>
      </div>
      <div class="cc-template-list cc-template-list-scroll" data-template-list>
      ${viewModel.taskTemplates.map((template) => {
        const selected = template.taskTemplateId === selectedTemplate;
        const disabled = template.availability !== "ready";
        const searchable = [
          template.displayName,
          template.description,
          template.taskCategory,
          template.safetyLevel,
          template.userVisibleCapabilities.join(" "),
        ].join(" ").toLowerCase();
        return `<label class="cc-template-chip cc-template-row${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}" data-task-template-card="${escapeHtml(template.taskTemplateId)}" data-template-search-text="${escapeHtml(searchable)}" data-template-category="${escapeHtml(template.taskCategory.toLowerCase())}" data-template-ready="${template.availability === "ready" ? "true" : "false"}" data-template-recommended="${template.recommended ? "true" : "false"}">
          <input class="cc-task-template-input" type="radio" name="taskTemplateId" value="${escapeHtml(template.taskTemplateId)}"${selected ? " checked" : ""}${disabled ? " disabled" : ""} />
          <div class="cc-template-chip-main">
            <div>
              <strong>${escapeHtml(template.displayName)}</strong>
              <small>${escapeHtml(localizeSafetyLevel(viewModel, template.safetyLevel))} · ${escapeHtml(t(`默认 ${template.defaultRunLimit.maxMinutes} 分钟 / ${template.defaultRunLimit.maxRounds} 条`, `${template.defaultRunLimit.maxMinutes} min / ${template.defaultRunLimit.maxRounds} items`))}</small>
            </div>
            ${renderStatusPill(disabled ? t("不可用", "Blocked") : t("可启动", "Ready"), disabled ? "attention" : "ok")}
          </div>
          <p>${escapeHtml(template.description)}</p>
        </label>`;
      }).join("")}
      </div>
    </div>
    <aside class="cc-start-inspector" aria-label="${escapeHtml(t("启动确认", "Launch Confirmation"))}">
      <div class="cc-start-inspector-header">
        <p class="cc-section-title">${escapeHtml(t("启动确认", "Launch Confirmation"))}</p>
        ${renderStatusPill(selectedTaskTemplate?.availability === "ready" ? t("可启动", "Ready") : t("待选择", "Select"), selectedTaskTemplate?.availability === "ready" ? "ok" : "attention")}
      </div>
      <div class="cc-selected-task">
        <h3 data-selected-task-title>${escapeHtml(selectedTaskTemplate?.displayName ?? t("请选择一个地图", "Choose a map"))}</h3>
        <p data-selected-task-description>${escapeHtml(selectedTaskTemplate?.description ?? t("请选择一个任务模板。", "Select a task template."))}</p>
      </div>
      <div class="cc-launch-limit-grid">
        <label class="cc-field cc-launch-limit-field">
          <span>${escapeHtml(t("运行时长", "Run duration"))}</span>
          <input id="cc-max-minutes" name="maxMinutes" type="number" min="1" max="${escapeHtml(String(selectedTaskTemplate?.maxAllowedRunLimit.maxMinutes ?? 45))}" value="${escapeHtml(String(selectedDefaultMinutes))}" />
        </label>
        <label class="cc-field cc-launch-limit-field">
          <span>${escapeHtml(t("最多处理", "Max items"))}</span>
          <input id="cc-max-rounds" name="maxRounds" type="number" min="1" max="${escapeHtml(String(selectedTaskTemplate?.maxAllowedRunLimit.maxRounds ?? 6))}" value="${escapeHtml(String(selectedDefaultRounds))}" />
        </label>
      </div>
      <label class="cc-field cc-goal-field">
        <span>${escapeHtml(t("本次目标", "Goal"))}</span>
        <textarea id="cc-human-goal" name="humanGoal" rows="5" data-current-default-goal="${escapeHtml(selectedDefaultGoal)}">${escapeHtml(selectedDefaultGoal)}</textarea>
      </label>
      <div class="cc-selected-meta">
        <div>
          <span>${escapeHtml(t("任务类别", "Category"))}</span>
          <strong data-selected-task-category>${escapeHtml(selectedTaskTemplate?.taskCategory ?? t("未选择", "None"))}</strong>
        </div>
        <div>
          <span>${escapeHtml(t("安全级别", "Safety"))}</span>
          <strong data-selected-task-safety>${escapeHtml(selectedTaskTemplate ? localizeSafetyLevel(viewModel, selectedTaskTemplate.safetyLevel) : t("未选择", "None"))}</strong>
        </div>
      </div>
      <div class="cc-start-action-dock">
        <button type="submit" class="cc-button cc-button-primary cc-button-large"${launchLocked ? ' disabled="disabled"' : ""}>${escapeHtml(t("开始任务", "Start Task"))}</button>
        <div class="cc-inline-actions">
          <button type="button" class="cc-button cc-button-tight" data-nav-page="mission">${escapeHtml(t("查看运行页", "Open Mission"))}</button>
          <button type="button" class="cc-button cc-button-tight cc-button-danger" data-command-action="emergency-stop">${escapeHtml(t("急停", "Emergency"))}</button>
        </div>
      </div>
    </aside>
  </section>`;
}
