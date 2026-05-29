const marketplaceSelect = (): string =>
  `<select name="marketplace"><option>AE</option><option>SA</option><option>JP</option><option>US</option><option>UK</option></select>`;

const renderAmazonInvoiceNav = (): string => `
  <nav class="skill-page-nav" data-workspace-page-nav="amazon-invoice-upload" aria-label="Amazon invoice upload pages">
    <button class="skill-page-tab" type="button" data-workspace-page="download" data-workspace-page-skill="amazon-invoice-upload" aria-pressed="true">Download</button>
    <button class="skill-page-tab" type="button" data-workspace-page="upload" data-workspace-page-skill="amazon-invoice-upload" aria-pressed="false">Upload</button>
    <button class="skill-page-tab" type="button" data-workspace-page="batch" data-workspace-page-skill="amazon-invoice-upload" aria-pressed="false">Batch Upload</button>
    <button class="skill-page-tab" type="button" data-workspace-page="ledger" data-workspace-page-skill="amazon-invoice-upload" aria-pressed="false">Ledger</button>
    <button class="skill-page-tab" type="button" data-workspace-page="latest" data-workspace-page-skill="amazon-invoice-upload" aria-pressed="false">Latest</button>
    <button class="skill-page-tab" type="button" data-workspace-page="evidence" data-workspace-page-skill="amazon-invoice-upload" aria-pressed="false">Evidence</button>
  </nav>`;

const renderAmazonInvoiceDownloadSurface = (): string => `
  <section class="skill-page-surface" data-workspace-surface="download" data-workspace-surface-skill="amazon-invoice-upload">
    <section class="panel app-form-panel">
      <form class="form-grid" data-amazon-tax-invoice-download-form>
        <div class="field"><label>Marketplace</label>${marketplaceSelect()}</div>
        <div class="field wide"><label>Seller Central Entry URL</label><input name="sellerCentralEntryUrl" type="url" value="https://sellercentral.amazon.ae/home" required /></div>
        <div class="field"><label>Date Range</label><input name="dateRange" value="Last 30 Days" readonly /></div>
        <div class="field"><label>Format</label><input name="format" value="CSV" readonly /></div>
        <div class="field wide"><label>Report Type</label><input name="reportType" value="亚马逊配送货件 – 税务发票" readonly /></div>
        <div class="field wide"><label>Callback URL</label><input name="callbackUrl" type="url" /></div>
        <label class="check wide"><input name="requireHumanReview" type="checkbox" checked /> require human review</label>
        <div class="actions wide"><button class="btn" type="submit" data-amazon-tax-invoice-download-start>Start Download</button><button class="btn secondary" type="button" data-amazon-tax-invoice-download-latest>Latest Download</button><button class="btn secondary" type="button" data-amazon-tax-invoice-download-artifact>Open Artifact</button></div>
        <div class="summary-metrics wide" data-amazon-tax-invoice-download-status><div><b data-amazon-tax-invoice-download-task-id>-</b><span>task id</span></div><div><b data-amazon-tax-invoice-download-state>-</b><span>status</span></div><div><b data-amazon-tax-invoice-download-step>-</b><span>reached step</span></div><div><b data-amazon-tax-invoice-download-artifact-ref>-</b><span>artifact ref</span></div></div>
      </form>
    </section>
  </section>`;

const renderAmazonInvoiceUploadSurface = (): string => `
  <section class="skill-page-surface hidden" data-workspace-surface="upload" data-workspace-surface-skill="amazon-invoice-upload">
    <section class="panel app-form-panel">
      <form class="form-grid" data-amazon-form>
        <div class="field"><label>Marketplace</label>${marketplaceSelect()}</div>
        <div class="field"><label>Amazon order ID</label><input name="amazonOrderId" required /></div>
        <div class="field wide"><label>Seller Central URL</label><input name="sellerCentralEntryUrl" type="url" required /></div>
        <div class="field"><label>Invoice number</label><input name="invoiceNo" required /></div>
        <div class="field"><label>Approved PDF</label><input name="invoicePdf" type="file" accept="application/pdf" required /></div>
        <div class="field wide"><label>Admin order URL</label><input name="adminOrderUrl" type="url" /></div>
        <div class="actions wide"><button class="btn" type="submit">Start</button><button class="btn secondary" type="button" data-amazon-resume>Resume</button><button class="btn secondary" type="button" data-amazon-latest>Latest</button></div>
      </form>
    </section>
  </section>`;

const renderAmazonInvoiceBatchSurface = (): string => `
  <section class="skill-page-surface hidden" data-workspace-surface="batch" data-workspace-surface-skill="amazon-invoice-upload">
    <section class="panel app-form-panel">
      <form class="form-grid" data-amazon-invoice-batch-form>
        <div class="field"><label>Marketplace</label>${marketplaceSelect()}</div>
        <div class="field wide"><label>PDF files</label><input name="invoicePdfs" type="file" accept="application/pdf" multiple required /></div>
        <div class="field"><label>Source rule</label><input name="sourceKind" value="filename = order id = invoice no" readonly /></div>
        <label class="check"><input name="stopOnFailed" type="checkbox" /> stop on failed</label>
        <div class="actions wide"><button class="btn" type="submit" data-amazon-invoice-batch-start>Start Batch Upload</button><button class="btn secondary" type="button" data-amazon-invoice-upload-ledger-refresh>Open Ledger</button></div>
        <div class="summary-metrics wide" data-amazon-invoice-batch-status><div><b data-amazon-invoice-batch-id>-</b><span>batch id</span></div><div><b data-amazon-invoice-batch-state>-</b><span>status</span></div><div><b data-amazon-invoice-batch-current>-</b><span>current order</span></div><div><b data-amazon-invoice-batch-total>-</b><span>total</span></div><div><b data-amazon-invoice-batch-succeeded>-</b><span>succeeded</span></div><div><b data-amazon-invoice-batch-already>-</b><span>already uploaded</span></div><div><b data-amazon-invoice-batch-failed>-</b><span>failed</span></div><div><b data-amazon-invoice-batch-blocked-auth>-</b><span>blocked auth</span></div></div>
        <div class="record-list wide" data-amazon-invoice-batch-items></div>
      </form>
    </section>
  </section>`;

const renderAmazonInvoiceLedgerSurface = (): string => `
  <section class="skill-page-surface hidden" data-workspace-surface="ledger" data-workspace-surface-skill="amazon-invoice-upload">
    <section class="panel history-panel"><div class="panel-title-row"><div><span class="eyebrow">Upload Ledger</span><h2>Invoice upload records</h2></div><button class="btn secondary" type="button" data-amazon-invoice-upload-ledger-refresh>Refresh</button></div><div class="record-list" data-amazon-invoice-upload-ledger-list></div></section>
  </section>`;

const renderEmptyAmazonInvoiceSurface = (surface: string, eyebrow: string, title: string, copy: string): string => `
  <section class="skill-page-surface hidden" data-workspace-surface="${surface}" data-workspace-surface-skill="amazon-invoice-upload">
    <section class="panel empty-state app-empty-surface"><span class="eyebrow">${eyebrow}</span><h2>${title}</h2><p>${copy}</p></section>
  </section>`;

export const renderAmazonInvoiceWorkspace = (): string => `
<section class="skill-workspace hidden" data-skill-workspace="amazon-invoice-upload" data-job-panel="amazon">
  <div class="skill-header"><div><span class="eyebrow">Bounded Job Flow Surface</span><h1>Amazon invoice upload</h1><p>Structured invoice upload entry inside the unified workbench shell.</p></div></div>
  ${renderAmazonInvoiceNav()}
  <div class="skill-page-stack secondary-page-stack">
    ${renderAmazonInvoiceDownloadSurface()}
    ${renderAmazonInvoiceUploadSurface()}
    ${renderAmazonInvoiceBatchSurface()}
    ${renderAmazonInvoiceLedgerSurface()}
    ${renderEmptyAmazonInvoiceSurface("latest", "Latest Task", "No invoice task selected", "Use Latest after entering an Amazon order ID. Task details open in the Inspector only when selected.")}
    ${renderEmptyAmazonInvoiceSurface("evidence", "Evidence", "No evidence loaded", "Completed invoice upload evidence and failure reasons appear here from persisted task records.")}
  </div>
</section>`;
