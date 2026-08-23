import type { AddressInfo } from "node:net";

import { createWorkbenchServer } from "../../src/app/create-workbench-server.js";
import type { GrassEyeWorkbenchHandle } from "../../src/lib/local-runtime/workbench-handle.js";
import type { AmazonInvoiceUploadTaskRecord } from "../../src/plugins/amazon-invoice-upload/amazon-invoice-upload-storage.types.js";
import type { AmazonInvoiceUploadTaskStartInput } from "../../src/plugins/amazon-invoice-upload/amazon-invoice-upload-task-service.types.js";
import type { AmazonInvoiceUploadMissionInput } from "../../src/plugins/amazon-invoice-upload/mission.schema.js";

export const localBaseUrl = "http://127.0.0.1:4173";
export const externalOrigin = "https://ontheway.example.com";
export const apiKey = "test-secret";

export type FakeWorkbench = GrassEyeWorkbenchHandle & {
  apiBoundaryEvents: unknown[];
  lastUploadMission?: AmazonInvoiceUploadMissionInput;
  startCalls: number;
};

type MutableFakeWorkbench = Partial<GrassEyeWorkbenchHandle> & Pick<FakeWorkbench, "apiBoundaryEvents" | "lastUploadMission" | "startCalls">;

const createInvoiceMission = (): AmazonInvoiceUploadMissionInput => ({
  missionType: "amazon_invoice_upload",
  marketplace: "AE",
  amazonOrderId: "000-0000000-0000000",
  invoiceNo: "INV-TEST-1",
  invoicePdfPath: "/tmp/invoice.pdf",
  sellerCentralEntryUrl: "https://sellercentral.amazon.ae/orders-v3/order/000-0000000-0000000",
  adminOrderUrl: `${externalOrigin}/admin/orders/123`,
});

const createInvoiceRecord = (input: { mission?: AmazonInvoiceUploadMissionInput; taskId?: string } = {}): AmazonInvoiceUploadTaskRecord => {
  const mission = input.mission ?? createInvoiceMission();
  return {
    taskId: input.taskId ?? "task_test",
    mission,
    ok: false,
    status: "review_required",
    reason: "acceptance_fixture_review_required",
    reachedStep: "acceptance_fixture",
    amazonOrderId: mission.amazonOrderId,
    invoiceNo: mission.invoiceNo,
    reviewRequired: true,
    intervention: { revision: 0, state: "running", reason: null, checkpoint: "acceptance_fixture", pending: null, updatedAt: new Date().toISOString() },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

const createLedgerRecord = () => ({
  taskId: "task_ledger",
  amazonOrderId: "000-0000000-0000000",
  invoiceNo: "INV-TEST-1",
  status: "review_required",
  reason: "acceptance_fixture_review_required",
  reachedStep: "acceptance_fixture",
  evidenceRef: null,
    runtimeLogRef: null,
    navigationEvidenceRef: null,
  reviewRequired: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const createDownloadRecord = (input: { status?: "completed" | "manual_required"; taskId?: string } = {}) => ({
  taskId: input.taskId ?? "download_task_test",
  taskKind: "tax_invoice_download" as const,
  mission: {
    missionType: "amazon_tax_invoice_download" as const,
    mode: "download_only" as const,
    marketplace: "AE" as const,
    sellerCentralEntryUrl: "https://sellercentral.amazon.ae/home",
    reportKind: "afn_shipment_invoicing_tax_invoice" as const,
    dateRange: "last_30_days" as const,
    format: "csv" as const,
  },
  ok: input.status === "completed",
  status: input.status ?? "manual_required",
  reason: "acceptance_fixture_download",
  reachedStep: input.status === "completed" ? "verify local download artifact" : "acceptance_fixture",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const createFakeWorkbench = (): FakeWorkbench => {
  const fake: MutableFakeWorkbench = {
    apiBoundaryEvents: [],
    startCalls: 0,
    recordWorkbenchApiBoundaryEvent(event: unknown) {
      fake.apiBoundaryEvents.push(event);
    },
    async getHealthReport() {
      return {
        status: "healthy" as const,
        components: [],
        checkedAt: new Date().toISOString(),
        sourceFingerprint: "acceptance",
      };
    },
  };
  attachUploadTaskMethods(fake);
  attachDownloadTaskMethods(fake);
  return fake as FakeWorkbench;
};

function attachUploadTaskMethods(fake: MutableFakeWorkbench): void {
  fake.startAmazonInvoiceUploadTask = async (input: AmazonInvoiceUploadTaskStartInput) => {
    fake.startCalls += 1;
    fake.lastUploadMission = input.mission;
    return createInvoiceRecord({ mission: input.mission });
  };
  fake.getAmazonInvoiceUploadTaskStatus = async (taskId: string) => createInvoiceRecord({ taskId });
  fake.getLatestAmazonInvoiceUploadTaskForInvoice = async () => createInvoiceRecord({ taskId: "task_latest" });
  fake.listAmazonInvoiceUploadLedger = async () => [createLedgerRecord()];
}

function attachDownloadTaskMethods(fake: MutableFakeWorkbench): void {
  fake.startAmazonTaxInvoiceDownloadTask = async () => {
    fake.startCalls += 1;
    return createDownloadRecord();
  };
  fake.getAmazonTaxInvoiceDownloadTaskStatus = async (taskId: string) => createDownloadRecord({ taskId, status: "completed" });
  fake.getLatestAmazonTaxInvoiceDownloadTask = async () => null;
  fake.getAmazonTaxInvoiceDownloadArtifact = async () => null;
}

export const withExternalEnv = (enabled: boolean): void => {
  process.env.GRASSEYE_EXTERNAL_API_ENABLED = enabled ? "true" : "false";
  process.env.GRASSEYE_EXTERNAL_API_KEY = apiKey;
  process.env.GRASSEYE_EXTERNAL_ALLOWED_ORIGINS = externalOrigin;
  process.env.GRASSEYE_EXTERNAL_CALLBACK_ALLOWED_BASE_URLS = `${externalOrigin}/api/grasseye`;
};

export const withServer = async (
  run: (input: { rootUrl: string; workbench: FakeWorkbench }) => Promise<void>,
): Promise<void> => {
  const workbench = createFakeWorkbench();
  const server = createWorkbenchServer({ workbench, baseUrl: localBaseUrl });
  await new Promise<void>((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => resolvePromise());
  });
  const address = server.address() as AddressInfo;
  try {
    await run({ rootUrl: `http://127.0.0.1:${address.port}`, workbench });
  } finally {
    await new Promise<void>((resolvePromise, rejectPromise) => {
      server.close((error) => error ? rejectPromise(error) : resolvePromise());
    });
  }
};

const buildInvoiceForm = (missionPatch: Record<string, unknown> = {}): FormData => {
  const form = new FormData();
  form.set("mission", JSON.stringify({
    sourceSystem: "ontheway",
    requestId: "ontheway-invoice-test-1",
    missionType: "amazon_invoice_upload",
    marketplace: "AE",
    amazonOrderId: "000-0000000-0000000",
    invoiceNo: "INV-TEST-1",
    sellerCentralEntryUrl: "https://sellercentral.amazon.ae/orders-v3/order/000-0000000-0000000",
    adminOrderUrl: `${externalOrigin}/admin/orders/123`,
    ...missionPatch,
  }));
  form.set("invoicePdf", new Blob(["%PDF-1.4\n"], { type: "application/pdf" }), "invoice.pdf");
  return form;
};

export const postExternalStart = (
  rootUrl: string,
  input: { key?: string; missionPatch?: Record<string, unknown>; origin?: string } = {},
): Promise<Response> => {
  const headers: Record<string, string> = {
    Origin: input.origin ?? externalOrigin,
    "X-GrassEye-Source-System": "ontheway",
    "X-GrassEye-Request-Id": "request-test-1",
  };
  if (input.key !== undefined) {
    headers["X-GrassEye-Agent-Key"] = input.key;
  }
  return fetch(`${rootUrl}/api/plugins/amazon-invoice-upload/start`, {
    method: "POST",
    headers,
    body: buildInvoiceForm(input.missionPatch),
  });
};

export const postExternalDownloadStart = (
  rootUrl: string,
  input: { key?: string; missionPatch?: Record<string, unknown>; origin?: string } = {},
): Promise<Response> => {
  const headers: Record<string, string> = {
    Origin: input.origin ?? externalOrigin,
    "content-type": "application/json",
    "X-GrassEye-Source-System": "ontheway",
    "X-GrassEye-Request-Id": "download-request-test-1",
  };
  if (input.key !== undefined) {
    headers["X-GrassEye-Agent-Key"] = input.key;
  }
  return fetch(`${rootUrl}/api/plugins/amazon-invoice-upload/download/start`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      missionType: "amazon_tax_invoice_download",
      marketplace: "AE",
      sellerCentralEntryUrl: "https://sellercentral.amazon.ae/home",
      reportKind: "afn_shipment_invoicing_tax_invoice",
      dateRange: "last_30_days",
      format: "csv",
      sourceSystem: "ontheway",
      requestId: "download-request-test-1",
      requireHumanReview: true,
      ...input.missionPatch,
    }),
  });
};

export const readJson = async (response: Response): Promise<Record<string, unknown>> =>
  await response.json() as Record<string, unknown>;
