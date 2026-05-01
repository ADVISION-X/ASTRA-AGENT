import { escapeHtml } from "../render-utils.js";

export function renderMainWorkspace(title: string, router: string): string {
  return `<main class="cc-main-workspace">
    <div class="cc-main-workspace-header">
      <p class="cc-eyebrow">${escapeHtml(title)}</p>
    </div>
    <div class="cc-main-workspace-body">${router}</div>
  </main>`;
}