import type { CommanderConsoleViewModel } from "../../types.js";
import { localizeCommanderText } from "../../locale.js";
import { renderDataTable } from "../../render-advanced-utils.js";
import { joinHtml, renderCard } from "../../render-utils.js";

export function renderMapValidationPanel(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const table = renderDataTable(
    [t("检查项", "Check"), t("状态", "Status"), t("说明", "Detail")],
    viewModel.preflightSummary.map((check) => [check.label, check.status, check.detail]),
    t("当前没有校验记录。", "No data available."),
  );

  return joinHtml([
    `<div class="cc-span-6">`,
    renderCard(t("地图校验面板", "Map Validation Panel"), t("地图实验室", "Map Lab"), table),
    `</div>`,
  ]);
}