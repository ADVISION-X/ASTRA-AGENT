import type { CommanderMissionDashboardView } from "../../capabilities/commander-console/index.js";
import type { Locale } from "../../lib/localization/dictionaries.js";
import { escapeHtml, safeJsonScript } from "../../lib/local-app-shell/render-helpers.js";

import { buildCommanderAppPageHtmlMap, renderCommanderAppRouter } from "./CommanderAppRouter.js";
import { buildCommanderAppViewModel } from "./commander-app.view-model.js";
import { commanderConsoleShellClient } from "./commander-console-shell-client.js";
import { buildCommanderConsoleViewModel } from "./commander-console-view-model.js";
import { renderInspectDebugBundlePanel } from "./inspect/InspectDebugBundle.js";
import { renderInspectDeveloperRefs } from "./inspect/InspectDeveloperRefs.js";
import { renderInspectError } from "./inspect/InspectError.js";
import { renderInspectMission } from "./inspect/InspectMission.js";
import { renderInspectResult } from "./inspect/InspectResult.js";
import { renderInspectTask } from "./inspect/InspectTask.js";
import { renderAppFrame } from "./layout/AppFrame.js";
import { renderBottomNav } from "./layout/BottomNav.js";
import { renderCompactStatusBar } from "./layout/CompactStatusBar.js";
import { renderInspectModal } from "./layout/InspectModal.js";
import { commanderConsoleStyles } from "./styles/commander-console-styles.js";
import type { CommanderConsoleInspectItem } from "./types.js";

function renderInspectItemHtml(item: CommanderConsoleInspectItem): string {
  if (item.kind === "map") {
    return renderInspectTask(item);
  }
  if (item.kind === "mission") {
    return renderInspectMission(item);
  }
  if (item.kind === "round" || item.kind === "log") {
    return renderInspectDebugBundlePanel(item);
  }
  if (item.kind === "evidence" || item.kind === "record" || item.kind === "export") {
    return renderInspectResult(item);
  }
  return renderInspectDeveloperRefs(item);
}

export function renderCommanderAppShell(dashboard: CommanderMissionDashboardView, options: {
  locale: Locale;
  requestUrl: URL;
}): string {
  const viewModel = buildCommanderConsoleViewModel(dashboard, options.locale);
  const appViewModel = buildCommanderAppViewModel(viewModel);
  const pageHtmlMap = buildCommanderAppPageHtmlMap(viewModel, appViewModel);
  const inspectHtmlMap = Object.fromEntries(viewModel.inspectItems.map((item) => [`${item.kind}:${item.id}`, renderInspectItemHtml(item)]));
  const primaryError = appViewModel.actionableErrors.find((item) => item.tone !== "ok") ?? null;
  if (primaryError) {
    inspectHtmlMap["error:current"] = renderInspectError(primaryError);
  }

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