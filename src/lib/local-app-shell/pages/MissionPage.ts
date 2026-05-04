import type { CommanderAppViewModel } from "../commander-app.types.js";
import { localizeCommanderText } from "../locale.js";
import { renderTabPanels } from "../render-advanced-utils.js";
import { escapeHtml, renderCard } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { renderPageHeader } from "../layout/PageHeader.js";
import { renderCurrentMissionCard } from "../modules/CurrentMissionCard.js";
import { renderCurrentStepCard } from "../modules/CurrentStepCard.js";
import { renderDebugDrilldownButton } from "../modules/DebugDrilldownButton.js";

function renderTabButtons(groupId: string, tabs: Array<{ id: string; label: string }>): string {
  return `<div class="cc-tab-strip" data-tab-group="${escapeHtml(groupId)}">${tabs.map((tab, index) => `<button type="button" class="cc-tab-button${index === 0 ? " is-active" : ""}" data-tab-button="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>`).join("")}</div>`;
}

export function renderMissionPage(viewModel: CommanderConsoleViewModel, appViewModel: CommanderAppViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const missionTabs = appViewModel.tabGroups.find((group) => group.groupId === "mission");
  const tabs = missionTabs?.options ?? [];
  const latestEvents = viewModel.runtimeProofTimeline.slice(0, 5);

  return `<section class="cc-page" data-app-page="mission" data-mission-page>
    ${renderPageHeader(t("运行", "Mission"), t("只显示运行过程，不把结果、复核、诊断和设置堆进同一页。", "Mission focuses on runtime only and keeps results, review, diagnostics, and settings out of the same page."))}
    ${renderTabButtons("mission", tabs)}
    ${renderTabPanels("mission", tabs, missionTabs?.defaultTabId ?? "mission-overview", (tabId) => {
      if (tabId === "mission-overview") {
        return `<div class="cc-page-stack">${renderCurrentMissionCard(viewModel)}${renderCurrentStepCard(viewModel)}${renderCard(t("动作入口", "Mission Actions"), t("二级页面内操作", "Within Mission"), renderDebugDrilldownButton(viewModel))}</div>`;
      }
      if (tabId === "mission-timeline") {
        return renderCard(t("最近关键事件", "Recent Key Events"), t("3-5 条", "3-5 events"), `<div class="cc-mini-list">${latestEvents.map((entry, index) => `<button type="button" class="cc-list-row cc-list-row-button" data-inspect-kind="round" data-inspect-id="${escapeHtml(`${entry.step}-${index}`)}"><div><strong>${escapeHtml(entry.message)}</strong><small>${escapeHtml(entry.createdAt)} · ${escapeHtml(entry.status)}</small></div><span>${escapeHtml(t("检查", "Inspect"))}</span></button>`).join("")}</div>`);
      }
      return renderCard(t("证明摘要", "Proof Summary"), t("三级详情入口", "Inspect Entry"), `<div class="cc-mini-list">${latestEvents.map((entry, index) => `<article class="cc-list-row"><div><strong>${escapeHtml(entry.step)}</strong><small>${escapeHtml(entry.message)}</small></div><button type="button" class="cc-button cc-button-tight" data-inspect-kind="round" data-inspect-id="${escapeHtml(`${entry.step}-${index}`)}">${escapeHtml(t("打开证明", "Open Proof"))}</button></article>`).join("")}</div>`);
    })}
  </section>`;
}
