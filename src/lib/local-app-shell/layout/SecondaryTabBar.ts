import type { CommanderConsoleTabView } from "../types.js";
import { escapeHtml } from "../render-utils.js";

export function renderSecondaryTabBar(pageId: string, tabs: CommanderConsoleTabView[], activeTabId: string): string {
  return `<div class="cc-tabbar" role="tablist" aria-label="${escapeHtml(pageId)} tabs">
    ${tabs.map((tab) => `
      <button
        type="button"
        role="tab"
        class="cc-tab-button${tab.id === activeTabId ? " is-active" : ""}"
        aria-selected="${tab.id === activeTabId ? "true" : "false"}"
        data-page-tab-target="${escapeHtml(pageId)}"
        data-tab-target="${escapeHtml(tab.id)}"
      >
        <strong>${escapeHtml(tab.label)}</strong>
        <span>${escapeHtml(tab.subtitle)}</span>
      </button>
    `).join("")}
  </div>`;
}