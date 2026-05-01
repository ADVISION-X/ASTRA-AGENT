import { escapeHtml } from "../../lib/local-app-shell/render-helpers.js";

import type { CommanderConsoleInspectKind } from "./types.js";

export function renderDataTable(headers: string[], rows: string[][], emptyText = "No data available."): string {
  if (rows.length === 0) {
    return `<div class="cc-empty">${escapeHtml(emptyText)}</div>`;
  }

  return `<table class="cc-table">
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;
}

export function renderTabPanels(pageId: string, tabs: Array<{ id: string; label: string; subtitle?: string }>, activeTabId: string, renderPanel: (tabId: string) => string): string {
  return tabs.map((tab) => {
    const active = tab.id === activeTabId;
    return `<section class="cc-tab-panel${active ? " is-active" : ""}" data-page-panel="${escapeHtml(pageId)}" data-tab-panel="${escapeHtml(tab.id)}"${active ? "" : ' hidden="hidden"'}>
      ${renderPanel(tab.id)}
    </section>`;
  }).join("");
}

export function renderInspectButton(kind: CommanderConsoleInspectKind, id: string, label: string): string {
  return `<button type="button" class="cc-inline-button" data-inspect-kind="${escapeHtml(kind)}" data-inspect-id="${escapeHtml(id)}">${escapeHtml(label)}</button>`;
}

export function renderJsonBlock(value: unknown): string {
  return `<pre class="cc-json-block">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`;
}