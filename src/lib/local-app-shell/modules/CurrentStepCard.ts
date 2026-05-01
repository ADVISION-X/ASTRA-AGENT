import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderCard } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { buildHumanStepDetail, buildHumanStepLabel } from "../view-helpers.js";

export function renderCurrentStepCard(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const latestEvents = viewModel.runtimeProofTimeline.slice(0, 3);

  return renderCard(
    t("当前步骤", "Current Step"),
    t("人话解释", "Human Summary"),
    `<div class="cc-stack">
      <article class="cc-detail-block">
        <strong>${escapeHtml(buildHumanStepLabel(viewModel))}</strong>
        <p class="cc-note">${escapeHtml(buildHumanStepDetail(viewModel))}</p>
      </article>
      <div class="cc-mini-list">
        ${latestEvents.map((entry, index) => `<button type="button" class="cc-list-row cc-list-row-button" data-inspect-kind="round" data-inspect-id="${escapeHtml(`${entry.step}-${index}`)}">
          <div>
            <strong>${escapeHtml(entry.message)}</strong>
            <small>${escapeHtml(entry.createdAt)} · ${escapeHtml(entry.status)}</small>
          </div>
          <span>${escapeHtml(t("检查", "Inspect"))}</span>
        </button>`).join("")}
      </div>
    </div>`,
  );
}