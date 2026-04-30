import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderCard } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";

export function renderStructuredLogList(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const logs = viewModel.runtimeProofTimeline.slice(0, 8);

  return renderCard(
    t("结构化日志", "Structured Logs"),
    t("只在健康页显示", "Health Only"),
    logs.length === 0
      ? `<div class="cc-empty">${escapeHtml(t("当前没有结构化日志。", "No structured logs are available right now."))}</div>`
      : `<div class="cc-mini-list">${logs.map((entry, index) => `<button type="button" class="cc-list-row cc-list-row-button" data-inspect-kind="round" data-inspect-id="${escapeHtml(`${entry.step}-${index}`)}">
          <div>
            <strong>${escapeHtml(entry.message)}</strong>
            <small>${escapeHtml(entry.createdAt)} · ${escapeHtml(entry.status)}</small>
          </div>
          <span>${escapeHtml(t("详情", "Detail"))}</span>
        </button>`).join("")}</div>`,
  );
}