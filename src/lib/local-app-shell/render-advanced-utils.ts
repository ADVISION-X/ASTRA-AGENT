import { escapeHtml } from "./render-helpers.js";

export function renderTabPanels(pageId: string, tabs: Array<{ id: string; label: string; subtitle?: string }>, activeTabId: string, renderPanel: (tabId: string) => string): string {
  return tabs.map((tab) => {
    const active = tab.id === activeTabId;
    return `<section class="cc-tab-panel${active ? " is-active" : ""}" data-page-panel="${escapeHtml(pageId)}" data-tab-panel="${escapeHtml(tab.id)}"${active ? "" : ' hidden="hidden"'}>
      ${renderPanel(tab.id)}
    </section>`;
  }).join("");
}

export function renderJsonBlock(value: unknown): string {
  return `<pre class="cc-json-block">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}