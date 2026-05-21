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
const fixturePath = join(tmp, "approved-smoke.txt");
writeFileSync(fixturePath, "local approved smoke file");
writeFileSync(htmlPath, `
<html><head><title>DOM Smoke</title></head>
<body>
  <label for="search">Record search</label>
  <input id="search" type="search" placeholder="Search records" />
  <button id="searchButton">Search</button>
  <table><tr id="record-row"><td>ABC-RECORD</td><td>Ready</td></tr></table>
  <div role="button" id="upload-entry" tabindex="0">Open file upload</div>
  <input id="file" type="file" />
  <div id="result"></div>
  <script>
    document.querySelector("#searchButton").addEventListener("click", () => {
      document.querySelector("#result").textContent = "File upload entry visible";
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
  const searchInput = locateDomElementOnce({ snapshot, targetKind: "search-input", hints: ["record search", "search records"] });
  const searchButton = locateDomElementOnce({ snapshot, targetKind: "button", hints: ["search"] });
  const fileInput = locateDomElementOnce({ snapshot, targetKind: "file-input", hints: ["file"] });
  const recordRow = locateDomElementOnce({ snapshot, targetKind: "row", hints: ["ready"], requiredText: "ABC-RECORD" });

  const fill = await fillDomElementOnce(browser, { elementRef: searchInput, approvedText: "ABC-RECORD", clearBeforeType: true, inputPurpose: "approved-search-text" });
  const click = await clickDomElementOnce(browser, { elementRef: searchButton, expectedKind: "search", expectedText: "Search" });
  const latest = await readDomSnapshotOnce(browser);
  const uploadEntry = locateDomElementOnce({ snapshot: latest, targetKind: "clickable", hints: ["open file upload"] });
  const verify = verifyDomStateOnce({ snapshot: latest, expectedStates: ["success-message"], successHints: ["file upload entry visible"], failureHints: [] });
  const waited = await waitForDomStateOnce(browser, { expectedStates: ["success-message"], successHints: ["file upload entry visible"], failureHints: [], timeoutMs: 600, pollIntervalMs: 100 });
  const upload = await uploadApprovedFileOnce(browser, { elementRef: fileInput, approvedFilePath: fixturePath, approvedTaskFilePath: fixturePath, allowedExtensions: [".txt"], uploadPurpose: "approved-smoke-file-upload" });

  const evidenceOk = Boolean(fill.beforeEvidenceRef && fill.afterEvidenceRef && click.beforeEvidenceRef && click.afterEvidenceRef);
  if (!fill.ok || !click.ok || verify.status !== "success" || waited.status !== "success" || upload.status !== "success" || !evidenceOk || !recordRow.selector || !uploadEntry.selector) {
    process.stdout.write("[DOM-AUTOMATION-SMOKE][FAIL] real DOM flow did not reach expected governed states\n");
    process.exit(1);
  }
  process.stdout.write("[DOM-AUTOMATION-SMOKE][PASS] real DOM snapshot locate fill click wait verify upload-boundary checks passed\n");
} finally {
  await launched.close();
}
