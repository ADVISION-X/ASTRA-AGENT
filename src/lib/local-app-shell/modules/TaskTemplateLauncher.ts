import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderStatusPill } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { getActiveTaskTemplate } from "../view-helpers.js";

type TaskTemplateViewModel = CommanderConsoleViewModel["taskTemplates"][number];
type Localize = (zh: string, en: string) => string;

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

const renderEmptyTaskTemplateLauncher = (t: Localize): string => `<section class="cc-start-empty" data-home-launcher>
    <div class="cc-section-copy">
      <p class="cc-section-title">${escapeHtml(t("还没有可启动任务", "No Runnable Tasks"))}</p>
      <p class="cc-note">${escapeHtml(t("还没有可启动任务。请先去地图工坊输入需求，生成并激活地图。", "No runnable task is available. Go to Map Lab, describe the need, generate a map, and activate it first."))}</p>
    </div>
    <div class="cc-inline-actions">
      <button type="button" class="cc-button cc-button-primary" data-nav-page="map-lab">${escapeHtml(t("进入地图工坊", "Open Map Lab"))}</button>
    </div>
  </section>`;

const getPlatformFilters = (viewModel: CommanderConsoleViewModel): string[] =>
  Array.from(new Set(viewModel.taskTemplates
    .map((template) => template.taskCategory.trim())
    .filter((category) => category.length > 0)))
    .slice(0, 5);

const getTemplateSearchText = (template: TaskTemplateViewModel): string =>
  [
    template.displayName,
    template.description,
    template.taskCategory,
    template.safetyLevel,
    template.userVisibleCapabilities.join(" "),
  ].join(" ").toLowerCase();

const renderTemplateCard = (input: {
  viewModel: CommanderConsoleViewModel;
  template: TaskTemplateViewModel;
  selectedTemplate: string | null;
  t: Localize;
}): string => {
  const selected = input.template.taskTemplateId === input.selectedTemplate;
  const disabled = input.template.availability !== "ready";
  const rowClass = `cc-template-chip cc-template-row${selected ? " is-selected" : ""}${disabled ? " is-disabled" : ""}`;
  return `<label class="${rowClass}" ${renderTemplateCardData(input.template)}>
          <input class="cc-task-template-input" type="radio" name="taskTemplateId" value="${escapeHtml(input.template.taskTemplateId)}"${renderCheckedAttribute(selected)}${renderDisabledAttribute(disabled)} />
          <div class="cc-template-chip-main">
            <div>
              <strong>${escapeHtml(input.template.displayName)}</strong>
              <small>${renderTemplateCardSummary(input)}</small>
            </div>
            ${renderStatusPill(disabled ? input.t("不可用", "Blocked") : input.t("可启动", "Ready"), disabled ? "attention" : "ok")}
          </div>
          <p>${escapeHtml(input.template.description)}</p>
        </label>`;
};

const renderTemplateCardData = (template: TaskTemplateViewModel): string =>
  `data-task-template-card="${escapeHtml(template.taskTemplateId)}" data-template-search-text="${escapeHtml(getTemplateSearchText(template))}" data-template-category="${escapeHtml(template.taskCategory.toLowerCase())}" data-template-ready="${template.availability === "ready" ? "true" : "false"}" data-template-recommended="${template.recommended ? "true" : "false"}"`;

const renderCheckedAttribute = (selected: boolean): string => selected ? " checked" : "";

const renderDisabledAttribute = (disabled: boolean): string => disabled ? " disabled" : "";

const renderTemplateCardSummary = (input: {
  viewModel: CommanderConsoleViewModel;
  template: TaskTemplateViewModel;
  t: Localize;
}): string =>
  `${escapeHtml(localizeSafetyLevel(input.viewModel, input.template.safetyLevel))} · ${escapeHtml(input.template.taskCategory)}`;

const renderTaskTemplateList = (
  viewModel: CommanderConsoleViewModel,
  selectedTemplate: string | null,
  t: Localize,
): string =>
  viewModel.taskTemplates.map((template) => renderTemplateCard({ viewModel, template, selectedTemplate, t })).join("");

const renderFilterStrip = (platformFilters: string[], t: Localize): string => `<div class="cc-filter-strip" data-template-filter-strip>
        <button type="button" class="cc-filter-chip is-active" data-template-filter="all">${escapeHtml(t("全部", "All"))}</button>
        ${platformFilters.map((category) => `<button type="button" class="cc-filter-chip" data-template-filter="${escapeHtml(category.toLowerCase())}">${escapeHtml(category)}</button>`).join("")}
        <button type="button" class="cc-filter-chip" data-template-filter="recommended">${escapeHtml(t("推荐", "Recommended"))}</button>
        <button type="button" class="cc-filter-chip" data-template-filter="ready">${escapeHtml(t("可启动", "Ready"))}</button>
      </div>`;

const renderTaskTemplateLibrary = (input: {
  viewModel: CommanderConsoleViewModel;
  selectedTemplate: string | null;
  platformFilters: string[];
  t: Localize;
}): string => `<div class="cc-start-library">
      <div class="cc-start-library-header">
        <div class="cc-section-copy">
          <p class="cc-section-title">${escapeHtml(input.t("地图库 / 任务模板", "Map Library / Task Templates"))}</p>
          <p class="cc-note">${escapeHtml(input.t("选择要执行的地图。列表内部滚动，可容纳几十个默认地图。", "Choose a map to run. The list scrolls internally and can hold dozens of defaults."))}</p>
        </div>
        <span class="cc-template-count">${escapeHtml(input.t(`${input.viewModel.taskTemplates.length} 个地图`, `${input.viewModel.taskTemplates.length} maps`))}</span>
      </div>
      <label class="cc-search-field">
        <span>${escapeHtml(input.t("搜索", "Search"))}</span>
        <input type="search" data-template-search placeholder="${escapeHtml(input.t("搜索地图、平台、用途...", "Search maps, platforms, uses..."))}" autocomplete="off" />
      </label>
      ${renderFilterStrip(input.platformFilters, input.t)}
      <div class="cc-template-list cc-template-list-scroll" data-template-list>
      ${renderTaskTemplateList(input.viewModel, input.selectedTemplate, input.t)}
      </div>
    </div>`;

const renderTaskLaunchInspector = (input: {
  viewModel: CommanderConsoleViewModel;
  selectedTaskTemplate: TaskTemplateViewModel | null | undefined;
  selectedDefaultGoal: string;
  selectedDefaultMinutes: number;
  selectedDefaultRounds: number;
  launchLocked: boolean;
  t: Localize;
}): string => `<aside class="cc-start-inspector" aria-label="${escapeHtml(input.t("启动确认", "Launch Confirmation"))}">
      <div class="cc-start-inspector-header">
        <p class="cc-section-title">${escapeHtml(input.t("启动确认", "Launch Confirmation"))}</p>
        ${renderStatusPill(input.selectedTaskTemplate?.availability === "ready" ? input.t("可启动", "Ready") : input.t("待选择", "Select"), input.selectedTaskTemplate?.availability === "ready" ? "ok" : "attention")}
      </div>
      ${renderSelectedTaskSummary(input)}
      ${renderLaunchLimitFields(input)}
      ${renderGoalField(input)}
      ${renderSelectedMeta(input)}
      ${renderStartActionDock(input)}
    </aside>`;

const renderSelectedTaskSummary = (input: {
  selectedTaskTemplate: TaskTemplateViewModel | null | undefined;
  t: Localize;
}): string => `<div class="cc-selected-task">
        <h3 data-selected-task-title>${escapeHtml(input.selectedTaskTemplate?.displayName ?? input.t("请选择一个地图", "Choose a map"))}</h3>
        <p data-selected-task-description>${escapeHtml(input.selectedTaskTemplate?.description ?? input.t("请选择一个任务模板。", "Select a task template."))}</p>
      </div>`;

const renderLaunchLimitFields = (input: {
  selectedDefaultMinutes: number;
  selectedDefaultRounds: number;
  t: Localize;
}): string => `<div class="cc-launch-limit-grid">
        <label class="cc-field cc-launch-limit-field">
          <span>${escapeHtml(input.t("运行时长", "Run duration"))}</span>
          <input id="cc-max-minutes" name="maxMinutes" type="number" min="1" value="${escapeHtml(String(input.selectedDefaultMinutes))}" />
        </label>
        <label class="cc-field cc-launch-limit-field">
          <span>${escapeHtml(input.t("最多处理轮次", "Max processing rounds"))}</span>
          <input id="cc-max-rounds" name="maxRounds" type="number" min="1" value="${escapeHtml(String(input.selectedDefaultRounds))}" />
        </label>
        <p class="cc-note cc-span-2" data-app-run-limit-default-note>${escapeHtml(input.t("默认值来自设置页，不由地图决定；这里可以临时改写。", "Defaults come from Settings, not from maps; you can override them here for this run."))}</p>
      </div>`;

const renderGoalField = (input: { selectedDefaultGoal: string; t: Localize }): string =>
  `<label class="cc-field cc-goal-field">
        <span>${escapeHtml(input.t("本次目标", "Goal"))}</span>
        <textarea id="cc-human-goal" name="humanGoal" rows="5" data-current-default-goal="${escapeHtml(input.selectedDefaultGoal)}">${escapeHtml(input.selectedDefaultGoal)}</textarea>
      </label>`;

const renderSelectedMeta = (input: {
  viewModel: CommanderConsoleViewModel;
  selectedTaskTemplate: TaskTemplateViewModel | null | undefined;
  t: Localize;
}): string => `<div class="cc-selected-meta">
        <div>
          <span>${escapeHtml(input.t("任务类别", "Category"))}</span>
          <strong data-selected-task-category>${escapeHtml(input.selectedTaskTemplate?.taskCategory ?? input.t("未选择", "None"))}</strong>
        </div>
        <div>
          <span>${escapeHtml(input.t("安全级别", "Safety"))}</span>
          <strong data-selected-task-safety>${escapeHtml(input.selectedTaskTemplate ? localizeSafetyLevel(input.viewModel, input.selectedTaskTemplate.safetyLevel) : input.t("未选择", "None"))}</strong>
        </div>
      </div>`;

const renderStartActionDock = (input: { launchLocked: boolean; t: Localize }): string => `<div class="cc-start-action-dock">
        <button type="submit" class="cc-button cc-button-primary cc-button-large"${input.launchLocked ? ' disabled="disabled"' : ""}>${escapeHtml(input.t("开始任务", "Start Task"))}</button>
        <div class="cc-inline-actions">
          <button type="button" class="cc-button cc-button-tight" data-nav-page="mission">${escapeHtml(input.t("查看运行页", "Open Mission"))}</button>
          <button type="button" class="cc-button cc-button-tight cc-button-danger" data-command-action="emergency-stop">${escapeHtml(input.t("急停", "Emergency"))}</button>
        </div>
      </div>`;

export function renderTaskTemplateLauncherModule(viewModel: CommanderConsoleViewModel, launchLocked = false): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const selectedTaskTemplate = getActiveTaskTemplate(viewModel);
  const selectedTemplate = selectedTaskTemplate?.taskTemplateId ?? viewModel.commandDraft.taskTemplateId;
  if (viewModel.taskTemplates.length === 0) {
    return renderEmptyTaskTemplateLauncher(t);
  }

  const platformFilters = getPlatformFilters(viewModel);
  const selectedDefaultGoal = selectedTaskTemplate?.defaultHumanGoal ?? "";
  const selectedDefaultMinutes = viewModel.commandDraft.maxMinutes;
  const selectedDefaultRounds = viewModel.commandDraft.maxRounds;

  return `<section class="cc-start-console" data-home-launcher>
    ${renderTaskTemplateLibrary({ viewModel, selectedTemplate, platformFilters, t })}
    ${renderTaskLaunchInspector({ viewModel, selectedTaskTemplate, selectedDefaultGoal, selectedDefaultMinutes, selectedDefaultRounds, launchLocked, t })}
  </section>`;
}
