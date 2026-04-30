import type { CommanderConsoleViewModel } from "../../types.js";

import { renderTaskTemplateLauncher } from "../command/TaskTemplateLauncher.js";
import { renderActionableErrorCard } from "../debug/ActionableErrorCard.js";
import { renderDebugDrilldown } from "../debug/DebugDrilldown.js";
import { renderMissionCockpit } from "../mission/MissionCockpit.js";
import { renderResultSummary } from "../records/ResultSummary.js";
import { renderReviewQueuePanel } from "../records/ReviewQueuePanel.js";

export function renderNormalMode(viewModel: CommanderConsoleViewModel): string {
  return `<section class="cc-mode-surface" data-mode-surface="normal">
    <div class="cc-page-grid cc-dashboard-grid">
      ${renderTaskTemplateLauncher(viewModel)}
      ${renderResultSummary(viewModel)}
      ${renderMissionCockpit(viewModel)}
      ${renderReviewQueuePanel(viewModel)}
      ${renderActionableErrorCard(viewModel)}
      ${renderDebugDrilldown(viewModel)}
    </div>
  </section>`;
}