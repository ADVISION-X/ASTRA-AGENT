import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import { createWorkbenchServer } from "../../src/app/create-workbench-server.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";
import {
  getAmazonInvoiceUploadTaskStatus,
  openAmazonInvoiceAdminPage,
  resumeAmazonInvoiceUploadTask,
  startAmazonInvoiceUploadTask,
} from "../../src/plugins/amazon-invoice-upload/index.js";
import { PlaywrightDomBrowserAdapter } from "./dom-smoke-browser.js";

const tmp = mkdtempSync(join(tmpdir(), "grasseye-amazon-complete-smoke-"));
const htmlPath = join(tmp, "seller-central.html");
const pdfPath = join(tmp, "invoice.pdf");
writeFileSync(pdfPath, "local smoke pdf");
writeFileSync(htmlPath, `
<html><head><title>Seller Central Local Dry Run</title></head>
<body>
  <label for="order-search">Order search</label>
  <input id="order-search" type="search" placeholder="Search orders by order id" />
  <button id="search-button">Search</button>
  <table><tr id="order-row"><td>123-1234567-1234567</td><td>Buyer</td><td>Ship</td></tr></table>
  <div id="upload-invoice" role="button" tabindex="0">Upload invoice</div>
  <section id="upload-panel" hidden>
    <label for="invoice-file">Choose file</label>
    <input id="invoice-file" type="file" />
    <button id="submit-upload">Submit</button>
  </section>
  <div id="status"></div>
  <script>
    document.querySelector("#upload-invoice").addEventListener("click", () => {
      document.querySelector("#upload-panel").hidden = false;
    });
    document.querySelector("#invoice-file").addEventListener("change", () => {
      document.querySelector("#status").textContent = "File attached INV-1";
    });
    document.querySelector("#submit-upload").addEventListener("click", () => {
      document.querySelector("#status").textContent = "Invoice uploaded successfully";
    });
  </script>
</body></html>
`);

const launched = await chromium.launch({ headless: true });
const page = await launched.newPage({ viewport: { width: 900, height: 700 } });
const browser = new PlaywrightDomBrowserAdapter(page, tmp);
let commanderExecuteCount = 0;
let startMissionCount = 0;

const workbench: GrassEyeWorkbenchHandle = {
  commanderConsole: {
    abilityGroupId: "commander-console",
    listChildCapabilityIds() { return []; },
    async execute() { commanderExecuteCount += 1; throw new Error("plugin route must not call commander console task start"); },
  },
  async init() {},
  async getHealthReport() { throw new Error("unused"); },
  async getMissionReadinessReport() { throw new Error("unused"); },
  async getMissionStartPreflight() { throw new Error("unused"); },
  async getCommanderConsoleSnapshot() { throw new Error("unused"); },
  async getAppRunLimitSettings() { throw new Error("unused"); },
  async saveAppRunLimitSettings() { throw new Error("unused"); },
  async getOnlineAiProviderSettings() { throw new Error("unused"); },
  async saveOnlineAiProviderSettings() { throw new Error("unused"); },
  getDataDir() { return tmp; },
  async getUserRequirementHistory() { return []; },
  async upsertUserRequirementHistory() { throw new Error("unused"); },
  async deleteUserRequirementHistory() { throw new Error("unused"); },
  async reuseUserRequirementHistory() { return null; },
  async openAdminInvoicePage(input: { adminUrl: string }) { return openAmazonInvoiceAdminPage(browser, input); },
  async startAmazonInvoiceUploadMission() { throw new Error("legacy mission start path must not be used"); },
  async startAmazonInvoiceUploadTask(input: Parameters<typeof startAmazonInvoiceUploadTask>[0]["task"]) {
    startMissionCount += 1;
    return startAmazonInvoiceUploadTask({ browser, dataDir: tmp, task: input });
  },
  async resumeAmazonInvoiceUploadTask(input: { taskId: string }) {
    return resumeAmazonInvoiceUploadTask({ browser, dataDir: tmp, taskId: input.taskId });
  },
  async getAmazonInvoiceUploadTaskStatus(taskId: string) {
    return getAmazonInvoiceUploadTaskStatus({ dataDir: tmp, taskId });
  },
  getModeInfo() { return {}; },
};

const server = createWorkbenchServer({ workbench, baseUrl: "http://127.0.0.1" });

async function listen(): Promise<number> {
  await new Promise<void>((resolve) => { server.listen(0, "127.0.0.1", () => resolve()); });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve smoke server port.");
  }
  return address.port;
}

try {
  const baseUrl = `http://127.0.0.1:${await listen()}`;
  const formData = new FormData();
  formData.set("mission", JSON.stringify({
    missionType: "amazon_invoice_upload",
    marketplace: "AE",
    amazonOrderId: "123-1234567-1234567",
    invoiceNo: "INV-1",
    invoicePdfPath: "approved-task-file://pending",
    sellerCentralEntryUrl: pathToFileURL(htmlPath).href,
    requireHumanFinalSubmit: false,
  }));
  formData.set("invoicePdf", new Blob([new Uint8Array(readFileSync(pdfPath))], { type: "application/pdf" }), "invoice.pdf");
  const response = await fetch(`${baseUrl}/api/plugins/amazon-invoice-upload/start`, { method: "POST", body: formData });
  const payload = await response.json();
  const statusResponse = await fetch(`${baseUrl}/api/plugins/amazon-invoice-upload/status/${encodeURIComponent(payload.taskId)}`);
  const statusPayload = await statusResponse.json();
  if (!response.ok || payload.status !== "upload_success" || statusPayload.status !== "upload_success" || startMissionCount !== 1 || commanderExecuteCount !== 0) {
    process.stdout.write(`[AMAZON-INVOICE-UPLOAD-COMPLETE-SMOKE][FAIL] ${JSON.stringify({ payload, statusPayload, startMissionCount, commanderExecuteCount })}\n`);
    process.exit(1);
  }
  process.stdout.write("[AMAZON-INVOICE-UPLOAD-COMPLETE-SMOKE][PASS] multipart API saved approved PDF and completed search-upload-submit-verify\n");
} finally {
  server.close();
  await launched.close();
}
