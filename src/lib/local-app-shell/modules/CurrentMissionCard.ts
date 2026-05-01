import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderCard, renderStatusPill, renderSummaryList } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { buildHumanStepLabel, formatElapsed, formatRuntimeState, getActiveTaskTemplate, getRuntimeTone } from "../view-helpers.js";

export function renderCurrentMissionCard(viewModel: CommanderConsoleViewModel, options?: {
  title?: string;
  eyebrow?: string;
  includeOpenAction?: boolean;
}): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const taskTemplate = getActiveTaskTemplate(viewModel);
  const actions = options?.includeOpenAction
    ? `<button type="button" class="cc-button cc-button-tight" data-nav-page="mission">${escapeHtml(t("打开运行页", "Open Mission"))}</button>`
    : "";

  return renderCard(
    options?.title ?? t("当前任务", "Current Mission"),
    options?.eyebrow ?? t("任务摘要", "Mission Summary"),
    `<div class="cc-stack">
      <div class="cc-inline-actions cc-mission-card-top">
        <strong>${escapeHtml(taskTemplate?.displayName ?? t("尚未启动任务", "No task started yet"))}</strong>
        ${renderStatusPill(formatRuntimeState(viewModel), getRuntimeTone(viewModel))}
      </div>
      ${renderSummaryList([
        { label: t("当前动作", "Current Action"), value: buildHumanStepLabel(viewModel), tone: getRuntimeTone(viewModel) },
        { label: t("已运行", "Elapsed"), value: formatElapsed(viewModel) },
        { label: t("已处理", "Processed"), value: String(viewModel.rawSnapshot.runtime.totalSeenCount) },
      ])}
    </div>`,
    actions,
  );
}