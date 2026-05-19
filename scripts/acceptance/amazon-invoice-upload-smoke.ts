import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { runAmazonInvoiceUploadPhaseOne } from "../../src/plugins/amazon-invoice-upload/index.js";
import { PlaywrightDomBrowserAdapter } from "./dom-smoke-browser.js";

const tmp = mkdtempSync(join(tmpdir(), "grasseye-amazon-smoke-"));
const htmlPath = join(tmp, "seller-central.html");
writeFileSync(htmlPath, `
<html><head><title>Seller Central Local Dry Run</title></head>
<body>
  <label for="order-search">Order search</label>
  <input id="order-search" type="search" placeholder="Search orders by order id" />
  <button id="search-button">Search</button>
  <table id="orders">
    <tr id="order-row"><td>123-1234567-1234567</td><td>Buyer</td><td>Ship</td></tr>
  </table>
  <div id="upload-invoice" role="button" tabindex="0">Upload invoice</div>
</body></html>
`);

const launched = await chromium.launch({ headless: true });
const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
const browser = new PlaywrightDomBrowserAdapter(page, tmp);

try {
  const result = await runAmazonInvoiceUploadPhaseOne(browser, {
    missionType: "amazon_invoice_upload",
    marketplace: "AE",
    amazonOrderId: "123-1234567-1234567",
    invoiceNo: "INV-1",
    invoicePdfPath: join(tmp, "invoice.pdf"),
    sellerCentralEntryUrl: pathToFileURL(htmlPath).href,
    requireHumanFinalSubmit: true,
  });

  if (result.status !== "review_required" || result.reachedStep !== "upload invoice entry located") {
    process.stdout.write(`[AMAZON-INVOICE-UPLOAD-SMOKE][FAIL] unexpected dry-run result: ${JSON.stringify(result)}\n`);
    process.exit(1);
  }
  process.stdout.write("[AMAZON-INVOICE-UPLOAD-SMOKE][PASS] plugin dry-run flow reached review_required upload-entry boundary\n");
} finally {
  await launched.close();
}
