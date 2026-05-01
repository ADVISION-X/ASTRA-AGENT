import type { CommanderAppViewModel } from "../commander-app.types.js";
import type { CommanderConsoleShellCopy } from "../commander-console.copy.js";
import type { CommanderConsoleViewModel } from "../types.js";

import { renderLeftSidebar } from "./LeftSidebar.js";
import { renderMacTitleBar } from "./MacTitleBar.js";
import { renderMacToolbar } from "./MacToolbar.js";
import { renderMainWorkspace } from "./MainWorkspace.js";
import { renderRuntimeStatusStrip } from "./RuntimeStatusStrip.js";

function renderMacShellHeader(
  viewModel: CommanderConsoleViewModel,
  appViewModel: CommanderAppViewModel,
  copy: CommanderConsoleShellCopy,
  locale: "zh" | "en",
): string {
  return `${renderMacTitleBar(copy.windowTitle, copy.windowSubtitle, locale)}
    ${renderMacToolbar(viewModel, appViewModel)}`;
}

function renderMacShellBody(
  appViewModel: CommanderAppViewModel,
  copy: CommanderConsoleShellCopy,
  routerHtml: string,
): string {
  return `<div class="cc-mac-body">
      ${renderLeftSidebar(appViewModel, copy)}
      ${renderMainWorkspace(copy.workspaceTitle, routerHtml)}
    </div>`;
}

export function renderMacShellFrame(
  input: {
    viewModel: CommanderConsoleViewModel;
    appViewModel: CommanderAppViewModel;
    copy: CommanderConsoleShellCopy;
    locale: "zh" | "en";
    routerHtml: string;
  },
): string {
  return `<div class="cc-mac-shell" data-app-shell>
    ${renderMacShellHeader(input.viewModel, input.appViewModel, input.copy, input.locale)}
    ${renderMacShellBody(input.appViewModel, input.copy, input.routerHtml)}
    ${renderRuntimeStatusStrip(input.viewModel, input.copy.runtimeStripLabel, input.copy.runtimeStripHint)}
  </div>`;
}