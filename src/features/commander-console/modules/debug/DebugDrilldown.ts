import type { CommanderConsoleViewModel } from "../../types.js";
import { localizeCommanderText } from "../../locale.js";
import { escapeHtml, joinHtml, renderCard } from "../../render-utils.js";
import { formatHealthStatus } from "../../view-helpers.js";
import { renderInspectDebugBundle } from "./InspectDebugBundle.js";

export function renderDebugDrilldown(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const latestEvents = viewModel.runtimeProofTimeline.slice(0, 4);
  const body = `<div class="cc-stack">
    <div class="cc-debug-summary-row">
      <div>
        <span>${escapeHtml(t("健康状态", "Health"))}</span>
        <strong>${escapeHtml(formatHealthStatus(viewModel))}</strong>
      </div>
      <div>
        <span>${escapeHtml(t("最近审计", "Latest audit"))}</span>
        <strong>${escapeHtml(viewModel.rawSnapshot.auditSummary.lastGeneratedAt ?? t("暂无", "none"))}</strong>
      </div>
      <div>
        <span>${escapeHtml(t("最近关键事件", "Latest key event"))}</span>
        <strong>${escapeHtml(latestEvents[0]?.message ?? t("暂无", "none"))}</strong>
      </div>
    </div>
    <div class="cc-compact-event-list">
      ${latestEvents.map((entry, index) => `<article class="cc-compact-event">
        <div>
          <strong>${escapeHtml(entry.message)}</strong>
          <p class="cc-note">${escapeHtml(entry.createdAt)} · ${escapeHtml(entry.status)}</p>
        </div>
        <div class="cc-inline-actions">
          <button type="button" class="cc-button" data-mode-toggle>${escapeHtml(t("更多调试", "More Debug"))}</button>
          <button type="button" class="cc-inline-button" data-inspect-kind="round" data-inspect-id="${escapeHtml(`${entry.step}-${index}`)}">${escapeHtml(t("检查", "Inspect"))}</button>
        </div>
      </article>`).join("")}
    </div>
    <div class="cc-inline-actions">
      ${renderInspectDebugBundle(viewModel)}
      <button type="button" class="cc-button" data-mode-toggle>${escapeHtml(t("打开开发者模式", "Open Developer Mode"))}</button>
    </div>
  </div>`;

  return joinHtml([
    `<div class="cc-span-12">`,
    renderCard(t("Debug Drilldown", "Debug Drilldown"), t("调试透明但不压迫", "Debug Without Pressure"), body),
    `</div>`,
  ]);
}