import { escapeHtml } from "./render-helpers.js";

import { renderCommanderMacShellScripts } from "./CommanderMacShellScripts.js";
import { renderCommanderAppRouter } from "./CommanderAppRouter.js";
import { buildCommanderShellRenderState } from "./commander-shell-render-state.js";
import { buildCommanderConsoleShellCopy } from "./commander-console.copy.js";
import { renderMacShellFrame } from "./layout/MacShellFrame.js";
import { renderRightInspector } from "./layout/RightInspector.js";
import { commanderConsoleStyles } from "./styles/commander-console-styles.js";
import type { AppRunLimitSettings } from "../local-runtime/app-run-limit-settings-types.js";
import type { CommanderConsoleViewModel } from "./types.js";
import type { CommanderMissionDashboardView } from "../../capabilities/commander-console/shared/commander-view-types.js";

type CommanderMacShellInput = {
  dashboard: CommanderMissionDashboardView;
  appRunLimitSettings: AppRunLimitSettings;
  userRequirementHistory: CommanderConsoleViewModel["userRequirementHistory"];
};
type CommanderMacShellLocale = Parameters<typeof buildCommanderShellRenderState>[0]["locale"];

function renderCommanderMacShell(input: CommanderMacShellInput, options: {
  locale: CommanderMacShellLocale;
  requestUrl: URL;
}): string {
  const { viewModel, appViewModel, pageHtmlMap, inspectHtmlMap } = buildCommanderShellRenderState({
    dashboard: input.dashboard,
    locale: options.locale,
    appRunLimitSettings: input.appRunLimitSettings,
    userRequirementHistory: input.userRequirementHistory,
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
  const scriptsHtml = renderCommanderMacShellScripts({
    viewModel,
    appViewModel,
    pageHtmlMap,
    inspectHtmlMap,
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
    ${scriptsHtml}
  </body>
</html>`;
}

export { renderCommanderMacShell };
