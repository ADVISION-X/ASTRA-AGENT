import { renderDeepResearchPanel } from "../workbench-deep-research-panel.js";
import { renderAmazonProductMiningWorkspace } from "../skills/amazon-product-mining/amazon-product-mining-workspace.js";
import { renderMediaOptimizerWorkspace } from "../skills/media-optimizer/media-optimizer-workspace.js";
import { renderAmazonInvoiceWorkspace } from "./amazon-invoice-workspace.js";
import { renderXuanxueAiProductionWorkspace } from "./xuanxue-ai-production-workspace.js";

export const renderMainWorkspace = (): string => `
<main class="workspace" data-app-shell-workspace data-workspace-page-nav="registered-skills" data-workspace-surface="registered-skills">
  ${renderAmazonProductMiningWorkspace()}
  <section class="skill-workspace hidden" data-skill-workspace="deep-research-analysis" data-job-panel="deep-research">
    ${renderDeepResearchPanel()}
  </section>
  ${renderMediaOptimizerWorkspace()}
  ${renderAmazonInvoiceWorkspace()}
  ${renderXuanxueAiProductionWorkspace()}
</main>`;
