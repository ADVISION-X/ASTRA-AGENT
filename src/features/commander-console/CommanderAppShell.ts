import type { CommanderMissionDashboardView } from "../../capabilities/commander-console/index.js";
import type { Locale } from "../../lib/localization/dictionaries.js";
import { escapeHtml, safeJsonScript } from "../../lib/local-app-shell/render-helpers.js";

import { renderCommanderAppRouter } from "./CommanderAppRouter.js";
import { buildCommanderShellRenderState } from "./commander-shell-render-state.js";
import { commanderConsoleShellClient } from "./commander-console-shell-client.js";
import { renderAppFrame } from "./layout/AppFrame.js";
import { renderBottomNav } from "./layout/BottomNav.js";
import { renderCompactStatusBar } from "./layout/CompactStatusBar.js";
import { renderInspectModal } from "./layout/InspectModal.js";
import { commanderConsoleStyles } from "./styles/commander-console-styles.js";

function renderCommanderAppShell(dashboard: CommanderMissionDashboardView, options: {
  locale: Locale;
  requestUrl: URL;
}): string {
  const { viewModel, appViewModel, pageHtmlMap, inspectHtmlMap } = buildCommanderShellRenderState({
    dashboard,
    locale: options.locale,
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
  </body>
</html>`;
}

export { renderCommanderAppShell };
