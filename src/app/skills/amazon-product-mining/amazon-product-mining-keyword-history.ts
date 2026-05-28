const renderAmazonKeywordReviewFilters = (): string => `
<div class="filter-bar" data-amazon-product-mining-review-filters>
  <div class="field">
    <label>Decision</label>
    <select data-amazon-product-mining-review-filter>
      <option value="ALL">All</option>
      <option value="PASS">PASS</option>
      <option value="WATCH">WATCH</option>
      <option value="REJECT">REJECT</option>
      <option value="INSUFFICIENT_DATA">INSUFFICIENT_DATA</option>
    </select>
  </div>
  <div class="field">
    <label>Keyword search</label>
    <input data-amazon-product-mining-review-keyword-filter placeholder="Search keyword" />
  </div>
  <div class="field">
    <label>Marketplace</label>
    <select data-amazon-product-mining-review-marketplace-filter>
      <option value="ALL">All</option>
    </select>
  </div>
  <div class="field">
    <label>Task ID</label>
    <input data-amazon-product-mining-review-task-filter placeholder="Optional task ID" />
  </div>
  <div class="field">
    <label>Target market</label>
    <input data-amazon-product-mining-review-target-market-filter placeholder="Filter target market" />
  </div>
  <div class="field">
    <label>Human next step</label>
    <select data-amazon-product-mining-review-human-next-step-filter>
      <option value="ALL">All</option>
      <option value="enter_next_validation">enter_next_validation</option>
      <option value="mine_related_keywords">mine_related_keywords</option>
      <option value="reject">reject</option>
      <option value="rerun_or_collect_more_data">rerun_or_collect_more_data</option>
    </select>
  </div>
  <div class="field">
    <label>Data confidence</label>
    <select data-amazon-product-mining-review-data-confidence-filter>
      <option value="ALL">All</option>
      <option value="strong">strong</option>
      <option value="medium">medium</option>
      <option value="weak">weak</option>
      <option value="insufficient">insufficient</option>
    </select>
  </div>
  <div class="field">
    <label>Package integrity</label>
    <select data-amazon-product-mining-review-package-integrity-filter>
      <option value="ALL">All</option>
      <option value="pass">pass</option>
      <option value="failed">failed</option>
      <option value="not_available">not_available</option>
    </select>
  </div>
  <div class="field">
    <label>Sort</label>
    <select data-amazon-product-mining-review-sort>
      <option value="createdAt_desc">Created At desc</option>
      <option value="decision_priority">Decision priority</option>
      <option value="data_confidence">Data Confidence</option>
      <option value="review_count">Review Count</option>
      <option value="product_count">Product Count</option>
    </select>
  </div>
</div>`;

export const renderAmazonProductMiningKeywordHistory = (): string => `
<section class="panel history-panel" data-amazon-product-mining-review-history data-primary-history-surface>
  <div class="panel-title-row">
    <div>
      <span class="eyebrow">Primary History</span>
      <h2>Keyword Opportunity Review History</h2>
    </div>
    <button class="btn secondary" type="button" data-amazon-product-mining-refresh-reviews>Refresh</button>
  </div>
  ${renderAmazonKeywordReviewFilters()}
  <div class="history-state empty-state" data-amazon-product-mining-review-state>
    No keyword opportunity reviews yet. Run an Amazon product mining task and complete AI keyword review to populate this table.
  </div>
  <div class="history-table-shell">
    <table class="history-table">
      <thead>
        <tr>
          <th>Created At</th>
          <th>Keyword</th>
          <th>Decision</th>
          <th>Human Next Step</th>
          <th>Demand Signal</th>
          <th>Review Health</th>
          <th>Price Ceiling</th>
          <th>Competition Openness</th>
          <th>Improvement Opportunity</th>
          <th>Data Confidence</th>
          <th>Product Count</th>
          <th>Review Count</th>
          <th>Package Integrity</th>
          <th>Data Completeness</th>
          <th>Status</th>
          <th>Open</th>
        </tr>
      </thead>
      <tbody data-amazon-product-mining-review-rows>
        <tr>
          <td class="muted" colspan="16">No keyword opportunity reviews yet. Run an Amazon product mining task and complete AI keyword review to populate this table.</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>`;
