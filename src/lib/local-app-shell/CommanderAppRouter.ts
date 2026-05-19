import type { CommanderAppPageId, CommanderAppViewModel } from "./commander-app.types.js";
import { renderHomeStartPage } from "./pages/HomeStartPage.js";
import { renderAmazonInvoiceUploadPage } from "./pages/AmazonInvoiceUploadPage.js";
import { renderSettingsPage } from "./pages/AiProviderSettingsPage.js";
import { renderMissionPage } from "./pages/MissionPage.js";
import { renderResultsPage } from "./pages/ResultsPage.js";
import { renderReviewPage } from "./pages/ReviewPage.js";
import { renderHealthPage } from "./pages/HealthPage.js";
import type { CommanderConsoleViewModel } from "./types.js";
import { escapeHtml } from "./render-utils.js";

export function buildCommanderAppPageHtmlMap(viewModel: CommanderConsoleViewModel, appViewModel: CommanderAppViewModel): Record<CommanderAppPageId, string> {
  return {
    home: renderHomeStartPage(viewModel, appViewModel),
    "amazon-invoice-upload": renderAmazonInvoiceUploadPage(viewModel, appViewModel),
    mission: renderMissionPage(viewModel, appViewModel),
    results: renderResultsPage(viewModel, appViewModel),
    review: renderReviewPage(viewModel, appViewModel),
    settings: renderSettingsPage(viewModel, appViewModel),
    health: renderHealthPage(viewModel, appViewModel),
  };
}

export function renderCommanderAppRouter(appViewModel: CommanderAppViewModel, initialPageHtml: string): string {
  return `<section class="cc-app-router" data-app-router data-active-page="${escapeHtml(appViewModel.initialPageId)}"><div class="cc-app-page-host" data-app-page-host>${initialPageHtml}</div></section>`;
}
