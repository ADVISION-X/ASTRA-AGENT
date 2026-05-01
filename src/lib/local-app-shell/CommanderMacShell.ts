import { escapeHtml, safeJsonScript } from "./render-helpers.js";

import { renderCommanderAppRouter } from "./CommanderAppRouter.js";
import { buildCommanderShellRenderState } from "./commander-shell-render-state.js";
import { buildCommanderConsoleShellCopy } from "./commander-console.copy.js";
import { commanderConsoleShellClient } from "./commander-console-shell-client.js";
import { renderMacShellFrame } from "./layout/MacShellFrame.js";
import { renderRightInspector } from "./layout/RightInspector.js";
import { commanderConsoleStyles } from "./styles/commander-console-styles.js";

type CommanderMacShellInput = Parameters<typeof buildCommanderShellRenderState>[0];
type CommanderMacShellDashboard = CommanderMacShellInput["dashboard"];
type CommanderMacShellLocale = CommanderMacShellInput["locale"];

function renderCommanderMacShell(dashboard: CommanderMacShellDashboard, options: {
  locale: CommanderMacShellLocale;
  requestUrl: URL;
}): string {
  const { viewModel, appViewModel, pageHtmlMap, inspectHtmlMap } = buildCommanderShellRenderState({
    dashboard,
    locale: options.locale,
    initialPageId: options.requestUrl.searchParams.get("page"),
  });
  const copy = buildCommanderConsoleShellCopy(options.locale);

  const router = renderCommanderAppRouter(appViewModel, pageHtmlMap[appViewModel.initialPageId]);
  const macShell = renderMacShellFrame({
    viewModel,
    appViewModel,
    copy,
    locale: options.locale,
    routerHtml: router,
  });

  return `<!doctype html>
<html lang="${options.locale === "zh" ? "zh-CN" : "en"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(viewModel.appTitle)}</title>
    <style>${commanderConsoleStyles}</style>
  </head>
  <body class="cc-theme-mac-shell">
    ${macShell}
    ${renderRightInspector(viewModel)}
    <div class="cc-toast" data-cc-toast></div>
    <script>window.__grasseyeCommanderConsoleViewModel = ${safeJsonScript(viewModel)};</script>
    <script>window.__grasseyeCommanderAppViewModel = ${safeJsonScript(appViewModel)};</script>
    <script>window.__grasseyeCommanderConsolePageHtml = ${safeJsonScript(pageHtmlMap)};</script>
    <script>window.__grasseyeCommanderConsoleInspectHtml = ${safeJsonScript(inspectHtmlMap)};</script>
    <script>${commanderConsoleShellClient}</script>
  </body>
</html>`;
}

export { renderCommanderMacShell };
