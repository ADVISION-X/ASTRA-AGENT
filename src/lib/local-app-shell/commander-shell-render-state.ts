import { buildCommanderAppPageHtmlMap } from "./CommanderAppRouter.js";
import { buildCommanderAppViewModel } from "./commander-app.view-model.js";
import { buildCommanderConsoleViewModel } from "./commander-console-view-model.js";
import { renderInspectError } from "./inspect/InspectError.js";
import { renderInspectItemHtml } from "./inspect/renderInspectItemHtml.js";

type CommanderShellDashboard = Parameters<typeof buildCommanderConsoleViewModel>[0];
type CommanderShellLocale = Parameters<typeof buildCommanderConsoleViewModel>[1];

export function buildCommanderShellRenderState(input: {
  dashboard: CommanderShellDashboard;
  locale: CommanderShellLocale;
  appRunLimitSettings: Parameters<typeof buildCommanderConsoleViewModel>[2];
  initialPageId?: string | null;
}) {
  const viewModel = buildCommanderConsoleViewModel(input.dashboard, input.locale, input.appRunLimitSettings);
  const appViewModel = buildCommanderAppViewModel(viewModel, { initialPageId: input.initialPageId ?? null });
  const pageHtmlMap = buildCommanderAppPageHtmlMap(viewModel, appViewModel);
  const inspectHtmlMap = Object.fromEntries(viewModel.inspectItems.map((item) => [`${item.kind}:${item.id}`, renderInspectItemHtml(item)]));
  const primaryError = appViewModel.actionableErrors.find((item) => item.tone !== "ok") ?? null;
  if (primaryError) {
    inspectHtmlMap["error:current"] = renderInspectError(primaryError);
  }
  return { viewModel, appViewModel, pageHtmlMap, inspectHtmlMap };
}