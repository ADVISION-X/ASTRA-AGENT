import type { CommanderAppViewModel } from "../commander-app.types.js";
import { localizeCommanderText } from "../locale.js";
import { joinHtml } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { renderActionableErrorBanner } from "../modules/ActionableErrorBanner.js";
import { renderResultSummaryCard } from "../modules/ResultSummaryCard.js";
import { renderTaskTemplateLauncherModule } from "../modules/TaskTemplateLauncher.js";
import { renderPageHeader } from "../layout/PageHeader.js";
import { getActiveTaskTemplate } from "../view-helpers.js";

function isLaunchLocked(viewModel: CommanderConsoleViewModel): boolean {
  const activeTemplate = getActiveTaskTemplate(viewModel);
  const runtimeStatus = viewModel.rawSnapshot.runtime.runtimeStatus;
  return !activeTemplate || activeTemplate.availability !== "ready" || runtimeStatus === "running" || runtimeStatus === "paused" || runtimeStatus === "review_required";
}

function shouldRenderResultSummary(viewModel: CommanderConsoleViewModel): boolean {
  return viewModel.rawSnapshot.runtime.runtimeStatus === "completed"
    || viewModel.rawSnapshot.runtime.evidencePacketCount > 0
    || viewModel.reviewQueueSummary.pendingCount > 0;
}

function renderHomeLaunchCard(viewModel: CommanderConsoleViewModel): string {
  return `<form class="cc-home-form" data-start-mission-form>
      ${renderTaskTemplateLauncherModule(viewModel, isLaunchLocked(viewModel))}
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
    renderPageHeader(t("开始", "Start"), t("桌面启动页只保留启动任务、运行边界和当前状态。", "The desktop start page keeps only task launch, run bounds, and current status.")),
    renderActionableErrorBanner(viewModel.locale, appViewModel.actionableErrors),
    `<div class="cc-home-grid">`,
    renderHomeLaunchCard(viewModel),
    renderHomeSidebar(viewModel),
    `</div>`,
    `</section>`,
  ]);
}
