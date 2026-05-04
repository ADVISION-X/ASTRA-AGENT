import type { CommanderAppViewModel } from "../commander-app.types.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { escapeHtml } from "../render-utils.js";

export function renderBottomNav(appViewModel: CommanderAppViewModel, viewModel: CommanderConsoleViewModel): string {
  const navItems = appViewModel.navItems.map((item) => {
    return `<button type="button" class="cc-bottom-nav-item${item.pageId === appViewModel.initialPageId ? " is-active" : ""}" data-nav-page="${escapeHtml(item.pageId)}">
      <span>${escapeHtml(item.shortLabel)}</span>
      <small>${escapeHtml(item.label)}</small>
    </button>`;
  }).join("");

  return `<nav class="cc-bottom-nav" aria-label="Commander app navigation" data-bottom-nav data-locale="${escapeHtml(viewModel.locale)}">${navItems}</nav>`;
}
