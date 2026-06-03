import { renderAmazonProductMiningKeywordHistory } from "./amazon-product-mining-keyword-history.js";
import { renderAmazonProductMiningInspectorTemplate } from "./amazon-product-mining-inspector.js";
import { renderAmazonProductMiningTaskPublish } from "./amazon-product-mining-task-publish.js";

const renderAmazonProductMiningLatestTaskSurface = (): string => `
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
    <div><b data-amazon-product-mining-keyword-count>-</b><span>keywords</span></div>
    <div><b data-amazon-product-mining-search-result-count>-</b><span>search results</span></div>
    <div><b data-amazon-product-mining-product-detail-count>-</b><span>product details</span></div>
    <div><b data-amazon-product-mining-review-count>-</b><span>reviews</span></div>
    <div><b data-amazon-product-mining-keyword-review-count>-</b><span>keyword reviews</span></div>
    <div><b data-amazon-product-mining-package>-</b><span>package/pdf ref</span></div>
  </div>
  <div class="state-stack">
    <div class="empty-state" data-amazon-product-mining-latest-state="empty">No latest task loaded.</div>
    <div class="loaded-state hidden" data-amazon-product-mining-latest-state="loaded">Live task read model loaded.</div>
    <div class="loading-state hidden" data-amazon-product-mining-latest-state="loading">Loading latest task...</div>
    <div class="error-state hidden" data-amazon-product-mining-latest-state="error">Latest task failed to load. Retry from the command bar or task card.</div>
    <div class="failed-state hidden" data-amazon-product-mining-latest-state="failed">failed task state will appear here.</div>
  </div>
</section>`;

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
  <nav class="skill-page-nav" data-amazon-product-mining-page-nav aria-label="Amazon Product Mining pages">
    <button class="skill-page-tab" type="button" data-amazon-product-mining-page="history" aria-pressed="true">Review History</button>
    <button class="skill-page-tab" type="button" data-amazon-product-mining-page="publish" aria-pressed="false">New Task</button>
    <button class="skill-page-tab" type="button" data-amazon-product-mining-page="latest" aria-pressed="false">Latest Task</button>
  </nav>
  <div class="skill-page-stack" data-amazon-product-mining-page-stack>
    <div class="skill-page-surface history-surface" data-amazon-product-mining-surface="history">
      ${renderAmazonProductMiningKeywordHistory()}
    </div>
    <div class="skill-page-surface publish-surface hidden" data-amazon-product-mining-surface="publish">
      ${renderAmazonProductMiningTaskPublish()}
    </div>
    <div class="skill-page-surface latest-surface hidden" data-amazon-product-mining-surface="latest">
      ${renderAmazonProductMiningLatestTaskSurface()}
    </div>
  </div>
  ${renderAmazonProductMiningInspectorTemplate()}
</section>`;
