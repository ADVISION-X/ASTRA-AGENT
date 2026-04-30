import type { CommanderAppViewModel } from "../commander-app.types.js";
import type { CommanderConsoleShellCopy } from "../commander-console.copy.js";
import { escapeHtml } from "../render-utils.js";
import { renderDeveloperModeGate } from "./DeveloperModeGate.js";

export function renderLeftSidebar(appViewModel: CommanderAppViewModel, copy: CommanderConsoleShellCopy): string {
  const navItems = appViewModel.navItems.map((item) => {
    const copyEntry = copy.nav[item.pageId];
    const hidden = item.requiresDeveloperMode ? ' data-developer-nav="hidden" hidden="hidden"' : "";

    return `<button type="button" class="cc-sidebar-nav-item${item.pageId === appViewModel.initialPageId ? " is-active" : ""}" data-nav-page="${escapeHtml(item.pageId)}"${hidden}>
      <span class="cc-sidebar-nav-label">${escapeHtml(copyEntry.label)}</span>
      <small class="cc-sidebar-nav-helper">${escapeHtml(copyEntry.helper)}</small>
    </button>`;
  }).join("");

  return `<aside class="cc-left-sidebar">
    <div class="cc-sidebar-header">
      <p class="cc-eyebrow">${escapeHtml(copy.navigationTitle)}</p>
      <p class="cc-muted">${escapeHtml(copy.navigationHint)}</p>
    </div>
    <nav class="cc-sidebar-nav" aria-label="Commander Mac navigation" data-primary-nav>${navItems}</nav>
    ${renderDeveloperModeGate(copy.developerModeHint)}
  </aside>`;
}