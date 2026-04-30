import type { CommanderConsolePageView } from "../types.js";
import { escapeHtml } from "../render-utils.js";

import { renderSecondaryTabBar } from "./SecondaryTabBar.js";

export function renderPageFrame(page: CommanderConsolePageView, active: boolean, activeTabId: string, content: string): string {
  return `<section class="cc-page${active ? " is-active" : ""}" data-page="${escapeHtml(page.id)}"${active ? "" : ' hidden="hidden"'}>
    <header class="cc-page-header">
      <div>
        <p class="cc-eyebrow">${escapeHtml(page.eyebrow)}</p>
        <h2>${escapeHtml(page.label)}</h2>
        <p>${escapeHtml(page.description)}</p>
      </div>
    </header>
    ${renderSecondaryTabBar(page.id, page.tabs, activeTabId)}
    <div class="cc-page-grid">
      ${content}
    </div>
  </section>`;
}