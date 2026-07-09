export const renderAmazonListingEditReadSyncWorkspace = (): string => `
<section class="skill-workspace hidden" data-skill-workspace="amazon-listing-edit-read-sync" data-job-panel="amazon-listing-edit-read-sync">
  <div class="skill-header">
    <div>
      <span class="eyebrow">Seller Central</span>
      <h1>Amazon Listing Edit Read</h1>
      <p>Read inventory parent, child, SKU Central, and listing edit tab fields.</p>
    </div>
    <span class="status-badge status-active">read-only</span>
  </div>
  <nav class="skill-page-nav" data-workspace-page-nav="amazon-listing-edit-read-sync" aria-label="Amazon Listing Edit Read pages">
    <button class="skill-page-tab" type="button" data-workspace-page="run" data-workspace-page-skill="amazon-listing-edit-read-sync" aria-pressed="true">Run</button>
    <button class="skill-page-tab" type="button" data-workspace-page="results" data-workspace-page-skill="amazon-listing-edit-read-sync" aria-pressed="false">Results</button>
    <button class="skill-page-tab" type="button" data-workspace-page="audit" data-workspace-page-skill="amazon-listing-edit-read-sync" aria-pressed="false">Audit</button>
  </nav>
  <div class="skill-page-stack secondary-page-stack">
    <section class="skill-page-surface listing-edit-read-layout" data-workspace-surface="run" data-workspace-surface-skill="amazon-listing-edit-read-sync">
      <section class="panel app-form-panel listing-edit-read-form-panel">
        <div class="panel-title-row">
          <div>
            <span class="eyebrow">Controlled Target</span>
            <h2>Task Input</h2>
          </div>
          <span class="status-badge status-insufficient" data-listing-edit-read-form-state>idle</span>
        </div>
        <form class="form-grid" data-listing-edit-read-form>
          <div class="field"><label>站点</label><input name="site" value="on-the-way" required /></div>
          <div class="field"><label>Request ID</label><input name="requestId" value="listing-edit-read-sync-ui" required /></div>
          <div class="field"><label>Marketplace</label><select name="marketplace"><option value="amazon.ae">amazon.ae</option><option value="amazon.sa">amazon.sa</option><option value="amazon.com">amazon.com</option><option value="amazon.co.uk">amazon.co.uk</option><option value="amazon.co.jp">amazon.co.jp</option></select></div>
          <div class="field"><label>Safety mode</label><select name="safetyMode" data-listing-edit-read-safety-mode><option value="inventory-only">inventory-only</option><option value="single-sku-search-only">single-sku-search-only</option><option value="single-sku-sku-central-only">single-sku-sku-central-only</option><option value="single-sku-edit-tabs">single-sku-edit-tabs</option><option value="all-inventory-edit-tabs">all-inventory-edit-tabs</option></select></div>
          <div class="field"><label>Target mode</label><select name="targetMode" data-listing-edit-read-target-mode><option value="inventory">inventory</option><option value="sku">sku</option><option value="asin">asin</option><option value="parent">parent</option><option value="child">child</option><option value="all-inventory">all-inventory</option></select></div>
          <div class="field"><label>Scope</label><select name="scope"><option value="visible-inventory-page">visible-inventory-page</option><option value="all-inventory-pages">all-inventory-pages</option></select></div>
          <div class="field"><label>ASIN</label><input name="asin" placeholder="B0XXXXXXXX" /></div>
          <div class="field"><label>SKU</label><input name="sku" /></div>
          <div class="field"><label>Parent ASIN</label><input name="parentAsin" placeholder="B0XXXXXXXX" /></div>
          <div class="field"><label>Parent SKU</label><input name="parentSku" /></div>
          <div class="field"><label>Child ASIN</label><input name="childAsin" placeholder="B0XXXXXXXX" /></div>
          <div class="field"><label>Child SKU</label><input name="childSku" /></div>
          <div class="field"><label>Product type</label><input name="productType" placeholder="SHOWERHEAD" /></div>
          <div class="field"><label>Max items</label><input name="maxItems" type="number" min="1" max="200" value="1" required /></div>
          <fieldset class="listing-edit-read-tabs wide">
            <legend>Tabs</legend>
            <label class="check"><input name="tabs" type="checkbox" value="product_details" checked /> product_details</label>
            <label class="check"><input name="tabs" type="checkbox" value="images" checked /> images</label>
            <label class="check"><input name="tabs" type="checkbox" value="variations" checked /> variations</label>
            <label class="check"><input name="tabs" type="checkbox" value="offer" checked /> offer</label>
            <label class="check"><input name="tabs" type="checkbox" value="safety_and_compliance" checked /> safety_and_compliance</label>
          </fieldset>
          <label class="check"><input name="stopOnFirstIssue" type="checkbox" checked /> stopOnFirstIssue</label>
          <label class="check"><input name="requireParentChildProof" type="checkbox" checked /> requireParentChildProof</label>
          <div class="actions wide">
            <button class="btn" type="submit">Start</button>
            <button class="btn secondary" type="button" data-listing-edit-read-latest>Latest</button>
            <button class="btn secondary" type="button" data-listing-edit-read-refresh>Refresh</button>
          </div>
        </form>
      </section>
      <section class="panel history-panel listing-edit-read-status-panel">
        <div class="panel-title-row">
          <div>
            <span class="eyebrow">Task Status</span>
            <h2 data-listing-edit-read-title>No task loaded</h2>
          </div>
          <span class="status-badge" data-listing-edit-read-status>idle</span>
        </div>
        <div class="detail-grid inspector-detail-grid">
          <div><b>Task</b><span data-listing-edit-read-task-id>-</span></div>
          <div><b>Step</b><span data-listing-edit-read-step>-</span></div>
          <div><b>Reason</b><span data-listing-edit-read-reason>-</span></div>
          <div><b>Target</b><span data-listing-edit-read-target-status>-</span></div>
          <div><b>Candidates</b><span data-listing-edit-read-candidate-count>-</span></div>
          <div><b>Inventory</b><span data-listing-edit-read-inventory-count>-</span></div>
          <div><b>Items</b><span data-listing-edit-read-item-count>-</span></div>
          <div><b>Auth</b><span data-listing-edit-read-auth>-</span></div>
        </div>
        <div class="listing-edit-read-table-shell">
          <table class="compact-data-table">
            <thead><tr><th>SKU</th><th>ASIN</th><th>Status</th><th>FNSKU</th><th>Tabs</th><th></th></tr></thead>
            <tbody data-listing-edit-read-items><tr><td colspan="6">No rows</td></tr></tbody>
          </table>
        </div>
      </section>
    </section>
    <section class="skill-page-surface hidden" data-workspace-surface="results" data-workspace-surface-skill="amazon-listing-edit-read-sync">
      <section class="panel">
        <div class="panel-title-row"><div><span class="eyebrow">Inventory</span><h2>Resolved rows</h2></div></div>
        <div class="listing-edit-read-table-shell">
          <table class="compact-data-table">
            <thead><tr><th>Kind</th><th>SKU</th><th>ASIN</th><th>Parent SKU</th><th>Parent ASIN</th><th>Evidence</th></tr></thead>
            <tbody data-listing-edit-read-inventory><tr><td colspan="6">No rows</td></tr></tbody>
          </table>
        </div>
      </section>
    </section>
    <section class="skill-page-surface hidden" data-workspace-surface="audit" data-workspace-surface-skill="amazon-listing-edit-read-sync">
      <section class="panel">
        <div class="panel-title-row"><div><span class="eyebrow">Raw record</span><h2>Audit payload</h2></div></div>
        <pre data-listing-edit-read-raw>{}</pre>
      </section>
    </section>
  </div>
</section>`;
