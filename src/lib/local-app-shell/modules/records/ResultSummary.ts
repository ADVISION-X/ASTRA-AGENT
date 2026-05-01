import type { CommanderConsoleViewModel } from "../../types.js";
import { localizeCommanderText } from "../../locale.js";
import { escapeHtml, joinHtml, renderCard } from "../../render-utils.js";

export function renderResultSummary(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const evidenceCount = viewModel.rawSnapshot.runtime.evidencePacketCount;
  const browseCount = viewModel.rawSnapshot.runtime.browseLedgerCount;
  const failedCount = viewModel.failedRecords.length;
  const reviewCount = viewModel.reviewQueueSummary.pendingCount;
  const nonProductCount = Math.max(browseCount - evidenceCount, 0);

  const body = `<div class="cc-result-stack">
    <div class="cc-result-grid">
      <article class="cc-result-tile"><span>${escapeHtml(t("产品视频证据包", "Product evidence packets"))}</span><strong>${escapeHtml(String(evidenceCount))}</strong></article>
      <article class="cc-result-tile"><span>${escapeHtml(t("非产品浏览记录", "Non-product browse records"))}</span><strong>${escapeHtml(String(nonProductCount))}</strong></article>
      <article class="cc-result-tile"><span>${escapeHtml(t("失败记录", "Failed records"))}</span><strong>${escapeHtml(String(failedCount))}</strong></article>
      <article class="cc-result-tile"><span>${escapeHtml(t("待复核", "Pending review"))}</span><strong>${escapeHtml(String(reviewCount))}</strong></article>
    </div>
    <div class="cc-result-export-row">
      <div>
        <span>${escapeHtml(t("导出状态", "Export status"))}</span>
        <strong>${escapeHtml(viewModel.exportSummary[0]?.status ?? t("不可用", "Unavailable"))}</strong>
      </div>
      <div class="cc-inline-actions">
        <button type="button" class="cc-button" data-scroll-target="result-center">${escapeHtml(t("打开结果中心", "Open Result Center"))}</button>
        <button type="button" class="cc-button cc-button-primary" data-export-type="candidate-summary">${escapeHtml(t("导出结果", "Export Results"))}</button>
      </div>
    </div>
  </div>`;

  return joinHtml([
    `<div class="cc-span-5" id="result-center">`,
    renderCard(t("Result Summary", "Result Summary"), t("结果中心", "Result Center"), body),
    `</div>`,
  ]);
}