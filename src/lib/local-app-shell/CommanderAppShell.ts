import { escapeHtml, safeJsonScript } from "./render-helpers.js";

import { renderCommanderAppRouter } from "./CommanderAppRouter.js";
import { buildCommanderShellRenderState } from "./commander-shell-render-state.js";
import { appRunLimitSettingsClient, commanderConsoleShellClient, mapLabClient } from "./clients/index.js";
import { renderAppFrame, renderBottomNav, renderCompactStatusBar, renderInspectModal } from "./layout/index.js";
import { commanderConsoleStyles } from "./styles/commander-console-styles.js";
import type { AppRunLimitSettings } from "./types.js";
import type { CommanderMissionDashboardView } from "./commander-console-dashboard.types.js";

type CommanderAppShellInput = {
  dashboard: CommanderMissionDashboardView;
  appRunLimitSettings: AppRunLimitSettings;
};
type CommanderAppShellLocale = Parameters<typeof buildCommanderShellRenderState>[0]["locale"];

function renderCommanderAppShell(input: CommanderAppShellInput, options: {
  locale: CommanderAppShellLocale;
  requestUrl: URL;
}): string {
  const { viewModel, appViewModel, pageHtmlMap, inspectHtmlMap } = buildCommanderShellRenderState({
    dashboard: input.dashboard,
    locale: options.locale,
    appRunLimitSettings: input.appRunLimitSettings,
    userRequirementHistory: [],
  });

  const appFrame = renderAppFrame({
    statusBar: renderCompactStatusBar(viewModel, appViewModel),
    router: renderCommanderAppRouter(appViewModel, pageHtmlMap[appViewModel.initialPageId]),
    bottomNav: renderBottomNav(appViewModel, viewModel),
  });

  return `<!doctype html>
<html lang="${options.locale === "zh" ? "zh-CN" : "en"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(viewModel.appTitle)}</title>
    <style>${commanderConsoleStyles}</style>
  </head>
  <body class="cc-theme-compact-app">
    ${appFrame}
    ${renderInspectModal(viewModel)}
    <div class="cc-toast" data-cc-toast></div>
    <script>window.__grasseyeCommanderConsoleViewModel = ${safeJsonScript(viewModel)};</script>
    <script>window.__grasseyeCommanderAppViewModel = ${safeJsonScript(appViewModel)};</script>
    <script>window.__grasseyeCommanderConsolePageHtml = ${safeJsonScript(pageHtmlMap)};</script>
    <script>window.__grasseyeCommanderConsoleInspectHtml = ${safeJsonScript(inspectHtmlMap)};</script>
    <script>${commanderConsoleShellClient}</script>
    <script>${mapLabClient}</script>
    <script>${appRunLimitSettingsClient}</script>
  </body>
</html>`;
}

export { renderCommanderAppShell };
