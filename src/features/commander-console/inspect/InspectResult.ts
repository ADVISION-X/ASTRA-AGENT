import { escapeHtml, renderJsonBlock } from "../render-utils.js";
import type { CommanderConsoleInspectItem } from "../types.js";

export function renderInspectResult(item: CommanderConsoleInspectItem): string {
  return `<div class="cc-stack"><p class="cc-note">${escapeHtml(item.summary)}</p>${renderJsonBlock(item.json)}</div>`;
}