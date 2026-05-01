import { escapeHtml } from "../render-utils.js";

export function renderDeveloperToggle(label: string): string {
  return `<button type="button" class="cc-icon-button" data-mode-toggle>${escapeHtml(label)}</button>`;
}