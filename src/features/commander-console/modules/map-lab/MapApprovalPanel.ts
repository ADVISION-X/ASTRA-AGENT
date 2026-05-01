import type { CommanderConsoleViewModel } from "../../types.js";
import { localizeCommanderText } from "../../locale.js";
import { renderDataTable } from "../../render-advanced-utils.js";
import { joinHtml, renderCard } from "../../render-utils.js";

export function renderMapApprovalPanel(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const table = renderDataTable(
    [t("地图", "Map"), t("状态", "Status"), t("摘要", "Summary")],
    viewModel.availableMaps.map((map) => [map.mapId, map.approvalStatus, map.summary]),
    t("当前没有审批记录。", "No data available."),
  );

  return joinHtml([
    `<div class="cc-span-12">`,
    renderCard(t("地图批准面板", "Map Approval Panel"), t("地图实验室", "Map Lab"), table),
    `</div>`,
  ]);
}