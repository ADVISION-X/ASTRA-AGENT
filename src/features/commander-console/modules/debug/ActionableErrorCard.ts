import type { CommanderConsoleViewModel } from "../../types.js";
import { localizeCommanderText } from "../../locale.js";
import { escapeHtml, joinHtml, renderCard, renderStatusPill } from "../../render-utils.js";
import { buildActionableErrors } from "../../view-helpers.js";
import { renderInspectDebugBundle } from "./InspectDebugBundle.js";

export function renderActionableErrorCard(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const items = buildActionableErrors(viewModel);
  const body = `<div class="cc-stack">${items.map((item) => `
    <article class="cc-actionable-error cc-tone-${item.tone}">
      <header class="cc-inline-actions">
        ${renderStatusPill(item.title, item.tone)}
        ${renderInspectDebugBundle(viewModel)}
      </header>
      <dl class="cc-detail-list">
        <div><dt>${escapeHtml(t("发生了什么", "What happened"))}</dt><dd>${escapeHtml(item.whatHappened)}</dd></div>
        <div><dt>${escapeHtml(t("为什么", "Why"))}</dt><dd>${escapeHtml(item.why)}</dd></div>
        <div><dt>${escapeHtml(t("该怎么办", "What to do"))}</dt><dd>${escapeHtml(item.nextAction)}</dd></div>
        <div><dt>${escapeHtml(t("责任模块", "Owner"))}</dt><dd>${escapeHtml(item.owner)}</dd></div>
      </dl>
    </article>
  `).join("")}</div>`;

  return joinHtml([
    `<div class="cc-span-7">`,
    renderCard(t("Actionable Error Card", "Actionable Error Card"), t("任务驾驶舱", "Mission Cockpit"), body),
    `</div>`,
  ]);
}