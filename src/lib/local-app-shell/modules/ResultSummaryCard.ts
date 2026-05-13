import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderCard } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { canRequestCandidateExport } from "../view-helpers.js";

export function renderResultSummaryCard(viewModel: CommanderConsoleViewModel, options?: {
  title?: string;
  eyebrow?: string;
  includeOpenAction?: boolean;
}): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const evidenceCount = viewModel.rawSnapshot.runtime.evidencePacketCount;
  const browseCount = viewModel.rawSnapshot.runtime.browseRecordCount;
  const failedCount = viewModel.failedRecords.length;
  const reviewCount = viewModel.reviewQueueSummary.pendingCount;
  const exportAvailable = canRequestCandidateExport(viewModel);
  const exportButton = exportAvailable
    ? `<button type="button" class="cc-button cc-button-tight" data-export-type="candidate-summary">${escapeHtml(t("导出", "Export"))}</button>`
    : `<button type="button" class="cc-button cc-button-tight" disabled="disabled" title="${escapeHtml(t("当前构建未开放导出请求", "Export requests are unavailable in this build"))}">${escapeHtml(t("导出未开放", "Export Unavailable"))}</button>`;
  const actions = options?.includeOpenAction
    ? `<div class="cc-inline-actions"><button type="button" class="cc-button cc-button-tight" data-nav-page="results">${escapeHtml(t("打开结果页", "Open Results"))}</button>${exportButton}</div>`
    : exportButton;

  return renderCard(
    options?.title ?? t("结果摘要", "Result Summary"),
    options?.eyebrow ?? t("结果页入口", "Results Entry"),
    `<div class="cc-stat-grid">
      <article class="cc-stat-tile"><span>${escapeHtml(t("证据包", "Evidence"))}</span><strong>${escapeHtml(String(evidenceCount))}</strong></article>
      <article class="cc-stat-tile"><span>${escapeHtml(t("浏览账本", "Browse Ledger"))}</span><strong>${escapeHtml(String(browseCount))}</strong></article>
      <article class="cc-stat-tile"><span>${escapeHtml(t("失败", "Failed"))}</span><strong>${escapeHtml(String(failedCount))}</strong></article>
      <article class="cc-stat-tile"><span>${escapeHtml(t("待复核", "Review"))}</span><strong>${escapeHtml(String(reviewCount))}</strong></article>
    </div>`,
    actions,
  );
}