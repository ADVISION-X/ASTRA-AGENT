import type { CommanderConsoleViewModel } from "../../types.js";
import { localizeCommanderText } from "../../locale.js";
import { renderDataTable } from "../../render-advanced-utils.js";
import { joinHtml, renderCard } from "../../render-utils.js";

export function renderDraftMapPanel(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const table = renderDataTable(
    [t("地图", "Map"), t("门禁", "Automation Gate"), t("能力链", "Chain")],
    viewModel.availableMaps.map((map) => [map.title, map.activationGateStatus, map.chain.join(" -> ")]),
    t("当前没有地图草稿。", "No data available."),
  );

  return joinHtml([
    `<div class="cc-span-6">`,
    renderCard(t("地图草稿面板", "Draft Map Panel"), t("地图实验室", "Map Lab"), table),
    `</div>`,
  ]);
}