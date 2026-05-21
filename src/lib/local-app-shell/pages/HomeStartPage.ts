import type { CommanderAppViewModel } from "../commander-app.types.js";
import { localizeCommanderText } from "../locale.js";
import { joinHtml } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { renderActionableErrorBanner } from "../modules/ActionableErrorBanner.js";
import { renderResultSummaryCard } from "../modules/ResultSummaryCard.js";
import { renderVisualMissionPromptLauncher } from "../modules/VisualMissionPromptLauncher.js";

function isLaunchLocked(viewModel: CommanderConsoleViewModel): boolean {
  const runtimeStatus = viewModel.rawSnapshot.runtime.runtimeStatus;
  return runtimeStatus === "running" || runtimeStatus === "paused" || runtimeStatus === "review_required";
}

function shouldRenderResultSummary(viewModel: CommanderConsoleViewModel): boolean {
  return viewModel.rawSnapshot.runtime.runtimeStatus === "completed"
    || viewModel.rawSnapshot.runtime.evidencePacketCount > 0
    || viewModel.reviewQueueSummary.pendingCount > 0;
}

function renderHomeLaunchCard(viewModel: CommanderConsoleViewModel): string {
  return `<form class="cc-home-form" data-start-mission-form>
      ${renderVisualMissionPromptLauncher(viewModel, isLaunchLocked(viewModel))}
    </form>`;
}

function renderHomeSidebar(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return `<div class="cc-home-result-stack">
    ${shouldRenderResultSummary(viewModel) ? renderResultSummaryCard(viewModel, { title: t("结果摘要", "Result Summary"), eyebrow: t("有进度时出现", "Appears when progress exists"), includeOpenAction: true }) : ""}
  </div>`;
}

export function renderHomeStartPage(viewModel: CommanderConsoleViewModel, appViewModel: CommanderAppViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  return joinHtml([
    `<section class="cc-page" data-app-page="home" data-home-page>`,
    `<header class="cc-page-header cc-home-compact-header">
      <div>
        <span class="cc-home-workspace-label">${t("主工作区", "Main Workspace")}</span>
        <h2>${t("任务启动", "Mission Start")}</h2>
        <p>${t("首页选择纯视觉或 DOM 模式，再填写目标、平台、页面和运行边界。", "Choose Pure Visual or DOM mode, then provide goal, platform, page, and run bounds.")}</p>
      </div>
    </header>`,
    renderActionableErrorBanner(viewModel.locale, appViewModel.actionableErrors),
    `<div class="cc-home-grid">`,
    renderHomeLaunchCard(viewModel),
    renderHomeSidebar(viewModel),
    `</div>`,
    `</section>`,
  ]);
}
