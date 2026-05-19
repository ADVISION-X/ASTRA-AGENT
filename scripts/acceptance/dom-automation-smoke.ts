import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  clickDomElementOnce,
  fillDomElementOnce,
  locateDomElementOnce,
  readDomSnapshotOnce,
  uploadApprovedFileOnce,
  verifyDomStateOnce,
  waitForDomStateOnce,
} from "../../src/capabilities/dom-automation/index.js";
import { PlaywrightDomBrowserAdapter } from "./dom-smoke-browser.js";

const tmp = mkdtempSync(join(tmpdir(), "grasseye-dom-smoke-"));
const htmlPath = join(tmp, "dom-smoke.html");
const pdfPath = join(tmp, "invoice.pdf");
writeFileSync(pdfPath, "local smoke pdf");
writeFileSync(htmlPath, `
<html><head><title>DOM Smoke</title></head>
<body>
  <label for="search">Order search</label>
  <input id="search" type="search" placeholder="Search orders" />
  <button id="searchButton">Search</button>
  <table><tr id="order-row"><td>123-ORDER</td><td>Ready</td></tr></table>
  <div role="button" id="upload-entry" tabindex="0">Upload invoice</div>
  <input id="file" type="file" />
  <div id="result"></div>
  <script>
    document.querySelector("#searchButton").addEventListener("click", () => {
      document.querySelector("#result").textContent = "Invoice upload entry visible";
    });
  </script>
</body></html>
`);

const launched = await chromium.launch({ headless: true });
const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
const browser = new PlaywrightDomBrowserAdapter(page, tmp);

try {
  await browser.open({ url: pathToFileURL(htmlPath).href, title: "DOM smoke" });
  const snapshot = await readDomSnapshotOnce(browser);
  const searchInput = locateDomElementOnce({ snapshot, targetKind: "search-input", hints: ["order search", "search orders"] });
  const searchButton = locateDomElementOnce({ snapshot, targetKind: "button", hints: ["search"] });
  const fileInput = locateDomElementOnce({ snapshot, targetKind: "file-input", hints: ["file"] });
  const orderRow = locateDomElementOnce({ snapshot, targetKind: "order-row", hints: ["ready"], requiredText: "123-ORDER" });

  const fill = await fillDomElementOnce(browser, { elementRef: searchInput, approvedText: "123-ORDER", clearBeforeType: true, inputPurpose: "order-search" });
  const click = await clickDomElementOnce(browser, { elementRef: searchButton, expectedKind: "search", expectedText: "Search" });
  const latest = await readDomSnapshotOnce(browser);
  const uploadEntry = locateDomElementOnce({ snapshot: latest, targetKind: "upload-invoice-entry", hints: ["upload invoice"] });
  const verify = verifyDomStateOnce({ snapshot: latest, expectedStates: ["invoice-upload-entry-visible"], successHints: ["invoice upload entry visible"], failureHints: [] });
  const waited = await waitForDomStateOnce(browser, { expectedStates: ["invoice-upload-entry-visible"], successHints: ["invoice upload entry visible"], failureHints: [], timeoutMs: 600, pollIntervalMs: 100 });
  const upload = await uploadApprovedFileOnce(browser, { elementRef: fileInput, approvedFilePath: pdfPath, approvedTaskFilePath: pdfPath, allowedExtensions: [".pdf"], uploadPurpose: "approved-pdf-upload" });

  const evidenceOk = Boolean(fill.beforeEvidenceRef && fill.afterEvidenceRef && click.beforeEvidenceRef && click.afterEvidenceRef);
  if (!fill.ok || !click.ok || verify.status !== "success" || waited.status !== "success" || upload.status !== "success" || !evidenceOk || !orderRow.selector || !uploadEntry.selector) {
    process.stdout.write("[DOM-AUTOMATION-SMOKE][FAIL] real DOM flow did not reach expected governed states\n");
    process.exit(1);
  }
  process.stdout.write("[DOM-AUTOMATION-SMOKE][PASS] real DOM snapshot locate fill click wait verify upload-boundary checks passed\n");
} finally {
  await launched.close();
}
