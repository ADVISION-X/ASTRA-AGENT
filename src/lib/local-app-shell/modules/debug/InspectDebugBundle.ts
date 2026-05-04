import type { CommanderConsoleViewModel } from "../../types.js";
import { localizeCommanderText } from "../../locale.js";
import { renderInspectButton } from "../../render-advanced-utils.js";

export function renderInspectDebugBundle(viewModel: CommanderConsoleViewModel, kind: "round" | "health" = "round"): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  if (kind === "round" && viewModel.runtimeProofTimeline[0]) {
    return renderInspectButton("round", `${viewModel.runtimeProofTimeline[0].step}-0`, t("查看详情", "Inspect Detail"));
  }

  if (viewModel.capabilityHealth[0]) {
    return renderInspectButton("health", viewModel.capabilityHealth[0].id, t("查看详情", "Inspect Detail"));
  }

  return `<button type="button" class="cc-button" data-nav-page="health">${t("打开诊断", "Open Diagnostics")}</button>`;
}
