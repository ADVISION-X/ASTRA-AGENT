import { renderWorkbenchHomeClient } from "./workbench-home-client.js";
import { renderWorkbenchHomeStyles } from "./workbench-home-styles.js";

const renderJobRail = (): string => `
<aside class="rail">
  <h2>Job flows</h2>
  <div class="job-list" data-job-flow-list>
    <button class="job-card" type="button" data-job-card="amazon" aria-pressed="true">
      <strong>Amazon invoice upload</strong>
      <span class="muted">approved PDF -> order invoice</span>
    </button>
    <button class="job-card" type="button" data-job-card="facebook" aria-pressed="false">
      <strong>Facebook product video mining</strong>
      <span class="muted">feed scan -> evidence refs</span>
    </button>
  </div>
</aside>`;

const renderAmazonPanel = (): string => `
<section data-job-panel="amazon">
  <h1>Amazon invoice upload</h1>
  <p class="muted">amazon-invoice-upload.flow.ts</p>
  <form class="form-grid" data-amazon-form>
    <div class="field"><label>Marketplace</label><select name="marketplace"><option>AE</option><option>SA</option><option>JP</option><option>US</option><option>UK</option></select></div>
    <div class="field"><label>Amazon order ID</label><input name="amazonOrderId" required /></div>
    <div class="field wide"><label>Seller Central URL</label><input name="sellerCentralEntryUrl" type="url" required /></div>
    <div class="field"><label>Invoice number</label><input name="invoiceNo" required /></div>
    <div class="field"><label>Approved PDF</label><input name="invoicePdf" type="file" accept="application/pdf" required /></div>
    <div class="field wide"><label>Admin order URL</label><input name="adminOrderUrl" type="url" /></div>
    <label class="check wide"><input name="requireHumanFinalSubmit" type="checkbox" checked /> require human final submit</label>
    <div class="actions wide">
      <button class="btn" type="submit">Start</button>
      <button class="btn secondary" type="button" data-amazon-resume>Resume</button>
      <button class="btn secondary" type="button" data-amazon-latest>Latest</button>
    </div>
  </form>
</section>`;

const renderFacebookPanel = (): string => `
<section class="hidden" data-job-panel="facebook">
  <h1>Facebook product video mining</h1>
  <p class="muted">facebook-product-video-mining.flow.ts</p>
  <form class="form-grid" data-facebook-form>
    <div class="field"><label>Target product count</label><input name="targetProductCount" type="number" min="1" value="3" required /></div>
    <div class="actions wide">
      <button class="btn" type="submit">Start</button>
      <button class="btn secondary" type="button" data-facebook-latest>Latest</button>
    </div>
  </form>
</section>`;

const renderLedger = (): string => `
<aside class="ledger" data-task-status-panel>
  <div class="panel">
    <h2>Task status</h2>
    <div class="kv">
      <div><b>ID</b><span data-task-id>-</span></div>
      <div><b>Status</b><span data-task-status>-</span></div>
      <div><b>Step</b><span data-task-step>-</span></div>
      <div><b>Reason</b><span data-task-reason>-</span></div>
      <div><b>Evidence</b><span data-evidence-ref>-</span></div>
    </div>
  </div>
  <div class="panel">
    <h2>Result record</h2>
    <pre data-raw-result>{}</pre>
  </div>
</aside>`;

export const renderWorkbenchHomePage = (): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>GrassEye Local Workbench</title>
  <style>${renderWorkbenchHomeStyles()}</style>
</head>
<body>
  <div class="shell" data-workbench-shell>
    <header class="topbar">
      <div class="brand"><strong>GrassEye Local Workbench</strong><span>job-flow gate</span></div>
      <div class="status">
        <span class="pill"><span>health</span><b data-health-status>-</b></span>
        <span class="pill"><span>mode</span><b data-mode-status>-</b></span>
        <button class="btn secondary" type="button" data-refresh-shell>Refresh</button>
      </div>
    </header>
    <main class="main">
      ${renderJobRail()}
      <div class="workspace">${renderAmazonPanel()}${renderFacebookPanel()}</div>
      ${renderLedger()}
    </main>
    <footer class="activity" data-activity-panel>
      <h3>Local activity</h3>
      <div class="activity-log" data-activity-log></div>
    </footer>
  </div>
  <script>${renderWorkbenchHomeClient()}</script>
</body>
</html>`;
