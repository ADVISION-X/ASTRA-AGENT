import { escapeHtml } from "../../lib/local-app-shell/render-helpers.js";

import type {
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