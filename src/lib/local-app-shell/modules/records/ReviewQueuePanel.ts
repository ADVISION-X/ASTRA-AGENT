import type { CommanderConsoleViewModel } from "../../types.js";
import { localizeCommanderText } from "../../locale.js";
import { escapeHtml, joinHtml, renderCard } from "../../render-utils.js";

export function renderReviewQueuePanel(viewModel: CommanderConsoleViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);
  const pendingCandidates = viewModel.rawSnapshot.candidates.filter((candidate) => candidate.reviewStatus === "pending").slice(0, 4);
  const body = pendingCandidates.length === 0
    ? `<div class="cc-empty">${escapeHtml(t("当前没有待复核项目。", "There is nothing waiting for review right now."))}</div>`
    : `<div class="cc-stack">${pendingCandidates.map((candidate) => `
        <article class="cc-review-item">
          <div>
            <h4>${escapeHtml(candidate.useCase)}</h4>
            <p class="cc-note">${escapeHtml(candidate.category)} · ${escapeHtml(t(`${candidate.evidenceCount} 条证据`, `${candidate.evidenceCount} evidence`))}</p>
          </div>
          <div class="cc-inline-actions">
            <button type="button" class="cc-inline-button" data-inspect-kind="record" data-inspect-id="${escapeHtml(candidate.id)}">${escapeHtml(t("检查", "Inspect"))}</button>
          </div>
        </article>
      `).join("")}</div>`;

  return joinHtml([
    `<div class="cc-span-5">`,
    renderCard(t("Review Queue", "Review Queue"), t("复核队列", "Review Queue"), body),
    `</div>`,
  ]);
}