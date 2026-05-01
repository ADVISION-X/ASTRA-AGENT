import type { CommanderAppViewModel } from "../commander-app.types.js";
import { localizeCommanderText } from "../locale.js";
import { renderTabPanels } from "../render-advanced-utils.js";
import { escapeHtml, renderCard } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { renderPageHeader } from "../layout/PageHeader.js";
import { renderResultSummaryCard } from "../modules/ResultSummaryCard.js";
import { canRequestCandidateExport } from "../view-helpers.js";

function renderTabButtons(groupId: string, tabs: Array<{ id: string; label: string }>): string {
  return `<div class="cc-tab-strip" data-tab-group="${escapeHtml(groupId)}">${tabs.map((tab, index) => `<button type="button" class="cc-tab-button${index === 0 ? " is-active" : ""}" data-tab-button="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>`).join("")}</div>`;
}

function renderRecordList(
  viewModel: CommanderConsoleViewModel,
  items: CommanderConsoleViewModel["evidencePackets"],
  kind: "evidence" | "record",
): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);

  return items.length === 0
    ? `<div class="cc-empty">${escapeHtml(t("当前没有记录。", "No records are available right now."))}</div>`
    : `<div class="cc-mini-list">${items.slice(0, 8).map((item) => `<button type="button" class="cc-list-row cc-list-row-button" data-inspect-kind="${escapeHtml(kind)}" data-inspect-id="${escapeHtml(item.id)}"><div><strong>${escapeHtml(item.primary)}</strong><small>${escapeHtml(`${item.secondary} · ${item.detail}`)}</small></div><span>${escapeHtml(t("检查", "Inspect"))}</span></button>`).join("")}</div>`;
}

function renderExportCard(viewModel: CommanderConsoleViewModel, exportAvailable: boolean): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const action = exportAvailable
    ? `<button type="button" class="cc-button cc-button-primary" data-export-type="candidate-summary">${escapeHtml(t("导出结果", "Export Results"))}</button>`
    : `<button type="button" class="cc-button cc-button-primary" disabled="disabled" title="${escapeHtml(t("当前构建未开放导出请求", "Export requests are unavailable in this build"))}">${escapeHtml(t("导出未开放", "Export Unavailable"))}</button>`;

  return renderCard(
    t("导出", "Export"),
    t("结果页", "Results"),
    `<div class="cc-page-stack"><p class="cc-note">${escapeHtml(viewModel.exportSummary[0]?.detail ?? t("当前没有导出状态。", "No export status is available."))}</p><div class="cc-inline-actions">${action}</div></div>`,
  );
}

function renderResultsTabPanel(viewModel: CommanderConsoleViewModel, tabId: string, exportAvailable: boolean): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  if (tabId === "results-summary") {
    return `<div class="cc-page-stack">${renderResultSummaryCard(viewModel, { includeOpenAction: false })}${renderCard(t("最近结果", "Recent Results"), t("最近产出", "Latest Outputs"), renderRecordList(viewModel, viewModel.evidencePackets, "evidence"))}</div>`;
  }
  if (tabId === "results-evidence") {
    return renderCard(t("证据包", "Evidence Packets"), t("结果页", "Results"), renderRecordList(viewModel, viewModel.evidencePackets, "evidence"));
  }
  if (tabId === "results-browse") {
    return renderCard(t("浏览账本", "Browse Ledger"), t("结果页", "Results"), renderRecordList(viewModel, viewModel.browseLedger, "record"));
  }
  if (tabId === "results-failed") {
    return renderCard(t("失败记录", "Failed Records"), t("结果页", "Results"), renderRecordList(viewModel, viewModel.failedRecords, "record"));
  }
  return renderExportCard(viewModel, exportAvailable);
}

export function renderResultsPage(viewModel: CommanderConsoleViewModel, appViewModel: CommanderAppViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const exportAvailable = canRequestCandidateExport(viewModel);
  const resultsTabs = appViewModel.tabGroups.find((group) => group.groupId === "results");
  const tabs = resultsTabs?.options ?? [];

  return `<section class="cc-page" data-app-page="results" data-results-page>
    ${renderPageHeader(t("结果", "Results"), t("只显示结果摘要、结果列表和导出入口。启动表单不在这里。", "Results shows result summaries, result lists, and export entry only. The start form does not live here."))}
    ${renderTabButtons("results", tabs)}
    ${renderTabPanels("results", tabs, resultsTabs?.defaultTabId ?? "results-summary", (tabId) => renderResultsTabPanel(viewModel, tabId, exportAvailable))}
  </section>`;
}