import { localizeCommanderText } from "../locale.js";
import { escapeHtml } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";

export function renderDebugDrilldownButton(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const latest = viewModel.runtimeProofTimeline[0];
  const inspectId = latest ? `${latest.step}-0` : "";

  return `<div class="cc-inline-actions">
    <button type="button" class="cc-button cc-button-tight" data-nav-page="health">${escapeHtml(t("打开健康页", "Open Health"))}</button>
    ${latest ? `<button type="button" class="cc-button cc-button-tight" data-inspect-kind="round" data-inspect-id="${escapeHtml(inspectId)}">${escapeHtml(t("打开调试包", "Open Debug Bundle"))}</button>` : ""}
  </div>`;
}