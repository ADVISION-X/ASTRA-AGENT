import type { CommanderAppViewModel } from "../commander-app.types.js";
import { localizeCommanderText } from "../locale.js";
import { renderTabPanels } from "../render-advanced-utils.js";
import { escapeHtml, renderCard } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { renderPageHeader } from "../layout/PageHeader.js";
import { renderCapabilityHealthList } from "../modules/CapabilityHealthList.js";
import { renderStructuredLogList } from "../modules/StructuredLogList.js";
import { renderDebugDrilldownButton } from "../modules/DebugDrilldownButton.js";

function renderTabButtons(groupId: string, tabs: Array<{ id: string; label: string }>): string {
  return `<div class="cc-tab-strip" data-tab-group="${escapeHtml(groupId)}">${tabs.map((tab, index) => `<button type="button" class="cc-tab-button${index === 0 ? " is-active" : ""}" data-tab-button="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>`).join("")}</div>`;
}

export function renderHealthPage(viewModel: CommanderConsoleViewModel, appViewModel: CommanderAppViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const healthTabs = appViewModel.tabGroups.find((group) => group.groupId === "health");
  const tabs = healthTabs?.options ?? [];

  return `<section class="cc-page" data-app-page="health" data-health-page>
    ${renderPageHeader(t("诊断", "Diagnostics"), t("这里显示状态、阻断原因和结构化日志摘要；完整日志仍然在终端。", "This page shows status, blockers, and structured log summaries. Full logs stay in the terminal."))}
    ${renderTabButtons("health", tabs)}
    ${renderTabPanels("health", tabs, healthTabs?.defaultTabId ?? "health-capabilities", (tabId) => {
      if (tabId === "health-capabilities") {
        return `<div class="cc-page-stack">${renderCapabilityHealthList(viewModel)}${renderCard(t("检查入口", "Inspect Entry"), t("诊断页", "Diagnostics"), renderDebugDrilldownButton(viewModel))}</div>`;
      }
      if (tabId === "health-failures") {
        return renderCard(t("阻断原因", "Blockers"), t("诊断页", "Diagnostics"), `<div class="cc-mini-list">${viewModel.failureRadarSummary.map((item, index) => `<button type="button" class="cc-list-row cc-list-row-button" data-inspect-kind="health" data-inspect-id="${escapeHtml(`failure-${index}`)}"><div><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.detail)}</small></div><span>${escapeHtml(item.severity)}</span></button>`).join("") || `<div class="cc-empty">${escapeHtml(t("当前没有阻断项。", "No blockers are active."))}</div>`}</div>`);
      }
      return renderStructuredLogList(viewModel);
    })}
  </section>`;
}
