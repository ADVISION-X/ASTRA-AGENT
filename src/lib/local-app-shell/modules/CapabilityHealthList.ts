import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderCard, renderStatusPill } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";

export function renderCapabilityHealthList(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);

  return renderCard(
    t("能力健康", "Capability Health"),
    t("健康页", "Health"),
    `<div class="cc-mini-list">${viewModel.capabilityHealth.map((entry, index) => `<button type="button" class="cc-list-row cc-list-row-button" data-inspect-kind="health" data-inspect-id="${escapeHtml(`health-${index}`)}">
      <div>
        <strong>${escapeHtml(entry.label)}</strong>
        <small>${escapeHtml(entry.detail)}</small>
      </div>
      ${renderStatusPill(entry.tone === "danger" ? t("阻断", "Blocked") : entry.tone === "warn" ? t("注意", "Attention") : t("正常", "Healthy"), entry.tone === "danger" ? "blocked" : entry.tone === "warn" ? "attention" : "ok")}
    </button>`).join("")}</div>`,
  );
}