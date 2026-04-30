import type { CommanderAppViewModel } from "../commander-app.types.js";
import { localizeCommanderText } from "../locale.js";
import { escapeHtml, joinHtml, renderCard } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { renderActionableErrorBanner } from "../modules/ActionableErrorBanner.js";
import { renderCurrentMissionCard } from "../modules/CurrentMissionCard.js";
import { renderResultSummaryCard } from "../modules/ResultSummaryCard.js";
import { renderRunLimitMiniForm } from "../modules/RunLimitMiniForm.js";
import { renderSafetyControls } from "../modules/SafetyControls.js";
import { renderTaskTemplateLauncherModule } from "../modules/TaskTemplateLauncher.js";
import { renderPageHeader } from "../layout/PageHeader.js";
import { getActiveTaskTemplate } from "../view-helpers.js";

export function renderHomeStartPage(viewModel: CommanderConsoleViewModel, appViewModel: CommanderAppViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const activeTemplate = getActiveTaskTemplate(viewModel);
  const launchLocked = !activeTemplate || activeTemplate.availability !== "ready"
    || viewModel.rawSnapshot.runtime.runtimeStatus === "running"
    || viewModel.rawSnapshot.runtime.runtimeStatus === "paused"
    || viewModel.rawSnapshot.runtime.runtimeStatus === "review_required";
  const shouldShowResultCard = viewModel.rawSnapshot.runtime.runtimeStatus === "completed"
    || viewModel.rawSnapshot.runtime.evidencePacketCount > 0
    || viewModel.reviewQueueSummary.pendingCount > 0;

  const launchCard = renderCard(
    t("开始任务", "Start Mission"),
    t("启动页", "Start Surface"),
    `<form class="cc-stack cc-home-form" data-start-mission-form>
      ${renderTaskTemplateLauncherModule(viewModel)}
      <div class="cc-home-start-row">
        <button type="submit" class="cc-button cc-button-primary cc-button-large"${launchLocked ? ' disabled="disabled"' : ""}>${escapeHtml(t("开始任务", "Start Task"))}</button>
        <button type="button" class="cc-button cc-button-tight" data-nav-page="mission">${escapeHtml(t("查看运行页", "Open Mission"))}</button>
      </div>
    </form>`,
  );

  const runLimitPanel = `<section class="cc-card">${renderRunLimitMiniForm(viewModel)}</section>`;
  const safetyPanel = `<section class="cc-card">${renderSafetyControls(viewModel)}</section>`;

  return joinHtml([
    `<section class="cc-page" data-app-page="home" data-home-page>`,
    renderPageHeader(t("开始", "Start"), t("桌面启动页只保留启动任务、运行边界和当前状态。", "The desktop start page keeps only task launch, run bounds, and current status.")),
    renderActionableErrorBanner(viewModel.locale, appViewModel.actionableErrors),
    `<div class="cc-page-stack cc-home-grid">`,
    launchCard,
    `<div class="cc-home-sidebar-stack">`,
    renderCurrentMissionCard(viewModel, { title: t("当前任务", "Current Mission"), eyebrow: t("运行摘要", "Mission Summary"), includeOpenAction: true }),
    runLimitPanel,
    safetyPanel,
    shouldShowResultCard ? renderResultSummaryCard(viewModel, { title: t("结果摘要", "Result Summary"), eyebrow: t("有进度时出现", "Appears when progress exists"), includeOpenAction: true }) : "",
    `</div>`,
    `</div>`,
    `</section>`,
  ]);
}