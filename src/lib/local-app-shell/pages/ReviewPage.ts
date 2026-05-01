import type { CommanderAppViewModel } from "../commander-app.types.js";
import { localizeCommanderText } from "../locale.js";
import { renderPageHeader } from "../layout/PageHeader.js";
import { renderReviewSummaryCard } from "../modules/ReviewSummaryCard.js";
import type { CommanderConsoleViewModel } from "../types.js";

export function renderReviewPage(viewModel: CommanderConsoleViewModel, _appViewModel: CommanderAppViewModel): string {
  const t = (zh: string, en: string) => localizeCommanderText(viewModel.locale, zh, en);

  return `<section class="cc-page" data-app-page="review" data-review-page>
    ${renderPageHeader(t("复核", "Review"), t("只处理待复核对象、证据摘要和人工决定。", "Review handles pending items, evidence summaries, and human decisions only."))}
    <div class="cc-page-stack">${renderReviewSummaryCard(viewModel)}</div>
  </section>`;
}