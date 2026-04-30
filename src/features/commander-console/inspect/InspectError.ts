import { escapeHtml, renderJsonBlock } from "../render-utils.js";
import type { ActionableErrorView } from "../view-helpers.js";

export function renderInspectError(item: ActionableErrorView): string {
  return `<div class="cc-stack"><article class="cc-detail-block"><strong>${escapeHtml(item.title)}</strong><p class="cc-note">${escapeHtml(item.whatHappened)}</p><p class="cc-note">${escapeHtml(item.why)}</p><p class="cc-note">${escapeHtml(item.nextAction)}</p><p class="cc-note">${escapeHtml(item.owner)}</p></article>${renderJsonBlock(item)}</div>`;
}