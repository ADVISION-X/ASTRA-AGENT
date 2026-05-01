import type { CommanderMissionDashboardView } from "../../capabilities/commander-console/index.js";
import type { Locale } from "../../lib/localization/dictionaries.js";

import { buildCommanderAppPageHtmlMap } from "./CommanderAppRouter.js";
import { buildCommanderAppViewModel } from "./commander-app.view-model.js";
import { buildCommanderConsoleViewModel } from "./commander-console-view-model.js";
import { renderInspectError } from "./inspect/InspectError.js";
import { renderInspectItemHtml } from "./inspect/renderInspectItemHtml.js";

export function buildCommanderShellRenderState(input: {
  dashboard: CommanderMissionDashboardView;
  locale: Locale;
  initialPageId?: string | null;
}) {
  const viewModel = buildCommanderConsoleViewModel(input.dashboard, input.locale);
  const appViewModel = buildCommanderAppViewModel(viewModel, { initialPageId: input.initialPageId ?? null });
  const pageHtmlMap = buildCommanderAppPageHtmlMap(viewModel, appViewModel);
  const inspectHtmlMap = Object.fromEntries(viewModel.inspectItems.map((item) => [`${item.kind}:${item.id}`, renderInspectItemHtml(item)]));
  const primaryError = appViewModel.actionableErrors.find((item) => item.tone !== "ok") ?? null;
  if (primaryError) {
    inspectHtmlMap["error:current"] = renderInspectError(primaryError);
  }
  return { viewModel, appViewModel, pageHtmlMap, inspectHtmlMap };
}