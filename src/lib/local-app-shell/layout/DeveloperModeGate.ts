import { escapeHtml } from "../render-utils.js";

export function renderDeveloperModeGate(note: string): string {
  return `<p class="cc-sidebar-note">${escapeHtml(note)}</p>`;
}