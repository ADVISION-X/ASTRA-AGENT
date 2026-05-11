import { localizeCommanderText } from "../locale.js";
import { escapeHtml, renderCard } from "../render-utils.js";
import type { CommanderConsoleViewModel } from "../types.js";
import { canStopMission } from "../view-helpers.js";

export function renderReviewSummaryCard(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const pendingCandidates = viewModel.rawSnapshot.candidates.filter((candidate) => candidate.reviewStatus === "pending").slice(0, 4);
  const stopAvailable = canStopMission(viewModel);

  return renderCard(
    t("人工复核", "Review Queue"),
    t("只处理复核", "Review Only"),
    pendingCandidates.length === 0
      ? `<div class="cc-empty">${escapeHtml(t("当前没有待复核项目。", "There is nothing waiting for review right now."))}</div>`
      : `<div class="cc-mini-list">${pendingCandidates.map((candidate) => `<article class="cc-list-row">
          <div>
            <strong>${escapeHtml(candidate.useCase)}</strong>
            <small>${escapeHtml(candidate.category)} · ${escapeHtml(t(`${candidate.evidenceCount} 条证据`, `${candidate.evidenceCount} evidence`))}</small>
          </div>
          <div class="cc-inline-actions">
            <button type="button" class="cc-inline-button" data-inspect-kind="record" data-inspect-id="${escapeHtml(candidate.id)}">${escapeHtml(t("检查", "Inspect"))}</button>
          </div>
        </article>`).join("")}</div>`,
    `<button type="button" class="cc-button cc-button-tight" data-command-action="stop-mission"${stopAvailable ? "" : ' disabled="disabled"'}>${escapeHtml(t("停止任务", "Stop Mission"))}</button>`,
  );
}