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

const tmp = mkdtempSync(join(tmpdir(), "grasseye-amazon-agent-smoke-"));
const htmlPath = join(tmp, "seller-central.html");
const pdfPath = join(tmp, "invoice.pdf");
writeFileSync(pdfPath, "local smoke pdf");
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
let commanderExecuteCount: number = 0;
let startMissionCount: number = 0;

const commanderConsole: GrassEyeWorkbenchHandle["commanderConsole"] = {
  abilityGroupId: "commander-console",
  listChildCapabilityIds() {
    return [];
  },
  async execute() {
    commanderExecuteCount += 1;
    throw new Error("plugin route must not call commander console task start");
  },
};

const createUnusedAsync = <TValue>(message = "unused") => async (): Promise<TValue> => {
  throw new Error(message);
};

const createSmokeWorkbench = (): GrassEyeWorkbenchHandle => ({
  commanderConsole,
  init: async () => {},
  getHealthReport: createUnusedAsync(),
  getMissionReadinessReport: createUnusedAsync(),
  getMissionStartPreflight: createUnusedAsync(),
  getCommanderConsoleSnapshot: createUnusedAsync(),
  getAppRunLimitSettings: createUnusedAsync(),
  saveAppRunLimitSettings: createUnusedAsync(),
  getOnlineAiProviderSettings: createUnusedAsync(),
  saveOnlineAiProviderSettings: createUnusedAsync(),
  getDataDir() { return tmp; },
  getUserRequirementHistory: async () => [],
  upsertUserRequirementHistory: createUnusedAsync(),
  deleteUserRequirementHistory: createUnusedAsync(),
  reuseUserRequirementHistory: async () => null,
  openAdminInvoicePage: async (input: { adminUrl: string }) => openAmazonInvoiceAdminPage(browser, input),
  startAmazonInvoiceUploadMission: createUnusedAsync("legacy mission start path must not be used by plugin start route"),
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
});

const workbench = createSmokeWorkbench();

const server = createWorkbenchServer({ workbench, baseUrl: "http://127.0.0.1" });

async function listen(serverToStart: ReturnType<typeof createServer>): Promise<number> {
  await new Promise<void>((resolve) => {
    serverToStart.listen(0, "127.0.0.1", () => resolve());
  });
  const address = serverToStart.address();
  if (!address || typeof address === "string") {
    throw new Error("Unable to resolve smoke server port.");
  }
  return address.port;
}

try {
  const port = await listen(server);
  const baseUrl = `http://127.0.0.1:${port}`;

  const invalidResponse = await fetch(`${baseUrl}/api/plugins/amazon-invoice-upload/start`, {
    method: "POST",
    body: new FormData(),
  });
  if (invalidResponse.status !== 400 || startMissionCount !== 0) {
    process.stdout.write(`[AMAZON-INVOICE-AGENT-START-SMOKE][FAIL] invalid payload was not rejected before facade execution\n`);
    process.exit(1);
  }

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
  const response = await fetch(`${baseUrl}/api/plugins/amazon-invoice-upload/start`, {
    method: "POST",
    body: formData,
  });
  const payload = await response.json();
  const executedMissionCount = Number(startMissionCount);
  const executedCommanderCount = Number(commanderExecuteCount);

  if (
    !response.ok
    || payload.ok !== true
    || payload.status !== "upload_success"
    || payload.reachedStep !== "upload success verified"
    || !String(payload.mission?.invoicePdfPath || "").includes("approved-task-files")
    || executedMissionCount !== 1
    || executedCommanderCount !== 0
  ) {
    process.stdout.write(`[AMAZON-INVOICE-AGENT-START-SMOKE][FAIL] unexpected start payload: ${JSON.stringify(payload)} counts={"startMissionCount":${executedMissionCount},"commanderExecuteCount":${executedCommanderCount}}\n`);
    process.exit(1);
  }

  const allowlistResponse = await fetch(`${baseUrl}/api/plugins/amazon-invoice-upload/open-admin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ adminUrl: "file:///tmp/not-allowed" }),
  });
  const allowlistPayload = await allowlistResponse.json();
  if (!allowlistResponse.ok || allowlistPayload.ok !== false || allowlistPayload.error !== "admin_url_not_allowed") {
    process.stdout.write(`[AMAZON-INVOICE-AGENT-START-SMOKE][FAIL] open-admin allowlist gate did not hold: ${JSON.stringify(allowlistPayload)}\n`);
    process.exit(1);
  }

  process.stdout.write("[AMAZON-INVOICE-AGENT-START-SMOKE][PASS] independent plugin route accepted multipart, avoided task-start path, and reached upload_success\n");
} finally {
  server.close();
  await launched.close();
}
