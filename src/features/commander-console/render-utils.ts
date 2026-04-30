import { escapeHtml } from "../../lib/local-app-shell/render-helpers.js";

import type {
  CommanderConsoleInspectKind,
  CommanderConsoleStatusTone,
  CommanderConsoleSummaryItem,
} from "./types.js";

export { escapeHtml };

export function joinHtml(chunks: string[]): string {
  return chunks.filter((chunk) => chunk.length > 0).join("");
}

export function renderStatusPill(value: string, tone: CommanderConsoleStatusTone = "ok"): string {
  return `<span class="cc-pill cc-pill-${tone}">${escapeHtml(value)}</span>`;
}

export function renderSummaryList(items: CommanderConsoleSummaryItem[]): string {
  return `<dl class="cc-summary-list">${items.map((item) => `
    <div class="cc-summary-row">
      <dt>${escapeHtml(item.label)}</dt>
      <dd>${renderStatusInline(item.value, item.tone)}</dd>
    </div>
  `).join("")}</dl>`;
}

export function renderStatusInline(value: string, tone?: CommanderConsoleStatusTone): string {
  if (!tone) {
    return `<span>${escapeHtml(value)}</span>`;
  }

  return `<span class="cc-inline-${tone}">${escapeHtml(value)}</span>`;
}

export function renderCard(title: string, eyebrow: string, body: string, actions = ""): string {
  return `<section class="cc-card">
    <header class="cc-card-header">
      <div>
        <p class="cc-eyebrow">${escapeHtml(eyebrow)}</p>
        <h3>${escapeHtml(title)}</h3>
      </div>
      ${actions}
    </header>
    ${body}
  </section>`;
}

export function renderEmptyState(text: string): string {
  return `<div class="cc-empty">${escapeHtml(text)}</div>`;
}

export function renderDataTable(headers: string[], rows: string[][], emptyText = "No data available."): string {
  if (rows.length === 0) {
    return renderEmptyState(emptyText);
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