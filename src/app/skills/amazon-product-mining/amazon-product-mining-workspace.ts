import { renderAmazonProductMiningKeywordHistory } from "./amazon-product-mining-keyword-history.js";
import { renderAmazonProductMiningInspectorTemplate } from "./amazon-product-mining-inspector.js";
import { renderAmazonProductMiningTaskPublish } from "./amazon-product-mining-task-publish.js";

export const renderAmazonProductMiningWorkspace = (): string => `
<section class="skill-workspace amazon-product-mining-workspace" data-skill-workspace="amazon-product-mining" data-job-panel="amazon-product-mining">
  <div class="skill-header">
    <div>
      <span class="eyebrow">Level 2 Skill Workspace</span>
      <h1>Amazon Product Mining</h1>
      <p>Keyword evidence packages and keyword-level opportunity reviews. Business verdicts are displayed from persisted backend records only.</p>
    </div>
    <div class="skill-header-actions">
      <span class="status-badge status-running" data-amazon-product-mining-status>-</span>
      <span class="status-badge status-insufficient" data-amazon-product-mining-task-id>-</span>
    </div>
  </div>
  <div class="workspace-grid">
    <div class="workspace-side">
      ${renderAmazonProductMiningTaskPublish()}
      <section class="panel latest-task-summary-card" data-amazon-product-mining-latest-summary>
        <div class="panel-title-row">
          <div>
            <span class="eyebrow">Latest Task Summary Card</span>
            <h2>Latest task</h2>
          </div>
          <span class="status-badge status-watch">read model</span>
        </div>
        <div class="summary-metrics" data-amazon-product-mining-results>
          <div><b data-amazon-product-mining-task-id>-</b><span>latest task id</span></div>
          <div><b data-amazon-product-mining-status>-</b><span>task status</span></div>
          <div><b data-amazon-product-mining-package>-</b><span>package/pdf ref</span></div>
        </div>
        <div class="state-stack">
          <div class="empty-state">No latest task loaded.</div>
          <div class="loading-state hidden">Loading latest task...</div>
          <div class="error-state hidden">Latest task failed to load. Retry from the command bar or task card.</div>
          <div class="manual-required-state hidden">manual_required task state will appear here.</div>
          <div class="failed-state hidden">failed task state will appear here.</div>
        </div>
      </section>
    </div>
    ${renderAmazonProductMiningKeywordHistory()}
  </div>
  ${renderAmazonProductMiningInspectorTemplate()}
</section>`;
